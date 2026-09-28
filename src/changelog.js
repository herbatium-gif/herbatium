// Lista de noutăți ale aplicației, afișată direct utilizatorilor (tab-ul
// "Noutăți" din app.html) și folosită și pentru emailul opțional trimis din
// panoul de admin. Mesaje SIMPLE, fără detalii tehnice — utilizatorul final
// nu trebuie să știe ce fișier de cod s-a schimbat, doar ce înseamnă pentru
// el/ea. Fiecare intrare nouă se adaugă la finalul listei, cu un `version`
// mai mare decât precedentul (numerotare simplă, crescătoare — nu ține loc
// de versiune de aplicație/semver).
const CHANGELOG = [
  {
    version: 1,
    date: "2026-09-25",
    title: "Actualizări de azi",
    message:
      "Poți acum exporta stocul și rețetele direct în Excel, nu doar CSV. Prețul abonamentului e 170 lei/lună, cu prima lună la 99 lei pentru clienți noi. Înregistrarea cere acum CUI-ul firmei/PFA, pentru conturi mai sigure. Dacă anulezi abonamentul, datele tale se păstrează 30 de zile înainte de ștergere automată — te anunțăm pe e-mail. Și tab-ul ăsta de noutăți e nou — îl vei găsi aici de fiecare dată când schimbăm ceva important.",
  },
  {
    version: 2,
    date: "2026-09-28",
    title: "Dosar PIF, Ambalaje (PPWR) și preț nou",
    message:
      "Două tab-uri noi: „Dosar PIF” (rapoarte de siguranță, dovezi claims etc., conform Art. 11 din Regulamentul (CE) 1223/2009) și „Ambalaje” (declarație de conformitate PPWR, conform Regulamentului (UE) 2025/40, aplicabil din 12 august 2026) — găsești detalii despre legislație direct în fiecare tab. Am adăugat și un comutator de limbă RO/EN, vizibil în bara de sus. Prețul abonamentului este acum 200 lei/lună, cu prima lună la 99 lei pentru clienți noi.",
  },
];

const CURRENT_VERSION = CHANGELOG[CHANGELOG.length - 1].version;

module.exports = { CHANGELOG, CURRENT_VERSION };
