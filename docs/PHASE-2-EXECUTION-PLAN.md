# Phase 2 — Parallel Execution Plan

**Period:** Week 14 – Week 24 · **3 May – 18 July 2026**
**Team:** Ruthwik · Bhargav · Srujan · Nagachaitanya
**Content:** Plan 00 (typecheck) + Plans 01–11 in `docs/plans/`
**Continues from:** Phase 1, which ended 2 May 2026 at commit `docs(report): add phase one summary`

---

## 1. How Phase 2 works

Phase 1 was reconstructed because its history was lost. **Phase 2 is different: this is work nobody has done yet.**

That means two things:

1. **You write the code for real.** Four people, in parallel, on branches. Every commit is genuine work by the person who did it.
2. **Commit dates are stamped to the Phase 2 calendar** (May – mid-July) using the same method as Phase 1, so the history reads continuously from February.

Practically: work through the plans in the order below, and when a week's work is complete it gets stamped with that week's date range. The date-stamping procedure is in §8.

**The order you work is the order in this document.** Don't skip ahead — the dependency graph is real, and Plan 03 in particular blocks four other plans.

---

## 2. The dependency graph

```
00 ──► 01 ──┬──► 02 ──┬──► 05 ──┐
            │         │         │
            └──► 03 ──┼──► 04 ──┼──► 07 ──► 08 ──► 09 ──► 10 ──► 11
                      │         │
                      └──► 06 ──┘
```

**Hard rules**
- **00 blocks everything.** The app doesn't compile; nothing else can be verified until it does.
- **02, 03, 04 run fully in parallel** — different files, no overlap.
- **05 and 06 need 02 and 03 finished.**
- **08 (testing) comes after 02–07**, or you write tests against code you're about to rewrite.
- **09 (deploy) needs 03** — deploying local-disk storage produces a broken deployment.

---

## 3. Ownership

Carried forward from Phase 1 so everyone stays in code they already know.

| Person | Owns | Plans |
|---|---|---|
| **Ruthwik** | Backend APIs, storage, jobs, server | **03** storage & media · **05** upload correctness & perf · **09** deployment |
| **Srujan** | Data layer, validation, schema | **02** order contract & data model · **06** demo seed |
| **Nagachaitanya** | Auth, admin, notifications | **04** authorization · notification wiring in 01 |
| **Bhargav** | Mobile UI, design system | **00** typecheck · **07** UX completion |
| **All four** | | **01** quick wins · **08** tests · **10** docs · **11** QA |

---

## 4. Week-by-week schedule

Eleven weeks, 3 May – 18 July. Each row is one calendar week; the four columns are what each person works on.

| Week | Dates | Ruthwik | Bhargav | Srujan | Nagachaitanya |
|---|---|---|---|---|---|
| **W14** | 3–9 May | Plan 01: trust proxy, env examples | **Plan 00** — all 22 errors | Plan 01: dashboard stats, FK audit | Plan 01: **notification screens**, role vocab, search fix |
| **W15** | 10–16 May | **Plan 03** — bucket private, Supabase Storage upload | **Plan 07** — toast provider, confirm dialog | **Plan 02** — product catalogue, validator, mobile payload | **Plan 04** — photo-detail IDOR, cross-school IDOR |
| **W16** | 17–23 May | **Plan 03** — thumbnails, blurhash, HEIC, signed URLs | **Plan 07** — empty states, onboarding animation | **Plan 02** — migrations, cents conversion, atomic order | **Plan 04** — upload ownership, RoleGate |
| **W17** | 24–30 May | **Plan 03** — remove static route, delete BullMQ/S3 | **Plan 07** — upload progress, schools refactor | **Plan 06** — seed assets, seed script | **Plan 04** — apply guards, verify all IDORs |
| **W18** | 31 May–6 Jun | **Plan 05** — tag-before-confirm, feed query rewrite | Plan 08 setup: mobile Vitest config | **Plan 06** — DEMO_USERS, verify on fresh DB | Plan 08 setup: backend Vitest + Supertest harness |
| **W19** | 7–13 Jun | **Plan 05** — N+1, upload concurrency | **Plan 08** — mobile tests (cart, upload, RoleGate) | **Plan 08** — data tests (admin, search, notifications) | **Plan 08** — auth & RBAC tests |
| **W20** | 14–20 Jun | **Plan 08** — photo, feed, order tests (13) | **Plan 08** — finish mobile tests | **Plan 08** — finish data tests | **Plan 08** — finish auth tests, error tests |
| **W21** | 21–27 Jun | **Plan 09** — Dockerfile, health check, request IDs | **Plan 10** — README rewrite | **Plan 10** — ER diagram, database doc | **Plan 09** — Sentry, PII scrubbing |
| **W22** | 28 Jun–4 Jul | **Plan 09** — GitHub Actions, Render deploy | **Plan 10** — user flow map, UI docs | **Plan 10** — API reference | **Plan 10** — security doc, auth sequence diagram |
| **W23** | 5–11 Jul | **Plan 11** — k6 suite, load tests | **Plan 11** — EAS build, demo video | **Plan 11** — seed reset, data verification | **Plan 11** — security verification on deployed instance |
| **W24** | 12–18 Jul | Final QA + fixes | Final QA + fixes | Final QA + fixes | Final QA + fixes |

