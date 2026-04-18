# Step 4 — ElastiCache Redis

## 4.1 Create a cache subnet group

```bash
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name url-shortener-cache-subnet \
  --cache-subnet-group-description "URL shortener cache subnet group" \
  --subnet-ids $SUBNET_IDS
```

## 4.2 Create the Redis cluster

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id url-shortener-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --cache-subnet-group-name url-shortener-cache-subnet \
  --security-group-ids $REDIS_SG
```

## 4.3 Wait for the cluster to become available

```bash
aws elasticache wait cache-cluster-available \
  --cache-cluster-id url-shortener-redis

echo "Redis is ready."
```

This takes about 5 minutes.

## 4.4 Get the Redis endpoint

```bash
REDIS_HOST=$(aws elasticache describe-cache-clusters \
  --cache-cluster-id url-shortener-redis \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
  --output text)

echo "REDIS_HOST=$REDIS_HOST"
```

Save this value. Your `REDIS_URL` in `.env` will be:

```
REDIS_URL=redis://<REDIS_HOST>:6379
```
