/*
 * Herbatium — traducere RO/EN, partajată de toate paginile.
 *
 * Cum funcționează:
 *  - DICT.ro / DICT.en sunt dicționare "cheie -> text". Cheile sunt organizate
 *    pe secțiuni (ex. "login.title", "app.tabs.retete") ca să nu se ciocnească
 *    între pagini.
 *  - t(key, vars) întoarce textul din limba curentă; dacă lipsește o cheie în
 *    EN, cade automat pe varianta RO (niciodată textul cheii brute către
 *    utilizator, dar afișăm un avertisment în consolă ca să prindem lacunele).
 *  - Limba aleasă se ține în localStorage (per-browser/dispozitiv, nu per-cont
 *    — o schimbare pe telefon nu se vede automat pe laptop). Aceasta e o
 *    alegere deliberată de simplitate/siguranță: nu adaugă nimic în baza de
 *    date și nu poate strica sincronizarea datelor existente.
 *  - Paginile statice (login/register/admin/etc.) marchează textul cu
 *    data-i18n="cheie" și applyStaticI18n() îl completează la încărcare.
 *  - app.html (SPA) apelează t('cheie') direct în funcțiile care generează
 *    HTML — vezi acolo.
 */
(function(){
  const STORAGE_KEY = "herbatium_lang";

  const DICT = { ro: {}, en: {} };

  function register(lang, entries){
    Object.assign(DICT[lang], entries);
  }

  function getLang(){
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === "en" ? "en" : "ro";
    } catch(e){ return "ro"; }
  }

  function setLang(lang){
    try { localStorage.setItem(STORAGE_KEY, lang === "en" ? "en" : "ro"); } catch(e){}
    location.reload();
  }

  function t(key, vars){
    const lang = getLang();
    let str = DICT[lang][key];
    if (str == null) {
      str = DICT.ro[key];
      if (str == null) {
        console.warn("[i18n] cheie lipsă:", key);
        return key;
      }
    }
    if (vars) {
      Object.keys(vars).forEach(k => {
        str = str.split("{" + k + "}").join(vars[k]);
      });
    }
    return str;
  }

  // Notă: butoanele folosesc data-applang (nu data-lang) — app.html are deja,
  // independent, un comutator RO/EN pentru LIMBA ETICHETEI printabile a unui
  // produs (stare separată, per-rețetă: state.labelLang), care folosește
  // atributul data-lang. Cele două nu au nicio legătură — data-applang e
  // limba întregii interfețe, data-lang e doar textul etichetei unui produs
  // — și trebuiau ținute pe nume diferite ca să nu se suprascrie reciproc.
  function langToggleHtml(extraClass){
    const lang = getLang();
    return `<div class="langToggle${extraClass ? " " + extraClass : ""}" role="group" aria-label="Limbă / Language">
      <button type="button" class="langBtn${lang === "ro" ? " active" : ""}" data-applang="ro">RO</button>
      <button type="button" class="langBtn${lang === "en" ? " active" : ""}" data-applang="en">EN</button>
    </div>`;
  }

  function wireLangToggle(root){
    (root || document).querySelectorAll("[data-applang]").forEach(btn=>{
      btn.onclick = () => setLang(btn.dataset.applang);
    });
  }

  // Pentru pagini statice (nu SPA): completează orice element marcat cu
  // data-i18n / data-i18n-placeholder / data-i18n-html / data-i18n-title.
  function applyStaticI18n(root){
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(el=>{
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    scope.querySelectorAll("[data-i18n-html]").forEach(el=>{
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach(el=>{
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    document.documentElement.lang = getLang();
    scope.querySelectorAll("[data-applang]").forEach(btn=>{
      btn.onclick = () => setLang(btn.dataset.applang);
    });
  }

  // Stil comun pentru butoanele RO/EN — injectat o singură dată, ca fiecare
  // pagină să nu trebuiască să-și copieze propriul CSS pentru asta.
  const style = document.createElement("style");
  style.textContent = `
    .langToggle{display:inline-flex;border:1px solid var(--line,#3a4152);border-radius:7px;overflow:hidden;flex:none}
    .langToggle .langBtn{padding:5px 11px;font-size:12.5px;font-weight:600;background:transparent;color:inherit;border:none;cursor:pointer;opacity:.55}
    .langToggle .langBtn.active{opacity:1;background:var(--accent,#2f5233);color:var(--accent-ink,#fff)}
    .langToggle .langBtn:not(.active):hover{opacity:.85}
  `;
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  if (document.readyState !== "loading") document.head.appendChild(style);

  window.I18N = { t, getLang, setLang, langToggleHtml, wireLangToggle, applyStaticI18n, register, DICT };
})();
