#!/usr/bin/env bash
#
# Hive — security verification against a running instance.
# Plan 11 Step 3. Re-runs Plan 04's checks over HTTP.
#
# This is the script that turns docs/security.md §4 from "believed fixed" into
# "confirmed fixed". Until it has been run and passed, the remediations there
# are reviewed code and nothing more.
#
# Usage:
#   BASE_URL=https://hive-backend.onrender.com \
#   PARENT_A_TOKEN=... PARENT_B_TOKEN=... \
#   TEACHER_X_TOKEN=... TEACHER_Y_TOKEN=... \
#   PHOTO_OF_B=<uuid> SCHOOL_Y=<uuid> CLASS_AT_Y=<uuid> PHOTO_OF_Y=<uuid> \
#   ./scripts/verify-security.sh
#
# Getting the tokens: sign in as each account in the app and copy the bearer
# token from the network log, or use supabase.auth.signInWithPassword from a
# node one-liner. The two parents must have children at different schools, and
# the two teachers must be at different schools — otherwise every check passes
# vacuously.
#
# Exit code is the number of failed checks, so CI can gate on it.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
API="$BASE_URL/api/v1"

PASS=0
FAIL=0
SKIP=0

red()   { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
grey()  { printf '\033[90m%s\033[0m\n' "$1"; }

# ---------------------------------------------------------------------------
# check <name> <expected-status> <curl args...>
# ---------------------------------------------------------------------------
check() {
  local name="$1" expected="$2"; shift 2
  local actual
  actual="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@")"

  if [ "$actual" = "$expected" ]; then
    green "  PASS  $name (got $actual)"
    PASS=$((PASS + 1))
  else
    red   "  FAIL  $name — expected $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

skip() {
  grey "  SKIP  $1 — $2"
  SKIP=$((SKIP + 1))
}

require() {
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then return 1; fi
  done
  return 0
}

echo
echo "Hive security verification"
echo "Target: $BASE_URL"
echo

# ---------------------------------------------------------------------------
echo "1. Reachability"
# ---------------------------------------------------------------------------

check "/health responds 200" 200 "$BASE_URL/health"

# ---------------------------------------------------------------------------
echo
echo "2. G-02 — photo files must not be publicly served"
# ---------------------------------------------------------------------------
# The static /uploads route is removed in Plan 03. While it exists, an
# unauthenticated GET for a path that does not exist returns 404 from
# express.static — which is NOT proof the route is gone. The real check is
# whether a path that DOES exist is served, so this needs a known-good key.

check "GET /uploads/<random> is not 200" 404 \
  "$BASE_URL/uploads/photos/does-not-exist-$(date +%s).jpg"

if require REAL_S3_KEY; then
  check "GET /uploads/<real key> is refused without auth" 404 \
    "$BASE_URL/uploads/$REAL_S3_KEY"
else
  skip "unauthenticated fetch of a real photo path" \
       "set REAL_S3_KEY to a photos.s3_key value that exists — this is THE G-02 check"
fi

# ---------------------------------------------------------------------------
echo
echo "3. G-04 — photo detail IDOR"
# ---------------------------------------------------------------------------

if require PARENT_A_TOKEN PHOTO_OF_B; then
  check "parent A reading parent B's child's photo → 404" 404 \
    -H "Authorization: Bearer $PARENT_A_TOKEN" "$API/feed/photos/$PHOTO_OF_B"
else
  skip "parent A → parent B's photo" "set PARENT_A_TOKEN and PHOTO_OF_B"
fi

if require PARENT_A_TOKEN PHOTO_OF_A; then
  check "parent A reading their own child's photo → 200" 200 \
    -H "Authorization: Bearer $PARENT_A_TOKEN" "$API/feed/photos/$PHOTO_OF_A"

  echo "     taggedStudentIds must contain only parent A's own children:"
  curl -s --max-time 20 -H "Authorization: Bearer $PARENT_A_TOKEN" \
    "$API/feed/photos/$PHOTO_OF_A" \
    | sed -n 's/.*"taggedStudentIds":\(\[[^]]*\]\).*/       \1/p'
  echo "     (compare against parent A's children — a foreign ID here is G-04b)"
else
  skip "parent A → own photo, and tag filtering" "set PARENT_A_TOKEN and PHOTO_OF_A"
fi

check "unauthenticated photo detail → 401" 401 "$API/feed/photos/$(uuidgen 2>/dev/null || echo 00000000-0000-0000-0000-000000000000)"

# ---------------------------------------------------------------------------
echo
echo "4. G-08 — cross-school IDORs"
# ---------------------------------------------------------------------------

if require TEACHER_X_TOKEN SCHOOL_Y; then
  check "teacher X listing school Y's students → 403" 403 \
    -H "Authorization: Bearer $TEACHER_X_TOKEN" "$API/schools/$SCHOOL_Y/students"
  check "teacher X listing school Y's classes → 403" 403 \
    -H "Authorization: Bearer $TEACHER_X_TOKEN" "$API/schools/$SCHOOL_Y/classes"
else
  skip "teacher X → school Y" "set TEACHER_X_TOKEN and SCHOOL_Y"
fi

if require TEACHER_X_TOKEN CLASS_AT_Y; then
  check "teacher X listing photos for a class at school Y → 403" 403 \
    -H "Authorization: Bearer $TEACHER_X_TOKEN" "$API/photos?classId=$CLASS_AT_Y"
else
  skip "teacher X → class at school Y" "set TEACHER_X_TOKEN and CLASS_AT_Y"
fi

if require TEACHER_X_TOKEN SCHOOL_X; then
  check "teacher X listing their OWN school's students → 200" 200 \
    -H "Authorization: Bearer $TEACHER_X_TOKEN" "$API/schools/$SCHOOL_X/students"
else
  skip "teacher X → own school (regression guard)" "set TEACHER_X_TOKEN and SCHOOL_X"
fi

if require ADMIN_TOKEN SCHOOL_Y; then
  check "admin listing any school's students → 200" 200 \
    -H "Authorization: Bearer $ADMIN_TOKEN" "$API/schools/$SCHOOL_Y/students"
else
  skip "admin cross-school access still works" "set ADMIN_TOKEN and SCHOOL_Y"
fi

# ---------------------------------------------------------------------------
echo
echo "5. G-17 — photo mutation ownership"
# ---------------------------------------------------------------------------

if require TEACHER_X_TOKEN PHOTO_OF_Y; then
  check "teacher X confirming teacher Y's photo → 403" 403 \
    -X POST -H "Authorization: Bearer $TEACHER_X_TOKEN" "$API/photos/$PHOTO_OF_Y/confirm"
  check "teacher X tagging on teacher Y's photo → 403" 403 \
    -X POST -H "Authorization: Bearer $TEACHER_X_TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"studentIds":["00000000-0000-0000-0000-000000000000"]}' \
    "$API/photos/$PHOTO_OF_Y/tag"

  if [ -f packages/backend/tests/fixtures/valid.jpg ]; then
    check "teacher X uploading a file to teacher Y's photo → 403" 403 \
      -X POST -H "Authorization: Bearer $TEACHER_X_TOKEN" \
      -F "file=@packages/backend/tests/fixtures/valid.jpg" \
      "$API/photos/$PHOTO_OF_Y/file"
  else
    skip "teacher X → file upload on Y's photo" "fixture valid.jpg not found"
  fi
else
  skip "photo mutation ownership" "set TEACHER_X_TOKEN and PHOTO_OF_Y"
fi

# ---------------------------------------------------------------------------
echo
echo "6. G-05 — role separation at the API"
# ---------------------------------------------------------------------------

if require PARENT_A_TOKEN; then
  check "parent reaching /admin/dashboard → 403" 403 \
    -H "Authorization: Bearer $PARENT_A_TOKEN" "$API/admin/dashboard"
  check "parent reaching /admin/users → 403" 403 \
    -H "Authorization: Bearer $PARENT_A_TOKEN" "$API/admin/users"
else
  skip "parent → /admin/*" "set PARENT_A_TOKEN"
fi

check "unauthenticated /admin/dashboard → 401 (not 403)" 401 "$API/admin/dashboard"
check "invalid token → 401" 401 -H "Authorization: Bearer not-a-real-token" "$API/notifications"

# ---------------------------------------------------------------------------
echo
echo "7. Error handling — NODE_ENV=production"
# ---------------------------------------------------------------------------

echo "     A triggered 500 must say 'Internal server error' and carry no stack."
if require FORCE_500_PATH; then
  body="$(curl -s --max-time 20 "$BASE_URL$FORCE_500_PATH")"
  if echo "$body" | grep -qi 'internal server error'; then
    green "  PASS  500 response is generic"; PASS=$((PASS + 1))
  else
    red   "  FAIL  500 response leaked detail: $body"; FAIL=$((FAIL + 1))
  fi
  if echo "$body" | grep -q '    at '; then
    red   "  FAIL  500 response contains a stack trace"; FAIL=$((FAIL + 1))
  else
    green "  PASS  no stack trace in the body"; PASS=$((PASS + 1))
  fi
else
  skip "500 response shape" "set FORCE_500_PATH to a route that reliably 500s"
fi

# ---------------------------------------------------------------------------
echo
echo "8. Transport and CORS"
# ---------------------------------------------------------------------------

case "$BASE_URL" in
  https://*) green "  PASS  base URL is HTTPS"; PASS=$((PASS + 1)) ;;
  *)         red   "  FAIL  base URL is not HTTPS — $BASE_URL"; FAIL=$((FAIL + 1)) ;;
