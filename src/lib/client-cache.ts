/** In-memory client cache so workspace nav feels instant after the first fetch. */
type Entry = { at: number; data: unknown };

const g = globalThis as unknown as { __regieCache?: Map<string, Entry> };

function store() {
  if (!g.__regieCache) g.__regieCache = new Map();
  return g.__regieCache;
}

export function cacheGet<T>(key: string, ttlMs = 60_000): T | null {
  const hit = store().get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    store().delete(key);
    return null;
  }
  return hit.data as T;
}

export function cacheSet(key: string, data: unknown) {
  store().set(key, { at: Date.now(), data });
}

export function cacheClear(prefix?: string) {
  if (!prefix) {
    store().clear();
    return;
  }
  for (const k of store().keys()) {
    if (k.startsWith(prefix)) store().delete(k);
  }
}

export async function cachedJson<T>(
  key: string,
  url: string,
  opts?: { ttlMs?: number; init?: RequestInit }
): Promise<T> {
  const ttl = opts?.ttlMs ?? 60_000;
  const hit = cacheGet<T>(key, ttl);
  if (hit) return hit;
  const res = await fetch(url, opts?.init);
  if (!res.ok) {
    const err = new Error(`fetch ${url} → ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const data = (await res.json()) as T;
  cacheSet(key, data);
  return data;
}
