# Environment Setup

Everything needed to get Hive running locally. **Nothing in Phase 2 has been
verified at runtime because no environment exists yet** — roughly 25 commits of
work compile but have never executed. Completing this document unblocks Plans
08, 09 and 11.

Owner: **Bhargav**.

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

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-ref>
pnpm db:migrate
```

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

**Observability (Plan 09)**
- [ ] Responses carry an `X-Request-ID` header
- [ ] Backend logs one `info` line per request with ID, status, duration
- [ ] Stop Supabase access → `/health` returns 503

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
