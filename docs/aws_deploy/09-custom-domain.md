# Step 9 — Custom Domain with Route 53 + Elastic IP

This step maps your own domain name to the EC2 instance so users reach the app at
`http://yourdomain.com` instead of a raw IP address.

> **Prerequisites:** a registered domain. You can register one in Route 53 or use a domain
> already registered with another registrar (GoDaddy, Namecheap, etc.).

---

## 9.1 Allocate an Elastic IP

A regular EC2 public IP changes on every stop/start. An Elastic IP is a static address you own.

```bash
# Allocate the Elastic IP
EIP_ALLOC=$(aws ec2 allocate-address \
  --domain vpc \
  --query 'AllocationId' \
  --output text)

echo "EIP_ALLOC=$EIP_ALLOC"

# Get the actual IP address (you'll need it for DNS)
aws ec2 describe-addresses \
  --allocation-ids $EIP_ALLOC \
  --query 'Addresses[0].PublicIp' \
  --output text
```

Save the printed IP — this is your **Elastic IP**.

---

## 9.2 Associate the Elastic IP with your EC2 instance

```bash
# Get your EC2 instance ID (skip if you already know it)
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=url-shortener" \
            "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

echo "INSTANCE_ID=$INSTANCE_ID"

# Associate
aws ec2 associate-address \
  --instance-id $INSTANCE_ID \
  --allocation-id $EIP_ALLOC
```

After this your EC2 will always be reachable at the same IP, even after a reboot.

---

## 9.3 Open port 80 on the EC2 security group

The app currently listens on port 3000. We'll add a nginx reverse proxy in 9.6 to serve
traffic on the standard HTTP port 80.

```bash
# Get the EC2 security group ID
EC2_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=url-shortener-ec2" \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

# Allow HTTP (port 80) from anywhere
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG \
  --protocol tcp --port 80 --cidr 0.0.0.0/0
```

---

## 9.4 Create a Route 53 hosted zone (skip if using an external registrar)

> If your domain is registered outside AWS, skip to **9.5** and just note the
> name servers that Route 53 gives you so you can update them at your registrar.

```bash
# Replace yourdomain.com with your actual domain
DOMAIN="yourdomain.com"

HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
  --name $DOMAIN \
  --caller-reference $(date +%s) \
  --query 'HostedZone.Id' \
  --output text | sed 's|/hostedzone/||')

echo "HOSTED_ZONE_ID=$HOSTED_ZONE_ID"

# Print the four name servers Route 53 assigned
aws route53 get-hosted-zone \
  --id $HOSTED_ZONE_ID \
  --query 'DelegationSet.NameServers' \
  --output text
```

If your domain is registered with another registrar, log in to their control panel and
replace the existing name servers with the four values printed above. DNS propagation
typically takes 10–30 minutes, sometimes up to 48 hours.

---

## 9.5 Create an A record pointing your domain to the Elastic IP

Replace the placeholder values before running.

```bash
DOMAIN="yourdomain.com"        # your domain
ELASTIC_IP="1.2.3.4"           # Elastic IP from step 9.1
HOSTED_ZONE_ID="Z1234567890"   # hosted zone ID from step 9.4
                               # (or look it up: aws route53 list-hosted-zones)

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"$DOMAIN\",
        \"Type\": \"A\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$ELASTIC_IP\"}]
      }
    }]
  }"
```

To also handle `www.yourdomain.com` add a second CNAME record:

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"www.$DOMAIN\",
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$DOMAIN\"}]
      }
    }]
  }"
```

---

## 9.6 Install nginx as a reverse proxy on EC2

SSH into your instance, then run:

```bash
sudo apt update && sudo apt install -y nginx

# Write the reverse-proxy config
sudo tee /etc/nginx/sites-available/url-shortener > /dev/null <<'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/url-shortener \
            /etc/nginx/sites-enabled/url-shortener
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
sudo systemctl enable nginx
```

Replace `yourdomain.com` with your actual domain in the `server_name` line.

---

## 9.7 Update BASE_URL in your .env

SSH into EC2 and update the app's environment so short URLs are built with your domain:

```bash
sed -i 's|^BASE_URL=.*|BASE_URL=http://yourdomain.com|' /home/ec2-user/url-shortener/.env
pm2 restart url-shortener
```

---

## 9.8 Verify

```bash
# Wait for DNS to propagate, then test from your local machine
curl -I http://yourdomain.com/
# Expect: HTTP/1.1 200 OK

curl -s -X POST http://yourdomain.com/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' | jq .
# shortUrl should now read http://yourdomain.com/xxxxxxx
```

Check DNS propagation status at https://dnschecker.org if the domain is not resolving yet.

---

## 9.9 Checklist

- [ ] Elastic IP allocated and associated with EC2
- [ ] Port 80 open in the EC2 security group
- [ ] Route 53 hosted zone created (or external registrar updated with Route 53 name servers)
- [ ] A record for `yourdomain.com` → Elastic IP
- [ ] (Optional) CNAME for `www.yourdomain.com` → `yourdomain.com`
- [ ] nginx installed, reverse-proxying port 80 → 3000
- [ ] `BASE_URL` updated in `.env` and app restarted
- [ ] `http://yourdomain.com/` returns 200
