import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { listDemoDashboard } from "@/lib/demo-analytics";
import { listDemoProspects } from "@/lib/demo-prospects";
import { AppShell } from "@/components/app-shell";
import { DemoAdminDesk } from "./demo-admin-desk";

export const metadata: Metadata = {
  title: "Demo's — Recruitment Scout",
  description: "Activiteit per gepersonaliseerde demo-link.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDemosPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fadmin%2Fdemos");
  if (!isAdmin(session)) redirect("/");

  let rows = [] as Awaited<ReturnType<typeof listDemoDashboard>>;
  let error: string | null = null;
  try {
    rows = await listDemoDashboard();
  } catch (err) {
    console.error(err);
    error = "Analytics niet geladen — check DATABASE_URL.";
    rows = listDemoProspects().map((p) => ({
      slug: p.slug,
      agencyName: p.agencyName,
      contactFirstName: p.contactFirstName,
      niche: p.niche,
      city: p.city,
      opened: false,
      firstVisitAt: null,
      lastVisitAt: null,
      visitCount: 0,
      totalSeconds: 0,
      clickCount: 0,
      clickedIds: {},
      engagement: 0,
      engagementLabel: "geen" as const,
    }));
  }

  return (
    <AppShell current="demos" title="Demo's" subtitle="Wie opende de link, en wie ging echt aan de slag?">
      <DemoAdminDesk initial={rows} error={error} />
    </AppShell>
  );
}
