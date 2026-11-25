const COOKIE = "bns_session";

export type UserRole = "admin" | "recruiter";

export type SessionUser = {
  email: string;
  role: UserRole;
  /** Personalized /demo/[slug] — alleen gezet voor het publieke demo-account. */
  demoSlug?: string;
  /** Demo geopend door een admin (voorvertoning): niet meetellen in demo-statistieken. */
  demoPreview?: boolean;
};

type Account = {
  role: UserRole;
  passwordEnv: string;
  /** Alleen lokaal (next dev). In productie moet het wachtwoord in de env staan. */
  fallback: string;
  /** Gesloten: inloggen kan niet en bestaande sessies vervallen direct. */
  disabled?: boolean;
};

/**
 * Reservewachtwoorden en -sleutel staan in deze (publieke) repo en mogen dus
 * nooit toegang geven op een gedeployde omgeving: daar is alleen de env leidend.
 */
function devFallbacksAllowed() {
  return process.env.NODE_ENV !== "production";
}

/** Known logins. Email bepaalt de rechten; wachtwoord per account via env. */
const ACCOUNTS: Record<string, Account> = {
  "admin@blablabuild.com": {
    role: "admin",
    passwordEnv: "ADMIN_PASSWORD",
    fallback: "bns-admin",
  },
  "recruiter@brandnewstart.nl": {
    role: "recruiter",
    passwordEnv: "RECRUITER_PASSWORD",
    fallback: "bns-demo",
    disabled: true,
  },
  /** Publieke demo — sample data, geen BNS-branding of live sync. */
  "demo@blablabuild.com": {
    role: "recruiter",
    passwordEnv: "DEMO_PASSWORD",
    fallback: "scout-demo",
  },
};

function secret(): string | null {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv?.trim()) return fromEnv;
  if (devFallbacksAllowed()) return "bns-dev-secret-change-me";
  console.error("AUTH_SECRET ontbreekt: inloggen staat uit tot hij in de env staat.");
  return null;
}

/** Kan deze omgeving sessies tekenen? (Productie zonder AUTH_SECRET: nee.) */
export function authReady() {
  return Boolean(process.env.AUTH_SECRET?.trim()) || devFallbacksAllowed();
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmac(payload: string): Promise<string | null> {
  const k = secret();
  if (!k) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(k),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

function secureEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function listAccounts() {
  return Object.entries(ACCOUNTS).map(([email, a]) => ({ email, role: a.role }));
}

export function roleForEmail(email: string): UserRole | null {
  return ACCOUNTS[normalizeEmail(email)]?.role ?? null;
}

export function authenticate(
  email: string,
  password: string
): SessionUser | null {
  const key = normalizeEmail(email);
  const account = ACCOUNTS[key];
  if (!account || account.disabled) return null;
  const fromEnv = process.env[account.passwordEnv];
  const expected = fromEnv?.trim() ? fromEnv : devFallbacksAllowed() ? account.fallback : null;
  if (!expected) {
    console.error(`${account.passwordEnv} ontbreekt: login voor ${key} staat uit.`);
    return null;
  }
  if (!password || !secureEqual(password, expected)) return null;
  return { email: key, role: account.role };
}

export async function signSession(user: SessionUser) {
  const body: Record<string, unknown> = {
    email: user.email,
    role: user.role,
    t: Date.now(),
  };
  if (user.demoSlug) body.demoSlug = user.demoSlug;
  if (user.demoPreview) body.demoPreview = true;
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  const sig = await hmac(payload);
  if (!sig) throw new Error("AUTH_SECRET ontbreekt");
  return `${payload}.${sig}`;
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(payload);
  if (!expected || sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const data = JSON.parse(fromBase64Url(payload)) as {
      email: string;
      role?: UserRole;
      demoSlug?: string;
      demoPreview?: boolean;
      t: number;
    };
    if (Date.now() - data.t > 30 * 24 * 60 * 60 * 1000) return null;
    const email = normalizeEmail(data.email);
    const role = ACCOUNTS[email]?.role || data.role || "recruiter";
    if (!ACCOUNTS[email] || ACCOUNTS[email]!.disabled) return null;
    const demoSlug =
      email === "demo@blablabuild.com" && typeof data.demoSlug === "string" && data.demoSlug.trim()
        ? data.demoSlug.trim().toLowerCase()
        : undefined;
    if (!demoSlug) return { email, role };
    return data.demoPreview ? { email, role, demoSlug, demoPreview: true } : { email, role, demoSlug };
  } catch {
    return null;
  }
}

export async function getSession() {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return verifySession(jar.get(COOKIE)?.value);
}

export function isAdmin(session: SessionUser | null | undefined) {
  return session?.role === "admin";
}

export { COOKIE, ACCOUNTS };
