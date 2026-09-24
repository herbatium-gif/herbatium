const express = require("express");
const prisma = require("../db");

const router = express.Router();

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Modele vizuale pentru pagina publică de catalog. Fiecare utilizator alege unul
// din tab-ul "Pagina publică" — id-ul e salvat pe User.catalogTemplate.
// IMPORTANT: id-urile și swatch-urile de aici trebuie să rămână sincronizate cu
// lista din formulator-saas/public/app.html (selectorul de model).
const TEMPLATES = {
  natural: {
    label: "Cald Natural",
    googleFonts: "family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Work+Sans:wght@400;500;600",
    headingFont: "'Fraunces',Georgia,serif",
    bodyFont: "'Work Sans',system-ui,sans-serif",
    bg: "#faf6f0", surface: "#ffffff", surface2: "#f4ece0",
    ink: "#2b2420", inkSoft: "#6f6459", line: "#e7dcc9",
    accent: "#c1583a", accentInk: "#fff8f2", radius: "10px", uppercaseH: false,
  },
  elegant: {
    label: "Minimalist Alb-Negru",
    googleFonts: "family=Playfair+Display:wght@500;700&family=Inter:wght@400;500",
    headingFont: "'Playfair Display',Georgia,serif",
    bodyFont: "'Inter',system-ui,sans-serif",
    bg: "#ffffff", surface: "#ffffff", surface2: "#f4f4f4",
    ink: "#141414", inkSoft: "#666666", line: "#e4e4e4",
    accent: "#141414", accentInk: "#ffffff", radius: "2px", uppercaseH: true,
  },
  botanic: {
    label: "Botanic Verde Închis",
    googleFonts: "family=Cormorant+Garamond:wght@500;600&family=Work+Sans:wght@400;500",
    headingFont: "'Cormorant Garamond',Georgia,serif",
    bodyFont: "'Work Sans',system-ui,sans-serif",
    bg: "#16241c", surface: "#1d2f24", surface2: "#24392c",
    ink: "#eef2ea", inkSoft: "#a9bcae", line: "#33493c",
    accent: "#c9a15a", accentInk: "#16241c", radius: "6px", uppercaseH: false,
  },
  pastel: {
    label: "Pastel Modern",
    googleFonts: "family=Quicksand:wght@500;600&family=Nunito+Sans:wght@400;600",
    headingFont: "'Quicksand',system-ui,sans-serif",
    bodyFont: "'Nunito Sans',system-ui,sans-serif",
    bg: "#fdf3f7", surface: "#ffffff", surface2: "#f6e7ee",
    ink: "#3a2a35", inkSoft: "#8a7186", line: "#f0d9e4",
    accent: "#d97ba3", accentInk: "#ffffff", radius: "18px", uppercaseH: false,
  },
};
const DEFAULT_TEMPLATE = "natural";

