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
  /** Client mag company-URL meesturen (nog niet opgeslagen / net toegevoegd). */
  companyLinkedinUrl: z.string().url().optional(),
  companyName: z.string().min(2).max(120).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ongeldig" }, { status: 400 });

  await loadHuntSettings();
  const agency = agencyCatalog().find((a) => a.id === parsed.data.agencyId);
  const company = parsed.data.companyName || agency?.name;
  if (!company) return NextResponse.json({ error: "bureau niet gevonden" }, { status: 404 });

  const fromClient = parsed.data.companyLinkedinUrl?.includes("linkedin.com/company/")
    ? parsed.data.companyLinkedinUrl.split("?")[0]
    : null;
  const companyLinkedinUrl =
    fromClient ||
    (agency?.linkedinSlug ? `https://www.linkedin.com/company/${agency.linkedinSlug}` : null);

  const result = await searchAgencyRecruiters({
    company,
    companyLinkedinUrl,
  });

  const linkedinBrowse = linkedinPeopleAtCompany({
    company,
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
