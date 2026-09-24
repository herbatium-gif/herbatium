// Panou de administrator platformă — accesibil DOAR contului cu isAdmin: true
// (creat automat din ADMIN_EMAIL/ADMIN_PASSWORD, vezi src/seedAdmin.js).
// Nu are legătură cu datele clienților (rețete, loturi etc.) — arată doar
// informații despre conturi, utile pentru administrarea aplicației.
const express = require("express");
const prisma = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

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

module.exports = router;
