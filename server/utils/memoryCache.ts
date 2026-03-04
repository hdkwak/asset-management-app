interface CacheEntry<T> {
  value: T;
  expiry: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiry: Date.now() + ttlMs });
}

export function cacheClear(key?: string): void {
  if (key) {
    store.delete(key);
  } else {
    store.clear();
  }
}
