# Docker + Terraform Deployment — Overview

This guide covers deploying the URL shortener to AWS using Terraform for infrastructure and Docker for the app runtime. The entire stack is provisioned with `terraform apply`, and deployments are orchestrated via `scripts/deploy.sh`.

## Stack

| Resource | AWS service | Terraform resource |
|---|---|---|
| App server | EC2 `t3.micro` | `aws_instance` |
| Container registry | ECR | `aws_ecr_repository` |
| IAM role | IAM | `aws_iam_role` |
| Database | RDS PostgreSQL `db.t3.micro` | `aws_db_instance` |
| Cache | ElastiCache Redis `cache.t3.micro` | `aws_elasticache_cluster` |
| Networking | Default VPC + Security Groups | `aws_default_vpc`, `aws_security_group` |

## Steps

| # | File | Description |
|---|------|-------------|
| 1 | [01-prerequisites.md](01-prerequisites.md) | Install Docker, Terraform, AWS CLI; create SSH key |
| 2 | [02-project-structure.md](02-project-structure.md) | Directory layout and all files |
| 3 | [03-variables.md](03-variables.md) | Input variables (`terraform.tfvars`) |
| 4 | [04-networking.md](04-networking.md) | VPC and security groups |
| 5 | [05-rds.md](05-rds.md) | RDS PostgreSQL instance |
| 6 | [06-elasticache.md](06-elasticache.md) | ElastiCache Redis cluster |
| 7 | [07-ecr-iam.md](07-ecr-iam.md) | ECR repository + IAM role for EC2 pull access |
| 8 | [08-ec2.md](08-ec2.md) | EC2 with Docker user data and Elastic IP |
| 9 | [09-outputs.md](09-outputs.md) | Terraform outputs |
| 10 | [10-deploy.md](10-deploy.md) | Deploy flow — `deploy.sh init`, `update`, `destroy` |

## Architecture diagram

```
Internet
   │
   ▼
EC2 (public subnet, Elastic IP) :3000
   │  ├── Pulls Docker image from ECR
   │  ├── IAM role: AmazonEC2ContainerRegistryReadOnly
   │
   ├── RDS PostgreSQL  (private, port 5432)
   └── ElastiCache Redis (private, port 6379)

ECR ──── url-shortener-app (Docker image repository)
```

## Cost note

All default sizes qualify for the AWS free tier:
- EC2: `t3.micro`
- RDS: `db.t3.micro`, single-AZ, no backups
- ElastiCache: `cache.t3.micro`, single node
- ECR: 500 MB-month free storage
