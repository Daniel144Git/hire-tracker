import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Hire Tracker", template: "%s | Hire Tracker" },
  description:
    "Tracks hired equipment on construction sites and checks hire invoices for overcharges.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-gray-300">
          <nav aria-label="Main" className="mx-auto flex max-w-5xl gap-6 px-6 py-3">
            <Link href="/" className="font-semibold">
              Hire Tracker
            </Link>
            <Link href="/sites" className="underline-offset-4 hover:underline">
              Sites
            </Link>
            <Link href="/invoices" className="underline-offset-4 hover:underline">
              Invoices
            </Link>
            <Link href="/reports/discrepancies" className="underline-offset-4 hover:underline">
              Discrepancies
            </Link>
            <Link href="/reports/costs" className="underline-offset-4 hover:underline">
              Costs
            </Link>
            <Link href="/payments" className="underline-offset-4 hover:underline">
              Payments
            </Link>
            <Link href="/statements" className="underline-offset-4 hover:underline">
              Statements
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
