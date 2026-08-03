// Types for the bcv.today API client.
// Only the currencies we care about (USD, EUR) are part of the public contract.

/** Common metadata carried by every BCV snapshot. */
export interface BCVSnapshot {
    updated_at: string;
    effective_date: string;
    date: string;
    source?: string;
}

/** Current-rate response shape (GET /rate.json). */
export interface BCVRate extends BCVSnapshot {
    USD: number;
    EUR: number;
}

/**
 * Historical snapshot shape (GET /history.json and /history/{YYYY-MM-DD}.json).
 * Old entries may omit a currency that was not available in the original source.
 */
export interface BCVHistoryEntry extends BCVSnapshot {
    USD?: number;
    EUR?: number;
}

/** Dataset status shape (GET /status.json). */
export interface BCVStatus {
    status: string;
    updated_at: string;
    generated_at: string;
    date: string;
    effective_date: string;
    timezone: string;
    api_version: string;
    supported_currencies: string[];
    source?: string;
    currencies?: Record<string, boolean>;
    endpoints?: Record<string, string>;
}

// --- Binance P2P types ---

/**
 * Trade direction from the searcher's perspective:
 * "BUY" means "I want to buy USDT" -> returns sellers' ads (the price you pay).
 * "SELL" means "I want to sell USDT" -> returns buyers' ads (the price you receive).
 */
export type P2PTradeType = "BUY" | "SELL";

/** Advertiser summary attached to each ad. */
export interface P2PAdvertiser {
    nickName: string;
    monthOrderCount: number;
    monthFinishRate: number;
    positiveRate: number;
    userType?: string;
}

/** A single P2P ad from the search response. */
export interface P2PAd {
    adv: {
        /** Price as a decimal string, e.g. "846.00". */
        price: string;
        tradeType: P2PTradeType;
        tradableQuantity: string;
        minSingleTransAmount?: string;
        maxSingleTransAmount?: string;
        payTimeLimit?: number;
        fiatSymbol?: string;
        fiatUnit?: string;
    };
    advertiser: P2PAdvertiser;
}

/** Buy / sell / average quote for USDT/VES. */
export interface UsdtQuote {
    /** Median price of the best seller ads: what you pay to buy 1 USDT. */
    buy: number;
    /** Median price of the best buyer ads: what you receive selling 1 USDT. */
    sell: number;
    /** Average of buy and sell. */
    mid: number;
    updated_at: string;
}