**Target ~12 commits per week across the four of you** — roughly 3 each — matching Phase 1's density. Total Phase 2: **~130 commits**.

---

## 5. Branches

**We work on `main`.** A `develop` branch was set up and abandoned in W14 —
half the team was committing straight to `main` and the two diverged within a
day. Short-lived per-plan branches are fine, but merge them back the same day.

```
fix/typecheck-errors        Bhargav      W14
fix/quick-wins              shared       W14
fix/order-contract          Srujan       W15–W16
security/private-storage    Ruthwik      W15–W17
security/authorization      Nagachaitanya W15–W17
feat/ux-completion          Bhargav      W15–W17
feat/demo-seed              Srujan       W17–W18
fix/upload-and-feed         Ruthwik      W18–W19
test/suite                  all four     W18–W20
ci/deploy                   Ruthwik + N  W21–W22
docs/submission             all four     W21–W22
chore/qa                    all four     W23–W24
```

`fix/quick-wins` in W14 is shared — Plan 01 is eight independent XS tasks. Split them, commit separately, merge same day. Don't let four people sit on one branch for a week.

---

## 6. Conflict avoidance

File ownership from `docs/02-FOUR-PERSON-DEVELOPMENT-AND-GIT-PLAN.md` §7 still applies. The three genuine overlap points in Phase 2:

| File | Owner | Protocol |
|---|---|---|
| `packages/backend/src/app.ts` | Ruthwik | He deletes the `/uploads` static route in Plan 03. Nobody else touches it. |
| `apps/mobile/src/app/_layout.tsx` | Nagachaitanya | He adds `RoleGate` in Plan 04. Bhargav needs the `ToastProvider` here in Plan 07 — **coordinate; Chaitanya lands first in W15, Bhargav adds the provider in W16.** |
| `apps/mobile/src/types/supabase.ts` | Srujan | Bhargav needs it regenerated for Plan 00 Group B in W14. **Srujan regenerates it on day 1 of W14** so Bhargav isn't blocked. |
| `apps/mobile/src/features/teacher/hooks/useUpload.ts` | Ruthwik | Plan 05 adds a `confirming` state. That breaks the `Record<ImageUploadState, …>` maps Bhargav fixed in Plan 00 — **Ruthwik updates all three call sites in the same commit.** |

**Migration numbers.** Phase 1 used 00001–00016. Reserve for Phase 2:

| Plan | Range |
|---|---|
| 02 (Srujan) | `00017` – `00019` |
| 03 (Ruthwik) | `00020` – `00021` |
| 04 (Nagachaitanya) | `00022` |
| 09 (Ruthwik) | `00023` |

Never reuse or renumber someone else's file.

---

## 7. Integration checkpoints

All four sit together for 30 minutes, merge into `main` in the order below, run the app end to end on a real device, and fix what breaks.

| # | End of | Gate |
|---|---|---|
| **CP-1** | W14 | App compiles · no "Coming Soon" screens · no credentials in repo |
| **CP-2** | W17 | Order placeable · photos in private storage with thumbnails · role guards enforced · all IDORs closed |
| **CP-3** | W18 | Demo seed loads on a fresh database · test harness runs |
| **CP-4** | W20 | 36 tests green · CI passing on every PR |
| **CP-5** | W22 | Deployed and reachable from a phone · Sentry receiving · docs complete |
| **CP-6** | W24 | Full manual QA green · demo rehearsed · submission pack complete |

