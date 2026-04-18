# Step 3 — RDS PostgreSQL

## 3.1 Create a DB subnet group

RDS requires a subnet group with subnets in at least two AZs.

```bash
# Get two subnet IDs from the default VPC
SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].SubnetId' \
  --output text | tr '\t' ' ')

aws rds create-db-subnet-group \
  --db-subnet-group-name url-shortener-subnet-group \
  --db-subnet-group-description "URL shortener DB subnet group" \
  --subnet-ids ${=SUBNET_IDS}
```

## 3.2 Create the RDS instance

```bash
aws rds create-db-instance \
  --db-instance-identifier url-shortener-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username shorturl \
  --master-user-password "ChangeMe123!" \
  --db-name shorturl \
  --allocated-storage 20 \
  --no-publicly-accessible \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name url-shortener-subnet-group \
  --backup-retention-period 0 \
  --no-multi-az \
  --storage-type gp2
```

> **Note:** Replace `ChangeMe123!` with a strong password. Store it somewhere safe.

## 3.3 Wait for the instance to become available

```bash
aws rds wait db-instance-available \
  --db-instance-identifier url-shortener-db

echo "RDS is ready."
```

This takes about 5–10 minutes.

## 3.4 Get the RDS endpoint

```bash
DB_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier url-shortener-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "DB_HOST=$DB_HOST"
```

Save this value — it goes into the `.env` file on EC2.
