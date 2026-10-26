"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/app/ui/field";
import { importInvoiceFileAction, type BatchFileResult } from "../actions";

const STATUS_LABEL: Record<BatchFileResult["status"], string> = {
  SAVED: "Saved",
  ALREADY_RECORDED: "Already recorded",
  TO_CHECK: "To check",
  NOT_READ: "Not read",
};

/**
 * Uploads many invoice PDFs: they are sent one at a time, each saved when it was read cleanly
 * or kept to check, and the results are listed as they come.
 */
export function BulkUpload() {
  const [results, setResults] = useState<BatchFileResult[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const running = progress !== null && progress.done < progress.total;

  async function upload(form: FormData) {
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return;
    setResults([]);
    setProgress({ done: 0, total: files.length });
    for (const [index, file] of files.entries()) {
      const one = new FormData();
      one.append("file", file);
      const result = await importInvoiceFileAction(one);
      setResults((previous) => [...previous, result]);
      setProgress({ done: index + 1, total: files.length });
    }
  }

  const count = (status: BatchFileResult["status"]) =>
    results.filter((r) => r.status === status).length;

  return (
    <div className="flex flex-col gap-4">
      <form action={upload} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="invoice-pdfs" className="text-sm font-medium">
            Invoice PDFs
          </label>
          <input
            id="invoice-pdfs"
            name="files"
            type="file"
            multiple
            accept="application/pdf,.pdf"
            className="text-sm"
          />
        </div>
        <button type="submit" className={buttonClass} disabled={running}>
          {running ? "Uploading…" : "Upload"}
        </button>
      </form>

      {progress && (
        <p role="status" data-testid="upload-progress">
          {running
            ? `Reading ${progress.done + 1} of ${progress.total}…`
            : `${progress.total} ${progress.total === 1 ? "file" : "files"}: ${count("SAVED")} saved, ${count("ALREADY_RECORDED")} already recorded, ${count("TO_CHECK")} to check, ${count("NOT_READ")} not read.`}
        </p>
      )}

      {results.length > 0 && (
        <table className="w-full border-collapse text-left [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
          <caption className="sr-only">Uploaded files</caption>
          <thead>
            <tr className="border-b border-gray-400">
              <th scope="col">File</th>
              <th scope="col">Result</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr
                key={`${result.fileName}-${index}`}
                className="border-b border-gray-200 align-top"
              >
                <th scope="row" className="py-2 font-normal">
                  {result.fileName}
                </th>
                <td>{STATUS_LABEL[result.status]}</td>
                <td>
                  {result.status === "SAVED" && (
                    <Link href={`/invoices/${result.invoice.id}`} className="underline">
                      Open invoice {result.invoice.number}
                    </Link>
                  )}
                  {result.status === "ALREADY_RECORDED" && (
                    <Link href={`/invoices/${result.invoice.id}`} className="underline">
                      {result.message}
                    </Link>
                  )}
                  {result.status === "TO_CHECK" && (
                    <>
                      <Link href={`/invoices/new?draft=${result.draftId}`} className="underline">
                        Check and save
                      </Link>
                      {result.warnings.length > 0 && (
                        <ul className="list-disc pl-5 text-sm">
                          {result.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  {result.status === "NOT_READ" && result.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!running && count("TO_CHECK") > 0 && (
        <p>
          <Link href="/invoices/review" className="underline">
            See every invoice waiting to be checked
          </Link>
        </p>
      )}
    </div>
  );
}