esac

acao="$(curl -s -I --max-time 20 -H 'Origin: https://evil.example' "$BASE_URL/health" \
  | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')"

if [ "$acao" = "*" ]; then
  red "  FAIL  Access-Control-Allow-Origin is '*' — set CORS_ORIGINS explicitly (G-S10)"
  FAIL=$((FAIL + 1))
elif [ "$acao" = "https://evil.example" ]; then
  red "  FAIL  CORS reflects an arbitrary Origin"
  FAIL=$((FAIL + 1))
else
  green "  PASS  CORS does not allow an arbitrary origin (got '${acao:-none}')"
  PASS=$((PASS + 1))
fi

# ---------------------------------------------------------------------------
echo
echo "9. Rate limiting"
# ---------------------------------------------------------------------------
# Off by default: 100+ requests against a free-tier instance is slow and
# pollutes the limiter's window right before a demo.

if [ "${RUN_RATE_LIMIT_CHECK:-0}" = "1" ]; then
  echo "     sending 120 requests…"
  limited=0
  for _ in $(seq 1 120); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/health")"
    [ "$code" = "429" ] && limited=1 && break
  done
  if [ "$limited" = "1" ]; then
    green "  PASS  rate limiter returned 429"; PASS=$((PASS + 1))
  else
    red   "  FAIL  no 429 after 120 requests"; FAIL=$((FAIL + 1))
  fi
