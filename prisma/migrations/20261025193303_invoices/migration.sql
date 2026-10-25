-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isCreditNote" BOOLEAN NOT NULL DEFAULT false,
    "jobNo" TEXT,
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
    CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "orderId" TEXT,
    "hireItemId" TEXT,
    "linkProblem" TEXT,
    "fleetCode" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "periodFrom" TEXT,
    "periodTo" TEXT,
    "weeks" INTEGER,
    "days" INTEGER,
    "ratePence" INTEGER,
    "chargeType" TEXT NOT NULL,
    "netPence" INTEGER NOT NULL,
    "vatPence" INTEGER NOT NULL,
    "trade" TEXT,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "HireOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InvoiceLine_hireItemId_fkey" FOREIGN KEY ("hireItemId") REFERENCES "HireItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Invoice_jobNo_idx" ON "Invoice"("jobNo");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_supplierId_number_key" ON "Invoice"("supplierId", "number");

-- CreateIndex
CREATE INDEX "InvoiceLine_orderId_idx" ON "InvoiceLine"("orderId");
