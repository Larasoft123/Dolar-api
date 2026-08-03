// Dev-only entry point: starts the local Bun server. In production (Vercel)
// this file must not start a server — the platform calls api/index.ts, which
// re-exports the fetch handler from src/handler.ts.

import { CONFIG } from "./config";
import handler from "./handler";

if (process.env.NODE_ENV !== "production") {
    const server = Bun.serve({ port: CONFIG.PORT, fetch: (req) => handler.fetch(req) });
    console.log(`Server running at http://localhost:${server.port}`);
}
