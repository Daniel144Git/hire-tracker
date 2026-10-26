
-- CreateTable
CREATE TABLE "InvoiceDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "values" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceDraft_uploadId_key" ON "InvoiceDraft"("uploadId");

