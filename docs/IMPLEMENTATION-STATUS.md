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
| **G-41** | Medium | No photo deletion. A teacher who uploaded the wrong child's photo could not remove it, and `status='archived'` was unreachable from any code path. Closed 2 Aug — see §9. | Nagachaitanya |
| — | — | 22 mobile typecheck errors. **The app now compiles.** | Bhargav + Srujan |

**All of the above are written and type-checked. Almost none has been
exercised against a running system.** See §4.

---

## 3. The authorization model, in one place

Worth stating because it is the part most likely to be asked about.

The backend queries exclusively through `supabaseAdmin`, built with
`SUPABASE_SERVICE_KEY`. **The service-role key bypasses row level security by
design**, so the 545-line policy set in migration `00011` is never consulted for
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
| **Storage pipeline end to end** | **Executed for the first time.** `seed:demo:reset` processed 6 photos: originals and `_thumb.jpg` both written to the private bucket, `status=ready`, and `thumbnail_s3_key`, `blurhash`, `width`, `height` all populated. Dimensions vary (1600×900 … 1600×2409), so portrait and landscape both survive processing |
| **G-02 signed URLs** | **Confirmed fixed end to end.** A feed signed URL fetches **200**; the same URL with `?token=` stripped returns **400**, not the image. The bucket is private and only signed access works |
| **G-07 notifications** | **Confirmed fixed.** 16 `new_photo` notifications generated, addressed to the right parents and naming the right child — "New photo of Diya Kumar", "New photo of Aarav Kumar". Tag-before-confirm ordering is correct; the seed's zero-notification warning no longer fires |
| **Parent privacy scoping** | **Confirmed.** 6 photos exist. Rajesh (Bloom, two children) sees **2**; Vikram (Little Stars) sees **1**; **zero overlap**. No parent sees the full set, and no cross-school leakage |
| **Feed deduplication** | No duplicate photo IDs in a parent's feed |
| **`pnpm test`** | **Ran for the first time** against the new `hive-test` project. **58 of 59 pass**, 1 fails. The suite executes end to end: harness, truncation, user creation, HTTP requests through Supertest |
| **Test-database guard, armed** | `DEV_SUPABASE_URL` is now set, so guard 1 in `tests/setup.ts` actually compares. It previously did nothing |
| **`verify-security.sh`, in full** | **Ran for the first time, 1 Aug.** 26 passed, 0 failed, 3 skipped, against a backend booted `NODE_ENV=production`. Covers G-02, G-04, G-04b, G-05, G-08 and G-17 over HTTP with real tokens. Full record and the three skips in `docs/security.md` §9 |
| **G-17 upload ownership** | **Confirmed fixed — first time.** A teacher at the same school as the uploader gets **403** on `/confirm`, `/tag` and `/file`. Previously untestable: every probe used teachers at *different* schools, where the school check refuses first and the ownership check never runs |
| **Plan 08 sabotage exercise** | **Done, and it found something.** With `photo.uploaded_by === user.id` deleted from `assertPhotoAccess`, exactly the 3 new same-school G-17 tests failed. `photos.test.ts`'s similarly-named test stayed **green** — its teachers are at different schools, so it never guarded G-17 at all |
| **`pnpm test` with the new file** | **79 passed, 0 failed**, 5 files. T-23 now passes; the fixture fix landed in `2928b76` |
| **`/health` with the database unreachable** | **503**, `"status":"degraded"`, `"checks":{"database":"error"}`. Supabase was stopped mid-run. Previously listed as untested |
| **Rate limiter** | **429 at request 77** of the 100-per-15-minute window — the window was already partly consumed by the verification run, which is the interference the script now names explicitly |
| **G-01 order placement** | **Confirmed fixed.** A parent placed a real order end to end: `POST /api/v1/orders` → 201 with `total_cents: 998` for 2 × `print_4x6` at 499. Integer cents, no float. Sending the same `x-idempotency-key` twice returned the **same order** rather than duplicating. Test orders removed afterwards; demo data is back to 0 orders |

