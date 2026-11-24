import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth";
import { canSeePartnerDeal, isDemoUser } from "@/lib/demo-mode";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
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
    const blocked =
      pathname.startsWith("/kosten") ||
      pathname.startsWith("/ops") ||
      pathname.startsWith("/api/costs") ||
      pathname.startsWith("/api/ops");
    if (blocked) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Demo · niet beschikbaar" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/radar", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"],
};
