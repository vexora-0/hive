# Baseline — known-failing checks

Required by `docs/plans/00-INDEX.md` §"Setup required before Plan 01": *"If the
baseline fails, record the failures in `docs/plans/BASELINE.md` first. You need
to know which errors you inherited versus which you introduced."*

Measured on `main` at **`bcc9731`**, macOS, Node v26.4.0, pnpm 9.1.0.

**Re-measure when main moves.** These numbers shifted three times across
W15–W17 as Plans 03, 05 and the deployment work landed. Treat them as a
snapshot, not a contract.

---

## Read this before you measure anything

- **Run `pnpm install` after every pull.** Plan 03 removed three dependencies and
  rewrote 1505 lines of `pnpm-lock.yaml`. A stale `node_modules` silently changes
  the error count — during W15 the backend reported **4** errors against stale
  modules and **18** against correct ones. Measuring before installing will send
  you chasing the wrong problem.
- **pnpm is not installable via corepack on Node ≥25** — corepack is no longer
  bundled. Install the pinned version directly: `npm i -g pnpm@9.1.0`.
- **`@supabase/supabase-js` is pinned `^2.43.0` but resolves to `2.98.x`.** The
  gap matters: 2.98 types query results far more strictly than 2.43. Anything
  reasoning about Supabase types should check the *installed* version, not the
  manifest. This drift caused all 8 Group B typecheck errors. Pinning it exactly
  is a cheap way to stop it recurring.

---

## Current state

| Check | Result |
|---|---|
| `pnpm --filter @hive/backend typecheck` | **passes** — 0 errors |
| `pnpm build:backend` | **passes** |
| `pnpm --filter @hive/mobile typecheck` | **fails — 15 errors** |
| `pnpm --filter @hive/backend lint` | **fails — 7 problems (2 errors, 5 warnings)** |
| `pnpm --filter @hive/mobile lint` | passes — 37 warnings, 0 errors |

### CI is red, and will stay red until Plan 00 lands

`.github/workflows/ci.yml` runs `pnpm lint`, both typechecks and
`pnpm build:backend`. Two of those four currently fail on `main` — mobile
typecheck (15 errors) and lint (2 backend errors). **A red run does not mean
your change broke something.** Check the failing step against the table above
before investigating; only counts *higher* than these are yours.

Two things would turn CI green, in this order:

1. **Plan 00** — clears the 15 mobile typecheck errors.
2. **The 2 backend lint errors below** — unowned, small, and the only thing
   between `pnpm lint` and a passing gate.

### Mobile typecheck — 15 errors

Was 22. The regenerated `apps/mobile/src/types/supabase.ts` (`8e4fc50`) cleared
seven of Plan 00's eight Group B errors; see that plan's `## Deviations` for why
the root cause was not what the plan assumed.

The 15 that remain are Plan 00's Groups A (6), C (3), D (2) and E (3), plus one
real `ClassItem` nullability mismatch that the `never` collapse had been masking.
All are described in `00-typecheck-fixes.md`, with a suggested order of work.

### Backend lint — 2 errors, 5 warnings

Inherited. The two errors are what make lint exit non-zero:

| File | Line | Rule |
|---|---|---|
| `src/types/express.d.ts` | 13:3 | `@typescript-eslint/no-namespace` |
| `src/services/feed.service.ts` | 62:7 | `prefer-const` (`tagQuery`) |

Both are unowned by any current plan and neither is risky. Worth folding into
Plan 01 so the CI lint gate can start passing.

### Formatting

`npx prettier --check` fails on **every Markdown file in the repo**, including
`CLAUDE.md` and all of `docs/plans/`. Markdown is not covered by `pnpm lint`
(which runs eslint per package over TS only) and there is no `.prettierignore`,
so this is cosmetic and pre-existing. CI does not check it. Don't reformat docs
alongside real changes — the diff buries the actual work.

---

## A note on backend typecheck

Backend typecheck and build are clean **now**, but were not for part of W15.
Commit `chore(deps): delete unreachable workers, S3 client and unused AWS
config` originally removed the AWS environment schema entries and dependencies
while leaving `config/s3.ts`, `utils/signedUrl.ts` and `jobs/` on disk still
importing them — 18 errors, and `pnpm build:backend` failed with them.

It was corrected by actually performing the deletions. Recorded here because the
failure mode is easy to repeat: **removing config or dependencies without
removing their consumers breaks the build for everyone**, and the commit message
described deletions the diff did not contain. Read the diff, not just the
message, when reviewing a cleanup commit. CI would now catch this on the PR.

---

## How to use this file

Install first, then compare against these numbers rather than expecting green.
Anything above them is yours.

```bash
pnpm install                                                             # REQUIRED after any pull
pnpm --filter @hive/backend typecheck                                    # expect clean
pnpm build:backend                                                       # expect clean
pnpm --filter @hive/mobile  typecheck 2>&1 | grep -cE "^src/.*error TS"  # expect 15
pnpm --filter @hive/mobile  lint      2>&1 | grep -oE "[0-9]+ problems"  # expect 37 problems
pnpm --filter @hive/backend lint      2>&1 | grep -oE "[0-9]+ problems"  # expect 7 problems
```

Update the expected numbers here as plans land.
