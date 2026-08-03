# dolar-api

A minimal Bun server.

## Install

```bash
bun install
```

## Run

```bash
bun run src/index.ts
```

## Endpoints

- `GET /` → returns a welcome JSON response
- `GET /health` → health check

This project uses Bun's built-in HTTP server via `Bun.serve()`.
