import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { listSites } from "@/server/services/sites";
import { CreateSiteForm } from "./create-site-form";

export const metadata: Metadata = { title: "Sites" };

export default function SitesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <h1 className="text-2xl font-semibold">Sites</h1>
      <Suspense fallback={<p>Loading sites…</p>}>
        <SitesTable />
      </Suspense>
      <section aria-labelledby="add-site-heading" className="flex flex-col gap-3">
        <h2 id="add-site-heading" className="text-lg font-medium">
          Add a site
        </h2>
        <CreateSiteForm />
      </section>
    </main>
  );
}

/** Reads the database, so it runs at request time inside a Suspense boundary. */
async function SitesTable() {
  await connection();
  const sites = await listSites();
  if (sites.length === 0) return <p>No sites yet. Add the first one below.</p>;

  return (
    <table className="w-full border-collapse text-left [&_td]:px-2 [&_th]:px-2">
      <caption className="sr-only">Sites</caption>
      <thead>
        <tr className="border-b border-line-strong">
          <th scope="col" className="py-2">
            Code
          </th>
          <th scope="col">Name</th>
          <th scope="col">Orders on hire</th>
        </tr>
      </thead>
      <tbody>
        {sites.map((site) => (
          <tr key={site.id} className="border-b border-line">
            <td className="py-2">
              <Link href={`/sites/${site.id}`} className="font-medium underline">
                {site.code}
              </Link>
            </td>
            <td>{site.name}</td>
            <td>{site.ordersOnHire}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
