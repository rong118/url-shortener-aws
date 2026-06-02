#!/bin/bash
set -euo pipefail

# ── Help ──────────────────────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
Usage: ./scripts/deploy.sh [command]

Commands:
  init         First-time deploy. Creates ECR → pushes image → creates infra.
  update       Redeploy after code changes. Builds, pushes, SSHs in to restart.
  destroy      Tear down all infra (including ECR images via force_delete).

EOF
  exit 0
}

# ── Prerequisite checks ───────────────────────────────────────────────────────
check_deps() {
  for cmd in docker terraform aws; do
    command -v $cmd >/dev/null 2>&1 || { echo "Error: $cmd is not installed."; exit 1; }
  done
}

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$REPO_ROOT/terraform"
IMAGE_NAME="url-shortener"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/url-shortener-key}"

cd "$REPO_ROOT"

# ── Commands ──────────────────────────────────────────────────────────────────

do_init() {
  echo "=== Phase 1: Creating ECR repository ==="
  cd "$TF_DIR"
  terraform apply -target=aws_ecr_repository.app

  echo ""
  echo "=== Phase 2: Building and pushing Docker image ==="
  ECR_URL=$(terraform output -raw ecr_repository_url)
  ECR_REGISTRY=$(echo "$ECR_URL" | cut -d/ -f1)
  cd "$REPO_ROOT"

  docker build -t "$IMAGE_NAME:latest" .

  aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin "$ECR_REGISTRY"

  docker tag "$IMAGE_NAME:latest" "$ECR_URL:latest"
  docker push "$ECR_URL:latest"

  echo ""
  echo "=== Phase 3: Creating remaining infra ==="
  cd "$TF_DIR"
  terraform apply

  echo ""
  echo "=== Done ==="
  terraform output
}

do_update() {
  echo "=== Building and pushing new image ==="
  cd "$TF_DIR"
  ECR_URL=$(terraform output -raw ecr_repository_url)
  ECR_REGISTRY=$(echo "$ECR_URL" | cut -d/ -f1)
  EC2_IP=$(terraform output -raw ec2_public_ip)
  DB_HOST=$(terraform output -raw rds_endpoint)
  REDIS_HOST=$(terraform output -raw redis_endpoint)

  cd "$REPO_ROOT"
  docker build -t "$IMAGE_NAME:latest" .

  aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin "$ECR_REGISTRY"

  docker tag "$IMAGE_NAME:latest" "$ECR_URL:latest"
  docker push "$ECR_URL:latest"

  echo ""
  echo "=== Restarting container on EC2 ==="
  ssh -i "$SSH_KEY" "ec2-user@$EC2_IP" <<SSH_EOF
set -e
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
docker pull $ECR_URL:latest
docker stop url-shortener 2>/dev/null || true
docker rm url-shortener 2>/dev/null || true
docker run -d --name url-shortener --restart=always -p 3000:3000 \
  -e BASE_URL="http://\$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000" \
  -e DB_HOST="$DB_HOST" \
  -e DB_PORT="5432" \
  -e DB_NAME="shorturl" \
  -e DB_USER="shorturl" \
  -e DB_PASSWORD="\$(terraform -chdir=$TF_DIR output -raw db_password 2>/dev/null || echo \$TF_VAR_db_password)" \
  -e REDIS_URL="redis://$REDIS_HOST:6379" \
  -e URL_TTL_DAYS="7" \
  $ECR_URL:latest
sleep 3
docker exec url-shortener node scripts/migrate.js
SSH_EOF

  echo ""
  echo "=== Done ==="
  echo "App running at http://$EC2_IP:3000"
}

do_destroy() {
  cd "$TF_DIR"
  terraform destroy
}

# ── Entry point ───────────────────────────────────────────────────────────────
check_deps

case "${1:-}" in
  init)    do_init ;;
  update)  do_update ;;
  destroy) do_destroy ;;
  *)       usage ;;
esac
