# ── Subnet group (RDS needs subnets in ≥2 AZs) ───────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "url-shortener-subnet-group"
  subnet_ids = data.aws_subnets.default.ids

  tags = { Name = "url-shortener-db-subnet-group" }
}

# ── Parameter group — disable force_ssl ──────────────────────────────────────
# RDS PostgreSQL 16 enforces SSL by default; disabling for dev simplicity.
resource "aws_db_parameter_group" "pg16_no_ssl" {
  name        = "url-shortener-pg16"
  family      = "postgres16"
  description = "Disable force SSL for dev"

  parameter {
    name         = "rds.force_ssl"
    value        = "0"
    apply_method = "immediate"
  }

  tags = { Name = "url-shortener-pg16" }
}

# ── RDS instance ──────────────────────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier        = "url-shortener-db"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp2"

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.pg16_no_ssl.name

  publicly_accessible     = false
  multi_az                = false
  backup_retention_period = 0
  skip_final_snapshot     = true

  tags = { Name = "url-shortener-db" }
}
