import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listActionQueue, listCrmOpportunities } from "@/lib/crm";
import { isDemoUser } from "@/lib/demo-mode";
import { getDemoCrmPayload, listDemoLeads } from "@/lib/demo-workspace";
import { listAgencyLeads } from "@/lib/opportunity";
import { listRadar } from "@/lib/store";

export const runtime = "nodejs";

/** Unified desk index for ⌘K — next actions, kansen, radar, bureau-leads. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (isDemoUser(session)) {
    const crm = getDemoCrmPayload(session.demoSlug);
    const leads = listDemoLeads(session.demoSlug).filter((l) => l.status !== "rejected");
    return NextResponse.json({
      actions: (crm.actionQueue || []).slice(0, 8).map((a) => ({
        id: a.id,
        title: a.endClient,
        subtitle: `${a.roleLabel} · ${a.nextAction}`,
        href: a.nextHref,
        kind: "action" as const,
      })),
      kansen: crm.items.slice(0, 24).map((c) => ({
        id: c.id,
        title: c.endClient,
        subtitle: [c.roleLabel, c.hiringManager || "geen HM", c.lane === "bureau" ? "Recruiter feed" : "Jobboards"]
          .filter(Boolean)
          .join(" · "),
        href: `/kansen?id=${encodeURIComponent(c.id)}`,
        kind: "kans" as const,
      })),
      radar: [],
      leads: leads.slice(0, 20).map((l) => ({
        id: l.id,
        title: l.confirmedClient || l.guess?.name || l.title,
        subtitle: `${l.agency.name} · ${l.roleLabel}`,
        href: l.status === "confirmed" ? `/kansen?id=${encodeURIComponent(`crm_bureau_${l.id}`)}` : "/leads",
        kind: "lead" as const,
      })),
      demoMode: true,
    });
  }

  const [crm, leads, radar] = await Promise.all([
    listCrmOpportunities(),
    listAgencyLeads(),
    listRadar().catch(() => []),
  ]);
  const actions = listActionQueue(crm);

  return NextResponse.json({
    actions: actions.slice(0, 8).map((a) => ({
      id: a.id,
      title: a.endClient,
      subtitle: `${a.roleLabel} · ${a.nextAction}`,
      href: a.nextHref,
      kind: "action" as const,
    })),
    kansen: crm.slice(0, 24).map((c) => ({
      id: c.id,
      title: c.endClient,
      subtitle: [c.roleLabel, c.hiringManager || "geen HM", c.lane === "bureau" ? "Recruiter feed" : "Jobboards"]
        .filter(Boolean)
        .join(" · "),
      href: `/kansen?id=${encodeURIComponent(c.id)}`,
      kind: "kans" as const,
    })),
    radar: radar.slice(0, 20).map((r) => ({
      id: r.id,
      title: r.company.name,
      subtitle: `${r.roleLabel || r.openingTitle || "Opening"} · kans ${r.kans}`,
      href: `/radar?id=${encodeURIComponent(r.id)}`,
      kind: "radar" as const,
    })),
    leads: [...leads.live, ...leads.demo]
      .filter((l) => l.status !== "rejected")
      .slice(0, 20)
      .map((l) => ({
        id: l.id,
        title: l.confirmedClient || l.guess?.name || l.title,
        subtitle: `${l.agency.name} · ${l.roleLabel}`,
        href: l.status === "confirmed" ? `/kansen?id=${encodeURIComponent(`crm_bureau_${l.id}`)}` : "/leads",
        kind: "lead" as const,
      })),
  });
}
