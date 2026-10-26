import type { Metadata } from "next";
import Link from "next/link";
import { THEME_SCRIPT } from "@/lib/theme";
import { ThemePicker } from "@/app/ui/theme-picker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Hire Tracker", template: "%s | Hire Tracker" },
  description:
    "Tracks hired equipment on construction sites and checks hire invoices for overcharges.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before React hydrates, so the attribute differs on purpose.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
            <nav aria-label="Main" className="flex flex-wrap gap-x-6 gap-y-2">
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
              <Link href="/alerts" className="underline-offset-4 hover:underline">
                Alerts
              </Link>
            </nav>
            <ThemePicker />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
