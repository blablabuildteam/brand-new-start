import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { seedManagedAgencies } from "@/lib/agency";
import { hasAiKey } from "@/lib/ai-client";
import { hasApifyToken } from "@/lib/apify";
import { hasDatabase } from "@/lib/db/client";
import { isDemoUser } from "@/lib/demo-mode";
import { demoSeedWatchlist } from "@/lib/opportunity";
import { hasLushaKey } from "@/lib/lusha";
import {
  EMPLOYMENT_KINDS,
  loadHuntSettings,
  saveHuntSettings,
  type EmploymentKind,
  type ManagedAgency,
} from "@/lib/hunt";
import { normalizeBenchPeople, type BenchPerson } from "@/lib/bench";
import { PRODUCT } from "@/lib/product-brand";
import { listAgencySuggestions } from "@/lib/store";
import { z } from "zod";

const RecruiterZ = z.object({
  name: z.string().min(2).max(80),
  title: z.string().max(80).optional(),
  brand: z.string().max(60).optional(),
  linkedinUrl: z.string().max(200).optional(),
  enabled: z.boolean(),
});

const AgencyZ = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(2).max(80),
  aliases: z.array(z.string()).max(20).optional(),
  note: z.string().max(200).optional(),
  linkedinSlug: z.string().max(80).optional(),
  enabled: z.boolean(),
  custom: z.boolean().optional(),
  recruiters: z.array(RecruiterZ).max(30),
});

const Patch = z.object({
  name: z.string().min(1).max(40).optional(),
  market: z.string().min(1).max(40).optional(),
  roles: z.array(z.string()).max(24).optional(),
  requireContract: z.boolean().optional(),
  employmentKinds: z.array(z.enum(["zzp", "interim", "contract", "detachering"])).max(8).optional(),
  agencies: z.array(AgencyZ).max(40).optional(),
  bench: z.array(z.record(z.string(), z.unknown())).max(80).optional(),
});

function resolveAgencies(hunt: Awaited<ReturnType<typeof loadHuntSettings>>): ManagedAgency[] {
  if (hunt.agencies?.length) return hunt.agencies;
  return seedManagedAgencies(hunt.agencyIds, hunt.recruiterIds);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (isDemoUser(session)) {
    const { demoProspectOf, demoBannerFor } = await import("@/lib/demo-mode");
    const { demoLogoUrl, prospectCalendarUrl } = await import("@/lib/demo-prospects");
    const { prospectWelcome } = await import("@/lib/demo-prospect-data");
    const prospect = demoProspectOf(session);
    const agencies: ManagedAgency[] = demoSeedWatchlist().map((a) => ({
      id: a.id,
      name: a.name,
      aliases: [a.name.toLowerCase()],
      enabled: true,
      recruiters: a.recruiters.map((r) => ({
        name: r.name,
        title: r.title,
        linkedinUrl: r.linkedinUrl,
        enabled: true,
      })),
    }));
    return NextResponse.json({
      name: PRODUCT.name,
      market: prospect ? `${prospect.city} · ${prospect.niche}` : "NL · interim & ZZP",
      roles: prospect
        ? prospect.niche.toLowerCase().includes("security")
          ? ["Security Engineer", "SOC Analyst", "IAM Specialist", "Cloud Security"]
          : ["Java Developer", "Cloud Engineer", "Data Engineer", "Platform Engineer"]
        : ["Scrum Master", "Java Developer", "Cloud Engineer", "Data Engineer"],
      requireContract: true,
      employmentKinds: ["zzp", "interim", "contract"],
      agencies,
      suggestions: [],
      bench: [],
      catalog: { employmentKinds: EMPLOYMENT_KINDS },
      demoMode: true,
      demoBanner: demoBannerFor(session),
      demoProspect: prospect
        ? {
            slug: prospect.slug,
            agencyName: prospect.agencyName,
            contactFirstName: prospect.contactFirstName,
            website: prospect.website,
            logoUrl: demoLogoUrl(prospect),
            brandColor: prospect.brandColor,
            niche: prospect.niche,
            city: prospect.city,
            welcome: prospectWelcome(prospect),
            calendarUrl: prospectCalendarUrl(prospect),
          }
        : null,
      user: { email: session.email, role: session.role, demoSlug: session.demoSlug || null },
    });
  }

  const hunt = await loadHuntSettings();
  const agencies = resolveAgencies(hunt);
  const isAdmin = session.role === "admin";
  const suggestions = await listAgencySuggestions().catch(() => []);
  return NextResponse.json({
    ...hunt,
    agencies,
    suggestions,
    bench: hunt.bench || [],
    catalog: {
      employmentKinds: EMPLOYMENT_KINDS,
    },
    integrations: isAdmin
      ? {
          database: hasDatabase(),
          anthropic: hasAiKey(),
          apify: hasApifyToken(),
          lusha: hasLushaKey(),
          firecrawl: Boolean(process.env.FIRECRAWL_API_KEY?.trim()),
        }
      : undefined,
    user: { email: session.email, role: session.role },
  });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(session)) {
    return NextResponse.json({ error: "Demo · instellingen zijn vast (sample)" }, { status: 403 });
  }
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "ongeldig" }, { status: 400 });
  }
  const hunt = await saveHuntSettings({
    ...parsed.data,
    employmentKinds: parsed.data.employmentKinds as EmploymentKind[] | undefined,
    agencies: parsed.data.agencies as ManagedAgency[] | undefined,
    bench: parsed.data.bench ? normalizeBenchPeople(parsed.data.bench) : undefined,
  });
  return NextResponse.json({
    ...hunt,
    agencies: resolveAgencies(hunt),
    bench: hunt.bench || ([] as BenchPerson[]),
  });
}
