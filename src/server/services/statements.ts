import { db } from "@/server/db";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { extractStatement } from "@/lib/extraction/statement-layout";
import { fromPence, toPence } from "@/lib/money";
import { statementCreateSchema } from "@/lib/schemas/statement";
import { reconcileStatement, type StatementProblem } from "@/lib/statements/reconcile";
import type { Prisma } from "@/generated/prisma/client";
import { assertPdf, keepStatementFile, readStoredFile } from "@/server/files/invoice-files";
import { readPdfText } from "@/server/pdf/read-pdf";

const statementInclude = {
  supplier: { select: { id: true, name: true } },
  lines: { orderBy: { position: "asc" } },
} satisfies Prisma.StatementInclude;

type StatementRow = Prisma.StatementGetPayload<{ include: typeof statementInclude }>;

/** The supplier's invoices as R11 compares them with a statement. */
async function invoicesOf(supplierId: string) {
  const invoices = await db.invoice.findMany({
    where: { supplierId },
    select: { id: true, number: true, date: true, grossPence: true, paymentStatus: true },
  });
  return invoices.map(({ grossPence, ...invoice }) => ({
    ...invoice,
    gross: fromPence(grossPence),
  }));
}

/** A statement with R11 worked out now, against the invoices held today. */
async function toDto(statement: StatementRow) {
  const invoices = await invoicesOf(statement.supplierId);
  const lines = statement.lines.map((line) => ({
    id: line.id,
    position: line.position,
    invoiceDate: line.invoiceDate,
    jobNo: line.jobNo,
    invoiceNo: line.invoiceNo,
    customerRef: line.customerRef,
    amount: fromPence(line.amountPence),
  }));
  const later = await db.statement.count({
    where: { supplierId: statement.supplierId, date: { gt: statement.date } },
  });
  const { matches, problems } = reconcileStatement({ date: statement.date, lines }, invoices, {
    latest: later === 0,
  });
  const invoiceOf = new Map(
    matches.map(({ lineId, invoiceId }) => [lineId, invoices.find((i) => i.id === invoiceId)!]),
  );
  return {
    id: statement.id,
    supplier: statement.supplier,
    date: statement.date,
    /** Only the supplier's latest statement says whether invoices we marked paid are still open. */
    isLatest: later === 0,
    total: statement.totalPence === null ? null : fromPence(statement.totalPence),
    hasFile: statement.filePath !== null,
    lines: lines.map((line) => {
      const invoice = invoiceOf.get(line.id);
      return { ...line, invoice: invoice ? { id: invoice.id, number: invoice.number } : null };
    }),
    summary: summaryOf(lines.length, matches.length, problems),
    problems,
  };
}

function summaryOf(lineCount: number, matched: number, problems: StatementProblem[]) {
  return {
    lineCount,
    matched,
    problemCount: problems.length,
    highCount: problems.filter((problem) => problem.severity === "HIGH").length,
  };
}

export type StatementDto = Awaited<ReturnType<typeof toDto>>;

export async function listStatements() {
  const statements = await db.statement.findMany({
    include: statementInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return Promise.all(
    statements.map(async (statement) => {
      const { id, supplier, date, isLatest, total, hasFile, summary } = await toDto(statement);
      return { id, supplier, date, isLatest, total, hasFile, summary };
    }),
  );
}

export async function getStatement(id: string): Promise<StatementDto> {
  const statement = await db.statement.findUnique({ where: { id }, include: statementInclude });
  if (!statement) throw new NotFoundError("Statement", id);
  return toDto(statement);
}

/** POST /api/statements: a statement as listed by the supplier, e.g. typed in or from a file. */
export async function createStatement(body: unknown): Promise<StatementDto> {
  const { lines, total, ...input } = statementCreateSchema.parse(body);
  const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) {
    throw new ValidationError("The request is not valid", [
      { path: ["supplierId"], message: "Supplier not found" },
    ]);
  }
  const duplicate = await db.statement.findUnique({
    where: { supplierId_date: { supplierId: supplier.id, date: input.date } },
  });
  if (duplicate) {
    throw new ConflictError(
      `The statement of ${input.date} from ${supplier.name} is already imported`,
      "DUPLICATE_STATEMENT",
    );
  }
  const statement = await db.statement.create({
    select: { id: true },
    data: {
      ...input,
      totalPence: total === undefined ? null : toPence(total),
      lines: {
        create: lines.map(({ amount, ...line }, index) => ({
          ...line,
          position: index + 1,
          amountPence: toPence(amount),
        })),
      },
    },
  });
  return getStatement(statement.id);
}

/**
 * Imports a statement PDF: reads it, finds the supplier by the account number printed on it,
 * and keeps the file. A statement that does not add up to its own total is refused: a line was
 * misread, and a comparison built on it could not be trusted.
 */
export async function importStatementPdf(bytes: Uint8Array): Promise<StatementDto> {
  assertPdf(bytes);
  const unreadable = (message: string) =>
    new ValidationError(message, [{ path: ["file"], message }]);
  let fragments;
  try {
    fragments = await readPdfText(bytes);
  } catch {
    throw unreadable("The file could not be read as a PDF");
  }
  const extraction = extractStatement(fragments);
  if (!extraction) throw unreadable("The PDF is not a statement in a layout the app can read");
  if (extraction.warnings.length > 0) {
    throw unreadable(`The statement could not be read reliably. ${extraction.warnings.join(" ")}`);
  }
  const suppliers = await db.supplier.findMany({
    where: { accountNo: extraction.accountNo?.toUpperCase() },
    select: { id: true },
  });
  if (suppliers.length !== 1) {
    throw unreadable(
      suppliers.length === 0
        ? `No supplier has account number ${extraction.accountNo}: add it to the supplier first`
        : `More than one supplier has account number ${extraction.accountNo}`,
    );
  }
  const statement = await createStatement({
    supplierId: suppliers[0].id,
    date: extraction.date,
    total: extraction.total,
    lines: extraction.lines,
  });
  const filePath = await keepStatementFile(bytes, statement.id);
  await db.statement.update({ where: { id: statement.id }, data: { filePath } });
  return { ...statement, hasFile: true };
}

/**
 * POST /api/statements/:id/mark-paid: the invoices we hold as unpaid, dated before the
 * statement, that the supplier no longer lists as open, are paid (or settled): mark them so.
 */
export async function markUnlistedAsPaid(id: string): Promise<StatementDto> {
  const statement = await getStatement(id);
  const invoiceIds = statement.problems
    .filter((problem) => problem.kind === "NOT_ON_STATEMENT" && problem.invoiceId !== null)
    .map((problem) => problem.invoiceId as string);
  await db.invoice.updateMany({
    where: { id: { in: invoiceIds }, paymentStatus: { in: ["UNPAID", "QUERIED"] } },
    data: { paymentStatus: "PAID" },
  });
  return getStatement(id);
}

/** GET /api/statements/:id/file */
export async function getStatementFile(id: string) {
  const statement = await db.statement.findUnique({
    where: { id },
    select: { date: true, filePath: true },
  });
  if (!statement?.filePath) throw new NotFoundError("File of statement", id);
  return {
    date: statement.date,
    bytes: await readStoredFile(statement.filePath, { resource: "statement", id }),
  };
}
