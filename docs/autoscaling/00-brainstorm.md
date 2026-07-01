# Auto-Scaling Brainstorm

## Current state (single-instance baseline)

```
                     Internet
                        │
               ┌────────▼────────┐
               │  Elastic IP      │
               └────────┬────────┘
                        │ :3000
         ┌──────────────▼──────────────┐
         │  1× EC2  t3.micro           │
         │  Docker: url-shortener       │
         │  --restart=always            │
         └──────┬──────────────┬───────┘
                │              │
   ┌────────────▼──┐    ┌──────▼──────────────┐
   │  RDS PG16     │    │  ElastiCache Redis   │
   │  db.t3.micro  │    │  cache.t3.micro      │
   │  single-AZ     │    │  single node         │
   └───────────────┘    └─────────────────────┘
```

What's missing for auto-scaling:
- No load balancer → traffic pinned to one IP
- No launch template / ASG → no horizontal scaling or self-healing
- Single-AZ on RDS and Redis → zone outage takes everything down
- EC2 holds no state (good) but Docker bootstrapping is coupled to user_data

The app itself is **stateless at the compute layer** — all state lives in RDS and Redis. This is the key property that makes horizontal scaling feasible without application changes.

---

## What needs to scale (and doesn't yet)

| Layer | Currently | Scale-out ready? |
|---|---|---|
| **Compute** | 1× EC2 | ❌ Fixed instance, no ASG |
| **Traffic distribution** | Elastic IP (1:1) | ❌ No ALB |
| **Database** | RDS single-AZ | ❌ No read replicas, no Multi-AZ |
| **Cache** | ElastiCache single node | ❌ No cluster mode |
| **Registry** | ECR | ✅ Already a managed service |
| **Deployment** | Manual shell script | ❌ No rolling updates, no blue/green |

---

## Approach A: EC2 Auto Scaling Group + ALB (traditional)

```
                         Internet
                            │
                     ┌──────▼──────┐
                     │     ALB      │  ← spreads traffic, health checks
                     │  (port 80)   │
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  EC2 +   │ │  EC2 +   │ │  EC2 +   │   ← ASG: 2–N instances
        │  Docker  │ │  Docker  │ │  Docker  │      across ≥2 AZs
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           │           ▼
        ┌──────────┐      │     ┌──────────────┐
        │   RDS    │◄─────┘     │  ElastiCache  │
        │ Multi-AZ │            │  Multi-AZ     │
        └──────────┘            └──────────────┘
```

### What changes

| Current | → | New |
|---|---|---|
| `aws_instance` | → | `aws_launch_template` + `aws_autoscaling_group` |
| Elastic IP (direct) | → | ALB (`aws_lb`) + listener + target group |
| `user_data` per instance | → | Launch template user_data (same bootstrap per instance) |
| SSH to one box | → | SSM Session Manager (no bastion needed) |
| EC2 SG: port 3000 open to world | → | EC2 SG: port 3000 from ALB only; ALB SG: port 80 open |
| `deploy.sh` update | → | New Docker image → roll ASG instances (instance refresh) |
| RDS single-AZ | → | RDS Multi-AZ (standby in another AZ) |
| ElastiCache single | → | ElastiCache with Multi-AZ + automatic failover |

### Scaling policy options

- **Target tracking on CPU** — simplest. Keep average CPU at 60%. ASG computes desired count automatically.
- **Target tracking on request count** — ALB's `RequestCountPerTarget`. More precise for this workload since the app is I/O-bound (DB calls), not CPU-bound.
- **Scheduled scaling** — if traffic has a known daily pattern.
- **Step scaling on latency** — if p95 latency spikes past a threshold, add instances.

Recommended starting point: **RequestCountPerTarget** with a target of ~500 req/min per instance, plus a CPU ceiling at 70% as a safety net.

### Pros
- Full control over the runtime (AMIs, instance types, Docker config)
- Predictable cost at steady state (reserved instances possible)
- Reuses the existing Docker/EC2 pattern with minimal refactor
- ASG self-healing replaces failed instances automatically

### Cons
- You still manage AMIs, OS patches, Docker daemon
- Scaling speed limited by EC2 boot time (~60–90s for AL2023 + Docker pull)
- Instance refresh on deploy means a rolling replacement cycle
- More Terraform resources to maintain

### Migration difficulty: **Medium**
- Existing Dockerfile and user_data template carry forward
- `ec2.tf` gets replaced, `networking.tf` gains ALB/SG rules
- RDS and ElastiCache get `multi_az` / automatic failover flags
- `deploy.sh` changes: push image → trigger instance refresh instead of SSH-ing in

