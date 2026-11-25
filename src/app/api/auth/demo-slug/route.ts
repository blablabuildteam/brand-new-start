import { NextResponse } from "next/server";
import { authReady, COOKIE, signSession, verifySession } from "@/lib/auth";
import { DEMO_EMAIL } from "@/lib/demo-mode";
import { getDemoProspect } from "@/lib/demo-prospects";
import { demoAnalyticsEnabled, notifyFirstDemoVisit, recordDemoVisit } from "@/lib/demo-analytics";
import { logActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

/** Open een gepersonaliseerde demo via /demo/[slug] — geen wachtwoord. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
  const prospect = getDemoProspect(slug);

  if (!prospect || !authReady()) {
    return NextResponse.redirect(new URL("/demo", req.url));
  }

  // Admin die de link zelf test (of een open voorvertoning): niet meetellen en geen melding sturen.
  const current = await verifySession(
    req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`))?.[1]
  );
  const preview = current?.role === "admin" || Boolean(current?.demoPreview);

  let first = false;
  if (!preview && demoAnalyticsEnabled()) {
    try {
      const visit = await recordDemoVisit(slug);
      first = visit.first;
      if (first) await notifyFirstDemoVisit(slug);
    } catch (err) {
      console.error("demo-slug analytics", err);
    }
  }

  logActivity({
    actorEmail: DEMO_EMAIL,
    actorRole: "recruiter",
    kind: first ? "auth.demo_slug_first" : "auth.demo_slug_login",
    summary: preview
      ? `Voorvertoning demo ${prospect.agencyName} (${slug})`
      : first
      ? `Eerste bezoek demo ${prospect.agencyName} (${slug})`
      : `Demo geopend · ${prospect.agencyName} (${slug})`,
    path: `/demo/${slug}`,
    status: 200,
    detail: { slug, agencyName: prospect.agencyName, first, preview },
  });

  // Start op Recruiter feed: vage posts → daarna Kansen (Jobboards is leeg in de demo).
  const res = NextResponse.redirect(new URL("/leads", req.url));
  res.cookies.set(
    COOKIE,
    await signSession({ email: DEMO_EMAIL, role: "recruiter", demoSlug: slug, demoPreview: preview }),
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
