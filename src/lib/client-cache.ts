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

export function cachePeek<T>(key: string): T | null {
  const hit = store().get(key);
  return hit ? (hit.data as T) : null;
}

export function cacheAge(key: string): number | null {
  const hit = store().get(key);
  if (!hit) return null;
  return Date.now() - hit.at;
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = new Error(`fetch ${url} → ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

/**
 * Cached JSON with stale-while-revalidate.
 * Fresh hit → return immediately.
 * Stale hit → return immediately + revalidate in background (onUpdate).
 * Miss → await network.
 */
export async function cachedJson<T>(
  key: string,
  url: string,
  opts?: {
    ttlMs?: number;
    /** Serve stale up to this age while refreshing (default 5× ttl). */
    staleMs?: number;
    init?: RequestInit;
    onUpdate?: (data: T) => void;
  }
): Promise<T> {
  const ttl = opts?.ttlMs ?? 60_000;
  const staleMs = opts?.staleMs ?? ttl * 5;
  const age = cacheAge(key);
  const peek = cachePeek<T>(key);

  if (peek != null && age != null && age <= ttl) {
    return peek;
  }

  if (peek != null && age != null && age <= staleMs) {
    void fetchJson<T>(url, opts?.init)
      .then((data) => {
        cacheSet(key, data);
        opts?.onUpdate?.(data);
      })
      .catch(() => null);
    return peek;
  }

  const data = await fetchJson<T>(url, opts?.init);
  cacheSet(key, data);
  return data;
}

/** Fire-and-forget prefetch for snappy nav. */
export function prefetchJson(key: string, url: string, ttlMs = 90_000) {
  const age = cacheAge(key);
  if (age != null && age < ttlMs * 0.7) return;
  void fetchJson(url)
    .then((data) => cacheSet(key, data))
    .catch(() => null);
}
