// Client for the bcv.today API (https://bcv.today/api)
// Free, key-less JSON endpoints with the official BCV exchange rates for USD and EUR.
// No caching here: every call hits the upstream directly.
// The API serves static files behind GitHub's CDN, so we send cache: "no-cache" to force a fresh read.

import { CONFIG } from "../config";
import { fetchJson, HttpError } from "../utils";
import type { BCVHistoryEntry, BCVRate, BCVStatus } from "./types";

const { BASE_URL, TIMEOUT_MS } = CONFIG.BCV_TODAY;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class BCVTodayError extends HttpError {
    constructor(url: string, status: number, statusText: string) {
        super(`bcv.today request failed: GET ${url} -> ${status} ${statusText}`, status, statusText, url);
        this.name = "BCVTodayError";
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = /^https?:\/\//.test(path) ? path : `${BASE_URL}${path}`;
    try {
        return await fetchJson<T>(url, { cache: "no-cache", ...init }, TIMEOUT_MS);
    } catch (error) {
        if (error instanceof HttpError) {
            throw new BCVTodayError(url, error.status ?? 0, error.statusText ?? "");
        }
        throw error;
    }
}

/** Guards the current-rate payload so a broken upstream fails fast with a clear message. */
function assertRate(rate: unknown): asserts rate is BCVRate {
    if (typeof rate !== "object" || rate === null) {
        throw new TypeError("bcv.today returned an unexpected payload");
    }
    const record = rate as Record<string, unknown>;
    if (typeof record.USD !== "number" || typeof record.EUR !== "number") {
        throw new TypeError("bcv.today response is missing USD or EUR");
    }
    if (
        typeof record.updated_at !== "string" ||
        typeof record.effective_date !== "string" ||
        typeof record.date !== "string"
    ) {
        throw new TypeError("bcv.today response is missing date metadata");
    }
}

/** Latest official BCV rate: dollar and euro with date metadata. */
export async function fetchCurrentRate(init?: RequestInit): Promise<BCVRate> {
    const rate = await request<BCVRate>("/rate.json", init);
    assertRate(rate);
    const { USD, EUR, updated_at, effective_date, date, source } = rate;
    return { USD, EUR, updated_at, effective_date, date, source };
}

/** Daily historical entries (up to the last 1830 days), oldest first. */
export async function fetchHistory(init?: RequestInit): Promise<BCVHistoryEntry[]> {
    return request<BCVHistoryEntry[]>("/history.json", init);
}

export function isValidDate(value: string): boolean {
    if (!DATE_PATTERN.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Snapshot for a specific calendar date (YYYY-MM-DD). Throws if the date has no entry. */
export async function fetchRateForDate(date: string, init?: RequestInit): Promise<BCVHistoryEntry> {
    if (!isValidDate(date)) {
        throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
    }
    return request<BCVHistoryEntry>(`/history/${date}.json`, init);
}

/** Dataset status: freshness, effective date, supported currencies. */
export async function fetchStatus(init?: RequestInit): Promise<BCVStatus> {
    return request<BCVStatus>("/status.json", init);
}
