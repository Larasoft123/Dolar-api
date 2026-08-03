

import { Ratelimit } from "@upstash/ratelimit";
import { getBcvRate, getUsdt } from "./lib/rate-cache";
import { getNextBcvRate } from "./lib/next-bcv";
import { getRedis, redisOk } from "./lib/redis";
import { HttpError } from "./utils/http";

const WELCOME = "dolar-api: GET /rates, /rates/bcv, /rates/bcv/next, /rates/usdt, /health";


const redis = getRedis();
const ratelimit = redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(75, "1 m") })
    : null;

export default {
    async fetch(req: Request): Promise<Response> {
        try {
            const path = normalizePath(req);
            switch (path) {
                case "/":
                    return new Response(WELCOME);
                case "/rates":
                    return rates(req);
                case "/rates/bcv":
                    return rateRoute(req, (cache) => getBcvRate(cache));
                case "/rates/bcv/next":
                    return bcvNextRoute(req);
                case "/rates/usdt":
                    return rateRoute(req, (cache) => getUsdt(cache));
                case "/health":
                    return Response.json({ status: "ok", redis: await redisOk() });
                default:
                    return new Response("Not Found", { status: 404 });
            }
        } catch (error) {
            // Final safety net: serverless has no Bun.serve error() hook.
            return errorResponse(error);
        }
    },
};

/** Strips a leading "/api" prefix: Vercel rewrites may deliver either form. */
function normalizePath(req: Request): string {
    let path = new URL(req.url).pathname;
    if (path.startsWith("/api")) path = path.slice(4) || "/";
    return path;
}


async function rates(req: Request): Promise<Response> {
    return guard(req, async (cache) => {
        const [bcv, usdt] = await Promise.allSettled([getBcvRate(cache), getUsdt(cache)]);
        if (bcv.status === "rejected" && usdt.status === "rejected") {
            return errorResponse(bcv.reason);
        }

        const body: Record<string, unknown> = {};
        const errors: Record<string, ErrorInfo> = {};
        if (bcv.status === "fulfilled") body.bcv = bcv.value;
        else errors.bcv = errorInfo(bcv.reason);
        if (usdt.status === "fulfilled") body.usdt = usdt.value;
        else errors.usdt = errorInfo(usdt.reason);
        if (Object.keys(errors).length > 0) body.errors = errors;
        return Response.json(body);
    });
}


async function rateRoute(req: Request, load: (cache: boolean) => Promise<unknown>): Promise<Response> {
    return guard(req, async (cache) => Response.json(await load(cache)));
}


/**
 * Next BCV publication (the first snapshot over the coming days whose rate
 * differs from today's). Returns 404 when no new rate has been published yet,
 * so clients can tell "not available yet" apart from a real error.
 */
async function bcvNextRoute(req: Request): Promise<Response> {
    return guard(req, async (cache) => {
        const next = await getNextBcvRate(cache);
        if (!next) {
            return Response.json(
                { error: { code: "NOT_FOUND", message: "No next BCV rate available yet" } },
                { status: 404 },
            );
        }
        return Response.json(next);
    });
}

/**
 * Shared route preamble: resolves the cache flag, enforces rate limiting, and
 * maps any error to a sanitized client-safe response.
 */
async function guard(req: Request, run: (cache: boolean) => Promise<Response>): Promise<Response> {
    const cache = withCache(req);
    const limited = await checkRateLimit(req);
    if (limited) return limited;
    try {
        return await run(cache);
    } catch (error) {
        return errorResponse(error);
    }
}


async function checkRateLimit(req: Request): Promise<Response | null> {
    if (!ratelimit) return null; //
    try {
        const { success, reset } = await ratelimit.limit(clientKey(req));
        if (success) return null;
        const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        return Response.json(
            { error: { code: "RATE_LIMITED", message: "Too many requests" } },
            { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
        );
    } catch (error) {
        // Redis hiccup mid-request: let it through rather than fail the client.
        console.warn(`[ratelimit] check failed: ${(error as Error).message}`);
        return null;
    }
}

/** First element of x-forwarded-for (set by the proxy/platform), or "unknown". */
function clientKey(req: Request): string {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function withCache(req: Request): boolean {
    const { searchParams } = new URL(req.url);
    return searchParams.get("cache") !== "false";
}

interface ErrorInfo {
    code: "UPSTREAM_UNAVAILABLE" | "INTERNAL";
    message: string;
}

/**
 * Maps errors to sanitized, client-safe payloads: upstream HTTP failures are
 * 502, everything else is 500. Never include internal URLs, upstream URLs, or
 * stack traces in response bodies.
 */
function errorInfo(error: unknown): ErrorInfo {
    if (error instanceof HttpError) {
        return { code: "UPSTREAM_UNAVAILABLE", message: "Upstream service unavailable" };
    }
    return { code: "INTERNAL", message: "Internal server error" };
}

function errorResponse(error: unknown): Response {
    if (error instanceof Error) {
        console.error(`[dolar-api] request failed: ${error.name}: ${error.message}`);
    } else {
        console.error("[dolar-api] request failed:", error);
    }
    const info = errorInfo(error);
    return Response.json({ error: info }, { status: info.code === "INTERNAL" ? 500 : 502 });
}
