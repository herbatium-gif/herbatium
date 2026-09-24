// Creează/actualizează automat contul de administrator al platformei, din
// variabilele ADMIN_EMAIL și ADMIN_PASSWORD din .env. Rulează la fiecare
// pornire a containerului (vezi docker-entrypoint.sh), DUPĂ migrarea bazei
// de date — e idempotent (sigur de rulat de mai multe ori).
//
// .env e sursa de adevăr: dacă schimbi ADMIN_PASSWORD și repornești
// aplicația, parola contului de admin se actualizează automat, fără să
// trebuiască să ștergi sau recreezi contul manual.
//
// ATENȚIE: nu folosi aici adresa de email a unui client existent — acest
// script transformă orice cont cu acel email în cont de administrator și îi
// suprascrie parola.
require("dotenv").config();
const prisma = require("./db");
const { hashPassword } = require("./auth");

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    console.log("[seedAdmin] ADMIN_EMAIL/ADMIN_PASSWORD nu sunt completate în .env — sar peste crearea contului de administrator.");
    return;
  }
  if (password.length < 12) {
    console.warn("[seedAdmin] ADMIN_PASSWORD are mai puțin de 12 caractere — folosește o parolă mai lungă și mai sigură.");
  }

  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, isAdmin: true },
    });
    console.log(`[seedAdmin] Cont de administrator actualizat: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        isAdmin: true,
        termsVersion: process.env.LEGAL_VERSION || "1.0",
        termsAcceptedAt: new Date(),
      },
    });
    console.log(`[seedAdmin] Cont de administrator creat: ${email}`);
  }
}

seedAdmin()
  .catch((e) => {
    console.error("[seedAdmin] Eroare la crearea contului de administrator:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
