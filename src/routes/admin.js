// Panou de administrator platformă — accesibil DOAR contului cu isAdmin: true
// (creat automat din ADMIN_EMAIL/ADMIN_PASSWORD, vezi src/seedAdmin.js).
// Nu are legătură cu datele clienților (rețete, loturi etc.) — arată doar
// informații despre conturi, utile pentru administrarea aplicației.
const express = require("express");
const prisma = require("../db");
const { requireAuth, requireAdmin } = require("../auth");
const { sendEmail } = require("../notify");
const { CHANGELOG, CURRENT_VERSION } = require("../changelog");

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
    },
  });
  res.json({ users });
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
