# Phase 2 — Implementation Status

**As of:** Week 24 (18 July 2026), after merging all four streams into `main`.
**Single source of truth for status.** `CLAUDE.md` links here rather than
restating it; two status tables drifting apart is worse than one.
**Covers:** everything committed during Phase 2.

A factual record of what exists, what runs, and what has been proven to work.
Deliberately separate from the plans, which describe intent.

---

## 1. Who did what

| Person | Plans | Status |
|---|---|---|
| **Ruthwik** | 03 · 05 · 09 (infra) · 08 (feed/photos tests) · 10 (architecture) · 11 (k6) | Merged |
| **Nagachaitanya** | 04 · 01 (Steps 1, 3, 5) · 05 Step 4 (G-34) · 08 (auth/error tests) · 09 (Sentry) · 10 (security) · 11 (verify script) | Merged |
| **Bhargav** | 00 (all 22 typecheck errors) · 07 (toasts, dialogs, empty states) | Merged |
| **Srujan** | 00 Group B (types) · 01 Step 2 (dashboard) · 02 (order contract) · 06 (demo seed) · 10 (database) | Merged |

**All twelve plans now have their code written.** Plans 02, 06 and 07 were
completed after this document was first written.

### Duplicated work

Ruthwik and Nagachaitanya independently implemented much of Plan 04 and parts
of Plans 01 and 08 — the notification wiring, RoleGate, the photo-detail
ownership check, school scoping and the test harness all exist because two
people built them in parallel without agreeing ownership first.

The merge reconciled cleanly, keeping the stronger version in each case: the
consolidated `assertPhotoAccess` guard over the separate school lookup, the
hardened test guard with a hard-coded forbidden project ref, and one security
document rather than two. But the effort went twice, and the fix for next time
is to agree file ownership before starting, not after.

---

## 2. Gaps closed

| Gap | Severity | What it was | Owner |
|---|---|---|---|
| **G-02** | Critical | `/uploads` served by `express.static` with no authentication — every photo a public URL. | Ruthwik |
| **G-04** | Critical | `GET /feed/photos/:id` took no user ID. Any parent could read any photo's metadata and its full tagged-student list — a cross-school child roster. | Nagachaitanya |
| **G-05** | Critical | No route group checked role. `hive://(admin)/dashboard` rendered the admin console for a parent. | Nagachaitanya |
| **G-08** | High | Three endpoints took a school or class ID from the URL and never compared it to the caller's. Any teacher could read another school's roster including dates of birth. | Nagachaitanya |
| **G-17** | High | `POST /photos/:id/file` and `/confirm` checked only status — teacher A could overwrite teacher B's photo. `/tag` checked school but not uploader. | Nagachaitanya |
| **G-10** | High | `seedAdmin.ts` hardcoded credentials and printed the password. | Ruthwik |
| **G-12** | Medium | No thumbnails; feed served full-resolution originals. | Ruthwik |
| **G-40** | Medium | Upload MIME check trusted the client's `Content-Type`. Now magic-byte verified with `sharp`. | Ruthwik |
| **G-07** | Medium | Tag-after-confirm ordering meant parents never got notifications. | Ruthwik |
| **G-20** | Medium | `trust proxy: true` let the rate limiter be bypassed by rotating `X-Forwarded-For`. | Ruthwik |
| **G-38** | Medium | Request logs invisible in production; `X-Request-ID` allow-listed but never generated. | Ruthwik |
| **G-39** | Medium | No error tracking. | Nagachaitanya |
| **G-03** | Medium | ~700 lines of finished notification code had zero imports. | Nagachaitanya |
| **G-06** | Medium | Admin dashboard queried a non-existent column and silently showed £0. | Srujan |
| **G-09** | Medium | Five photo routes guarded on `school_admin`, a role the DB `CHECK` rejects. | Nagachaitanya |
| **G-16** | Medium | PostgREST filter injection in admin user search. | Nagachaitanya |
| **G-34** | Medium | `getSchools` issued two count queries per school — 41 round trips for a 20-school page. Now 3, regardless of page size. | Nagachaitanya |
| **G-L3/L4** | Low | `auth.ts` logged client IPs and raw error objects. | both |
| — | — | 22 mobile typecheck errors. **The app now compiles.** | Bhargav + Srujan |

**All of the above are written and type-checked. Almost none has been
exercised against a running system.** See §4.

---

## 3. The authorization model, in one place

Worth stating because it is the part most likely to be asked about.

