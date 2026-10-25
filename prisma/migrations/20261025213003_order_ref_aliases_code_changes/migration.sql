-- AlterTable
ALTER TABLE "HireOrder" ADD COLUMN "orderRef" TEXT;

-- CreateTable
CREATE TABLE "SiteAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    CONSTRAINT "SiteAlias_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetCodeChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hireItemId" TEXT NOT NULL,
    "oldCode" TEXT NOT NULL,
    "newCode" TEXT NOT NULL,
    "changedOn" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FleetCodeChange_hireItemId_fkey" FOREIGN KEY ("hireItemId") REFERENCES "HireItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isCreditNote" BOOLEAN NOT NULL DEFAULT false,
    "jobNo" TEXT,
    "orderRef" TEXT,
    "deliveryAddress" TEXT,
    "siteId" TEXT,
    "siteMatchedBy" TEXT,
    "lastInvoiceNo" TEXT,
    "customerRef" TEXT,
    "netPence" INTEGER NOT NULL,
    "vatPence" INTEGER NOT NULL,
    "grossPence" INTEGER NOT NULL,
    "filePath" TEXT,
    "checkStatus" TEXT NOT NULL DEFAULT 'NOT_CHECKED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("checkStatus", "createdAt", "customerRef", "date", "dueDate", "filePath", "grossPence", "id", "isCreditNote", "jobNo", "lastInvoiceNo", "netPence", "number", "paymentStatus", "supplierId", "type", "updatedAt", "vatPence") SELECT "checkStatus", "createdAt", "customerRef", "date", "dueDate", "filePath", "grossPence", "id", "isCreditNote", "jobNo", "lastInvoiceNo", "netPence", "number", "paymentStatus", "supplierId", "type", "updatedAt", "vatPence" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_jobNo_idx" ON "Invoice"("jobNo");
CREATE UNIQUE INDEX "Invoice_supplierId_number_key" ON "Invoice"("supplierId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SiteAlias_alias_key" ON "SiteAlias"("alias");

-- CreateIndex
CREATE INDEX "FleetCodeChange_hireItemId_idx" ON "FleetCodeChange"("hireItemId");

-- CreateIndex
CREATE INDEX "FleetCodeChange_oldCode_idx" ON "FleetCodeChange"("oldCode");

-- CreateIndex
CREATE UNIQUE INDEX "HireOrder_orderRef_key" ON "HireOrder"("orderRef");
