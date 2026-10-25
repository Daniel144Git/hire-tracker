export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">Hire Tracker</h1>
      <p className="text-lg">
        Tracks equipment on hire for construction sites and checks every hire
        invoice against what was actually on site.
      </p>
      <section aria-labelledby="checks-heading" className="flex flex-col gap-3">
        <h2 id="checks-heading" className="text-xl font-medium">
          What it checks
        </h2>
        <ul className="list-disc pl-6">
          <li>Items billed after they went off hire</li>
          <li>Periods billed twice or missing</li>
          <li>Rates that changed without agreement</li>
          <li>VAT and invoice totals that do not add up</li>
        </ul>
      </section>
    </main>
  );
}
