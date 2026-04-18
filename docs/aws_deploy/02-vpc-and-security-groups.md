# Step 2 — VPC and Security Groups

You can use the **default VPC** for simplicity. Run these commands to create the three security groups the app needs.

## 2.1 Get your default VPC ID

```bash
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' \
  --output text)

echo "VPC_ID=$VPC_ID"
```

## 2.2 Security group: EC2 app server

```bash
EC2_SG=$(aws ec2 create-security-group \
  --group-name url-shortener-ec2 \
  --description "URL shortener EC2" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Allow SSH from your IP only
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG \
  --protocol tcp --port 22 --cidr ${MY_IP}/32

# Optional that if you access from different location
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG \
  --protocol tcp --port 22 --cidr 0.0.0.0/0

# Allow HTTP traffic on port 3000 from anywhere (or front with ALB later)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG \
  --protocol tcp --port 3000 --cidr 0.0.0.0/0

echo "EC2_SG=$EC2_SG"
```

## 2.3 Security group: RDS PostgreSQL

```bash
RDS_SG=$(aws ec2 create-security-group \
  --group-name url-shortener-rds \
  --description "URL shortener RDS" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Allow port 5432 only from the EC2 security group
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp --port 5432 \
  --source-group $EC2_SG

echo "RDS_SG=$RDS_SG"
```

## 2.4 Security group: ElastiCache Redis

```bash
REDIS_SG=$(aws ec2 create-security-group \
  --group-name url-shortener-redis \
  --description "URL shortener Redis" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Allow port 6379 only from the EC2 security group
aws ec2 authorize-security-group-ingress \
  --group-id $REDIS_SG \
  --protocol tcp --port 6379 \
  --source-group $EC2_SG

echo "REDIS_SG=$REDIS_SG"
```

## 2.5 Save these IDs

Keep the following values — you will need them in later steps:

```
VPC_ID=vpc-...
EC2_SG=sg-...
RDS_SG=sg-...
REDIS_SG=sg-...
```
