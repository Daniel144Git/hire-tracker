-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "totalPence" INTEGER,
    "filePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Statement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatementLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statementId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "invoiceDate" TEXT NOT NULL,
    "jobNo" TEXT,
    "invoiceNo" TEXT NOT NULL,
    "customerRef" TEXT,
    "amountPence" INTEGER NOT NULL,
    CONSTRAINT "StatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Statement_supplierId_date_key" ON "Statement"("supplierId", "date");

-- CreateIndex
CREATE INDEX "StatementLine_statementId_idx" ON "StatementLine"("statementId");

-- CreateIndex
CREATE INDEX "StatementLine_invoiceNo_idx" ON "StatementLine"("invoiceNo");

