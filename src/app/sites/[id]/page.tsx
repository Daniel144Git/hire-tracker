import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotFoundError } from "@/server/errors";
import { listOrders, type OrderDto } from "@/server/services/orders";
import { getSite, type SiteDto } from "@/server/services/sites";
import { listSuppliers } from "@/server/services/suppliers";
import { listSuspensions } from "@/server/services/suspensions";
import { getOnHireRegister, type OnHireRegister } from "@/server/services/register";
import { formatPounds } from "@/app/invoices/format";
import { SuspensionForm } from "./suspension-form";
import { AliasesForm } from "./aliases-form";
import { FleetCodeForm } from "./fleet-code-form";
import { CreateOrderForm } from "./create-order-form";
import { CollectionForm, OffHireForm } from "./order-forms";

export const metadata: Metadata = { title: "Site" };

export default function SitePage({ params }: PageProps<"/sites/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <Suspense fallback={<p>Loading site…</p>}>
        <SiteDetails params={params} />
      </Suspense>
    </main>
  );
}

async function SiteDetails({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const site = await findSite(id);
  const [orders, suppliers, suspensions, register] = await Promise.all([
    listOrders({ siteId: id }),
    listSuppliers(),
    listSuspensions(id),
    getOnHireRegister(id),
  ]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {site.code} - {site.name}
        </h1>
        {site.deliveryAddress && <p>{site.deliveryAddress}</p>}
        <p>{site.ordersOnHire} on hire</p>
      </div>

      <section aria-labelledby="on-hire-heading" className="flex flex-col gap-3">
        <h2 id="on-hire-heading" className="text-lg font-medium">
          On hire now
        </h2>
        <OnHireTable register={register} />
      </section>

      <section aria-labelledby="orders-heading" className="flex flex-col gap-3">
        <h2 id="orders-heading" className="text-lg font-medium">
          Hire orders
        </h2>
        {orders.length === 0 ? (
          <p>No hire orders on this site yet.</p>
        ) : (
          <OrdersTable orders={orders} />
        )}
      </section>

      <section aria-labelledby="fleet-code-heading" className="flex flex-col gap-3">
        <h2 id="fleet-code-heading" className="text-lg font-medium">
          Record a new fleet code (item swapped)
        </h2>
        <FleetCodeForm
          items={orders.flatMap((order) =>
            order.items.map((item) => ({
              value: `${order.id}/${item.id}`,
              label: `${order.supplierJobNo}: ${item.description}${item.fleetCode ? ` (${item.fleetCode})` : ""}`,
            })),
          )}
        />
      </section>

      <section aria-labelledby="aliases-heading" className="flex flex-col gap-3">
        <h2 id="aliases-heading" className="text-lg font-medium">
          How suppliers write this site
        </h2>
        <p className="text-sm">
          Invoices that are not linked to an order are matched to a site by these spellings of the
          customer reference, then by name, code and postcode.
        </p>
        <AliasesForm siteId={site.id} aliases={site.aliases} />
      </section>

      <section aria-labelledby="suspensions-heading" className="flex flex-col gap-3">
        <h2 id="suspensions-heading" className="text-lg font-medium">
          Hire suspensions
        </h2>
        {suspensions.length === 0 ? (
          <p>No suspensions recorded for this site.</p>
        ) : (
          <table className="w-full border-collapse text-left [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
            <caption className="sr-only">Hire suspensions</caption>
            <thead>
              <tr className="border-b border-gray-400">
                <th scope="col">Period</th>
                <th scope="col">Free days</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {suspensions.map((suspension) => (
                <tr key={suspension.id} className="border-b border-gray-200">
                  <th scope="row" className="py-2 font-normal whitespace-nowrap">
                    {suspension.periodFrom} to {suspension.periodTo}
                  </th>
                  <td>{suspension.freeDays}</td>
                  <td>{suspension.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <SuspensionForm siteId={site.id} />
      </section>

      <section aria-labelledby="new-order-heading" className="flex flex-col gap-3">
        <h2 id="new-order-heading" className="text-lg font-medium">
          New hire order
        </h2>
        <CreateOrderForm
          siteId={site.id}
          suppliers={suppliers.map(({ id, name }) => ({ id, name }))}
        />
      </section>
    </>
  );
}

async function findSite(id: string): Promise<SiteDto> {
  try {
    return await getSite(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

const STATUS_LABEL: Record<OrderDto["status"], string> = {
  ON_HIRE: "On hire",
  OFF_HIRED: "Off hired",
  COLLECTED: "Collected",
};

function OrdersTable({ orders }: { orders: OrderDto[] }) {
  return (
    <table className="w-full border-collapse text-left align-top [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
      <caption className="sr-only">Hire orders on this site</caption>
      <thead>
        <tr className="border-b border-gray-400">
          <th scope="col" className="py-2">
            Job no
          </th>
          <th scope="col">Items</th>
          <th scope="col">Trade</th>
          <th scope="col">Start</th>
          <th scope="col">Status</th>
          <th scope="col">Off-hire</th>
          <th scope="col">Collection no</th>
          <th scope="col">Our ref</th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id} className="border-b border-gray-200 align-top">
            <th scope="row" className="py-2 font-medium">
              {order.supplierJobNo}
            </th>
            <td>
              <ul>
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.qty > 1 && `${item.qty} x `}
                    {item.description}
                    {item.fleetCode && ` (${item.fleetCode})`} £{item.weeklyRate.toFixed(2)}/wk
                    {item.fleetCodeHistory.length > 0 &&
                      ` (was ${item.fleetCodeHistory.map((change) => change.oldCode).join(", ")})`}
                  </li>
                ))}
              </ul>
            </td>
            <td>{order.trade}</td>
            <td className="whitespace-nowrap">{order.startDate}</td>
            <td className="whitespace-nowrap">{STATUS_LABEL[order.status]}</td>
            <td className="whitespace-nowrap">{order.offHireDate ?? "-"}</td>
            <td>{order.collectionNo ?? "-"}</td>
            <td>{order.orderRef ?? "-"}</td>
            <td>
              {order.status === "ON_HIRE" && (
                <OffHireForm orderId={order.id} jobNo={order.supplierJobNo} />
              )}
              {order.status === "OFF_HIRED" && (
                <CollectionForm orderId={order.id} jobNo={order.supplierJobNo} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const REGISTER_STATUS: Record<string, string> = {
  ON_HIRE: "On hire",
  OFF_HIRED: "Off hired, awaiting collection",
};

/** The on-hire register: what is on site today, since when, and what it has cost so far. */
function OnHireTable({ register }: { register: OnHireRegister }) {
  const { rows, totals, asOf } = register;
  if (rows.length === 0) return <p>Nothing is on hire on this site.</p>;
  return (
    <table className="w-full border-collapse text-left align-top [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
      <caption className="text-left text-sm">As of {asOf}, at the agreed rates</caption>
      <thead>
        <tr className="border-b border-gray-400">
          <th scope="col">Item</th>
          <th scope="col">Job no</th>
          <th scope="col">Since</th>
          <th scope="col">Days on hire</th>
          <th scope="col">Working days</th>
          <th scope="col" className="text-right">
            Cost to date
          </th>
          <th scope="col" className="text-right">
            Billed
          </th>
          <th scope="col" className="text-right">
            Not yet billed
          </th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.itemId} className="border-b border-gray-200 align-top">
            <th scope="row" className="py-2 font-normal">
              {row.qty > 1 && `${row.qty} x `}
              {row.description}
              {row.fleetCode && ` (${row.fleetCode})`}
            </th>
            <td>{row.supplierJobNo}</td>
            <td className="whitespace-nowrap">{row.startDate}</td>
            <td>{row.calendarDaysOnHire}</td>
            <td>{row.chargeableDays}</td>
            <td className="text-right whitespace-nowrap">{formatPounds(row.costToDate)}</td>
            <td className="text-right whitespace-nowrap">{formatPounds(row.billedToDate)}</td>
            <td className="text-right whitespace-nowrap">{formatPounds(row.notYetBilled)}</td>
            <td>{REGISTER_STATUS[row.status]}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="font-medium">
          <th scope="row" className="py-2">
            Total ({totals.items} {totals.items === 1 ? "item" : "items"})
          </th>
          <td colSpan={4} />
          <td className="text-right whitespace-nowrap">{formatPounds(totals.costToDate)}</td>
          <td className="text-right whitespace-nowrap">{formatPounds(totals.billedToDate)}</td>
          <td className="text-right whitespace-nowrap">{formatPounds(totals.notYetBilled)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
