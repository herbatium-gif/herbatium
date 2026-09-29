// Prospecți de vânzare (leads) — gestionare DOAR pentru admin. Complet
// separat de clienții reali (model User): un lead nu are cont, nu se
// autentifică, nu atinge datele vreunui client. Scop: să ai lista de firme
// de contactat pentru abonamente, cu status de outreach, direct în aplicație,
// în loc de un fișier extern.
const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const prisma = require("../db");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Express 4 NU redirecționează automat o respingere (throw) dintr-un handler
// async către middleware-ul de erori — ajunge la "unhandled promise
// rejection", care în Node 15+ OPREȘTE tot procesul (toată aplicația, pentru
// toți utilizatorii, nu doar pentru admin). Găsit la audit: un admin care
// adaugă manual un lead cu un nume deja existent (POST /) arunca exact așa o
// eroare (constrângerea @unique pe "nume") și pica tot serverul — confirmat
// reproductibil local. Acest wrapper prinde orice eroare dintr-un handler
// async și o pasează la next(err), ca handler-ul de erori (local, mai jos,
// sau cel global din src/index.js) să răspundă curat, fără să afecteze
// restul aplicației.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const STARI_VALIDE = ["nou", "contactat", "interesat", "client", "refuzat"];

// Coloanele fixe, în această ordine, pentru import/export CSV și Excel —
// aceleași peste tot, ca fișierele exportate de aici să poată fi reimportate
// direct, fără nicio adaptare manuală.
const COLOANE = ["nume", "ceVinde", "oras", "contact", "tipContact", "sursa", "verificare", "potrivire"];
const COLOANE_ANTET = ["Nume", "Ce vinde", "Oraș", "Contact", "Tip contact", "Sursă", "Verificare", "Potrivire"];

// Import în memorie (nu scriem fișierul pe disc — e citit o singură dată,
// direct din buffer, apoi aruncat). Limită 5MB, suficient pentru orice listă
// de leads rezonabilă; blochează orice altceva decât .xlsx la nivel de tip.
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okType = file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    cb(okType ? null : new Error("tip_fisier_neacceptat"), okType);
  },
});

