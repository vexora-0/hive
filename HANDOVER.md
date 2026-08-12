# Hive — Handover

**State:** the core product loop is verified working against a live database.
**Last verified:** 13 August 2026. The runtime table in §4 is from 18 and 24
July and still holds; §5 and §7 have been re-checked since, most recently on 13
August.
**Not deployed.** Everything below runs locally.

For deeper detail: `CLAUDE.md` (working rules) · `docs/IMPLEMENTATION-STATUS.md`
(what exists and what is proven) · `docs/environment-setup.md` (setup, plus the
verification checklist).

---

## 1. What Hive is

Preschools photograph classroom activity and share it with parents. The
constraint that shapes every decision: **a parent must see photos of their own
child and no one else's** — structurally, not by convention.

Teachers upload and tag which children appear. Parents see a feed scoped to
their own children and can order prints. Admins manage schools, classes,
students and the parent↔child links the whole privacy model rests on.

**Stack:** Expo / React Native · Express + TypeScript · Supabase (Postgres, Auth,
Storage) · pnpm workspaces with Turborepo.

---

## 2. Run it

```bash
docker run -d --name hive-redis -p 6379:6379 redis:7-alpine
pnpm install
pnpm dev:backend
curl -s localhost:4000/health | jq      # expect "checks":{"database":"ok"}
pnpm dev:mobile
```

Env files are gitignored; create them from the `.env.example` templates. The
Supabase project, migrations and demo data already exist — **do not run
`pnpm db:reset`.**

`"database":"ok"` is the real signal: `/health` round-trips to Supabase, so a 503
means bad credentials rather than a dead process.

**Redis backs order idempotency.** It used to be worse than that: without Redis,
order creation hung indefinitely rather than failing, because
`maxRetriesPerRequest: null` — left behind by the removed BullMQ — plus
ioredis's offline queue meant a command retried forever and never settled, so
the middleware's existing catch never fired. **Fixed in `1f09cf8`** (9 Aug):
commands now fail after two retries with the offline queue disabled, and
`/health` reports `"cache"` alongside `"database"`. Losing Redis now degrades
deduplication rather than availability — which is why the cache check
deliberately does **not** change the status code.

---

## 3. Demo accounts

Password is whatever you set as `DEMO_PASSWORD`; admin uses `ADMIN_PASSWORD`.

| Role | Email |
|---|---|
| Admin | your `ADMIN_EMAIL` |
| Teacher | `teacher.sarita@bloom.demo` |
| Parent | `parent.rajesh@bloom.demo` — **two children**, the account to demo |
| Parent | `parent.vikram@stars.demo` — other school, the privacy proof |

**Sign in with the password, not a one-time code.** Pick the role, then tap
*"Use a password instead"*. `.demo` domains cannot receive mail.

Re-seed anytime: `pnpm seed`

---

## 4. Verified working — runtime, not review

Confirmed against the live database on 18 July:

| Check | Result |
|---|---|
| Photos processed | 6/6 with thumbnail, blurhash, dimensions |
| Photo URL without a signature | **400** |
| Signed URL | 200; token stripped → 400 |
| Thumbnail vs original | **16 KB vs 211 KB — 13×** |
| Parent feed | correct children only; sibling photo appears once |
| Other family's photo | **404** (not 403 — 403 would confirm it exists) |
| Notifications | produced by trigger, correct child names |
| Order | `total_cents=998` = $9.98 for 2 × $4.99 |
| Duplicate idempotency key | cached replay, no second order |
| Ordering another family's photo | **403** |
| Teacher → another school's class | **403** |
| Admin dashboard | 2 schools, 8 users, 6 photos, 3 orders, $34.95 |

Added 24 July, all against the same live project:

| Check | Result |
|---|---|
| Text file renamed `.jpg` | **400 INVALID_IMAGE** — magic bytes, not the client's MIME |
| AVIF (HEIF container) upload | converted to JPEG, thumbnail + blurhash written |
| **Real HEVC HEIC — an iPhone photo** | **400. Cannot be converted.** See below |
| Feed and photo detail | return `uploadedBy: { id, name }` — "Sarita Devi" |
| `/confirm` with no object in storage | 404 FILE_NOT_FOUND; 200 once the object exists |

