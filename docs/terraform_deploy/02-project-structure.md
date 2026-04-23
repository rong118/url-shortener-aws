# Step 2 — Project Structure

Create a `terraform/` directory at the root of the repo:

```
url-shortener-aws/
└── terraform/
    ├── main.tf          # provider + backend
    ├── variables.tf     # input variable declarations
    ├── terraform.tfvars # your actual values (git-ignored)
    ├── networking.tf    # VPC, subnets, security groups
    ├── rds.tf           # RDS PostgreSQL
    ├── elasticache.tf   # ElastiCache Redis
    ├── ec2.tf           # EC2 instance + key pair
    └── outputs.tf       # IPs and endpoints printed after apply
```

## 2.1 `main.tf` — provider configuration

```hcl
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
```

## 2.2 Initialize Terraform

Run this once from the `terraform/` directory to download the AWS provider:

```bash
cd terraform
terraform init
```

Expected output:

```
Terraform has been successfully initialized!
```