---

## Approach B: ECS Fargate (container-native)

```
                         Internet
                            │
                     ┌──────▼──────┐
                     │     ALB      │
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Fargate  │ │ Fargate  │ │ Fargate  │   ← ECS Service: 2–N tasks
        │  task    │ │  task    │ │  task    │      across ≥2 AZs
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           │           ▼
        ┌──────────┐      │     ┌──────────────┐
        │   RDS    │◄─────┘     │  ElastiCache  │
        │ Multi-AZ │            │  Multi-AZ     │
        └──────────┘            └──────────────┘
```

### What changes

| Current | → | New |
|---|---|---|
| EC2 + Docker | → | ECS Fargate tasks (no servers to manage) |
| `user_data` bootstrap | → | ECS task definition (container spec as code) |
| `ec2.tf` | → | `aws_ecs_cluster`, `aws_ecs_task_definition`, `aws_ecs_service` |
| Elastic IP | → | ALB (same as Approach A) |
| IAM instance profile | → | ECS task execution role |
| `deploy.sh` | → | `aws ecs update-service --force-new-deployment` (or CodeDeploy for blue/green) |

### Scaling policy options

- **ECS Service Auto Scaling** — target tracking on `CPUUtilization`, `MemoryUtilization`, or `ALBRequestCountPerTarget`
- **Scheduled scaling** — same ASG-style scheduling available
- **Step scaling on custom CloudWatch metrics**

Recommended: `ALBRequestCountPerTarget` (same rationale as approach A) + memory soft limit at 80%.

### Pros
- **No servers to manage** — no AMI patching, no Docker daemon updates, no OS-level SSH
- **Faster scale-out** — Fargate launches a task in ~30–60s (no OS boot, just container start)
- **Deployments** — ECS supports rolling updates natively (`minimumHealthyPercent`, `maximumPercent`)
- **Simpler Terraform** — fewer resources than ASG + launch template + user_data
- **Security** — tasks run in isolated enclaves, no SSH surface area

### Cons
- **Cost** — Fargate is more expensive per vCPU-hour than EC2 (roughly 1.5–2× at steady state for t3.micro equivalent)
- **Cold start** — first task launch includes image pull (mitigated by ECR cache)
- **Less control** — can't ssh into a task to debug live traffic (use CloudWatch Logs instead)
- **VPC networking** — tasks need ENIs in your VPC subnets (minor complexity)

### Migration difficulty: **Medium-High**
- Dockerfile stays the same
- Need to write task definition (CPU/memory/port/env vars)
- Need an ECS cluster + service + ALB integration
- RDS and ElastiCache changes are the same as Approach A
- `deploy.sh` gets simpler (no SSH) but different (ECS API calls)
- Need to wire up CloudWatch Logs for container stdout/stderr

---

## Approach C: AWS App Runner (fully managed)

```
                    Internet
                       │
                ┌──────▼──────┐
                │  App Runner  │   ← auto-scales, HTTPS, health checks
                │  (managed)   │      all built in
                └──────┬──────┘
                       │
           ┌───────────┼───────────┐
           ▼           │           ▼
     ┌──────────┐      │     ┌──────────────┐
     │   RDS    │◄─────┘     │  ElastiCache  │
     │ Multi-AZ │            │  Multi-AZ     │
     └──────────┘            └──────────────┘
```

### What changes

App Runner is the simplest option — point it at your ECR image and it handles everything: load balancing, auto-scaling, HTTPS, health checks, rolling deployments.

### Pros
- **Simplest** — one Terraform resource (`aws_apprunner_service`), no ALB, no ASG, no ECS cluster
- **Zero ops** — AWS manages the entire compute layer
- **Auto-scales by default** — concurrency-based or request-based, configurable max instances
- **Built-in HTTPS** — App Runner provides a `*.awsapprunner.com` domain with TLS
- **Fast deploys** — push to ECR, App Runner picks it up automatically (or manual trigger)

### Cons
- **Region availability** — not in every region (check before committing)
- **VPC connectivity** — needs a VPC connector to reach RDS/ElastiCache in private subnets; adds latency and complexity
- **Cost** — per GB-hour of memory provisioned; can get expensive at steady load vs. EC2
- **Limited control** — no SSH, no custom health check endpoints beyond HTTP 200, no fine-grained scaling policies
- **Vendor lock-in** — hardest to migrate away from later
- **Max concurrency** — each instance can serve many concurrent requests but DB connection pool size becomes a limiter

