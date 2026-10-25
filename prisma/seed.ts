// Demo data: everything here is fictional (Apex Plant Hire, the sites, job numbers, fleet codes).
//
// The data goes through the same services as the app, so the reconciliation checks run on it
// exactly as they would on real invoices. It deliberately contains supplier mistakes, so that
// every check has something to find. The table in the README lists them.
//
// Safe to run twice: when the demo invoices already exist, nothing is added.
// `npm run db:reset` recreates the development database with this data.
import "dotenv/config";
import { countChargeableDays } from "../src/lib/charging/working-days";
import { splitWeeksAndDays } from "../src/lib/charging/hire-charge";
import { ENGLAND_AND_WALES_BANK_HOLIDAYS } from "../src/lib/charging/uk-bank-holidays";
import { round2 } from "../src/lib/money";
import { db } from "../src/server/db";
import { createInvoice, updateInvoiceStatus } from "../src/server/services/invoices";
import { createOrder, offHireOrder, type OrderDto } from "../src/server/services/orders";
import { createSuspension } from "../src/server/services/suspensions";

const rules = { chargeBankHolidays: true, bankHolidays: ENGLAND_AND_WALES_BANK_HOLIDAYS };

type Item = OrderDto["items"][number];
type Line = {
  description: string;
  fleetCode?: string;
  qty?: number;
  periodFrom?: string;
  periodTo?: string;
  weeks?: number;
  days?: number;
  rate?: number;
  chargeType: "HIRE" | "DAMAGE_WAIVER" | "TRANSPORT" | "OTHER";
  net: number;
  vat: number;
};

const vatOf = (net: number) => round2(net * 0.2);

/** A hire line as the supplier prints it: the days of the printed period at `rate`. */
function hire(item: Item, from: string, to: string, rate = item.weeklyRate, sign = 1): Line {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const { weeks, days } = splitWeeksAndDays(countChargeableDays(a, b, rules));
  const net = sign * round2(weeks * rate + days * (rate / 5));
  return {
    description: item.description,
    fleetCode: item.fleetCode ?? undefined,
    periodFrom: from,
    periodTo: to,
    weeks,
    days,
    rate,
    chargeType: "HIRE",
    net,
    vat: vatOf(net),
  };
}

const transport = (description: string, net: number, vat = vatOf(net)): Line => ({
  description,
  chargeType: "TRANSPORT",
  net,
  vat,
});

/** A 10% damage waiver on the hire lines, unless the amount printed is given. */
function waiver(lines: Line[], printed?: number): Line {
  const hireTotal = lines.filter((l) => l.chargeType === "HIRE").reduce((s, l) => s + l.net, 0);
  const net = printed ?? round2(hireTotal * 0.1);
  return { description: "Damage waiver 10%", chargeType: "DAMAGE_WAIVER", net, vat: vatOf(net) };
}

/** Header totals as the sums of the lines. */
function totals(lines: Line[]) {
  const net = round2(lines.reduce((s, l) => s + l.net, 0));
  const vat = round2(lines.reduce((s, l) => s + l.vat, 0));
  return { net, vat, gross: round2(net + vat) };
}

