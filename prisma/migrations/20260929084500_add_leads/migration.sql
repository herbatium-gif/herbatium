-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nume" TEXT NOT NULL,
    "ceVinde" TEXT,
    "oras" TEXT,
    "contact" TEXT,
    "tipContact" TEXT,
    "sursa" TEXT,
    "verificare" TEXT,
    "potrivire" TEXT,
    "stare" TEXT NOT NULL DEFAULT 'nou',
    "notite" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_nume_key" ON "Lead"("nume");

