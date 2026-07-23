# Documentation

Everything written about Hive, and where to start depending on what you want.

**If you read one file, make it [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md).**
It is the single source of truth for what exists, what runs, and what has only
been written. §4 lists what has actually been executed; §5 lists what has not.

---

## Getting it running

| Document | What it covers |
|---|---|
| [`../README.md`](../README.md) | Project overview, stack, quick start |
| [`environment-setup.md`](environment-setup.md) | Full setup — Supabase projects, keys, migrations, Redis, and the §7 verification checklist |
| [`DEMO_USERS.md`](DEMO_USERS.md) | Seeded accounts and the intended demo path |
| [`demo-script.md`](demo-script.md) | 8–10 minute walkthrough, the privacy proof, and the questions to expect |

---

## How it works

| Document | What it covers |
|---|---|
| [`architecture.md`](architecture.md) | System diagram, both data paths, request lifecycle |
| [`database.md`](database.md) | Schema, ER diagram, the ten tables |
| [`api.md`](api.md) | Endpoint reference |
| [`user-flows.md`](user-flows.md) | The three role journeys, and where each authorization boundary is enforced |
| [`security.md`](security.md) | Authorization model, threat notes, the deliberate 404-not-403 decisions |

---

## Status and process

| Document | What it covers |
|---|---|
| [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md) | **What is proven vs merely written.** Start here |
| [`PROGRESS-REPORT.md`](PROGRESS-REPORT.md) | Week-by-week record from Week 1 |
| [`plans/BASELINE.md`](plans/BASELINE.md) | Known-failing checks — compare before assuming you broke something |

---

## How the work was planned

These are evidence of method rather than reference material, and are kept
deliberately visible.

| Document | What it covers |
|---|---|
| [`01-PROJECT-AUDIT-AND-COMPLETION-PLAN.md`](01-PROJECT-AUDIT-AND-COMPLETION-PLAN.md) | The audit every plan derives from — 46 numbered gaps, `G-01`…`G-46` |
| [`02-FOUR-PERSON-DEVELOPMENT-AND-GIT-PLAN.md`](02-FOUR-PERSON-DEVELOPMENT-AND-GIT-PLAN.md) | File ownership map and conflict protocol |
| [`PHASE-2-EXECUTION-PLAN.md`](PHASE-2-EXECUTION-PLAN.md) | Week-by-week schedule, dependency graph, checkpoints |
| [`plans/00-INDEX.md`](plans/00-INDEX.md) | Plan index and locked technical decisions |

### The twelve plans

Each contains exact steps, files, verification and commit messages — and a
`## Deviations` section recording what actually differed, which is often the
more useful half.

| # | Plan | Covers |
|---|---|---|
| 00 | [Typecheck fixes](plans/00-typecheck-fixes.md) | The 22 errors that stopped the app compiling |
| 01 | [Quick wins](plans/01-quick-wins.md) | Eight small independent fixes |
| 02 | [Contracts & data model](plans/02-contracts-and-data-model.md) | The order contract — money as integer cents |
| 03 | [Storage & media](plans/03-storage-and-media.md) | Private bucket, signed URLs, thumbnails, HEIC |
| 04 | [Authorization](plans/04-authorization.md) | IDORs, role guards, ownership checks |
| 05 | [Upload correctness & perf](plans/05-upload-correctness-and-perf.md) | Tag-before-confirm ordering, feed N+1 |
| 06 | [Demo data](plans/06-demo-data.md) | Seed script and demo dataset |
| 07 | [UX completion](plans/07-ux-completion.md) | Toasts, confirm dialogs, empty states |
| 08 | [Testing](plans/08-testing.md) | Vitest + Supertest suite |
| 09 | [Deployment & observability](plans/09-deployment-and-observability.md) | Docker, CI, health check, request IDs, Sentry |
| 10 | [Documentation](plans/10-documentation.md) | This set of documents |
| 11 | [QA & demo](plans/11-qa-and-demo.md) | Load tests, manual QA, demo script |

---

## Reading order

**Evaluating the project** — root README → `IMPLEMENTATION-STATUS.md` →
`architecture.md` → `security.md` → the audit.

**Joining the project** — root README → `environment-setup.md` →
`plans/BASELINE.md` → `02-FOUR-PERSON-…` for ownership → your plan.

**Running the demo** — `environment-setup.md` → `DEMO_USERS.md` →
`user-flows.md`.
