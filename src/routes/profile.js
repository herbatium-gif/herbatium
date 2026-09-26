const express = require("express");
const prisma = require("../db");
const { requireAuth, requireActiveSubscription, effectiveDataOwnerId } = require("../auth");
const { pageShell, renderProducerBody } = require("./catalog");

const router = express.Router();

// Acceptă doar linkuri http/https reale — altfel un cont ar putea salva
// "javascript:..." ca "link Instagram" (sau orice alt câmp), care ar rula
// la click, pe propria lui pagină publică (catalog.js îl pune direct în
// href="..."). Orice altă schemă (javascript:, data:, vbscript: etc.) sau
// text care nu e un URL valid e respins ca link — câmpul rămâne gol, nu
// blocăm restul salvării.
function safePublicUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch (e) {
    return null;
  }
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // scoate diacriticele
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

router.get("/", requireAuth, requireActiveSubscription, async (req, res) => {
  // Pagina publică aparține mereu contului principal — un membru de echipă o
  // vede (citire), dar n-o poate edita (vezi verificarea din PUT de mai jos).
  const ownerId = effectiveDataOwnerId(req.user);
  const u = ownerId === req.user.id ? req.user : await prisma.user.findUnique({ where: { id: ownerId } });
  if (!u) return res.status(404).json({ error: "owner_not_found" });
  res.json({
    publicPageEnabled: u.publicPageEnabled,
    slug: u.slug || "",
    businessName: u.businessName || "",
    bio: u.bio || "",
    instagramUrl: u.instagramUrl || "",
    bresloUrl: u.bresloUrl || "",
    etsyUrl: u.etsyUrl || "",
    websiteUrl: u.websiteUrl || "",
    facebookUrl: u.facebookUrl || "",
    catalogTemplate: u.catalogTemplate || "natural",
    readOnly: ownerId !== req.user.id,
  });
});

router.put("/", requireAuth, requireActiveSubscription, async (req, res) => {
  if (req.user.teamOwnerId) {
    return res.status(403).json({ error: "owner_only", message: "Doar contul principal poate edita pagina publică." });
  }
  const {
    publicPageEnabled,
    businessName,
    bio,
    instagramUrl,
    bresloUrl,
    etsyUrl,
    websiteUrl,
    facebookUrl,
    catalogTemplate,
  } = req.body || {};

  const ALLOWED_TEMPLATES = ["natural", "elegant", "botanic", "pastel"];
  const safeTemplate = ALLOWED_TEMPLATES.includes(catalogTemplate) ? catalogTemplate : "natural";

  let slug = req.user.slug;
  if (publicPageEnabled && !slug) {
    const base = slugify(businessName) || "producator";
    let candidate = base;
    let n = 1;
    // găsește primul slug liber
    while (await prisma.user.findFirst({ where: { slug: candidate, id: { not: req.user.id } } })) {
      n++;
      candidate = `${base}-${n}`;
    }
    slug = candidate;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        publicPageEnabled: !!publicPageEnabled,
        slug: publicPageEnabled ? slug : req.user.slug, // păstrăm slug-ul chiar dacă e dezactivată temporar
        businessName: businessName || null,
        bio: bio || null,
        instagramUrl: safePublicUrl(instagramUrl),
        bresloUrl: safePublicUrl(bresloUrl),
        etsyUrl: safePublicUrl(etsyUrl),
        websiteUrl: safePublicUrl(websiteUrl),
        facebookUrl: safePublicUrl(facebookUrl),
        catalogTemplate: safeTemplate,
      },
    });
    res.json({ ok: true, slug: updated.slug });
  } catch (e) {
    res.status(400).json({ error: "update_failed" });
  }
});

// Previzualizare live — randează pagina publică cu datele din formular (nesalvate
// încă) + produsele reale bifate "vizibil public" din contul utilizatorului.
router.post("/preview", requireAuth, requireActiveSubscription, async (req, res) => {
  try {
    const draft = { ...(req.body || {}) };
    // Aceeași filtrare de protocol ca la salvarea reală (mai sus) — altfel
    // previzualizarea ar rula un eventual "javascript:..." direct în pagina
    // curentă a utilizatorului, chiar înainte de a apăsa "Salvează".
    draft.instagramUrl = safePublicUrl(draft.instagramUrl);
    draft.bresloUrl = safePublicUrl(draft.bresloUrl);
    draft.etsyUrl = safePublicUrl(draft.etsyUrl);
    draft.websiteUrl = safePublicUrl(draft.websiteUrl);
    draft.facebookUrl = safePublicUrl(draft.facebookUrl);
    const data = await prisma.userData.findUnique({ where: { userId: effectiveDataOwnerId(req.user) } });
    const products = ((data && data.products) || []).filter((p) => p && p.publicVisible);
    const body = renderProducerBody(draft, products, { noBackLink: true });
    const html = pageShell(draft.businessName || "Previzualizare", body, draft.catalogTemplate);
    res.json({ html });
  } catch (e) {
    res.status(500).json({ error: "preview_failed" });
  }
});

module.exports = router;
