# Step 10 — Tear Down All Resources

Delete all AWS resources created by this guide. Order matters — dependencies must be removed before the resources they reference.

---

## 10.1 Terminate EC2 and release Elastic IP

```bash
# Get instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=url-shortener-app" \
            "Name=instance-state-name,Values=running,stopped" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

echo "INSTANCE_ID=$INSTANCE_ID"

# Get Elastic IP allocation ID
EIP_ALLOC=$(aws ec2 describe-addresses \
  --filters "Name=instance-id,Values=$INSTANCE_ID" \
  --query 'Addresses[0].AllocationId' \
  --output text)

# Disassociate and release the Elastic IP
EIP_ASSOC=$(aws ec2 describe-addresses \
  --allocation-ids $EIP_ALLOC \
  --query 'Addresses[0].AssociationId' \
  --output text)

aws ec2 disassociate-address --association-id $EIP_ASSOC
aws ec2 release-address --allocation-id $EIP_ALLOC

# Terminate the instance and wait
aws ec2 terminate-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-terminated --instance-ids $INSTANCE_ID

echo "EC2 terminated."
```

---

## 10.2 Delete ElastiCache Redis

```bash
aws elasticache delete-cache-cluster --cache-cluster-id url-shortener-redis
aws elasticache wait cache-cluster-deleted --cache-cluster-id url-shortener-redis

aws elasticache delete-cache-subnet-group \
  --cache-subnet-group-name url-shortener-cache-subnet

echo "ElastiCache deleted."
```

---

## 10.3 Delete RDS PostgreSQL

```bash
aws rds delete-db-instance \
  --db-instance-identifier url-shortener-db \
  --skip-final-snapshot

aws rds wait db-instance-deleted \
  --db-instance-identifier url-shortener-db

aws rds delete-db-subnet-group \
  --db-subnet-group-name url-shortener-subnet-group

aws rds delete-db-parameter-group \
  --db-parameter-group-name url-shortener-pg16

echo "RDS deleted."
```

> The `--skip-final-snapshot` flag skips the automatic backup on deletion. Omit it if you want a final snapshot before deleting.

---

## 10.4 Delete security groups

The RDS and Redis security groups must be deleted before the EC2 security group, because they reference it.

```bash
EC2_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=url-shortener-ec2" \
  --query 'SecurityGroups[0].GroupId' --output text)

RDS_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=url-shortener-rds" \
  --query 'SecurityGroups[0].GroupId' --output text)

REDIS_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=url-shortener-redis" \
  --query 'SecurityGroups[0].GroupId' --output text)

# Delete dependent groups first
aws ec2 delete-security-group --group-id $RDS_SG
aws ec2 delete-security-group --group-id $REDIS_SG
aws ec2 delete-security-group --group-id $EC2_SG

echo "Security groups deleted."
```

---

## 10.5 Delete the EC2 key pair

```bash
aws ec2 delete-key-pair --key-name url-shortener-key
echo "Key pair deleted."
```

The local private key file (`~/.ssh/url-shortener-key.pem`) is not removed by this command. Delete it manually if no longer needed:

```bash
rm ~/.ssh/url-shortener-key.pem
```

---

## 10.6 Delete Route 53 hosted zone (only if you completed step 9)

Route 53 requires all non-default records to be deleted before the hosted zone itself can be removed.

```bash
DOMAIN="yourdomain.com"   # replace with your actual domain

HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id" \
  --output text | sed 's|/hostedzone/||')

echo "HOSTED_ZONE_ID=$HOSTED_ZONE_ID"

# List all record sets (you must manually delete A and CNAME records via the console
# or build a batch delete — NS and SOA records cannot be deleted and are removed
# automatically when the zone is deleted)
aws route53 list-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID

# Delete the hosted zone (only works once non-default records are removed)
aws route53 delete-hosted-zone --id $HOSTED_ZONE_ID

echo "Hosted zone deleted."
```

---

## 10.7 Verify nothing is left running

```bash
# EC2
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=url-shortener-app" \
  --query 'Reservations[*].Instances[*].[InstanceId,State.Name]' \
  --output table

# RDS
aws rds describe-db-instances \
  --query 'DBInstances[?DBInstanceIdentifier==`url-shortener-db`].[DBInstanceIdentifier,DBInstanceStatus]' \
  --output table

# ElastiCache
aws elasticache describe-cache-clusters \
  --query 'CacheClusters[?CacheClusterId==`url-shortener-redis`].[CacheClusterId,CacheClusterStatus]' \
  --output table

# Elastic IPs (any unattached EIPs still cost money)
aws ec2 describe-addresses \
  --query 'Addresses[?InstanceId==null].[PublicIp,AllocationId]' \
  --output table
```

All tables should be empty (or show `terminated` / `deleting` states). Unattached Elastic IPs are billed even when unused — release any that appear in the last query.
