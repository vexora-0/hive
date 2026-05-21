# Baseline — inherited failures before Phase 2

Required by `docs/plans/00-INDEX.md` §"Setup required before Plan 01": *"If the
baseline fails, record the failures in `docs/plans/BASELINE.md` first. You need
to know which errors you inherited versus which you introduced."*

Measured on `develop` at `a459104` (Phase 1 end state), macOS, Node v26.4.0,
pnpm 9.1.0. Re-measure and update this file if the toolchain changes.

---

## Environment notes

Two things bite on a fresh clone:

- **pnpm is not installable via corepack on Node ≥25** — corepack is no longer
  bundled. Install the pinned version directly: `npm i -g pnpm@9.1.0`.
- **`@supabase/supabase-js` is pinned `^2.43.0` but resolves to `2.98.x`.** The
  gap matters: 2.98 has far stricter query-result typing than 2.43. Anything
  that reasons about Supabase types should check the *installed* version, not
  the manifest.

---

## `pnpm typecheck`

| Package | Result |
|---|---|
| `@hive/backend` | **passes** — 0 errors |
| `@hive/mobile` | **fails** — 22 errors |

The 22 mobile errors are enumerated and grouped in `docs/plans/00-typecheck-fixes.md`.

Group B (8 errors, Supabase rows resolving to `never`) was fixed ahead of Plan 00
by the `fix/supabase-types` branch, taking the count to **15**. See that plan's
`## Deviations` section. The remaining 15 are Groups A (6), C (3), D (2), E (3)
and one real `ClassItem` nullability mismatch that the `never` collapse had been
masking.

## `pnpm build:backend`

**Passes.**

## `pnpm lint`

**Fails** — `@hive/backend` exits 1.

| Package | Errors | Warnings |
|---|---|---|
| `@hive/backend` | 3 | 6 |
| `@hive/mobile` | 0 | 38 |

The three backend errors are what break the build; the rest are warnings.

| File | Line | Rule |
|---|---|---|
| `src/types/express.d.ts` | 13:3 | `@typescript-eslint/no-namespace` |
| `src/services/admin.service.ts` | 365:7 | `prefer-const` (`parentCounts`) |
| `src/services/feed.service.ts` | 62:7 | `prefer-const` (`tagQuery`) |

Two of the three are `--fix`-able. They are unowned by any current plan — worth
folding into Plan 01 (quick wins) so `pnpm lint` can become a merge gate.

## Formatting

`npx prettier --check` fails on **every Markdown file in the repo**, including
`CLAUDE.md` and all of `docs/plans/`. Markdown is not covered by `pnpm lint`
(which runs eslint per package over TS only) and there is no `.prettierignore`,
so this is cosmetic and pre-existing. Don't reformat docs in feature branches —
it produces large diffs that bury the real change.

---

## How to use this file

Before opening a PR, compare against the numbers above rather than expecting
green:

```bash
pnpm --filter @hive/mobile typecheck 2>&1 | grep -cE "^src/.*error TS"   # expect 15
pnpm --filter @hive/mobile lint      2>&1 | grep -oE "[0-9]+ problems"   # expect 38 problems
pnpm --filter @hive/backend typecheck                                    # expect clean
pnpm build:backend                                                       # expect clean
```

Anything above those counts is yours. Update the expected numbers here as plans
land.
