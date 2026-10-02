#!/usr/bin/env bash
# Smoke test of the running Docker stack (spec §7.4). It checks the SPA, the
# API through the SPA's /api proxy with the session cookie, and Swagger.
#
#   docker compose up -d --build --wait
#   ./scripts/smoke-test.sh
#
# It reads the compose defaults. If your .env changes a port or the seeded
# credentials, export the same variables before running it. It changes no data.
set -euo pipefail

FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT:-8080}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT:-3000}"
EMAIL="${SEED_USER_EMAIL:-admin@example.com}"
PASSWORD="${SEED_USER_PASSWORD:-Password123!}"
APPENDIX_A_NUMBER="IV1780488206995"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
jar="$work/cookies.txt"

ok() { printf 'ok   %s\n' "$1"; }
fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}
# Prints a value from the JSON on stdin, e.g. `json d.paging.total < file`.
json() { node -e "const d = JSON.parse(require('node:fs').readFileSync(0, 'utf8')); console.log($1)"; }
# The SPA's requests: the session cookie plus the header the API requires with it (ADR-0002).
api() { curl -sS -b "$jar" -c "$jar" -H 'X-Requested-With: XMLHttpRequest' "$@"; }

curl -fsS -D "$work/headers.txt" -o "$work/index.html" "$FRONTEND_URL/" || fail "GET $FRONTEND_URL/"
grep -q '<div id="root">' "$work/index.html" || fail "GET / did not return the SPA"
grep -qi '^content-security-policy:' "$work/headers.txt" || fail "GET / has no Content-Security-Policy"
ok "GET / serves the SPA with its security headers"

status=$(api -o /dev/null -w '%{http_code}' "$FRONTEND_URL/api/invoices")
[ "$status" = 401 ] || fail "GET /api/invoices without a session returned $status, not 401"
ok "GET /api/invoices without a session returns 401"

# JSON.stringify escapes the values, so a password with " or \ still makes a valid body.
body=$(node -e 'console.log(JSON.stringify({ email: process.argv[1], password: process.argv[2] }))' "$EMAIL" "$PASSWORD")
status=$(api -o "$work/login.json" -w '%{http_code}' -H 'Content-Type: application/json' \
  --data "$body" "$FRONTEND_URL/api/auth/login")
[ "$status" = 200 ] || fail "POST /api/auth/login returned $status, not 200"
grep -q 'access_token' "$jar" || fail "POST /api/auth/login set no access_token cookie"
ok "POST /api/auth/login signs in and sets the session cookie"

[ "$(api "$FRONTEND_URL/api/auth/me" | json d.email)" = "$EMAIL" ] || fail "GET /api/auth/me"
ok "GET /api/auth/me returns $EMAIL"

api -f -o "$work/list.json" "$FRONTEND_URL/api/invoices?keyword=$APPENDIX_A_NUMBER" || fail "GET /api/invoices"
[ "$(json 'd.data.map((i) => i.invoiceNumber).join()' < "$work/list.json")" = "$APPENDIX_A_NUMBER" ] ||
  fail "GET /api/invoices?keyword=$APPENDIX_A_NUMBER did not find the seeded Appendix A Invoice"
ok "GET /api/invoices finds the seeded Appendix A Invoice"

status=$(api -o /dev/null -w '%{http_code}' -X POST "$FRONTEND_URL/api/auth/logout")
[ "$status" = 204 ] || fail "POST /api/auth/logout returned $status, not 204"
status=$(api -o /dev/null -w '%{http_code}' "$FRONTEND_URL/api/auth/me")
[ "$status" = 401 ] || fail "GET /api/auth/me after logout returned $status, not 401"
ok "POST /api/auth/logout ends the session"

curl -fsS -o "$work/openapi.json" "$BACKEND_URL/api/docs-json" || fail "GET $BACKEND_URL/api/docs-json"
[ "$(json "'/invoices/{id}' in d.paths" < "$work/openapi.json")" = true ] ||
  fail "the OpenAPI document does not describe /invoices/{id}"
ok "Swagger documents the API at $BACKEND_URL/api/docs"

echo "Smoke test passed."
