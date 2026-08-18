import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Regie — Contracting radar",
  description: "Contract- en ZZP-kansen vinden, hiring manager koppelen, voorstel klaarzetten.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
