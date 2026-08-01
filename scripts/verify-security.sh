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
#   eval "$(pnpm --filter @hive/backend --silent verify:env)"
#   ./scripts/verify-security.sh
#
# `verify:env` signs in as the seeded demo accounts and prints every variable
# below as an export line. Doing it by hand instead means setting:
#
#   BASE_URL             default http://localhost:4000
#   PARENT_A_TOKEN       a parent with children at school X
#   PARENT_A_CHILD_IDS   comma-separated student UUIDs belonging to parent A
#   PHOTO_OF_A           a photo tagging one of parent A's children
#   PHOTO_OF_B           a photo tagging ONLY another family's child
#   TEACHER_X_TOKEN      a teacher at school X
#   TEACHER_X2_TOKEN     a SECOND teacher at school X — same school as X
#   PHOTO_OF_X2          a photo uploaded by teacher X2
#   SCHOOL_X             teacher X's own school
#   SCHOOL_Y             a different school
#   CLASS_AT_Y           a class belonging to school Y
#   PHOTO_OF_Y           a photo uploaded at school Y
#   ADMIN_TOKEN          an admin, to prove the guards do not over-refuse
#   REAL_S3_KEY          an existing photos.s3_key value
#   FORCE_500_PATH       optional; a route that reliably 500s
#   RUN_RATE_LIMIT_CHECK optional; 1 to run §9
#   STRICT               optional; 1 to count skips as failures
#
# The two teachers must be at the SAME school. G-17 is about one teacher
# mutating another's photo; with teachers at different schools the school check
# refuses first and the ownership check never runs, so the section passes
# without testing what it names. Cross-school refusal is §4's job, not §5's.
#
# Exit code is the number of failed checks, so CI can gate on it. Skips are not
# failures by default — set STRICT=1 to make them count, which is what CI wants.
#
# Note on the rate limiter: a full run is ~25 requests against a 100 per 15
# minutes global limit. Two runs inside one window will start returning 429s.
# The script names them when it sees them rather than reporting a broken guard.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
API="$BASE_URL/api/v1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

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
  elif [ "$actual" = "429" ]; then
    # Not an authorization result. The global limiter allows 100 requests per
    # 15 minutes and sits in front of every route, so a re-run inside that
    # window turns the whole script red for a reason that has nothing to do
    # with what it tests.
    red "  FAIL  $name — got 429, the rate limiter. Wait out the 15 minute"
    red "        window or restart the backend, then re-run. Not a real result."
    FAIL=$((FAIL + 1))
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

# Later sections read response headers and bodies. A dead server returns
# neither, and "no Access-Control-Allow-Origin header" is indistinguishable
# from "correctly configured CORS" — so an unreachable target used to report a
# PASS. Record reachability once and let those checks skip instead.
health_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE_URL/health")"
REACHABLE=0
[ "$health_code" != "000" ] && REACHABLE=1

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

  # G-04b. This used to print taggedStudentIds through sed and ask the reader
  # to eyeball it, which asserts nothing and passes silently when nobody looks.
  if ! command -v jq >/dev/null 2>&1; then
    skip "G-04b tag filtering" "jq is not installed"
  elif ! require PARENT_A_CHILD_IDS; then
    skip "G-04b tag filtering" "set PARENT_A_CHILD_IDS to parent A's student UUIDs"
  else
    tagged="$(curl -s --max-time 20 -H "Authorization: Bearer $PARENT_A_TOKEN" \
      "$API/feed/photos/$PHOTO_OF_A" | jq -r '.data.taggedStudentIds[]? // empty')"
    foreign=""
    for id in $tagged; do
      case ",$PARENT_A_CHILD_IDS," in
        *",$id,"*) ;;
        *) foreign="$foreign $id" ;;
      esac
    done
    if [ -z "$tagged" ]; then
      red "  FAIL  G-04b — no taggedStudentIds returned; the check cannot run"
      FAIL=$((FAIL + 1))
    elif [ -n "$foreign" ]; then
      red "  FAIL  G-04b — response leaked another family's student IDs:$foreign"
      FAIL=$((FAIL + 1))
    else
      green "  PASS  G-04b — taggedStudentIds contains only parent A's own children"
      PASS=$((PASS + 1))
    fi
  fi
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
# assertPhotoAccess requires uploaded_by == caller AND school_id == caller's
# school. Probing it with a teacher from another school satisfies neither, so
# the refusal proves only the school half — which §4 already covers. The
# uploader half is only exercised by two teachers at the SAME school, and that
# is the case IMPLEMENTATION-STATUS.md records as never verified.