The backend queries exclusively through `supabaseAdmin`, built with
`SUPABASE_SERVICE_KEY`. **The service-role key bypasses row level security by
design**, so the 505-line policy set in migration `00011` is never consulted for
an API request. Every endpoint that accepts a resource ID must re-derive
authorization itself. That single fact is the root cause of G-04, G-08 and
G-17, and the reason a newly added endpoint is insecure by default.

Three layers, each with a distinct purpose:

| Layer | Where | Purpose |
|---|---|---|
| `RoleGate` | `features/auth/components/RoleGate.tsx` | **UX only, never trusted.** Stops the wrong screen rendering. Trivially removed in a modified build. |
| `roleGuard` + ownership checks | `middleware/roleGuard.ts`, service layer | **The real control.** `assertSchoolAccess`, `assertPhotoOwnership`, and the parent-tag check in `getPhotoDetails`. |
| RLS | migration `00011` | **Last line.** Covers the four queries the app makes to Supabase directly with the user's own JWT. |

Two status-code decisions are deliberate and documented in `docs/security.md`:
**404 not 403** on photo detail (a 403 confirms the photo exists, and UUIDs are
enumerable), and **403 not 401** for a wrong-role caller (`lib/api.ts` signs out
on 401, so a 401 would log out anyone who touched another role's route).

Post-merge, one ordering matters: `getPhotoDetails` runs its ownership check
**before** minting the signed Storage URL. A signed URL grants access to the
file, so it must never be generated for a caller who is about to be refused.

---

## 4. What was actually executed

| Check | Result |
|---|---|
| `pnpm --filter @hive/backend typecheck` | Clean, including `tests/` |
| `pnpm --filter @hive/mobile typecheck` | **0 errors** — was 22 |
| `pnpm lint` | 4 problems (1 error, 3 warnings), all pre-existing |
| `pnpm build:backend` | Succeeds |
| Test-database guard, both branches | Refuses with no `.env.test`; refuses when `SUPABASE_URL` names the demo project |
| Sentry `beforeSend` against a synthetic event | JWT, two emails, client IP, signed storage URL, `/uploads` URL, password field and hostname all redacted; user-agent and a student's first name preserved |
| `verify-security.sh` repository-hygiene section | Passes — and found the `Admin@123` comment in `supabase/seed.sql` |
| Secret scan (`git grep`) | Zero JWTs, AWS keys, Stripe keys, PEM blocks, tracked `.env` files |
| `require('sharp')` | Loads — the gate on Plan 03's approach |
| **Migrations against a real database** | **All 19 applied** to Supabase project `hive` (`udawaiykfvdcvcouiqxr`) — `00001`–`00018` and `00020`. First time any migration has run anywhere. |
| **`photos` bucket** | **`public = false`** — G-02 verified in the database, not just in review |
| **Backend boot against real credentials** | Starts clean, no env validation error; Redis connects; Sentry takes its no-op path without failing |
| **`GET /health`** | **200** with `"checks": {"database": "ok"}` — round-trips to Supabase |
| **`GET /uploads/anything`** | **404** — the static route really is gone |
| **Unauthenticated `/api/v1/*`** | `feed`, `photos`, `orders`, `notifications`, `admin/users` all **401**; malformed bearer token also 401 |
| **Anon key against `profiles`** | Returns `[]`, not a dump — RLS enforcing on the client path |
| **`X-Request-ID` + request logging** | Header present; one `info` line per request with ID, status and duration. Auth-failure log omits the token and client IP — PII scrubbing confirmed |
| **`pnpm seed:admin`** | Creates the admin auth user and profile. **Does not print the password** — G-10 confirmed |
| **`pnpm seed:demo`** | First ever run. 2 schools, 4 classes, 9 students, 8 profiles, 8 parent-student mappings. Photos skipped — `seed-assets/` is empty |
| **Real sign-in** | `signInWithPassword` as a seeded demo parent returns a usable JWT |
| **Authenticated `GET /api/v1/feed`** | **200** — the API path works end to end with a real user. Empty, because there are no photos |
| **RBAC — parent → `/api/v1/admin/users`** | **403.** Server-side role enforcement confirmed at runtime, not just in review (G-05's server half) |
| **G-08 cross-school IDOR** | **Confirmed fixed.** Teacher at Bloom: own school's classes **200**; another school's classes **403**; another school's **student roster including dates of birth 403** — `"You do not have access to this school"`. This is the check §5 previously recorded as never executed |

---

## 5. What was NOT verified

**Updated 1 Aug — an environment now exists.** `packages/backend/.env` and
`apps/mobile/.env` are filled against Supabase project `hive`
(`udawaiykfvdcvcouiqxr`), all 19 migrations are applied, and the backend boots
and answers `/health` with `"database": "ok"`. What that made verifiable is in
§4; what follows is what is still unproven.

**Demo data now exists** (`pnpm seed:demo`, first run 1 Aug): 2 schools,
4 classes, 9 students, 8 profiles. **No photos** — `seed-assets/` needs 12–15
JPEGs sourced by hand, and the script skips photo seeding when it is empty.
That single gap is what still blocks most of the list below.

**⚠ `packages/backend/.env.test` points at the SAME project as `.env`**, by
explicit decision, because a second project was not wanted. `pnpm test` runs
`truncateAll()` in `beforeAll`, so **running the suite deletes the demo data**.
The guards in `tests/setup.ts` do *not* catch this: guard 1 needs
`DEV_SUPABASE_URL`, which is unset, and guard 2 hardcodes
`fhvwsmtivwtmbdscdoyz`, a stale ref. Re-seed after any test run, or create a
second project before the demo.

- **No photo has ever been uploaded to the private bucket.** The whole storage
  rewrite — signed URLs, thumbnails, blurhash, HEIC conversion, magic-byte
  validation — compiles and has never run. The bucket is confirmed private and
  empty. Blocked on seed assets.
- **No order has been placed and no notification produced** — both need photos.
- **Plan 04's verification is now part-run.** The cross-school IDOR (G-08) and
  parent→admin RBAC checks passed against a real instance (§4). The photo-level
  checks — G-04, G-17, signed-URL expiry — still need an uploaded photo.
- **`pnpm test` has never run.** See the truncation warning above before running
  it. Plan 08's sabotage exercise — revert a fix, confirm the matching test
  fails — has not been done, so the tests have not been shown to detect anything.
- **No error has reached Sentry.** `initSentry()` has only taken its no-op path.
- **`verify-security.sh` has never run against a real instance.**
- **Nothing has been seen on a device.**
- **The Docker image has never been built; CI has never run; nothing is deployed.**

---

## 6. Still open

| Gap | Owner | Why it matters |
|---|---|---|
| **G-01** | Srujan · Plan 02 | Order submission is broken three ways. **No order can be placed.** This is now the most serious functional defect. |
| **G-11** | Srujan · Plan 06 | No demo data. |
| **G-26…G-33** | Bhargav · Plan 07 | UX completion — toasts, confirm dialogs, empty states. |
| **G-45** | unowned | Plan 01 Step 8 — custom SMTP. Supabase's default is rate-limited to a few emails an hour, so **OTP delivery will fail mid-demo**. Dashboard task, no code fix. |
| **S-15** | Plan 11 | Supabase project ref committed; keys not rotated. |
| — | Bhargav | ~~Create the first `.env`.~~ **Done 1 Aug** — dev environment runs, 19 migrations applied. |
| — | Bhargav | **Create the `hive-test` Supabase project.** `pnpm test` is blocked on it, and so is CP-4. |
| — | Srujan · Plan 06 | **Seed data.** Everything left in §5 needs a school, class, students and a parent before it can be exercised. Now the single biggest blocker. |

---

## 7. Checkpoints

| # | Gate | Status |
|---|---|---|
| **CP-1** | App compiles · no "Coming Soon" · no credentials in repo | ✔ **Met.** |
| **CP-2** | Order placeable · private storage with thumbnails · role guards · IDORs closed | ◐ Guards, IDORs and storage written. **Orders still broken. Nothing runtime-verified.** |
| **CP-3** | Demo seed on a fresh DB · test harness runs | ◐ Harness exists, never run. No seed. |
| **CP-4** | 36 tests green · CI on every PR | ◐ CI workflow exists, never run. Tests written, 0 green. |
| **CP-5** | Deployed and reachable · Sentry receiving · docs complete | ✗ Nothing deployed. |
| **CP-6** | Manual QA green · demo rehearsed · submission pack | ✗ |

---

## 8. What to do next

1. **Create `.env` for `packages/backend` and `apps/mobile`**, and apply
   migration `00020`. Follow `docs/environment-setup.md`. Roughly 40 commits of
   work across all four streams compile and have never executed; this unblocks
   every one of them. Highest-value action available, by a wide margin.
2. **Srujan: Plan 02.** No order can currently be placed.
3. **Create a test Supabase project** and run `pnpm test`. Then do Plan 08's
   sabotage exercise — until then the suite has proven nothing.
4. **Run `scripts/verify-security.sh`** against a deployed instance with real
   tokens. That is what turns §2 from "believed fixed" into "confirmed fixed".
5. **Plan 01 Step 8 (SMTP).** Unowned, and it fails during a live demo.
6. Bhargav: Plan 07. Srujan: Plan 06.

---

*Hive · Phase 2 status · maintained by Nagachaitanya*
