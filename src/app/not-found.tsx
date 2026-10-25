import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p>
        The page or record you were looking for does not exist. Go back to the{" "}
        <Link href="/sites" className="underline">
          list of sites
        </Link>
        .
      </p>
    </main>
  );
}
