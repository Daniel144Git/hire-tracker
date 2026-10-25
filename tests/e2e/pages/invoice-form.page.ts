import type { Locator, Page } from "@playwright/test";

export interface InvoiceLineEntry {
  description: string;
  chargeType: "Hire" | "Damage waiver" | "Transport" | "Sale" | "Other";
  fleetCode?: string;
  periodFrom?: string;
  periodTo?: string;
  weeks?: number;
  days?: number;
  rate?: number;
  net: number;
  vat: number;
}

export interface InvoiceEntry {
  supplierName: string;
  number: string;
  type: "Continuation" | "Return" | "Sale";
  date: string;
  orderRef?: string;
  jobNo?: string;
  net: number;
  vat: number;
  gross: number;
  lines: InvoiceLineEntry[];
}

/** Page Object for "/invoices/new": reading a PDF, then the header and any number of lines. */
export class InvoiceFormPage {
  readonly heading: Locator;
  readonly pdfSection: Locator;
  /** The result of reading a PDF: a status message, or an alert when it could not be read. */
  readonly pdfMessage: Locator;
  /** "Check before saving": what the app could not read or what does not add up. */
  readonly warnings: Locator;
  readonly form: Locator;
  readonly supplierSelect: Locator;
  readonly numberInput: Locator;
  readonly addLineButton: Locator;
  readonly saveButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1, name: "Enter an invoice" });
    this.pdfSection = page.getByRole("region", { name: "Read an invoice PDF" });
    this.pdfMessage = this.pdfSection.getByRole("status").or(this.pdfSection.getByRole("alert"));
    this.warnings = page.getByRole("region", { name: "Check before saving" }).getByRole("listitem");
    this.form = page.getByRole("form", { name: "Invoice", exact: true });
    this.supplierSelect = this.form.getByLabel("Supplier", { exact: true });
    this.numberInput = this.form.getByLabel("Invoice number", { exact: true });
    this.addLineButton = this.form.getByRole("button", { name: "Add line" });
    this.saveButton = this.form.getByRole("button", { name: "Save invoice" });
    this.errorMessage = page.getByRole("alert");
  }

  async goto(): Promise<void> {
    await this.page.goto("/invoices/new");
  }

  /** Chooses a PDF and reads it; the form below fills in from it. */
  async readPdf(name: string, pdf: Uint8Array): Promise<void> {
    await this.pdfSection.getByLabel("Invoice PDF").setInputFiles({
      name,
      mimeType: "application/pdf",
      buffer: Buffer.from(pdf),
    });
    await this.pdfSection.getByRole("button", { name: "Read PDF" }).click();
  }

  /** The fieldset of one line, e.g. line(1) is "Line 1". */
  line(number: number): Locator {
    return this.form.getByRole("group", { name: `Line ${number}`, exact: true });
  }

  async fillHeader(invoice: Omit<InvoiceEntry, "lines">): Promise<void> {
    const form = this.form;
    await this.supplierSelect.selectOption({ label: invoice.supplierName });
    await this.numberInput.fill(invoice.number);
    await form.getByLabel("Type", { exact: true }).selectOption({ label: invoice.type });
    await form.getByLabel("Invoice date").fill(invoice.date);
    if (invoice.orderRef)
      await form.getByLabel("Our order number (optional)").fill(invoice.orderRef);
    if (invoice.jobNo) await form.getByLabel("Job number").fill(invoice.jobNo);
    await form.getByLabel("Net total (£)").fill(String(invoice.net));
    await form.getByLabel("VAT total (£)").fill(String(invoice.vat));
    await form.getByLabel("Gross total (£)").fill(String(invoice.gross));
  }

  async fillLine(number: number, line: InvoiceLineEntry): Promise<void> {
    const group = this.line(number);
    await group.getByLabel("Description").fill(line.description);
    await group.getByLabel("Charge type").selectOption({ label: line.chargeType });
    if (line.fleetCode) await group.getByLabel("Fleet code").fill(line.fleetCode);
    if (line.periodFrom) await group.getByLabel("Period from").fill(line.periodFrom);
    if (line.periodTo) await group.getByLabel("Period to").fill(line.periodTo);
    if (line.weeks !== undefined) await group.getByLabel("Weeks").fill(String(line.weeks));
    if (line.days !== undefined) await group.getByLabel("Days").fill(String(line.days));
    if (line.rate !== undefined) await group.getByLabel("Rate (£/week)").fill(String(line.rate));
    await group.getByLabel("Net (£)").fill(String(line.net));
    await group.getByLabel("VAT (£)").fill(String(line.vat));
  }

  /** Fills the whole invoice, adding a line form for every line after the first, and saves. */
  async enterInvoice(invoice: InvoiceEntry): Promise<void> {
    await this.fillHeader(invoice);
    for (const [index, line] of invoice.lines.entries()) {
      if (index > 0) await this.addLineButton.click();
      await this.fillLine(index + 1, line);
    }
    await this.saveButton.click();
  }
}
