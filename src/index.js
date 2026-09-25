require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");

const authRoutes = require("./routes/auth");
const dataRoutes = require("./routes/data");
const photoRoutes = require("./routes/photos");
const profileRoutes = require("./routes/profile");
const catalogRoutes = require("./routes/catalog");
const legalRoutes = require("./routes/legal");
const accountRoutes = require("./routes/account");
const adminRoutes = require("./routes/admin");
const changelogRoutes = require("./routes/changelog");
const feedbackRoutes = require("./routes/feedback");
const { router: billingRoutes, webhookHandler } = require("./routes/billing");
const { scheduleDailyDigest } = require("./notify");
const { scheduleRetentionCleanup } = require("./retention");

const app = express();

// Aplicația rulează de obicei în spatele unui reverse proxy (Nginx/Caddy sau
// platforma de hosting) când e publicată online — necesar ca Express să
// recunoască corect conexiunile HTTPS (cookie-ul de autentificare "secure").
app.set("trust proxy", 1);

// Headere de securitate de bază (X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy etc.). CSP e dezactivat explicit: app.html/login.html/etc.
// folosesc <script>/<style> inline masiv (SPA cu HTML generat dinamic) — un
// CSP implicit ar bloca aplicația să ruleze. Dacă se rescrie front-end-ul
// fără inline scripts, CSP poate fi reactivat aici.
app.use(helmet({ contentSecurityPolicy: false }));

// Webhook-ul Stripe are nevoie de body-ul brut (nesparsat) ca să verifice
// semnătura — de-asta ruta asta trebuie declarată ÎNAINTE de express.json().
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), webhookHandler);

app.use(express.json({ limit: "1mb" })); // limită explicită — datele salvate (rețete/loturi/stoc) sunt un singur JSON
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", authRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/account", accountRoutes); // GDPR — export date (art. 15/20) + ștergere cont (art. 17)
app.use("/api/admin", adminRoutes); // panou de administrator platformă — doar contul isAdmin
app.use("/api/changelog", changelogRoutes); // noutăți aplicație, afișate în tab-ul "Noutăți"
app.use("/api/feedback", feedbackRoutes); // feedback trimis din aplicație, de la utilizatori
app.use("/catalog", catalogRoutes); // public, fără autentificare — pagina de catalog + director
app.use("/legal", legalRoutes); // public — Termeni, Confidențialitate, Cookie-uri, DPA

app.get("/healthz", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) => res.redirect("/login.html"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Herbatium (SaaS) rulează pe http://localhost:${PORT}`);
  scheduleDailyDigest(8); // digest zilnic la ora 8:00 (ora serverului) — nu face nimic dacă RESEND_API_KEY nu e setat
  scheduleRetentionCleanup(4); // curățare zilnică la ora 4:00 — șterge conturile anulate de peste 30 de zile
});
