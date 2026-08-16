# Phase 2 — Implementation Status

**As of:** 9 August 2026. Originally written Week 24 (18 July), after merging
all four streams into `main`; §9 and §10 continue it.
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
| `pnpm lint` | **0 errors, 30 warnings** as of 9 Aug (3 backend, 27 mobile). The one error — `no-namespace` in `middleware/auth.ts` — was fixed in `40a69fc`; this row read "1 error" until then |
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
| **`verify-security.sh`, in full** | **Ran for the first time, 1 Aug**: 26 passed, 0 failed, 3 skipped, against a backend booted `NODE_ENV=production`. **Re-run 11 Aug** after the 9 Aug sweep: **27 passed, 0 failed, 2 skipped** (`701c999`) — the rate-limit check, which had been unable to pass against the exempt `/health`, now targets the write limiter and got a 429 at request 98. Covers G-02, G-04, G-04b, G-05, G-08 and G-17 over HTTP with real tokens. Both runs and the remaining two skips are in `docs/security.md` §9 |
| **G-17 upload ownership** | **Confirmed fixed — first time.** A teacher at the same school as the uploader gets **403** on `/confirm`, `/tag` and `/file`. Previously untestable: every probe used teachers at *different* schools, where the school check refuses first and the ownership check never runs |
| **Plan 08 sabotage exercise** | **Done, and it found something.** With `photo.uploaded_by === user.id` deleted from `assertPhotoAccess`, exactly the 3 new same-school G-17 tests failed. `photos.test.ts`'s similarly-named test stayed **green** — its teachers are at different schools, so it never guarded G-17 at all |
| **`pnpm test` with the new file** | **79 passed, 0 failed**, 5 files. T-23 now passes; the fixture fix landed in `2928b76` |
| **`/health` with the database unreachable** | **503**, `"status":"degraded"`, `"checks":{"database":"error"}`. Supabase was stopped mid-run. Previously listed as untested |
| **Rate limiter** | **429 at request 77** of the 100-per-15-minute window — the window was already partly consumed by the verification run, which is the interference the script now names explicitly |
| **G-01 order placement** | **Confirmed fixed.** A parent placed a real order end to end: `POST /api/v1/orders` → 201 with `total_cents: 998` for 2 × `print_4x6` at 499. Integer minor units, no float. Sending the same `x-idempotency-key` twice returned the **same order** rather than duplicating. Test orders removed afterwards; demo data is back to 0 orders. **Re-verified 16 Aug against a freshly built backend, after the 13 Aug re-pricing (`d08fa4a`): 201 with `total_cents: 6000` for 2 × `print_4x6` at 3000 — ₹60, since the catalogue is now integer paise. Idempotency re-confirmed: the same key returned the same order id. The 998/499 figures above are the July observation in USD cents and no longer describe the running system** |

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
- ~~**HEIC conversion and magic-byte rejection are still unproven.**~~ **Both
  resolved, and one of them resolved badly.**
  - **Magic-byte rejection is tested.** `photos.test.ts` T-20, *"rejects a file
    that is not really an image"*, attaches `Buffer.from('this is plain text,
    not a jpeg')` as `image/jpeg` and asserts **400**. It has run on every suite
    execution since 1 August.
  - **HEIC conversion does not work, and cannot on the prebuilt `sharp`.**
    Tested against a real HEVC HEIC on 24 July 2026: *"No decoding plugin
    installed for this compression format"*. libvips ships libheif with an AV1
    codec and no HEVC codec, and an iPhone HEIC is HEVC. The container parses,
    so `metadata()` reports `format: 'heif'` and only the pixel decode fails.
    The branch converts AVIF and refuses HEVC with an actionable 400; the real
    fix is the device-side transcode in `(teacher)/upload.tsx`, which asks the
    iOS picker for a compatible representation. See
    `docs/plans/03-storage-and-media.md`, "HEIC conversion does not work".
- ~~No order has been placed.~~ **Done** — see §4. A parent placed a real order
  with correct integer cents and working idempotency.
- ~~**G-17 upload-ownership checks are unverified.**~~ **Done** — see §4. The
  seed does provide the pair (Sarita and Dinesh are both at Bloom); nothing was
  using it.
