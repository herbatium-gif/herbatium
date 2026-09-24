-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termsVersion" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "currentPeriodEnd" TIMESTAMP(3),
    "publicPageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT,
    "businessName" TEXT,
    "bio" TEXT,
    "instagramUrl" TEXT,
    "bresloUrl" TEXT,
    "etsyUrl" TEXT,
    "websiteUrl" TEXT,
    "facebookUrl" TEXT,
    "catalogTemplate" TEXT DEFAULT 'natural',
    "teamOwnerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipes" JSONB NOT NULL DEFAULT '[]',
    "batches" JSONB NOT NULL DEFAULT '[]',
    "customIngredients" JSONB NOT NULL DEFAULT '[]',
    "products" JSONB NOT NULL DEFAULT '[]',
    "ingredientPrices" JSONB NOT NULL DEFAULT '{}',
    "stock" JSONB NOT NULL DEFAULT '{}',
    "costState" JSONB NOT NULL DEFAULT '{}',
    "sales" JSONB NOT NULL DEFAULT '[]',
    "lyeState" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserData_userId_key" ON "UserData"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamOwnerId_fkey" FOREIGN KEY ("teamOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserData" ADD CONSTRAINT "UserData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
