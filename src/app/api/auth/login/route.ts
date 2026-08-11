import { NextResponse } from "next/server";
import { checkPassword, COOKIE, signSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = (body.email || "recruiter@brandnewstart.nl").trim();
  const password = body.password || "";

  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Onjuist wachtwoord" }, { status: 401 });
  }

  const token = await signSession(email);
  const res = NextResponse.json({ ok: true, email });
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
