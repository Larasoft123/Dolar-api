// Generic cache-first accessor: read-through cache with single-flight loads.
// Kept dependency-free: the caller injects the cache backend (see lib/redis.ts).

import { singleFlight } from "./single-flight";

/** Minimal cache port implemented by any cache backend. */
export interface CacheStore {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds: number): void;
}

export interface CachedOptions<T> {
    /** Skip the cache read when false (e.g. ?cache=false). Defaults to true. */
    useCache?: boolean;
    /** Write through only when this predicate passes (e.g. non-null values). Defaults to always. */
    cacheWhen?: (value: T) => boolean;
}

/** Read-through cache accessor with single-flight upstream loads. */
export async function cached<T>(
    store: CacheStore,
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
    options: CachedOptions<T> = {},
): Promise<T> {
    if (options.useCache !== false) {
        const hit = await store.get<T>(key);
        if (hit !== null) return hit;
    }
    return singleFlight(key, async () => {
        const value = await loader();
        if (!options.cacheWhen || options.cacheWhen(value)) {
            store.set(key, value, ttlSeconds);
        }
        return value;
    });
}
