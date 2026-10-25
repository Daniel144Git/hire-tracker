import { toPence } from "@/lib/money";
import { money } from "@/lib/reconciliation/helpers";

export type PaymentStatus = "UNPAID" | "PAID" | "QUERIED" | "CREDITED";

export interface InvoiceForStatement {
  id: string;
  number: string;
  date: string;
  gross: number;
  paymentStatus: PaymentStatus;
}

export interface StatementForReconciliation {
  date: string;
  lines: { id: string; invoiceNo: string; invoiceDate: string; amount: number }[];
}

export type StatementProblemKind =
  "MISSING_INVOICE" | "AMOUNT_DIFFERS" | "PAID_BUT_LISTED" | "NOT_ON_STATEMENT";

export interface StatementProblem {
  kind: StatementProblemKind;
  severity: "HIGH" | "MEDIUM";
  lineId: string | null;
  invoiceId: string | null;
  invoiceNo: string;
  statementAmount: number | null;
  ourAmount: number | null;
  message: string;
}

export interface StatementReconciliation {
  /** Each statement line that is an invoice in Hire Tracker, whatever its amount. */
  matches: { lineId: string; invoiceId: string }[];
  problems: StatementProblem[];
}

const key = (invoiceNo: string) => invoiceNo.trim().toUpperCase();

/**
 * R11: a supplier statement lists the invoices and credit notes the supplier considers open on
 * its date. Each line must be an invoice we hold, for the same amount (gross). Each invoice of
 * ours that is still unpaid and dated before the statement must be on it (one dated the same day
 * may not be yet). An invoice we marked paid must not be on it, but only the latest statement
 * says that: an older one listed invoices that were open then and paid since. Invoices are
 * matched by number; the result is worked out each time, so an invoice entered later repairs it.
 */
export function reconcileStatement(
  statement: StatementForReconciliation,
  invoices: InvoiceForStatement[],
  { latest = true }: { latest?: boolean } = {},
): StatementReconciliation {
  const byNumber = new Map(invoices.map((invoice) => [key(invoice.number), invoice]));
  const listed = new Set<string>();
  const matches: StatementReconciliation["matches"] = [];
  const problems: StatementProblem[] = [];

  for (const line of statement.lines) {
    listed.add(key(line.invoiceNo));
    const invoice = byNumber.get(key(line.invoiceNo));
    const invoiceNo = invoice?.number ?? line.invoiceNo.trim();
    const base = {
      lineId: line.id,
      invoiceId: invoice?.id ?? null,
      invoiceNo,
      statementAmount: line.amount,
      ourAmount: invoice?.gross ?? null,
    };
    if (!invoice) {
      problems.push({
        ...base,
        kind: "MISSING_INVOICE",
        severity: "HIGH",
        message: `Invoice ${invoiceNo} is on the statement for ${money(line.amount)} but not in Hire Tracker: ask the supplier for a copy`,
      });
      continue;
    }
    matches.push({ lineId: line.id, invoiceId: invoice.id });
    if (toPence(line.amount) !== toPence(invoice.gross)) {
      problems.push({
        ...base,
        kind: "AMOUNT_DIFFERS",
        severity: "HIGH",
        message: `Invoice ${invoiceNo} is on the statement for ${money(line.amount)} but the invoice is for ${money(invoice.gross)}`,
      });
    } else if (latest && invoice.paymentStatus === "PAID") {
      problems.push({
        ...base,
        kind: "PAID_BUT_LISTED",
        severity: "MEDIUM",
        message: `Invoice ${invoiceNo} is paid in Hire Tracker but still open on the statement: check the payment reached the supplier`,
      });
    }
  }

  const expected = invoices
    .filter(
      (invoice) =>
        !listed.has(key(invoice.number)) &&
        invoice.date < statement.date &&
        invoice.paymentStatus !== "PAID" &&
        invoice.paymentStatus !== "CREDITED",
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  for (const invoice of expected) {
    problems.push({
      kind: "NOT_ON_STATEMENT",
      severity: "MEDIUM",
      lineId: null,
      invoiceId: invoice.id,
      invoiceNo: invoice.number,
      statementAmount: null,
      ourAmount: invoice.gross,
      message: `Invoice ${invoice.number} for ${money(invoice.gross)} is unpaid in Hire Tracker but not on the statement: the supplier may consider it paid, or never issued it`,
    });
  }
  return { matches, problems };
}
