import { NextResponse } from "next/server";
import { authenticate, COOKIE, signSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = (body.email || "").trim();
  const password = body.password || "";

  const user = authenticate(email, password);
  if (!user) {
    logActivity({
      actorEmail: email || null,
      level: "warn",
      kind: "auth.login_failed",
      summary: `Login mislukt · ${(email || "?").slice(0, 80)}`,
      path: "/api/auth/login",
      status: 401,
    });
    return NextResponse.json(
      { error: "Onjuiste e-mail of wachtwoord" },
      { status: 401 }
    );
  }

  const token = await signSession(user);
  logActivity({
    actorEmail: user.email,
    actorRole: user.role,
    kind: "auth.login",
    summary: `Ingelogd · ${user.email}`,
    path: "/api/auth/login",
    status: 200,
  });
  const res = NextResponse.json({ ok: true, email: user.email, role: user.role });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
