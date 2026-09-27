-- Migrare de REPARARE a istoricului: cele 3 migrari anterioare
-- (add_has_ever_subscribed, add_intro_price_history, add_2fa_and_lockout)
-- au fost create fara continut real (fisiere migration.sql goale), desi
-- schema.prisma declara aceste coloane/tabele de atunci. Coloanele existau
-- deja pe productie (adaugate cindva direct, nu prin aceste migrari), de
-- aceea aplicatia functiona normal in ciuda golului din istoric.
--
-- Fiecare comanda de mai jos foloseste "IF NOT EXISTS" / echivalent, deci
-- e SIGURA de rulat oriunde: pe productia curenta (unde majoritatea deja
-- exista) NU face nimic, iar pe o baza de date noua (recreata de la zero)
-- creeaza exact ce lipseste. Nu sterge si nu modifica nicio data existenta.

-- User.cui (+ index unic)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cui" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_cui_key" ON "User"("cui");

-- User.hasEverSubscribed
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasEverSubscribed" BOOLEAN NOT NULL DEFAULT false;

-- User.lastSeenChangelogVersion
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenChangelogVersion" INTEGER NOT NULL DEFAULT 0;

-- User: blocare cont dupa parole gresite (failedLoginAttempts/lockedUntil)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- User: autentificare in doi factori (doar cont admin)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" JSONB DEFAULT '[]';

-- Istoric preț introductiv (protecție anti-abuz, separat de User)
CREATE TABLE IF NOT EXISTS "IntroPriceHistory" (
    "cui" TEXT NOT NULL,
    "lastActivatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntroPriceHistory_pkey" PRIMARY KEY ("cui")
);

CREATE TABLE IF NOT EXISTS "IntroPriceHistoryEmail" (
    "email" TEXT NOT NULL,
    "lastActivatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntroPriceHistoryEmail_pkey" PRIMARY KEY ("email")
);

-- Feedback trimis din aplicatie (buton "Feedback")
CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "status" TEXT NOT NULL DEFAULT 'nou',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- Foreign key Feedback -> User (doar daca nu exista deja, evita eroare pe re-rulare)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Feedback_userId_fkey'
  ) THEN
    ALTER TABLE "Feedback"
      ADD CONSTRAINT "Feedback_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
