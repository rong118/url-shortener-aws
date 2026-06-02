# Step 9 — Outputs

## 9.1 `outputs.tf`

After `terraform apply`, these outputs are printed so you can connect and verify.

```hcl
output "ec2_public_ip" {
  description = "Elastic IP of the app server"
  value       = aws_eip.app.public_ip
}

output "rds_endpoint" {
  description = "RDS PostgreSQL host"
  value       = aws_db_instance.main.address
}

output "redis_endpoint" {
  description = "ElastiCache Redis host"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "ecr_repository_url" {
  description = "ECR repository for the app Docker image"
  value       = aws_ecr_repository.app.repository_url
}

output "ssh_command" {
  description = "SSH command to connect to EC2"
  value       = "ssh -i ~/.ssh/url-shortener-key ec2-user@${aws_eip.app.public_ip}"
}
```

## 9.2 What you see after apply

```
ec2_public_ip = "54.123.45.67"
rds_endpoint = "url-shortener-db.xxxx.us-east-1.rds.amazonaws.com"
redis_endpoint = "url-shortener-redis.xxxx.cache.amazonaws.com"
ecr_repository_url = "123456789.dkr.ecr.us-east-1.amazonaws.com/url-shortener-app"
ssh_command = "ssh -i ~/.ssh/url-shortener-key ec2-user@54.123.45.67"
```
