// Demo data. Everything here is fictional: Apex Plant Hire, the sites, job numbers and fleet codes.
// Safe to run more than once: records are upserted by their natural keys.
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

async function main() {
  const apex = await db.supplier.upsert({
    where: { name: "Apex Plant Hire" },
    update: {},
    create: { name: "Apex Plant Hire", accountNo: "APX-000123", damageWaiverPct: 10 },
  });

  const sites = [
    {
      code: "RVS",
      name: "Riverside Tower",
      deliveryAddress: "1 Riverside Walk, Northport NP1 1AA",
    },
    { code: "MLP", name: "Mill Lane Primary School", deliveryAddress: "Mill Lane, Easton EA4 2BB" },
    { code: "NGW", name: "Northgate Wharf", deliveryAddress: "Wharf Road, Northport NP3 7CC" },
  ];
  for (const site of sites) {
    await db.site.upsert({ where: { code: site.code }, update: {}, create: site });
  }
  const riverside = await db.site.findUniqueOrThrow({ where: { code: "RVS" } });

  const orders = [
    {
      supplierJobNo: "J100101",
      trade: "MECH" as const,
      startDate: "2026-07-01",
      items: [
        {
          description: "Scissor lift 19ft electric",
          fleetCode: "APX-SL-1042",
          weeklyRatePence: 5000,
        },
        {
          description: "Pipe groover 2-6in",
          fleetCode: "APX-PG-0317",
          weeklyRatePence: 4129,
          isAccessory: false,
        },
      ],
    },
    {
      supplierJobNo: "J100102",
      trade: "ELEC" as const,
      startDate: "2026-08-13",
      items: [
        {
          description: "Mobile platform 3m",
          fleetCode: "APX-MP-0588",
          weeklyRatePence: 3500,
        },
        {
          description: "Outrigger adaptor",
          fleetCode: "APX-AD-0021",
          weeklyRatePence: 375,
          isAccessory: true,
        },
      ],
    },
  ];
  for (const { items, ...order } of orders) {
    const existing = await db.hireOrder.findUnique({
      where: {
        supplierId_supplierJobNo: { supplierId: apex.id, supplierJobNo: order.supplierJobNo },
      },
    });
    if (existing) continue;
    await db.hireOrder.create({
      data: {
        ...order,
        supplierId: apex.id,
        siteId: riverside.id,
        damageWaiverApplies: true,
        items: { create: items.map((item) => ({ ...item, despatchDate: order.startDate })) },
      },
    });
  }

  console.log("Seeded: 1 supplier, 3 sites, 2 hire orders on RVS - Riverside Tower");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
