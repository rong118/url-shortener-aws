# AWS Deployment Overview

This guide walks through deploying the URL shortener on AWS using:

- **EC2** — Node.js application server
- **RDS** — PostgreSQL database
- **ElastiCache** — Redis cache
- **Security Groups** — network access control

## Steps

| # | File | Description |
|---|------|-------------|
| 1 | [01-prerequisites.md](01-prerequisites.md) | AWS CLI setup and IAM permissions |
| 2 | [02-vpc-and-security-groups.md](02-vpc-and-security-groups.md) | Network and firewall rules |
| 3 | [03-rds-postgres.md](03-rds-postgres.md) | Provision and configure RDS PostgreSQL |
| 4 | [04-elasticache-redis.md](04-elasticache-redis.md) | Provision ElastiCache Redis cluster |
| 5 | [05-ec2-setup.md](05-ec2-setup.md) | Launch EC2, install Node.js, deploy app |
| 6 | [06-env-and-migrate.md](06-env-and-migrate.md) | Configure `.env` and run DB migration |
| 7 | [07-process-manager.md](07-process-manager.md) | Run the app with PM2 (auto-restart on reboot) |
| 8 | [08-verify.md](08-verify.md) | Smoke-test the deployment |

## Architecture diagram

```
Internet
   │
   ▼
EC2 (Node.js :3000)
   ├── RDS PostgreSQL  (private subnet, port 5432)
   └── ElastiCache Redis (private subnet, port 6379)
```

## Cost note

All services can be started on free-tier eligible sizes:
- EC2: `t2.micro`
- RDS: `db.t3.micro`, single-AZ
- ElastiCache: `cache.t3.micro`, single node
