import type { Locator, Page } from "@playwright/test";

/** Page Object for one site ("/sites/:id"): its hire orders, off-hire and the new-order form. */
export class SitePage {
  readonly heading: Locator;
  readonly ordersTable: Locator;
  readonly newOrderForm: Locator;
  readonly suspensionForm: Locator;
  readonly suspensionsTable: Locator;
  /** The on-hire register; its caption starts with "As of <date>". */
  readonly onHireTable: Locator;

  constructor(private readonly page: Page) {
    this.onHireTable = page.getByRole("table", { name: /^As of/ });
    this.suspensionForm = page.getByRole("form", { name: "Record a suspension" });
    this.suspensionsTable = page.getByRole("table", { name: "Hire suspensions" });
    this.heading = page.getByRole("heading", { level: 1 });
    this.ordersTable = page.getByRole("table", { name: "Hire orders on this site" });
    this.newOrderForm = page.getByRole("form", { name: "New hire order" });
  }

  async goto(siteId: string): Promise<void> {
    await this.page.goto(`/sites/${siteId}`);
  }

  /** The row of an order, found by its job number (the row header). */
  orderRow(jobNo: string): Locator {
    return this.ordersTable
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: jobNo, exact: true }) });
  }

  /** A cell of an order's row, by column name. */
  cell(jobNo: string, column: "Status" | "Off-hire" | "Collection no" | "Items"): Locator {
    const index = { Items: 0, Status: 3, "Off-hire": 4, "Collection no": 5 }[column];
    return this.orderRow(jobNo).getByRole("cell").nth(index);
  }

  offHireForm(jobNo: string): Locator {
    return this.page.getByRole("form", { name: `Off-hire ${jobNo}` });
  }

  async offHire(jobNo: string, offHireDate: string, collectionNo?: string): Promise<void> {
    const form = this.offHireForm(jobNo);
    await form.getByLabel("Off-hire date").fill(offHireDate);
    if (collectionNo) await form.getByLabel("Collection no").fill(collectionNo);
    await form.getByRole("button", { name: "Off-hire" }).click();
  }

  async recordCollection(jobNo: string, collectionNo: string): Promise<void> {
    const form = this.page.getByRole("form", { name: `Record collection for ${jobNo}` });
    await form.getByLabel("Collection no").fill(collectionNo);
    await form.getByRole("button", { name: "Record collection" }).click();
  }

  /** A row of the on-hire register, found by the item's fleet code. */
  onHireRow(fleetCode: string): Locator {
    return this.onHireTable.getByRole("row").filter({ hasText: fleetCode });
  }

  onHireCell(
    fleetCode: string,
    column:
      | "Job no"
      | "Since"
      | "Days on hire"
      | "Working days"
      | "Cost to date"
      | "Billed"
      | "Not yet billed"
      | "Status",
  ): Locator {
    const index = [
      "Job no",
      "Since",
      "Days on hire",
      "Working days",
      "Cost to date",
      "Billed",
      "Not yet billed",
      "Status",
    ].indexOf(column);
    return this.onHireRow(fleetCode).getByRole("cell").nth(index);
  }

  /** Records a new fleet code for an item; `item` is the option label, e.g. "J100101: Pipe groover (APX-PG-0317)". */
  async recordNewFleetCode(change: {
    item: string;
    newCode: string;
    changedOn: string;
    note?: string;
  }) {
    const form = this.page.getByRole("form", { name: "New fleet code" });
    await form.getByLabel("Item", { exact: true }).selectOption({ label: change.item });
    await form.getByLabel("New fleet code").fill(change.newCode);
    await form.getByLabel("Changed on").fill(change.changedOn);
    if (change.note) await form.getByLabel("Note (optional)").fill(change.note);
    await form.getByRole("button", { name: "Record new fleet code" }).click();
  }

  /** Saves how suppliers spell the site, one spelling per line. */
  async saveSpellings(spellings: string[]) {
    const form = this.page.getByRole("form", { name: "Site spellings" });
    await form.getByLabel("Spellings, one per line").fill(spellings.join("\n"));
    await form.getByRole("button", { name: "Save spellings" }).click();
  }

  async recordSuspension(suspension: {
    from: string;
    to: string;
    freeDays: number;
    note?: string;
  }): Promise<void> {
    const form = this.suspensionForm;
    await form.getByLabel("From").fill(suspension.from);
    await form.getByLabel("To", { exact: true }).fill(suspension.to);
    await form.getByLabel("Free days credited").fill(String(suspension.freeDays));
    if (suspension.note) await form.getByLabel("Note (optional)").fill(suspension.note);
    await form.getByRole("button", { name: "Record suspension" }).click();
  }

  async createOrder(order: {
    supplierName: string;
    jobNo: string;
    trade: string;
    startDate: string;
    description: string;
    fleetCode?: string;
    qty?: number;
    weeklyRate: number;
  }): Promise<void> {
    const form = this.newOrderForm;
    await form.getByLabel("Supplier", { exact: true }).selectOption({ label: order.supplierName });
    await form.getByLabel("Supplier job number").fill(order.jobNo);
    await form.getByLabel("Trade").selectOption(order.trade);
    await form.getByLabel("Start of hire").fill(order.startDate);
    await form.getByLabel("Item description").fill(order.description);
    if (order.fleetCode) await form.getByLabel("Fleet code").fill(order.fleetCode);
    if (order.qty) await form.getByLabel("Quantity").fill(String(order.qty));
    await form.getByLabel("Weekly rate (£)").fill(String(order.weeklyRate));
    await form.getByRole("button", { name: "Add hire order" }).click();
  }
}
