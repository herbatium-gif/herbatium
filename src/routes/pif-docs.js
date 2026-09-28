const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { requireAuth, requireActiveSubscription, effectiveDataOwnerId } = require("../auth");

// Documente atașate unui dosar PIF (Product Information File) — de regulă
// rapoarte de siguranță semnate de un evaluator calificat, certificate GMP,
// dovezi pentru pretenții de etichetă etc. Stocare separată de pozele de
// produs (subfolder propriu), dar cu EXACT aceleași reguli de securitate ca
// la photos.js: doar tipuri de fișier care nu pot conține cod executabil
// (PDF, imagini raster) — NU .docx/.doc (pot conține macro-uri), NU SVG
// (poate conține <script>, vezi comentariul din photos.js). Un document PIF
// legitim (raport semnat, poză a unui certificat) e mereu reprezentabil ca
// PDF sau fotografie/scan — restricția nu limitează nicio nevoie reală.
const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

// Extensia fișierului stocat vine DOAR din mimetype-ul validat de fileFilter
// mai jos, NICIODATĂ din numele original trimis de client — acela e complet
// controlat de atacator. Dacă am fi folosit path.extname(file.originalname)
// (cum era înainte), cineva putea trimite un fișier cu Content-Type:
// image/png dar numit "ceva.svg": fileFilter l-ar fi acceptat (mimetype
// valid), dar fișierul salvat s-ar fi numit "*.svg" — iar express.static
// (vezi src/index.js, /uploads) servește fișierele cu Content-Type dedus din
// EXTENSIE, nu din mimetype-ul declarat la upload — deci un SVG cu <script>
// ar fi fost servit ca image/svg+xml și executat la deschidere directă în
// browser. Exact XSS-ul stocat pe care restricția SVG de mai jos spune că-l
// blochează — maparea explicită închide portița.
const MIME_TO_EXT = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, effectiveDataOwnerId(req.user), "pif-docs");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || ".pdf";
    cb(null, crypto.randomUUID() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — rapoarte PDF pot fi mai mari decât o poză
  fileFilter: (req, file, cb) => {
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.mimetype)) {
      return cb(new Error("tip_fisier_neacceptat"));
    }
    cb(null, true);
  },
});

router.post(
  "/",
  requireAuth,
  requireActiveSubscription,
  upload.single("document"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no_file" });
    const id = req.file.filename;
    res.json({
      id,
      url: `/uploads/${effectiveDataOwnerId(req.user)}/pif-docs/${id}`,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
    });
  }
);

// Multer respinge fileFilter cu un eșec generic (500) dacă nu-l prindem noi
// — dăm un răspuns JSON clar (400), consistent cu restul API-ului, în loc
// să lăsăm pagina de eroare implicită a Express (aceeași observație de
// îmbunătățire minoră notată deja la /api/photos, aplicată de această dată
// direct la implementare, nu doar semnalată).
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message || "eroare_incarcare" });
  next();
});

router.delete("/:filename", requireAuth, requireActiveSubscription, (req, res) => {
  const filename = path.basename(req.params.filename); // previne path traversal
  const filePath = path.join(UPLOAD_ROOT, effectiveDataOwnerId(req.user), "pif-docs", filename);
  fs.unlink(filePath, (err) => {
    res.json({ ok: true }); // idempotent, la fel ca /api/photos
  });
});

module.exports = router;
