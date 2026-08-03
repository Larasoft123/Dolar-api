import { DEFAULT_TIMEOUT_MS } from "./utils/http";

export const CONFIG = {
    PORT: process.env.PORT ?? 3000,
    REDIS_URL: process.env.REDIS_URL ?? "",
    BCV_TODAY: {
        BASE_URL: process.env.BCV_TODAY_BASE_URL ?? "https://bcv.today/api/v1",
        TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    },
    BINANCE_P2P: {
        SEARCH_URL: process.env.BINANCE_P2P_SEARCH_URL ?? "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
        TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    },
} as const