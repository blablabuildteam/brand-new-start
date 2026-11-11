import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { workspaceSettings } from "@/lib/db/schema";

const PRESENCE_ID = "usage-presence";
const SESSION_GAP_MS = 15 * 60_000;
const MAX_SESSIONS = 400;

export type PresenceSession = {
  id: string;
  email: string;
  role: string | null;
  startedAt: string;
  lastAt: string;
  paths: Record<string, number>;
  pings: number;
};

type Stored = { sessions: PresenceSession[] };

const g = globalThis as unknown as { __bnsPresence?: Stored };

function empty(): Stored {
  return { sessions: [] };
}

async function loadRaw(): Promise<Stored> {
  if (!hasDatabase()) return g.__bnsPresence || empty();
  try {
    const rows = await getDb()
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.id, PRESENCE_ID))
      .limit(1);
    const data = rows[0]?.data as unknown as Stored | undefined;
    return {
      sessions: Array.isArray(data?.sessions) ? data!.sessions : [],
    };
  } catch {
    return empty();
  }
}

async function saveRaw(data: Stored) {
  if (!hasDatabase()) {
    g.__bnsPresence = data;
    return;
  }
  const value = data as unknown as typeof workspaceSettings.$inferInsert.data;
  await getDb()
    .insert(workspaceSettings)
    .values({ id: PRESENCE_ID, data: value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: workspaceSettings.id,
      set: { data: value, updatedAt: new Date() },
    });
}

export async function loadPresence(): Promise<Stored> {
  return loadRaw();
}

/** Verleng of start een sessie. Aanroepen vanuit de beacon (zichtbare tab). */
export async function pingPresence(input: {
  email: string;
  role: string | null;
  path: string;
}): Promise<PresenceSession> {
  const now = new Date().toISOString();
  const path = (input.path || "/").slice(0, 120);
  const data = await loadRaw();
  const email = input.email.toLowerCase();

  let cur = [...data.sessions]
    .reverse()
    .find((s) => s.email.toLowerCase() === email);

  if (cur && new Date(now).getTime() - new Date(cur.lastAt).getTime() <= SESSION_GAP_MS) {
    cur = {
      ...cur,
      lastAt: now,
      role: input.role || cur.role,
      pings: cur.pings + 1,
      paths: { ...cur.paths, [path]: (cur.paths[path] || 0) + 1 },
    };
    data.sessions = data.sessions.map((s) => (s.id === cur!.id ? cur! : s));
  } else {
    cur = {
      id: `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      email: input.email,
      role: input.role,
      startedAt: now,
      lastAt: now,
      paths: { [path]: 1 },
      pings: 1,
    };
    data.sessions.push(cur);
  }

  data.sessions = data.sessions.slice(-MAX_SESSIONS);
  await saveRaw(data);
  return cur;
}
