import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth";
import { canSeePartnerDeal, isDemoUser } from "@/lib/demo-mode";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname === "/demo" ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/waitlist") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname.startsWith("/apple-icon")
  ) {
    return NextResponse.next();
  }

  // Route handlers check the cron secret or session themselves.
  if (pathname.startsWith("/api/ingest") || pathname === "/api/ops/health") {
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Partner-deal en ops alleen voor admin/BNS — nooit voor de publieke demo.
  const partnerOnly =
    pathname.startsWith("/samenwerking") ||
    pathname.startsWith("/pilot") ||
    pathname.startsWith("/api/agreement");
  if (partnerOnly && !canSeePartnerDeal(session)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/radar", req.url));
  }

  if (isDemoUser(session)) {
    if (pathname.startsWith("/kosten") || pathname.startsWith("/ops")) {
      return NextResponse.redirect(new URL("/radar", req.url));
    }
    if (pathname.startsWith("/api/")) return demoApi(req);
  }

  return NextResponse.next();
}

/** Routes die zelf een demo-antwoord geven (sample data, geen live BNS-data). */
const DEMO_API_PASS = new Set([
  "/api/radar",
  "/api/leads",
  "/api/crm",
  "/api/sync",
  "/api/settings",
  "/api/placement",
  "/api/ops/presence",
  "/api/ops/client-error",
]);

/** Leeg maar geldig voor de UI — de demo ziet nooit live meldingen, lijsten of zoekindex. */
const DEMO_API_EMPTY: Record<string, unknown> = {
  "/api/alerts": { alerts: [], unread: 0 },
  "/api/desk/index": { actions: [], kansen: [], radar: [], leads: [] },
  "/api/radar/lucky": {
    shots: [],
    tracked: 0,
    trackingSince: null,
    rules: { luckyDays: 90, watchDays: 45, activeDays: 21 },
    firstLuckyAt: null,
  },
  "/api/radar/reject-company": { rejected: [] },
  "/api/companies/park": { parked: [] },
};

function demoApi(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (DEMO_API_PASS.has(pathname)) return NextResponse.next();
  const empty = DEMO_API_EMPTY[pathname];
  if (empty) {
    return req.method === "GET"
      ? NextResponse.json({ ...(empty as object), demoMode: true })
      : NextResponse.json({ ...(empty as object), ok: true, demoMode: true });
  }
  return NextResponse.json(
    { error: "Dit staat uit in de demo.", message: "Dit staat uit in de demo.", demoMode: true },
    { status: 403 }
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"],
};
