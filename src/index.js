require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");

const authRoutes = require("./routes/auth");
const dataRoutes = require("./routes/data");
const photoRoutes = require("./routes/photos");
const pifDocsRoutes = require("./routes/pif-docs"); // documente atașate la dosarul PIF
const packagingDocsRoutes = require("./routes/packaging-docs"); // documente atașate la dosarul de ambalaj (PPWR)
const profileRoutes = require("./routes/profile");
const catalogRoutes = require("./routes/catalog");
const legalRoutes = require("./routes/legal");
const accountRoutes = require("./routes/account");
const adminRoutes = require("./routes/admin");
const changelogRoutes = require("./routes/changelog");
const feedbackRoutes = require("./routes/feedback");
const twofactorRoutes = require("./routes/twofactor"); // 2FA — doar contul de admin
const { router: billingRoutes, webhookHandler } = require("./routes/billing");
const { scheduleDailyDigest } = require("./notify");
const { scheduleRetentionCleanup } = require("./retention");

const app = express();

// Aplicația rulează de obicei în spatele unui reverse proxy (Nginx/Caddy sau
// platforma de hosting) când e publicată online — necesar ca Express să
// recunoască corect conexiunile HTTPS (cookie-ul de autentificare "secure").
app.set("trust proxy", 1);

// Headere de securitate (X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy etc.) + Content-Security-Policy.
//
// app.html/login.html/admin.html/etc. folosesc <script>/<style> inline masiv
// (SPA cu HTML generat dinamic), deci script-src/style-src trebuie să
// permită 'unsafe-inline' — un CSP standard (fără 'unsafe-inline') ar bloca
// aplicația să ruleze. Asta înseamnă că acest CSP NU blochează o eventuală
// injecție de <script> inline (XSS) dacă una ar exista undeva — pentru asta
// ar fi nevoie de o rescriere a front-end-ului fără inline scripts (folosind
// nonce-uri sau fișiere .js separate), care e un proiect separat.
//
// Ce CHIAR blochează, verificat pe codul din acest repo (toate paginile din
// /public sunt 100% same-origin — niciun <script src="http...">/<link
// href="http...">, fonturile sunt auto-găzduite, niciun fetch()/XHR către alt
// domeniu):
//  - încărcarea de resurse (script/stil/font/imagine) de pe orice alt
//    domeniu decât herbatium.ro, chiar dacă un atacator ar reuși să
//    injecteze un tag care le cere;
//  - trimiterea de date către alt domeniu (connect-src 'self') — limitează
//    exfiltrarea de date printr-un eventual fetch()/XHR injectat;
//  - object-src 'none' — blochează <object>/<embed> (Flash și alte
//    plugin-uri vechi, vector clasic de atac);
//  - frame-ancestors 'none' — pagina nu poate fi pusă într-un <iframe> pe alt
//    site (protecție clickjacking pe login/admin);
//  - base-uri 'self' — blochează un <base href="..."> injectat, care ar
//    putea redirecționa toate linkurile/resursele relative către alt domeniu.
// img-src permite și "data:" — codul QR de 2FA (routes/twofactor.js) e
// afișat ca <img src="data:image/png;base64,...">, generat de server.
//
// scriptSrcAttr: 'unsafe-inline' — app.html generează zeci de câmpuri de
// input cu atributul onfocus="this.select()" (selectează tot textul la
// focus, ca să poți retasta direct o valoare fără s-o ștergi manual întâi).
// Helmet dezactivează implicit acest tip de atribut (script-src-attr 'none')
// separat de scriptSrc de mai jos — fără linia asta, TOATE aceste câmpuri
// s-ar fi rupt silențios la activarea CSP. Verificat direct în cod (grep pe
// toate paginile din /public), nu presupus.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

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
app.use("/api/pif-docs", pifDocsRoutes);
app.use("/api/packaging-docs", packagingDocsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/account", accountRoutes); // GDPR — export date (art. 15/20) + ștergere cont (art. 17)
app.use("/api/admin", adminRoutes); // panou de administrator platformă — doar contul isAdmin
app.use("/api/changelog", changelogRoutes); // noutăți aplicație, afișate în tab-ul "Noutăți"
app.use("/api/feedback", feedbackRoutes); // feedback trimis din aplicație, de la utilizatori
app.use("/api/2fa", twofactorRoutes); // autentificare în doi factori — doar contul de admin
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
