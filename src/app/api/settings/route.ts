import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { seedManagedAgencies } from "@/lib/agency";
import {
  EMPLOYMENT_KINDS,
  loadHuntSettings,
  saveHuntSettings,
  type EmploymentKind,
  type ManagedAgency,
} from "@/lib/hunt";
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
});

function resolveAgencies(hunt: Awaited<ReturnType<typeof loadHuntSettings>>): ManagedAgency[] {
  if (hunt.agencies?.length) return hunt.agencies;
  return seedManagedAgencies(hunt.agencyIds, hunt.recruiterIds);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hunt = await loadHuntSettings();
  const agencies = resolveAgencies(hunt);
  return NextResponse.json({
    ...hunt,
    agencies,
    catalog: {
      employmentKinds: EMPLOYMENT_KINDS,
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
    agencies: parsed.data.agencies as ManagedAgency[] | undefined,
  });
  return NextResponse.json({
    ...hunt,
    agencies: resolveAgencies(hunt),
  });
}
