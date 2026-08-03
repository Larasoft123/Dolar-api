// Next BCV rate lookup.
// The BCV publishes once per business day (~16:30 Caracas) with "Fecha Valor" set to
// the NEXT business day, and bcv.today pre-generates that snapshot. So the next rate
// is already available ahead of time: scan up to 7 calendar days ahead and return the
// first entry whose rate differs from today's. Weekend/holiday fills keep today's rate
// (or 404 before the snapshot exists), so they are skipped naturally.
// Cache-first with fail-open, same pattern as rate-cache.ts: only found rates are cached.

import { BCVTodayError, fetchRateForDate } from "./bcv-today";
import { getBcvRate } from "./rate-cache";
import { cacheGet, cacheSet } from "./redis";
import { cached, type CacheStore } from "../utils/cached";
import type { BCVHistoryEntry } from "./types";

const NEXT_KEY = "rate:bcv:next";
/** The next publication is at most a weekend plus a few holidays away. */
const MAX_LOOKAHEAD_DAYS = 7;
const NEXT_TTL_SECONDS = 12 * 60 * 60;

const store: CacheStore = { get: cacheGet, set: cacheSet };

/** Today's date (YYYY-MM-DD) in the BCV's own timezone, so "next day" is Caracas-local. */
function todayInCaracas(): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Caracas",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Adds whole calendar days to a YYYY-MM-DD string using pure UTC arithmetic. */
function addDays(dateISO: string, days: number): string {
    const date = new Date(`${dateISO}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

/**
 * The next BCV rate (USD/EUR) that differs from the current one.
 * Returns the first snapshot over the next 7 days whose rate is different from today's,
 * or null when no new publication is available yet.
 */
export function getNextBcvRate(cache: boolean = true): Promise<BCVHistoryEntry | null> {
    return cached(
        store,
        NEXT_KEY,
        NEXT_TTL_SECONDS,
        async () => {
            const baseline = await getBcvRate(cache);
            const start = todayInCaracas();

            for (let i = 1; i <= MAX_LOOKAHEAD_DAYS; i++) {
                const date = addDays(start, i);
                let entry: BCVHistoryEntry;
                try {
                    entry = await fetchRateForDate(date);
                } catch (error) {
                    // Snapshot not generated yet (e.g. a holiday or a not-yet-published day).
                    if (error instanceof BCVTodayError && error.status === 404) continue;
                    throw error;
                }
                // Old/fill entries may lack a currency; without both we cannot compare.
                if (entry.USD === undefined || entry.EUR === undefined) continue;
                if (entry.USD !== baseline.USD || entry.EUR !== baseline.EUR) {
                    return entry;
                }
            }
            return null;
        },
        { useCache: cache, cacheWhen: (next) => next !== null },
    );
}
