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
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, effectiveDataOwnerId(req.user));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB per poză
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("not_an_image"));
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