- ~~**Plan 08's sabotage exercise has not been done.**~~ **Done** — see §4.
- ~~**`verify-security.sh` has never run against a real instance.**~~ **Done** —
  26 passed, 0 failed, 3 skipped on 1 Aug, and 27 passed, 0 failed, 2 skipped on
  11 Aug after the 9 Aug sweep.
- **No error has reached Sentry.** `initSentry()` has only taken its no-op path.
  Needs a DSN; it is an account signup, not a code change.
- **Nothing has been verified against a *deployed* instance.** The run above was
  against a local Supabase stack — Postgres, GoTrue, Storage and all 19
  migrations, driven through the real Express app. That proves the authorization
  logic. It is not evidence about how `hive-dev` or any hosted project is
  configured, and the HTTPS and CORS checks still skip for want of a hosted URL.
- ~~**Nothing has been seen on a device.**~~ **Changed on 16 August — the app
  ran on a physical iPhone.** Expo Go, SDK 54, against the local backend over
  the LAN: `EXPO_PUBLIC_API_URL` was repointed from `localhost` to the Mac's
  LAN IP, and `/health` answered `"database":"ok"`, `"cache":"ok"` from that
  address. All three roles were signed in — admin, teacher and parent, across
  both demo schools — and the functionality was driven through each of them.
  **No capture was taken.** This is the developer's observed pass, not an
  artifact: there is no recording, screenshot set or log to re-read, and no
  assertion anywhere fails if it regresses. It is evidence that the screens and
  flows work on real hardware; it is not a per-gap verification record, and it
  does not tick anything in §4 on its own.
  **Deep links are the exception and stay unproven** — Expo Go serves the bundle
  under `exp://`, so the app's own `hive://` scheme was never exercised. That
  needs `expo run:ios` or an EAS build, and Plan 04's mobile deep-link checks
  remain unticked.
- **Nothing is deployed** — no hosted URL, no APK. CI itself *does* run: 43
  workflow runs on 1 Aug, 26 green, each building the Docker image. What has
  never happened is a deployment, not a build.

---

## 6. Still open

