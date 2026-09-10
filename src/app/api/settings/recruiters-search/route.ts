import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { agencyCatalog } from "@/lib/agency";
import { loadHuntSettings } from "@/lib/hunt";
import { searchAgencyRecruiters } from "@/lib/ingest/people-search";
import { linkedinPeopleAtCompany } from "@/lib/approach";

export const maxDuration = 120;

const Body = z.object({
  agencyId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  await loadHuntSettings();
  const agency = agencyCatalog().find((a) => a.id === parsed.data.agencyId);
  if (!agency) return NextResponse.json({ error: "bureau niet gevonden" }, { status: 404 });

  const companyLinkedinUrl = agency.linkedinSlug
    ? `https://www.linkedin.com/company/${agency.linkedinSlug}`
    : null;

  const result = await searchAgencyRecruiters({
    company: agency.name,
    companyLinkedinUrl,
  });

  const linkedinBrowse = linkedinPeopleAtCompany({
    company: agency.name,
    companyLinkedinUrl,
    keywords: "recruiter OR consultant",
  });

  if (result.detail === "no-apify-token") {
    return NextResponse.json({
      ok: false,
      error: "Geen Apify-token — open LinkedIn of zet APIFY_TOKEN.",
      detail: result.detail,
      people: [],
      linkedinBrowse,
    });
  }

  if (result.detail === "no-company-linkedin" && !result.people.length) {
    return NextResponse.json({
      ok: false,
      error: "Geen LinkedIn-bedrijfspagina voor dit bureau.",
      detail: result.detail,
      people: [],
      linkedinBrowse,
    });
  }

  return NextResponse.json({
    ok: true,
    people: result.people,
    fetched: result.fetched,
    detail: result.detail,
    linkedinBrowse,
  });
}
