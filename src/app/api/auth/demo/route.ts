import { NextResponse } from "next/server";
import { authenticate, authReady, COOKIE, signSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { DEMO_EMAIL } from "@/lib/demo-mode";

/** Demo-toegang met alleen een wachtwoord — het account staat vast. */
export async function POST(req: Request) {
  if (!authReady()) {
    return NextResponse.json(
      { error: "Inloggen staat tijdelijk uit: de server mist AUTH_SECRET." },
      { status: 503 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const user = authenticate(DEMO_EMAIL, body.password || "");
  if (!user) {
    logActivity({
      actorEmail: DEMO_EMAIL,
      level: "warn",
      kind: "auth.demo_failed",
      summary: "Demo-wachtwoord onjuist",
      path: "/api/auth/demo",
      status: 401,
    });
    return NextResponse.json({ error: "Onjuist wachtwoord" }, { status: 401 });
  }

  logActivity({
    actorEmail: user.email,
    actorRole: user.role,
    kind: "auth.demo_login",
    summary: "Demo geopend",
    path: "/api/auth/demo",
    status: 200,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
