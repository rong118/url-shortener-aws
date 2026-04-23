# Step 9 — App Setup on EC2

After `terraform apply` completes, SSH into the instance and deploy the application.

## 9.1 SSH into EC2

```bash
# Use the ssh_command output directly
$(terraform output -raw ssh_command)

# Or manually
ssh -i ~/.ssh/url-shortener-key ec2-user@$(terraform output -raw ec2_public_ip)
```

## 9.2 Clone the repository

Run the following **on the EC2 instance**:

```bash
git clone https://github.com/<your-username>/url-shortener-aws.git
cd url-shortener-aws
npm install --omit=dev
```

## 9.3 Configure `.env`

```bash
cp .env.example .env
nano .env   # or vim .env
```

Fill in values from `terraform output`:

```env
BASE_URL=http://<ec2_public_ip>:3000

DB_HOST=<rds_endpoint>
DB_PORT=5432
DB_NAME=shorturl
DB_USER=shorturl
DB_PASSWORD=ChangeMe1234!

REDIS_URL=redis://<redis_endpoint>:6379

URL_TTL_DAYS=7
```

## 9.4 Run DB migration

```bash
npm run migrate
```

Expected output:

```
Migration complete.
```

## 9.5 Start with PM2

Install PM2 and start the app:

```bash
sudo npm install -g pm2

pm2 start src/server.js --name url-shortener
pm2 save
pm2 startup
# Copy and run the command it outputs (sudo env PATH=...)
```

## 9.6 Smoke test

```bash
# From your local machine
EC2_IP=$(terraform output -raw ec2_public_ip)

# Shorten a URL
curl -s -X POST http://$EC2_IP:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | jq .

# Follow the redirect
curl -IL http://$EC2_IP:3000/<short_code>
```
