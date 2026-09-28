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

// Traducere RO/EN pentru paginile publice de catalog (server-side — randate
// direct ca HTML, fără JS client). Limba se ține într-un cookie
// ("herbatium_catalog_lang"), setat când vizitatorul apasă butonul RO/EN
// (?lang=ro sau ?lang=en) sau citit din cookie la vizitele următoare;
// implicit "ro". Complet independentă de i18n.js (aplicația SPA) — acolo
// limba se ține în localStorage, aici (pagini server-side, fără cont) într-un
// cookie simplu, nelegat de un utilizator autentificat.
const CATALOG_LANG_COOKIE = "herbatium_catalog_lang";
const STRINGS = {
  ro: {
    pageNotFoundTitle: "Pagină negăsită",
    pageNotFoundBody: "Această pagină nu există sau nu mai e activă.",
    errorTitle: "Eroare",
    errorLoadPage: "Ceva nu a mers bine la încărcarea acestei pagini.",
    errorLoadList: "Ceva nu a mers bine la încărcarea listei.",
    allProducers: "← Toți producătorii",
    defaultProducerName: "Producător",
    noContactLinks: "Niciun link de contact adăugat încă.",
    productsN: "Produse ({n})",
    noPublicProducts: "Niciun produs afișat public momentan.",
    noName: "(fără nume)",
    orderHint: "Pentru comandă, folosește unul dintre linkurile de mai sus — această pagină nu procesează plăți sau comenzi direct.",
    defaultCatalogTitle: "Catalog produse",
    directoryTitle: "Producători de cosmetice naturale",
    directoryDesc: "Catalog de producători care își prezintă produsele folosind Herbatium. Fiecare pagină duce mai departe la canalul de vânzare al producătorului (Instagram, Breslo, Etsy, site propriu).",
    noPublicProducers: "Niciun producător public momentan.",
    viewCatalog: "Vezi catalogul →",
    directoryPageTitle: "Producători — Herbatium",
    footer: 'Pagină generată cu <a href="/">Herbatium</a> — unealta pentru producători mici de cosmetice naturale.',
    instagram: "Instagram",
    bresloShop: "Magazin Breslo",
    etsyShop: "Magazin Etsy",
    ownWebsite: "Site propriu",
    facebook: "Facebook",
  },
  en: {
    pageNotFoundTitle: "Page not found",
    pageNotFoundBody: "This page doesn't exist or is no longer active.",
    errorTitle: "Error",
    errorLoadPage: "Something went wrong loading this page.",
    errorLoadList: "Something went wrong loading the list.",
    allProducers: "← All producers",
    defaultProducerName: "Producer",
    noContactLinks: "No contact link added yet.",
    productsN: "Products ({n})",
    noPublicProducts: "No products shown publicly at the moment.",
    noName: "(no name)",
    orderHint: "To order, use one of the links above — this page does not process payments or orders directly.",
    defaultCatalogTitle: "Product catalog",
    directoryTitle: "Natural cosmetics producers",
    directoryDesc: "A directory of producers presenting their products with Herbatium. Each page links onward to the producer's sales channel (Instagram, Breslo, Etsy, their own website).",
    noPublicProducers: "No public producers at the moment.",
    viewCatalog: "View catalog →",
    directoryPageTitle: "Producers — Herbatium",
    footer: 'Page generated with <a href="/">Herbatium</a> — the tool for small natural cosmetics producers.',
    instagram: "Instagram",
    bresloShop: "Breslo shop",
    etsyShop: "Etsy shop",
    ownWebsite: "Own website",
    facebook: "Facebook",
  },
};
function tr(lang, key, vars) {
  let str = (STRINGS[lang] && STRINGS[lang][key]) != null ? STRINGS[lang][key] : STRINGS.ro[key];
  if (str == null) return key;
  if (vars) Object.keys(vars).forEach((k) => { str = str.split("{" + k + "}").join(vars[k]); });
  return str;
}
// Determină limba curentă din ?lang=, apoi din cookie, altfel "ro"; dacă
// ?lang= e prezent și valid, actualizează și cookie-ul (persistă alegerea).
function resolveLang(req, res) {
  const q = req.query && req.query.lang;
  if (q === "ro" || q === "en") {
    if (res) {
      try { res.cookie(CATALOG_LANG_COOKIE, q, { maxAge: 1000 * 60 * 60 * 24 * 365, sameSite: "lax" }); } catch (e) { /* ignorăm — limba tot funcționează pentru cererea curentă */ }
    }
    return q;
  }
  const c = req.cookies && req.cookies[CATALOG_LANG_COOKIE];
  return c === "en" ? "en" : "ro";
}
// Construiește linkul pentru celălalt buton de limbă, păstrând path-ul curent
// și restul query string-ului (înlocuind doar `lang`).
function langSwitchUrl(req, targetLang) {
  const params = new URLSearchParams(req.query || {});
  params.set("lang", targetLang);
  return req.path + "?" + params.toString();
}
function langToggleHtml(req, lang) {
  return `<div class="langToggle">
    <a href="${esc(langSwitchUrl(req, "ro"))}" class="langBtn${lang === "ro" ? " active" : ""}">RO</a>
    <a href="${esc(langSwitchUrl(req, "en"))}" class="langBtn${lang === "en" ? " active" : ""}">EN</a>
  </div>`;
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

function pageShell(title, body, templateId, opts) {
  const t = TEMPLATES[templateId] || TEMPLATES[DEFAULT_TEMPLATE];
  const lang = (opts && opts.lang) || "ro";
  const langToggle = (opts && opts.req) ? langToggleHtml(opts.req, lang) : "";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/fonts-catalog.css">
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
.top{padding:24px 0 8px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.top a{color:var(--ink-soft);font-size:13px;text-decoration:none}
.langToggle{display:inline-flex;border:1px solid var(--line);border-radius:7px;overflow:hidden;flex:none}
.langToggle .langBtn{padding:5px 11px;font-size:12.5px;font-weight:600;color:var(--ink-soft);text-decoration:none;opacity:.7}
.langToggle .langBtn.active{opacity:1;background:var(--accent);color:var(--accent-ink)}
.langToggle .langBtn:not(.active):hover{opacity:1}
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
${langToggle ? `<div class="top" style="justify-content:flex-end">${langToggle}</div>` : ""}
${body}
<div class="footer">${tr(lang, "footer")}</div>
</div>
</body>
</html>`;
}

// Randează corpul paginii unui producător — folosit atât pentru pagina publică
// reală (cu date din baza de date), cât și pentru previzualizarea din tab-ul
// "Pagina publică" (cu date nesalvate încă din formular).
function renderProducerBody(profile, products, opts) {
  const lang = (opts && opts.lang) || "ro";
  const backLink = (opts && opts.noBackLink) ? "" : `<div class="top"><a href="/catalog">${tr(lang, "allProducers")}</a>${opts && opts.req ? langToggleHtml(opts.req, lang) : ""}</div>`;
  const links = [
    profile.instagramUrl && `<a href="${esc(profile.instagramUrl)}" target="_blank" rel="noopener">${tr(lang, "instagram")}</a>`,
    profile.bresloUrl && `<a href="${esc(profile.bresloUrl)}" target="_blank" rel="noopener">${tr(lang, "bresloShop")}</a>`,
    profile.etsyUrl && `<a href="${esc(profile.etsyUrl)}" target="_blank" rel="noopener">${tr(lang, "etsyShop")}</a>`,
    profile.websiteUrl && `<a href="${esc(profile.websiteUrl)}" target="_blank" rel="noopener">${tr(lang, "ownWebsite")}</a>`,
    profile.facebookUrl && `<a href="${esc(profile.facebookUrl)}" target="_blank" rel="noopener">${tr(lang, "facebook")}</a>`,
  ].filter(Boolean).join("");

  return `
    ${backLink}
    <div class="card">
      <h1>${esc(profile.businessName || tr(lang, "defaultProducerName"))}</h1>
      ${profile.bio ? `<p>${esc(profile.bio)}</p>` : ""}
      ${links ? `<div class="links">${links}</div>` : `<p class="hint">${tr(lang, "noContactLinks")}</p>`}
    </div>
    <div class="card">
      <h2 style="font-size:16px;margin-bottom:10px">${tr(lang, "productsN", { n: products.length })}</h2>
      ${products.length === 0 ? `<p class="hint">${tr(lang, "noPublicProducts")}</p>` : `
      <div class="grid">
        ${products.map((p) => `
          <div>
            <div class="photo">${p.photos && p.photos[0] ? `<img src="${esc(p.photos[0].url)}" alt="${esc(p.name)}">` : ""}</div>
            <div class="name">${esc(p.name || tr(lang, "noName"))}</div>
            ${p.price ? `<div class="price">${esc(Number(p.price).toFixed(2))} lei</div>` : ""}
          </div>`).join("")}
      </div>`}
      <p class="hint" style="margin-top:14px">${tr(lang, "orderHint")}</p>
    </div>
  `;
}

// Pagina publică de catalog a unui producător
router.get("/:slug", async (req, res) => {
  const lang = resolveLang(req, res);
  try {
    const user = await prisma.user.findFirst({
      where: { slug: req.params.slug, publicPageEnabled: true },
    });
    if (!user) return res.status(404).send(pageShell(tr(lang, "pageNotFoundTitle"), `<div class="top"><a href="/catalog">${tr(lang, "allProducers")}</a>${langToggleHtml(req, lang)}</div><div class="card">${tr(lang, "pageNotFoundBody")}</div>`, DEFAULT_TEMPLATE, { lang }));

    const data = await prisma.userData.findUnique({ where: { userId: user.id } });
    const products = ((data && data.products) || []).filter((p) => p && p.publicVisible && p.name && p.name.trim());
    const body = renderProducerBody(user, products, { lang, req });
    res.send(pageShell(user.businessName || tr(lang, "defaultCatalogTitle"), body, user.catalogTemplate, { lang, req }));
  } catch (e) {
    res.status(500).send(pageShell(tr(lang, "errorTitle"), `<div class="card">${tr(lang, "errorLoadPage")}</div>`, DEFAULT_TEMPLATE, { lang, req }));
  }
});

// Director public cu toți producătorii care au activat pagina
router.get("/", async (req, res) => {
  const lang = resolveLang(req, res);
  try {
    const users = await prisma.user.findMany({
      where: { publicPageEnabled: true, slug: { not: null } },
      orderBy: { businessName: "asc" },
      select: { slug: true, businessName: true, bio: true },
    });
    const body = `
      <div class="card">
        <h1>${tr(lang, "directoryTitle")}</h1>
        <p class="hint">${tr(lang, "directoryDesc")}</p>
      </div>
      ${users.length === 0 ? `<div class="card hint">${tr(lang, "noPublicProducers")}</div>` : users.map((u) => `
        <div class="card">
          <h2 style="font-size:16px;margin-bottom:4px"><a href="/catalog/${esc(u.slug)}" style="color:inherit;text-decoration:none">${esc(u.businessName || u.slug)}</a></h2>
          ${u.bio ? `<p class="hint">${esc(u.bio)}</p>` : ""}
          <a href="/catalog/${esc(u.slug)}" style="font-size:13px;color:var(--accent)">${tr(lang, "viewCatalog")}</a>
        </div>`).join("")}
    `;
    res.send(pageShell(tr(lang, "directoryPageTitle"), body, DEFAULT_TEMPLATE, { lang, req }));
  } catch (e) {
    res.status(500).send(pageShell(tr(lang, "errorTitle"), `<div class="card">${tr(lang, "errorLoadList")}</div>`, DEFAULT_TEMPLATE, { lang, req }));
  }
});

module.exports = router;
module.exports.TEMPLATES = TEMPLATES;
module.exports.DEFAULT_TEMPLATE = DEFAULT_TEMPLATE;
module.exports.pageShell = pageShell;
module.exports.renderProducerBody = renderProducerBody;
module.exports.resolveLang = resolveLang;
module.exports.tr = tr;