function pageShell(title, body, templateId) {
  const t = TEMPLATES[templateId] || TEMPLATES[DEFAULT_TEMPLATE];
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${t.googleFonts}&display=swap">
<style>
:root{
  --bg:${t.bg};--surface:${t.surface};--surface-2:${t.surface2};
  --ink:${t.ink};--ink-soft:${t.inkSoft};--line:${t.line};
  --accent:${t.accent};--accent-ink:${t.accentInk};--radius:${t.radius};
}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:${t.bodyFont};margin:0;padding:0 16px 60px}
h1,h2{font-family:${t.headingFont};font-weight:600;${t.uppercaseH ? "text-transform:uppercase;letter-spacing:.06em;" : ""}}
.wrap{max-width:900px;margin:0 auto}
.top{padding:24px 0 8px}
.top a{color:var(--ink-soft);font-size:13px;text-decoration:none}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.photo{aspect-ratio:1/1;background:var(--surface-2);border-radius:calc(var(--radius) - 2px);overflow:hidden;margin-bottom:8px}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.name{font-weight:500}
.price{font-family:ui-monospace,monospace;color:var(--accent)}
.hint{color:var(--ink-soft);font-size:12.5px}
.links a{display:inline-block;margin:4px 8px 4px 0;padding:6px 14px;border:1px solid var(--accent);border-radius:99px;color:var(--accent);text-decoration:none;font-size:13px;font-weight:500}
.links a:hover{background:var(--accent);color:var(--accent-ink)}
.footer{text-align:center;padding:30px 0;color:var(--ink-soft);font-size:12px}
.footer a{color:var(--accent)}
</style>
</head>
<body>
<div class="wrap">
${body}
<div class="footer">Pagină generată cu <a href="/">Herbatium</a> — unealta pentru producători mici de cosmetice naturale.</div>
</div>
</body>
</html>`;
}

// Randează corpul paginii unui producător — folosit atât pentru pagina publică
// reală (cu date din baza de date), cât și pentru previzualizarea din tab-ul
// "Pagina publică" (cu date nesalvate încă din formular).
function renderProducerBody(profile, products, opts) {
  const backLink = (opts && opts.noBackLink) ? "" : `<div class="top"><a href="/catalog">← Toți producătorii</a></div>`;
  const links = [
    profile.instagramUrl && `<a href="${esc(profile.instagramUrl)}" target="_blank" rel="noopener">Instagram</a>`,
    profile.bresloUrl && `<a href="${esc(profile.bresloUrl)}" target="_blank" rel="noopener">Magazin Breslo</a>`,
    profile.etsyUrl && `<a href="${esc(profile.etsyUrl)}" target="_blank" rel="noopener">Magazin Etsy</a>`,
    profile.websiteUrl && `<a href="${esc(profile.websiteUrl)}" target="_blank" rel="noopener">Site propriu</a>`,
    profile.facebookUrl && `<a href="${esc(profile.facebookUrl)}" target="_blank" rel="noopener">Facebook</a>`,
  ].filter(Boolean).join("");

  return `
    ${backLink}
    <div class="card">
      <h1>${esc(profile.businessName || "Producător")}</h1>
      ${profile.bio ? `<p>${esc(profile.bio)}</p>` : ""}
      ${links ? `<div class="links">${links}</div>` : `<p class="hint">Niciun link de contact adăugat încă.</p>`}
    </div>
    <div class="card">
      <h2 style="font-size:16px;margin-bottom:10px">Produse (${products.length})</h2>
      ${products.length === 0 ? `<p class="hint">Niciun produs afișat public momentan.</p>` : `
      <div class="grid">
        ${products.map((p) => `
          <div>
            <div class="photo">${p.photos && p.photos[0] ? `<img src="${esc(p.photos[0].url)}" alt="${esc(p.name)}">` : ""}</div>
            <div class="name">${esc(p.name || "(fără nume)")}</div>
            ${p.price ? `<div class="price">${esc(Number(p.price).toFixed(2))} lei</div>` : ""}
          </div>`).join("")}
      </div>`}
      <p class="hint" style="margin-top:14px">Pentru comandă, folosește unul dintre linkurile de mai sus — această pagină nu procesează plăți sau comenzi direct.</p>
    </div>
  `;
}

// Pagina publică de catalog a unui producător
router.get("/:slug", async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { slug: req.params.slug, publicPageEnabled: true },
    });
    if (!user) return res.status(404).send(pageShell("Pagină negăsită", `<div class="top"><a href="/catalog">← Toți producătorii</a></div><div class="card">Această pagină nu există sau nu mai e activă.</div>`, DEFAULT_TEMPLATE));

    const data = await prisma.userData.findUnique({ where: { userId: user.id } });
    const products = ((data && data.products) || []).filter((p) => p && p.publicVisible);
    const body = renderProducerBody(user, products);
    res.send(pageShell(user.businessName || "Catalog produse", body, user.catalogTemplate));
  } catch (e) {
    res.status(500).send(pageShell("Eroare", `<div class="card">Ceva nu a mers bine la încărcarea acestei pagini.</div>`, DEFAULT_TEMPLATE));
  }
});

// Director public cu toți producătorii care au activat pagina
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { publicPageEnabled: true, slug: { not: null } },
      orderBy: { businessName: "asc" },
      select: { slug: true, businessName: true, bio: true },
    });
    const body = `
      <div class="top"></div>
      <div class="card">
        <h1>Producători de cosmetice naturale</h1>
        <p class="hint">Catalog de producători care își prezintă produsele folosind Herbatium. Fiecare pagină duce mai departe la canalul de vânzare al producătorului (Instagram, Breslo, Etsy, site propriu).</p>
      </div>
      ${users.length === 0 ? `<div class="card hint">Niciun producător public momentan.</div>` : users.map((u) => `
        <div class="card">
          <h2 style="font-size:16px;margin-bottom:4px"><a href="/catalog/${esc(u.slug)}" style="color:inherit;text-decoration:none">${esc(u.businessName || u.slug)}</a></h2>
          ${u.bio ? `<p class="hint">${esc(u.bio)}</p>` : ""}
          <a href="/catalog/${esc(u.slug)}" style="font-size:13px;color:var(--accent)">Vezi catalogul →</a>
        </div>`).join("")}
    `;
    res.send(pageShell("Producători — Herbatium", body, DEFAULT_TEMPLATE));
  } catch (e) {
    res.status(500).send(pageShell("Eroare", `<div class="card">Ceva nu a mers bine la încărcarea listei.</div>`, DEFAULT_TEMPLATE));
  }
});

module.exports = router;
module.exports.TEMPLATES = TEMPLATES;
module.exports.DEFAULT_TEMPLATE = DEFAULT_TEMPLATE;
module.exports.pageShell = pageShell;
module.exports.renderProducerBody = renderProducerBody;
