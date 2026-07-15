# Plan 08 — Testing

**Branch:** `test/suite`
**Size:** L (~1 day)
**Depends on:** Plans 01–07 (write tests against code that has stopped moving)
**Closes:** G-21

---

## Goal

Build a test suite of **36 high-value tests**. Every one guards a defect this audit actually found — none are written for coverage's sake.

**Current state: zero tests.** No runner, no test files, no `test` script in any `package.json`, no `test` task in `turbo.json`. This is the single largest gap between this project and a professional codebase, and the thing most likely to be probed in a viva.

---

## Scope decisions

| Decision | Choice | Why |
|---|---|---|
| Backend runner | **Vitest + Supertest** | Near-zero config, fast, native TS |
| Mobile runner | **Vitest**, logic and hooks only | Full RN component rendering costs more setup than it returns here |
| E2E | **None** — scripted manual QA instead (Plan 11) | Detox setup alone can exceed the remaining budget |
| Test database | **A separate Supabase project** | Tests mutate data; never point them at the demo project |
| Coverage target | **None** | The brief is explicit: high-value tests over meaningless 100% |

---

## Step 1 — Backend harness

```bash
pnpm --filter @hive/backend add -D vitest supertest @types/supertest
```

**New file:** `packages/backend/vitest.config.ts` — node environment, `tests/setup.ts` as `setupFiles`, `testTimeout: 20000` (real network calls to Supabase), `pool: 'forks'` with `singleFork: true` so tests sharing a database don't race.

**New file:** `packages/backend/tests/setup.ts`
- Load `.env.test` — **fail loudly if `SUPABASE_URL` matches the demo project.** This guard is worth writing; wiping demo data the night before a submission is a real failure mode.
- Export a `supabaseTest` admin client.
- Truncate domain tables in FK-safe order before each run.

**New file:** `packages/backend/tests/helpers.ts`
- `createTestUser(role, schoolId)` → creates an auth user via the Admin API, sets the profile role/school, returns `{ id, email, token }`. Get the token via `signInWithPassword`.
- `createTestSchool()`, `createTestClass()`, `createTestStudent()`, `linkParent()`, `createTestPhoto()`, `tagStudent()`.
- `cleanup()` — delete created auth users and rows.

**Wire it up:**
- `packages/backend/package.json` → `"test": "vitest run"`, `"test:watch": "vitest"`
- `turbo.json` → add a `test` task with `"dependsOn": ["^build"]`
- Root `package.json` → `"test": "turbo run test"`

**New file:** `packages/backend/.env.test.example` — same keys as `.env.example`, pointing at the test project. Add `.env.test` to `.gitignore`.

> **Set up the test Supabase project first.** Create it, run all migrations, and confirm `pnpm --filter @hive/backend test` runs an empty suite green before writing a single assertion.

---

## Step 2 — Backend tests

Group by file. Each row names the gap it guards.

### `tests/auth.test.ts` — 5 tests

| # | Test | Guards |
|---|---|---|
| T-1 | Missing `Authorization` header → 401 | — |
| T-2 | Malformed/invalid token → 401 | — |
| T-3 | Valid token attaches `role` and `schoolId` from `profiles` | — |
| T-4 | `roleGuard` returns 403 for the wrong role | — |
| T-5 | Parent hitting `/admin/*` → 403 | — |

### `tests/photos.test.ts` — 8 tests

| # | Test | Guards |
|---|---|---|
| T-8 | Teacher A uploads a file to Teacher B's photo → **403** | **G-17** |
| T-9 | Photo request without auth → 401 | G-02 |
| T-20 | Non-image MIME rejected | G-40 |
| T-21 | File over 25 MB rejected | — |
| T-22 | Teacher uploading to another school's class → 403 | — |
| T-23 | **After tag → confirm, tagged parents have a `new_photos` notification** | **G-07** |
| T-24 | Tagging a student from another school → 400 | — |
| T-25 | Re-tagging the same student is idempotent | `uq_photo_student_tag` |

**T-23 is the most valuable test in the suite.** It is the only automated way to catch a regression of the tag-ordering bug, which is invisible until a parent complains.

### `tests/feed.test.ts` — 5 tests

| # | Test | Guards |
|---|---|---|
| T-6 | **Parent A requests Parent B's child's photo → 404** | **G-04** |
| T-7 | **Teacher at school X lists school Y's students → 403** | **G-08** |
| T-10 | Parent sees only photos tagged with their own children | Core privacy |
| T-11 | Feed excludes `status != 'ready'` | — |
| T-12 | Cursor pagination returns no duplicates across pages | G-14 |
| T-13 | A photo tagged with two of the parent's children appears once | G-15 |

