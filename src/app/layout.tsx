import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Regie — Recruitment-desk",
  description: "Werving & selectie en contracting: opdrachten, eindklant, hiring manager, voorstel.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