### Migration difficulty: **Low-Medium**
- Dockerfile stays the same
- ECR push triggers deploy (or manual)
- VPC connector needed for private RDS/Redis
- RDS and ElastiCache changes are the same

---

## Approach D: Lambda + API Gateway (serverless)

```
                    Internet
                       │
                ┌──────▼──────┐
                │ API Gateway  │
                │  (REST/HTTP) │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │   Lambda     │   ← scales per-request, 0→N instantly
                │  (Express    │
                │   via proxy) │
                └──────┬──────┘
                       │
           ┌───────────┼───────────┐
           ▼           │           ▼
     ┌──────────┐      │     ┌──────────────┐
     │   RDS    │◄─────┘     │  ElastiCache  │
     │ Multi-AZ │            │  Multi-AZ     │
     └──────────┘            └──────────────┘
```

### Pros
- **True scale-to-zero** — no cost when idle
- **Instant scale** — Lambda handles bursts natively
- **No servers at all** — no Docker, no instances, no clusters

### Cons
- **Major refactor** — Express needs to run behind `aws-serverless-express` or be rewritten to Lambda handlers
- **Cold starts** — ~200–500ms latency for cold Lambda (mitigated by provisioned concurrency, but that costs)
- **Connection pooling is hard** — RDS and Redis connections don't work across Lambda invocations the same way. Each cold start opens new connections. You'd need RDS Proxy (+$0.015/hr) to avoid connection exhaustion.
- **Timeout limits** — Lambda max 15 min (not an issue for URL shortener, but a constraint)
- **API Gateway cost** — per-request pricing adds up at high volume
- **Redis in VPC** — Lambda needs VPC access for ElastiCache, which adds cold start penalty

### Migration difficulty: **Hardest**
Major application rework, new connection pooling architecture, RDS Proxy needed, different local dev experience.

---

## Approach comparison matrix

| | A: ASG + ALB | B: ECS Fargate | C: App Runner | D: Lambda |
|---|---|---|---|---|
| **Ops burden** | Medium | Low | Lowest | Low |
| **Scaling speed** | ~60–90s | ~30–60s | ~30–60s | Instant |
| **Cost at steady state** | $ | $$ | $$ | $-$$$ |
| **Cost at zero traffic** | $ | $ | $ | $0 |
| **Reuses existing code** | ✅ 100% | ✅ 100% | ✅ 100% | ❌ Refactor |
| **Reuses Dockerfile** | ✅ | ✅ | ✅ | ❌ |
| **Fine-grained scaling** | ✅ | ✅ | ⚠️ Limited | ✅ (concurrency) |
| **Rolling deploys** | Instance refresh | Built-in | Built-in | Built-in |
| **SSH / debug access** | ✅ | ❌ | ❌ | ❌ |
| **Terraform complexity** | +5 resources | +5 resources | +2 resources | Full rewrite |
| **Multi-AZ DB/Cache** | Same across all | Same across all | Same across all | Same across all |

---

## RDS and ElastiCache: scaling the data layer

Regardless of compute approach, the data tier needs hardening:

### RDS PostgreSQL

| Change | Why |
|---|---|
| **`multi_az = true`** | Synchronous standby in another AZ. ~60s failover on primary failure. |
| **`backup_retention_period = 7`** | Point-in-time recovery (0 → 7 days). Also enables read replicas. |
| **Read replicas** (optional, later) | If stats queries or redirect lookups grow read-heavy, offload reads to replicas. The app would need a reader endpoint config. |
| **`storage_encrypted = true`** | Encrypt at rest — required if you ever handle PII. |
| **Instance class bump** (later) | `db.t3.micro` → `db.t3.small` or `db.t4g.medium` when connection count grows. |

### ElastiCache Redis

