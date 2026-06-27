# Baseline — known-failing checks

Required by `docs/plans/00-INDEX.md` §"Setup required before Plan 01": *"If the
baseline fails, record the failures in `docs/plans/BASELINE.md` first. You need
to know which errors you inherited versus which you introduced."*

Measured on `main` at **`bcc9731`**, macOS, Node v26.4.0, pnpm 9.1.0.
**Re-measured 27 Jun at `19bd5c4`** (Plan 00 done), macOS, Node v22.21.1,
pnpm 9.1.0. The numbers below are the re-measured ones.

**Re-measure when main moves.** These numbers shifted three times across
W15–W17 as Plans 03, 05 and the deployment work landed, and twice more in
W20–W21. Treat them as a snapshot, not a contract.

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
| `pnpm --filter @hive/mobile typecheck` | **passes** — 0 errors *(was 15; Plan 00 done 27 Jun)* |
| `pnpm --filter @hive/backend lint` | **fails — 4 problems (1 error, 3 warnings)** |
| `pnpm --filter @hive/mobile lint` | passes — 38 warnings, 0 errors |
| `npx expo export --platform ios` | **passes** — bundles clean, 5.52 MB |

### CI: one failing gate left, and it is one rule

`.github/workflows/ci.yml` runs `pnpm lint`, both typechecks and
`pnpm build:backend`. Three of those four now pass. **The only remaining
failure is `pnpm lint`, on the single backend error below.** Fix it and the
gate goes green.

**A red `pnpm lint` run does not mean your change broke something** — check the
failing rule against the table below before investigating; only counts *higher*
than 4 problems are yours.

Once lint is green, the `continue-on-error` markers on the mobile typecheck and
lint steps should come off, so the pipeline starts actually gating.

### Mobile typecheck — 0 errors

Was 22, then 15, now clean.

- `8e4fc50` (Srujan) regenerated `apps/mobile/src/types/supabase.ts`, clearing
  seven of Plan 00's eight Group B errors — 22 → 15.
- `6c9078d`, `61a541b`, `732714a`, `edb3d2b` (Plan 00) cleared the rest — 15 → 0.
- `7e38b5c`, `7cbd74d`, `21510fa`, `19bd5c4` were the residual pass: green
  typecheck, wrong behaviour in four places. See `00-typecheck-fixes.md`
  `## Deviations`.

Two of the original errors were **real defects that broken types had been
masking**, not cosmetic: `ClassItem.grade` was declared non-null against a
nullable column, and `TabBar`'s `navigate()` carried `as never` casts that only
typechecked while the module was unresolvable.

### Backend lint — 1 error, 3 warnings

Inherited. One error is what makes lint exit non-zero:

| File | Line | Rule |
|---|---|---|
| `src/middleware/auth.ts` | 13:3 | `@typescript-eslint/no-namespace` |

*(This file has moved and shrunk since the baseline was written. It was
originally recorded as 2 errors / 5 warnings at `src/types/express.d.ts:13` and
`src/services/feed.service.ts:62`. The `AppError` refactor removed two
`no-explicit-any` warnings, and the dashboard revenue fix removed the
`prefer-const` error in `admin.service.ts`. Re-measured 27 Jun.)*

Unowned by any current plan and not risky. Worth folding into Plan 01 so the CI
lint gate can start passing — it is now a one-line fix away.

### Mobile lint — 38 warnings, 0 errors

Down one from 39: removing the dead `estimatedItemSize` prop from
`MasonryGrid` also removed the unused-variable warning its destructured default
was producing. The remaining 38 are inherited unused imports and `any` uses —
none of them block anything, and `pnpm --filter @hive/mobile lint` still exits 0.

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
pnpm --filter @hive/mobile  typecheck 2>&1 | grep -cE "^src/.*error TS"  # expect 0
pnpm --filter @hive/mobile  lint      2>&1 | grep -oE "[0-9]+ problems"  # expect 38 problems
pnpm --filter @hive/backend lint      2>&1 | grep -oE "[0-9]+ problems"  # expect 4 problems
```

Both typechecks are now clean, so **any** typecheck error is yours. Lint is the
only check still expected to fail, and only on the one inherited backend error.

Update the expected numbers here as plans land.
