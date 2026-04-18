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

## 3.2 Create a parameter group with SSL disabled

RDS PostgreSQL enforces SSL by default (`rds.force_ssl=1`), which causes connection errors from the app. Create a custom parameter group to disable it before creating the instance:

```bash
aws rds create-db-parameter-group \
  --db-parameter-group-name url-shortener-pg16 \
  --db-parameter-group-family postgres16 \
  --description "Disable force SSL for dev"

aws rds modify-db-parameter-group \
  --db-parameter-group-name url-shortener-pg16 \
  --parameters "ParameterName=rds.force_ssl,ParameterValue=0,ApplyMethod=immediate"
```

## 3.3 Create the RDS instance

```bash
aws rds create-db-instance \
  --db-instance-identifier url-shortener-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username shorturl \
  --master-user-password "ChangeMe1234" \
  --db-name shorturl \
  --allocated-storage 20 \
  --no-publicly-accessible \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name url-shortener-subnet-group \
  --db-parameter-group-name url-shortener-pg16 \
  --backup-retention-period 0 \
  --no-multi-az \
  --storage-type gp2
```

> **Note:** Replace `ChangeMe1234` with a strong password. Store it somewhere safe.

## 3.4 Wait for the instance to become available

```bash
aws rds wait db-instance-available \
  --db-instance-identifier url-shortener-db

echo "RDS is ready."
```

This takes about 5–10 minutes.

## 3.5 Get the RDS endpoint

```bash
DB_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier url-shortener-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "DB_HOST=$DB_HOST"
```

Save this value — it goes into the `.env` file on EC2.
