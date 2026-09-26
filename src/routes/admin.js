// Panou de administrator platformă — accesibil DOAR contului cu isAdmin: true
// (creat automat din ADMIN_EMAIL/ADMIN_PASSWORD, vezi src/seedAdmin.js).
// Nu are legătură cu datele clienților (rețete, loturi etc.) — arată doar
// informații despre conturi, utile pentru administrarea aplicației.
const express = require("express");
const prisma = require("../db");
const stripe = require("../stripe");
const { requireAuth, requireAdmin } = require("../auth");
const { sendEmail } = require("../notify");
const { markClientAsEverSubscribed, eraseIntroPriceHistoryFor, isIntroPricePromoActive } = require("./billing");
const { CHANGELOG, CURRENT_VERSION } = require("../changelog");
const { missingCompanyFields } = require("../legalConfig");

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Listă cu toate conturile înregistrate — pentru o privire de ansamblu asupra
// clienților și a stării abonamentelor lor.
router.get("/users", async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      createdAt: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      isAdmin: true,
      teamOwnerId: true,
      publicPageEnabled: true,
      businessName: true,
      cui: true,
      paymentCode: true,
      declaredMonths: true,
      declaredAmountRon: true,
      declaredAt: true,
      hasEverSubscribed: true,
    },
  });
  // introPromoActive: flag global (nu per-utilizator) — spune panoului de admin
  // dacă oferta de 99 lei mai există deloc acum, ca să nu afișeze un badge
  // "nou — 99 lei/luna 1" înșelător după 10.10.2026 (vezi billing.js).
  res.json({ users, introPromoActive: isIntroPricePromoActive() });
});

// Plăți declarate (transfer bancar) care încă așteaptă activare manuală —
// panoul principal de lucru: aici vezi exact cine a spus că plătește, pentru
// câte luni, și cu ce cod, ca să confirmi în extrasul de cont și să activezi
// fără nicio ambiguitate.
router.get("/payment-declarations", async (req, res) => {
  const users = await prisma.user.findMany({
    where: { declaredAt: { not: null } },
    orderBy: { declaredAt: "desc" },
    select: {
      id: true,
      email: true,
      businessName: true,
      cui: true,
      paymentCode: true,
      declaredMonths: true,
      declaredAmountRon: true,
      declaredAt: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      hasEverSubscribed: true,
    },
  });
  res.json({ users, introPromoActive: isIntroPricePromoActive() });
});

// Activare/extindere MANUALĂ a abonamentului unui cont — pentru plăți primite
// prin transfer bancar (fără procesator de plăți). Verifică TU, în extrasul
// de cont, că a venit plata (cu referința = email-ul contului), abia apoi
// apeși acest buton. Nu are nicio legătură cu Stripe — dar folosește aceleași
// două câmpuri (subscriptionStatus, currentPeriodEnd) pe care le citește restul
// aplicației (vezi isSubscriptionActive din src/auth.js), deci accesul
// funcționează identic, indiferent cum a fost plătit abonamentul.
router.post("/users/:id/activate-manual", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "not_found" });

  // Zile explicite (override manual, pentru cazuri speciale — sumă parțială,
  // client fără nicio declarație în aplicație etc.) — dacă lipsesc, folosim
  // AUTOMAT ce a declarat clientul pe pagina de abonament (luni × 30 zile).
  // Așa activezi exact cât a plătit, fără să calculezi tu manual sau să
  // greșești un număr.
  let days = Number((req.body || {}).days);
  if (!Number.isFinite(days) || days <= 0) {
    if (!user.declaredMonths) {
      return res.status(400).json({ error: "days_required_no_declaration" });
    }
    days = user.declaredMonths * 30;
  }
  if (days <= 0 || days > 366) {
    return res.status(400).json({ error: "days_invalid" });
  }

  const now = new Date();
  // Dacă mai are acces neexpirat, extinde de la data expirării curente (nu de
  // la azi) — ca să nu piardă zile plătite dacă activezi cu puțin timp înainte
  // să expire abonamentul anterior.
  const base =
    user.currentPeriodEnd && new Date(user.currentPeriodEnd) > now ? new Date(user.currentPeriodEnd) : now;
  const newPeriodEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: "active",
      currentPeriodEnd: newPeriodEnd,
      canceledAt: null,
      // Marchează definitiv contul ca "a mai avut abonament" — de acum
      // înainte NU mai e eligibil pentru prețul introductiv de 99 lei la
      // nicio reînnoire viitoare, chiar dacă suspendă și revine. Vezi
      // isEligibleForIntroPrice în src/routes/billing.js.
      hasEverSubscribed: true,
      // Curățăm declarația — a fost "consumată" prin această activare. Codul
      // de plată (paymentCode) rămâne neschimbat, e stabil pe cont, se
      // reutilizează la următoarea reînnoire.
      declaredMonths: null,
      declaredAmountRon: null,
      declaredAt: null,
    },
  });
  // Vezi comentariul de mai sus + IntroPriceHistory (prisma/schema.prisma):
  // înregistrăm CUI-ul permanent, independent de contul (User) care s-ar
  // putea șterge ulterior prin politica de retenție.
  await markClientAsEverSubscribed(updated);

  console.log(
    `[admin] Abonament activat manual pentru ${updated.email} (${days} zile) — acces până la ${newPeriodEnd.toISOString()}, activat de ${req.user.email}`
  );

  res.json({ ok: true, email: updated.email, currentPeriodEnd: updated.currentPeriodEnd, daysGranted: days });
});

