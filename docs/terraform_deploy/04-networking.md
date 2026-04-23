# Step 4 — Networking

## 4.1 `networking.tf`

This file sets up the default VPC, reads its subnets, and creates three security groups.

```hcl
# ── Default VPC ──────────────────────────────────────────────────────────────
resource "aws_default_vpc" "default" {}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [aws_default_vpc.default.id]
  }
}

# ── EC2 security group ────────────────────────────────────────────────────────
resource "aws_security_group" "ec2" {
  name        = "url-shortener-ec2"
  description = "URL shortener app server"
  vpc_id      = aws_default_vpc.default.id

  # SSH — your IP only
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.your_ip_cidr]
  }

  # App port — open to the internet
  ingress {
    description = "App HTTP"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "url-shortener-ec2" }
}

# ── RDS security group ────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "url-shortener-rds"
  description = "PostgreSQL — allow from EC2 only"
  vpc_id      = aws_default_vpc.default.id

  ingress {
    description     = "PostgreSQL"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "url-shortener-rds" }
}

# ── ElastiCache security group ────────────────────────────────────────────────
resource "aws_security_group" "redis" {
  name        = "url-shortener-redis"
  description = "Redis — allow from EC2 only"
  vpc_id      = aws_default_vpc.default.id

  ingress {
    description     = "Redis"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "url-shortener-redis" }
}
```
