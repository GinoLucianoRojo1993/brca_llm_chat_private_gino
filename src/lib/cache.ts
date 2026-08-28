/**
 * Caché genérica en memoria con TTL.
 * Best-effort: solo vive mientras la instancia del proceso esté "caliente"
 * (en serverless se pierde entre invocaciones frías, pero reduce llamadas
 * repetidas dentro de la misma instancia).
 */

const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Devuelve el valor cacheado para `key` si sigue vigente; si no, ejecuta
 * `fetcher()`, guarda el resultado con el TTL indicado y lo devuelve.
 */
export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = store.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const value = await fetcher();

  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });

  return value;
}