// Upsert comun — folosit atât de /import (JSON, din CSV parsat în browser)
// cât și de /import-excel (.xlsx parsat aici pe server). Nu suprascrie
// "stare"/"notite" la un lead existent — sunt lucrul tău de outreach.
// Upsert real, atomic — posibil datorită @@unique([nume]) din schema (vezi
// prisma/schema.prisma). Elimină condiția de cursă a variantei anterioare
// (findFirst + create/update separate): două importuri simultane cu același
// nume nu mai pot crea două leaduri duplicate.
// Coerciție sigură la string, cu limită de lungime — găsit la audit: fără
// asta, un câmp trimis ca obiect/array în JSON (POST /import) sau o valoare
// aberant de lungă putea ajunge necontrolat în baza de date (sau, înainte de
// fix-ul asyncHandler de mai sus, chiar să arunce o eroare care pica tot
// serverul). Un obiect/array e ignorat (devine null) în loc să fie forțat
// la "[object Object]"; 500 caractere e generos pentru orice câmp de-aici
// (nume de firmă, notă, URL sursă), fără să limiteze folosirea normală.
function strOrNull(v, maxLen = 500) {
  if (v == null || typeof v === "object") return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function upsertLeads(rawList) {
  let created = 0;
  let updated = 0;
  for (const raw of rawList) {
    const nume = raw ? strOrNull(raw.nume, 300) : null;
    if (!nume) continue;
    const data = {
      ceVinde: strOrNull(raw.ceVinde),
      oras: strOrNull(raw.oras),
      contact: strOrNull(raw.contact),
      tipContact: strOrNull(raw.tipContact),
      sursa: strOrNull(raw.sursa),
      verificare: strOrNull(raw.verificare),
      potrivire: strOrNull(raw.potrivire),
    };
    const existing = await prisma.lead.findUnique({ where: { nume } });
    await prisma.lead.upsert({
      where: { nume },
      update: data, // nu suprascrie "stare"/"notite" — sunt lucrul TĂU de outreach
      create: { nume, ...data },
    });
    if (existing) updated += 1;
    else created += 1;
  }
  return { created, updated };
}

// Protecție împotriva CSV/Excel formula injection (CWE-1236): dacă o valoare
// începe cu =, +, -, @, TAB sau CR, Excel/LibreOffice o poate interpreta ca
// formulă la deschidere (ex. "=HYPERLINK(...)" sau un DDE payload), nu ca
// text simplu — un risc real dacă datele vin din cercetare web/text liber,
// nu doar introduse manual de tine. Prefixăm cu un apostrof: Excel îl ignoră
// vizual, dar forțează tipul "text", nu "formulă".
function neutralizeFormula(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function csvEscape(v) {
  const s = neutralizeFormula(v == null ? "" : String(v));
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get("/", asyncHandler(async (req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ leads });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { nume, ceVinde, oras, contact, tipContact, sursa, verificare, potrivire, notite } = req.body || {};
  if (!nume || !String(nume).trim()) {
    return res.status(400).json({ error: "nume_required" });
  }
  let lead;
  try {
    lead = await prisma.lead.create({
      data: {
        nume: strOrNull(nume, 300),
        ceVinde: strOrNull(ceVinde),
        oras: strOrNull(oras),
        contact: strOrNull(contact),
        tipContact: strOrNull(tipContact),
        sursa: strOrNull(sursa),
        verificare: strOrNull(verificare),
        potrivire: strOrNull(potrivire),
        notite: strOrNull(notite, 5000),
      },
    });
  } catch (e) {
    // P2002 = constrângerea @unique pe "nume" (vezi schema.prisma) — există
    // deja un lead cu exact acest nume. Eroare de request al clientului
    // (409 Conflict), nu un bug de server — prinsă aici explicit, ca să nu
    // ajungă ca 500 generic la handler-ul de erori.
    if (e && e.code === "P2002") {
      return res.status(409).json({ error: "nume_deja_existent" });
    }
    throw e;
  }
  res.json({ lead });
}));

// Import în masă — acceptă un array de obiecte (din CSV parsat în frontend
// sau lipit ca JSON). Face upsert după "nume" (dacă există deja un lead cu
// exact același nume, îi actualizează datele în loc să-l dubleze) — util
// când reimporți o listă actualizată fără să pierzi statusul de outreach
// deja setat manual.
// Limită pe numărul de rânduri per import — atât pentru /import (JSON) cât
// și pentru /import-excel de mai jos. 20.000 e mult peste orice listă
// realistă de prospecți; protejează totuși împotriva unui fișier care, deși
// sub limita de 5MB, s-ar putea despacheta/expanda în multe mii de rânduri
// și bloca bucla de upsert mult timp (fiecare rând face 2 interogări DB).
const MAX_RANDURI_IMPORT = 20000;

router.post("/import", asyncHandler(async (req, res) => {
  const { leads } = req.body || {};
  if (!Array.isArray(leads) || !leads.length) {
    return res.status(400).json({ error: "leads_array_required" });
  }
  if (leads.length > MAX_RANDURI_IMPORT) {
    return res.status(400).json({ error: "prea_multe_randuri" });
  }
  const result = await upsertLeads(leads);
  res.json(result);
}));

// Import dintr-un fișier .xlsx — aceleași 8 coloane, în aceeași ordine, cu
// prima linie ca antet (ignorată la citire). Citește doar prima foaie din
// primul fișier atașat, nu scrie nimic pe disc.
router.post("/import-excel", uploadExcel.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "fisier_lipsa" });
  }
  let workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ error: "fisier_ilizibil" });
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return res.status(400).json({ error: "fisier_fara_foi" });
  }
  // Limită pe numărul de rânduri citite — deși fișierul e limitat la 5MB
  // (multer), conținutul despachetat/citit de ExcelJS (rânduri, coloane,
  // șiruri partajate) poate fi mult mai mare — protecție găsită la audit
  // împotriva unui fișier care ar bloca mult timp bucla de mai jos.
  if (sheet.rowCount > MAX_RANDURI_IMPORT + 1) {
    return res.status(400).json({ error: "prea_multe_randuri" });
  }
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // antet
    if (rows.length >= MAX_RANDURI_IMPORT) return;
    const get = (i) => {
      const cell = row.getCell(i);
      const v = cell && cell.value;
      if (v == null) return "";
      if (typeof v === "object") {
        // Celulă cu formulă — ExcelJS o reprezintă ca {formula, result, ...},
        // nu ca text simplu; fără acest caz, ar fi scris literalmente
        // "[object Object]" în baza de date. Preferăm rezultatul calculat.
        if ("formula" in v) return String(v.result == null ? "" : v.result).trim();
        if (v.text) return String(v.text).trim(); // rich text / hyperlink
        if (v.richText) return v.richText.map((r) => r.text || "").join("").trim();
      }
      return String(v).trim();
    };
    rows.push({
      nume: get(1),
      ceVinde: get(2),
      oras: get(3),
      contact: get(4),
      tipContact: get(5),
      sursa: get(6),
      verificare: get(7),
      potrivire: get(8),
    });
  });
  if (!rows.length) {
    return res.status(400).json({ error: "fisier_fara_date" });
  }
  const result = await upsertLeads(rows);
  res.json(result);
}));

