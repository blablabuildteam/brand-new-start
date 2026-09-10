import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Regie",
  description: "Van opdracht naar de juiste hiring manager — contracting en permanent.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
