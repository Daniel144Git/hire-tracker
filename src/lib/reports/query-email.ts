import { round2 } from "@/lib/money";
import { money } from "@/lib/reconciliation/helpers";

export interface InvoiceToQuery {
  number: string;
  date: string;
  findings: {
    check: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    linePosition: number | null;
    message: string;
    /** Billed minus expected: positive is overcharged. */
    difference: number | null;
    resolved: boolean;
  }[];
}

/** A job number or order number we have no order for is our gap, not a supplier's charge. */
const isAboutOurRecords = (finding: InvoiceToQuery["findings"][number]) =>
  finding.check === "R8" && finding.linePosition === null;

const ukDate = (isoDate: string) => isoDate.split("-").reverse().join("/");
const sentence = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);

/**
 * A query email to the supplier about the open findings worth raising (high and medium; low
 * ones, and gaps in our own records, are for us to look at), with what each overcharged and
 * the total. Null when nothing is
 * open. It is a draft: the person reads it, edits it and sends it from their own email.
 */
export function draftQueryEmail(
  supplier: { name: string; accountNo: string | null },
  invoices: InvoiceToQuery[],
): { subject: string; body: string } | null {
  const queried = invoices
    .map((invoice) => ({
      ...invoice,
      findings: invoice.findings.filter(
        (f) => !f.resolved && f.severity !== "LOW" && !isAboutOurRecords(f),
      ),
    }))
    .filter((invoice) => invoice.findings.length > 0);
  if (queried.length === 0) return null;

  let total = 0;
  const sections = queried.map((invoice) => {
    const items = invoice.findings.map((finding) => {
      const where = finding.linePosition === null ? "" : `Line ${finding.linePosition}: `;
      const over = finding.difference !== null && finding.difference > 0 ? finding.difference : 0;
      total += over;
      return `- ${where}${sentence(finding.message)}${over > 0 ? ` Overcharged by ${money(over)}.` : ""}`;
    });
    return [`Invoice ${invoice.number}, ${ukDate(invoice.date)}:`, ...items].join("\n");
  });

  const account = supplier.accountNo ? `, account ${supplier.accountNo}` : "";
  const subject =
    queried.length === 1
      ? `Query on invoice ${queried[0].number}${account}`
      : `Query on ${queried.length} invoices${account}`;
  const ask =
    round2(total) > 0
      ? `In total we believe we have been overcharged by ${money(round2(total))}. Please send a credit note for these amounts, or let us know why they are correct.`
      : "Please explain these charges, or send a credit note.";
  const body = [
    "Hello,",
    "",
    "We have checked these invoices against our hire records and have the following queries.",
    "",
    sections.join("\n\n"),
    "",
    ask,
    "",
    "Kind regards",
  ].join("\n");
  return { subject, body };
}
