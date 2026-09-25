// Politica de retenție a datelor (art. 5 alin. (1) lit. e) GDPR — limitarea
// stocării: datele nu se păstrează "cât mai poți", ci doar atât cât e
// necesar). Regulă: cât timp abonamentul e activ, datele rămân; dacă
// abonamentul se anulează și nu se reactivează, contul și toate datele
// (rețete, stoc, loturi, produse, poze) sunt șterse definitiv și automat
// după RETENTION_DAYS zile — utilizatorul e anunțat pe e-mail chiar din
// ziua anulării, cu data exactă la care se șterg, ca să aibă timp să le
// exporte sau să se reaboneze.
const fs = require("fs");
const path = require("path");
const prisma = require("./db");
const { sendEmail } = require("./notify");

const RETENTION_DAYS = 30; // 1 lună de la anularea abonamentului
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

function deletionDateFrom(fromDate) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + RETENTION_DAYS);
  return d;
}

// Trimis o singură dată, sincron cu evenimentul de anulare din Stripe (vezi
// billing.js, webhook customer.subscription.deleted) — nu așteptăm până
// aproape de termen, ca utilizatorul să aibă tot intervalul la dispoziție.
async function sendCancellationRetentionNotice(user) {
  if (!user || !user.email) return;
  const delDate = deletionDateFrom(new Date());
  const dataStr = delDate.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
  const html = `
    <h2 style="font-family:sans-serif">Abonamentul tău Herbatium s-a încheiat</h2>
    <p style="font-family:sans-serif">Contul tău rămâne în bază, cu acces restricționat, timp de ${RETENTION_DAYS} de zile. Dacă nu te reabonezi până atunci, rețetele, loturile, stocul, produsele și pozele tale vor fi <strong>șterse definitiv pe ${dataStr}</strong>, conform politicii de retenție din Politica de confidențialitate — nu vom mai putea recupera nimic după această dată.</p>
    <p style="font-family:sans-serif">Recomandăm să îți descarci o copie a datelor acum, din tab-ul „Cont &amp; confidențialitate” → „Descarcă toate datele” (fișier JSON).</p>
    <p style="font-family:sans-serif">Dacă te reabonezi înainte de ${dataStr}, nu se șterge nimic și îți continui activitatea normal, cu toate datele intacte.</p>
    <p style="font-family:sans-serif;color:#888;font-size:12px">Trimis automat de Herbatium la anularea abonamentului.</p>
  `;
  await sendEmail(
    user.email,
    `Datele tale Herbatium vor fi șterse pe ${dataStr}, dacă nu reactivezi abonamentul`,
    html
  );
}

// Rulează o dată pe zi: șterge definitiv conturile al căror abonament e
// anulat de cel puțin RETENTION_DAYS zile, fără reabonare între timp.
// Conturile de echipă (teamOwnerId) nu au abonament/date proprii — nu sunt
// vizate aici; se șterg automat (SetNull) când contul principal e șters, dar
// rămân utilizabile dacă titularul de cont principal se reabonează.
async function runRetentionCleanup() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const due = await prisma.user.findMany({
    where: {
      subscriptionStatus: "canceled",
      canceledAt: { not: null, lte: cutoff },
      teamOwnerId: null,
      isAdmin: false,
    },
  });

  for (const user of due) {
    try {
      // Feedback-ul trimis de acest utilizator rămâne (util pentru dezvoltarea
      // aplicației), dar se anonimizează — nu ținem un e-mail viu legat de un
      // cont șters. Trebuie făcut înainte de prisma.user.delete (userId
      // devine oricum null automat, prin onDelete: SetNull, dar email-ul nu).
      await prisma.feedback.updateMany({
        where: { userId: user.id },
        data: { userId: null, email: "(cont șters)" },
      });
      // UserData e legat cu onDelete: Cascade — se șterge automat odată cu User.
      await prisma.user.delete({ where: { id: user.id } });
      const dir = path.join(UPLOAD_ROOT, user.id);
      fs.rm(dir, { recursive: true, force: true }, () => {});
      console.log(
        `Retenție: cont șters definitiv (abonament anulat de peste ${RETENTION_DAYS} zile): ${user.email}`
      );
    } catch (e) {
      console.error(`Retenție: ștergerea contului ${user.email} a eșuat:`, e.message);
    }
  }
}

function scheduleRetentionCleanup(hourLocal) {
  const hour = typeof hourLocal === "number" ? hourLocal : 4;
  function msUntilNext() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }
  function tick() {
    runRetentionCleanup().catch((e) => console.error("Curățare retenție eșuată:", e.message));
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }
  setTimeout(tick, msUntilNext());
}

module.exports = {
  RETENTION_DAYS,
  runRetentionCleanup,
  scheduleRetentionCleanup,
  sendCancellationRetentionNotice,
};
