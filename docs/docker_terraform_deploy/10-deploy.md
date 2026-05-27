# Step 10 — Deploy Flow (`deploy.sh`)

The deploy script (`scripts/deploy.sh`) orchestrates the full lifecycle. All commands require Docker, Terraform, and AWS CLI to be installed locally.

## 10.1 First-time deploy — `./scripts/deploy.sh init`

Runs in three phases because the ECR repository must exist before a Docker image can be pushed:

**Phase 1 — ECR only**

```bash
terraform apply -target=aws_ecr_repository.app
```

Creates the ECR repository in isolation so subsequent steps have a push target.

**Phase 2 — Build & push**

```bash
docker build -t url-shortener:latest .
aws ecr get-login-password --region us-east-1 | docker login ...
docker tag url-shortener:latest <ecr_url>:latest
docker push <ecr_url>:latest
```

Builds the Node 22 Alpine multi-stage image and pushes to ECR.

**Phase 3 — Remaining infra**

```bash
terraform apply
```

Provisions networking, RDS, ElastiCache, IAM, and EC2. EC2 user data pulls the image from ECR and starts the container automatically.

## 10.2 Redeploy after code changes — `./scripts/deploy.sh update`

For every code change after the initial deploy:

1. Rebuild and push a new `:latest` image to ECR
2. SSH into EC2
3. Pull the new image, stop and remove the old container, start a fresh one with the same env vars
4. Re-run `node scripts/migrate.js` inside the container

```bash
ssh ec2-user@<ip> <<SSH_EOF
  aws ecr get-login-password ... | docker login ...
  docker pull <ecr_url>:latest
  docker stop url-shortener && docker rm url-shortener
  docker run -d --name url-shortener --restart=always -p 3000:3000 \
    -e DB_HOST=... -e REDIS_URL=... <ecr_url>:latest
  docker exec url-shortener node scripts/migrate.js
SSH_EOF
```

## 10.3 Tear down — `./scripts/deploy.sh destroy`

```bash
terraform destroy
```

Removes all AWS resources. ECR images are deleted because `force_delete = true` is set on the repository ([Step 7](07-ecr-iam.md)).

## 10.4 Environment variables in the container

| Variable | Source |
|---|---|
| `BASE_URL` | EC2 metadata service (public IP) |
| `DB_HOST` | Terraform output (`rds_endpoint`) |
| `DB_PORT` | Hardcoded `5432` |
| `DB_NAME` | `var.db_name` (default: `shorturl`) |
| `DB_USER` | `var.db_username` (default: `shorturl`) |
| `DB_PASSWORD` | `var.db_password` (sensitive) |
| `REDIS_URL` | Terraform output (`redis_endpoint`) |
| `URL_TTL_DAYS` | Hardcoded `7` |

## 10.5 Verification

After deploy, the app is available at:

```bash
curl http://<ec2_public_ip>:3000
# → Landing page HTML
```
