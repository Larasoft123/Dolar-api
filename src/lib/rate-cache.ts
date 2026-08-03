import { fetchCurrentRate } from "./bcv-today";
import { getUsdtQuote } from "./binance-p2p";
import { cacheGet, cacheSet } from "./redis";
import { cached, type CacheStore } from "../utils/cached";
import type { BCVRate, UsdtQuote } from "./types";

const BCV_KEY = "rate:bcv";
const USDT_KEY = "rate:usdt";

const BCV_TTL_SECONDS = 12 * 60 * 60;

const USDT_TTL_SECONDS = 60 * 60;

const store: CacheStore = { get: cacheGet, set: cacheSet };

/** Latest BCV rate (USD/EUR), cached for up to 12 hours. */
export function getBcvRate(cache: boolean = true): Promise<BCVRate> {
    return cached(store, BCV_KEY, BCV_TTL_SECONDS, fetchCurrentRate, { useCache: cache });
}

/** Binance P2P USDT quote (buy/sell/mid), cached for up to 1 hour. */
export function getUsdt(cache: boolean = true): Promise<UsdtQuote> {
    return cached(store, USDT_KEY, USDT_TTL_SECONDS, getUsdtQuote, { useCache: cache });
}
