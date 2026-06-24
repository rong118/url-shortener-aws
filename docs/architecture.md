# URL Shortener — Architecture & Code Logic (AWS)

## Overview

A URL shortening service deployed on **AWS** using **EC2**, **RDS (PostgreSQL)**, and **ElastiCache (Redis)**. Infrastructure is provisioned via **Terraform**, and the app runs as a **Docker container** pulled from **ECR**.

---

## AWS Architecture

```
User → EC2 (t3.micro, Amazon Linux 2023) :3000
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
   RDS        ElastiCache    ECR
   (PostgreSQL 16,          (Docker image
    db.t3.micro)             registry)
   (Redis 7,
    cache.t3.micro)
```

All three resources live in the **default VPC** and are locked down by security groups:

| Security Group | Ingress | Egress |
|---|---|---|
| `url-shortener-ec2` | SSH (22) from your IP only; HTTP (3000) from `0.0.0.0/0` | All |
| `url-shortener-rds` | PostgreSQL (5432) from EC2 SG only | — |
| `url-shortener-redis` | Redis (6379) from EC2 SG only | — |

**Key points:**
- RDS is **not publicly accessible** — reachable only from the EC2 instance
- No SSL between services (traffic stays within the VPC; RDS parameter group sets `rds.force_ssl=0`)
- EC2 has an **Elastic IP** for a stable public address
- EC2 assumes an **IAM role** with `AmazonEC2ContainerRegistryReadOnly` to pull images from ECR

---

## Boot Sequence

### 1. Terraform provisions infrastructure

`terraform apply` creates RDS, ElastiCache, ECR, IAM role, and EC2 in dependency order.

### 2. EC2 user data runs on first boot (`user_data_docker.sh.tpl`)

```bash
dnf install -y docker          # Install Docker
systemctl start docker         # Start daemon
aws ecr get-login-password ... # Authenticate to ECR
docker pull <ecr-url>          # Pull app image
docker run ...                 # Start container with env vars
docker exec ... migrate        # Run DB migration
```

All environment variables (DB credentials, Redis endpoint, `BASE_URL`) are injected at container startup.

### 3. App bootstrap (`src/server.js`)

```
dotenv.config()          → load .env (dev) or use injected vars (prod)
redis.connect()          → connect to ElastiCache
db.query('SELECT 1')     → verify RDS is reachable
app.listen(3000)         → start Express
```

---

## Data Model

### PostgreSQL (RDS) — `migrations/001_init.sql`

**`urls`** table:

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL PRIMARY KEY` | |
| `original_url` | `TEXT NOT NULL` | The long URL |
| `short_code` | `VARCHAR(10) UNIQUE NOT NULL` | 7-char base62 key |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | |
| `expires_at` | `TIMESTAMPTZ NOT NULL` | Default 7 days from creation |
| `click_count` | `INTEGER DEFAULT 0` | Incremented on each redirect |

Indexes: `idx_urls_short_code` (lookup), `idx_urls_expires_at` (cleanup).

**`clicks`** table:

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PRIMARY KEY` | |
| `url_id` | `INTEGER REFERENCES urls(id) ON DELETE CASCADE` | |
| `clicked_at` | `TIMESTAMPTZ DEFAULT NOW()` | |
| `ip_address` | `VARCHAR(45)` | Supports IPv6 |
| `user_agent` | `TEXT` | |
| `referrer` | `TEXT` | |

Indexes: `idx_clicks_url_id`, `idx_clicks_clicked_at`.

### ElastiCache (Redis) — cache layer

| Key pattern | Value | TTL |
|---|---|---|
| `url:<short_code>` | `{"originalUrl":"...", "urlId": <number>}` | Mirrors `urls.expires_at` |
| `rl:<endpoint>:<ip>` | Counter (integer) | 60s sliding window |

- **URL cache keys** are written on creation and cache-miss resolution, expired when the URL expires
- **Rate limiter keys** use fixed-window counters per endpoint per IP

---

## Request Flows

### `POST /api/shorten` — Shorten a URL

```
Client
  → rate limiter (10 req/60s per IP)
  → urlController.shorten
       validates URL (non-empty, parseable)
  → urlService.createShortUrl()
       ├─ generateCode() → random 7-char base62 string (62^7 ≈ 3.5T space)
       ├─ INSERT INTO urls (original_url, short_code, expires_at)
       ├─ SET url:<code> = {originalUrl, urlId} in Redis (TTL = expires_at - now)
       └─ return row
  → Response 201: { short_url, short_code, created_at, expires_at }
```

- **Retry logic**: On unique violation (code collision), retries up to 5 times with a new random code
- **Short URL** is assembled from `process.env.BASE_URL` + `/<short_code>`

### `GET /:code` — Redirect

```
Client
  → rate limiter (60 req/60s per IP)
  → redirectController.redirect
  → urlService.resolveShortCode()
       ├─ Redis GET url:<code>
       │    ├─ hit  → return { originalUrl, urlId, fromCache: true }
       │    └─ miss → SELECT id, original_url, expires_at
       │              FROM urls WHERE short_code = $1 AND expires_at > NOW()
       │              ├─ found → re-populate Redis with remaining TTL
       │              └─ null  → 404
  → Response 302 → originalUrl (sent immediately)
  → fire-and-forget: trackClick(urlId, { ip, userAgent, referrer })
       ├─ INSERT INTO clicks
       └─ UPDATE urls SET click_count = click_count + 1
```

**Design rationale**: The 302 is sent **before** the click is recorded. Click tracking runs asynchronously — if it fails, the redirect already succeeded and the error is logged without affecting the user.

### `GET /api/stats/:code` — Statistics

