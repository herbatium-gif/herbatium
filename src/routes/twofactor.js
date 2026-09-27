// Autentificare în doi factori (2FA) — DOAR pentru contul de administrator
// (isAdmin: true). Clienții obișnuiți nu au acest flux și nu sunt afectați
// în niciun fel — vezi comentariul din prisma/schema.prisma (câmpurile
// twoFactorEnabled/twoFactorSecret/twoFactorBackupCodes).
//
// Cum funcționează (TOTP — Time-based One-Time Password, compatibil cu Google
// Authenticator, Authy, 1Password etc.):
//  1. POST /setup  — generează un secret nou + un cod QR (nu se activează
//     încă — trebuie confirmat mai jos, ca să nu rămână contul "pe jumătate"
//     configurat dacă admin nu apucă să scaneze codul).
//  2. POST /confirm — adminul introduce codul de 6 cifre afișat în aplicația
//     de autentificare, ca dovadă că a scanat corect; abia acum
//     twoFactorEnabled devine true.
//  3. La login (routes/auth.js): dacă twoFactorEnabled, se cere un cod în
//     plus, verificat prin POST /login-verify (rută publică — adminul nu e
//     încă autentificat cu cookie-ul de sesiune în acest pas).
//  4. POST /disable — dezactivează 2FA (cere parola curentă, ca protecție).
//
// Coduri de rezervă (backup codes): 8 coduri generate o singură dată, la
// confirmare, arătate adminului O SINGURĂ DATĂ (ca la orice serviciu — GitHub,
// Google etc.) — dacă pierde telefonul cu aplicația de autentificare, poate
// folosi unul dintre ele în locul codului TOTP. Sunt hash-uite (bcrypt),
// niciodată stocate în clar, și fiecare cod se poate folosi o singură dată.
const express = require("express");
const crypto = require("crypto");
// otplib v13 expune funcții separate (generateSecret/generateURI/generate/
// verify), NU un obiect "authenticator" ca versiunile vechi (v10-12) — API
// diferit, verificat direct (nu doar din memorie/documentație veche).
const { generateSecret, generateURI, verify: verifyTotp } = require("otplib");
const QRCode = require("qrcode");
const prisma = require("../db");
const jwt = require("jsonwebtoken");
const {
  requireAuth,
  requireAdmin,
  verifyPassword,
  hashPassword,
  signToken,
  setAuthCookie,
  resetFailedLogin,
} = require("../auth");

const router = express.Router();

const ISSUER = "Herbatium";
const BACKUP_CODE_COUNT = 8;

function generateBackupCodes() {
  // Format ușor de citit/copiat: "XXXX-XXXX" (litere mari + cifre, fără 0/O/1/I
  // ca să nu se confunde la citire manuală).
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) {
      if (j === 4) code += "-";
      code += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }
    codes.push(code);
  }
  return codes;
}

// ===== Pasul 2 al login-ului (public — adminul nu are încă sesiune) =====
// Verifică fie un cod TOTP din aplicația de autentificare, fie un cod de
// rezervă, pe baza pendingToken-ului emis de POST /api/auth/login.
router.post("/login-verify", async (req, res) => {
  try {
    const pendingToken = String((req.body || {}).pendingToken || "");
    const code = String((req.body || {}).code || "").trim();
    if (!pendingToken || !code) return res.status(400).json({ error: "code_required" });

    let payload;
    try {
      payload = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: "pending_token_invalid_or_expired" });
    }
    if (payload.purpose !== "2fa_pending") return res.status(401).json({ error: "pending_token_invalid_or_expired" });

    const user = await prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user || !user.isAdmin || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(401).json({ error: "pending_token_invalid_or_expired" });
    }

    const normalizedCode = code.replace(/\s+/g, "");
    let usedBackupCode = false;

    let valid = false;
    try {
      const result = await verifyTotp({ token: normalizedCode, secret: user.twoFactorSecret });
      valid = !!(result && result.valid);
    } catch (e) {
      valid = false;
    }

    if (!valid) {
      // Nu era un cod TOTP valid — încearcă pe rând codurile de rezervă
      // rămase (hash-uite). Dacă se potrivește unul, îl consumă (îl scoate
      // din listă), ca să nu poată fi refolosit.
      const backupCodes = Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes : [];
      for (let i = 0; i < backupCodes.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        const match = await verifyPassword(normalizedCode.toUpperCase(), backupCodes[i]);
        if (match) {
          valid = true;
          usedBackupCode = true;
          backupCodes.splice(i, 1);
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorBackupCodes: backupCodes },
          });
          break;
        }
      }
    }

    if (!valid) {
      return res.status(401).json({ error: "code_invalid" });
    }

    await resetFailedLogin(user);
    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.json({ ok: true, email: user.email, usedBackupCode });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// Restul rutelor de mai jos cer un cont de admin deja autentificat (gestiunea
// propriului 2FA — nu poți activa/dezactiva 2FA pe contul altcuiva).
router.use(requireAuth, requireAdmin);

// Starea curentă — pentru panoul de admin, ca să știe ce buton să arate.
router.get("/status", (req, res) => {
  res.json({ enabled: !!req.user.twoFactorEnabled });
});

// Generează un secret NOU + cod QR. NU activează încă 2FA (twoFactorEnabled
// rămâne false până la POST /confirm) — ca să nu se "blocheze" adminul afară
// dacă generează un cod QR și nu apucă să-l scaneze/confirme.
router.post("/setup", async (req, res) => {
  if (req.user.twoFactorEnabled) {
    return res.status(400).json({ error: "already_enabled" });
  }
  const secret = generateSecret();
  await prisma.user.update({
    where: { id: req.user.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false, twoFactorBackupCodes: [] },
  });
  const otpauthUrl = generateURI({ issuer: ISSUER, label: req.user.email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
  res.json({ ok: true, secret, qrDataUrl });
});

// Confirmă instalarea — adminul introduce codul de 6 cifre afișat de
// aplicația de autentificare, dovadă că a scanat/introdus corect secretul.
// Abia acum se generează codurile de rezervă și se activează 2FA.
router.post("/confirm", async (req, res) => {
  const code = String((req.body || {}).code || "").trim().replace(/\s+/g, "");
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user.twoFactorSecret) return res.status(400).json({ error: "setup_not_started" });
  if (user.twoFactorEnabled) return res.status(400).json({ error: "already_enabled" });

  let valid = false;
  try {
    const result = await verifyTotp({ token: code, secret: user.twoFactorSecret });
    valid = !!(result && result.valid);
  } catch (e) {
    valid = false;
  }
  if (!valid) return res.status(400).json({ error: "code_invalid" });

  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = await Promise.all(backupCodes.map((c) => hashPassword(c)));

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, twoFactorBackupCodes: hashedBackupCodes },
  });

  console.log(`[2fa] Autentificare în doi factori activată pentru ${user.email}`);

  // Codurile de rezervă în clar se întorc O SINGURĂ DATĂ, acum — nu mai sunt
  // recuperabile ulterior (doar hash-uri rămân în bază). Adminul trebuie să
  // le salveze imediat (ex. într-un manager de parole) — vezi și explicația
  // trimisă în conversație.
  res.json({ ok: true, backupCodes });
});

// Dezactivează 2FA — cere parola curentă, ca să nu poată fi oprit doar pe
// baza unei sesiuni de browser rămasă deschisă, fără să se retasteze parola.
router.post("/disable", async (req, res) => {
  const password = String((req.body || {}).password || "");
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_password" });

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
  });
  console.log(`[2fa] Autentificare în doi factori dezactivată pentru ${user.email}`);
  res.json({ ok: true });
});

module.exports = router;
