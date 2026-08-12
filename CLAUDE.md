# Hive — Working Instructions

You are working on **Hive**, a privacy-first photo sharing platform for preschools. Four developers work on this repository in parallel. This file tells you what the project is, who you are working with, and what to do next.

**Read this file fully before making any change.**

---

## 1. Identify who you are

Run this first:

```bash
git config user.email
```

Match it against the table. **This determines what you work on.** If the email doesn't match any row, stop and ask the user which team member they are.

| Email | Name | Owns | Current plan |
|---|---|---|---|
| `chikotiruthwik@gmail.com` | **Ruthwik** | Backend APIs, storage, jobs, server assembly | `docs/plans/03-storage-and-media.md` |
| `bhargav4g13132@gmail.com` | **Bhargav** | Mobile UI, design system, components, screens · **environment setup, Docker, deployment** | `docs/plans/00-typecheck-fixes.md`, then `docs/environment-setup.md` |
| `dharmassr@gmail.com` | **Srujan** | Database schema, migrations, validation, data | `docs/plans/02-contracts-and-data-model.md` |
| `vanapalachaitanya@gmail.com` | **Nagachaitanya** | Auth, authorization, notifications, admin | `docs/plans/04-authorization.md` |

---

## 2. Where everything is

| Document | What it is |
|---|---|
| `docs/PHASE-2-EXECUTION-PLAN.md` | **The schedule.** Week-by-week, who does what, branches, checkpoints. Read this second. |
| `docs/plans/00-INDEX.md` | Plan index, locked technical decisions, dependency graph |
| `docs/plans/00` – `11` | One file per plan. Each has exact steps, files, verification and commit messages. |
| `docs/01-PROJECT-AUDIT-AND-COMPLETION-PLAN.md` | The audit every plan derives from. 46 numbered gaps (`G-01`…`G-46`). |
| `docs/02-FOUR-PERSON-DEVELOPMENT-AND-GIT-PLAN.md` | File ownership map and conflict protocol |
| `docs/PROGRESS-REPORT.md` | Weekly progress report. Continues from Week 13. |
| `docs/IMPLEMENTATION-STATUS.md` | **What actually exists right now** — gaps closed, what was executed, what was not, and what to do next. Read this before trusting any plan's status. |
| `docs/security.md` | Threat model, the three-layer authorization design, remediation record, known limitations, auth sequence diagram. |

**Plans are the source of truth.** They contain file paths, line numbers and exact fixes. Do not improvise a different approach — if a plan looks wrong, say so and record it under that plan's `## Deviations` section rather than silently doing something else.

---

## 3. Progress

**See `docs/IMPLEMENTATION-STATUS.md`** — the single source of truth for what
exists, what runs and what has been proven. Two status tables drifting apart is
worse than one, so this file no longer restates it.

### Status — 9 August

Every number below was re-run on 9 August rather than copied forward, against a
tree carrying the `afafe1a` changes (uncommitted at the time they were run).
Other people's work was in flight, so re-run them yourself before relying on
them:

| Check | Result |
|---|---|
| `pnpm typecheck` | Clean, both packages (forced past the Turbo cache) |
| `pnpm lint` | **0 errors**, 27 warnings — 3 backend (`no-explicit-any` in `admin.service.ts`), 24 mobile (mostly unused imports) |
| `pnpm build:backend` | Succeeds |
| `pnpm test` | **178 tests, 8 files** on 9 Aug, against `hive-test`. **Not observed fully green that day** — see below. **The suite is now 218 across the same 8 files** (`3b2f4c4`, 13 Aug) |
| `ls supabase/migrations` | **20 files** — `00001`–`00018`, `00020`, `00024`. `00019` and `00021`–`00023` were reserved per plan and never used; the sequence has holes, the count is right |

**Check for a run in flight before starting the suite** —
`pgrep -fl "vitest.mjs run"` — and do not start one if there is. `hive-test` is
shared between CI and every developer.

The one-in-five flake that had been blamed on a bad test was a harness fault,
fixed in `e4e689e`: `truncateAll()` ran in a global `beforeAll` once per file,
so two overlapping runs wiped each other's fixtures mid-test. Cleanup is now
scoped to the schools the running process created. **Repeated runs still
exhaust the shared GoTrue sign-in quota** — each run creates ~40 auth users,
and past the quota sign-ins stall rather than fail. Running the suite three
times inside half an hour on 9 August was enough on its own, with `pgrep`
checked clear before each: the first run was 177/178 with one 30 s timeout, and by the third
every one of the 21 tests in `orders.test.ts` timed out and the run took over
fifteen minutes. **Every failure seen was a timeout, never a failed
assertion**, and the same files passed in isolation straight afterwards.

