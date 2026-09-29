const express = require("express");
const prisma = require("../db");
const { requireAuth, isSubscriptionActive } = require("../auth");
const { INTRO_HISTORY_RETENTION_YEARS } = require("../retention");
const { sendEmail } = require("../notify");

const router = express.Router();

// Email-ul TĂU (administrator), unde primești notificare de fiecare dată când
// un client declară o plată prin transfer bancar — ca să știi să intri în
// panoul de admin și să activezi contul. Folosește ADMIN_NOTIFY_EMAIL dacă e
// setat separat, altfel cade pe ADMIN_EMAIL (același cont admin din
// src/seedAdmin.js) — deci în multe cazuri nu trebuie să adaugi nimic nou în
// .env, funcționează direct cu ce ai deja configurat.
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;

// Trimite notificarea de "plată declarată" către admin — best-effort: dacă
// trimiterea eșuează (sau RESEND_API_KEY nu e setat), doar loghează eroarea,
// nu blochează răspunsul către client (clientul tot vede codul/suma generate).
async function notifyAdminOfDeclaredPayment(user, { months, amountRon, code }) {
  if (!ADMIN_NOTIFY_EMAIL) {
    console.warn(
      "[billing] Niciun ADMIN_NOTIFY_EMAIL/ADMIN_EMAIL setat — nu pot trimite notificarea de plată declarată."
    );
    return;
  }
  const html = `
    <h2 style="font-family:sans-serif">Plată declarată — transfer bancar</h2>
    <p style="font-family:sans-serif;font-size:15px;line-height:1.6">
      Un client a declarat că plătește prin transfer bancar. Verifică extrasul de cont pentru suma și codul de mai jos, apoi activează-i contul din panoul de admin.
    </p>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;margin-top:8px">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Client:</td><td style="font-weight:600">${user.email}</td></tr>
      ${user.businessName ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Firmă:</td><td>${user.businessName}</td></tr>` : ""}
      ${user.cui ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">CUI:</td><td>${user.cui}</td></tr>` : ""}
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Luni declarate:</td><td>${months} ${months === 1 ? "lună" : "luni"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Sumă așteptată:</td><td style="font-weight:600">${amountRon} RON</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Cod de verificare:</td><td style="font-family:monospace;font-weight:700;font-size:16px">${code}</td></tr>
    </table>
    <p style="font-family:sans-serif;color:#888;font-size:12px;margin-top:16px">
      Notificare automată Herbatium — trimisă la fiecare declarare/modificare a duratei alese de un client pe pagina de abonament.
    </p>
  `;
  const r = await sendEmail(ADMIN_NOTIFY_EMAIL, `Plată declarată: ${user.email} — cod ${code}`, html);
  if (!r.ok && !r.skipped) {
    console.error("[billing] Notificarea de plată declarată nu a putut fi trimisă către admin.");
  }
}

// ============================================================================
// COD DE PLATĂ — identificator unic per client, valabil pentru orice metodă
// de plată (transfer bancar acum; Stripe/Netopia includ acest cod în
// metadata/descriere, dacă sunt reactivate — vezi mai jos la /checkout).
// Scop: elimini ambiguitatea „ce nume/email a scris clientul pe transfer" —
// codul e generat de aplicație, stabil, și nu se poate confunda cu numele
// firmei, alt email, sau titularul real al contului bancar.
// ============================================================================
const PAYMENT_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // fără 0/O, 1/I/L — evită confuzia la citire/scriere manuală

function generatePaymentCode() {
  let code = "HRB-";
  for (let i = 0; i < 6; i++) {
    code += PAYMENT_CODE_CHARS[Math.floor(Math.random() * PAYMENT_CODE_CHARS.length)];
  }
  return code;
}

// Generează și salvează un cod de plată pentru user, dacă nu are deja unul.
// Reîncearcă la coliziune (extrem de improbabilă, dar codul e scurt) — eroare
// Prisma P2002 = unique constraint violation.
async function ensurePaymentCode(user) {
  if (user.paymentCode) return user.paymentCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { paymentCode: generatePaymentCode() },
      });
      return updated.paymentCode;
    } catch (e) {
      if (e.code === "P2002") continue; // coliziune de cod — reîncearcă cu altul
      throw e;
    }
  }
  throw new Error("payment_code_generation_failed");
}

function getMonthlyPriceRon() {
  return Number(process.env.BANK_TRANSFER_AMOUNT_RON) || 200;
}

// ============================================================================
// PRAGURI DE DISCOUNT pentru plata în avans pe mai multe luni (transfer
// bancar). Reducerea se aplică la FIECARE lună din plan (nu doar la o
// singură lună) — ex: 12 luni => fiecare lună costă cu 15% mai puțin decât
// prețul normal. Doar aceste 4 durate sunt permise (vezi validarea de mai
// jos) — dacă vrei alte durate, adaugă-le aici.
// ============================================================================
const MULTI_MONTH_DISCOUNTS = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 };

// Preț introductiv — prima lună, DOAR pentru clienți noi eligibili (vezi
// isEligibleForIntroPrice mai jos). Se aplică la fel indiferent de planul
// ales (1/3/6/12 luni): doar prima lună a primei plăți e la acest preț,
// restul lunilor din plan sunt la prețul normal (cu discountul planului).
const INTRO_PRICE_RON = 99;

// Oferta de preț introductiv e o promoție cu termen limită, cerută explicit:
// valabilă doar până la 23:59:59, ora României, pe 10 octombrie 2026. DUPĂ
// acest moment, NIMENI nu mai primește 99 lei — nici clienții noi, nici
// vechi — indiferent de restul verificărilor de eligibilitate de mai jos.
// Nu se mai reactivează de la sine — dacă se va relansa vreodată, necesită
// o schimbare explicită aici, nu doar trecerea timpului.
const INTRO_PRICE_PROMO_DEADLINE = new Date("2026-10-11T00:00:00+03:00");

function isIntroPricePromoActive() {
  return new Date() < INTRO_PRICE_PROMO_DEADLINE;
}

// "Client nou" = cont care nu a avut NICIODATĂ un abonament activ înainte,
// nici prin Stripe, nici prin activare manuală — vezi User.hasEverSubscribed
// (prisma/schema.prisma). Odată ce acest flag devine true, rămâne true
// pentru totdeauna: un client care a avut abonament, l-a suspendat/anulat și
// a revenit NU mai e considerat "nou" și NU mai primește prima lună la 99
// lei, chiar dacă a stat o perioadă lungă fără abonament activ.
//
// A DOUA/A TREIA VERIFICARE, de rezervă: politica de retenție
// (src/retention.js) ȘTERGE DEFINITIV contul la 30 de zile după anulare,
// dacă nu se reabonează — inclusiv câmpul hasEverSubscribed de mai sus. Ca
// un fost client să nu poată recrea un cont nou (cu alt CUI dar același
// e-mail, sau invers) și să prindă din nou prețul de bun venit, verificăm
// și cele două tabele separate IntroPriceHistory (după CUI) și
// IntroPriceHistoryEmail (după e-mail, normalizat) — niciunul legat de
// User, deci nu se șterg odată cu contul. Fiecare verificare respectă
// fereastra de retenție proprie (INTRO_HISTORY_RETENTION_YEARS ani de la
// ULTIMA activare) — vezi Politica de confidențialitate, secțiunea 3.
function introHistoryCutoffDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - INTRO_HISTORY_RETENTION_YEARS);
  return d;
}

function normalizeEmailForHistory(email) {
  return String(email || "").trim().toLowerCase();
}

async function isEligibleForIntroPrice(user) {
  if (!isIntroPricePromoActive()) return false;
  if (user.hasEverSubscribed) return false;
  const cutoff = introHistoryCutoffDate();
  if (user.cui) {
    const priorCui = await prisma.introPriceHistory.findFirst({
      where: { cui: user.cui, lastActivatedAt: { gte: cutoff } },
    });
    if (priorCui) return false;
  }
  const normalizedEmail = normalizeEmailForHistory(user.email);
  if (normalizedEmail) {
    const priorEmail = await prisma.introPriceHistoryEmail.findFirst({
      where: { email: normalizedEmail, lastActivatedAt: { gte: cutoff } },
    });
    if (priorEmail) return false;
  }
  return true;
}

// Înregistrează/reîmprospătează definitiv CUI-ul ȘI e-mailul clientului ca
// "a avut vreodată abonament" — apelată la FIECARE activare reușită
// (manuală sau Stripe), pe lângă setarea hasEverSubscribed pe User.
// Idempotent (cui/email sunt chei primare — se face upsert, cu
// reîmprospătarea datei la fiecare activare) și best-effort: dacă eșuează,
// nu blocăm activarea propriu-zisă.
async function markClientAsEverSubscribed(user) {
  const now = new Date();
  if (user.cui) {
    try {
      await prisma.introPriceHistory.upsert({
        where: { cui: user.cui },
        update: { lastActivatedAt: now },
        create: { cui: user.cui, lastActivatedAt: now },
      });
    } catch (e) {
      console.error("[billing] Nu am putut înregistra CUI-ul în istoricul de plăți:", e.message);
    }
  }
  const normalizedEmail = normalizeEmailForHistory(user.email);
  if (normalizedEmail) {
    try {
      await prisma.introPriceHistoryEmail.upsert({
        where: { email: normalizedEmail },
        update: { lastActivatedAt: now },
        create: { email: normalizedEmail, lastActivatedAt: now },
      });
    } catch (e) {
      console.error("[billing] Nu am putut înregistra e-mailul în istoricul de plăți:", e.message);
    }
  }
}

// Șterge definitiv rândurile din IntroPriceHistory / IntroPriceHistoryEmail
// pentru un CUI și/sau e-mail dat — folosită DOAR când persoana își exercită
// activ dreptul la ștergere (Art. 17 GDPR), fie prin auto-ștergerea contului
// din aplicație (src/routes/account.js), fie printr-o cerere scrisă
// procesată manual de admin (src/routes/admin.js). NU se apelează la
// ștergerea automată după 30 de zile de inactivitate (src/retention.js) —
// acolo persoana nu a cerut nimic activ, deci evidența anti-abuz rămâne
// (până expiră singură, după INTRO_HISTORY_RETENTION_YEARS ani) — vezi
// analiza din Politica de confidențialitate, secțiunea 3, pentru motivul
// acestei distincții (pragul "motive legitime imperioase" de la Art. 21
// GDPR, aplicabil doar unei opoziții/cereri explicite).
async function eraseIntroPriceHistoryFor({ cui, email }) {
  const result = { cuiDeleted: 0, emailDeleted: 0 };
  if (cui) {
    try {
      const r = await prisma.introPriceHistory.deleteMany({ where: { cui } });
      result.cuiDeleted = r.count;
    } catch (e) {
      console.error("[billing] Ștergerea CUI din istoricul preț introductiv a eșuat:", e.message);
    }
  }
  const normalizedEmail = normalizeEmailForHistory(email);
  if (normalizedEmail) {
    try {
      const r = await prisma.introPriceHistoryEmail.deleteMany({ where: { email: normalizedEmail } });
      result.emailDeleted = r.count;
    } catch (e) {
      console.error("[billing] Ștergerea e-mailului din istoricul preț introductiv a eșuat:", e.message);
    }
  }
  return result;
}

// Calculează suma totală de plată pentru transfer bancar, pe baza numărului
// de luni alese și a istoricului clientului (nou vs. existent). Suma e
// întotdeauna un număr întreg de lei (rotunjit per lună, apoi înmulțit),
// fiindcă se salvează într-un câmp Int în baza de date.
async function computeBankTransferAmount(months, user) {
  const discount = MULTI_MONTH_DISCOUNTS[months];
  if (discount === undefined) {
    throw new Error("months_invalid");
  }
  const perMonthPrice = Math.round(getMonthlyPriceRon() * (1 - discount));
  if (await isEligibleForIntroPrice(user)) {
    // Prima lună la 99 lei, restul (months - 1) luni la prețul planului.
    return INTRO_PRICE_RON + perMonthPrice * (months - 1);
  }
  return perMonthPrice * months;
}

// Date pentru plata prin transfer bancar (singura metodă de plată activă
// acum — plata cu cardul prin Netopia nu e încă implementată/pornită).
// IBAN-ul NU e scris în cod — vine din variabila de mediu
// BANK_TRANSFER_IBAN, setată în Railway direct de tine (nu de Claude — e
// dată bancară).
router.get("/bank-transfer-info", requireAuth, async (req, res) => {
  if (!process.env.BANK_TRANSFER_IBAN) {
    return res.status(404).json({ error: "not_configured" });
  }
  const normalPrice = getMonthlyPriceRon();
  res.json({
    iban: process.env.BANK_TRANSFER_IBAN,
    holder: process.env.BANK_TRANSFER_HOLDER || "NICOALE SILVIA PERSOANĂ FIZICĂ AUTORIZATĂ",
    bankName: process.env.BANK_TRANSFER_BANK_NAME || "",
    amountRon: normalPrice, // preț normal/lună (fără discount) — păstrat pentru compatibilitate
    introPriceRon: INTRO_PRICE_RON,
    introPromoActive: isIntroPricePromoActive(),
    introPromoDeadline: INTRO_PRICE_PROMO_DEADLINE.toISOString(),
    // Planurile disponibile, cu discountul și prețul/lună rezultat — pagina
    // de abonament construiește selectorul de luni din astea, ca discountul
    // să fie definit într-un SINGUR loc (aici), nu și în front-end.
    plans: Object.keys(MULTI_MONTH_DISCOUNTS).map((k) => {
      const months = Number(k);
      const discountPct = MULTI_MONTH_DISCOUNTS[months];
      return {
        months,
        discountPct,
        perMonthRon: Math.round(normalPrice * (1 - discountPct)),
      };
    }),
  });
});

// "Declară" intenția de plată prin transfer bancar: clientul alege pentru
// câte luni vrea să plătească, iar noi (1) îi asigurăm un cod de plată
// stabil (îl generăm dacă nu are deja unul) și (2) reținem ce a ales, ca să
// apară în panoul de admin exact ce se așteaptă (nu doar "cineva a plătit
// ceva"). NU confirmă nicio plată reală — doar pregătește datele pentru ea.
// Apelat automat de abonament.html de fiecare dată când clientul schimbă
// selectorul de luni, ca suma și codul să se completeze fără intervenție.
router.post("/bank-transfer/declare", requireAuth, async (req, res) => {
  const months = Number((req.body || {}).months);
  if (!Number.isInteger(months) || !(months in MULTI_MONTH_DISCOUNTS)) {
    return res.status(400).json({ error: "months_invalid" });
  }
  try {
    const code = await ensurePaymentCode(req.user);
    const amountRon = await computeBankTransferAmount(months, req.user);
    const introApplied = await isEligibleForIntroPrice(req.user);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { declaredMonths: months, declaredAmountRon: amountRon, declaredAt: new Date() },
    });
    res.json({ code, months, amountRon, introApplied, introPromoActive: isIntroPricePromoActive() });
  } catch (e) {
    console.error("[billing] declarare plată prin transfer bancar eșuată:", e.message);
    res.status(500).json({ error: "declare_failed" });
  }
});

// Notificare EXPLICITĂ către admin — apelată doar când clientul apasă
// "Am făcut transferul" (nu automat la fiecare schimbare a selectorului de
// luni, ca să nu primești un email de fiecare dată când cineva doar
// deschide pagina de abonament). Necesită o declarație existentă (clientul
// trebuie să fi ales deja o durată — vezi /bank-transfer/declare).
router.post("/bank-transfer/notify-paid", requireAuth, async (req, res) => {
  const user = req.user;
  if (!user.paymentCode || !user.declaredMonths || !user.declaredAmountRon) {
    return res.status(400).json({ error: "no_declaration" });
  }
  try {
    await notifyAdminOfDeclaredPayment(user, {
      months: user.declaredMonths,
      amountRon: user.declaredAmountRon,
      code: user.paymentCode,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[billing] Notificarea explicită de plată eșuată:", e.message);
    // Nu blocăm clientul din cauza unei erori de email — el tot a "confirmat"
    // plata; doar tu ai putea afla mai târziu prin panoul de admin oricum.
    res.json({ ok: true, emailWarning: true });
  }
});

router.get("/status", requireAuth, (req, res) => {
  const u = req.user;
  const active = isSubscriptionActive(u);
  res.json({
    subscriptionStatus: u.subscriptionStatus,
    currentPeriodEnd: u.currentPeriodEnd,
    subscriptionActive: active,
  });
});

module.exports = {
  router,
  markClientAsEverSubscribed,
  eraseIntroPriceHistoryFor,
  isIntroPricePromoActive,
};
