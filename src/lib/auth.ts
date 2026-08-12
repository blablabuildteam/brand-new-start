const COOKIE = "bns_session";

export type UserRole = "admin" | "recruiter";

export type SessionUser = {
  email: string;
  role: UserRole;
};

type Account = {
  role: UserRole;
  passwordEnv: string;
  fallback: string;
};

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
  },
};

function secret() {
  return process.env.AUTH_SECRET || "bns-dev-secret-change-me";
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

async function hmac(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
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
  if (!account) return null;
  const expected = process.env[account.passwordEnv] || account.fallback;
  if (!secureEqual(password, expected)) return null;
  return { email: key, role: account.role };
}

export async function signSession(user: SessionUser) {
  const payload = toBase64Url(
    new TextEncoder().encode(JSON.stringify({ email: user.email, role: user.role, t: Date.now() }))
  );
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(payload);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const data = JSON.parse(fromBase64Url(payload)) as {
      email: string;
      role?: UserRole;
      t: number;
    };
    if (Date.now() - data.t > 30 * 24 * 60 * 60 * 1000) return null;
    const email = normalizeEmail(data.email);
    const role = ACCOUNTS[email]?.role || data.role || "recruiter";
    if (!ACCOUNTS[email]) return null;
    return { email, role };
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

/** @deprecated Use authenticate() — kept for callers that only check recruiter password. */
export function checkPassword(input: string) {
  const expected = process.env.RECRUITER_PASSWORD || "bns-demo";
  return secureEqual(input, expected);
}

export { COOKIE, ACCOUNTS };