// Procesează o cerere SCRISĂ de ștergere (Art. 17 GDPR) primită direct (de
// obicei pe adresa de GDPR), pentru CUI și/sau e-mail — folosită manual de
// admin, DUPĂ ce a confirmat identitatea solicitantului. Funcționează și
// dacă persoana nu mai are cont (a fost deja șters, automat sau de ea
// însăși) — scopul e explicit să șteargă evidența de rezervă
// (IntroPriceHistory/IntroPriceHistoryEmail), care altfel supraviețuiește
// contului. Dacă a rămas totuși un cont activ pe acel CUI/e-mail, îl șterge
// și pe acela (cu tot ce implică ștergerea unui cont — vezi /account.js
// pentru fluxul echivalent de auto-ștergere).
router.post("/gdpr-erase", async (req, res) => {
  const cui = String((req.body || {}).cui || "").trim() || null;
  const email = String((req.body || {}).email || "").trim() || null;
  if (!cui && !email) {
    return res.status(400).json({ error: "cui_or_email_required" });
  }

  const historyResult = await eraseIntroPriceHistoryFor({ cui, email });

  let accountDeleted = null;
  const where = [];
  if (cui) where.push({ cui });
  if (email) where.push({ email });
  if (where.length) {
    const existing = await prisma.user.findFirst({ where: { OR: where } });
    if (existing) {
      if (existing.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
        } catch (e) {
          console.error("[admin] Nu am putut anula abonamentul Stripe la ștergerea GDPR:", e.message);
        }
      }
      const teamMembers = !existing.teamOwnerId
        ? await prisma.user.findMany({ where: { teamOwnerId: existing.id }, select: { email: true } })
        : [];
      await prisma.feedback.updateMany({
        where: { userId: existing.id },
        data: { userId: null, email: "(cont șters)" },
      });
      // Membrii de echipă (dacă există) rămân în bază, dar teamOwnerId devine
      // automat null (onDelete: SetNull) — își pierd accesul la datele
      // partajate, dar contul lor propriu nu e afectat. Cererea de ștergere
      // a titularului principal are prioritate; anunță-i separat, manual.
      await prisma.user.delete({ where: { id: existing.id } });
      accountDeleted = existing.email;
      if (teamMembers.length) {
        console.warn(
          `[admin] Contul șters (${existing.email}) avea membri de echipă activi — anunță-i manual: ${teamMembers.map((m) => m.email).join(", ")}`
        );
      }
    }
  }

  console.log(
    `[admin] Cerere GDPR de ștergere procesată de ${req.user.email} — CUI: ${cui || "—"}, e-mail: ${email || "—"}, cont găsit și șters: ${accountDeleted || "nu"}.`
  );

  res.json({ ok: true, historyResult, accountDeleted });
});

// Verificare rapidă: sunt completate datele firmei (COMPANY_*) în .env/Railway?
// Fără ele, paginile publice /legal/termeni și /legal/confidentialitate arată
// text placeholder vizibil ("[completează: ...]") — practic nu identifică
// operatorul, ceea ce le face inutile juridic dacă publici aplicația așa.
router.get("/legal-status", (req, res) => {
  res.json({ missing: missingCompanyFields() });
});

// Statistici sumare pentru panoul de administrare.
router.get("/stats", async (req, res) => {
  const [total, active, admins, teamMembers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { subscriptionStatus: "active" } }),
    prisma.user.count({ where: { isAdmin: true } }),
    prisma.user.count({ where: { teamOwnerId: { not: null } } }),
  ]);
  res.json({ total, active, admins, teamMembers });
});

// Ultima noutate din changelog — folosită pentru butonul "Trimite email de
// noutăți" din panoul de admin, ca să știi ce se trimite înainte de a apăsa.
router.get("/changelog-latest", (req, res) => {
  const latest = [...CHANGELOG].sort((a, b) => b.version - a.version)[0] || null;
  res.json({ latest, currentVersion: CURRENT_VERSION });
});

// Trimite ultima noutate din changelog, pe e-mail, tuturor utilizatorilor
// (cont principal sau membru de echipă — fiecare are propriul e-mail),
// exceptând contul de admin. Declanșat manual, cu un singur clic, DUPĂ ce
// confirmi tu că actualizarea e live și funcționează — nu se trimite automat
// la fiecare deploy.
router.post("/send-changelog-email", async (req, res) => {
  const latest = [...CHANGELOG].sort((a, b) => b.version - a.version)[0];
  if (!latest) return res.status(400).json({ error: "no_changelog_entry" });

  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    select: { email: true },
  });

  const html = `
    <h2 style="font-family:sans-serif">${latest.title} — Herbatium</h2>
    <p style="font-family:sans-serif;font-size:15px;line-height:1.6">${latest.message}</p>
    <p style="font-family:sans-serif;color:#888;font-size:12px">Poți revedea oricând noutățile din aplicație, din butonul „Noutăți”.</p>
  `;

  let sent = 0;
  for (const u of users) {
    const r = await sendEmail(u.email, `Noutăți Herbatium: ${latest.title}`, html);
    if (r.ok) sent++;
  }

  res.json({ ok: true, sent, total: users.length, version: latest.version });
});

// Listă de feedback trimis de utilizatori — cel mai recent primul.
router.get("/feedback", async (req, res) => {
  const items = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  res.json({ items });
});

// Schimbă starea unui mesaj de feedback (nou / citit / rezolvat), ca să poți
// ține evidența pe ce ai lucrat deja.
router.patch("/feedback/:id", async (req, res) => {
  const status = String((req.body || {}).status || "");
  if (!["nou", "citit", "rezolvat"].includes(status)) {
    return res.status(400).json({ error: "status_invalid" });
  }
  try {
    const item = await prisma.feedback.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ ok: true, item });
  } catch (e) {
    res.status(404).json({ error: "not_found" });
  }
});

module.exports = router;
