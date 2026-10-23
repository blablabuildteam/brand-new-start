import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/lib/auth";
import { logFromSession } from "@/lib/activity-log";
import { AGREEMENT_VERSION, loadBnsSignature, saveBnsSignature, signedCurrent } from "@/lib/agreement";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(3).max(120),
  title: z.string().trim().min(2).max(120),
  accept: z.literal(true),
  version: z.string(),
});

/** Brand New Start tekent de overeenkomst online. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Log in om te tekenen" }, { status: 401 });
  if (isAdmin(session)) {
    return NextResponse.json({ error: "Alleen het Brand New Start-account tekent namens BNS" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Vul naam en functie in en vink akkoord aan" }, { status: 400 });
  if (parsed.data.version !== AGREEMENT_VERSION) {
    return NextResponse.json({ error: "De overeenkomst is net gewijzigd — herlaad de pagina" }, { status: 409 });
  }

  const current = await loadBnsSignature();
  if (signedCurrent(current)) return NextResponse.json({ error: "Al getekend", signature: current }, { status: 409 });

  const signature = {
    name: parsed.data.name,
    title: parsed.data.title,
    email: session.email,
    signedAt: new Date().toISOString(),
    version: AGREEMENT_VERSION,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
  };
  await saveBnsSignature(signature);
  logFromSession(session, {
    kind: "agreement.sign",
    summary: `Overeenkomst getekend · ${signature.name} (${signature.title})`,
    path: "/api/agreement",
    status: 200,
    detail: { version: AGREEMENT_VERSION },
  });
  return NextResponse.json({ ok: true, signature });
}

/** Handtekening intrekken (admin) — bijv. na een nieuwe versie die opnieuw getekend moet worden. */
export async function DELETE() {
  const session = await getSession();
  if (!isAdmin(session)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await saveBnsSignature(null);
  logFromSession(session, {
    kind: "agreement.reset",
    summary: "Handtekening BNS ingetrokken",
    path: "/api/agreement",
    status: 200,
  });
  return NextResponse.json({ ok: true });
}