A clean **178/178 in 115s was observed earlier the same day**, on a run made
with nothing else touching the project — so the figure is real, but it is a
measurement of the suite running alone, not of the suite running whenever you
happen to want it. A red or very slow run following someone else's is this
quota, not a regression: pause, then re-run the failing file alone before
believing it.

The environment works end to end; demo data seeds with photos, tags,
notifications and orders. `hive-dev` had stopped resolving (NXDOMAIN) at the
start of 9 August, which is why the app "wasn't running properly"; it was
restored, and migration `00024` has been applied to it and verified.
G-01, G-02, G-04, G-05, G-07, G-08, G-17 and the parent privacy boundary are
confirmed at runtime — see `docs/IMPLEMENTATION-STATUS.md` §4, and §5 for what
is still unproven.

**9 August brought 25 fix commits** (`f426251..HEAD`) across
ordering, upload, auth, notifications, the admin console, the API error surface
and the web build. `docs/IMPLEMENTATION-STATUS.md` §10 records them by area.
The round's own second review found three regressions it had introduced —
cursor pagination dropping rows on a millisecond-truncated timestamp, a
rate-limit bypass via a forged bearer token, and WebP accepted at three format
gates and refused at the fourth — all fixed. The round itself added only the 23
tests in `tests/cursor.test.ts`; **`3b2f4c4` (13 Aug) added 40 more**, covering
ordering, idempotency, the upload retry paths, admin integrity and malformed
input, and taking the suite to 218. Those 40 were **not proven by mutation** —
the sandbox refused edits under `src/`, so "they fail on a regression" is
reasoning rather than measurement.

**The app was seen rendering for the first time**, in Chrome, via
`pnpm --filter @hive/mobile exec expo start --web` on `localhost:8081`. Two
web-only defects had to be fixed first: zustand's `import.meta` making the
whole bundle a parse error under a classic `<script>` tag, and
`expo-secure-store` having no web implementation, so the session was never
persisted and sign-in bounced back to login. Both fixed without changing native
behaviour. Web is a verification convenience — the product targets iOS and
Android.

`scripts/verify-security.sh` was run on 1 August — **26 passed, 0 failed, 3
skipped** — and **re-run in full on 11 August, after the 9 August changes to the
rate limiter, CORS and the error handler: 27 passed, 0 failed, 2 skipped**
(`701c999`). `docs/security.md` §9 records both runs and why the remaining skips
are not interchangeable: HTTPS needs a deployment, and the 500-response-shape
check needs `FORCE_500_PATH` **and** `NODE_ENV=production`, since it is gated on
the variable rather than on the mode.

Two things the 11 August run turned up. The rate-limit check had never been able
to pass: it hammered `/health`, which is deliberately exempt from rate limiting,
and assumed a global ceiling of 100 where the budget is now 1000 per identity.
It now targets the write limiter (100 per identity) with a deliberately invalid
body, and a 429 arrived at request 98. And the script had never run in full at
all, because `verify:env` needs `SUPABASE_ANON_KEY` — the service-role key
cannot mint the user-scoped JWT the API expects, only a real sign-in does — and
that variable was missing from the backend env, so 13 of the 26 checks skipped.
A skip is not a pass.

**This round crossed the ownership map in §6.** The fixes touch
`order.service.ts`, `photo.service.ts`, the upload middleware and the admin
services, which belong to Ruthwik and Nagachaitanya, plus the auth store and
`middleware/auth.ts`, which belong to Nagachaitanya. That was not agreed in
advance. Both should review the 9 August commits in their own areas before
building on them.

**Env files are per-machine and gitignored.** On a fresh clone none exists and
nothing runs; create them from the `.env.example` templates first.

### What is left

1. **Nothing is deployed** — no hosted URL, no APK, no `eas.json` in the tree.
   Bhargav, Plan 09 Step 6. This is the blocker on three verification items:
   the HTTPS and CORS checks in `verify-security.sh`, and the k6 suite.
2. **The CI test step is `continue-on-error: true`.** It does exist and does
   run — `.github/workflows/ci.yml` has run `pnpm --filter @hive/backend test`
   since 2 August — but it cannot go red until `TEST_SUPABASE_URL`,
   `TEST_SUPABASE_SERVICE_KEY` and `TEST_SUPABASE_ANON_KEY` exist as repository
   secrets. Until then 218 passing tests still guard nothing on a pull request.
   Lint, typecheck and build are blocking.
