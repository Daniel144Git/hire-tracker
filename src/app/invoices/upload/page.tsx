import type { Metadata } from "next";
import { BulkUpload } from "./bulk-upload";

export const metadata: Metadata = { title: "Upload invoices" };

export default function UploadInvoicesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Upload invoices</h1>
      <p>
        Choose many PDFs at once, for example a month&apos;s folder. Each invoice read cleanly is
        saved with its PDF and checked. One already recorded is skipped. Any other waits on the
        &quot;To check&quot; list with the fields to fill in marked: nothing doubtful is saved
        unseen.
      </p>
      <BulkUpload />
    </main>
  );
}
