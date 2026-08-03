// Shared single-flight dedup: concurrent callers for the same key share one
// in-flight promise instead of stampeding the upstream.

const inFlight = new Map<string, Promise<unknown>>();

/** Runs `loader` once per key; concurrent callers await the same in-flight promise. */
export function singleFlight<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const pending = inFlight.get(key);
    if (pending) return pending as Promise<T>;
    const promise = loader().finally(() => {
        if (inFlight.get(key) === promise) inFlight.delete(key);
    });
    inFlight.set(key, promise);
    return promise;
}
