# Environment Setup

Everything needed to get Hive running locally.

Owner: **Bhargav**.

**Status — 1 Aug: an environment now exists and the backend runs against it.**
Supabase project `hive` (`udawaiykfvdcvcouiqxr`, ap-northeast-1), all 19
migrations applied, `/health` returning `"database": "ok"`. §7 records what that
made it possible to verify, and what still needs seed data or a device.

A second `hive-test` project for Plan 08 does **not** exist yet, so
`packages/backend/.env.test` is still unfilled and `pnpm test` still cannot run.

---

## 1. Create the Supabase project

You need **two** projects. Keep them clearly named.

| Project | Purpose |
|---|---|
| `hive-dev` | Development and the demo dataset |
| `hive-test` | Automated tests — the harness truncates tables |

For each: [supabase.com](https://supabase.com) → New project → choose a region
close to you (Mumbai / Singapore) → set a database password and save it.

---

## 2. Collect the credentials

Dashboard → **Project Settings → API**:

| Value | Where it goes | Notes |
|---|---|---|
| Project URL | `SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `anon` `public` key | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public by design — RLS enforces access |
| `service_role` key | `SUPABASE_SERVICE_KEY` | **Bypasses RLS entirely. Server only. Never in the app, never committed.** |

The distinction matters: the anon key in the mobile bundle is fine and
intended. The service-role key there would hand every user full database
access.

---

## 3. Write the env files

```bash
cp packages/backend/.env.example  packages/backend/.env
cp apps/mobile/.env.example       apps/mobile/.env
cp packages/backend/.env.test.example packages/backend/.env.test   # for Plan 08
```

Fill in the values from §2. All three are gitignored — check with
`git status` before committing anything.

**`ADMIN_EMAIL` / `ADMIN_PASSWORD`** have no defaults; `pnpm seed:admin` exits
if they are unset. That is deliberate — the previous version hardcoded
`admin@hive.app` / `Admin@123` and printed the password to stdout.

**`EXPO_PUBLIC_API_URL` cannot be `localhost` on a physical device.** Use your
machine's LAN IP:

```bash
ip addr show | grep 'inet '        # Linux
ipconfig getifaddr en0             # macOS
```

Then `EXPO_PUBLIC_API_URL=http://192.168.1.5:4000`. Expo inlines
`EXPO_PUBLIC_*` at build time, so restart the dev server after changing it.

---

## 4. Apply the migrations

**Use the CLI. Do not use `supabase/combined_migrations.sql`** — it stops at
`00015` and silently omits `00016`, `00017`, `00018` and `00020`. That leaves a
database that looks correctly set up but has a publicly-readable photos bucket
(G-02) and a broken order flow (G-01). See the warning in
`supabase/README_MIGRATIONS.md`.

Pass `--include-all`: migrations do not arrive in numeric order (`00020` landed
before `00018`), and without that flag the CLI skips a file whose version is
lower than one already applied.

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-ref>
pnpm db:migrate
```

No Docker needed — this pushes to the linked cloud project. If you would rather
skip `login`/`link`, pass the connection string directly (password from
Project Settings → Database):

```bash
supabase db push --include-all \
  --db-url "postgresql://postgres:<password>@db.<your-ref>.supabase.co:5432/postgres"
```

⚠ Never run `pnpm db:reset`. It targets a *local* stack and, against a linked
project, drops and recreates the database.

**Migration `00020` has not been applied anywhere yet.** It makes the photos
bucket private and drops the public read policy — the fix for the audit's most
severe finding. Until it runs, photos remain publicly readable.

Verify:

```sql
select id, public from storage.buckets where id = 'photos';   -- public = false
select count(*) from pg_policies where tablename = 'objects'; -- public read gone
```

If the `photos` bucket does not exist, create it manually: Storage → New bucket
→ name `photos` → **Public OFF**.

---

## 5. Redis

Only the order idempotency middleware uses it. Background workers were removed
in Plan 03.

```bash
docker run -d --name hive-redis -p 6379:6379 redis:7-alpine
# or: docker compose up redis
```

---

## 6. Run it

```bash
pnpm install
pnpm dev:backend      # http://localhost:4000
pnpm dev:mobile       # Expo
```

Check the backend is genuinely healthy — the endpoint verifies the database, so
a 503 means Supabase is unreachable rather than the process being down:

```bash
curl -s localhost:4000/health | jq
# { "status": "ok", "checks": { "database": "ok" }, ... }
```

---

## 7. Verify the work that has never run

Once the above works, these are the checks nobody has been able to perform.
**Report what actually happens, including failures** — several of these exercise
code that was written but never executed.

**Storage and image processing (Plan 03)**
- [ ] Teacher uploads a photo — completes without error
- [ ] Supabase → Storage → `photos` contains **both** the original and `_thumb.jpg`
- [ ] The `photos` row has non-null `thumbnail_s3_key`, `blurhash`, `width`, `height`
- [ ] Copy a photo URL from the network tab, open in a private window → **works**
- [ ] Strip the `?token=` query → **403**, not the image
- [ ] `curl localhost:4000/uploads/anything` → **404** (route deleted)
- [ ] Upload a HEIC file → stored as `.jpg`, renders on Android
- [ ] Rename a `.txt` to `.jpg` and upload → **400**

**Upload ordering and feed (Plan 05)** — *highest risk, least verified*
- [ ] Upload tagging a student whose parent you can log in as
- [ ] **Parent's Alerts shows "New photo of \<child\>"** — this is the G-07 fix
- [ ] Feed paginates past 20 items with no duplicates and none missing
- [ ] A photo tagged with two of the parent's children appears **once**
- [ ] A second parent does **not** see the first child's photos

**Observability (Plan 09)** — *verified 1 Aug against `udawaiykfvdcvcouiqxr`*
- [x] Responses carry an `X-Request-ID` header
- [x] Backend logs one `info` line per request with ID, status, duration
- [ ] Stop Supabase access → `/health` returns 503 *(not tested — would need to
      revoke the key mid-run)*

Also seen while up: the auth-failure warning logs the parse error but **not**
the token or `req.ip`, so the PII scrubbing added alongside the correlation IDs
is doing its job. Sentry took its no-op path cleanly (`Sentry disabled (no
SENTRY_DSN)`) rather than failing the boot.

**Verified at boot — 1 Aug (no seed data needed)**
- [x] `supabase db push --include-all` applies all 19 migrations to a fresh
      cloud project, `00001`–`00018` and `00020`
- [x] `photos` bucket exists with `public = false` — **G-02, applied for the
      first time anywhere**
- [x] `/health` → 200 with `"checks": {"database": "ok"}`
- [x] `curl localhost:4000/uploads/anything` → 404 (static route deleted)
- [x] Redis connects on boot
- [x] `/api/v1/{feed,photos,orders,notifications,admin}` all → 401
      unauthenticated; a malformed bearer token also → 401
- [x] Anon key against `profiles` returns `[]`, not a dump — RLS enforcing
- [x] Backend boots with no env validation error against real credentials

**Verified after seeding — 1 Aug**

`pnpm --filter @hive/backend seed:admin`, then `seed:demo`. Note the scripts
live in the backend package; there is no root `seed:admin`.

- [x] `seed:admin` creates the admin and **does not print the password** (G-10)
- [x] `seed:demo` loads 2 schools, 4 classes, 9 students, 8 profiles
- [x] Real `signInWithPassword` as a demo parent returns a usable JWT
- [x] Authenticated `GET /api/v1/feed` → 200 (empty — no photos yet)
- [x] Parent → `GET /api/v1/admin/users` → **403**, server-side RBAC
- [x] **G-08 cross-school IDOR:** teacher at Bloom gets 200 for her own school's
      classes, **403** for another school's classes *and* for its student roster
      including dates of birth

**Two defects found while doing this:**

1. `DEMO_PASSWORD` is required by `seedDemo.ts` but was missing from
   `packages/backend/.env.example` — it was only in `.env.test.example`, which
   the script does not read. Added to the example.
2. `seed:demo` ends with *"WARNING: zero notifications means tags were applied
   after status went ready."* That is a **false alarm when `seed-assets/` is
   empty** — no photos means no tags means no notifications, which says nothing
   about ordering. The warning should be suppressed when zero photos were
   seeded, or it will be ignored on the one run where it matters.

Everything still unticked needs **photos in `seed-assets/`** (12–15 JPEGs, see
that directory's README) or a device. Neither is blocked by the environment.

---

## 8. Deployment

Owner: **Bhargav**. Full detail in `docs/plans/09-deployment-and-observability.md`.

1. Render → New Web Service → repo, root `packages/backend`, environment
   **Docker** (the Dockerfile is written and committed)
2. Health check path `/health`
3. Environment variables as §2, plus:
   - `NODE_ENV=production` — **critical**; anything else returns internal error
     messages to clients
   - `CORS_ORIGINS` — explicit, never the `*` default
   - `BACKEND_URL` — the Render URL
4. Add a Render Redis instance
5. Deploy, then `curl https://<url>/health` **from a phone on mobile data**

**Free-tier instances sleep after ~15 minutes idle** and take 30–60 s to wake.
Hit the URL five minutes before any demo. This is the most common demo failure
and has nothing to do with the code.

---

## 9. Troubleshooting

| Symptom | Cause |
|---|---|
| Backend exits immediately at boot | `config/env.ts` validates with Zod and refuses to start on bad config. Read the error — it names the variable. |
| App loads, all API calls 401 | `EXPO_PUBLIC_API_URL` wrong, or the backend is pointed at a different Supabase project than the app |
| Photos upload but never appear | Migration `00020` not applied, or the `photos` bucket does not exist |
| `sharp` fails to install | Needs libvips. Alpine: `apk add vips-dev`. Debian: `apt install libvips-dev`. |
| Orders return 400 | Expected until Plan 02 lands — client and server disagree on the payload shape (G-01) |
| OTP email never arrives | Supabase default SMTP is rate-limited to a few per hour. Plan 01 Step 8 covers configuring Resend. |
