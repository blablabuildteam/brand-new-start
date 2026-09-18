import { Suspense } from "react";
import KansenDesk from "./kansen-desk";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kansen — Recruitment Scout",
  description: "Pipeline van bevestigde en actuele contracting-kansen.",
};

export default function KansenPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-sm text-[var(--muted)]">Laden…</main>}>
      <KansenDesk />
    </Suspense>
  );
}