async function main() {
  const apex = await db.supplier.upsert({
    where: { name: "Apex Plant Hire" },
    update: {},
    create: { name: "Apex Plant Hire", accountNo: "APX-000123", damageWaiverPct: 10 },
  });
  if ((await db.invoice.count({ where: { supplierId: apex.id } })) > 0) {
    console.log("Demo data already present. Run `npm run db:reset` to start again.");
    return;
  }

  const site = async (code: string, name: string, deliveryAddress: string) =>
    db.site.upsert({ where: { code }, update: {}, create: { code, name, deliveryAddress } });
  const rvs = await site("RVS", "Riverside Tower", "1 Riverside Walk, Northport NP1 1AA");
  const mlp = await site("MLP", "Mill Lane Primary School", "Mill Lane, Easton EA4 2BB");
  const ngw = await site("NGW", "Northgate Wharf", "Wharf Road, Northport NP3 7CC");

  const order = (
    siteId: string,
    supplierJobNo: string,
    trade: string,
    startDate: string,
    items: object[],
  ) => createOrder({ supplierId: apex.id, siteId, supplierJobNo, trade, startDate, items });

  const j100101 = await order(rvs.id, "J100101", "MECH", "2026-07-01", [
    {
      description: "Scissor lift 19ft electric",
      fleetCode: "APX-SL-1042",
      weeklyRate: 50,
      despatchDate: "2026-07-01",
    },
    {
      description: "Pipe groover 2-6in",
      fleetCode: "APX-PG-0317",
      weeklyRate: 41.29,
      despatchDate: "2026-07-01",
    },
  ]);
  const j100102 = await order(rvs.id, "J100102", "ELEC", "2026-08-13", [
    {
      description: "Mobile platform 3m",
      fleetCode: "APX-MP-0588",
      weeklyRate: 35,
      despatchDate: "2026-08-13",
    },
    {
      description: "Outrigger adaptor",
      fleetCode: "APX-AD-0021",
      weeklyRate: 3.75,
      isAccessory: true,
    },
  ]);
  const j100201 = await order(mlp.id, "J100201", "VENT", "2026-07-06", [
    {
      description: "Scissor lift 26ft",
      fleetCode: "APX-SL-2610",
      weeklyRate: 65,
      despatchDate: "2026-07-06",
    },
  ]);
  const j100301 = await order(ngw.id, "J100301", "BMS", "2026-07-01", [
    {
      description: "Tower scaffold",
      fleetCode: "APX-TS-0101",
      weeklyRate: 80,
      despatchDate: "2026-07-01",
    },
    {
      description: "Outrigger adaptor",
      fleetCode: "APX-AD-0044",
      weeklyRate: 3.5,
      isAccessory: true,
    },
  ]);
  const [lift, groover] = j100101.items;
  const [platform, adaptor] = j100102.items;
  const [lift26] = j100201.items;
  const [tower, adaptorNgw] = j100301.items;

  await offHireOrder(j100201.id, { offHireDate: "2026-08-12", collectionNo: "C-5521" });
  await offHireOrder(j100102.id, { offHireDate: "2026-08-27" });
  await createSuspension(ngw.id, {
    periodFrom: "2026-08-10",
    periodTo: "2026-08-21",
    freeDays: 10,
    note: "Site closed for the crane lift",
  });

  const invoice = async (
    number: string,
    date: string,
    type: "CONTINUATION" | "RETURN",
    jobNo: string,
    lines: Line[],
    extra: { lastInvoiceNo?: string; isCreditNote?: boolean; customerRef?: string } = {},
  ) =>
    createInvoice({
      supplierId: apex.id,
      number,
      date,
      type,
      jobNo,
      customerRef: extra.customerRef ?? jobNo,
      ...extra,
      ...totals(lines),
      lines,
    });

  // July: three correct invoices, all paid.
  let lines = [hire(lift, "2026-07-01", "2026-07-31"), hire(groover, "2026-07-01", "2026-07-31")];
  const july1 = await invoice(
    "APX-20701",
    "2026-07-31",
    "CONTINUATION",
    "J100101",
    [...lines, waiver(lines)],
    { customerRef: "RIVERSIDE" },
  );
  lines = [hire(lift26, "2026-07-06", "2026-07-31")];
  const july2 = await invoice(
    "APX-20702",
    "2026-07-31",
    "CONTINUATION",
    "J100201",
    [...lines, waiver(lines)],
    { customerRef: "Mill Lane School" },
  );
  // R12: the adaptor is £3.50/week here and £3.75/week on J100102.
  lines = [hire(tower, "2026-07-01", "2026-07-31"), hire(adaptorNgw, "2026-07-01", "2026-07-31")];
  const july3 = await invoice(
    "APX-20703",
    "2026-07-31",
    "CONTINUATION",
    "J100301",
    [...lines, waiver(lines)],
    { customerRef: "NORTHGATE" },
  );

  // R6 the lift at £52.50/week instead of £50.00, R14 "last invoice" APX-20799 is not the
  // previous invoice (APX-20701), R15 the pipe groover disappeared with no return invoice.
  lines = [hire(lift, "2026-08-01", "2026-08-31", 52.5)];
  await invoice("APX-20817", "2026-08-31", "CONTINUATION", "J100101", [...lines, waiver(lines)], {
    lastInvoiceNo: "APX-20799",
    customerRef: "Riverside Tower",
  });

  // R17: the collection is charged twice (a failed first attempt).
  lines = [hire(lift26, "2026-08-01", "2026-08-12")];
  await invoice(
    "APX-20830",
    "2026-08-20",
    "RETURN",
    "J100201",
    [
      ...lines,
      transport("Collection", 45),
      transport("Collection (second attempt)", 45),
      waiver(lines),
    ],
    { lastInvoiceNo: "APX-20702" },
  );

  // R2 the platform billed from 10 Aug, delivered 13 Aug; R1 both items billed past the
  // off-hire on 27 Aug (credited below); R10 VAT of £9.01 on the £45.00 delivery.
  lines = [hire(platform, "2026-08-10", "2026-08-31"), hire(adaptor, "2026-08-13", "2026-08-31")];
  await invoice("APX-20819", "2026-08-31", "CONTINUATION", "J100102", [
    ...lines,
    transport("Delivery", 45, 9.01),
    waiver(lines),
  ]);

  // R16 no credit for the 10 suspension days, R8 a generator that is on no order, R13 a damage
  // waiver of £50.00 instead of £47.67, R15 the generator is new on the job.
  lines = [
    hire(tower, "2026-08-01", "2026-08-31"),
    hire(adaptorNgw, "2026-08-01", "2026-08-31"),
    {
      ...hire(tower, "2026-08-01", "2026-08-31", 30),
      description: "Generator 20kVA",
      fleetCode: "APX-GN-0099",
    },
  ];
  const queried = await invoice(
    "APX-20820",
    "2026-08-31",
    "CONTINUATION",
    "J100301",
    [...lines, waiver(lines, 50)],
    { lastInvoiceNo: "APX-20703" },
  );

  // The credit note for the platform and adaptor billed after the off-hire: it closes R1.
  lines = [
    hire(platform, "2026-08-31", "2026-08-28", 35, -1),
    hire(adaptor, "2026-08-31", "2026-08-28", 3.75, -1),
  ];
  await invoice("C-20901", "2026-09-10", "RETURN", "J100102", [...lines, waiver(lines)], {
    isCreditNote: true,
  });

  // R3 the lift billed again for 15-31 Aug, already on APX-20817; R5 at £52.50 instead of £50.00.
  lines = [hire(lift, "2026-08-15", "2026-08-31", 52.5)];
  await invoice("APX-20905", "2026-09-05", "CONTINUATION", "J100101", [...lines, waiver(lines)]);

  // R7 a continuation after the return invoice, and R1 billed a month after the off-hire.
  lines = [hire(lift26, "2026-09-01", "2026-09-30")];
  await invoice("APX-20931", "2026-09-30", "CONTINUATION", "J100201", [...lines, waiver(lines)], {
    lastInvoiceNo: "APX-20830",
  });

  // Payments: July is paid; the NGW invoice with the most findings is queried with the supplier.
  for (const paid of [july1, july2, july3]) {
    await updateInvoiceStatus(paid.id, { paymentStatus: "PAID" });
  }
  await updateInvoiceStatus(queried.id, { paymentStatus: "QUERIED", checkStatus: "QUERIED" });

  // R4 shows in the September report: J100101 and J100301 are on hire with no September invoice.
  console.log("Seeded Apex Plant Hire: 3 sites, 4 hire orders, 10 invoices with demo findings.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