Every row created by these probes was deleted afterwards. The demo dataset is
back to its seeded state: 6 photos, all `ready`.

### HEIC does not work, and it is not a bug in our code

`sharp` 0.33.5 ships a prebuilt libvips whose libheif has an AV1 codec and **no
HEVC codec** — and an iPhone HEIC is HEVC. libheif parses the container, so
`metadata()` succeeds and reports `format: 'heif'`; only the pixel decode fails.
That is why review never caught it.

Mitigated on the device: the picker now asks iOS for a compatible
representation, so it transcodes to JPEG before upload and no HEIC leaves the
phone. The server-side path returns a message a teacher can act on instead of
leaking `bad seek to 80687`.

A real server-side fix means building `sharp` from source against libheif with
`libde265`. That belongs in the Dockerfile, not in application code — see
`docs/plans/03-storage-and-media.md`.

---

## 5. Not verified

- **Nothing is deployed.** No Render service, no public URL, no `eas.json`.
- ~~**Tests have never run.**~~ **They do — the suite is 218 tests across 8
  files** (`3b2f4c4`, 13 Aug). It was 79 across 5 files when this line was
  written on 1 August, and 178 across 8 through 9 August. It includes 20
  authorization tests and T-23, whose fixture defect is fixed, and has been
  shown to *detect*: deleting the G-17 uploader check turns exactly three tests
  red. The suite truncates rows it created, so `.env.test` must name a throwaway
  project; the guard in `tests/setup.ts` lists the real demo project ref.
- ~~**CI does not run the tests — `ci.yml` has no test step.**~~ **Wrong since 2
  August.** `.github/workflows/ci.yml` has run
  `pnpm --filter @hive/backend test` since `09c3226`. What is still true is that
  the step carries `continue-on-error: true`, so it cannot turn a pull request
  red until `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_KEY` and
  `TEST_SUPABASE_ANON_KEY` exist as repository secrets. Lint, typecheck and
  build **do** block.
- **The newest 40 tests were not proven by mutation.** `3b2f4c4` covers the
  ordering fixes, idempotency, the upload retry paths, admin integrity and
  malformed input — but the sandbox refused edits to `src/`, so "these fail on
  a regression" is reasoning, not measurement. The one indirect proof is that
  the pre-existing replay test passes, which means Redis is live and the
  corrected-retry case is not passing vacuously through the middleware's
  Redis-failure fallback.
- **The upload progress bar has not been watched on a device.** The transfer now
  reports real bytes through `XMLHttpRequest`, verified by reading the code path,
  not by looking at a phone.
- **The mobile app has not been driven end to end on a device.** It **was**
  driven end to end in Chrome on 9 August via `expo start --web`, so the screens
  are exercised rather than merely compiled — but web is not the target. No iOS
  or Android build has been launched, so the keychain-backed session, the image
  picker, native deep links and `AppState` transitions are unverified where they
  ship.
- **k6 load suite** written, never run — needs a deployed target.
- **CI runs on every push** — it was written and never triggered when this was
  drafted; it has run since. What has never happened is a *deployment*, not a
  build.

`docs/environment-setup.md` §7 is the manual checklist. It asks for failures to
be reported, not ticks.

---

## 6. Four bugs that only running found

Worth reading before trusting anything that has only been reviewed.

**`processed_at` did not exist.** Written by the upload path, present in no
migration — inherited from a deleted background worker. PostgREST rejects an
entire update over one unknown column, so thumbnails, blurhash and dimensions
silently never persisted. Every upload would have left the feed on
full-resolution originals: exactly the defect the storage rewrite existed to fix,
reintroduced by one copied line.

**The seed filed every photo under the wrong school.** It derived the school by
comparing the first eight characters of a class UUID; every class id shares them.
Photos were invisible to the teacher who uploaded them.

