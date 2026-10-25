-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "invoiceLineId" TEXT,
    "check" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "billedPence" INTEGER,
    "expectedPence" INTEGER,
    "differencePence" INTEGER,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Finding_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Finding_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Finding" ("billedPence", "check", "createdAt", "differencePence", "expectedPence", "id", "invoiceId", "invoiceLineId", "message", "resolution", "resolved", "severity") SELECT "billedPence", "check", "createdAt", "differencePence", "expectedPence", "id", "invoiceId", "invoiceLineId", "message", "resolution", "resolved", "severity" FROM "Finding";
DROP TABLE "Finding";
ALTER TABLE "new_Finding" RENAME TO "Finding";
CREATE INDEX "Finding_invoiceId_idx" ON "Finding"("invoiceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
