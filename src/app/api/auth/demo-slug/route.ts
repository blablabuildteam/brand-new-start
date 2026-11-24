import { NextResponse } from "next/server";
import { COOKIE, signSession } from "@/lib/auth";
import { DEMO_EMAIL } from "@/lib/demo-mode";
import { getDemoProspect } from "@/lib/demo-prospects";
import { notifyFirstDemoVisit, recordDemoVisit } from "@/lib/demo-analytics";
import { logActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

/** Open een gepersonaliseerde demo via /demo/[slug] — geen wachtwoord. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
  const prospect = getDemoProspect(slug);

  if (!prospect) {
    return NextResponse.redirect(new URL("/demo", req.url));
  }

  let first = false;
  try {
    const visit = await recordDemoVisit(slug);
    first = visit.first;
    if (first) await notifyFirstDemoVisit(slug);
  } catch (err) {
    console.error("demo-slug analytics", err);
  }

  logActivity({
    actorEmail: DEMO_EMAIL,
    actorRole: "recruiter",
    kind: first ? "auth.demo_slug_first" : "auth.demo_slug_login",
    summary: first
      ? `Eerste bezoek demo ${prospect.agencyName} (${slug})`
      : `Demo geopend · ${prospect.agencyName} (${slug})`,
    path: `/demo/${slug}`,
    status: 200,
    detail: { slug, agencyName: prospect.agencyName, first },
  });

  const res = NextResponse.redirect(new URL("/kansen", req.url));
  res.cookies.set(
    COOKIE,
    await signSession({ email: DEMO_EMAIL, role: "recruiter", demoSlug: slug }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    }
  );
  return res;
}
