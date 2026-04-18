# Step 6 — Configure Environment and Run Migration

All commands in this step run **on the EC2 instance** (SSH session from step 5).

## 6.1 Create the `.env` file

```bash
cd ~/url-shortener-aws

cat > .env <<EOF
PORT=3000
BASE_URL=http://<EC2_IP>:3000

DB_HOST=<DB_HOST>
DB_PORT=5432
DB_NAME=shorturl
DB_USER=shorturl
DB_PASSWORD=ChangeMe123!

REDIS_URL=redis://<REDIS_HOST>:6379

URL_TTL_DAYS=7
EOF
```

Replace the placeholders:
- `<EC2_IP>` — public IP of the EC2 instance (from step 5.3)
- `<DB_HOST>` — RDS endpoint (from step 3.4)
- `<REDIS_HOST>` — ElastiCache endpoint (from step 4.4)
- `ChangeMe123!` — the RDS master password you set in step 3.2

## 6.2 Verify connectivity

```bash
# Test Postgres (install pg client if needed)
sudo dnf install -y postgresql15

psql -h $DB_HOST -U shorturl -d shorturl -c "SELECT 1;"
# Should print: ?column? = 1
```

## 6.3 Run the database migration

```bash
npm run migrate
# Should print: Migration complete.
```

This runs `scripts/migrate.js` which applies `migrations/001_init.sql`, creating the `urls` and `clicks` tables.
