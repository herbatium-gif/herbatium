const express = require("express");
const prisma = require("../db");
const { requireAuth } = require("../auth");
const { CHANGELOG, CURRENT_VERSION } = require("../changelog");

const router = express.Router();

// Returnează lista de noutăți + versiunea curentă. Cerut de app.html la
// fiecare încărcare, ca să decidă dacă arată badge-ul "Noutăți".
router.get("/", requireAuth, (req, res) => {
  res.json({
    currentVersion: CURRENT_VERSION,
    lastSeenVersion: req.user.lastSeenChangelogVersion || 0,
    entries: [...CHANGELOG].sort((a, b) => b.version - a.version), // cele mai noi primele
  });
});

// Utilizatorul a deschis panoul de noutăți — nu-i mai arătăm badge-ul până
// la următoarea actualizare.
router.post("/seen", requireAuth, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { lastSeenChangelogVersion: CURRENT_VERSION },
  });
  res.json({ ok: true });
});

module.exports = router;
