// Pagini legale publice: Termeni, Confidențialitate, Cookie-uri, Acord de
// prelucrare a datelor (DPA). Conținutul e un MODEL — nu e aviz juridic.
// Înainte de lansare, dă-l spre verificare unui avocat/consultant GDPR și
// completează COMPANY_* în .env (altfel apar placeholder-e vizibile [...]).
const express = require("express");
const { companyVars } = require("../legalConfig");

const router = express.Router();

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function shell(title, bodyHtml) {
  const v = companyVars();
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Herbatium</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap">
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
  .legalTop{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line);max-width:760px;margin:0 auto}
  .legalTop a{color:var(--ink);font-weight:700;text-decoration:none}
  .legalFoot{max-width:760px;margin:0 auto;padding:18px 20px;border-top:1px solid var(--line);font-size:12px;color:var(--ink-soft)}
  .legalFoot nav{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
  .legalFoot a{color:var(--ink-soft)}
</style>
</head>
<body>
<div class="legalTop"><a href="/">Herbatium</a><a href="/login.html" class="muted" style="font-weight:500">Intră în cont</a></div>
<div class="legalWrap">
${bodyHtml}
</div>
<div class="legalFoot">
  <div><strong>${esc(v.FIRMA)}</strong> · CUI ${esc(v.CUI)} · ${esc(v.ADRESA)} · <a href="mailto:${esc(v.EMAIL)}">${esc(v.EMAIL)}</a></div>
  <nav>
    <a href="/legal/termeni">Termeni și condiții</a>
    <a href="/legal/confidentialitate">Confidențialitate</a>
    <a href="/legal/cookies">Cookie-uri</a>
    <a href="/legal/dpa">Acord de prelucrare (DPA)</a>
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
    <tr><td>Railway Corporation</td><td>serverul aplicației și baza de date (PostgreSQL)</td><td>SUA — us-west1 (California)</td></tr>
    <tr><td>Stripe Payments Europe Ltd.</td><td>procesarea plăților cu cardul / abonamentul</td><td>UE (Irlanda), cu posibile transferuri către Stripe Inc. (SUA) pe bază de garanții adecvate</td></tr>
    <tr><td>Resend (dacă activezi notificările e-mail)</td><td>trimite e-mailul de rezumat zilnic</td><td>[completează — verifică regiunea de procesare a furnizorului]</td></tr>
    <tr><td>Google Fonts</td><td>livrează fonturile folosite în interfață (adresa IP e trimisă către Google la încărcarea paginii)</td><td>SUA/global — vezi <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">politica Google</a></td></tr>
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

  <h2>7. Încetare</h2>
  <p>Poți închide contul oricând, din tab-ul „Cont & confidențialitate". Putem suspenda sau închide conturi care încalcă acești Termeni sau legea, cu notificare prealabilă rezonabilă acolo unde e posibil.</p>

  <h2>8. Litigii</h2>
  <p>Poți depune o reclamație la Autoritatea Națională pentru Protecția Consumatorilor (ANPC, <a href="https://anpc.ro" target="_blank" rel="noopener">anpc.ro</a>) sau prin platforma națională de Soluționare Alternativă a Litigiilor (SAL, <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener">reclamatiisal.anpc.ro</a>), unde poți alerta o entitate SAL să medieze disputa cu noi. Platforma europeană „SOL" (Soluționarea online a litigiilor, fostă ec.europa.eu/consumers/odr) a fost desființată de Comisia Europeană — canalele de mai sus (ANPC și SAL) sunt cele actuale și corecte, la nivel național.</p>

  <h2>9. Modificări</h2>
  <p>Putem actualiza acești Termeni; publicăm noua versiune aici, cu data ei, și te anunțăm pentru schimbări importante.</p>
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
  </table>
  <p>Fonturile („Plus Jakarta Sans", „IBM Plex Mono") sunt încărcate de la Google Fonts — la deschiderea paginii, browserul tău face o cerere către serverele Google, care primesc adresa ta IP. Nu setăm noi cookie-uri prin acest serviciu; consultă <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">politica de confidențialitate Google</a> pentru detalii despre prelucrarea lor.</p>
  <p>La plată ești redirecționat pe pagina securizată Stripe, care își folosește propriile cookie-uri pentru prevenirea fraudei, conform <a href="https://stripe.com/ro/privacy" target="_blank" rel="noopener">politicii Stripe</a>.</p>
  <p>Poți șterge oricând cookie-urile din setările browserului. Dacă ștergi <code>formulator_token</code>, vei fi deconectat.</p>
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

router.get("/:slug", (req, res) => {
  const v = companyVars();
  const pages = { confidentialitate: () => confidentialitate(v), termeni: () => termeni(v), cookies: () => cookies(v), dpa: () => dpa(v) };
  const fn = pages[req.params.slug];
  if (!fn) return res.status(404).send("Pagină legală inexistentă.");
  res.send(shell(req.params.slug, fn()));
});

module.exports = router;
