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

**Plans are the source of truth.** They contain file paths, line numbers and exact fixes. Do not improvise a different approach — if a plan looks wrong, say so and record it under that plan's `## Deviations` section rather than silently doing something else.

---

## 3. Progress — updated 8 July

| Plan | Owner | Status |
|---|---|---|
| **00** typecheck | Bhargav | ✔ **Zero errors — the app compiles** |
| **01** quick wins | shared | ✔ Done (SMTP config outstanding — dashboard task) |
| **02** order contract | Srujan | ✔ Done |
| **03** storage & media | Ruthwik | ✔ Done |
| **04** authorization | Nagachaitanya | ✔ Done |
| **05** upload & feed perf | Ruthwik | ✔ Done except G-34 |
| **06** demo seed | Srujan | ☐ Not started — needs credentials to run |
| **07** UX completion | Bhargav | ☐ Not started |
| **08** tests | all four | ◐ Harness + 19 backend tests written |
| **09** deployment | Bhargav | ◐ Docker, CI, health, request IDs done; deploy outstanding |
| **10** docs | all four | ◐ Architecture done |
| **11** QA & load | all four | ◐ k6 suite written |

### Every P0 security and correctness gap is closed

| Gap | Was |
|---|---|
| G-02 | Every child's photo a public URL |
| G-01 | Orders failed with 400 — feature never worked |
| G-03 | Three "Coming Soon" screens |
| G-04 | Any parent could read any photo |
| G-05 | Parent could deep-link into the admin UI |
| G-06 | Dashboard always showed 0 orders |
| G-07 | Parents never notified of new photos |
| G-08/G-17 | Cross-school roster and photo access |
| G-09 | Admin UI offered a role the DB rejects |
| G-12 | No thumbnails — full-res originals to mobile |
| G-14 | Feed broke at scale (414) |
| G-16 | Filter injection in admin search |

### Still blocking

1. **No `.env` exists.** Migrations `00017` and `00020` are unapplied. **Nothing
   below has ever executed** — it compiles, and that is the whole claim.
2. **Plan 06** demo seed and **Plan 07** UX polish are unstarted.
3. **G-34** (`getSchools` N+1) still has no owner.

### Verified vs written

**Verified:** typecheck and build pass across both packages; lint clean except
three pre-existing `any` warnings; 22 mobile type errors reduced to 0.

**Written, never run:** private storage, signed URLs, thumbnails, HEIC
conversion, the feed join, upload confirm, the order contract, RoleGate, the
Docker image, CI, k6, and all 19 tests.

---

## 3a. Current state

**Phase 1 is complete** — the application is built: database schema with row level security, a 22-endpoint API, teacher upload with student tagging, a privacy-scoped parent feed, an admin console, and a full design system.

**Phase 2 is fixing what Phase 1 left broken.** The audit found 46 gaps. The most serious:

| Gap | Problem |
|---|---|
| **G-01** | Order submission is broken — client, validator and database disagree three ways. No order can be placed. |
| **G-02** | `/uploads` is served with no authentication. Every child's photo is a public URL. |
| **G-03** | ~700 lines of finished notification code is unimported; three screens show "Coming Soon". |
| **G-04, G-08** | Any parent can read any photo's metadata; any teacher can read another school's student roster. |
| **G-05** | No role-based route protection — a parent can deep-link into the admin UI. |
| **G-12** | No thumbnails are generated, so the feed serves full-resolution originals. |

**The mobile app does not currently compile** — 22 TypeScript errors. Until Bhargav's Plan 00 lands, nobody can verify anything.

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

Commitlint enforces conventional commits. Format:

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

- **The backend bypasses row level security.** Every service uses `supabaseAdmin`, created with the service-role key, which is exempt from RLS by design. The 505-line policy set in migration `00011` only protects the handful of queries the mobile app makes directly to Supabase. **Every API endpoint must enforce authorization explicitly in the service layer.** This is the root cause of gaps G-04, G-08 and G-17.
- **Two data paths exist.** Most screens go through the Express API; `useChildren`, `useClasses`, `getClassStudents` and `authStore.initialize` query Supabase directly. Know which one you're changing.
- **`photos.s3_key` holds a Supabase Storage path**, not an S3 key. The column name is historical.
- **Do not add infrastructure.** BullMQ, Redis workers and the S3 client are being removed, not extended. Thumbnails are generated synchronously with `sharp`. See `docs/plans/00-INDEX.md` for the locked decisions.
- **Do not redesign the UI.** The design system is good. Plan 07 completes what's missing; it does not restyle what exists.
