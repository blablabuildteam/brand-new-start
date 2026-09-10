import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AGENCY_WATCHLIST, allAgencyIds, allRecruiterIds } from "@/lib/agency";
import {
  EMPLOYMENT_KINDS,
  loadHuntSettings,
  recruiterKey,
  saveHuntSettings,
  type EmploymentKind,
} from "@/lib/hunt";
import { PLATFORM_TARGETS, defaultCompanyIds } from "@/lib/platforms";
import { z } from "zod";

const Patch = z.object({
  name: z.string().min(1).max(40).optional(),
  market: z.string().min(1).max(40).optional(),
  roles: z.array(z.string()).max(24).optional(),
  requireContract: z.boolean().optional(),
  employmentKinds: z.array(z.enum(["zzp", "interim", "contract", "detachering"])).max(8).optional(),
  agencyIds: z.array(z.string()).max(40).optional(),
  recruiterIds: z.array(z.string()).max(80).optional(),
  companyIds: z.array(z.string()).max(40).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hunt = await loadHuntSettings();
  return NextResponse.json({
    ...hunt,
    agencyIds: hunt.agencyIds ?? allAgencyIds(),
    recruiterIds: hunt.recruiterIds ?? allRecruiterIds(),
    companyIds: hunt.companyIds ?? defaultCompanyIds(),
    catalog: {
      employmentKinds: EMPLOYMENT_KINDS,
      agencies: AGENCY_WATCHLIST.map((a) => ({
        id: a.id,
        name: a.name,
        note: a.note,
        recruiters: a.recruiters.map((r) => ({
          id: recruiterKey(a.id, r.name),
          name: r.name,
          title: r.title,
          brand: r.brand,
        })),
      })),
      companies: PLATFORM_TARGETS.map((p) => ({
        id: p.id,
        name: p.company,
        label: p.label,
        sector: p.sector,
      })),
    },
    user: { email: session.email, role: session.role },
  });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "ongeldig" }, { status: 400 });
  }
  const hunt = await saveHuntSettings({
    ...parsed.data,
    employmentKinds: parsed.data.employmentKinds as EmploymentKind[] | undefined,
  });
  return NextResponse.json({
    ...hunt,
    agencyIds: hunt.agencyIds ?? allAgencyIds(),
    recruiterIds: hunt.recruiterIds ?? allRecruiterIds(),
    companyIds: hunt.companyIds ?? defaultCompanyIds(),
  });
}