| Change | Why |
|---|---|
| **Multi-AZ with automatic failover** | Replica in another AZ. If primary dies, replica promotes. Transparent to the app (same endpoint). |
| **Cluster mode** (optional, later) | Shard data across nodes. Only needed if Redis memory usage outgrows a single node. |
| **`at_rest_encryption = true`** | Encrypt data on disk. |
| **`transit_encryption = true`** | Encrypt in transit (requires `rediss://` in the app's REDIS_URL). |

For current scale, Multi-AZ + auto-failover on both is sufficient. No application changes needed.

---

## Deployment pipeline: from manual to automated

All auto-scaling approaches require a new deployment model. The current `deploy.sh update` (build → push → SSH → pull → restart) doesn't work when there are N instances managed by an orchestrator.

### Target flow for approaches A/B/C

```
git push main
    │
    ▼
GitHub Actions (or manual trigger)
    │
    ├─ 1. Build Docker image
    ├─ 2. Push to ECR with :git-sha tag + :latest
    ├─ 3. Trigger deployment:
    │      A: ASG instance refresh (rolling replace)
    │      B: aws ecs update-service --force-new-deployment
    │      C: App Runner auto-deploy from ECR
    └─ 4. Run migrations? (see below)
```

### The migration problem

Currently migrations run in `user_data` (on first boot) and in `deploy.sh update` (SSH in and `docker exec ... npm run migrate`). With N instances, you need to run migrations **exactly once** per deploy, not once per instance.

Solutions:
- **Migration runner container** — a separate ECS task / Lambda / script that runs `node scripts/migrate.js` before the new app instances go live. The migration script already uses `CREATE TABLE IF NOT EXISTS` so it's idempotent.
- **Init container** (ECS natively, ASG via cloud-init ordering) — one instance runs migration before others start.
- **CDK / Terraform provisioner** — run migration as part of the infra deployment (not great — mixes app concerns with infra).
- **Application boot** (simplest, with idempotent migrations) — each instance runs migrations on startup. Since `scripts/migrate.js` uses `IF NOT EXISTS`, concurrent runs are safe. Downside: slightly slower boot.

Recommended for simplicity: **keep idempotent migrations on boot** with `IF NOT EXISTS` guards (already in place), or add a lightweight **ECS task / one-shot Lambda** triggered as part of deploy.

---

## Recommended path

### Start here: Approach A (ASG + ALB)

Rationale:
1. **Smallest conceptual leap** — you already have EC2 + Docker + user_data. The ASG wraps those same pieces.
2. **EC2 experience carries forward** — you understand the runtime, debugging, and failure modes.
3. **Cost predictable** — t3.micro × 2–3 instances is cheap and reservable.
4. **Migration is incremental** — add ALB first (point it at the single EC2), then add ASG, then remove the old instance. Never a big-bang cutover.
5. **Easy to switch later** — once the ALB and data tier are hardened, moving to ECS Fargate is just swapping the compute layer.

### Incremental phases

| Phase | What changes | Risk |
|---|---|---|
| **1. Harden data tier** | RDS Multi-AZ, Redis Multi-AZ, enable backups | Low — no app changes |
| **2. Add ALB** | ALB + target group pointing at existing EC2, move port 3000 from open-to-world to ALB-only | Medium — DNS/IP change |
| **3. Create launch template** | Extract user_data into a launch template, create ASG with min=1 max=1 (no real scaling yet) | Low — just refactoring |
| **4. Switch to ASG** | ASG min=2 max=4, remove old `aws_instance`, wire ALB to ASG target group | Medium — need instance refresh on deploy |
| **5. Add scaling policies** | RequestCountPerTarget or CPU target tracking | Low — pure addition |
| **6. Automate deploys** | GitHub Actions or script that pushes ECR + triggers instance refresh | Low — tooling only |

### If you want simpler ops sooner (skip ASG for ECS)

Jump to Approach B. The Dockerfile is the same. You trade EC2 familiarity for not managing servers. The Terraform is roughly the same complexity — just different resources.

### If you want simplest possible

App Runner (Approach C) is worth a look, but verify VPC connector support and region availability first. The VPC connector latency penalty for hitting RDS/Redis on every request might be a deal-breaker for a URL shortener (redirects must be fast).

---

## Open questions to resolve

1. **What's the expected traffic pattern?** Steady vs. bursty vs. diurnal. This determines whether target tracking or scheduled scaling is the right policy.
2. **What's the p95 latency budget for redirects?** If it's <50ms, keep Redis close (same AZ preference) and avoid VPC connector overhead (hurts App Runner).
3. **Multi-region needed?** If you need global low-latency redirects, that's a different problem (Route 53 latency-based routing + multi-region stack, or CloudFront + Lambda@Edge).
4. **Budget?** EC2 + ASG is cheapest at steady state; Lambda is cheapest at low/zero traffic; Fargate and App Runner trade money for less ops work.
5. **Custom domain?** If you plan to use a custom domain with HTTPS, ALB + ACM is the standard path (works with approaches A and B). App Runner gives you HTTPS for free but on their domain.
6. **Rate limiting at scale?** The current rate limiter uses Redis, which works across instances. Good. But confirm the Redis-based rate limiter handles connection pooling correctly — no per-instance state leaks.
