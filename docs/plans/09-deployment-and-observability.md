# Plan 09 — Deployment & Observability

**Branch:** `ci/deploy`
**Size:** M (~6 hours)
**Depends on:** Plan 03 (deploying local-disk storage produces a broken deployment), Plan 08 (CI runs the tests)
**Closes:** G-23, G-38, G-39

---

## Goal

Get Hive **running on the internet**, with CI verifying every change and errors visible when they happen.

**Current state:** no Dockerfile, no `.github/` directory, no deployment config, no error tracking. "Can we try it?" currently has no answer.

Deliberately simple: Expo app → Express on Render → Supabase. No Kubernetes, no Terraform. That is the right size here and defensible in a viva.

---

## Step 1 — Real health check

**The finding:** `app.ts:64` returns a static 200 with a timestamp. It never checks whether the database is reachable, so a backend with a broken Supabase connection reports healthy — and Render's health check would keep routing traffic to it.

**File:** `packages/backend/src/app.ts`

Make `/health`:
1. Run a trivial Supabase query (`profiles` count, `head: true`) with a ~2 s timeout.
2. Return `{ status, service, version, uptime, checks: { database: 'ok' | 'error' } }`.
3. Return **503** when the database check fails.
4. **Never leak connection strings or error details** — a boolean is enough. This endpoint is public.

---

## Step 2 — Request correlation IDs (G-38)

**Two findings.** `app.ts:47-52` logs requests at `logger.debug`, but the production log level is `info` (`logger.ts:23`) — **request logs are invisible in production.** And `X-Request-ID` is allow-listed in CORS (`app.ts:33`) but never generated, read, or logged.

**New file:** `packages/backend/src/middleware/requestId.ts`
- Read `X-Request-ID` from the incoming request, or generate a UUID.
- Attach to `req.requestId` (extend the Express `Request` type as `middleware/auth.ts` already does).
- Echo it in the response header.

**File:** `app.ts`
- Mount it **before** the logging middleware.
- Change request logging to `logger.info` and include `requestId`, `method`, `path`, `statusCode`, and duration — log on response finish, not on receipt, so you capture status and timing.

**File:** `middleware/errorHandler.ts`
- Include `requestId` in every error log and in the JSON error response. Then a user reporting "it failed" can quote an ID you can grep.

**Also fix G-L3/G-L4 while here:**
- `auth.ts:45` logs `req.ip` on invalid tokens — PII. Drop it or truncate the last octet.
- `auth.ts:83` logs `{ error: err }` — the whole object, which may embed request context including the token. Log `err.message` only.

---

## Step 3 — Sentry (G-39)

**Backend:**
```bash
pnpm --filter @hive/backend add @sentry/node
```
Initialise in `index.ts` before anything else. Add the error handler after the routes but before `errorHandler`. Set `environment` from `NODE_ENV` and enable only when `SENTRY_DSN` is set — so local development stays quiet.

**Mobile:**
```bash
pnpm --filter @hive/mobile add @sentry/react-native
```
Initialise in `app/_layout.tsx`. Wrap the existing `ErrorBoundary` so React errors are reported.

**Scrub PII in `beforeSend` on both:** strip `Authorization` headers, tokens, email addresses, and photo URLs (which are signed and grant access). This is worth doing properly — it is a good viva talking point and a genuine requirement for a child-photo product.

Add `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` to both `.env.example` files, marked optional.

**Verify:** trigger a deliberate error and confirm it appears in Sentry. **Screenshot it for the report** — Plan 10 uses it.

---

## Step 4 — Dockerfile

**New file:** `packages/backend/Dockerfile`

Multi-stage:
1. **Builder** — `node:20-alpine`, enable pnpm via corepack, copy workspace manifests, `pnpm install --frozen-lockfile`, copy source, `pnpm build`.
2. **Runtime** — `node:20-alpine`, production deps only, copy `dist/`, run as a **non-root user**, `EXPOSE 4000`, `HEALTHCHECK` hitting `/health`.

**`sharp` needs care on Alpine.** It ships prebuilt binaries for musl but occasionally needs `apk add --no-cache vips-dev` in the builder. **Test the image locally before pushing** — this is the most likely failure in this plan.

**New file:** `packages/backend/.dockerignore` — `node_modules`, `dist`, `.env*`, `tests`, `uploads`.

**New file:** `docker-compose.yml` (repo root) — backend + Redis for local development. Redis is still needed for idempotency (DEC-3).

---

## Step 5 — GitHub Actions

**New file:** `.github/workflows/ci.yml`

Trigger on PRs to `develop`/`main` and pushes to both.

Jobs:
1. **`verify`** — checkout, pnpm + Node 20 with cache, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build:backend`.
2. **`test`** — needs `verify`; runs `pnpm test` with test-project secrets from GitHub Secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DEMO_PASSWORD`). Add a `redis:7-alpine` service container for the idempotency tests.
3. **`docker`** — needs `verify`; builds the image to prove it builds. Do not push.

