import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hire Tracker",
  description:
    "Tracks hired equipment on construction sites and checks hire invoices for overcharges.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
