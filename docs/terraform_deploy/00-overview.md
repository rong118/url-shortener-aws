# Terraform Deployment — Overview

This guide replaces the manual AWS CLI steps with [Terraform](https://www.terraform.io/), letting you provision the entire stack with a single `terraform apply`.

## Stack

| Resource | AWS service | Terraform resource |
|---|---|---|
| App server | EC2 `t3.micro` | `aws_instance` |
| Database | RDS PostgreSQL `db.t3.micro` | `aws_db_instance` |
| Cache | ElastiCache Redis `cache.t3.micro` | `aws_elasticache_cluster` |
| Networking | Default VPC + Security Groups | `aws_default_vpc`, `aws_security_group` |

## Steps

| # | File | Description |
|---|------|-------------|
| 1 | [01-prerequisites.md](01-prerequisites.md) | Install Terraform, configure AWS credentials |
| 2 | [02-project-structure.md](02-project-structure.md) | Directory layout and provider setup |
| 3 | [03-variables.md](03-variables.md) | Input variables (`terraform.tfvars`) |
| 4 | [04-networking.md](04-networking.md) | VPC, subnets, and security groups |
| 5 | [05-rds.md](05-rds.md) | RDS PostgreSQL instance |
| 6 | [06-elasticache.md](06-elasticache.md) | ElastiCache Redis cluster |
| 7 | [07-ec2.md](07-ec2.md) | EC2 instance and SSH key |
| 8 | [08-outputs.md](08-outputs.md) | Outputs and apply |
| 9 | [09-app-setup.md](09-app-setup.md) | Configure `.env`, migrate DB, start with PM2 |
| 10 | [10-destroy.md](10-destroy.md) | Tear down all resources |

## Architecture diagram

```
Internet
   │
   ▼
EC2 (public subnet, Elastic IP) :3000
   ├── RDS PostgreSQL  (private, port 5432)
   └── ElastiCache Redis (private, port 6379)
```

## Cost note

All default sizes qualify for the AWS free tier:
- EC2: `t3.micro`
- RDS: `db.t3.micro`, single-AZ, no backups
- ElastiCache: `cache.t3.micro`, single node
