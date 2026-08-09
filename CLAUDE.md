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

Every number below was re-run on 9 August rather than copied forward, at commit
`68721ae`. Other people's work was in flight in the tree at the time, so re-run
them yourself before relying on them:

| Check | Result |
|---|---|
| `pnpm typecheck` | Clean, both packages |
| `pnpm lint` | **0 errors**, 30 warnings — 3 backend (`no-explicit-any` in `admin.service.ts`), 27 mobile (mostly unused imports) |
| `pnpm build:backend` | Succeeds |
| `pnpm test` | **178 passed, 0 failed**, 8 files, against `hive-test` |
| `ls supabase/migrations` | **19 files** at `68721ae` — `00001`–`00018` and `00020`. `00019` was reserved and never used; the count is right, the sequence has a hole |

The suite has **one known flake**: `orders.test.ts > rejects setting a status
back to pending` fails intermittently in the full parallel run and passes when
`orders.test.ts` runs alone (26/26). It did not fire in the 9 August run. Treat
a lone red on that test as unproven, not as proof of a regression.

The environment works end to end; demo data seeds with photos, tags,
notifications and orders. G-01, G-02, G-04, G-05, G-07, G-08, G-17 and the
parent privacy boundary are confirmed at runtime — see
`docs/IMPLEMENTATION-STATUS.md` §4, and §5 for what is still unproven.

**9 August brought twelve fix commits** (`f426251..HEAD`, 56 files, +1495/−333)
across ordering, upload, auth, the admin console and the API error surface.
`docs/IMPLEMENTATION-STATUS.md` §10 records what each one was. **None of them
added a test** — the suite stood at 155 across all twelve — so that round is
guarded by nothing but review and typecheck.

`scripts/verify-security.sh` was run on 1 August — **26 passed, 0 failed, 3
skipped**. `docs/security.md` §9 records it, including the three skips and why
they are not interchangeable. It has **not** been re-run since the 9 August
changes, several of which touch the rate limiter, CORS and the error handler.

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
   secrets. Until then 178 passing tests still guard nothing on a pull request.
   Lint, typecheck and build are blocking.
3. **Nothing has been seen on a device.** Bundling proves imports resolve, not
   that screens render. Plan 04's mobile deep-link checks are still unticked,
   and the whole 9 August mobile round — auth cold start, sign-out, upload
   retry, notification badge — has only been typechecked.
4. **Sentry has never received an error**, and **G-45 custom SMTP** is unowned.
   Both are account signups rather than code changes.

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
