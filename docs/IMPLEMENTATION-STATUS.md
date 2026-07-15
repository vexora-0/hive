# Phase 2 — Implementation Status

**As of:** Week 24 (18 July 2026)
**Covers:** everything committed to `main` during Phase 2.

This is a factual record of what exists, what runs, and what has been proven to
work. It is deliberately separate from the plans, which describe intent.

---

## 1. Who did what

Phase 2 was planned as four people working in parallel across Plans 00–11
(`docs/PHASE-2-EXECUTION-PLAN.md` §4). **Only Nagachaitanya's stream ran.**

| Person | Plans | Status |
|---|---|---|
| **Nagachaitanya** | 01 (partial) · 04 · 08 (partial) · 09 (partial) · 10 (partial) · 11 (partial) | Committed |
| **Bhargav** | 00 · 07 · 10 (partial) · 11 (partial) | **Not started** |
| **Srujan** | 02 · 06 · 08 (partial) · 10 (partial) | **Not started** |
| **Ruthwik** | 03 · 05 · 09 (partial) · 11 (partial) | **Not started** |

All Phase 2 commits are authored by Nagachaitanya. The progress report sections
for Weeks 17 and 21 give the real per-person split rather than a four-way one.

---

## 2. Gaps closed

| Gap | Severity | What it was | Where the fix lives |
|---|---|---|---|
| **G-04** | Critical | `GET /feed/photos/:id` took no user ID. Any parent could read any photo's metadata and its full tagged-student list — a cross-school child roster. | `feed.service.getPhotoDetails` |
| **G-05** | Critical | No route group checked role. `hive://(admin)/dashboard` rendered the admin console for a parent. | `features/auth/components/RoleGate.tsx` + three group layouts |
| **G-08** | High | Three endpoints took a school or class ID from the URL and never compared it to the caller's. Any teacher could read another school's roster including dates of birth. | `middleware/roleGuard.assertSchoolAccess`, `photo.service.getPhotosByClass` |
| **G-17** | High | `POST /photos/:id/file` and `/confirm` checked only status. Teacher A could overwrite teacher B's photo. `/tag` checked school but not uploader. | `photo.service.assertPhotoOwnership` |
| **G-10** | High | `seedAdmin.ts` hardcoded `admin@hive.app` / `Admin@123` and printed the password. Also documented in `supabase/seed.sql`. | `scripts/seedAdmin.ts`, `supabase/seed.sql` |
| **G-03** | Medium | ~700 lines of finished notification code had zero imports; three screens said "Coming Soon". | the three `notifications.tsx` screens |
| **G-09** | Medium | Five photo routes guarded on `school_admin`, a role the DB `CHECK` rejects — a real admin could not upload a photo. | `photo.routes.ts`, `admin.validator.ts`, `order.service.ts` |
| **G-16** | Medium | `admin.service.getUsers` interpolated raw input into a PostgREST `.or()` filter. | `admin.service.getUsers` |
| **G-39** | Medium | No error tracking. | `config/sentry.ts`, `lib/sentry.ts` |
| **G-L3 / G-L4** | Low | `auth.ts` logged client IPs and raw error objects. | `middleware/auth.ts` |

**Every one of these is written and type-checked. None has been exercised
against a running system.** See §5.

---

## 3. What was built

**Backend**

- `middleware/roleGuard.ts` — `assertSchoolAccess(req, schoolId)` beside the existing guard
- `services/photo.service.ts` — `assertPhotoOwnership(photoId, user)`, used by `saveUploadedFile`, `confirmUpload` and `tagStudents`
- `services/feed.service.ts` — ownership check and tag filtering on `getPhotoDetails`
- `config/sentry.ts`, `config/instrument.ts` — DSN-gated Sentry with a full-event PII scrubber
- `tests/` — Vitest + Supertest harness, factory helpers, fixtures, `auth.test.ts`, `errors.test.ts`
- `tsconfig.test.json` — second typecheck pass covering `tests/`

**Mobile**

- `features/auth/components/RoleGate.tsx` — role gate on all three route groups
- `lib/sentry.ts` — the mobile mirror of the backend scrubber
- the three `notifications.tsx` screens now render `<NotificationCenter />`

**Repo**

- `scripts/verify-security.sh` — Plan 11 Step 3 as a runnable, CI-gateable script
- `docs/security.md` — threat model, three-layer authorization model, remediation table, limitations, auth sequence diagram
- `turbo.json` / root `package.json` — `test` task
- `.gitignore` — `.env.test`

**Dependencies added:** `vitest`, `supertest`, `@types/supertest`, `@sentry/node` (backend); `@sentry/react-native` (mobile).

---

## 4. What was actually executed

Four things ran and passed. They are the only empirical results Phase 2 has.