**The dashboard selected a dead column twice.** First `total`, which never
existed; then `total_amount`, after a migration renamed it to `total_cents`. The
first time it failed silently and reported zero. The second was caught only
because an error check had been added alongside the first fix.

**Orders hang without Redis.** Not an error — a silent indefinite wait. **Fixed
in `1f09cf8`**: see §2. With Redis stopped, `POST /orders` now answers rather
than hanging, and `/health` says so.

All four typecheck cleanly. Static review cannot catch a missing column, a string
comparison that is always true, or a client that queues forever.

---

## 7. What is left

| Item | Owner | Notes |
|---|---|---|
| **Rotate the Supabase service key** | Ruthwik | It was pasted into a chat log. Settings → API → revoke, reissue, update `.env`. |
| ~~Create `hive-test` project~~ | — | **Done, 1 Aug** — `sdbiuzuyipneioceqysm`, ap-southeast-1, migrations applied. `pnpm test` no longer threatens the demo data. It is shared between CI and every developer, so check `pgrep -fl "vitest.mjs run"` before starting a run |
| Deploy to Render | Bhargav | Dockerfile and CI are written. `NODE_ENV=production` is critical — anything else returns internal error messages to clients. |
| Drive the app by hand | all | §7 checklist in `docs/environment-setup.md` |
| ~~Order and admin tests~~ | — | **Done, 2 Aug** — `orders.test.ts` and `admin.test.ts`. Extended on 13 Aug by `3b2f4c4` |
| Mobile tests | Srujan, Nagachaitanya | Backend is covered; the mobile app has no test suite |
| Custom SMTP | Bhargav | Default Supabase SMTP is rate-limited; OTP unreliable for a live demo |
| ~~One lint error~~ | — | **Done** — fixed in `40a69fc`. `pnpm lint` is 0 errors in both packages and the CI step is now blocking. |
| ~~Add a test step to CI~~ | — | **Done, 2 Aug** (`09c3226`). What remains is making it *blocking*: add `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_KEY` and `TEST_SUPABASE_ANON_KEY` as repository secrets, then drop `continue-on-error`. Bhargav. |
| Decide on server-side HEIC | Bhargav | Build `sharp` from source against libheif + libde265, or accept the device-side transcode as the answer. Adds build time and HEVC licensing to the deploy — a call, not a task. |
| Order item thumbnails (8b) | Ruthwik | Order items carry only `photoId`; the order API returns no signed URL per item |
| **Orders from a two-school parent are filed under one school** | Ruthwik | Found 13 Aug while writing the order tests; **not fixed**. A parent with children at two schools has every order filed under whichever school back-filled their profile first, because `createOrder` files under `req.user.schoolId`. `mapParentToStudent` only back-fills `school_id` when it is absent, which is deliberate. Consequence: the second school's admin never sees those orders in their queue, and the first sees an order for a photo that is not theirs. |

---

## 8. Two things to know before changing code

**The API bypasses row level security.** Every service uses the service-role key,
which is exempt by design. The 545-line policy set in migration `00011` protects
only the queries the mobile client makes directly to Supabase. **Every endpoint must enforce
authorization explicitly in its service function** — four originally did not, and
that was the source of three critical findings.

**Tag before confirm.** `notify_parents_on_photo` fires when a photo becomes
`ready` and loops over `photo_student_tags`. Flip the status before tagging and
the loop runs empty — no parent is ever notified, while the teacher still gets
their own notification, so it looks half-working. Both the app and the seed tag
first. Do not reorder them.

---

## 9. History

Weeks 1–13 (Feb–May) are a **reconstruction.** The original repository was lost
to a laptop failure; the code survived as a single recovery commit pushed 3 March
2026. The code is authentic and verified byte-identical to that snapshot; the
commit boundaries, dates and per-commit authorship are not recovered. This is
stated at the top of `docs/PROGRESS-REPORT.md` and should stay stated.

The original snapshot is preserved as tag `backup/original-import` and branch
`backup/main-original`, both on the remote, plus a local bundle.

Phase 2 (May onward) is genuine history.
