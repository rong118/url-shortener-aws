# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start local infrastructure (Postgres + Redis)
docker compose up -d

# Run DB migration
npm run migrate

# Start dev server (with hot reload)
npm run dev

# Start production server
npm start
```

## Environment

Copy `.env.example` to `.env` before running. Key variables:

- `BASE_URL` — used to build the short URL in API responses (e.g. `http://localhost:3000`)
- `DB_*` — PostgreSQL connection (matches docker-compose defaults)
- `REDIS_URL` — Redis connection string
- `URL_TTL_DAYS` — expiry window for shortened URLs (default: 7)

## Architecture

### Request flow

- **Redirect** (`GET /:code`): checks Redis first (`url:<code>` key stores `{originalUrl, urlId}` as JSON), falls back to Postgres. Click tracking runs fire-and-forget after the 302 is sent.
- **Shorten** (`POST /api/shorten`): generates a 7-char base62 code, inserts into Postgres, writes to Redis with matching TTL.
- **Stats** (`GET /api/stats/:code`): Postgres-only query joining `urls` + `clicks`.

### Data model

Two tables in Postgres:

- `urls` — `short_code`, `original_url`, `expires_at`, `click_count`
- `clicks` — per-click rows with `url_id`, `ip_address`, `user_agent`, `referrer`, `clicked_at`

Redis keys: `url:<short_code>` → JSON string, TTL mirrors `expires_at`.

### Key files

- `src/services/urlService.js` — all business logic (create, resolve, track, stats)
- `src/config/db.js` / `src/config/redis.js` — connection pools (initialized once in `server.js`)
- `migrations/001_init.sql` — full schema; applied via `scripts/migrate.js`

### Target deployment (AWS)

Final stack: EC2 + RDS (PostgreSQL) + ElastiCache (Redis). The app is designed to run as a plain Node process — no serverless dependencies.