### `tests/orders.test.ts` — 7 tests

| # | Test | Guards |
|---|---|---|
| T-14 | **A payload shaped exactly like the mobile client's is accepted** | **G-01** |
| T-15 | Prices come from the server — a client-sent `unitPrice` is ignored | Tamper resistance |
| T-16 | Ordering a photo not tagged with your child → 403 | — |
| T-17 | Duplicate `X-Idempotency-Key` returns the cached response, not a second order | — |
| T-18 | Two concurrent identical keys → one 201, one 409 | `idempotency.ts:57` |
| T-19 | `total_cents` equals the sum of `unit_price_cents × quantity` | G-01 currency |
| T-19b | Backend and mobile product catalogues are identical | G-01 drift |

**T-14 must construct its payload from the same field names the mobile service sends**, not from the validator's schema. A test written against the validator would have passed while the app was broken — that is precisely how G-01 survived.

**T-19b** guards the mirrored-constants trade-off made in Plan 02 Step 1. Import both files and deep-equal them.

### `tests/admin.test.ts` — 6 tests

| # | Test | Guards |
|---|---|---|
| T-27 | **Dashboard returns real order counts and revenue** | **G-06** |
| T-28 | Assigning a nonexistent teacher → 404 | — |
| T-29 | Mapping an already-mapped parent → 409 | — |
| T-30 | **Search containing `,` does not alter the filter** | **G-16** |
| T-31 | `markAsRead` on another user's notification → 404 | G-31 |
| T-32 | Unread count is accurate after marking one read | — |

**T-30:** seed an admin and a parent, then search `x,role.eq.admin`. The result must not contain the admin.

### `tests/errors.test.ts` — 2 tests

| # | Test | Guards |
|---|---|---|
| T-26 | Every Zod schema rejects representative malformed input | — |
| T-33 | `AppError` maps to the right status and code | — |
| T-34 | With `NODE_ENV=production`, unknown errors do not leak `err.message` | `errorHandler.ts:97` |

---

## Step 3 — Mobile harness and tests

```bash
pnpm --filter @hive/mobile add -D vitest @testing-library/react-hooks
```

**New file:** `apps/mobile/vitest.config.ts` — resolve the `@/*` path aliases from `tsconfig.json`; environment `node` (these tests avoid rendering).

Add `"test": "vitest run"` to `apps/mobile/package.json`.

### `src/features/orders/stores/cartStore.test.ts` — T-35

Add item; add the same photo twice; update quantity; quantity 0 removes; `clearCart`; `getTotalCents` sums correctly. **Assert totals in cents** — this is the store where the currency bug lived.

### `src/types/navigation.test.ts` — T-37

`getRoleRoute` returns a route for every member of `UserRole`. A `switch` with no `default` (`navigation.ts:40-47`) silently returns `undefined` if a role is added — this catches that.

### `src/features/teacher/hooks/useUpload.test.ts` — T-36

Mock `teacherService`. Assert: a failing `uploadPhotoFile` moves the image to `state: 'error'` with a message; `retryImage` resets to `idle` and re-runs; concurrency never exceeds 3 (Plan 05 Step 5).

### `src/features/auth/components/RoleGate.test.ts` — T-38

Mock `useAuthStore`. Assert: unauthenticated → redirect to login; wrong role → redirect to that role's route; correct role → renders children; `isLoading` → renders nothing.

> If `RoleGate` proves awkward to test without rendering, extract its decision logic into a pure `resolveGate(state, allow): 'render' | 'login' | string` and test that. Pure functions over rendered trees is the right call under time pressure.

---

## Step 4 — Fixtures

**New:** `packages/backend/tests/fixtures/`
- `valid.jpg` — small (~50 KB) real JPEG
- `large.jpg` — just over 25 MB, for T-21 (generate at test time rather than committing it)
- `notanimage.jpg` — a text file with a `.jpg` extension, for T-20

---

## Verification

```bash
pnpm test                                    # all 36 green
pnpm --filter @hive/backend test             # backend only
pnpm test && pnpm test                       # twice in a row — must be idempotent
```

- [ ] Suite completes in under ~3 minutes
- [ ] No test depends on another test's leftover data
- [ ] Running against a database with demo data still passes (or fails loudly on the guard)
- [ ] `pnpm typecheck` still passes with test files included

