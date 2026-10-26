import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotFoundError } from "@/server/errors";
import { PaymentButtons } from "@/app/payments/payment-buttons";
import { getInvoice, getInvoiceQueryEmail, type InvoiceDto } from "@/server/services/invoices";
import { QueryEmail } from "@/app/ui/query-email";
import {
  CHARGE_TYPE_LABEL,
  CHECK_LABEL,
  formatPounds,
  INVOICE_TYPE_LABEL,
  LINK_PROBLEM_LABEL,
  SEVERITY_LABEL,
} from "../format";

export const metadata: Metadata = { title: "Invoice" };

const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  QUERIED: "Queried",
  CREDITED: "Credited",
};

export default function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <Suspense fallback={<p>Loading invoice…</p>}>
        <InvoiceDetails params={params} />
      </Suspense>
    </main>
  );
}

async function InvoiceDetails({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const invoice = await findInvoice(id);
  const { email } = await getInvoiceQueryEmail(id);

  const header: [string, string][] = [
    ["Supplier", invoice.supplier.name],
    ["Type", `${INVOICE_TYPE_LABEL[invoice.type]}${invoice.isCreditNote ? " (credit note)" : ""}`],
    ["Invoice date", invoice.date],
    ["Due date", invoice.dueDate],
    ["Site", siteText(invoice)],
    ["Our order number", invoice.orderRef ?? "-"],
    ["Job number", invoice.jobNo ?? "-"],
    ["Last invoice number", invoice.lastInvoiceNo ?? "-"],
    ["Customer reference", invoice.customerRef ?? "-"],
    ["Net", formatPounds(invoice.net)],
    ["VAT", formatPounds(invoice.vat)],
    ["Gross", formatPounds(invoice.gross)],
    ["Payment", PAYMENT_LABEL[invoice.paymentStatus]],
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold">Invoice {invoice.number}</h1>
      {invoice.hasFile && (
        <p>
          {/* An API route, not a page: a plain link opens the PDF in the browser. */}
          <a href={`/api/invoices/${invoice.id}/file`} className="text-link underline">
            Open the invoice PDF
          </a>
        </p>
      )}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
        {header.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="font-medium">{term}</dt>
            <dd data-testid={`invoice-${term.toLowerCase().replaceAll(" ", "-")}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <PaymentButtons
        invoiceId={invoice.id}
        invoiceNumber={invoice.number}
        status={invoice.paymentStatus}
      />
      <section aria-labelledby="findings-heading" className="flex flex-col gap-3">
        <h2 id="findings-heading" className="text-lg font-medium">
          Findings
        </h2>
        <FindingsSummary findings={invoice.findings} />
        {invoice.findings.length > 0 && <FindingsTable findings={invoice.findings} />}
        {email && (
          <QueryEmail
            title="Draft a query email to the supplier"
            subject={email.subject}
            body={email.body}
          />
        )}
      </section>
      <section aria-labelledby="lines-heading" className="flex flex-col gap-3">
        <h2 id="lines-heading" className="text-lg font-medium">
          Lines
        </h2>
        <LinesTable lines={invoice.lines} />
      </section>
    </>
  );
}

async function findInvoice(id: string): Promise<InvoiceDto> {
  try {
    return await getInvoice(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

function LinesTable({ lines }: { lines: InvoiceDto["lines"] }) {
  return (
    <table className="w-full border-collapse text-left align-top [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
      <caption className="sr-only">Invoice lines</caption>
      <thead>
        <tr className="border-b border-line-strong">
          <th scope="col">Line</th>
          <th scope="col">Description</th>
          <th scope="col">Type</th>
          <th scope="col">Period</th>
          <th scope="col">Wks / days</th>
          <th scope="col" className="text-right">
            Net
          </th>
          <th scope="col" className="text-right">
            VAT
          </th>
          <th scope="col">Linked to</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="border-b border-line align-top">
            <th scope="row" className="py-2">
              {line.position}
            </th>
            <td>
              {line.qty > 1 && `${line.qty} x `}
              {line.description}
              {line.fleetCode && ` (${line.fleetCode})`}
            </td>
            <td>{CHARGE_TYPE_LABEL[line.chargeType]}</td>
            <td className="whitespace-nowrap">
              {line.periodFrom ? `${line.periodFrom} to ${line.periodTo}` : "-"}
            </td>
            <td className="whitespace-nowrap">{formatWeeksAndDays(line.weeks, line.days)}</td>
            <td className="text-right whitespace-nowrap">{formatPounds(line.net)}</td>
            <td className="text-right whitespace-nowrap">{formatPounds(line.vat)}</td>
            <td>
              <LinkCell line={line} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LinkCell({ line }: { line: InvoiceDto["lines"][number] }) {
  const problem = line.linkProblem && (
    <p className="text-red-700 dark:text-red-400">{LINK_PROBLEM_LABEL[line.linkProblem]}</p>
  );
  if (!line.order) return problem ?? <span>-</span>;
  return (
    <>
      <Link href={`/sites/${line.order.site.id}`} className="underline">
        {line.order.supplierJobNo} ({line.order.site.code})
      </Link>
      {line.hireItem?.fleetCode && <span> {line.hireItem.fleetCode}</span>}
      {problem}
    </>
  );
}

/** "4 wks 1 day", as printed on the supplier's invoices; "-" when the line has no period. */
function formatWeeksAndDays(weeks: number | null, days: number | null): string {
  if (weeks === null && days === null) return "-";
  const d = days ?? 0;
  return `${weeks ?? 0} wks ${d} ${d === 1 ? "day" : "days"}`;
}

type FindingRow = InvoiceDto["findings"][number];

function FindingsSummary({ findings }: { findings: FindingRow[] }) {
  const open = findings.filter((finding) => !finding.resolved);
  const high = open.filter((finding) => finding.severity === "HIGH").length;
  const atStake = open.reduce((sum, finding) => sum + Math.max(finding.difference ?? 0, 0), 0);
  if (findings.length === 0) {
    return (
      <p data-testid="findings-summary">No discrepancies found: this invoice matches the orders.</p>
    );
  }
  return (
    <p data-testid="findings-summary">
      {open.length} open {open.length === 1 ? "finding" : "findings"}
      {high > 0 && `, ${high} high`}
      {atStake > 0 && `. Overcharged: ${formatPounds(Math.round(atStake * 100) / 100)}`}
      {findings.length > open.length && `. ${findings.length - open.length} resolved`}.
    </p>
  );
}

function FindingsTable({ findings }: { findings: FindingRow[] }) {
  const amount = (value: number | null) => (value === null ? "-" : formatPounds(value));
  return (
    <table className="w-full border-collapse text-left align-top [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
      <caption className="sr-only">Findings</caption>
      <thead>
        <tr className="border-b border-line-strong">
          <th scope="col">Check</th>
          <th scope="col">Severity</th>
          <th scope="col">Line</th>
          <th scope="col">Finding</th>
          <th scope="col" className="text-right">
            Billed
          </th>
          <th scope="col" className="text-right">
            Expected
          </th>
          <th scope="col" className="text-right">
            Difference
          </th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {findings.map((finding) => (
          <tr key={finding.id} className="border-b border-line align-top">
            <th scope="row" className="py-2 font-medium whitespace-nowrap">
              {finding.check} <span className="font-normal">{CHECK_LABEL[finding.check]}</span>
            </th>
            <td>
              <span
                className={
                  finding.severity === "HIGH"
                    ? "font-semibold text-red-700 dark:text-red-400"
                    : finding.severity === "MEDIUM"
                      ? "font-medium text-amber-800 dark:text-amber-300"
                      : ""
                }
              >
                {SEVERITY_LABEL[finding.severity]}
              </span>
            </td>
            <td>{finding.linePosition ?? "Invoice"}</td>
            <td>{finding.message}</td>
            <td className="text-right whitespace-nowrap">{amount(finding.billed)}</td>
            <td className="text-right whitespace-nowrap">{amount(finding.expected)}</td>
            <td className="text-right whitespace-nowrap">{amount(finding.difference)}</td>
            <td>{finding.resolved ? (finding.resolution ?? "Resolved") : "Open"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SITE_SOURCE: Record<string, string> = {
  ORDER: "from the linked order",
  ALIAS: "recognised from a recorded spelling",
  NAME: "recognised from the site name",
  CODE: "recognised from the site code",
  ADDRESS: "recognised from the delivery address",
  POSTCODE: "recognised from the delivery postcode",
};

/** "RVS - Riverside Tower (from the linked order)", or why there is no site. */
function siteText(invoice: InvoiceDto): string {
  if (!invoice.site) return "Not recognised: link the invoice to an order or record the spelling";
  const source = invoice.siteMatchedBy ? ` (${SITE_SOURCE[invoice.siteMatchedBy]})` : "";
  return `${invoice.site.code} - ${invoice.site.name}${source}`;
}
