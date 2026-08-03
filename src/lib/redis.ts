// Upstash Redis (HTTP) client and cache accessors used by rate-cache.ts.
// Fail-open by design: without the UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// env vars (or when Redis errors), cacheGet returns null and cacheSet is a no-op,
// so the API keeps working with direct upstream calls.

import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

/** Lazily builds the Upstash Redis client from env, or null when not configured. */
export function getRedis(): Redis | null {
    if (client === undefined) {
        client =
            process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
                ? Redis.fromEnv()
                : null;
    }
    return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
        return await redis.get<T>(key);
    } catch (error) {
        console.warn(`[redis] get "${key}" failed: ${(error as Error).message}`);
        return null;
    }
}

/**
 * Fire-and-forget cache set: the request path never waits on (or fails with) Redis.
 */
export function cacheSet(key: string, value: unknown, ttlSeconds: number): void {
    const redis = getRedis();
    if (!redis) return;
    void (async () => {
        try {
            await redis.set(key, value, { ex: ttlSeconds });
        } catch (error) {
            console.warn(`[redis] set "${key}" failed: ${(error as Error).message}`);
        }
    })();
}

export async function redisOk(): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;
    try {
        await redis.ping();
        return true;
    } catch {
        return false;
    }
}
