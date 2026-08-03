// Client for the public Binance P2P ad-search API (USDT/VES).
// Returns buy / sell / average prices from verified merchants.
// The endpoint is the same one the Binance P2P website uses: no API key, no auth.
// No caching here: every call hits the upstream directly.

import { CONFIG } from "../config";
import { fetchJson, HttpError, mean, median } from "../utils";
import type { P2PAd, P2PTradeType, UsdtQuote } from "./types";

const { SEARCH_URL, TIMEOUT_MS } = CONFIG.BINANCE_P2P;

/** Binance tends to serve a friendlier response to a browser-like User-Agent. */
const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Ads fetched per side. */
const ROWS = 10;
/** Best ads used for the reference price. */
const TOP_N = 5;

export class BinanceP2PError extends HttpError {
    constructor(
        message: string,
        public readonly code: string = "UNKNOWN",
        status?: number,
    ) {
        super(message, status);
        this.name = "BinanceP2PError";
    }
}

async function searchP2PAds(tradeType: P2PTradeType): Promise<P2PAd[]> {
    let payload: {
        code?: string;
        message?: string | null;
        data?: P2PAd[];
        success?: boolean;
    };
    try {
        payload = await fetchJson(
            SEARCH_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": BROWSER_UA,
                },
                body: JSON.stringify({
                    page: 1,
                    rows: ROWS,
                    asset: "USDT",
                    fiat: "VES",
                    tradeType,
                    payTypes: [],
                    publisherType: "merchant",
                }),
            },
            TIMEOUT_MS,
        );
    } catch (error) {
        if (error instanceof HttpError) {
            throw new BinanceP2PError(error.message, `HTTP_${error.status ?? 0}`, error.status);
        }
        throw error;
    }

    if (!payload.success || payload.code !== "000000") {
        throw new BinanceP2PError(
            `Binance P2P returned code ${payload.code}: ${payload.message ?? "unknown error"}`,
            payload.code ?? "UNKNOWN",
        );
    }

    return payload.data ?? [];
}

/** Reference price for one side: median of the best ads (cheapest to buy, highest to sell). */
async function referencePrice(tradeType: P2PTradeType): Promise<number> {
    const ads = await searchP2PAds(tradeType);
    const prices = ads
        .map((ad) => Number.parseFloat(ad.adv.price))
        .filter((price) => Number.isFinite(price));
    if (prices.length === 0) {
        throw new BinanceP2PError(`No P2P ads returned for tradeType "${tradeType}"`);
    }
    prices.sort((a, b) => (tradeType === "BUY" ? a - b : b - a));
    return median(prices.slice(0, TOP_N));
}

/** Buy / sell / average USDT/VES quote from verified Binance P2P merchants. */
export async function getUsdtQuote(): Promise<UsdtQuote> {
    const [buy, sell] = await Promise.all([referencePrice("BUY"), referencePrice("SELL")]);
    return { buy, sell, mid: mean([buy, sell]), updated_at: new Date().toISOString() };
}
