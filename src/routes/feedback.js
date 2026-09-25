// Feedback trimis din aplicație (buton "Feedback" din topbar) — mesaje
// scurte de la utilizatori (bug, idee, altceva), folosite intern ca să
// dezvoltăm aplicația pe baza a ceea ce contează pentru ei.
const express = require("express");
const prisma = require("../db");
const { requireAuth } = require("../auth");
const { sendEmail } = require("../notify");

const router = express.Router();

const CATEGORIES = ["bug", "idee", "altceva"];
const MAX_LEN = 2000;

router.post("/", requireAuth, async (req, res) => {
  const body = req.body || {};
  const message = String(body.message || "").trim();
  const category = CATEGORIES.includes(body.category) ? body.category : "altceva";
  const page = String(body.page || "").slice(0, 60);

  if (!message) return res.status(400).json({ error: "message_required" });
  if (message.length > MAX_LEN) return res.status(400).json({ error: "message_too_long" });

  const fb = await prisma.feedback.create({
    data: { userId: req.user.id, email: req.user.email, category, message, page },
  });

  // Notificare pentru administrator — best-effort, nu blochează răspunsul
  // către utilizator dacă emailul nu e configurat sau eșuează.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const safeMessage = message.replace(/</g, "&lt;").replace(/\n/g, "<br>");
    sendEmail(
      adminEmail,
      `Feedback nou (${category}) — Herbatium`,
      `<p style="font-family:sans-serif">De la: ${req.user.email}</p>
       <p style="font-family:sans-serif">Pagină: ${page || "—"}</p>
       <p style="font-family:sans-serif;border-left:3px solid #1f9d5a;padding-left:12px">${safeMessage}</p>`
    ).catch(() => {});
  }

  res.json({ ok: true, id: fb.id });
});

module.exports = router;