---

## 5. What was NOT verified

**Updated 1 Aug — an environment now exists.** All 19 migrations are applied and
the backend boots and answers `/health` with `"database": "ok"`. What that made
verifiable is in §4; what follows is what is still unproven.

> **Env files are per-machine.** This section used to state that
> `packages/backend/.env` and `apps/mobile/.env` "are filled". They are
> gitignored, so that is a fact about one laptop, not about the repository — on
> a fresh clone neither exists and nothing runs. Anyone picking this up creates
> them from the `.env.example` templates first. `SUPABASE_ANON_KEY` was missing
> from the backend template until 1 Aug, which is why minting a token for
> `verify-security.sh` was not possible.

**Demo data now exists, photos included** (`seed:demo:reset`, 1 Aug): 2 schools,
4 classes, 9 students, 8 profiles, **6 photos with thumbnails, 9 tags,
16 notifications**. The seed assets landed in `abe853a`, which unblocked the
storage layer — most of what this section used to list is now in §4.

**A separate `hive-test` project now exists** (`sdbiuzuyipneioceqysm`,
ap-southeast-1) with all 19 migrations applied, so `pnpm test` no longer
threatens the demo data. `DEV_SUPABASE_URL` is now set in `.env.test`, which
arms the first guard in `tests/setup.ts` — it was a no-op before, since that
guard does nothing unless the variable exists.

- **Uploads have only been exercised through the seed script**, which calls the
  photo service directly. The HTTP upload path — `POST /photos`, the multipart
  file step, `/tag`, `/confirm` — has not been driven end to end by a client.
- **HEIC conversion and magic-byte rejection are still unproven.** Every seed
  asset is already a JPEG, so `converted:false` on all six. Nothing has tested
  a `.heic` input or a `.txt` renamed to `.jpg`.
- ~~No order has been placed.~~ **Done** — see §4. A parent placed a real order
  with correct integer cents and working idempotency.
- ~~**G-17 upload-ownership checks are unverified.**~~ **Done** — see §4. The
  seed does provide the pair (Sarita and Dinesh are both at Bloom); nothing was
  using it.
- ~~**Plan 08's sabotage exercise has not been done.**~~ **Done** — see §4.
- ~~**`verify-security.sh` has never run against a real instance.**~~ **Done** —
  26 passed, 0 failed, 3 skipped.
- **No error has reached Sentry.** `initSentry()` has only taken its no-op path.
  Needs a DSN; it is an account signup, not a code change.
- **Nothing has been verified against a *deployed* instance.** The run above was
  against a local Supabase stack — Postgres, GoTrue, Storage and all 19
  migrations, driven through the real Express app. That proves the authorization
  logic. It is not evidence about how `hive-dev` or any hosted project is
  configured, and the HTTPS and CORS checks still skip for want of a hosted URL.
- **Nothing has been seen on a device.**
- **Nothing is deployed** — no hosted URL, no APK. CI itself *does* run: 43
  workflow runs on 1 Aug, 26 green, each building the Docker image. What has
  never happened is a deployment, not a build.

---

## 6. Still open

