# Hive — Implementation Plans Index

**Source of truth for findings:** `docs/01-PROJECT-AUDIT-AND-COMPLETION-PLAN.md` (gap IDs `G-xx` refer to its §21 Master Gap Analysis)
**Execution model:** sequential — one plan at a time, verified and committed before the next begins.

---

## Locked decisions

These were decided before Plan 01 and must not be revisited mid-implementation. Changing one invalidates downstream plans.

| # | Decision | Choice | Affects |
|---|---|---|---|
| DEC-1 | Photo storage | **Supabase Storage, private bucket, signed URLs** | Plan 03, 05, 06, 09 |
| DEC-2 | Image processing | **Synchronous `sharp` in the upload request** — BullMQ deleted | Plan 03 |
| DEC-3 | Redis | **Kept, for idempotency middleware only** | Plan 02, 09 |
| DEC-4 | Product vocabulary | **DB's `print_4x6` set wins** (changing a CHECK on populated tables is riskier) | Plan 02 |
| DEC-5 | API casing | **camelCase** in all request/response bodies | Plan 02 |
| DEC-6 | Money unit | **Integer cents** everywhere; formatted to dollars only at render | Plan 02 |
| DEC-7 | Role vocabulary | **`teacher` / `parent` / `admin`** — `school_admin` removed entirely | Plan 01 |
| DEC-8 | Test runner | **Vitest + Supertest** (backend), Vitest (mobile logic only) | Plan 08 |
| DEC-9 | Hosting | **Render** (backend) + **Supabase** (DB/Auth/Storage) + **EAS** (mobile build) | Plan 09 |
| DEC-10 | Out of scope | Payments, push notifications, dark mode, tablet layouts, photo download, captions | Plan 10 (documented as future scope) |

---

## Plan sequence

| # | Plan | Closes | Size | Depends on |
|---|---|---|---|---|
| [01](./01-quick-wins.md) | Quick wins & credential hygiene | G-03, G-06, G-09, G-10, G-16, G-20, G-25, G-45 | S | — |
| [02](./02-contracts-and-data-model.md) | Contracts & data model | G-01, G-18, G-19, G-31, G-36, G-37 | M | 01 |
| [03](./03-storage-and-media.md) | Storage & media pipeline | G-02, G-12, G-13, G-24, G-42 | **L** | 01 |
| [04](./04-authorization.md) | Authorization & access control | G-04, G-05, G-08, G-17 | M | 03 (partial) |
| [05](./05-upload-correctness-and-perf.md) | Upload correctness & query perf | G-07, G-14, G-15, G-34, G-35 | M | 02, 03 |
| [06](./06-demo-data.md) | Demo data & seeding | G-11 | M | 02, 03 |
| [07](./07-ux-completion.md) | UX completion | G-26, G-27, G-28, G-29, G-30, G-32, G-33 | M | 02, 04 |
| [08](./08-testing.md) | Testing | G-21 (36 tests) | **L** | 01–07 |
| [09](./09-deployment-and-observability.md) | Deployment & observability | G-23, G-38, G-39 | M | 03, 08 |
| [10](./10-documentation.md) | Documentation & diagrams | G-22, G-43 | **L** | 01–09 |
| [11](./11-qa-and-demo.md) | QA, load testing & demo prep | — | M | all |

---

## Dependency graph

```
01 ──┬──► 02 ──┬──► 05 ──┐
     │         │         │
     └──► 03 ──┼──► 04 ──┼──► 07 ──► 08 ──► 09 ──► 10 ──► 11
               │         │
               └──► 06 ──┘
```

**Hard rules**
- **03 before 06** — the seed uploads photos; storage must exist first.
- **02 before 06** — the seed inserts orders; the product CHECK must be correct first.
- **03 before 09** — deploying local-disk storage produces a broken deployment.
- **02–07 before 08** — writing tests against code you are about to rewrite wastes the work.

---

## Per-plan working protocol

Every plan follows the same loop:

1. **Read** the plan top to bottom before touching code.
2. **Branch** — `git checkout -b <branch from the plan> develop`
3. **Implement** the steps in the given order. The order encodes dependencies.
4. **Verify** — run every check in the plan's Verification section. All must pass.
5. **Commit** using the plan's commit sequence. One logical change per commit.
6. **Merge** to `develop`. Confirm `pnpm typecheck && pnpm lint && pnpm build:backend` still pass.
7. **Tick** the plan's Done-when checklist. Only then start the next plan.

**If a plan turns out to be wrong** — the code doesn't match what the audit described, or a step is impossible — stop, record what differs at the bottom of the plan file under `## Deviations`, and adjust before continuing. Do not silently improvise; later plans depend on the stated end state.

---

## Progress tracker

| Plan | Branch | Status | Merged |
|---|---|---|---|
| 01 | `fix/quick-wins` | ☐ Not started | ☐ |
| 02 | `fix/order-contract` | ☐ Not started | ☐ |
| 03 | `security/private-photo-storage` | ☐ Not started | ☐ |
| 04 | `security/authorization` | ☐ Not started | ☐ |
| 05 | `fix/upload-and-feed` | ☐ Not started | ☐ |
| 06 | `feat/demo-seed` | ☐ Not started | ☐ |
| 07 | `feat/ux-completion` | ☐ Not started | ☐ |
| 08 | `test/suite` | ☐ Not started | ☐ |
| 09 | `ci/deploy` | ☐ Not started | ☐ |
| 10 | `docs/submission` | ☐ Not started | ☐ |
| 11 | `chore/qa` | ☐ Not started | ☐ |

---

## Migration number allocation

Sequential execution means no range reservation is needed, but numbers must not be reused. Allocate in plan order:

| Plan | Migrations |
|---|---|
| 02 | `00017_align_product_types.sql`, `00018_order_totals_cents.sql`, `00019_fix_fk_constraints.sql` |
| 03 | `00020_photos_bucket_private.sql` |
| 05 | — (no schema change) |
| 06 | — (seeding is a TS script, not a migration) |
| 07 | — |
| 09 | `00021_idempotent_policies.sql` if needed |

---

## Setup required before Plan 01

```bash
cd /home/ruthwikchikoti/Documents/bits/major-project/hive
pnpm install                 # node_modules is currently absent
git checkout -b develop      # develop does not yet exist
git push -u origin develop
```

Confirm the baseline builds before changing anything:
```bash
pnpm typecheck && pnpm lint && pnpm build:backend
```

If the baseline **fails**, record the failures in `docs/plans/BASELINE.md` first. You need to know which errors you inherited versus which you introduced.