3. **Nothing has been seen on a device.** This changed by half a step on 9
   August: the app was driven end to end **in Chrome**, so the screens are no
   longer merely typechecked. But web is not the target. No iOS or Android
   build has been launched and no simulator run is recorded, so anything
   platform-specific — the keychain-backed session, the image picker, deep
   links, `AppState` transitions — is still unverified where it ships. Plan
   04's mobile deep-link checks remain unticked.
4. **The web file picker was never driven end to end.** The tagging gate and
   the class default were checked in the browser; an actual file upload through
   the web picker was not completed. The pipeline itself is covered by the API
   tests.
5. ~~**`scripts/verify-security.sh` needs re-running.**~~ **Done, 11 August** —
   27 passed, 0 failed, 2 skipped. See the paragraph above.
6. **Sentry has never received an error**, and **G-45 custom SMTP** is unowned.
   Both are account signups rather than code changes.
7. ~~**Redis has no timeout and no health check.**~~ **Fixed 9 August in
   `1f09cf8`.** The fault was `maxRetriesPerRequest: null`, left behind by the
   removed BullMQ: combined with ioredis's offline queue, a command issued while
   Redis was unreachable retried forever and never settled, so the idempotency
   middleware's existing catch never fired and `POST /orders` hung open rather
   than degrading. `config/redis.ts` now sets `maxRetriesPerRequest: 2`,
   `enableOfflineQueue: false` and `connectTimeout: 3000`, so commands fail
   fast; `/health` now reports `"cache"` alongside `"database"`, deliberately
   **without** changing the status code, because losing the idempotency cache
   degrades deduplication rather than availability. Verified against the running
   server with Redis stopped: `/health` returned 200 with `"cache":"error"`, and
   `POST /orders` answered in 485 ms instead of hanging.

**Two items that were on this list are done.** G-27 upload progress is real:
`teacherService.uploadPhotoFile` uses `XMLHttpRequest` and reports
`event.loaded / event.total` from `xhr.upload.onprogress`, and `useUpload.ts`
maps it into the band it reserves for the transfer. The `no-namespace` lint
error in `middleware/auth.ts` was fixed in `40a69fc`, which is why the CI lint
step is blocking rather than advisory.

Follow `docs/environment-setup.md`; §7 is the verification checklist and asks
for failures to be reported, not ticks.

> This block goes stale faster than anything else in the repo — it has twice
> described work as blocked weeks after it shipped. If you are about to rely on
> it, re-check against `docs/IMPLEMENTATION-STATUS.md` §4 first, and against a
> running instance if it matters.

---

## 3a. Current state

**Phase 1 is complete** — the application is built: database schema with row level security, a 31-endpoint API, teacher upload with student tagging, a privacy-scoped parent feed, an admin console, and a full design system.

**Phase 2 is fixing what Phase 1 left broken.** The audit found 46 gaps. The most serious:

| Gap | Problem |
|---|---|
| **G-01** | Order submission is broken — client, validator and database disagree three ways. No order can be placed. |
| **G-02** | `/uploads` is served with no authentication. Every child's photo is a public URL. |
| **G-03** | ~700 lines of finished notification code is unimported; three screens show "Coming Soon". |
| **G-04, G-08** | Any parent can read any photo's metadata; any teacher can read another school's student roster. |
| **G-05** | No role-based route protection — a parent can deep-link into the admin UI. |
| **G-12** | No thumbnails are generated, so the feed serves full-resolution originals. |

**The mobile app compiles** — Plan 00 closed all 22 TypeScript errors. The gap table above is the audit's original findings; see `docs/IMPLEMENTATION-STATUS.md` §2 for which are now closed.

---

## 4. Start-up order — this matters

Work is parallel, but three things are sequenced:

1. **Srujan regenerates `apps/mobile/src/types/supabase.ts` first.** Bhargav's Plan 00 Group B is blocked on it.
2. **Bhargav then runs Plan 00.** Everyone else is blocked on a compiling app for verification.
3. **Ruthwik verifies `sharp` loads before starting Plan 03:**
   ```bash
   pnpm --filter @hive/backend exec node -e "require('sharp')"
   ```
   If it throws, Plan 03's whole approach changes — use the Rollback section in that plan.

**Nagachaitanya is blocked by nothing** and should start immediately with Plan 01 Step 1 (wiring the notification screens).

---

## 5. How to work

```bash
git checkout main && git pull
```

**We work on `main`.** There is no long-lived `develop` branch — it was tried
and dropped, because half the team was committing to `main` directly and the
two diverged.

