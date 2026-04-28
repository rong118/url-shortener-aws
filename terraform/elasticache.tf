# ── Cache subnet group ────────────────────────────────────────────────────────
resource "aws_elasticache_subnet_group" "main" {
  name       = "url-shortener-cache-subnet"
  subnet_ids = data.aws_subnets.default.ids

  tags = { Name = "url-shortener-cache-subnet" }
}

# ── Redis cluster (single node) ───────────────────────────────────────────────
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "url-shortener-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  tags = { Name = "url-shortener-redis" }
}
