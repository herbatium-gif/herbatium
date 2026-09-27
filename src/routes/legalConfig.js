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
// Verificare pentru panoul de admin (GET /api/admin/legal-status): ce câmpuri
// COMPANY_* NU sunt încă setate în .env/Railway — adică încă arată
// placeholder-ul vizibil de mai sus în loc de o valoare reală. Fără asta,
// paginile publice /legal/termeni și /legal/confidentialitate nu identifică
// real operatorul (art. 13 GDPR, obligatoriu). COMPANY_REG e exclus din
// verificare — e opțional, doar pentru SRL (o firmă PFA nu are număr de
// Registrul Comerțului, deci ar apărea mereu ca "lipsă", fals).
function missingCompanyFields() {
  const v = companyVars();
  const checks = [
    { key: "COMPANY_NAME", label: "Denumirea firmei/PFA", value: v.FIRMA },
    { key: "COMPANY_CUI", label: "CUI/CIF", value: v.CUI },
    { key: "COMPANY_ADDRESS", label: "Adresa sediului", value: v.ADRESA },
    { key: "COMPANY_PHONE", label: "Telefon de contact", value: v.TELEFON },
    { key: "COMPANY_EMAIL", label: "E-mail de contact", value: v.EMAIL },
    { key: "COMPANY_GDPR_EMAIL", label: "E-mail GDPR", value: v.EMAIL_GDPR },
  ];
  return checks
    .filter((c) => /^\[completează|@exemplu\.ro$/.test(c.value))
    .map((c) => ({ key: c.key, label: c.label }));
}

module.exports = { companyVars, missingCompanyFields };