**Then deliberately break something and confirm the suite catches it:**

| Revert | Expected failure |
|---|---|
| `feed.service.getPhotoDetails` ownership check | T-6 |
| Tag-before-confirm ordering in `photo.service` | T-23 |
| `admin.service` search sanitisation | T-30 |
| `orders.total_amount` column name | T-27 |

**Do this — it is the only proof the tests test anything.** A suite that passes both with and without the fix is worthless, and this exercise takes ten minutes.

---

## Commit sequence

```
test(setup): add Vitest and Supertest harness with test database guard
test(helpers): add fixtures and factory helpers for test data
test(auth): cover authentication and role-based access control
test(photos): cover upload, ownership, tagging and notification ordering
test(feed): cover parent privacy, pagination and deduplication
test(orders): cover contract, server pricing, authorisation and idempotency
test(admin): cover dashboard stats, mappings and search sanitisation
test(errors): cover validation and error handler behaviour
test(mobile): cover cart totals, upload state machine and route guards
ci: add test task to the turbo pipeline
```

---

## Done when

- [ ] 36 tests pass
- [ ] Suite is idempotent across repeat runs
- [ ] Each of the four sabotage checks fails the expected test
- [ ] `pnpm test` works from the repo root
- [ ] `.env.test` is gitignored; `.env.test.example` is committed
- [ ] Merged into `develop`

---

## Deviations

**Partially implemented — 12 of 36 tests, by Nagachaitanya.** The schedule
(`PHASE-2-EXECUTION-PLAN.md` §4) gives this stream the harness (W18) and the
auth, RBAC and error tests (W19–W20). Written:

| File | Tests | Status |
|---|---|---|
| `tests/setup.ts`, `tests/helpers.ts`, `vitest.config.ts`, fixtures | — | written |
| `tests/auth.test.ts` | T-1…T-5, plus 6 variants | written, never run |
| `tests/errors.test.ts` | T-26 (17 cases), T-33, T-34, plus envelope checks | written, never run |

Not written: `photos.test.ts`, `feed.test.ts`, `orders.test.ts`,
`admin.test.ts` (Ruthwik and Srujan), and all of Step 3's mobile tests
(Bhargav). Those depend on Plans 02, 03 and 05, which have not started.

**`typecheck` now runs two passes.** The base `tsconfig.json` keeps
`rootDir: "./src"` so `build` still emits cleanly, so a second
`tsconfig.test.json` with `rootDir: "."` covers `src`, `tests` and
`vitest.config.ts`. `pnpm typecheck` runs both. This satisfies the plan's
"typecheck still passes with test files included" without breaking the build.

**`globals: true` was dropped** from the vitest config. Every test imports
`describe`/`it`/`expect` from `vitest` explicitly, which avoids needing a
`types` entry that resolves `vitest/globals` and `node` — the latter is not a
direct dependency of `@hive/backend` and adding it to satisfy a type lookup
would be noise.

**`fileParallelism: false`** in addition to the plan's `singleFork`. Both are
needed: `singleFork` shares one process, but files can still interleave.

**Fixtures.** `valid.jpg` is a real 800×600 JPEG generated with `sharp` — 3 KB
rather than the plan's ~50 KB, because a flat-colour image compresses that far
and the size is irrelevant to what it tests. `notanimage.jpg` is text with a
`.jpg` extension. `large.jpg` is deliberately absent; T-21 should generate it
at test time rather than put 25 MB in git history.

**Turbo `test` task uses `cache: false`.** The result depends on live database
state turbo cannot see, so a cached pass would be wrong the first time anyone
changed a migration.

Incidentally: `require('sharp')` loads on macOS/arm64. That is the check
`CLAUDE.md` puts on Plan 03 before Ruthwik starts.

### Not verified

**`pnpm test` has never been executed.** There is no `.env.test` and no test
Supabase project, so the suite cannot reach a database. Twelve tests are
written; zero have run.

**The sabotage exercise in the Verification section has not been done.** The
plan is right that it is the only proof the tests test anything, and it takes
ten minutes — but it needs a working suite first. Whoever creates the test
project should do it before ticking anything here.

Two things *were* executed and passed:

- **The database guard, both branches.** With no `.env.test` the suite refuses
  and names the file to create. With `SUPABASE_URL` pointed at the demo project
  ref it refuses with an explicit warning that running would wipe demo data.
- **`tsc` over the test files**, via the second typecheck pass.

The Done-when boxes stay unticked.
