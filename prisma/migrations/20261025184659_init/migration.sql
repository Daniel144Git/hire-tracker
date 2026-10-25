-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accountNo" TEXT,
    "chargeBankHolidays" BOOLEAN NOT NULL DEFAULT true,
    "minChargeDays" INTEGER NOT NULL DEFAULT 5,
    "damageWaiverPct" REAL NOT NULL DEFAULT 10,
    "paymentTerms" TEXT NOT NULL DEFAULT 'END_OF_NEXT_MONTH',
    "paymentTermsDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HireOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierJobNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "offHireDate" TEXT,
    "collectionNo" TEXT,
    "offHireEnteredAt" DATETIME,
    "damageWaiverApplies" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ON_HIRE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HireOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HireOrder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HireItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fleetCode" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "weeklyRatePence" INTEGER NOT NULL,
    "despatchNo" TEXT,
    "despatchDate" TEXT,
    "isAccessory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HireItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "HireOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE INDEX "HireOrder_siteId_status_idx" ON "HireOrder"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HireOrder_supplierId_supplierJobNo_key" ON "HireOrder"("supplierId", "supplierJobNo");

-- CreateIndex
CREATE INDEX "HireItem_fleetCode_idx" ON "HireItem"("fleetCode");