A short-lived branch for your own plan is fine and encouraged if you want one —
create it, do the work, merge it back to `main` the same day, delete it. What
matters is that nothing sits unmerged for days where the others cannot see it.

Then, for your plan:

1. **Read the whole plan file** before changing anything. The step order encodes dependencies.
2. **Follow the steps in order.**
3. **Run every check** in the plan's Verification section. All must pass.
4. **Commit using the plan's commit sequence** — the messages are already written.
5. **Merge to `main` the same day** and push. Ask someone to look over anything touching auth, storage or orders.
6. **Tick the plan's Done-when checklist.**

Always verify before committing:
```bash
pnpm typecheck && pnpm lint && pnpm build:backend
```

---

## 6. Rules that prevent conflicts

**Only edit files you own.** The ownership map is in `docs/02-FOUR-PERSON-DEVELOPMENT-AND-GIT-PLAN.md` §7. If your plan requires changing someone else's file, that dependency is already documented in the plan — follow it, don't work around it.

**Four files are shared. Do not touch them unless your plan says to:**

| File | Owner |
|---|---|
| `packages/backend/src/app.ts` | Ruthwik |
| `apps/mobile/src/app/_layout.tsx` | Nagachaitanya (Bhargav adds the toast provider in W16) |
| `apps/mobile/src/types/supabase.ts` | Srujan |
| `apps/mobile/src/theme/**`, `components/ui/**` | Bhargav |

**Migration numbers are reserved.** Never reuse or renumber someone else's:

| Plan | Owner | Range |
|---|---|---|
| 02 | Srujan | `00017` – `00019` |
| 03 | Ruthwik | `00020` – `00021` |
| 04 | Nagachaitanya | `00022` |
| 09 | Ruthwik | `00023` |

**Dependency changes** to any `package.json` must be announced to the team before committing. Resolve `pnpm-lock.yaml` conflicts by re-running `pnpm install`, never by hand-editing.

---

## 7. Commit conventions

Conventional commits. `commitlint.config.js` exists but **nothing runs it** —
there are no git hooks and no CI step, so this is a convention the team keeps by
hand, not a gate. Format:

```
<type>(<scope>): <imperative summary>
```

Types: `feat` · `fix` · `security` · `perf` · `refactor` · `test` · `docs` · `build` · `ci` · `chore`

Use `security:` for security fixes — it makes the remediation trail visible in the log.

Scopes in use: `orders` `photos` `feed` `storage` `upload` `admin` `notifications` `auth` `rbac` `db` `ui` `ux` `obs` `api` `deps` `seed` `config` `deploy` `types`

Rules:
- One logical change per commit
- Imperative mood — "add", not "added"
- Reference the gap: `Closes G-01`
- Never commit `.env`, secrets, or credentials

---

## 8. Definition of done

A task is not finished because the code is written. All of these must hold:

- Works on a real device against the backend, not just locally
- Input validated with Zod at the route boundary
- Authorization enforced **server-side** — never trust the client
- Ownership checked for every resource accessed by ID
- Loading, error and empty states present in any UI
- `pnpm typecheck` and `pnpm lint` pass with no new warnings
- No console errors during the flow
- Conventional commit message, reviewed, merged to `main` and pushed

---

## 9. Weekly report

At the end of each week, whoever's turn it is appends a section to `docs/PROGRESS-REPORT.md` following the existing format: dates, commit count and per-person split, phase objective, individual contributions, technical implementation, issues and challenges, testing, commits, end state, next week.

Rotation: W14 Ruthwik · W15 Bhargav · W16 Srujan · W17 Nagachaitanya · then repeat.

Write what actually happened, not what the plan said would happen.

---

## 10. Things to know before you touch the code

- **The backend bypasses row level security.** Every service uses `supabaseAdmin`, created with the service-role key, which is exempt from RLS by design. The 545-line policy set in migration `00011` only protects the handful of queries the mobile app makes directly to Supabase. **Every API endpoint must enforce authorization explicitly in the service layer.** This is the root cause of gaps G-04, G-08 and G-17.
- **Two data paths exist.** Most screens go through the Express API; `useChildren`, `useClasses`, `getClassStudents` and `authStore.initialize` query Supabase directly. Know which one you're changing.
- **`photos.s3_key` holds a Supabase Storage path**, not an S3 key. The column name is historical.
- **Do not add infrastructure.** BullMQ, Redis workers and the S3 client are being removed, not extended. Thumbnails are generated synchronously with `sharp`. See `docs/plans/00-INDEX.md` for the locked decisions.
- **Do not redesign the UI.** The design system is good. Plan 07 completes what's missing; it does not restyle what exists.
