-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paymentCode" TEXT,
ADD COLUMN     "declaredMonths" INTEGER,
ADD COLUMN     "declaredAmountRon" INTEGER,
ADD COLUMN     "declaredAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_paymentCode_key" ON "User"("paymentCode");