Add `concurrency` with `cancel-in-progress` and `timeout-minutes: 15` on each job.

> If wiring a test Supabase project into CI proves fiddly, run `verify` + `docker` in CI and keep `test` local — but say so in Plan 10's testing document. Silently skipping tests in CI is worse than honestly scoping them.

**Branch protection** on `main` and `develop`: require the `verify` check, require one approving review, disallow force-push.

---

## Step 6 — Deploy the backend to Render

1. New Web Service from the repo. Root directory `packages/backend`, environment **Docker**.
2. Health check path `/health`.
3. Environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` — **critical**; `errorHandler.ts:97` leaks `err.message` otherwise |
| `PORT` | `4000` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | production project |
| `BACKEND_URL` | the Render URL |
| `CORS_ORIGINS` | **explicit** — never leave the `*` default (G-S10) |
| `REDIS_URL` | Render Redis instance |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD` | — |
| `SENTRY_DSN` | — |

4. Add a Render Redis instance (free tier).
5. Deploy; confirm `/health` returns 200 with `database: 'ok'`.

**Free-tier cold starts.** Render free services sleep after ~15 minutes idle and take 30–60 s to wake. **Hit the URL five minutes before the demo.** Note this in Plan 11's checklist — it is a classic demo failure.

---

## Step 7 — Mobile build

1. `pnpm --filter @hive/mobile exec eas build:configure`
2. In `eas.json`, add a `preview` profile producing an installable Android APK.
3. Point `EXPO_PUBLIC_API_URL` at the Render URL. Expo inlines `EXPO_PUBLIC_*` at build time, so this must be set **before** building.
4. Build the APK, install it on a real device, and verify against the deployed backend over **mobile data, not WiFi** — that is the demo condition.
5. Commit the APK to `docs/submission/` (the reference `report.md` shows this course expects it) or attach it to a GitHub release.

**Also fix G-C5 here:** `app.json` has no `extra` block, so `Constants.expoConfig?.extra?.apiUrl` in `lib/api.ts:5` and `teacherService.ts:28` is always `undefined` and the code silently falls through to `process.env`. Either add an `extra` block or delete the dead lookup. Deleting is simpler.

---

## Step 8 — Migration script

`README_MIGRATIONS.md` documents a manual `supabase db push`. Wrap it:

**Root `package.json`:** `"db:migrate": "supabase db push"`, `"db:reset": "supabase db reset"`.

Document in `docs/deployment.md`: migrations are applied manually before deploy, deliberately — automatic migration on boot is a foot-gun with multiple instances, and this project does not need it.

**Rollback procedure** — write it down:
1. Render → Deploys → redeploy the previous successful build.
2. Database → restore from Supabase's daily backup (free tier includes 7 days).
3. Migrations are forward-only; a bad migration needs a compensating one.

---

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm build:backend && pnpm test
docker build -t hive-backend -f packages/backend/Dockerfile .
docker run --rm -p 4000:4000 --env-file packages/backend/.env hive-backend
curl localhost:4000/health
```

- [ ] `/health` returns 200 with `database: 'ok'`
- [ ] Stopping Supabase access → `/health` returns 503
- [ ] Response includes an `X-Request-ID` header
- [ ] Backend logs show one `info` line per request with the ID, status and duration
- [ ] A deliberate error appears in Sentry within a minute
- [ ] Sentry event contains **no** tokens, emails, or signed photo URLs
- [ ] CI is green on a test PR
- [ ] A PR with a lint error is **blocked**
- [ ] Deployed `/health` reachable from a phone browser on mobile data
- [ ] APK installs and the full app works against the deployed backend
- [ ] `NODE_ENV=production` confirmed — trigger a 500 and check the response says "Internal server error", not a stack message

---

## Commit sequence

```
feat(api): add dependency-aware health check
feat(obs): add request correlation IDs and production request logging
security(obs): stop logging client IPs and raw error objects on auth failures
feat(obs): integrate Sentry with PII scrubbing on backend and mobile
build(docker): add multi-stage backend Dockerfile and compose file
ci: add lint, typecheck, build, test and docker workflow
chore(deploy): configure Render deployment and environment
chore(mobile): add EAS preview build profile and remove dead config lookup
chore(scripts): add database migration and reset commands
```

---

## Done when

- [ ] Backend deployed with a public HTTPS URL
- [ ] `/health` green from an external network
- [ ] CI passing and required on `main`/`develop`
- [ ] Sentry receiving scrubbed events from both apps
- [ ] APK installable and working against the deployed backend
- [ ] Rollback procedure written
- [ ] Merged into `main`, then `develop` → `main`, tagged `v0.9.0`

---

## Deviations

*Record here anything that differed from this plan, and why.*