```
Client
  → rate limiter (30 req/60s per IP)
  → urlController.stats
  → urlService.getStats()
       └─ SELECT u.*,
          json_agg(clicks ORDER BY clicked_at DESC) AS recent_clicks
          FROM urls u LEFT JOIN clicks c ON c.url_id = u.id
          WHERE u.short_code = $1 GROUP BY u.id
  → Response 200: full stats with recent_clicks array, or 404
```

---

## Code Map

```
src/
├── server.js              # Entry point: connect Redis + DB, start Express
├── app.js                 # Express app: CORS, morgan, JSON parsing, routes, error handler
├── config/
│   ├── db.js              # pg.Pool — connects to DB_HOST/DB_NAME/DB_USER/DB_PASSWORD
│   └── redis.js           # redis.createClient — connects to REDIS_URL
├── routes/
│   └── index.js           # Route definitions + rate limiter bindings
├── controllers/
│   ├── urlController.js   # shorten(), stats() — request validation + response formatting
│   └── redirectController.js  # redirect() — resolution + fire-and-forget tracking
├── services/
│   └── urlService.js      # createShortUrl(), resolveShortCode(), trackClick(), getStats()
├── middleware/
│   ├── rateLimiter.js     # Factory: createRateLimiter({ max, windowSeconds, keyPrefix })
│   └── errorHandler.js    # Catches unhandled errors → 500
└── utils/
    └── base62.js          # generateCode() — 7-char random base62 string
```

| File | Responsibility |
|---|---|
| `src/server.js` | Bootstrap: connect infrastructure, start HTTP server |
| `src/app.js` | Express middleware chain (CORS, logging, JSON parsing, static files, routes, error handler) |
| `src/config/db.js` | PostgreSQL connection pool (`pg.Pool`) |
| `src/config/redis.js` | Redis client (`redis` v4, connection established by server.js) |
| `src/services/urlService.js` | All business logic — create, resolve, track, stats |
| `src/controllers/urlController.js` | HTTP concerns for shorten + stats endpoints |
| `src/controllers/redirectController.js` | HTTP concerns for redirect endpoint |
| `src/middleware/rateLimiter.js` | Fixed-window Redis-backed rate limiter (factory pattern) |
| `src/middleware/errorHandler.js` | Global 500 handler |
| `src/utils/base62.js` | Random 7-character base62 code generator |

---

## Infrastructure as Code

### Terraform resources (`terraform/`)

| File | Resources |
|---|---|
| `main.tf` | Provider config (AWS ~> 5.0) |
| `networking.tf` | Default VPC, subnets, 3 security groups (EC2, RDS, Redis) |
| `rds.tf` | Subnet group, parameter group, `aws_db_instance` (PostgreSQL 16, db.t3.micro, 20GB gp2) |
| `elasticache.tf` | Subnet group, `aws_elasticache_cluster` (Redis 7, cache.t3.micro, single node) |
| `ecr.tf` | `aws_ecr_repository` for Docker images |
| `iam.tf` | EC2 assume-role + `AmazonEC2ContainerRegistryReadOnly` + instance profile |
| `ec2.tf` | Key pair, AL2023 AMI, `aws_instance` (t3.micro) with user data template, Elastic IP |
| `variables.tf` | `aws_region`, `db_password`, `your_ip_cidr` (required), plus optional overrides |
| `outputs.tf` | EC2 IP, RDS endpoint, Redis endpoint, ECR URL, SSH command |
| `user_data_docker.sh.tpl` | Boot script: install Docker, pull from ECR, run container, run migration |

### Deployment script (`scripts/deploy.sh`)

| Command | What it does |
|---|---|
| `./scripts/deploy.sh init` | `terraform apply -target=ecr` → build & push Docker image → `terraform apply` (rest) |
| `./scripts/deploy.sh update` | Build & push image → SSH to EC2 → pull new image → restart container → run migration |
| `./scripts/deploy.sh destroy` | `terraform destroy` (tears down everything) |

---

## Key Design Decisions

### Redis-first reads
Every redirect checks Redis before PostgreSQL. This keeps latency low on cache hits and offloads RDS. On cache miss, Redis is re-populated so the next lookup is fast.

### Fire-and-forget click tracking
`trackClick()` runs after the 302 is sent — the user is never waiting on click analytics writes. Failures are logged but not surfaced.

### Expiry is enforced at the query level
`WHERE expires_at > NOW()` in the resolve query means expired URLs simply disappear from lookups. Redis keys carry the same TTL and expire naturally.

### Rate limiting falls open
If Redis is unreachable, the rate limiter middleware calls `next()` — requests pass through rather than being blocked. This prioritizes availability over rate enforcement.

### Random codes, not hashed
A 7-character random base62 string (62^7 ≈ 3.5 trillion combinations). Collisions are handled by retrying up to 5 times. Not crypto-secure (`Math.random()`), which is acceptable for a URL shortener.

### No multi-AZ, no backups
RDS is a single `db.t3.micro` with `backup_retention_period=0` and `skip_final_snapshot=true`. ElastiCache is a single-node cluster. This keeps costs minimal and is intentional for a small-scale service.

---

## Endpoints

| Method | Path | Rate Limit | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | Health check → `{ status: "ok" }` |
| `GET` | `/` | none | Web UI (`public/index.html`) |
| `POST` | `/api/shorten` | 10/min per IP | Create short URL |
| `GET` | `/api/stats/:code` | 30/min per IP | View click statistics |
| `GET` | `/:code` | 60/min per IP | Redirect to original URL |

---

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP listen port | `3000` |
| `BASE_URL` | Prefix for generated short URLs | `http://localhost:3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `shorturl` |
| `DB_USER` | Database user | `shorturl` |
| `DB_PASSWORD` | Database password | (required) |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `URL_TTL_DAYS` | Expiry window for new URLs | `7` |
