// Shared HTTP helpers: JSON fetch with default timeout and a uniform error type.

/** Single source of truth for the default upstream request timeout. */
export const DEFAULT_TIMEOUT_MS = 10_000;

export class HttpError extends Error {
    constructor(
        message: string,
        public readonly status?: number,
        public readonly statusText?: string,
        public readonly url?: string,
    ) {
        super(message);
        this.name = "HttpError";
    }
}

/** Fetch a URL and parse JSON, throwing HttpError on any non-2xx response. */
export async function fetchJson<T>(
    url: string,
    init: RequestInit = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
    const res = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
        throw new HttpError(
            `HTTP ${res.status} ${res.statusText} for ${init.method ?? "GET"} ${url}`,
            res.status,
            res.statusText,
            url,
        );
    }
    return (await res.json()) as T;
}