| Gap | Owner | Why it matters |
|---|---|---|
| ~~**G-01**~~ | Srujan · Plan 02 | **Closed and verified 22 July.** A parent placed a real order: 201, `total_cents: 998` for 2 × `print_4x6`, and a repeated idempotency key returned the same order instead of a duplicate. This entry previously read "no order can be placed" long after it had been fixed. |
| ~~**G-11**~~ | Srujan · Plan 06 | **Closed.** `seed:demo:reset` loads 2 schools, 4 classes, 9 students, 8 profiles, 6 photos with thumbnails, 9 tags and 16 notifications. |
| **G-27** | Ruthwik · Plan 07 Step 5 | Upload progress is a hardcoded `0.1 → 0.3 → 0.35 → 0.85` ladder, not bytes transferred. Lives in `useUpload.ts` / `teacherService.ts`, both Ruthwik's. The plan marks this its one optional step. |
| ~~G-26, G-28…G-33~~ | Bhargav · Plan 07 | **Done.** Toasts on all nine admin mutations, confirm dialogs on all six destructive actions, empty states, onboarding and 404 placeholders replaced, schools routes split into validator/service/controller, controllers all throw `AppError`. See the plan's Deviations. |
| **Plan 10 / 11 (Bhargav's share)** | — | **Done.** README rewritten against the real stack — it described a Flutter app. Added `user-flows.md` (diagram G-6), `docs/README.md` index and `demo-script.md`. Remaining on this side is deployment only: Render, the EAS APK and the demo video. |
| **8a, 8b** | Ruthwik / Srujan | Plan 07 polish needing API changes: the feed does not return the uploader's name, and order items carry only `photoId` so no thumbnail can be rendered. Both need an endpoint to return more, not UI work. |
| **G-45** | unowned | Plan 01 Step 8 — custom SMTP. Supabase's default is rate-limited to a few emails an hour, so **OTP delivery will fail mid-demo**. Dashboard task, no code fix. Lower priority now that teacher/parent can sign in with a password. |
| ~~**T-23 fails**~~ | Ruthwik · Plan 08 | **Closed and confirmed green.** It was a defect in the test, not the product: `createTestPhoto` wrote a row with no object behind it, and `confirmUpload` calls `fileExistsInStorage` and 404s when the object is absent. `2928b76` made the helper upload a real fixture. `photos.test.ts > notifies tagged children's parents` — the only automated guard on G-07 — now passes, as part of 79 of 79. |
| **S-15** | Plan 11 | Supabase project ref committed; keys not rotated. |
| — | Bhargav | ~~Create the first `.env`.~~ **Done 1 Aug** — dev environment runs, 19 migrations applied. |
| — | Bhargav | ~~Create the `hive-test` Supabase project.~~ **Done** — `sdbiuzuyipneioceqysm`, 19 migrations applied, suite runs. |
| — | — | ~~Seed data.~~ **Done** — the seed photographs landed in `abe853a` and the dataset is loaded. This was the last infrastructure blocker; everything remaining is ordinary work. |

---

## 7. Checkpoints

| # | Gate | Status |
|---|---|---|
| **CP-1** | App compiles · no "Coming Soon" · no credentials in repo | ✔ **Met.** |
| **CP-2** | Order placeable · private storage with thumbnails · role guards · IDORs closed | ✔ **Met.** All four verified at runtime — order placed with correct cents and working idempotency, photos private with thumbnails and signed URLs, role guards returning 403, cross-school IDOR closed. |
| **CP-3** | Demo seed on a fresh DB · test harness runs | ✔ **Met.** Seed loads schools, classes, students, parents, 6 photos with thumbnails and 16 notifications. Harness runs against a separate project. |
| **CP-4** | 36 tests green · CI on every PR | ✔ **Met. 155 of 155 green** as of 2 Aug, including 20 authorization tests and the `orders`/`admin` files Plan 08 specified but nobody wrote. T-23 is fixed. The suite has also been shown to *detect* — see the sabotage exercise in §4. **Caveat: the CI test step is `continue-on-error`** until `TEST_SUPABASE_*` exist as repository secrets, so the suite still gates nothing on a PR. |
| **CP-5** | Deployed and reachable · Sentry receiving · docs complete | ✗ Nothing deployed. |
| **CP-6** | Manual QA green · demo rehearsed · submission pack | ✗ |

---

## 8. What to do next

*Rewritten 1 Aug. Items 1, 2, 3 and 5 of the previous list are all done — as
were items 1, 2, 3 and 6 of the list before that, on 23 July. This section goes
stale faster than anything else here; check §4 before trusting it.*

1. **Deploy.** The largest remaining gap, and now the blocker on three separate
   verification items: HTTPS and CORS still skip in `verify-security.sh`, the
   k6 suite has no target, and there is no APK. Bhargav, Plan 09 Step 6.
2. **Run `verify-security.sh` against the deployed URL** once it exists. The
   1 Aug run was against a local stack, which proves the authorization logic but
   says nothing about how a hosted project is configured. `verify:env` prints
   the environment; `STRICT=1` makes skips count so CI can gate on it.
3. **Make the CI test step blocking.** The step exists as of 2 Aug but carries
   `continue-on-error: true`, because it needs `TEST_SUPABASE_URL`,
   `TEST_SUPABASE_SERVICE_KEY` and `TEST_SUPABASE_ANON_KEY` as **repository
   secrets** before it can go red on failure. Until somebody adds them, 155
   passing tests still guard nothing on a pull request.
4. **Drive the app on a device.** Nothing has been seen rendered.
5. **Sentry has never received an error.** Needs a DSN. Account signup, not code.
6. **Plan 01 Step 8 (SMTP).** Unowned. Lower priority than it was — teacher and
   parent can now sign in with a password, so OTP is no longer the only way in.

---

## 9. Object lifecycles completed — 2 August

Until this point **every core object was create-only**. That was the largest
functional gap left in the product, and it is not one the 46-gap audit framed
as a single item:

| Object | Create | Read | Update | Delete |
|---|---|---|---|---|
| Photo | ✔ | ✔ | ✗ → **✔** | ✗ → **✔** (archive) |
| Photo tag | ✔ | ✔ | — | ✗ → **✔** (untag) |
| Order | ✔ | ✔ | ✗ → **✔** (status) | ✗ → **✔** (cancel) |
| Profile | ✔ signup | ✔ | ✗ → **✔** | — |
| School | ✔ | ✔ | ✗ → **✔** | — |

**Seven endpoints added.** `DELETE /photos/:id`,
`DELETE /photos/:id/tag/:studentId`, `PATCH /orders/:id/cancel`,
`GET /admin/orders`, `PATCH /admin/orders/:id/status`,
`PATCH /admin/schools/:id`, `GET`+`PATCH /me`. Documented in `api.md`.

**No migration was needed.** `'archived'`, all six order statuses and the
`'order_status'` notification type were already in their CHECK constraints and
simply had no code path reaching them. Reserved migration `00022` is still
unused.

**Three latent bugs fixed on the way:**

- `notifyAdminsOfNewOrder` filtered `school_id = <school>`, but the only admin
  any seed creates is a platform admin with `school_id = null` — so the "new
  order" notification had **never reached a single user**. There is now a test
  asserting it does.
- `OrderBottomSheet` pre-filled the shipping address from `profile.phone`.
- `apiRequest` called `response.json()` unconditionally, so any `204` would
  have thrown. Nothing returned 204 before; two routes do now.

**`order_status` finally has a producer.** It had been in the notifications
CHECK constraint since migration `00010` with nothing creating one. Order
status transitions are forward-only and enforced server-side; a delivered
order cannot be walked back.

**Tests: 79 → 155, all green**, run against a live local stack on 2 Aug —
`orders.test.ts` (26) and `admin.test.ts` (39) are the two files Plan 08
specified and nobody had written, plus 11 archive/untag cases in
`photos.test.ts`. Each of the ten commits was verified to typecheck
independently in a scratch worktree, not just the final tree.

**What this did *not* do.** DEC-10 was respected: photo captions and photo
download remain out of scope, so `photos.caption` is still written by nothing
and the "Coming Soon" badge on `PhotoActionSheet` is still honest. No student
role was added — children see photos through a parent's feed. And **none of
the new UI has been rendered on a device**, which is the same caveat that
applies to everything in §5.

---

*Hive · Phase 2 status · maintained by Nagachaitanya*
