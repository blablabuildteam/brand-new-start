import { Suspense } from "react";
import KansenDesk from "./kansen-desk";
import { listActionQueue, listCrmOpportunities } from "@/lib/crm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kansen — Regie",
  description: "Pipeline van bevestigde en actuele contracting-kansen.",
};

export default async function KansenPage() {
  const items = await listCrmOpportunities();
  const actionQueue = listActionQueue(items);
  const initial = {
    items,
    actionQueue,
    counts: {
      all: items.length,
      bureau: items.filter((i) => i.lane === "bureau").length,
      direct: items.filter((i) => i.lane === "direct").length,
      withHm: items.filter((i) => i.hiringManager).length,
      byStage: {
        nieuw: items.filter((i) => i.stage === "nieuw").length,
        bevestigd: items.filter((i) => i.stage === "bevestigd").length,
        hm: items.filter((i) => i.stage === "hm").length,
        outreach: items.filter((i) => i.stage === "outreach").length,
        won: items.filter((i) => i.stage === "won").length,
        lost: items.filter((i) => i.stage === "lost").length,
      },
    },
  };
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-sm text-[var(--muted)]">Laden…</main>}>
      <KansenDesk initial={initial} />
    </Suspense>
  );
}
