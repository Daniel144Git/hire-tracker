import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { alertsQuerySchema, getHireAlerts } from "@/server/services/alerts";
import { buttonClass } from "@/app/ui/field";
import { formatPounds } from "@/app/invoices/format";
import type { HireAlertKind } from "@/lib/register/alerts";
import { FilterSelect } from "@/app/ui/filters";
import { listSites } from "@/server/services/sites";
import { listSuppliers } from "@/server/services/suppliers";

export const metadata: Metadata = { title: "Alerts" };

const KIND_LABEL: Record<HireAlertKind, string> = {
  NOT_COLLECTED: "Not collected",
  LONG_HIRE: "Long hire",
  COSTLY: "Costly",
};

export default function AlertsPage({ searchParams }: PageProps<"/alerts">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      <Suspense fallback={<p>Loading alerts…</p>}>
        <Alerts searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const inputClass = "w-28 rounded border border-line-strong bg-background px-2 py-1";

async function Alerts({ searchParams }: { searchParams: PageProps<"/alerts">["searchParams"] }) {
  await connection();
  const params = Object.fromEntries(
    Object.entries(await searchParams).filter(([, value]) => typeof value === "string" && value),
  );
  const parsed = alertsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return (
      <p role="alert" className="text-red-700 dark:text-red-400">
        Check the limits: whole days, and a cost of zero or more.
      </p>
    );
  }
  const [{ asOf, settings, alerts }, suppliers, sites] = await Promise.all([
    getHireAlerts(parsed.data),
    listSuppliers(),
    listSites(),
  ]);

  return (
    <>
      <form method="get" aria-label="Alert limits" className="flex flex-wrap items-end gap-3">
        {[
          ["longHireDays", "Long hire from (days)", settings.longHireDays],
          ["costLimit", "Costly from (£)", settings.costLimit],
          ["collectionDays", "Collection overdue after (days)", settings.collectionDays],
        ].map(([name, label, value]) => (
          <div key={name} className="flex flex-col gap-1">
            <label htmlFor={`alerts-${name}`} className="text-sm font-medium">
              {label}
            </label>
            <input
              id={`alerts-${name}`}
              name={String(name)}
              type="number"
              min={0}
              defaultValue={value}
              className={inputClass}
            />
          </div>
        ))}
        <FilterSelect
          id="alerts-supplier"
          name="supplierId"
          label="Supplier"
          allLabel="All suppliers"
          value={parsed.data.supplierId}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          id="alerts-site"
          name="siteId"
          label="Site"
          allLabel="All sites"
          value={parsed.data.siteId}
          options={sites.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` }))}
        />
        <button type="submit" className={buttonClass}>
          Show
        </button>
      </form>
      <p data-testid="alerts-summary">
        {alerts.length === 0
          ? `No alerts as of ${asOf}.`
          : `${alerts.length} ${alerts.length === 1 ? "alert" : "alerts"} as of ${asOf}.`}
      </p>
      {alerts.length > 0 && (
        <table className="w-full border-collapse text-left align-top [&_td]:px-2 [&_td]:py-2 [&_th]:px-2">
          <caption className="sr-only">Alerts</caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col">Site</th>
              <th scope="col">Alert</th>
              <th scope="col">Job no</th>
              <th scope="col">What to do</th>
              <th scope="col" className="text-right">
                Cost to date
              </th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={`${alert.kind}-${alert.itemId}`} className="border-b border-line align-top">
                <th scope="row" className="py-2 font-medium">
                  <Link href={`/sites/${alert.site.id}`} className="underline">
                    {alert.site.code}
                  </Link>
                </th>
                <td className="whitespace-nowrap">{KIND_LABEL[alert.kind]}</td>
                <td>{alert.supplierJobNo}</td>
                <td>{alert.message}</td>
                <td className="text-right whitespace-nowrap">{formatPounds(alert.costToDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