| Check | Result |
|---|---|
| `pnpm --filter @hive/backend typecheck` | Clean after every commit, including `tests/` |
| `pnpm lint` | 8 problems — down from 9; all pre-existing, none in code touched here |
| `pnpm --filter @hive/mobile typecheck` | 22 errors, byte-identical to the pre-work Plan 00 baseline after every mobile change |
| Test-database guard, both branches | Refuses with no `.env.test`; refuses when `SUPABASE_URL` names the demo project |
| Sentry `beforeSend` against a synthetic event | JWT, two emails, client IP, signed storage URL, `/uploads` URL, password field and hostname all redacted; user-agent and a student's first name preserved |
| `verify-security.sh` repository-hygiene section | Passes — and found the `Admin@123` comment in `supabase/seed.sql` |
| Secret scan (`git grep`) | Zero JWTs, AWS keys, Stripe keys, PEM blocks, tracked `.env` files |

Also incidentally confirmed: **`require('sharp')` loads.** `CLAUDE.md` §4 makes
that the gate on Plan 03's synchronous-thumbnail approach, so Ruthwik can
proceed with the plan as written rather than its rollback path.

---

## 5. What was NOT verified — read this before trusting §2

**There is no `.env` anywhere in this repository, only `.env.example`.** The
backend cannot boot, the app cannot start, no Supabase query can be made, and
nothing is deployed. Consequently:

- **None of Plan 04's verification ran.** Eight `curl` checks across two
  accounts at different schools, and six device checks. Zero executed. The IDOR
  fixes and the route guards are reviewed code and passing typechecks — not
  observed behaviour.
- **`pnpm test` has never run.** 12 of 36 tests written, 0 executed. The
  sabotage exercise that would prove the tests detect anything has not been
  done.
- **No error has ever reached Sentry.** `initSentry()` has only taken its no-op
  path. The scrubber was tested in isolation, which does not prove Sentry calls
  it or that a real event resembles the synthetic one.
- **`verify-security.sh` has never run against a real instance.** Only against
  an unreachable host, to check its own control flow.
- **No screen has been seen on a device.** Including the notification screens
  and `RoleGate`.

**The mobile app still does not compile** — 22 pre-existing errors from Plan 00,
untouched because they are Bhargav's and `CLAUDE.md` §6 restricts editing other
people's files. A baseline was captured first and diffed after every mobile
commit; it never changed, and no error appears in any file touched here.

---

## 6. Open, and more serious than anything closed above

| Gap | Owner | Why it matters |
|---|---|---|
| **G-02** | Plan 03 | `/uploads` is served by `express.static` with **no authentication**. Every child's photo is a public URL. The authorization work in §2 governs who may read photo *metadata* through the API; it does nothing about the files. |
| **G-01** | Plan 02 | Order submission is broken three ways. No order can be placed. |
| **G-12** | Plan 03 | No thumbnails; the feed serves full-resolution originals. |
| **G-40** | Plan 03/05 | Upload MIME check trusts the client's `Content-Type`; no magic-byte verification. |
| **G-20** | Plan 01 Step 6 | `trust proxy` is `true`, so the rate limiter keys on a client-controlled header. |
| **G-S10** | Plan 09 | `CORS_ORIGINS` defaults to `*`. |
| **S-15** | Plan 11 | Supabase project ref committed; keys not rotated. |

**G-02 is the most serious issue in the system.** Nothing in §2 should be read
as "photos are protected" while it stands.

---

## 7. Checkpoints

| # | Gate | Status |
|---|---|---|
| **CP-1** | App compiles · no "Coming Soon" · no credentials in repo | ◐ No "Coming Soon"; no credentials. **App does not compile** (Plan 00). |
| **CP-2** | Order placeable · private storage with thumbnails · role guards · IDORs closed | ◐ Guards and IDORs written but unverified. **Orders still broken; storage still public.** |
| **CP-3** | Demo seed on a fresh DB · test harness runs | ◐ Harness exists. **Never run. No seed.** |
| **CP-4** | 36 tests green · CI on every PR | ✗ 12 written, 0 green. No CI. |
| **CP-5** | Deployed and reachable · Sentry receiving · docs complete | ✗ Nothing deployed. Sentry never received an event. |
| **CP-6** | Manual QA green · demo rehearsed · submission pack | ✗ |

---

## 8. What to do next

In this order:

1. **Create a `.env`** for `packages/backend` and `apps/mobile` from the
   examples. Nothing below is possible without it, and it is the single
   highest-value action available.
2. **Bhargav: Plan 00.** 22 typecheck errors. Everyone else is blocked on a
   compiling app for verification.
3. **Ruthwik: Plan 03.** G-02 is the worst open issue. `sharp` loads, so the
   plan works as written.
4. **Srujan: Plan 02.** No order can currently be placed.
5. **Create a test Supabase project**, run the migrations, and execute
   `pnpm --filter @hive/backend test`. Then do Plan 08's sabotage exercise —
   revert each fix and confirm the matching test fails. Until then the suite
   has proven nothing.
6. **Run `scripts/verify-security.sh`** against a deployed instance with real
   tokens. That is what turns `docs/security.md` §4 from "believed fixed" into
   "confirmed fixed", and it is the difference between claiming the IDORs are
   closed and knowing it.

---

*Hive · Phase 2 status · Nagachaitanya*
