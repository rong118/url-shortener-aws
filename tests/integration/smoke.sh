#!/bin/bash
# ── Docker Compose smoke test ──────────────────────────────────────────────────
# Brings up the full stack, runs the real app, and exercises the 4 endpoints
# that the mock-based Jest tests cover (health, shorten, redirect, stats).
# Cleans up on success or failure.
set -euo pipefail

# ── Helpers ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { printf "${GREEN}✓ %s${NC}\n" "$*"; }
fail() { printf "${RED}✗ %s${NC}\n" "$*"; exit 1; }
info() { printf "${YELLOW}→ %s${NC}\n" "$*"; }

cleanup() {
  local exit_code=$?
  info "Tearing down stack…"
  docker compose down --volumes >/dev/null 2>&1 || true
  exit "$exit_code"
}
trap cleanup EXIT

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || fail "docker is not installed"
command -v curl  >/dev/null 2>&1 || fail "curl is not installed"
command -v jq    >/dev/null 2>&1 || fail "jq is not installed"
info "Prerequisites OK (docker, curl, jq)"

# ── Ensure no stale containers are running ────────────────────────────────────
info "Cleaning up any stale containers from previous runs…"
docker compose down --volumes >/dev/null 2>&1 || true

# ── Build & start dependencies first ────────────────────────────────────────────
info "Building and starting postgres + redis…"
docker compose up -d --build postgres redis >/dev/null 2>&1 || {
  docker compose logs --tail=30
  fail "Failed to start postgres / redis"
}

# Wait for postgres to accept connections (handles first-run init delay)
info "Waiting for postgres to be ready…"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U shorturl -d shorturl >/dev/null 2>&1; then
    break
  fi
  [ "$i" -eq 30 ] && fail "Postgres did not become ready within 30s"
  sleep 1
done
pass "Postgres is ready"

# ── Start app ──────────────────────────────────────────────────────────────────
info "Starting app…"
docker compose up -d app >/dev/null 2>&1 || {
  docker compose logs app --tail=20
  fail "Failed to start app"
}

# Wait for app to listen on port 3000
info "Waiting for app to be healthy…"
for i in $(seq 1 20); do
  if curl -sf -o /dev/null http://localhost:3000/health 2>/dev/null; then
    break
  fi
  [ "$i" -eq 20 ] && {
    docker compose logs app --tail=20
    fail "App did not become healthy within 20s"
  }
  sleep 1
done
pass "App is healthy"

# ── Migration ─────────────────────────────────────────────────────────────────
info "Running database migration…"
docker compose exec -T app node scripts/migrate.js >/dev/null 2>&1 || {
  docker compose logs app --tail=20
  fail "Migration failed"
}
pass "Migration applied"

# ── Health ────────────────────────────────────────────────────────────────────
info "Health check: GET /health"
HEALTH=$(curl -sf http://localhost:3000/health) || fail "Health endpoint unreachable"
[ "$HEALTH" = '{"status":"ok"}' ] || fail "Unexpected health response: $HEALTH"
pass "Health endpoint returned ok"

# ── Shorten ───────────────────────────────────────────────────────────────────
info "Shorten: POST /api/shorten"
SHORTEN=$(curl -sf -X POST http://localhost:3000/api/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}') || fail "Shorten endpoint failed"
SHORT_CODE=$(echo "$SHORTEN" | jq -r '.short_code')
SHORT_URL=$(echo "$SHORTEN" | jq -r '.short_url')

[ "${#SHORT_CODE}" -eq 7 ] || fail "Expected 7-char short code, got: $SHORT_CODE"
[ "$SHORT_URL" = "http://localhost:3000/$SHORT_CODE" ] || fail "Unexpected short_url: $SHORT_URL"
pass "Shorten returned 7-char code: $SHORT_CODE"

# ── Redirect ──────────────────────────────────────────────────────────────────
info "Redirect: GET /$SHORT_CODE"
REDIRECT_CODE=$(curl -sf -o /dev/null -w '%{http_code}' "http://localhost:3000/$SHORT_CODE") \
  || fail "Redirect endpoint failed"
[ "$REDIRECT_CODE" = "302" ] || fail "Expected 302 redirect, got: $REDIRECT_CODE"
pass "Redirect returned 302"

# ── Stats ─────────────────────────────────────────────────────────────────────
# Click tracking runs asynchronously after the 302 is sent, so give it a moment.
info "Stats: GET /api/stats/$SHORT_CODE"
for i in $(seq 1 10); do
  STATS=$(curl -sf "http://localhost:3000/api/stats/$SHORT_CODE") || fail "Stats endpoint failed"
  CLICK_COUNT=$(echo "$STATS" | jq '.click_count')
  [ "$CLICK_COUNT" -ge 1 ] && break
  [ "$i" -eq 10 ] && fail "Expected click_count >= 1 after redirect, got: $CLICK_COUNT"
  sleep 0.5
done
pass "Stats shows click_count=$CLICK_COUNT (≥1)"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  All 4 smoke tests passed."
echo "  Short code: $SHORT_CODE"
echo "  Short URL:  $SHORT_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