else
  skip "rate limiting" "set RUN_RATE_LIMIT_CHECK=1 (slow; consumes the window)"
fi

# ---------------------------------------------------------------------------
echo
echo "10. Repository hygiene"
# ---------------------------------------------------------------------------

if git rev-parse --git-dir >/dev/null 2>&1; then
  # docs/ is excluded because the audit and plans quote the credential they
  # are reporting. This script is excluded because it contains the patterns
  # themselves — without that it always fails on its own source.
  for pattern in 'Admin@123' 'AKIA[0-9A-Z]\{16\}' 'BEGIN RSA PRIVATE KEY' \
                 'eyJ[A-Za-z0-9_-]\{30,\}\.[A-Za-z0-9_-]\{30,\}'; do
    if git grep -qI "$pattern" -- . ':!docs' ':!scripts/verify-security.sh' \
         ':!pnpm-lock.yaml' 2>/dev/null; then
      red "  FAIL  '$pattern' found in tracked source"; FAIL=$((FAIL + 1))
      git grep -nI "$pattern" -- . ':!docs' ':!scripts/verify-security.sh' \
        ':!pnpm-lock.yaml' 2>/dev/null | sed 's/^/          /'
    else
      green "  PASS  no '$pattern' in tracked source"; PASS=$((PASS + 1))
    fi
  done

  # Anything named .env* that is not a committed *.example template.
  tracked_env="$(git ls-files | grep -E '(^|/)\.env' | grep -v '\.example$' || true)"
  if [ -n "$tracked_env" ]; then
    red "  FAIL  a real .env file is tracked:"; FAIL=$((FAIL + 1))
    echo "$tracked_env" | sed 's/^/          /'
  else
    green "  PASS  no real .env file is tracked"; PASS=$((PASS + 1))
  fi
else
  skip "repository hygiene" "not inside a git repository"
fi

# ---------------------------------------------------------------------------
echo
echo "---------------------------------------------"
printf 'passed %d   failed %d   skipped %d\n' "$PASS" "$FAIL" "$SKIP"
echo "---------------------------------------------"

if [ "$SKIP" -gt 0 ]; then
  echo
  grey "Skipped checks are NOT passes. A run with skips does not verify"
  grey "docs/security.md §4 — supply the missing variables and re-run."
fi

echo
exit "$FAIL"
