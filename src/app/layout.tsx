import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recruitment Scout — Opdrachtkansen spotten. Business opvolgen.",
  description: "Private desk voor recruitment: interim- en ZZP-opdrachtkansen spotten en opvolgen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ebe5d8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