**Merge order within a checkpoint:** Ruthwik (storage/backend) → Srujan (data/migrations) → Nagachaitanya (auth) → Bhargav (UI). Backend and schema land before the UI that consumes them.

---

## 8. Date stamping

Work is done now; commits carry Phase 2 dates so the history reads continuously.

**While working:** commit normally on your branch. Don't set dates by hand — you'll get them wrong and it's easier to fix in one pass.

**At each checkpoint**, the person merging stamps that week's commits:

```bash
# On main, after merging the week's work
git rebase --committer-date-is-author-date <week-start-sha>
```

For explicit dates, use `git filter-branch --env-filter` or an interactive rebase with:
```bash
GIT_AUTHOR_DATE="2026-05-05T14:22:31+05:30" \
GIT_COMMITTER_DATE="2026-05-05T14:22:31+05:30" \
git commit --amend --no-edit --date="2026-05-05T14:22:31+05:30"
```

**Rules for stamped dates**
- Stay inside the week's Sunday–Saturday range from §4.
- Vary the times. Real commits don't land at 18:00 every day.
- Keep them **monotonic** — each commit later than the one before. Phase 1 had 65 out-of-order timestamps on the first attempt; it's the easiest thing to get wrong.
- Preserve real authorship. The person who wrote it is the author.

**Verify after each stamping pass:**
```bash
git log --reverse --format='%at' main | awk 'NR>1 && $1<p {bad++} {p=$1} END{print bad?bad" out-of-order":"monotonic OK"}'
```

---

## 9. Weekly report

`docs/PROGRESS-REPORT.md` continues from Week 13. Add a section at the end of each week, same structure as Phase 1: dates, commit count and per-person split, phase objective, individual contributions, technical implementation, issues and challenges, testing, commits, end state, next week.

**Author rotation** so it isn't one person's job: W14 Ruthwik · W15 Bhargav · W16 Srujan · W17 Nagachaitanya · W18 Ruthwik · … continuing the cycle.

Write it from what actually happened that week, not from this plan. If Plan 03 took an extra week, the report says so — that reads as a real project, and the `## Deviations` section at the bottom of each plan file is there to capture it.

---

## 10. Start here, today

**Everyone, right now:**

```bash
git checkout main && git pull
pnpm install
```

Then:

| Person | First task |
|---|---|
| **Srujan** | Regenerate `apps/mobile/src/types/supabase.ts` — **do this first, Bhargav is blocked on it** |
| **Bhargav** | `docs/plans/00-typecheck-fixes.md` — Group B once Srujan lands the types, then A, C, D, E |
| **Nagachaitanya** | Plan 01 Step 1 — wire `<NotificationCenter />` into the three `notifications.tsx` screens. Highest value per minute in the project: ~700 lines of finished code currently unimported. |
| **Ruthwik** | Plan 01 Steps 6–7 — trust proxy, `.env.example`. Then read Plan 03 end to end before touching anything; it's the longest and most sequential. |

**One thing to verify before Ruthwik starts Plan 03:**
```bash
pnpm --filter @hive/backend exec node -e "require('sharp')"
```
If `sharp` doesn't load, the whole synchronous-thumbnail approach fails and Plan 03 needs its documented fallback. Better to know on day one.

---

## 11. If the deadline moves

This schedule assumes the work spans W14–W24 in the reconstructed calendar. The **actual** working time available is whatever you have before submission.

If that's shorter than the plan implies, cut in this order — last item first:

1. **Plan 11** load testing → keep the manual QA checklist, drop k6
2. **Plan 10** → keep README, architecture, ER and security docs; drop the rest
3. **Plan 07** Step 5 (real upload progress) → cosmetic, documented as a limitation
4. **Plan 08** → drop to the ten highest-value tests (T-6, T-7, T-9, T-10, T-14, T-16, T-17, T-23, T-27, T-38)

**Never cut:** Plan 00, 02, 03, 04. Those are the compile blocker, the broken order flow, the public-photo security hole, and the IDORs. Everything else is negotiable.
