# Step 8 — Verify the Deployment

Replace `<EC2_IP>` with your instance's public IP in every command below.

## 8.1 Health check

```bash
curl http://<EC2_IP>:3000/
# Should return the web UI HTML
```

## 8.2 Shorten a URL

```bash
curl -s -X POST http://<EC2_IP>:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' | jq .
```

Expected response:

```json
{
  "shortUrl": "http://<EC2_IP>:3000/abc1234",
  "code": "abc1234",
  "expiresAt": "2026-04-24T..."
}
```

## 8.3 Follow the redirect

```bash
curl -v http://<EC2_IP>:3000/<code>
# Expect: HTTP 302 → Location: https://example.com
```

## 8.4 Check stats

```bash
curl -s http://<EC2_IP>:3000/api/stats/<code> | jq .
```

Expected response:

```json
{
  "code": "abc1234",
  "originalUrl": "https://example.com",
  "clickCount": 1,
  "clicks": [...]
}
```

## 8.5 Verify rate limiting

Send more than 100 requests per minute from the same IP:

```bash
for i in $(seq 1 110); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://<EC2_IP>:3000/api/shorten \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com"}'
done
# After 100 requests you should see: 429
```

## 8.6 Checklist

- [ ] Web UI loads at `http://<EC2_IP>:3000`
- [ ] `POST /api/shorten` returns a short URL
- [ ] `GET /:code` redirects (302) to the original URL
- [ ] `GET /api/stats/:code` returns click data
- [ ] Rate limiter returns 429 after limit is exceeded
- [ ] App survives an EC2 reboot (`sudo reboot`, wait, `pm2 status`)
