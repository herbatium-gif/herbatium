const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { requireAuth, requireActiveSubscription, effectiveDataOwnerId } = require("../auth");

// Documente atașate unui dosar de ambalaj (Reg. (UE) 2025/40 — PPWR) — de
// regulă declarația de conformitate emisă de furnizorul de ambalaj, sau un
// raport de testare pentru restricțiile de substanțe. Stocare separată de
// pozele de produs și de documentele PIF (subfolder propriu), dar cu EXACT
// aceleași reguli de securitate ca la pif-docs.js/photos.js: doar tipuri de
// fișier care nu pot conține cod executabil (PDF, imagini raster) — NU
// .docx/.doc (pot conține macro-uri), NU SVG (poate conține <script>, vezi
// comentariul din photos.js). O declarație de conformitate legitimă e mereu
// reprezentabilă ca PDF sau fotografie/scan — restricția nu limitează nicio
// nevoie reală.
const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

// Extensia fișierului stocat vine DOAR din mimetype-ul validat de fileFilter
// mai jos, NICIODATĂ din numele original trimis de client — vezi comentariul
// identic din pif-docs.js/photos.js: altfel un fișier cu Content-Type
// image/png dar numit "ceva.svg" ar fi trecut de filtru și ar fi fost salvat
// (și servit de express.static, după extensie) ca *.svg — XSS stocat.
const MIME_TO_EXT = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, effectiveDataOwnerId(req.user), "packaging-docs");
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
      url: `/uploads/${effectiveDataOwnerId(req.user)}/packaging-docs/${id}`,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
    });
  }
);

// Multer respinge fileFilter cu un eșec generic (500) dacă nu-l prindem noi
// — dăm un răspuns JSON clar (400), consistent cu restul API-ului (aceeași
// observație aplicată deja la /api/photos și /api/pif-docs).
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message || "eroare_incarcare" });
  next();
});

router.delete("/:filename", requireAuth, requireActiveSubscription, (req, res) => {
  const filename = path.basename(req.params.filename); // previne path traversal
  const filePath = path.join(UPLOAD_ROOT, effectiveDataOwnerId(req.user), "packaging-docs", filename);
  fs.unlink(filePath, (err) => {
    res.json({ ok: true }); // idempotent, la fel ca /api/photos și /api/pif-docs
  });
});

module.exports = router;
