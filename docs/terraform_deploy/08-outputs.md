# Step 8 — Outputs and Apply

## 8.1 `outputs.tf`

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

output "ssh_command" {
  description = "SSH command to connect to EC2"
  value       = "ssh -i ~/.ssh/url-shortener-key ec2-user@${aws_eip.app.public_ip}"
}
```

## 8.2 Plan and apply

From the `terraform/` directory:

```bash
# Preview what will be created
terraform plan

# Create all resources
terraform apply
```

Type `yes` when prompted. The full run takes **10–15 minutes** (RDS is the bottleneck).

## 8.3 View outputs

After apply finishes, Terraform prints the outputs:

```
Outputs:

ec2_public_ip  = "54.x.x.x"
rds_endpoint   = "url-shortener-db.xxxx.us-east-1.rds.amazonaws.com"
redis_endpoint = "url-shortener-redis.xxxx.cfg.use1.cache.amazonaws.com"
ssh_command    = "ssh -i ~/.ssh/url-shortener-key ec2-user@54.x.x.x"
```

You can also retrieve them at any time with:

```bash
terraform output
```
