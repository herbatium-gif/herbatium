require("dotenv").config();
const express = require("express");
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
const { router: billingRoutes, webhookHandler } = require("./routes/billing");
const { scheduleDailyDigest } = require("./notify");

const app = express();

// Aplicația rulează de obicei în spatele unui reverse proxy (Nginx/Caddy sau
// platforma de hosting) când e publicată online — necesar ca Express să
// recunoască corect conexiunile HTTPS (cookie-ul de autentificare "secure").
app.set("trust proxy", 1);

// Webhook-ul Stripe are nevoie de body-ul brut (nesparsat) ca să verifice
// semnătura — de-asta ruta asta trebuie declarată ÎNAINTE de express.json().
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), webhookHandler);

app.use(express.json());
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
app.use("/catalog", catalogRoutes); // public, fără autentificare — pagina de catalog + director
app.use("/legal", legalRoutes); // public — Termeni, Confidențialitate, Cookie-uri, DPA

app.get("/healthz", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) => res.redirect("/login.html"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Herbatium (SaaS) rulează pe http://localhost:${PORT}`);
  scheduleDailyDigest(8); // digest zilnic la ora 8:00 (ora serverului) — nu face nimic dacă RESEND_API_KEY nu e setat
});
