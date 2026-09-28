const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { requireAuth, requireActiveSubscription, effectiveDataOwnerId } = require("../auth");

const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

// Notă: pentru un volum mare de utilizatori, mută stocarea pe un serviciu
// dedicat (S3, Cloudflare R2, Cloudinary) — pentru pornire, discul serverului
// e suficient și simplu de întreținut.
// Pozele se salvează în folderul contului principal (owner), ca membrii de
// echipă să vadă/gestioneze aceleași poze, nu unele separate.
// Extensia fișierului stocat se decide DOAR din mimetype-ul validat mai jos,
// NICIODATĂ din numele original trimis de client (file.originalname) — acela
// e complet controlat de atacator și nu are nicio legătură garantată cu
// conținutul/mimetype-ul real verificat de fileFilter. Dacă am fi luat
// extensia din originalname (cum se făcea înainte), cineva putea trimite un
// fișier cu Content-Type: image/png dar numit "evil.svg": fileFilter l-ar fi
// acceptat (mimetype valid), dar fișierul salvat s-ar fi numit "*.svg" — iar
// express.static (vezi src/index.js, /uploads) servește fișierele cu
// Content-Type dedus din EXTENSIE, nu din mimetype-ul original — deci un SVG
// cu <script> ar fi fost servit ca image/svg+xml și executat la deschidere
// directă în browser (exact XSS-ul stocat pe care comentariul de mai jos
// spune că-l blocăm). Maparea explicită de mai jos închide această portiță.
const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, effectiveDataOwnerId(req.user));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || ".jpg";
    cb(null, crypto.randomUUID() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB per poză
  // Doar formate raster (fotografii reale) — NU si "image/svg+xml". Un SVG
  // poate contine <script>/onload="..." care ruleaza daca fisierul e deschis
  // direct in browser (nu ca <img>, ci navigat direct la link) — un vizitator
  // care deschide acel link ar rula cod arbitrar in contextul herbatium.ro
  // (XSS stocat). Pozele de produs sunt fotografii, nu au nevoie de format
  // vectorial, deci excluderea SVG nu limiteaza nicio functionalitate reala.
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(new Error("not_an_image"));
    cb(null, true);
  },
});

router.post(
  "/",
  requireAuth,
  requireActiveSubscription,
  upload.single("photo"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no_file" });
    const id = req.file.filename;
    res.json({ id, url: `/uploads/${effectiveDataOwnerId(req.user)}/${id}` });
  }
);

router.delete("/:filename", requireAuth, requireActiveSubscription, (req, res) => {
  const filename = path.basename(req.params.filename); // previne path traversal
  const filePath = path.join(UPLOAD_ROOT, effectiveDataOwnerId(req.user), filename);
  fs.unlink(filePath, (err) => {
    // idempotent: și dacă fișierul nu există, răspundem ok
    res.json({ ok: true });
  });
});

module.exports = router;
