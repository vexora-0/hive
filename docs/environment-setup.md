# Environment Setup

Everything needed to get Hive running locally.

Owner: **Bhargav**.

**Status — 1 Aug: an environment now exists and the backend runs against it.**
Supabase project `hive` (`udawaiykfvdcvcouiqxr`, ap-northeast-1), all 19
migrations applied, `/health` returning `"database": "ok"`. §7 records what that
made it possible to verify, and what still needs seed data or a device.

The `hive-test` project now exists too (`sdbiuzuyipneioceqysm`,
ap-southeast-1), with all 19 migrations applied. `pnpm test` runs against it —
**58 of 59 pass** — so the suite can no longer touch the demo data.

Two variables the harness requires were missing from `.env.test.example` and
have been added: `SUPABASE_ANON_KEY` (without it all four test files fail with
`supabaseKey is required`) and `DEV_SUPABASE_URL` (which arms the guard in
`tests/setup.ts` — it does nothing while unset).

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

**Migration `00020` is what makes the photos bucket private** and drops the
public read policy — the fix for the audit's most severe finding. It is applied
on both projects; if you create a third, it must run there too or photos are
publicly readable.

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

**Storage and image processing (Plan 03)** — *verified 1 Aug via `seed:demo:reset`*
- [x] Photo processing completes without error — 6 of 6
- [x] Storage holds **both** the original and `_thumb.jpg`
- [x] `photos` rows have non-null `thumbnail_s3_key`, `blurhash`, `width`, `height`,
      and `status = ready`
- [x] A signed photo URL fetches **200** from an unauthenticated client
- [x] Strip the `?token=` query → **400**, not the image *(400 rather than the
      403 the plan predicted — Supabase rejects the malformed request before
      authorising it; the security property holds either way)*
