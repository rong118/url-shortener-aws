# Step 2 — Project Structure

## 2.1 Directory layout

```
url-shortener-aws/
├── Dockerfile                         # Multi-stage Node 22 Alpine build
├── scripts/
│   ├── migrate.js                     # DB migration runner
│   └── deploy.sh                      # Build, push, deploy orchestrator
├── terraform/
│   ├── main.tf                        # Provider config (aws ~> 5.0)
│   ├── variables.tf                   # Input variables
│   ├── networking.tf                  # VPC + 3 security groups
│   ├── rds.tf                         # RDS PostgreSQL
│   ├── elasticache.tf                 # ElastiCache Redis
│   ├── ecr.tf                         # ECR repository
│   ├── iam.tf                         # IAM role for EC2 → ECR pull
│   ├── ec2.tf                         # EC2 with Docker user data
│   ├── outputs.tf                     # Outputs (IPs, endpoints, SSH)
│   ├── user_data_docker.sh.tpl        # EC2 bootstrap (Docker install + run)
│   └── .terraform.lock.hcl            # Provider lock file
├── src/                               # Application source
├── migrations/                        # SQL migration files
└── public/                            # Static assets (landing page)
```

## 2.2 What each Terraform file does

| File | Purpose |
|---|---|
| `main.tf` | Terraform block (required version, AWS provider config) |
| `variables.tf` | Declares all input variables |
| `networking.tf` | Default VPC + EC2/RDS/Redis security groups |
| `rds.tf` | RDS PostgreSQL 16 instance |
| `elasticache.tf` | ElastiCache Redis 7 single-node cluster |
| `ecr.tf` | ECR private repository for Docker images |
| `iam.tf` | IAM role granting EC2 pull access to ECR |
| `ec2.tf` | EC2 instance with Docker-based `user_data` |
| `outputs.tf` | Prints public IP, endpoints, SSH command after apply |
| `user_data_docker.sh.tpl` | Shell template: installs Docker, pulls image, runs container |

## 2.3 `deploy.sh`

The script (`scripts/deploy.sh`) wraps the full lifecycle:

| Command | What it does |
|---|---|
| `init` | ECR first → build & push image → create remaining infra |
| `update` | Rebuild & push image → SSH in → pull & restart container |
| `destroy` | `terraform destroy` all resources |
