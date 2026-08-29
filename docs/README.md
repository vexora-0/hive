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

---

## The submission

[`capstone/`](capstone/) holds the assessed deliverables - the report, the
summary, the user manual, the presentation slides, and the screenshots and
evidence captured while verifying the system.

---

## How the work was planned

Phase 1 built the application. Phase 2 opened with an audit that numbered every
outstanding defect, `G-01` to `G-46`, and split them across four developers with
a fixed file-ownership map and reserved migration numbers, so parallel work
could not collide. Those gap IDs are used throughout
[`security.md`](security.md) and [`PROGRESS-REPORT.md`](PROGRESS-REPORT.md);
which of them were actually closed, and which were not, is recorded in
[`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md) §2.

---

## Reading order

**Evaluating the project** - root README → `IMPLEMENTATION-STATUS.md` →
`architecture.md` → `security.md`.

**Joining the project** - root README → `environment-setup.md` →
`architecture.md` → `database.md`.

**Running the demo** - `environment-setup.md` → `DEMO_USERS.md` →
`user-flows.md`.