- [x] `curl localhost:4000/uploads/anything` → **404** (route deleted)
- [x] Upload a HEIC file → **tested 24 July, and it does not convert.** A real
      HEVC HEIC fails the pixel decode ("No decoding plugin installed for this
      compression format") because `sharp`'s prebuilt libvips has no HEVC codec.
      The server refuses it with a 400 telling the teacher to re-save as JPEG.
      An AVIF, which shares the HEIF container, **does** convert. The working
      path is the device-side transcode in `(teacher)/upload.tsx`
- [x] Rename a `.txt` to `.jpg` and upload → **400**. Covered by
      `photos.test.ts` T-20 on every suite run since 1 Aug

> These went through the seed script, which calls the photo service directly.
> The HTTP path — `POST /photos`, the multipart step, `/tag`, `/confirm` — has
> not been driven by a client yet.

**Upload ordering and feed (Plan 05)** — *verified 1 Aug*
- [x] Photos tagged to students whose parents can be logged in as — 9 tags
- [x] **Parent's alerts show "New photo of \<child\>"** — the G-07 fix. 16
      notifications, correct parent, correct child name ("New photo of Diya
      Kumar"). The seed's zero-notification warning no longer fires
- [ ] Feed paginates past 20 items — **not tested**, only 6 photos seeded
- [x] No duplicate photo IDs in a parent's feed
- [x] **A second parent does not see the first child's photos.** 6 photos exist;
      Rajesh (Bloom, two children) sees 2, Vikram (Little Stars) sees 1, **zero
      overlap**

**Observability (Plan 09)** — *verified 1 Aug against `udawaiykfvdcvcouiqxr`*
- [x] Responses carry an `X-Request-ID` header
- [x] Backend logs one `info` line per request with ID, status, duration
- [x] Stop Supabase access → `/health` returns 503 — *tested 1 Aug by stopping
      the Supabase API mid-run: **503**, `"status":"degraded"`,
      `"checks":{"database":"error"}`, and it recovered to 200 on restart*

Also seen while up: the auth-failure warning logs the parse error but **not**
the token or `req.ip`, so the PII scrubbing added alongside the correlation IDs
is doing its job. Sentry took its no-op path cleanly (`Sentry disabled (no
SENTRY_DSN)`) rather than failing the boot.

**Security verification (Plan 04 / Plan 11)** — *last run 11 Aug, `NODE_ENV=production`*
- [x] `scripts/verify-security.sh` — **27 passed, 0 failed, 2 skipped** (11 Aug;
      it was 26/0/3 on 1 Aug). See `docs/security.md` §9 for both runs and for
      why each remaining skip is skipped
- [x] `SUPABASE_ANON_KEY` present in `packages/backend/.env` — **required**.
      `verify:env` needs it to sign in as the demo accounts; the service-role
      key bypasses RLS and does not mint the user-scoped JWT the API expects,
      only a real sign-in does. Without it 13 of the 26 checks skip, and a skip
      is not a pass
- [x] G-17 same-school upload ownership — **403** on `/confirm`, `/tag`, `/file`
- [x] Rate limiter returns 429 — **at request 98** against the write limiter
      (100 per identity). The check previously targeted `/health`, which is
      exempt from rate limiting, so it could not pass; fixed in `701c999`
- [ ] HTTPS and CORS against a real origin — **skipped, needs a deployment**
- [ ] A triggered 500 carries no stack — **skipped**. Needs `FORCE_500_PATH`
      pointed at a route that reliably 500s **and** `NODE_ENV=production`;
      production mode alone does not un-skip it, because the check is gated on
      `FORCE_500_PATH` being set. No such route exists for an anonymous probe —
      every `/api/v1/*` route is behind `authenticate`, which answers 401 on any
      Supabase failure. Covered instead by `errors.test.ts` T-34

To repeat it:

```bash
eval "$(pnpm --filter @hive/backend verify:env | grep '^export')"
./scripts/verify-security.sh          # STRICT=1 counts skips as failures
```

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

Everything still unticked needs a device, or a case the seed does not cover —
the 11 seed photographs landed in `abe853a`, so `seed-assets/` is no longer
empty.

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

## 8a. Running it in a browser

The app runs in Chrome through `react-native-web`. This is how the screens were
first ever seen rendering — until 9 August nothing had been observed running at
all. Web is a verification convenience; the product targets iOS and Android.

```bash
pnpm install                                        # REQUIRED after pulling — see below
pnpm --filter @hive/mobile exec expo start --web --clear
# serves on http://localhost:8081
```

The backend must be running separately on `:4000`, and `apps/mobile/.env` must
exist — it is gitignored, so a fresh clone has none.

### If the page is blank

A blank page with the tab title "Hive" and **nothing in the console** is the
signature failure. Diagnose it by symptom rather than guessing — the three
causes look different:

| What you see | Cause | Fix |
|---|---|---|
| Metro says `Unable to resolve "react-dom"` or `"@lottiefiles/dotlottie-react"` | Three dependencies were added for web on 9 August. Pulling the commit does not install them | `pnpm install` |
| Metro bundles fine, page blank, **console completely empty**, only `entry.bundle` and `favicon.ico` in the network tab | Stale Metro cache serving modules transformed by the old Babel config. `babel.config.js` gained a web-only `unstable_transformImportMeta` — without it, zustand's `import.meta.env.MODE` makes the whole bundle a **parse** error, so nothing executes and nothing can be logged | Restart with `--clear` |
| Page renders, sign-in succeeds, then bounces straight back to login | `expo-secure-store` has no web implementation — its web module is `export default {}` — so the session was never persisted and auth-js fell back to the anon key. Fixed on 9 August in `src/lib/supabase.ts` | `git pull`, then `--clear` |
| Page renders, but every API call fails | Backend not running, or `EXPO_PUBLIC_API_URL` points at a LAN IP that is not this machine. For a browser demo it should be `http://localhost:4000` | Fix `apps/mobile/.env` |

The empty console is the tell for the second row and worth internalising: a
parse error leaves no runtime to report it, so "no errors" means the bundle
never ran, not that it ran cleanly.

### Sharing a broken setup with someone else

Send the **Metro output** and the **browser console**, and say which row above
matches. Do **not** send your `.env` files or paste them into a chat or an AI
assistant — they hold the Supabase service-role key, which bypasses row level
security entirely, and the database password. Every code fix is in the
repository; nothing in `.env` is needed to diagnose a blank page.

---

## 9. Troubleshooting

| Symptom | Cause |
|---|---|
| Backend exits immediately at boot | `config/env.ts` validates with Zod and refuses to start on bad config. Read the error — it names the variable. |
| App loads, all API calls 401 | `EXPO_PUBLIC_API_URL` wrong, or the backend is pointed at a different Supabase project than the app |
| Photos upload but never appear | Migration `00020` not applied, or the `photos` bucket does not exist |
| `sharp` fails to install | Needs libvips. Alpine: `apk add vips-dev`. Debian: `apt install libvips-dev`. |
| Orders return 400 | Check the product type against `src/constants/products.ts` — client, validator and DB CHECK must agree. G-01 was this disagreeing three ways; it is fixed and verified, so a 400 now means a genuinely bad payload |
| OTP email never arrives | Supabase default SMTP is rate-limited to a few per hour. Plan 01 Step 8 covers configuring Resend. |
