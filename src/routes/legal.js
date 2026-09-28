// Pagini legale publice: Termeni, Confidențialitate, Cookie-uri, Acord de
// prelucrare a datelor (DPA). Conținutul e un MODEL — nu e aviz juridic.
// Înainte de lansare, dă-l spre verificare unui avocat/consultant GDPR și
// completează COMPANY_* în .env (altfel apar placeholder-e vizibile [...]).
//
// Limbă: aceste pagini au și o variantă engleză (funcțiile *_en de mai jos),
// aleasă din ?lang=ro/en sau dintr-un cookie ("herbatium_legal_lang"),
// implicit "ro" — aceeași schemă simplă ca la src/routes/catalog.js. Textul
// legal e un MODEL în ambele limbi; varianta engleză nu înlocuiește
// varianta românească drept text juridic de referință (legislația citată —
// GDPR, OUG 34/2014, Legea 506/2004 — e legislație românească/UE).
const express = require("express");
const { companyVars } = require("../legalConfig");

const router = express.Router();

const LEGAL_LANG_COOKIE = "herbatium_legal_lang";
function resolveLang(req, res) {
  const q = req.query && req.query.lang;
  if (q === "ro" || q === "en") {
    if (res) {
      try { res.cookie(LEGAL_LANG_COOKIE, q, { maxAge: 1000 * 60 * 60 * 24 * 365, sameSite: "lax" }); } catch (e) { /* limba tot funcționează pentru cererea curentă */ }
    }
    return q;
  }
  const c = req.cookies && req.cookies[LEGAL_LANG_COOKIE];
  return c === "en" ? "en" : "ro";
}
function langSwitchUrl(req, targetLang) {
  const params = new URLSearchParams(req.query || {});
  params.set("lang", targetLang);
  return req.path + "?" + params.toString();
}
function langToggleHtml(req, lang) {
  return `<div class="langToggle">
    <a href="${escAttrOnly(langSwitchUrl(req, "ro"))}" class="langBtn${lang === "ro" ? " active" : ""}">RO</a>
    <a href="${escAttrOnly(langSwitchUrl(req, "en"))}" class="langBtn${lang === "en" ? " active" : ""}">EN</a>
  </div>`;
}
function escAttrOnly(s) { return String(s == null ? "" : s).replace(/"/g, "&quot;"); }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const NAV_LABELS = {
  ro: {
    enterAccount: "Intră în cont",
    terms: "Termeni și condiții",
    privacy: "Confidențialitate",
    cookies: "Cookie-uri",
    dpa: "Acord de prelucrare (DPA)",
    notFound: "Pagină legală inexistentă.",
  },
  en: {
    enterAccount: "Sign in",
    terms: "Terms and Conditions",
    privacy: "Privacy",
    cookies: "Cookies",
    dpa: "Data Processing Agreement (DPA)",
    notFound: "This legal page doesn't exist.",
  },
};

function shell(title, bodyHtml, lang, req) {
  const v = companyVars();
  const nav = NAV_LABELS[lang] || NAV_LABELS.ro;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Herbatium</title>
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="/style.css">
<style>
  body{display:block;padding:0;background-image:none}
  .legalWrap{max-width:760px;margin:0 auto;padding:40px 20px 80px}
  .legalWrap h1{font-size:26px;margin-bottom:6px}
  .legalWrap h2{font-size:17px;margin-top:32px;margin-bottom:10px;padding-top:14px;border-top:1px solid var(--line)}
  .legalWrap p{color:var(--ink);line-height:1.65;font-size:14px}
  .legalWrap .muted{color:var(--ink-soft);font-size:12.5px}
  .legalWrap table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12.5px}
  .legalWrap th,.legalWrap td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  .legalWrap th{background:var(--surface-2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--ink-soft)}
  .legalWrap ul{padding-left:20px;line-height:1.7;font-size:14px}
  .legalWrap a{color:var(--accent);font-weight:600}
  .legalNote{background:var(--surface-2);border-radius:var(--radius-sm,10px);padding:12px 14px;font-size:12.5px;color:var(--ink-soft);margin:18px 0}
  .legalTop{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line);max-width:760px;margin:0 auto;gap:12px;flex-wrap:wrap}
  .legalTop a{color:var(--ink);font-weight:700;text-decoration:none}
  .legalTop .rightSide{display:flex;align-items:center;gap:12px}
  .langToggle{display:inline-flex;border:1px solid var(--line);border-radius:7px;overflow:hidden;flex:none}
  .langToggle .langBtn{padding:5px 11px;font-size:12.5px;font-weight:600;color:var(--ink-soft);text-decoration:none;opacity:.7}
  .langToggle .langBtn.active{opacity:1;background:var(--accent);color:var(--accent-ink,#fff)}
  .langToggle .langBtn:not(.active):hover{opacity:1}
  .legalFoot{max-width:760px;margin:0 auto;padding:18px 20px;border-top:1px solid var(--line);font-size:12px;color:var(--ink-soft)}
  .legalFoot nav{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
  .legalFoot a{color:var(--ink-soft)}
</style>
</head>
<body>
<div class="legalTop"><a href="/">Herbatium</a><div class="rightSide">${langToggleHtml(req, lang)}<a href="/login.html" class="muted" style="font-weight:500">${nav.enterAccount}</a></div></div>
<div class="legalWrap">
${bodyHtml}
</div>
<div class="legalFoot">
  <div><strong>${esc(v.FIRMA)}</strong> · CUI ${esc(v.CUI)} · ${esc(v.ADRESA)} · <a href="mailto:${esc(v.EMAIL)}">${esc(v.EMAIL)}</a></div>
  <nav>
    <a href="/legal/termeni${lang === "en" ? "?lang=en" : ""}">${nav.terms}</a>
    <a href="/legal/confidentialitate${lang === "en" ? "?lang=en" : ""}">${nav.privacy}</a>
    <a href="/legal/cookies${lang === "en" ? "?lang=en" : ""}">${nav.cookies}</a>
    <a href="/legal/dpa${lang === "en" ? "?lang=en" : ""}">${nav.dpa}</a>
    <a href="https://anpc.ro" rel="noopener">ANPC</a>
    <a href="https://reclamatiisal.anpc.ro" rel="noopener">SAL</a>
  </nav>
</div>
</body>
</html>`;
}

function confidentialitate(v) {
  return `
  <h1>Politica de confidențialitate</h1>
  <p class="muted">Versiunea ${esc(v.VERSIUNE)}. Se aplică aplicației Herbatium.</p>
  <div class="legalNote">Document-model, redactat pentru arhitectura concretă a Herbatium (ce date colectează, unde le trimite, cât le păstrează). Nu e aviz juridic — verifică-l cu un avocat sau consultant GDPR și completează câmpurile din paranteze pătrate înainte de publicare.</div>

  <h2>1. Cine suntem</h2>
  <p>Operatorul datelor tale este <strong>${esc(v.FIRMA)}</strong>, CUI ${esc(v.CUI)}${v.REG ? `, ${esc(v.REG)}` : ""}, cu sediul în ${esc(v.ADRESA)} („noi"). Pentru orice întrebare sau cerere privind datele personale ne scrii la <strong>${esc(v.EMAIL_GDPR)}</strong>. Răspundem în cel mult o lună de la primirea cererii.</p>

  <h2>2. Ce date prelucrăm</h2>
  <table>
    <tr><th>Categorie</th><th>Exemple</th><th>De unde provin</th></tr>
    <tr><td>Date de cont</td><td>e-mail, parola (stocată doar ca amprentă criptografică bcrypt), data creării contului</td><td>de la tine, la înregistrare</td></tr>
    <tr><td>CUI firmă/PFA</td><td>codul unic de înregistrare al firmei/PFA cu care te abonezi</td><td>de la tine, la înregistrare</td></tr>
    <tr><td>Date de aplicație</td><td>rețete, ingrediente personalizate, loturi de producție, stoc, prețuri, produse finite, vânzări</td><td>de la tine, introduse în aplicație</td></tr>
    <tr><td>Poze de produs</td><td>fotografiile pe care le încarci pentru produsele tale finite</td><td>de la tine, la încărcare</td></tr>
    <tr><td>Pagina publică de catalog (opțională)</td><td>numele afacerii, o scurtă descriere (bio), linkuri către Instagram/Breslo/Etsy/website/Facebook — dacă o activezi</td><td>de la tine, dacă activezi pagina publică</td></tr>
    <tr><td>Date de echipă (opțional)</td><td>adresa de e-mail a colegului pe care îl inviți în cont</td><td>de la tine, dacă inviți un coleg</td></tr>
    <tr><td>Date de facturare și plată</td><td>e-mail, identificatorul de client Stripe, starea abonamentului. Datele cardului <strong>nu</strong> ajung la noi, ci doar la Stripe</td><td>de la tine, prin Stripe Checkout</td></tr>
    <tr><td>Feedback (opțional)</td><td>mesajul pe care alegi să ni-l trimiți din butonul „Feedback” (idee, bug sau altceva), plus tabul din aplicație din care l-ai trimis</td><td>de la tine, dacă alegi să trimiți feedback</td></tr>
    <tr><td>Date tehnice</td><td>adresa IP și date de conexiune în jurnalele serverului, cookie-ul de sesiune</td><td>automat</td></tr>
    <tr><td>Preferință „Noutăți”</td><td>ultima actualizare a aplicației pe care ai văzut-o deja, ca să nu-ți arătăm de mai multe ori același anunț</td><td>automat, când deschizi panoul „Noutăți”</td></tr>
  </table>
  <p>Aplicația e gândită pentru date <strong>despre rețetele și afacerea ta</strong>. Îți recomandăm să nu introduci în câmpurile de rețete/stoc date personale ale unor terți (de exemplu CNP-uri) — dacă notezi un nume de furnizor sau de client, tratează-l ca dată cu caracter personal dacă e o persoană fizică, nu o firmă.</p>

  <h2>3. De ce și pe ce bază legală</h2>
  <table>
    <tr><th>Scop</th><th>Temei legal (GDPR)</th><th>Cât păstrăm</th></tr>
    <tr><td>Crearea și administrarea contului, autentificarea</td><td>executarea contractului, art. 6 alin. (1) lit. b)</td><td>cât timp ai cont activ</td></tr>
    <tr><td>Salvarea rețetelor, stocului, loturilor, produselor și funcționarea aplicației</td><td>executarea contractului, art. 6 alin. (1) lit. b)</td><td>cât timp abonamentul e activ, plus <strong>30 de zile</strong> după anularea lui — apoi <strong>ștergere definitivă și automată</strong>, dacă nu te reabonezi până atunci (te anunțăm pe e-mail chiar din ziua anulării, cu data exactă). Poți oricând să ștergi contul și mai devreme, manual, din „Cont &amp; confidențialitate”</td></tr>
    <tr><td>Pagina publică de catalog</td><td>consimțământ / interesul tău direct de a promova produsele, art. 6 alin. (1) lit. a)/f)</td><td>până o dezactivezi din cont</td></tr>
    <tr><td>Încasarea abonamentului</td><td>executarea contractului, art. 6 alin. (1) lit. b)</td><td>cât timp ai abonament activ + evidențele impuse de Stripe ca procesator</td></tr>
    <tr><td>Notificări e-mail (rezumat zilnic stoc/expirări, dacă e activat)</td><td>executarea contractului, art. 6 alin. (1) lit. b)</td><td>cât timp ai cont</td></tr>
    <tr><td>Securitate, prevenirea abuzurilor, jurnale tehnice</td><td>interes legitim, art. 6 alin. (1) lit. f)</td><td>jurnale server: maximum 30 de zile</td></tr>
    <tr><td>CUI firmă/PFA — facturare și o singură înregistrare per firmă</td><td>executarea contractului (facturare), art. 6 alin. (1) lit. b), și interes legitim (prevenirea creării repetate de conturi pentru aceeași firmă, inclusiv pentru reutilizarea unei oferte introductive), art. 6 alin. (1) lit. f)</td><td>cât timp ai cont activ</td></tr>
    <tr><td>Prevenirea reutilizării ofertei introductive (prima lună la preț redus) — evidență minimă: CUI și adresa de e-mail, plus data ultimei activări a abonamentului</td><td>interes legitim (prevenirea folosirii repetate a unei oferte destinate exclusiv clienților noi, prin ștergerea și recrearea contului), art. 6 alin. (1) lit. f)</td><td><strong>3 ani de la ultima activare</strong> a abonamentului tău — <strong>separat de contul propriu-zis</strong> și indiferent dacă între timp contul e șters (manual sau automat, conform rândului de mai sus): păstrăm doar aceste două elemente minime, nu restul datelor din cont, exact atât cât e nevoie ca protecția să fie eficientă, apoi se șterg definitiv și automat</td></tr>
    <tr><td>Feedback trimis din aplicație</td><td>interes legitim — îmbunătățirea aplicației pe baza a ceea ce contează pentru utilizatori, art. 6 alin. (1) lit. f)</td><td>mesajul se păstrează și pentru dezvoltarea produsului, chiar și după ce contul e șters (manual sau automat) — dar, exact în momentul ștergerii contului, îl <strong>decuplăm de identitatea ta</strong>: adresa de e-mail asociată e înlocuită cu o mențiune generică („cont șters”), rămâne doar conținutul mesajului</td></tr>
  </table>
  <p>Nu luăm decizii bazate exclusiv pe prelucrare automată care să producă efecte juridice asupra ta.</p>
  <p>Perioada de 30 de zile de retenție după anulare respectă principiul limitării stocării (art. 5 alin. (1) lit. e) GDPR): nu păstrăm datele „pe caz de", ci doar atât cât e necesar ca să te poți reabona sau exporta datele, fără să întârziem nejustificat ștergerea lor. Ștergerea e automată, aplicată de un proces tehnic care rulează zilnic — nu depinde de o cerere din partea ta.</p>
  <p><strong>Excepție punctuală de la ștergerea automată a contului: prevenirea reutilizării ofertei introductive.</strong> Oferta de preț redus pentru prima lună e valabilă o singură dată per firmă/PFA (CUI) și per adresă de e-mail. Ca să nu poată fi obținută din nou printr-un cont nou creat după ce cel vechi a fost șters <strong>automat</strong> (adică fără să fi cerut tu asta — pur și simplu nu te-ai reabonat în cele 30 de zile), păstrăm — separat de restul contului tău, într-o evidență minimă (doar CUI/e-mail și data ultimei activări, fără rețete, stoc sau alte date de aplicație) — dovada că firma sau adresa de e-mail respectivă a mai avut un abonament. Această evidență se șterge definitiv și automat după 3 ani de la ultima ta activare, chiar dacă între timp contul propriu-zis a fost deja șters automat.</p>
  <p><strong>Dacă tu ceri activ ștergerea</strong> — fie apăsând „Șterge contul" din „Cont & confidențialitate", fie printr-o cerere scrisă la ${esc(v.EMAIL_GDPR)} — ștergem definitiv și această evidență de rezervă, nu doar contul, exact ca oricare altă dată a ta. Efectul practic: dacă revii vreodată cu un cont nou, vei fi din nou eligibil pentru prețul introductiv — o acceptăm ca preț corect al respectării cererii tale explicite de ștergere, conform art. 17 și art. 21 GDPR.</p>
  <p>Deși CUI-ul firmei/PFA e o informație publică (Registrul Comerțului/ANAF), asta nu îl scoate din categoria datelor cu caracter personal atunci când identifică o persoană fizică autorizată — rămâne protejat de această politică exact ca orice altă dată a ta, indiferent de publicitatea lui la nivel de registru public.</p>

  <h2>4. Cui transmitem datele</h2>
  <p>Nu vindem și nu închiriem datele tale. Le transmitem doar furnizorilor care ne ajută să livrăm serviciul, pe bază de contract de prelucrare (art. 28 GDPR):</p>
  <table>
    <tr><th>Furnizor</th><th>Ce face</th><th>Unde</th></tr>
    <tr><td>Railway Corporation</td><td>serverul aplicației și baza de date (PostgreSQL)</td><td>UE — europe-west4 (Amsterdam, Olanda)</td></tr>
    <tr><td>Stripe Payments Europe Ltd.</td><td>procesarea plăților cu cardul / abonamentul</td><td>UE (Irlanda), cu posibile transferuri către Stripe Inc. (SUA) pe bază de garanții adecvate</td></tr>
    <tr><td>Resend</td><td>trimiterea e-mailurilor tranzacționale (rezumat zilnic stoc/expirări, notificare de plată declarată, notificare de anulare/retenție, noutăți aplicație)</td><td>SUA — date stocate integral acolo (conținutul mesajelor, jurnalele de livrare), pe bază de clauze contractuale standard și participarea Resend la EU-U.S. Data Privacy Framework</td></tr>
    <tr><td>Autorități publice (ANAF, instanțe)</td><td>doar când legea ne obligă</td><td>România</td></tr>
  </table>
  <p>Stripe acționează și ca operator independent pentru datele de plată, conform propriei politici de confidențialitate.</p>

  <h2>5. Drepturile tale</h2>
  <ul>
    <li>să <strong>accesezi</strong> datele și să primești o copie — din tab-ul „Cont & confidențialitate" poți descărca oricând toate datele într-un fișier JSON;</li>
    <li>să <strong>rectifici</strong> datele inexacte, direct din aplicație;</li>
    <li>să <strong>ștergi</strong> datele — din același tab îți poți șterge contul definitiv;</li>
    <li>să <strong>restricționezi</strong> prelucrarea;</li>
    <li>la <strong>portabilitate</strong> — exportul JSON e un format structurat, citibil automat;</li>
    <li>să te <strong>opui</strong> prelucrării bazate pe interes legitim;</li>
    <li>să îți <strong>retragi consimțământul</strong> pentru pagina publică sau notificări, oricând, fără să afecteze prelucrarea anterioară;</li>
    <li>să depui o <strong>plângere</strong> la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), B-dul G-ral. Gheorghe Magheru 28-30, București, <a href="https://www.dataprotection.ro" target="_blank" rel="noopener">www.dataprotection.ro</a>.</li>
  </ul>
  <p>Pentru exercitarea drepturilor ne scrii la ${esc(v.EMAIL_GDPR)}. Putem cere informații suplimentare ca să confirmăm identitatea.</p>

  <h2>6. Cum protejăm datele</h2>
  <ul>
    <li>conexiune criptată HTTPS;</li>
    <li>parole stocate doar ca amprente criptografice (bcrypt), niciodată în clar;</li>
    <li>sesiuni cu cookie securizat (HttpOnly, SameSite), expirare după 30 de zile;</li>
    <li>acces la server restricționat, copii de siguranță periodice;</li>
    <li>datele cardului sunt procesate exclusiv de Stripe (certificat PCI DSS).</li>
  </ul>
  <p>În cazul unei încălcări a securității datelor care prezintă un risc pentru tine, notificăm ANSPDCP în 72 de ore și te informăm fără întârzieri nejustificate, conform art. 33–34 GDPR.</p>

  <h2>7. Minori</h2>
  <p>Serviciul se adresează persoanelor peste 18 ani care produc sau vor să producă cosmetice. Nu colectăm cu bună știință date ale minorilor.</p>

  <h2>8. Cookie-uri</h2>
  <p>Folosim un singur cookie strict necesar, pentru sesiunea de autentificare. Detalii: <a href="/legal/cookies">Politica de cookie-uri</a>.</p>

  <h2>9. Modificări</h2>
  <p>Când modificăm această politică, publicăm noua versiune aici, cu data ei. Pentru schimbări importante te anunțăm pe e-mail sau în aplicație înainte să intre în vigoare.</p>
  `;
}

function confidentialitate_en(v) {
  return `
  <h1>Privacy Policy</h1>
  <p class="muted">Version ${esc(v.VERSIUNE)}. Applies to the Herbatium app.</p>
  <div class="legalNote">Model document, translated from the Romanian original for the Herbatium architecture (what data is collected, where it is sent, how long it is kept). This is a translation of the Romanian legal document for convenience, not independent legal advice — it is not a substitute for the Romanian version, which references Romanian and EU law. Have it reviewed by a lawyer or GDPR consultant and fill in the bracketed fields before publishing.</div>

  <h2>1. Who we are</h2>
  <p>The controller of your data is <strong>${esc(v.FIRMA)}</strong>, tax ID (CUI) ${esc(v.CUI)}${v.REG ? `, ${esc(v.REG)}` : ""}, registered at ${esc(v.ADRESA)} ("we"). For any question or request about personal data, write to us at <strong>${esc(v.EMAIL_GDPR)}</strong>. We respond within one month of receiving your request.</p>

  <h2>2. What data we process</h2>
  <table>
    <tr><th>Category</th><th>Examples</th><th>Source</th></tr>
    <tr><td>Account data</td><td>email, password (stored only as a bcrypt cryptographic hash), account creation date</td><td>from you, at registration</td></tr>
    <tr><td>Company/sole-trader tax ID (CUI)</td><td>the unique registration code of the company/sole trader you subscribe under</td><td>from you, at registration</td></tr>
    <tr><td>Application data</td><td>recipes, custom ingredients, production batches, stock, prices, finished products, sales</td><td>from you, entered in the app</td></tr>
    <tr><td>Product photos</td><td>photos you upload for your finished products</td><td>from you, when uploading</td></tr>
    <tr><td>Public catalog page (optional)</td><td>business name, a short bio, links to Instagram/Breslo/Etsy/website/Facebook — if you enable it</td><td>from you, if you enable the public page</td></tr>
    <tr><td>Team data (optional)</td><td>the email address of a colleague you invite to the account</td><td>from you, if you invite a colleague</td></tr>
    <tr><td>Billing and payment data</td><td>email, Stripe customer identifier, subscription status. Card data <strong>never</strong> reaches us — only Stripe</td><td>from you, via Stripe Checkout</td></tr>
    <tr><td>Feedback (optional)</td><td>the message you choose to send via the "Feedback" button (idea, bug, or other), plus the app tab it was sent from</td><td>from you, if you choose to send feedback</td></tr>
    <tr><td>Technical data</td><td>IP address and connection data in server logs, the session cookie</td><td>automatic</td></tr>
    <tr><td>"News" preference</td><td>the latest app update you've already seen, so we don't show you the same announcement repeatedly</td><td>automatic, when you open the "News" panel</td></tr>
  </table>
  <p>The app is designed for data <strong>about your recipes and business</strong>. We recommend you don't enter third parties' personal data (e.g. national ID numbers) in the recipe/stock fields — if you note a supplier's or customer's name, treat it as personal data if it's an individual, not a company.</p>

  <h2>3. Why, and on what legal basis</h2>
  <table>
    <tr><th>Purpose</th><th>Legal basis (GDPR)</th><th>Retention</th></tr>
    <tr><td>Creating and managing the account, authentication</td><td>performance of the contract, Art. 6(1)(b)</td><td>as long as you have an active account</td></tr>
    <tr><td>Saving recipes, stock, batches, products, and app operation</td><td>performance of the contract, Art. 6(1)(b)</td><td>as long as the subscription is active, plus <strong>30 days</strong> after cancellation — then <strong>permanent, automatic deletion</strong> if you don't resubscribe by then (we notify you by email the same day of cancellation, with the exact date). You can always delete the account sooner, manually, from "Account & Privacy"</td></tr>
    <tr><td>Public catalog page</td><td>consent / your direct interest in promoting your products, Art. 6(1)(a)/(f)</td><td>until you disable it from your account</td></tr>
    <tr><td>Collecting the subscription payment</td><td>performance of the contract, Art. 6(1)(b)</td><td>as long as you have an active subscription + the records required by Stripe as a processor</td></tr>
    <tr><td>Email notifications (daily stock/expiry summary, if enabled)</td><td>performance of the contract, Art. 6(1)(b)</td><td>as long as you have an account</td></tr>
    <tr><td>Security, abuse prevention, technical logs</td><td>legitimate interest, Art. 6(1)(f)</td><td>server logs: maximum 30 days</td></tr>
    <tr><td>Company/sole-trader tax ID (CUI) — invoicing and a single registration per company</td><td>performance of the contract (invoicing), Art. 6(1)(b), and legitimate interest (preventing repeated account creation for the same company, including reuse of an intro offer), Art. 6(1)(f)</td><td>as long as you have an active account</td></tr>
    <tr><td>Preventing reuse of the intro offer (first month at a reduced price) — minimal record: tax ID and email address, plus the date of the last subscription activation</td><td>legitimate interest (preventing repeated use of an offer meant exclusively for new customers, by deleting and recreating the account), Art. 6(1)(f)</td><td><strong>3 years from the last activation</strong> of your subscription — <strong>separate from the account itself</strong> and regardless of whether the account has since been deleted (manually or automatically, per the row above): we keep only these two minimal items, not the rest of the account data, exactly as long as needed for the protection to be effective, then they are permanently and automatically deleted</td></tr>
    <tr><td>Feedback sent from the app</td><td>legitimate interest — improving the app based on what matters to users, Art. 6(1)(f)</td><td>the message is also kept for product development, even after the account is deleted (manually or automatically) — but, right at the moment the account is deleted, we <strong>decouple it from your identity</strong>: the associated email address is replaced with a generic note ("deleted account"), only the message content remains</td></tr>
  </table>
  <p>We do not make decisions based solely on automated processing that produce legal effects concerning you.</p>
  <p>The 30-day retention period after cancellation follows the storage-limitation principle (Art. 5(1)(e) GDPR): we don't keep data "just in case", only for as long as needed for you to resubscribe or export your data, without unjustifiably delaying its deletion. Deletion is automatic, applied by a technical process that runs daily — it doesn't depend on a request from you.</p>
  <p><strong>A specific exception to automatic account deletion: preventing reuse of the intro offer.</strong> The reduced first-month price is valid once per company/sole trader (tax ID) and per email address. So that it cannot be obtained again through a new account created after the old one was deleted <strong>automatically</strong> (i.e. without you requesting it — you simply didn't resubscribe within the 30 days), we keep — separately from the rest of your account, in a minimal record (only tax ID/email and the date of the last activation, without recipes, stock, or other app data) — proof that the company or email address previously had a subscription. This record is permanently and automatically deleted 3 years after your last activation, even if the account itself has since been automatically deleted.</p>
  <p><strong>If you actively request deletion</strong> — either by clicking "Delete account" in "Account & Privacy", or via a written request to ${esc(v.EMAIL_GDPR)} — we permanently delete this backup record too, not just the account, exactly like any other data of yours. The practical effect: if you ever come back with a new account, you'll be eligible for the intro price again — we accept this as the fair price of honoring your explicit deletion request, under Art. 17 and Art. 21 GDPR.</p>
  <p>Although a company/sole trader's tax ID is public information (Trade Registry/ANAF), that does not remove it from the category of personal data when it identifies an individual sole trader — it remains protected by this policy exactly like any other data of yours, regardless of its being public at the registry level.</p>

  <h2>4. Who we share data with</h2>
  <p>We do not sell or rent your data. We only share it with providers who help us deliver the service, under a data-processing agreement (Art. 28 GDPR):</p>
  <table>
    <tr><th>Provider</th><th>What it does</th><th>Where</th></tr>
    <tr><td>Railway Corporation</td><td>the app server and database (PostgreSQL)</td><td>EU — europe-west4 (Amsterdam, Netherlands)</td></tr>
    <tr><td>Stripe Payments Europe Ltd.</td><td>card payment / subscription processing</td><td>EU (Ireland), with possible transfers to Stripe Inc. (USA) under appropriate safeguards</td></tr>
    <tr><td>Resend</td><td>sending transactional emails (daily stock/expiry summary, declared-payment notification, cancellation/retention notification, app news)</td><td>USA — data stored entirely there (message content, delivery logs), under standard contractual clauses and Resend's participation in the EU-U.S. Data Privacy Framework</td></tr>
    <tr><td>Public authorities (ANAF, courts)</td><td>only when required by law</td><td>Romania</td></tr>
  </table>
  <p>Stripe also acts as an independent controller for payment data, under its own privacy policy.</p>

  <h2>5. Your rights</h2>
  <ul>
    <li>to <strong>access</strong> your data and receive a copy — from the "Account & Privacy" tab you can download all your data as a JSON file at any time;</li>
    <li>to <strong>rectify</strong> inaccurate data, directly in the app;</li>
    <li>to <strong>erase</strong> data — from the same tab you can permanently delete your account;</li>
    <li>to <strong>restrict</strong> processing;</li>
    <li>to <strong>portability</strong> — the JSON export is a structured, machine-readable format;</li>
    <li>to <strong>object</strong> to processing based on legitimate interest;</li>
    <li>to <strong>withdraw your consent</strong> for the public page or notifications, at any time, without affecting prior processing;</li>
    <li>to lodge a <strong>complaint</strong> with the Romanian National Supervisory Authority for Personal Data Processing (ANSPDCP), B-dul G-ral. Gheorghe Magheru 28-30, Bucharest, <a href="https://www.dataprotection.ro" target="_blank" rel="noopener">www.dataprotection.ro</a>.</li>
  </ul>
  <p>To exercise your rights, write to us at ${esc(v.EMAIL_GDPR)}. We may ask for additional information to confirm your identity.</p>

  <h2>6. How we protect your data</h2>
  <ul>
    <li>encrypted HTTPS connection;</li>
    <li>passwords stored only as cryptographic hashes (bcrypt), never in plain text;</li>
    <li>sessions with a secure cookie (HttpOnly, SameSite), expiring after 30 days;</li>
    <li>restricted server access, periodic backups;</li>
    <li>card data is processed exclusively by Stripe (PCI DSS certified).</li>
  </ul>
  <p>In the event of a data breach that presents a risk to you, we notify ANSPDCP within 72 hours and inform you without undue delay, under Art. 33–34 GDPR.</p>

  <h2>7. Minors</h2>
  <p>The service is aimed at people over 18 who make or want to make cosmetics. We do not knowingly collect data from minors.</p>

  <h2>8. Cookies</h2>
  <p>We use a single strictly necessary cookie, for the authentication session. Details: <a href="/legal/cookies?lang=en">Cookie Policy</a>.</p>

  <h2>9. Changes</h2>
  <p>When we change this policy, we publish the new version here, with its date. For significant changes we notify you by email or in the app before they take effect.</p>
  `;
}

function termeni(v) {
  return `
  <h1>Termeni și condiții</h1>
  <p class="muted">Versiunea ${esc(v.VERSIUNE)}.</p>
  <div class="legalNote">Document-model — verifică-l cu un jurist înainte de publicare, în special secțiunile despre răspundere, dreptul de retragere și facturare.</div>

  <h2>1. Părțile și serviciul</h2>
  <p>Serviciul Herbatium este furnizat de <strong>${esc(v.FIRMA)}</strong>, CUI ${esc(v.CUI)}${v.REG ? `, ${esc(v.REG)}` : ""}, sediul în ${esc(v.ADRESA)}, e-mail ${esc(v.EMAIL)}${v.TELEFON && !v.TELEFON.startsWith("[") ? `, telefon ${esc(v.TELEFON)}` : ""} („Furnizorul").</p>
  <p>Herbatium este o aplicație online pentru producători mici de cosmetice naturale artizanale din România: formulare rețete, generare listă INCI, verificare orientativă a restricțiilor UE, calculator de cost și preț, jurnal de loturi și o pagină publică opțională de catalog.</p>
  <p>Prin crearea unui cont accepți acești Termeni. Dacă folosești serviciul în numele unei firme/PFA, declari că ai dreptul să o reprezinți.</p>

  <h2>2. Ce NU este serviciul</h2>
  <p>Informațiile despre restricțiile UE, listele INCI generate și calculele afișate sunt <strong>ajutoare orientative</strong>, calculate pe baza datelor introduse de tine și a bazei de ingrediente din aplicație. <strong>Nu constituie și nu înlocuiesc</strong> un Raport de Siguranță a Produsului Cosmetic (CPSR) întocmit de un evaluator de siguranță autorizat, obligatoriu conform Regulamentului (CE) 1223/2009 înainte de comercializare, și nici notificarea CPNP.</p>
  <p>Baza de ingrediente și regulile de verificare pot fi incomplete sau pot rămâne în urma modificărilor legislative. Verifică întotdeauna încadrarea finală cu un evaluator de siguranță/consultant CPNP înainte de a vinde un produs.</p>
  <p><strong>Herbatium nu este o aplicație de contabilitate</strong> și nu oferă consultanță fiscală, contabilă sau juridică. Costurile, prețurile de vânzare sugerate și rapoartele generate în aplicație sunt instrumente orientative de gestiune a producției tale, nu evidență contabilă sau fiscală oficială și nu te scutesc de obligațiile tale legale de evidență financiară.</p>
  <p>Orice informație despre legislație afișată în aplicație (fiscală, contabilă, privind produsele cosmetice sau de altă natură — inclusiv actualizări legislative pe care le urmărim și le afișăm în tabul „Legislație & consultanți") are <strong>caracter strict informativ</strong>: e un rezumat orientativ, poate fi incompletă sau depășită de modificări ulterioare ale legii și <strong>nu constituie și nu înlocuiește un aviz juridic, fiscal, contabil sau de altă specialitate</strong>. Nu îți garantăm exactitatea, actualitatea sau exhaustivitatea acestor informații. Interpretarea și aplicarea legislației aplicabile activității tale (fiscală, contabilă, de conformitate cosmetică sau orice altă reglementare a domeniului tău) rămân în întregime în responsabilitatea ta sau a firmei/PFA-ului tău — Furnizorul nu își asumă nicio răspundere pentru deciziile luate sau consecințele suferite ca urmare a folosirii acestor informații, fără verificare independentă de specialitate.</p>

  <h2>3. Contul</h2>
  <p>Ai nevoie de un cont pentru a folosi aplicația. Ești responsabil pentru păstrarea confidențialității parolei și pentru activitatea din contul tău. Ne anunți imediat la ${esc(v.EMAIL)} dacă suspectezi acces neautorizat.</p>
  <p>La înregistrare declari CUI-ul firmei/PFA în numele căreia folosești serviciul. O firmă/PFA poate avea un singur cont activ — dacă CUI-ul e deja înregistrat, nu se poate crea un al doilea cont pentru aceeași firmă.</p>
  <p>Poți invita colegi în cont („echipă") — aceștia văd și editează aceleași date, fără abonament propriu. Ești responsabil pentru accesul pe care îl acorzi.</p>

  <h2>4. Abonamentul și plata</h2>
  <p>Accesul complet la aplicație necesită un abonament lunar, plătit prin Stripe. Prețul curent al abonamentului este afișat pe pagina de abonare, înainte să introduci datele de plată — de acolo confirmi suma exactă pe care o vei plăti.</p>
  <p><strong>Reînnoire automată.</strong> Abonamentul se reînnoiește automat, lunar, la aceeași dată din lună la care te-ai abonat inițial, până când îl anulezi din contul tău. Nu retrimitem o confirmare separată la fiecare reînnoire lunară — data primei plăți este data de referință pentru fiecare reînnoire ulterioară.</p>
  <p><strong>Anulare.</strong> Poți anula oricând, din tab-ul „Cont & confidențialitate" sau din pagina de abonare. Accesul rămâne activ până la sfârșitul perioadei deja plătite; nu facem rambursări proporționale („pro-rata") pentru perioada rămasă, cu excepția dreptului de retragere de la secțiunea 5.</p>
  <p><strong>Plată eșuată.</strong> Dacă plata lunară eșuează (card expirat, fonduri insuficiente etc.), Stripe reîncearcă automat procesarea conform politicii sale standard; dacă plata tot nu reușește, accesul complet la aplicație se suspendă până la regularizare, fără să-ți ștergem datele — le poți relua imediat ce reactivezi plata.</p>
  <p><strong>Modificarea prețului.</strong> Dacă schimbăm prețul abonamentului, te anunțăm cu cel puțin 30 de zile înainte ca noul preț să se aplice reînnoirii tale, pe e-mail sau în aplicație; poți anula oricând înainte de reînnoire dacă nu ești de acord.</p>
  <p><strong>Ofertă introductivă (prima lună la preț redus).</strong> E valabilă o singură dată pentru fiecare firmă/PFA (identificată prin CUI) și pentru fiecare adresă de e-mail folosită la înregistrare — nu poți obține din nou acest preț recreând contul, cu alt CUI sau altă adresă de e-mail decât cele deja folosite anterior pentru un abonament. <strong>Oferta este disponibilă doar până la 10.10.2026, inclusiv</strong> — după această dată nu se mai aplică niciunui client, nou sau existent, indiferent de data înregistrării contului. Vezi Politica de confidențialitate, secțiunea 3, pentru cât timp și în ce scop păstrăm, separat de contul propriu-zis, dovada minimă a folosirii anterioare.</p>
  <p><strong>Date după anulare.</strong> După ce abonamentul se încheie, datele tale (rețete, stoc, loturi, produse, poze) rămân salvate timp de <strong>30 de zile</strong>, cu acces restricționat, cât timp nu te reabonezi. Te anunțăm pe e-mail chiar din ziua anulării, cu data exactă la care vor fi șterse — îți recomandăm să îți descarci o copie din „Cont & confidențialitate” → „Descarcă toate datele” dacă vrei să le păstrezi. Dacă nu te reabonezi până la acea dată, contul și toate datele sunt <strong>șterse definitiv și automat</strong>, fără posibilitate de recuperare — vezi și secțiunea 3 din Politica de confidențialitate privind perioada de păstrare. Poți oricând să ștergi contul și mai devreme, manual, din același tab.</p>

  <h2>5. Dreptul de retragere (contracte la distanță)</h2>
  <p>Dacă te abonezi ca persoană fizică, în afara unei activități profesionale, ai dreptul să te retragi din contract în 14 zile de la abonare, fără motivare, conform OUG 34/2014. Dacă începi să folosești serviciul (conținut digital care nu se livrează pe suport fizic) înainte de expirarea acestui termen, prin abonare confirmi că soliciți începerea furnizării imediat și că îți pierzi dreptul de retragere odată ce serviciul a fost complet furnizat.</p>
  <p>Dacă te abonezi ca PFA/SRL, pentru activitatea ta de producție/vânzare de cosmetice, OUG 34/2014 nu se aplică (e o protecție rezervată consumatorilor persoane fizice) — în acest caz, îți oferim totuși aceleași 14 zile de retragere, voluntar, ca politică proprie, nu ca obligație legală.</p>

  <h2>6. Răspundere</h2>
  <p>Aplicația e furnizată „ca atare". Nu răspundem pentru decizii de afaceri, de formulare, de conformitate (cosmetică, fiscală, contabilă sau de altă natură) sau de orice alt fel, luate exclusiv pe baza informațiilor din aplicație, fără verificare de specialitate. În mod expres, nu răspundem pentru modul în care tu sau firma ta interpretați, aplicați sau respectați legislația aplicabilă activității voastre — inclusiv, dar fără a se limita la, legislația fiscală, contabilă și cea privind produsele cosmetice — indiferent dacă informații despre acea legislație au fost sau nu afișate în aplicație. Răspunderea noastră, în limita permisă de lege, este limitată la sumele plătite de tine pentru abonament în ultimele 12 luni.</p>
  <p>Pagina publică de catalog (dacă o activezi) afișează conținut ales și introdus integral de tine — denumirea afacerii, descrierea, pozele și prețurile produselor, linkurile către canalele tale de vânzare. Ești singurul responsabil pentru acuratețea, legalitatea și conformitatea acestui conținut, inclusiv pentru orice pretenție sau afirmație despre produsele tale cosmetice (de exemplu, respectarea art. 20 din Regulamentul (CE) 1223/2009 privind pretențiile permise pentru produsele cosmetice). Nu verificăm și nu ne asumăm răspunderea pentru conținutul publicat de tine pe această pagină.</p>
  <p>Pagina publică nu procesează plăți sau comenzi — se limitează la a redirecționa vizitatorul către canalul tău extern de vânzare (Instagram, Breslo, Etsy, site propriu sau altul indicat de tine). Nu suntem parte în nicio tranzacție, comandă, livrare, plată sau retur derulate prin acel canal extern și nu răspundem pentru ele în niciun fel; relația contractuală pentru orice vânzare aparține exclusiv ție și clientului tău final.</p>

  <h2>7. Încetare</h2>
  <p>Poți închide contul oricând, din tab-ul „Cont & confidențialitate". Putem suspenda sau închide conturi care încalcă acești Termeni sau legea, cu notificare prealabilă rezonabilă acolo unde e posibil.</p>

  <h2>8. Litigii</h2>
  <p>Poți depune o reclamație la Autoritatea Națională pentru Protecția Consumatorilor (ANPC, <a href="https://anpc.ro" target="_blank" rel="noopener">anpc.ro</a>) sau prin platforma națională de Soluționare Alternativă a Litigiilor (SAL, <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener">reclamatiisal.anpc.ro</a>), unde poți alerta o entitate SAL să medieze disputa cu noi. Platforma europeană „SOL" (Soluționarea online a litigiilor, fostă ec.europa.eu/consumers/odr) a fost desființată de Comisia Europeană — canalele de mai sus (ANPC și SAL) sunt cele actuale și corecte, la nivel național.</p>

  <h2>9. Modificări</h2>
  <p>Putem actualiza acești Termeni; publicăm noua versiune aici, cu data ei, și te anunțăm pentru schimbări importante.</p>
  `;
}

function termeni_en(v) {
  return `
  <h1>Terms and Conditions</h1>
  <p class="muted">Version ${esc(v.VERSIUNE)}. Translated from the Romanian original.</p>
  <div class="legalNote">Model document, translated for convenience — have it reviewed by a lawyer before publishing, especially the sections on liability, the right of withdrawal, and billing. The Romanian version is the legally authoritative one, since the referenced legislation (Romanian OUG 34/2014, EU Regulation (EC) 1223/2009) is Romanian/EU law.</div>

  <h2>1. The parties and the service</h2>
  <p>The Herbatium service is provided by <strong>${esc(v.FIRMA)}</strong>, tax ID (CUI) ${esc(v.CUI)}${v.REG ? `, ${esc(v.REG)}` : ""}, registered at ${esc(v.ADRESA)}, email ${esc(v.EMAIL)}${v.TELEFON && !v.TELEFON.startsWith("[") ? `, phone ${esc(v.TELEFON)}` : ""} (the "Provider").</p>
  <p>Herbatium is an online application for small artisanal natural-cosmetics producers in Romania: recipe formulation, INCI list generation, indicative EU-restriction checks, a cost and price calculator, a batch log, and an optional public catalog page.</p>
  <p>By creating an account you accept these Terms. If you use the service on behalf of a company/sole trader, you represent that you are entitled to represent it.</p>

  <h2>2. What the service is NOT</h2>
  <p>Information about EU restrictions, the generated INCI lists, and the displayed calculations are <strong>indicative aids</strong>, computed from the data you enter and the app's ingredient database. They <strong>do not constitute and do not replace</strong> a Cosmetic Product Safety Report (CPSR) prepared by a licensed safety assessor, which is mandatory under Regulation (EC) 1223/2009 before sale, nor the CPNP notification.</p>
  <p>The ingredient database and the checking rules may be incomplete or may lag behind legislative changes. Always verify the final classification with a safety assessor/CPNP consultant before selling a product.</p>
  <p><strong>Herbatium is not an accounting application</strong> and does not provide tax, accounting, or legal advice. The costs, suggested selling prices, and reports generated in the app are indicative tools for managing your production, not official accounting or tax records, and they do not exempt you from your legal financial record-keeping obligations.</p>
  <p>Any legislative information shown in the app (tax, accounting, cosmetics-related, or otherwise — including legislative updates we track and display in the "Legislation & consultants" tab) is <strong>strictly informational</strong>: it is an indicative summary, may be incomplete or superseded by later changes in the law, and <strong>does not constitute and does not replace legal, tax, accounting, or other professional advice</strong>. We do not guarantee the accuracy, timeliness, or completeness of this information. Interpreting and applying the legislation applicable to your activity (tax, accounting, cosmetics compliance, or any other regulation of your field) remains entirely your responsibility or that of your company/sole trader — the Provider assumes no liability for decisions made or consequences suffered as a result of using this information without independent professional verification.</p>

  <h2>3. The account</h2>
  <p>You need an account to use the app. You are responsible for keeping your password confidential and for activity on your account. Notify us immediately at ${esc(v.EMAIL)} if you suspect unauthorized access.</p>
  <p>At registration you declare the tax ID (CUI) of the company/sole trader on whose behalf you use the service. A company/sole trader may have only one active account — if the tax ID is already registered, a second account for the same company cannot be created.</p>
  <p>You can invite colleagues to the account ("team") — they see and edit the same data, without their own subscription. You are responsible for the access you grant.</p>

  <h2>4. Subscription and payment</h2>
  <p>Full access to the app requires a monthly subscription, paid via Stripe. The current subscription price is shown on the subscription page, before you enter payment details — that's where you confirm the exact amount you'll pay.</p>
  <p><strong>Automatic renewal.</strong> The subscription renews automatically, monthly, on the same date of the month you first subscribed, until you cancel it from your account. We do not resend a separate confirmation for each monthly renewal — the date of the first payment is the reference date for every subsequent renewal.</p>
  <p><strong>Cancellation.</strong> You can cancel at any time, from the "Account & Privacy" tab or the subscription page. Access remains active until the end of the already-paid period; we do not issue pro-rata refunds for the remaining period, except under the right of withdrawal in section 5.</p>
  <p><strong>Failed payment.</strong> If a monthly payment fails (expired card, insufficient funds, etc.), Stripe automatically retries processing per its standard policy; if the payment still fails, full app access is suspended until resolved, without deleting your data — you can resume it as soon as you reactivate payment.</p>
  <p><strong>Price changes.</strong> If we change the subscription price, we notify you at least 30 days before the new price applies to your renewal, by email or in the app; you can cancel anytime before renewal if you disagree.</p>
  <p><strong>Intro offer (first month at a reduced price).</strong> Valid once per company/sole trader (identified by tax ID) and per email address used at registration — you cannot obtain this price again by recreating the account with a different tax ID or email address than those already used for a previous subscription. <strong>The offer is available only through 10 October 2026, inclusive</strong> — after that date it no longer applies to any customer, new or existing, regardless of account registration date. See the Privacy Policy, section 3, for how long and for what purpose we keep, separately from the account itself, the minimal proof of prior use.</p>
  <p><strong>Data after cancellation.</strong> After your subscription ends, your data (recipes, stock, batches, products, photos) remains saved for <strong>30 days</strong>, with restricted access, as long as you don't resubscribe. We notify you by email the same day of cancellation, with the exact date they will be deleted — we recommend downloading a copy from "Account & Privacy" → "Download all data" if you want to keep it. If you don't resubscribe by that date, the account and all data are <strong>permanently and automatically deleted</strong>, with no possibility of recovery — see also section 3 of the Privacy Policy on the retention period. You can always delete the account sooner, manually, from the same tab.</p>

  <h2>5. Right of withdrawal (distance contracts)</h2>
  <p>If you subscribe as an individual, outside a professional activity, you have the right to withdraw from the contract within 14 days of subscribing, without giving a reason, under Romanian Emergency Ordinance (OUG) 34/2014. If you start using the service (digital content not delivered on a physical medium) before this period expires, by subscribing you confirm that you request immediate delivery and that you lose your right of withdrawal once the service has been fully provided.</p>
  <p>If you subscribe as a sole trader/company (PFA/SRL) for your cosmetics production/sales activity, OUG 34/2014 does not apply (it is a protection reserved for individual consumers) — in this case, we nonetheless offer you the same 14-day withdrawal period, voluntarily, as our own policy, not as a legal obligation.</p>

  <h2>6. Liability</h2>
  <p>The app is provided "as is". We are not liable for business, formulation, compliance (cosmetics, tax, accounting, or otherwise), or any other decisions made solely on information from the app, without professional verification. Specifically, we are not liable for how you or your company interpret, apply, or comply with the legislation applicable to your activity — including but not limited to tax, accounting, and cosmetics-product legislation — regardless of whether information about that legislation was displayed in the app. Our liability, to the extent permitted by law, is limited to the amounts you paid for the subscription in the last 12 months.</p>
  <p>The public catalog page (if you enable it) displays content chosen and entered entirely by you — business name, description, product photos and prices, links to your sales channels. You are solely responsible for the accuracy, legality, and compliance of this content, including any claim or statement about your cosmetic products (e.g. compliance with Art. 20 of Regulation (EC) 1223/2009 on permitted cosmetic-product claims). We do not verify and are not liable for content you publish on this page.</p>
  <p>The public page does not process payments or orders — it only redirects the visitor to your external sales channel (Instagram, Breslo, Etsy, your own website, or another you specify). We are not a party to any transaction, order, delivery, payment, or return carried out through that external channel and are not liable for them in any way; the contractual relationship for any sale belongs solely to you and your end customer.</p>

  <h2>7. Termination</h2>
  <p>You can close your account at any time, from the "Account & Privacy" tab. We may suspend or close accounts that violate these Terms or the law, with reasonable prior notice where possible.</p>

  <h2>8. Disputes</h2>
  <p>You can file a complaint with the Romanian National Authority for Consumer Protection (ANPC, <a href="https://anpc.ro" target="_blank" rel="noopener">anpc.ro</a>) or through the national Alternative Dispute Resolution platform (SAL, <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener">reclamatiisal.anpc.ro</a>), where you can ask an SAL entity to mediate the dispute with us. The European "ODR" platform (Online Dispute Resolution, formerly ec.europa.eu/consumers/odr) has been discontinued by the European Commission — the channels above (ANPC and SAL) are the current, correct ones at the national level.</p>

  <h2>9. Changes</h2>
  <p>We may update these Terms; we publish the new version here, with its date, and notify you of significant changes.</p>
  `;
}

function cookies(v) {
  return `
  <h1>Politica de cookie-uri</h1>
  <p class="muted">Versiunea ${esc(v.VERSIUNE)}.</p>
  <p>Herbatium folosește <strong>doar</strong> tehnologii strict necesare funcționării. Nu folosim cookie-uri de analiză, de marketing sau de urmărire (tracking). Din acest motiv nu îți cerem consimțământul printr-un banner (art. 4 alin. (5) din Legea nr. 506/2004 și art. 5 alin. (3) din Directiva 2002/58/CE).</p>
  <table>
    <tr><th>Nume</th><th>Tip</th><th>Scop</th><th>Durată</th></tr>
    <tr><td><code>formulator_token</code></td><td>cookie strict necesar (HttpOnly, Secure)</td><td>te ține autentificat</td><td>30 de zile sau până la deconectare</td></tr>
    <tr><td><code>herbatium_catalog_lang</code> / <code>herbatium_legal_lang</code></td><td>cookie strict necesar (preferință)</td><td>reține limba aleasă (RO/EN) pentru paginile publice de catalog și paginile legale</td><td>1 an</td></tr>
  </table>
  <p>Fonturile („Plus Jakarta Sans", „IBM Plex Mono") sunt găzduite direct de serverul nostru — nu se face nicio cerere către servere externe pentru a le încărca, deci nu se transmite nicio informație către terți prin acest mecanism.</p>
  <p>La plată ești redirecționat pe pagina securizată Stripe, care își folosește propriile cookie-uri pentru prevenirea fraudei, conform <a href="https://stripe.com/ro/privacy" target="_blank" rel="noopener">politicii Stripe</a>.</p>
  <p>Poți șterge oricând cookie-urile din setările browserului. Dacă ștergi <code>formulator_token</code>, vei fi deconectat.</p>
  `;
}

function cookies_en(v) {
  return `
  <h1>Cookie Policy</h1>
  <p class="muted">Version ${esc(v.VERSIUNE)}. Translated from the Romanian original.</p>
  <p>Herbatium uses <strong>only</strong> technologies that are strictly necessary for operation. We do not use analytics, marketing, or tracking cookies. For this reason we don't ask for consent via a banner (Art. 4(5) of Romanian Law 506/2004 and Art. 5(3) of Directive 2002/58/EC).</p>
  <table>
    <tr><th>Name</th><th>Type</th><th>Purpose</th><th>Duration</th></tr>
    <tr><td><code>formulator_token</code></td><td>strictly necessary cookie (HttpOnly, Secure)</td><td>keeps you signed in</td><td>30 days or until sign-out</td></tr>
    <tr><td><code>herbatium_catalog_lang</code> / <code>herbatium_legal_lang</code></td><td>strictly necessary cookie (preference)</td><td>remembers the chosen language (RO/EN) for the public catalog pages and the legal pages</td><td>1 year</td></tr>
  </table>
  <p>The fonts ("Plus Jakarta Sans", "IBM Plex Mono") are hosted directly on our server — no request is made to external servers to load them, so no information is shared with third parties through this mechanism.</p>
  <p>At checkout you're redirected to Stripe's secure page, which uses its own cookies for fraud prevention, per <a href="https://stripe.com/en-ro/privacy" target="_blank" rel="noopener">Stripe's policy</a>.</p>
  <p>You can delete cookies at any time from your browser settings. If you delete <code>formulator_token</code>, you'll be signed out.</p>
  `;
}

function dpa(v) {
  return `
  <h1>Acord de prelucrare a datelor (DPA)</h1>
  <p class="muted">Versiunea ${esc(v.VERSIUNE)}. Anexă la <a href="/legal/termeni">Termenii și condițiile</a>, conform art. 28 din Regulamentul (UE) 2016/679 (GDPR).</p>
  <div class="legalNote">Se aplică doar în măsura în care introduci în Herbatium date cu caracter personal ale unor terți — de exemplu, dacă notezi numele unei persoane fizice ca furnizor, sau dacă inviți colegi în cont. Pentru datele propriului tău cont, se aplică <a href="/legal/confidentialitate">Politica de confidențialitate</a>.</p>

  <h2>1. Părți și roluri</h2>
  <ul>
    <li><strong>Operatorul</strong>: utilizatorul care are un cont Herbatium și, opțional, introduce în aplicație date ale unor terți (furnizori, colegi) („Clientul").</li>
    <li><strong>Persoana împuternicită</strong>: ${esc(v.FIRMA)}, CUI ${esc(v.CUI)}, ${esc(v.ADRESA)} („Furnizorul").</li>
  </ul>

  <h2>2. Obiectul și natura prelucrării</h2>
  <table>
    <tr><td>Obiect</td><td>găzduirea și afișarea rețetelor, stocului, loturilor și produselor; trimiterea de notificări e-mail opționale</td></tr>
    <tr><td>Durată</td><td>pe durata contului Clientului</td></tr>
    <tr><td>Natura</td><td>stocare, structurare, consultare, transmitere către subîmputerniciți, ștergere</td></tr>
    <tr><td>Categorii de persoane vizate</td><td>furnizori persoane fizice, colegi invitați în cont</td></tr>
    <tr><td>Categorii de date</td><td>nume, e-mail, date de contact introduse de Client</td></tr>
    <tr><td>Date sensibile</td><td>nu se prelucrează — Clientul se obligă să nu introducă date din categoriile speciale (art. 9 GDPR) sau CNP-uri</td></tr>
  </table>

  <h2>3. Obligațiile Furnizorului</h2>
  <p>Furnizorul prelucrează datele doar pe baza folosirii aplicației de către Client, asigură confidențialitatea personalului cu acces, folosește subîmputerniciții listați în <a href="/legal/confidentialitate">Politica de confidențialitate</a>, notifică Clientul în cel mult 48 de ore de la constatarea unei breșe care îi afectează datele, asistă Clientul la cererile persoanelor vizate (export/ștergere din aplicație) și, la încetarea contului, șterge datele conform secțiunii de retenție.</p>

  <h2>4. Obligațiile Clientului</h2>
  <p>Clientul răspunde de legalitatea introducerii datelor terților în aplicație (informare, temei legal) și se obligă să nu introducă date din categorii speciale.</p>
  `;
}

function dpa_en(v) {
  return `
  <h1>Data Processing Agreement (DPA)</h1>
  <p class="muted">Version ${esc(v.VERSIUNE)}. Annex to the <a href="/legal/termeni?lang=en">Terms and Conditions</a>, under Art. 28 of Regulation (EU) 2016/679 (GDPR). Translated from the Romanian original.</p>
  <div class="legalNote">Applies only to the extent you enter personal data of third parties into Herbatium — for example, if you note an individual's name as a supplier, or invite colleagues to the account. For your own account's data, the <a href="/legal/confidentialitate?lang=en">Privacy Policy</a> applies.</div>

  <h2>1. Parties and roles</h2>
  <ul>
    <li><strong>Controller</strong>: the user who has a Herbatium account and, optionally, enters third parties' data into the app (suppliers, colleagues) (the "Client").</li>
    <li><strong>Processor</strong>: ${esc(v.FIRMA)}, tax ID (CUI) ${esc(v.CUI)}, ${esc(v.ADRESA)} (the "Provider").</li>
  </ul>

  <h2>2. Subject and nature of the processing</h2>
  <table>
    <tr><td>Subject</td><td>hosting and displaying recipes, stock, batches, and products; sending optional email notifications</td></tr>
    <tr><td>Duration</td><td>for the duration of the Client's account</td></tr>
    <tr><td>Nature</td><td>storage, structuring, retrieval, transfer to sub-processors, deletion</td></tr>
    <tr><td>Categories of data subjects</td><td>individual suppliers, colleagues invited to the account</td></tr>
    <tr><td>Categories of data</td><td>name, email, contact details entered by the Client</td></tr>
    <tr><td>Sensitive data</td><td>not processed — the Client undertakes not to enter special-category data (Art. 9 GDPR) or national ID numbers</td></tr>
  </table>

  <h2>3. Provider's obligations</h2>
  <p>The Provider processes data only on the basis of the Client's use of the app, ensures the confidentiality of staff with access, uses the sub-processors listed in the <a href="/legal/confidentialitate?lang=en">Privacy Policy</a>, notifies the Client within 48 hours of discovering a breach affecting their data, assists the Client with data-subject requests (export/deletion from the app), and, upon account termination, deletes the data per the retention section.</p>

  <h2>4. Client's obligations</h2>
  <p>The Client is responsible for the lawfulness of entering third parties' data into the app (notice, legal basis) and undertakes not to enter special-category data.</p>
  `;
}

// Identitatea legală a firmei (aceleași COMPANY_* din .env ca paginile de
// mai sus), expusă ca JSON pentru a fi reutilizată de client în textul
// generat "Declarație de Conformitate UE" din tabul „Ambalaje” — aceeași
// sursă unică (legalConfig.js), nu date introduse separat. Public, la fel
// ca restul paginilor din acest router: informația e oricum vizibilă pe
// paginile legale publice.
router.get("/company-info.json", (req, res) => {
  const v = companyVars();
  res.json({ firma: v.FIRMA, cui: v.CUI, adresa: v.ADRESA, email: v.EMAIL, brand: v.BRAND });
});

router.get("/:slug", (req, res) => {
  const v = companyVars();
  const lang = resolveLang(req, res);
  const pages = lang === "en"
    ? { confidentialitate: () => confidentialitate_en(v), termeni: () => termeni_en(v), cookies: () => cookies_en(v), dpa: () => dpa_en(v) }
    : { confidentialitate: () => confidentialitate(v), termeni: () => termeni(v), cookies: () => cookies(v), dpa: () => dpa(v) };
  const fn = pages[req.params.slug];
  const nav = NAV_LABELS[lang] || NAV_LABELS.ro;
  if (!fn) return res.status(404).send(nav.notFound);
  const titles = { confidentialitate: nav.privacy, termeni: nav.terms, cookies: nav.cookies, dpa: nav.dpa };
  res.send(shell(titles[req.params.slug], fn(), lang, req));
});

module.exports = router;
