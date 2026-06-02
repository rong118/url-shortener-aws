#!/bin/bash
set -euo pipefail

# Install Docker
dnf install -y docker
systemctl enable --now docker
usermod -aG docker ec2-user

# Login to ECR and pull the app image
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${ecr_registry}
docker pull ${ecr_repo_url}:latest

# Run the container
docker run -d --name url-shortener --restart=always -p 3000:3000 \
  -e BASE_URL="http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000" \
  -e DB_HOST="${db_host}" \
  -e DB_PORT="5432" \
  -e DB_NAME="${db_name}" \
  -e DB_USER="${db_user}" \
  -e DB_PASSWORD="${db_password}" \
  -e REDIS_URL="redis://${redis_host}:6379" \
  -e URL_TTL_DAYS="${url_ttl_days}" \
  ${ecr_repo_url}:latest

# Wait for container to be ready then run migrations
sleep 5
docker exec url-shortener node scripts/migrate.js
