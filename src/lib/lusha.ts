/** Lusha V3 — mail/tel ná een LinkedIn-profiel. Nooit bulk, nooit zonder klik. */

export type LushaStatus = "ok" | "empty" | "restricted";

export type LushaContact = {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  creditsCharged: number;
  status: LushaStatus;
  detail: string;
};

type LushaEmail = { email?: string; type?: string };
type LushaPhone = { number?: string; type?: string; doNotCall?: boolean };
type LushaResult = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: { title?: string };
  emails?: LushaEmail[];
  phones?: LushaPhone[];
  error?: { code?: string; message?: string };
};

function key() {
  return process.env.LUSHA_API_KEY?.trim() || "";
}

export function hasLushaKey() {
  return Boolean(key());
}

export function normalizeLinkedinProfile(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const href = /^(https?:)?\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(href);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/in\/([^/?#]+)/i);
    if (!m?.[1]) return null;
    return `https://www.linkedin.com/in/${decodeURIComponent(m[1]).replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

function pickEmail(rows: LushaEmail[] | undefined): string | null {
  if (!rows?.length) return null;
  const work = rows.find((e) => e.type === "work" && e.email);
  const unknown = rows.find((e) => e.type !== "private" && e.email);
  return (work || unknown || rows[0])?.email?.trim() || null;
}

function pickPhone(rows: LushaPhone[] | undefined): string | null {
  if (!rows?.length) return null;
  const usable = rows.filter((p) => p.number && !p.doNotCall);
  const order = ["mobile", "direct", "work", "unknown"];
  usable.sort((a, b) => order.indexOf(a.type || "unknown") - order.indexOf(b.type || "unknown"));
  return usable[0]?.number?.trim() || null;
}

export async function enrichByLinkedin(linkedinUrl: string): Promise<LushaContact> {
  const profile = normalizeLinkedinProfile(linkedinUrl);
  if (!profile) {
    return {
      name: null,
      title: null,
      email: null,
      phone: null,
      creditsCharged: 0,
      status: "empty",
      detail: "geen-linkedin-profiel",
    };
  }
  if (!hasLushaKey()) {
    return {
      name: null,
      title: null,
      email: null,
      phone: null,
      creditsCharged: 0,
      status: "empty",
      detail: "no-lusha-key",
    };
  }

  const res = await fetch("https://api.lusha.com/v3/contacts/search-and-enrich", {
    method: "POST",
    headers: {
      api_key: key(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contacts: [{ linkedinUrl: profile }],
      reveal: ["emails", "phones"],
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    results?: LushaResult[];
    billing?: { creditsCharged?: number };
    message?: string;
  };

  if (res.status === 401 || res.status === 403) {
    throw new Error("Lusha-key ongeldig of geen toegang.");
  }
  if (res.status === 402) {
    throw new Error("Lusha-credits op.");
  }
  if (!res.ok) {
    throw new Error((json.message || `Lusha ${res.status}`).slice(0, 180));
  }

  const row = json.results?.[0];
  const credits = typeof json.billing?.creditsCharged === "number" ? json.billing.creditsCharged : 0;
  if (!row) {
    return {
      name: null,
      title: null,
      email: null,
      phone: null,
      creditsCharged: credits,
      status: "empty",
      detail: "niet-gevonden",
    };
  }
  if (row.error?.code === "COMPLIANCE_RESTRICTED") {
    return {
      name: row.fullName || null,
      title: row.jobTitle?.title || null,
      email: null,
      phone: null,
      creditsCharged: credits,
      status: "restricted",
      detail: "compliance",
    };
  }
  if (row.error) {
    return {
      name: row.fullName || null,
      title: row.jobTitle?.title || null,
      email: null,
      phone: null,
      creditsCharged: credits,
      status: "empty",
      detail: row.error.code || "niet-gevonden",
    };
  }

  const email = pickEmail(row.emails);
  const phone = pickPhone(row.phones);
  const name = row.fullName || [row.firstName, row.lastName].filter(Boolean).join(" ") || null;
  return {
    name,
    title: row.jobTitle?.title || null,
    email,
    phone,
    creditsCharged: credits,
    status: email || phone ? "ok" : "empty",
    detail: email || phone ? "ok" : "geen-contact",
  };
}
