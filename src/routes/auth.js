const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../db");
const {
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireActiveSubscription,
  isSubscriptionActive,
} = require("../auth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL = "7d";

router.post("/register", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const acceptTerms = !!req.body.acceptTerms;
    const marketing = !!req.body.marketing;

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "email_invalid" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "password_too_short" });
    }
    // Art. 6 și 7 GDPR: contul nu poate fi creat fără acordul explicit cu
    // Termenii și fără confirmarea că utilizatorul a luat la cunoștință
    // Politica de confidențialitate. Abonarea la marketing rămâne opțională
    // și nebifată implicit (art. 7 alin. (4) — nu poate fi o condiție a serviciului).
    if (!acceptTerms) {
      return res.status(400).json({ error: "terms_not_accepted" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "email_taken" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        termsVersion: process.env.LEGAL_VERSION || "1.0",
        termsAcceptedAt: new Date(),
        marketingConsent: marketing,
        data: { create: {} }, // rând gol de date, completat pe măsură ce utilizatorul lucrează în aplicație
      },
    });

    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.json({ ok: true, email: user.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "invalid_credentials" });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.json({ ok: true, email: user.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const u = req.user;
  let active = u.isAdmin || isSubscriptionActive(u);
  let owner = null;
  if (!active && u.teamOwnerId) {
    owner = await prisma.user.findUnique({ where: { id: u.teamOwnerId } });
    active = !!owner && isSubscriptionActive(owner);
  }
  res.json({
    email: u.email,
    subscriptionStatus: u.subscriptionStatus,
    currentPeriodEnd: u.currentPeriodEnd,
    subscriptionActive: active,
    isTeamMember: !!u.teamOwnerId,
    teamOwnerEmail: owner ? owner.email : undefined,
    termsVersion: u.termsVersion,
    termsAcceptedAt: u.termsAcceptedAt,
    marketingConsent: !!u.marketingConsent,
    isAdmin: !!u.isAdmin,
  });
});

// ===== Cont de echipă: invitație de membru =====
// Doar contul principal (nu deja membru al altcuiva) poate invita — membrul
// invitat va partaja aceleași date și același abonament, fără cont de plată propriu.
router.post("/invite", requireAuth, requireActiveSubscription, async (req, res) => {
  if (req.user.teamOwnerId) {
    return res.status(403).json({ error: "already_a_member" });
  }
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "email_invalid" });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "email_taken" });

  const token = jwt.sign(
    { purpose: "team_invite", ownerId: req.user.id, invitedEmail: email },
    process.env.JWT_SECRET,
    { expiresIn: INVITE_TTL }
  );
  const appUrl = process.env.APP_URL || "";
  res.json({ ok: true, inviteUrl: `${appUrl}/accept-invite.html?token=${encodeURIComponent(token)}` });
});

// Membrul invitat își setează parola și contul e creat, legat de owner.
router.post("/accept-invite", async (req, res) => {
  try {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    const acceptTerms = !!req.body.acceptTerms;
    if (password.length < 8) return res.status(400).json({ error: "password_too_short" });
    if (!acceptTerms) return res.status(400).json({ error: "terms_not_accepted" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ error: "invite_invalid_or_expired" });
    }
    if (payload.purpose !== "team_invite") return res.status(400).json({ error: "invite_invalid_or_expired" });

    const owner = await prisma.user.findUnique({ where: { id: payload.ownerId } });
    if (!owner) return res.status(400).json({ error: "owner_not_found" });

    const existing = await prisma.user.findUnique({ where: { email: payload.invitedEmail } });
    if (existing) return res.status(409).json({ error: "email_taken" });

    const passwordHash = await hashPassword(password);
    const member = await prisma.user.create({
      data: {
        email: payload.invitedEmail,
        passwordHash,
        teamOwnerId: owner.id,
        termsVersion: process.env.LEGAL_VERSION || "1.0",
        termsAcceptedAt: new Date(),
      },
    });

    const authToken = signToken(member.id);
    setAuthCookie(res, authToken);
    res.json({ ok: true, email: member.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

module.exports = router;