FIXTURE="$REPO_ROOT/packages/backend/tests/fixtures/valid.jpg"

if require TEACHER_X_TOKEN PHOTO_OF_X2; then
  check "teacher X confirming a colleague's photo, same school → 403" 403 \
    -X POST -H "Authorization: Bearer $TEACHER_X_TOKEN" "$API/photos/$PHOTO_OF_X2/confirm"
  check "teacher X tagging a colleague's photo, same school → 403" 403 \
    -X POST -H "Authorization: Bearer $TEACHER_X_TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"studentIds":["00000000-0000-0000-0000-000000000000"]}' \
    "$API/photos/$PHOTO_OF_X2/tag"

  if [ -f "$FIXTURE" ]; then
    check "teacher X overwriting a colleague's photo file, same school → 403" 403 \
      -X POST -H "Authorization: Bearer $TEACHER_X_TOKEN" \
      -F "file=@$FIXTURE" "$API/photos/$PHOTO_OF_X2/file"
  else
    skip "teacher X → file upload on a colleague's photo" "fixture not found at $FIXTURE"
  fi
else
  skip "photo mutation ownership (the G-17 check)" \
       "set TEACHER_X_TOKEN and PHOTO_OF_X2 — X2 must be a teacher at the SAME school"
fi

# The cross-school variant. Weaker, because the school check refuses before
# ownership is consulted, but it is still a regression guard worth keeping.
if require TEACHER_X_TOKEN PHOTO_OF_Y; then
  check "teacher X confirming another school's photo → 403" 403 \
    -X POST -H "Authorization: Bearer $TEACHER_X_TOKEN" "$API/photos/$PHOTO_OF_Y/confirm"
else
  skip "teacher X → another school's photo" "set TEACHER_X_TOKEN and PHOTO_OF_Y"
fi

# The matching over-refusal check — that the owner CAN still act — is not here
# on purpose. All three routes mutate, and this script runs against the demo
# database. tests/authorization.test.ts covers the positive case against the
# throwaway test project, where writing is free.

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
echo "     Only meaningful against NODE_ENV=production — in any other mode the"
echo "     error handler returns internal messages by design."
if require FORCE_500_PATH; then
  # Sent authenticated when a token is available. Every /api/v1/* route sits
  # behind `authenticate`, so an anonymous probe can only ever be a 401 and
  # this section would report on the wrong response.
  body="$(curl -s --max-time 20 \
    ${ADMIN_TOKEN:+-H "Authorization: Bearer $ADMIN_TOKEN"} \
    "$BASE_URL$FORCE_500_PATH")"
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

# A local backend is plain HTTP by design, so failing on it made every local
# run red regardless of what the authorization checks found — and the local run
# is the only one possible until something is deployed. Loopback is a skip;
# anything else on the network is still a failure.
case "$BASE_URL" in
  https://*)
    green "  PASS  base URL is HTTPS"; PASS=$((PASS + 1)) ;;
  http://localhost*|http://127.0.0.1*|http://[::1]*)
    skip "transport is HTTPS" "target is loopback — re-run against the deployed URL" ;;
  *)
    red "  FAIL  base URL is not HTTPS and not loopback — $BASE_URL"; FAIL=$((FAIL + 1)) ;;
esac

acao="$(curl -s -I --max-time 20 -H 'Origin: https://evil.example' "$BASE_URL/health" \
  | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')"

if [ "$REACHABLE" != "1" ]; then
  skip "CORS origin handling" "target is unreachable — an absent header proves nothing"
elif [ "$acao" = "*" ]; then
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

# The header promises CI can gate on the exit code, but a run with every
# variable unset skips all fifteen checks and exits 0 — a green build that
# tested nothing. STRICT=1 makes skips count, which is what a gate needs.
if [ "${STRICT:-0}" = "1" ] && [ "$SKIP" -gt 0 ]; then
  echo
  red "STRICT=1 — counting $SKIP skipped check(s) as failures."
  FAIL=$((FAIL + SKIP))
fi

echo
exit "$FAIL"
