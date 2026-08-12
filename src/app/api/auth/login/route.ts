import { NextResponse } from "next/server";
import { authenticate, COOKIE, signSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = (body.email || "").trim();
  const password = body.password || "";

  const user = authenticate(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Onjuiste e-mail of wachtwoord" },
      { status: 401 }
    );
  }

  const token = await signSession(user);
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
