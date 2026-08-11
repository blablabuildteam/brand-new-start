import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brand New Start — Radar",
  description: "Contracting signal radar — Scrum Master & agile delivery NL",
  icons: { icon: "/assets/bns-logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
