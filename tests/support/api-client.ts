import { expect, type APIRequestContext } from "@playwright/test";
import { invoiceData, orderData, siteData, supplierData } from "./test-data";

export interface Site {
  id: string;
  code: string;
  name: string;
  deliveryAddress: string | null;
  ordersOnHire: number;
}

export interface Supplier {
  id: string;
  name: string;
  damageWaiverPct: number;
  paymentTerms: string;
}

export interface HireItem {
  id: string;
  description: string;
  fleetCode: string | null;
  qty: number;
  weeklyRate: number;
  isAccessory: boolean;
}

export interface Order {
  id: string;
  supplierJobNo: string;
  orderRef: string | null;
  supplier: { id: string; name: string };
  site: { id: string; code: string; name: string };
  trade: string;
  startDate: string;
  offHireDate: string | null;
  collectionNo: string | null;
  damageWaiverApplies: boolean;
  status: "ON_HIRE" | "OFF_HIRED" | "COLLECTED";
  items: HireItem[];
}

export interface InvoiceLine {
  id: string;
  position: number;
  description: string;
  fleetCode: string | null;
  chargeType: string;
  periodFrom: string | null;
  periodTo: string | null;
  net: number;
  vat: number;
  order: { id: string; supplierJobNo: string; site: { id: string; code: string } } | null;
  hireItem: { id: string; fleetCode: string | null } | null;
  linkProblem: string | null;
}

export interface Finding {
  id: string;
  check: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  invoiceLineId: string | null;
  linePosition: number | null;
  message: string;
  billed: number | null;
  expected: number | null;
  difference: number | null;
  resolved: boolean;
  resolution: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  orderRef: string | null;
  site: { id: string; code: string; name: string } | null;
  siteMatchedBy: string | null;
  supplier: { id: string; name: string };
  date: string;
  dueDate: string;
  type: string;
  isCreditNote: boolean;
  jobNo: string | null;
  net: number;
  vat: number;
  gross: number;
  checkStatus: string;
  paymentStatus: string;
  lines: InvoiceLine[];
  findings: Finding[];
}

/**
 * Creates test data through the public API, the same way a client would.
 * Used for setup by both API and E2E tests: setting data up through the UI would be slow
 * and would make every test depend on screens it is not testing.
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async createSupplier(overrides: Record<string, unknown> = {}): Promise<Supplier> {
    return this.post("/api/suppliers", supplierData(overrides));
  }

  async createSite(overrides: Record<string, unknown> = {}): Promise<Site> {
    return this.post("/api/sites", siteData(overrides));
  }

  /** Creates an order; makes its own supplier and site unless they are given. */
  async createOrder(
    options: { supplier?: Supplier; site?: Site; overrides?: Record<string, unknown> } = {},
  ): Promise<Order> {
    const supplier = options.supplier ?? (await this.createSupplier());
    const site = options.site ?? (await this.createSite());
    return this.post(
      "/api/orders",
      orderData({ supplierId: supplier.id, siteId: site.id }, options.overrides),
    );
  }

  /** An invoice for an order: a hire line for its first item and a damage waiver line. */
  async createInvoice(order: Order, overrides: Record<string, unknown> = {}): Promise<Invoice> {
    return this.post(
      "/api/invoices",
      invoiceData(
        {
          supplierId: order.supplier.id,
          jobNo: order.supplierJobNo,
          fleetCode: order.items[0]?.fleetCode,
        },
        overrides,
      ),
    );
  }

  /** An invoice that is not for a known order: only the supplier is known. */
  async createInvoiceForSupplier(
    supplier: Supplier,
    overrides: Record<string, unknown> = {},
  ): Promise<Invoice> {
    return this.post("/api/invoices", invoiceData({ supplierId: supplier.id }, overrides));
  }

  async offHire(orderId: string, body: { offHireDate: string; collectionNo?: string }) {
    return this.post<Order>(`/api/orders/${orderId}/off-hire`, body, 200);
  }

  async createSuspension(
    siteId: string,
    body: { periodFrom: string; periodTo: string; freeDays: number; note?: string },
  ) {
    return this.post<{ id: string }>(`/api/sites/${siteId}/suspensions`, body);
  }

  async getInvoice(id: string): Promise<Invoice> {
    const response = await this.request.get(`/api/invoices/${id}`);
    expect(response.status(), `GET invoice ${id}`).toBe(200);
    return (await response.json()) as Invoice;
  }

  private async post<T>(url: string, data: unknown, expectedStatus = 201): Promise<T> {
    const response = await this.request.post(url, { data });
    expect(response.status(), `POST ${url}: ${await response.text()}`).toBe(expectedStatus);
    return (await response.json()) as T;
  }
}
