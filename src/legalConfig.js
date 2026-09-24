// Datele firmei, citite din .env, folosite pe paginile legale (/legal/...)
// și în registrul GDPR. Completează COMPANY_* în .env înainte de lansare —
// fără ele, paginile afișează placeholder-ele de mai jos (vizibile, ca să nu
// publici din greșeală o pagină legală necompletată).
function companyVars() {
  return {
    FIRMA: process.env.COMPANY_NAME || "[completează: denumirea firmei/PFA]",
    CUI: process.env.COMPANY_CUI || "[completează: CUI/CIF]",
    REG: process.env.COMPANY_REG || "[completează: nr. Registrul Comerțului]",
    ADRESA: process.env.COMPANY_ADDRESS || "[completează: adresa sediului]",
    EMAIL: process.env.COMPANY_EMAIL || "contact@exemplu.ro",
    EMAIL_GDPR: process.env.COMPANY_GDPR_EMAIL || process.env.COMPANY_EMAIL || "gdpr@exemplu.ro",
    TELEFON: process.env.COMPANY_PHONE || "[completează: telefon]",
    URL: process.env.APP_URL || "",
    VERSIUNE: process.env.LEGAL_VERSION || "1.0",
    BRAND: "Herbatium",
  };
}
module.exports = { companyVars };