// Export CSV — exact formatul acceptat de import (paste CSV), ca un
// export/import repetat să fie un ciclu complet, fără pierdere de date
// (mai puțin stare/notițe, care nu sunt parte din formatul de import CSV
// de mai sus — le include totuși ca 2 coloane suplimentare la final, utile
// pentru arhivare/backup, ignorate la reimport dacă le lași acolo).
router.get("/export.csv", asyncHandler(async (req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: { nume: "asc" } });
  const header = [...COLOANE_ANTET, "Stare", "Notițe"];
  const lines = [header.map(csvEscape).join(",")];
  for (const l of leads) {
    lines.push(
      [l.nume, l.ceVinde, l.oras, l.contact, l.tipContact, l.sursa, l.verificare, l.potrivire, l.stare, l.notite]
        .map(csvEscape)
        .join(",")
    );
  }
  const csv = "﻿" + lines.join("\r\n"); // BOM — ca diacriticele să apară corect la deschidere directă în Excel
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="herbatium-leads-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(csv);
}));

// Export Excel — aceleași date, ca fișier .xlsx cu antet formatat, gata de
// deschis direct sau de reimportat cu butonul de import Excel de mai sus.
router.get("/export.xlsx", asyncHandler(async (req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: { nume: "asc" } });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leads");
  sheet.columns = [
    { header: "Nume", width: 28 },
    { header: "Ce vinde", width: 32 },
    { header: "Oraș", width: 16 },
    { header: "Contact", width: 30 },
    { header: "Tip contact", width: 14 },
    { header: "Sursă", width: 26 },
    { header: "Verificare", width: 20 },
    { header: "Potrivire", width: 30 },
    { header: "Stare", width: 14 },
    { header: "Notițe", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F9D5A" } };
  // ExcelJS scrie valorile ca text explicit (nu ca formule) și nu s-ar
  // auto-executa la deschidere directă în Excel — dar aplicăm totuși aceeași
  // neutralizare ca la CSV, ca protecție suplimentară pentru unelte terțe
  // (LibreOffice, Google Sheets la import) care uneori reinterpretează.
  const nf = (v) => (v == null ? v : neutralizeFormula(String(v)));
  for (const l of leads) {
    sheet.addRow([nf(l.nume), nf(l.ceVinde), nf(l.oras), nf(l.contact), nf(l.tipContact), nf(l.sursa), nf(l.verificare), nf(l.potrivire), nf(l.stare), nf(l.notite)]);
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="herbatium-leads-${new Date().toISOString().slice(0,10)}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const { stare, notite } = req.body || {};
  const data = {};
  if (stare !== undefined) {
    if (!STARI_VALIDE.includes(stare)) {
      return res.status(400).json({ error: "stare_invalida" });
    }
    data.stare = stare;
  }
  if (notite !== undefined) data.notite = strOrNull(notite, 5000);
  if (!Object.keys(data).length) {
    return res.status(400).json({ error: "nimic_de_actualizat" });
  }
  try {
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data });
    res.json({ lead });
  } catch (e) {
    // P2025 = Prisma "record to update not found" — singurul caz care chiar
    // înseamnă "lead inexistent". Orice altă eroare (ex. o problemă
    // temporară de conexiune la baza de date) NU mai e ascunsă sub un 404
    // fals — găsit la audit: try/catch-ul original prindea orice eroare și
    // răspundea mereu 404, chiar și pentru erori reale de server.
    if (e && e.code === "P2025") {
      return res.status(404).json({ error: "lead_negasit" });
    }
    throw e;
  }
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e && e.code === "P2025") {
      return res.status(404).json({ error: "lead_negasit" });
    }
    throw e;
  }
}));

// Handler de erori local — aplicația Herbatium nu are un handler global (vezi
// src/index.js), deci fără asta o eroare de la multer (tip de fișier greșit,
// fișier prea mare) ar scăpa mai departe ca pagină HTML cu stack trace brut,
// în loc de un JSON curat. Prins aici, nu afectează restul aplicației.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err && err.message === "tip_fisier_neacceptat") {
    return res.status(400).json({ error: "tip_fisier_neacceptat" });
  }
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "fisier_prea_mare" });
  }
  console.error("[leads]", err);
  res.status(500).json({ error: "eroare_server" });
});

module.exports = router;