| Gap | Owner | Why it matters |
|---|---|---|
| ~~**G-01**~~ | Srujan · Plan 02 | **Closed and verified 22 July.** A parent placed a real order: 201, `total_cents: 998` for 2 × `print_4x6`, and a repeated idempotency key returned the same order instead of a duplicate. This entry previously read "no order can be placed" long after it had been fixed. |
| ~~**G-11**~~ | Srujan · Plan 06 | **Closed.** `seed:demo:reset` loads 2 schools, 4 classes, 9 students, 8 profiles, 6 photos with thumbnails, 9 tags and 16 notifications. |
| ~~**G-27**~~ | Ruthwik · Plan 07 Step 5 | **Closed 9 Aug.** Upload progress is no longer a hardcoded `0.1 → 0.3 → 0.35 → 0.85` ladder. `uploadPhotoFile` in `teacherService.ts` uses `XMLHttpRequest` rather than `fetch` — `fetch` exposes no upload progress — and reports `event.loaded / event.total` from `xhr.upload.onprogress`; `useUpload.ts` maps that fraction into the band it reserves for the transfer. Not yet seen moving on a device. |
| ~~G-26, G-28…G-33~~ | Bhargav · Plan 07 | **Done.** Toasts on all nine admin mutations, confirm dialogs on all six destructive actions, empty states, onboarding and 404 placeholders replaced, schools routes split into validator/service/controller, controllers all throw `AppError`. See the plan's Deviations. |
| **Plan 10 / 11 (Bhargav's share)** | — | **Done.** README rewritten against the real stack — it described a Flutter app. Added `user-flows.md` (diagram G-6), `docs/README.md` index and `demo-script.md`. Remaining on this side is deployment only: Render, the EAS APK and the demo video. |
| **8a, 8b** | Ruthwik / Srujan | Plan 07 polish needing API changes: the feed does not return the uploader's name, and order items carry only `photoId` so no thumbnail can be rendered. Both need an endpoint to return more, not UI work. |
| **G-45** | unowned | Plan 01 Step 8 — custom SMTP. Supabase's default is rate-limited to a few emails an hour, so **OTP delivery will fail mid-demo**. Dashboard task, no code fix. Lower priority now that teacher/parent can sign in with a password. |
| ~~**T-23 fails**~~ | Ruthwik · Plan 08 | **Closed and confirmed green.** It was a defect in the test, not the product: `createTestPhoto` wrote a row with no object behind it, and `confirmUpload` calls `fileExistsInStorage` and 404s when the object is absent. `2928b76` made the helper upload a real fixture. `photos.test.ts > notifies tagged children's parents` — the only automated guard on G-07 — now passes, as part of 79 of 79. |
| **S-15** | Plan 11 | Supabase project ref committed; keys not rotated. |
| **Two-school parents file every order under one school** | Ruthwik | **Found 13 Aug while writing the order tests; not fixed.** `createOrder` files the order under `req.user.schoolId`, and `mapParentToStudent` back-fills a parent's `school_id` only when it is absent — deliberate, and its own comment says so. So a parent with children at two schools has every order attributed to whichever school linked them first: the second school's admin never sees those orders in their fulfilment queue, and the first sees an order for a photo that is not theirs. The school should come from the ordered photo, not the buyer's profile. |
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
| **CP-4** | 36 tests green · CI on every PR | ✔ **Met. 218 tests across 8 files** since `3b2f4c4` (13 Aug); 178 of 178 green when re-run 9 Aug. Includes 20 authorization tests and the `orders`/`admin` files Plan 08 specified but nobody wrote. T-23 is fixed. The suite has also been shown to *detect* — see the sabotage exercise in §4. **Two caveats:** the CI test step is `continue-on-error` until `TEST_SUPABASE_*` exist as repository secrets, so the suite still gates nothing on a PR; and the 40 tests `3b2f4c4` added for the 9 Aug work were not proven by mutation, because the sandbox refused edits under `src/`. One known flake — see §10. |
| **CP-5** | Deployed and reachable · Sentry receiving · docs complete | ✗ Nothing deployed. |
| **CP-6** | Manual QA green · demo rehearsed · submission pack | ✗ |

---

## 8. What to do next

*Rewritten 1 Aug, re-checked 9 Aug — every item below was still true on 9 Aug.
Items 1, 2, 3 and 5 of the previous list were all done by then, as were items 1,
2, 3 and 6 of the list before that, on 23 July. This section goes stale faster
than anything else here; check §4 before trusting it.*

0. **Cover the 9 August round with tests.** §10 changed 56 files and added no
   tests; the suite stayed at 155 across all twelve. The ordering, idempotency-cache
   and cursor-validation fixes are all server-side and testable with the
   existing harness, so this is cheap and it is the only one of these items that
   needs nobody's account or credit card.
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
   secrets** before it can go red on failure. Until somebody adds them, 218
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

## 10. Correctness sweep — 9 August

Twelve commits, `f426251..HEAD`, 56 files, +1495/−333. These are not new
features. They are defects found by reading the paths the audit's 46 gaps had
already been declared closed on — mostly cases where a request *looked* like it
succeeded, or failed as the wrong kind of failure.

### Verified on 9 August

| Check | Result |
|---|---|
| `pnpm typecheck` | Clean, both packages |
| `pnpm lint` | 0 errors, 30 warnings (3 backend, 27 mobile) |
| `pnpm build:backend` | Succeeds |
| `pnpm test` | **178 passed, 0 failed**, 8 files, against `hive-test` |
| `ls supabase/migrations` | 19 files at `68721ae` — `00001`–`00018` and `00020`. `00019` was reserved and never used, so the sequence has a hole the count does not show. Work in flight on other branches adds to this |

**The known flake was the harness truncating a shared database, and is fixed.**
It was never confined to `orders.test.ts > rejects setting a status back to
pending`. Six consecutive full runs on 9 Aug failed three times, in three
different files, three different ways: `auth.test.ts > T-2b` expected 401 and
got 404; `photos.test.ts` and `authorization.test.ts` failed on
`photos_school_id_fkey` / `students_school_id_fkey` because a school created
seconds earlier had vanished; and `POST /api/v1/orders` blocked for 181s and
379s against a 30s timeout.

It was **not** file parallelism — `vitest.config.mts` already sets
`fileParallelism: false`, and tracing every truncate confirmed files run
strictly sequentially with no truncate ever overlapping another file's tests.
The cause was `tests/setup.ts` truncating **every domain table** in a global
`beforeAll`, once per file. `hive-test` is shared — CI runs the same suite on
every push against the same project a developer uses — so a second run's
`beforeAll` deleted the first run's fixtures mid-test, and the two runs'
`DELETE`s contended for the locks every foreign-key check needs. The decisive
evidence: `errors.test.ts`, which creates no school at all, watched `schools` go
from 0 rows to 2 during its own run. Replaying a concurrent `truncateAll()`
against a single file reproduces the identical `photos_school_id_fkey` failures
on demand.

The global truncate is gone. Each run now deletes only the rows it created
(`cleanupCreatedRows` in `tests/setup.ts`), so concurrent runs no longer destroy
each other. Six consecutive full runs green afterwards, at unchanged wall-clock
(~106s).

### Ordering

- **A blank note failed validation.** The order sheet sent `notes: null` for the
  untouched optional field; `createOrderSchema` used `.optional()`, which
  accepts `undefined` but not `null`. Every order placed without a note returned
  400 "Validation failed". Fixed on both sides — the client omits the key when
  the field is blank, and the schema takes `.nullish()` so an already-installed
  build keeps working. G-01 was recorded as closed and verified on 22 July; the
  order that verified it carried a note.
- **An empty shipping address failed the same opaque way.** Place Order is now
  disabled until an address is entered, with the reason shown on the field.
- **The idempotency cache replayed failures.** The response interceptor stored
  whatever status the handler produced for 24 hours, and `validate` runs
  downstream of the middleware on `POST /orders` — so a 400 from the schema, or
  a transient 500, was cached against the key and served back on every retry.
  Retrying with the same key after correcting the payload is what a
  well-behaved client does, so this pinned the client to its own first mistake.
  Only 2xx is cached now; a failure drops the lock.
- **`createOrder` never checked the photo's status.** Tag ownership was checked;
  status was not, so an archived photo — one a teacher had deliberately
  removed — or one still processing could be ordered from a stale feed.
  `order_items.photo_id` is `ON DELETE RESTRICT`, so such an order is permanent.

### Admin console

- **`GET /admin/orders` threw 400 on every load.** It required a school, but the
  seeded admin has a role and no school and the admin UI has no school picker.
  The screen rendered the 400 through its empty state as "No orders yet", so the
  fulfilment queue looked empty rather than broken. A school-less admin is a
  platform admin and now gets every school's orders — the rule
  `updateOrderStatus` already applied.
- **Three mutations were silent no-ops.** `assignTeacher`,
  `removeStudentFromClass` and `removeParentMapping` issued an update or delete
  and checked only `error`. PostgREST does not treat "matched no rows" as an
  error, so a nonexistent ID returned 200 "Parent mapping removed" having
  changed nothing. The unlink case is the one that matters: the console showed
  the parent removed while they could still see the child's photos.
- **Cross-school integrity was unchecked in two places.** `assignTeacher` never
  compared the teacher's school to the class's, and `createStudent` took the
  school from the body and the class from the route param without checking they
  agreed. A mismatch is silent but live — the roster is filtered by `school_id`,
  so the child never appears in their own teacher's list and cannot be tagged in
  their own class's photos.
- **`getSchools` read neither count query's error**, so a failure rendered as
  "0 students, 0 teachers" — a plausible number indistinguishable from the
  truth. This endpoint has now shipped that bug three times.
- **Linking a parent to a student did not set their school.** A parent signs up
  with no school (the signup trigger cannot know one) and `createOrder` refuses
  anyone without a `school_id`. Nothing else ever set it, so a real parent could
  be linked to their child, browse the feed and still be unable to order a
  print. Only the demo seed, which writes `school_id` directly, hid this. The
  mapping now back-fills it, and rejects a non-parent account — the role was
  already being fetched and then ignored, and the photo feed is scoped by
  `parent_student_mappings` alone, so mapping a teacher or admin account handed
  it that child's photos.

### Upload pipeline

- **Two concurrent uploads could file one child's photo under another's.**
  Multer's temp filename was `tmp_${Date.now()}` — millisecond resolution, no
  per-request entropy — and the client uploads three photos at once. Two
  requests entering the file part in the same millisecond got the same path;
  `diskStorage` truncates on open, so one request's bytes replaced the other's
  and the loser's cleanup deleted the file the winner was still reading. Now a
  `randomUUID()`.
- **Tagging was labelled "Optional".** The parent feed is an inner join on
  `photo_student_tags` and nothing in the app can tag a photo after upload, so
  an untagged photo was invisible to every parent, notified nobody, and could
  never be fixed. It is now required.
- **`retryWithBackoff` retried everything, including 4xx.** On the file step
  that re-sent the whole image three times, so an unsupported photo cost a
  teacher 24MB of mobile data to fail. It now retries only 5xx, 408, 429 and
  network-level failures — which required the file upload to reject with an
  `ApiError` so its status is visible to that decision at all.
- **Retrying duplicated rows and objects.** A retry restarted at step one and
  shadowed the photo id, so a photo that failed at tag or confirm — file already
  uploaded, objects already in the bucket — got a second row and a second pair
  of objects on every attempt, while the first stayed in `processing` forever.
  Retries reuse the existing slot, which required `/confirm` to become
  idempotent: it answered 400 for an already-ready photo, so a confirm whose
  response was lost left the photo permanently un-completable.
- **The Upload button did nothing after a partial failure.** `startUpload`
  filtered for `'idle'` only, and set the in-progress flag before returning
  early, so it stuck. It now retries the failures.
- **Every photo failed validation before a byte moved on Android.** `fileSize`
  and `contentType` were required in shapes `ImagePickerAsset` does not always
  supply — both are optional and Android omits them, so the client sent `0`.
  `fileSize` is now optional and advisory (it was never checked against the
  actual upload; multer enforces the real ceiling) and the content type is
  derived from the extension when the picker reports none.
- **Oversized and unsupported files came back as 500 `DATABASE_ERROR`.** A
  `MulterError` carries a string `code` and no status, so it matched the "has a
  string code, therefore Postgres" test in `errorHandler` — with a Sentry event
  for what is plainly client error. Multer errors are now handled ahead of the
  Supabase branch (413 for the size limit, 400 otherwise) and the `fileFilter`
  rejects with an `AppError` naming the offending type.
- **Abandoned uploads were unclearable.** Every killed app or dropped network
  leaves a `processing` row and there is no sweeper; those rows listed in the
  teacher's grid as blank tiles, and `archivePhoto` explicitly refused
  `processing`. A row is now archivable once it is older than
  `STALE_PROCESSING_MS` (30 minutes — comfortably longer than the client's
  two-minute deadline plus retries), which preserves the reason that exclusion
  existed.
- **G-27 upload progress is real bytes now** — see §6.

### Auth and cold start

- **The app could hang on a blank splash screen with no way out but a force
  quit.** auth-js emits `SIGNED_IN` from inside its own `_initialize`, and
  `_notifyAllSubscribers` awaits whatever the callback returns; the callback was
  `async` and awaited a profile fetch. That held `initializePromise` open, which
  `getSession()` waits on, which `authStore.initialize()` awaits before clearing
  `isLoading`, which the root layout renders `null` until — and supabase-js sets
  no fetch timeout. The profile fetch is now detached from the callback.
- **The role redirect was dead code.** The same ordering guaranteed `isLoading`
  was still true when the handler called `router.replace`, so expo-router threw
  "Attempted to navigate before mounting the Root Layout component" on every
  launch. It now waits for a mounted navigator.
- **Sign-out did not sign the user out.** auth-js returns before clearing the
  stored session when the revoke request fails on the network, and the result
  was ignored — the UI said signed out while the session stayed in SecureStore
  and the next launch restored it. On a shared preschool tablet that is the
  wrong way to fail. It now falls back to a local-scope sign-out, and clears the
  query cache and cart, which nothing did: signing in as a second parent showed
  the first parent's feed, notifications and orders from cache, and inherited
  their pending order.
- **Any 401 signed the user out of the whole app**, including the backend's
  `PROFILE_NOT_FOUND` and a token momentarily stale at the refresh boundary —
  and the unread-count poll runs every 30s from every screen, so there was
  always a request in flight to trigger it. A 401 now attempts a refresh first.
  API calls also carry a 30s deadline; without one a stalled connection never
  settled, so React Query's retry never fired and the spinner never stopped.
- **A transient network error looked like a brand-new account.**
  `fetchUserProfile` collapsed "no row" and "the request failed" into `null`,
  dropping a signed-in parent into the marketing carousel — which, on a second
  failure, bounced to a login screen whose own effect retried the same failing
  call. That is a loop. It is now an error with a retry.
- **OTP lockout and resend cooldown lived in per-component state**, and login
  and verify-otp each create their own instance: the cooldown started on one
  screen and the user arrived at the other with it already expired, and five
  wrong codes could be reset by tapping back. Both now live in one store, keyed
  on deadlines so they survive unmounts and backgrounding.

### API surface

- **Rate limiting was set as if a request were a page view.** 100 per 15
  minutes, while opening the parent feed alone costs a feed page, an unread
  count, a notification list and a profile read — and it was keyed purely on IP,
  so a block of carrier-NAT'd mobile users shared one budget. Now keyed on a
  hash of the bearer token when present, with a realistic ceiling and `/health`
  exempt so a busy NAT range cannot pull an instance out of rotation.
- **CORS `credentials: true` alongside `origin: '*'` is rejected by every
  browser**, so the permissive default broke browser clients rather than
  permitting them. Credentials are only meaningful with an allow-list.
- **Nine admin routes and both feed routes passed an ID to Postgres
  unvalidated**, returning 500 for a plainly malformed request.
  `params.validator` already exported schemas for most of them and no route used
  them. `dateOfBirth` was likewise unchecked against a `date` column.
- **All seven cursor decode sites caught only the JSON parse**, so a cursor
  decoding to valid JSON of the wrong shape put the string `"undefined"` into a
  PostgREST filter — a 500. The decoded values are interpolated into filter
  expressions where commas and parentheses are structural, so the shape is now
  validated centrally: a UUID and an ISO instant, neither of which can carry
  structure.
- **A slow database could kill the instance the health check exists to report
  on.** The probe raced its Supabase query against a 2s timer; `Promise.race`
  abandons the loser, it does not cancel it, so a query that lost and then
  rejected had nothing attached to handle it — and `index.ts` responds to an
  unhandled rejection by exiting. The probe now carries its own catch before it
  is raced.
- **The upload path read a file of up to 25MB with `readFileSync`**, and the
  client sends three at once, so every other request on the instance — including
  `/health` — stalled for the duration of each one.
- **`createNotification` wrote `null` into a NOT NULL jsonb column** when given
  no payload, and the school schemas accepted an `email` field the table has no
  column for, so the API answered "School updated" having discarded it.
- **React Query retried 4xx responses two extra times**, which cannot change a
  refusal.

### Screens that misinformed

Six screens fetched data and ignored the query's error:

- Photo detail and admin class detail gated on `isLoading || !data`, so a failed
  or refused request span forever with no way out.
- The parent feed reported a backend outage as "No photos yet" — telling a
  parent their child has no photos.
- The admin dashboard fell through to `?? 0` and drew "Schools 0 / Users 0 /
  Revenue 0", which reads as real data.
- The teacher dashboard offered "Upload your first photos" for a class that may
  already have them.
- Admin users had no loading and no empty state: first paint and an empty result
  were both a blank area.

Each now distinguishes loading, error and empty, with a retry where one makes
sense. Admin user search is also debounced — it was issuing a request per
keystroke.

Separately, the parent orders screen only opened the order sheet once the photo
had loaded, so a failed lookup meant tapping "Order Print" navigated to the tab
and did nothing at all; and the `photoId` param was cleared to `undefined`,
which a params merge can drop rather than unset, so ordering the same photo
twice in one session never reopened the sheet.

Photo URLs are signed with a one-hour expiry and the feed had no path to re-mint
them: `refetchOnWindowFocus` was off, and on native it would have done nothing
anyway because React Query's focus tracking is built on browser events and
nothing was driving its focus manager. A parent who left the feed mounted and
backgrounded the app for an hour came back to a grid of images the storage layer
refused, with no error state and no retry. The focus manager is now wired to
`AppState` (`lib/queryClient.ts`) and the feed refetches on foreground.

Notifications: tapping one only marked it read, though every payload already
carries a `photo_id` and the photo route exists — it now opens the photo. The
unread count was polled every 30 seconds and rendered nowhere, since this tab
bar is custom and ignores react-navigation's `tabBarBadge`; there is now a
badge. Swipe-to-dismiss animated a row to opacity 0 and left it in the list, so
it came back invisible — and FlashList recycles cells, so untouched rows could
inherit the state.

### What this round did NOT prove

The same caveat as §5, and it applies to all of the above:

- ~~**Almost no test was added.**~~ **Addressed on 13 August by `3b2f4c4`,
  which added 40 tests and took the suite from 178 to 218 across the same 8
  files.** The history: the suite was 155 before and after the first twelve
  commits; the follow-up round that fixed the regressions those commits
  introduced added `tests/cursor.test.ts` (23 cases), taking it to 178, so for
  four days the keyset-pagination fix was covered and essentially nothing else
  in this section was. `3b2f4c4` closed that, covering the ordering fixes,
  idempotency, the upload retry paths, admin integrity and malformed input.

  **The honest caveat: those 40 tests were not proven by mutation.** The
  sandbox refused edits under `src/`, so the sabotage exercise that validated
  the earlier authorization tests could not be repeated here — "these fail on a
  regression" is reasoning, not measurement. The one indirect proof is that the
  pre-existing replay test passes, which means Redis is live and the
  corrected-retry case is not passing vacuously through the middleware's
  Redis-failure fallback.
- **None of the mobile work has been rendered on a device.** The cold-start
  hang, the sign-out fallback, the upload retry path, the notification badge,
  the progress bar and the six error states have been typechecked and read, not
  seen. The auth fixes in particular describe races and lifecycle ordering,
  which are exactly the class of defect that a typecheck cannot observe.
- ~~**The route-group collisions beyond `/orders` were not each walked
  through.**~~ **Done, 11 August, in Chrome as a signed-in parent.**
  `/notifications` and `/profile` each cold-load to the parent's own screen, and
  `/dashboard` — which has no parent equivalent — correctly falls back to
  `/feed`. That is the expected behaviour by construction: `GROUP_ROUTES` in
  `types/navigation.ts` lists `notifications` and `profile` under `parent` but
  not `dashboard`, so `getRoleEquivalentRoute` resolves the first two and
  returns nothing for the third, leaving `RoleGate` to redirect to
  `getRoleRoute('parent')`. This item is now verified rather than half-open.
  Native deep links (`hive://…`) are a separate question and remain unchecked —
  Plan 04's mobile checklist still applies.
- ~~**`verify-security.sh` has not been re-run.**~~ **Re-run 11 Aug** —
  27 passed, 0 failed, 2 skipped, so the changes this round made to the rate
  limiter, CORS and the error handler are covered. Running it also exposed two
  things about the script itself: its rate-limit check had never been able to
  pass, because it targeted the rate-limit-exempt `/health`, and the script had
  never run in full at all, because `verify:env` needs `SUPABASE_ANON_KEY` and
  that variable was missing from the backend env — 13 of 26 checks were
  skipping. Both fixed in `701c999`; see `docs/security.md` §9.
- **The rate-limit rekeying is untested under load.** Keying on a hash of the
  bearer token is a behaviour change to a security control, verified by reading.
- **Nothing is deployed.** No hosted URL, no APK, no `eas.json` in the tree.
  Unchanged since §5.

---

*Hive · Phase 2 status · maintained by Nagachaitanya*
