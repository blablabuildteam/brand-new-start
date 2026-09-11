import KansenDesk from "./kansen-desk";
import { listCrmOpportunities } from "@/lib/crm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kansen — Regie",
  description: "Pipeline van bevestigde en actuele contracting-kansen.",
};

export default async function KansenPage() {
  const items = await listCrmOpportunities();
  const initial = {
    items,
    counts: {
      all: items.length,
      bureau: items.filter((i) => i.lane === "bureau").length,
      direct: items.filter((i) => i.lane === "direct").length,
      withHm: items.filter((i) => i.hiringManager).length,
    },
  };
  return <KansenDesk initial={initial} />;
}
