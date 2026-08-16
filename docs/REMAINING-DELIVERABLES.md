# Remaining deliverables — capstone submission

**Internal working document. Delete before submitting for review**, along with
the rest of the process artefacts — see the cleanup section at the end, which
lists what must *not* be deleted with them.

**State as of 16 August 2026**, `689d9b9`. Every figure below was re-measured
that day against a running system rather than copied forward. Re-check anything
you are about to rely on; this file goes stale the same way the others did.

---

## 1. Where it stands

| Rubric section | Marks | State |
|---|---|---|
| Continuous evaluation | 20 | Evidence exists. Needs supervisor remarks — §2 below |
| Implementation | 30 | Complete and verified |
| Testing, validation & results | 15 | Strong. Performance is no longer empty — §3 |
| Documentation | 20 | Chapters written; **Word transfer outstanding** |
| Presentation, demo & viva | 15 | Drafted; **video + rehearsal outstanding** |

**Verified on 16 August, uncached:**

| Check | Result |
|---|---|
| `pnpm typecheck` | Clean, both packages |
| `pnpm lint` | **0 errors**, 6 warnings (3 backend, 3 mobile) |
| `pnpm build:backend` | Succeeds |
| Backend suite | **218 / 218 passed**, 8 files, **245 s** |
| Mobile suite | **100 / 100 passed**, 6 files, **281 ms** |
| k6 smoke, 1 VU / 30 s | 42/42 checks, **0.00% failures**, p95 **1.13 s**, feed page **3,908 B** |
| Endpoints | **40** — matches the claim exactly |
| Repository | **422 commits**, 4 contributors, 151 active days, 1 Feb – 16 Aug |

Assets already committed:

- `docs/capstone/screenshots/figures/` — **17 application figures**, all captured
  on a physical Android device (OnePlus CPH2487), 1240 px wide, status bar
  cropped
- `docs/capstone/evidence/` — k6 smoke, k6 load and both test-suite transcripts

---

## 2. Only Bhargav can do these

Roughly **40 `«»` placeholders** need a human. The other 35 are page numbers in
the Table of Contents, List of Figures and List of Tables — **Word generates
those**, do not fill them by hand.

| Where | Count | What is needed |
|---|---|---|
| `REPORT.md` §5.2 Weekly progress | 25 | Supervisor remarks, one per week |
| `REPORT.md` §5.3 Supervisor interaction | 3 | Review dates and feedback received |
| `REPORT.md` cover page | 3 | Name, roll number, institution |
| `REPORT.md` declaration | 2 | Signature, date |
| `PRESENTATION-15min.md` title slide | 2 | Name / roll number, supervisor |
| `REPORT.md` §4.4 + Appendix D | 1 | Demonstration video link |

Find them with:

```bash
grep -rn "«" docs/capstone/
```

---

## 3. Outstanding work, by what it needs

### 3a. Needs nothing but time — anyone can do these

| # | Task | Marks | Notes |
|---|---|---|---|
| 1 | **Transfer to the Word template** | 6 | Mechanical. `SUBMISSION-CHECKLIST.md` §8 is the step list. Figures captioned *beneath*, tables *above* |
| 2 | **Record the demo video** | — | Required by Report §4.4. Follow `docs/demo-script.md`. Doubles as insurance if the live demo fails |
| 3 | **Rehearse the demo twice with a timer** | 5 | Slide timings are in `PRESENTATION-15min.md` |
| 4 | **Render figures 2.1 and 2.3** | part of 7 | Mermaid sources already exist in `docs/architecture.md` and `docs/database.md`. This is a rendering job, not a design job |
| 5 | **Capture 6 terminal figures** | part of 7 | See 3b — the runs are the work, the screenshot is trivial |

### 3b. The six terminal figures

Content for two is already captured in `docs/capstone/evidence/`. The rest need a
live run against a working environment.

| Fig. | Command | Expected |
|---|---|---|
| 3.1 | `pnpm --filter @hive/backend test` | 218 / 218, 8 files |
| 3.2 | `scripts/verify-security.sh` | 27 passed, 0 failed, 2 skipped |
| 3.3 | Sabotage: delete `photo.uploaded_by === user.id` from `assertPhotoAccess`, re-run | Exactly 3 targeted tests fail |
| 3.5 | Signed feed URL, then the same URL with `?token=` stripped | 200, then 400 |
| 4.1 | `/health` reachable, then with the database unreachable | 200, then 503 `degraded` |
| 5.1 | `git log` / `git shortlog -sn` | 422 commits, 4 contributors |

**Figure 4.1 is awkward now.** The old capture stopped a *local* Supabase stack.
The project is on hosted Supabase, which cannot be stopped — so either point
`SUPABASE_URL` at an unreachable host and label the figure honestly, or re-run it
against a local stack. Do not fake it.

**`verify-security.sh` is worth re-running regardless.** The last full run was
11 August; `admin.service.ts` has changed since. Do not run it within ~15 minutes
of a k6 run — the rate-limit window will still be consumed and the rate-limit
check will fail spuriously.

### 3c. Needs an account, a dashboard or a card

| Task | Blocks | Effort |
|---|---|---|
| **Deploy the backend** | CP-5; the 2 remaining skips in `verify-security.sh` (HTTPS, CORS); any real capacity figure | Plan 09 Step 6 |
| **Build an APK** (`eas.json` does not exist) | CP-5 | Plan 09 |
| **Add 3 CI repository secrets** — `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_KEY`, `TEST_SUPABASE_ANON_KEY` | The test step is still `continue-on-error: true`, so 218 tests gate nothing on a pull request | **A settings page. Cheapest real win on this list** |
| **Sentry DSN** | Error pipeline has never carried an error | Account signup |
| **G-45 custom SMTP** | Supabase's default is rate-limited; OTP will fail mid-demo | Dashboard task, unowned |

### 3d. Known-open, documented, not blocking

- **No capacity figure.** The 50-VU k6 run was bound by the project's own
  per-identity rate limiter (2,657 × 429) and a misconfigured class id (492 ×
  403 — correct refusals). Neither is an application limit. A real number needs
  per-VU identities and a deployed target. Written up honestly in Report §3.3.6;
  **do not quote a throughput number from that run.**
- **iOS unverified**, and native `hive://` deep links with it. Android is done.
- **Migration `00017`'s comment** describes "a $4.99 print stored as `299.00`",
  which crosses two products — the July catalogue had `print_4x6` at 499 and
  `digital_download` at 299. Report §2.4.2 and `VIVA-PREP.md` both flag it. The
  migration itself is deliberately untouched (Srujan's, and applied to live
  databases).

---

## 4. Picking this up on another machine

**Nothing runs on a fresh clone.** Environment files are per-machine and
gitignored. This is the single most common way an hour disappears.

```bash
git clone https://github.com/vexora-0/hive.git && cd hive
pnpm install

cp packages/backend/.env.example      packages/backend/.env
cp apps/mobile/.env.example           apps/mobile/.env
cp packages/backend/.env.test.example packages/backend/.env.test
# then fill them — docs/environment-setup.md §2 explains which key goes where
```

Get the actual values from Bhargav; they are not in the repository and must not
be committed. `SUPABASE_ANON_KEY` is required in the **backend** env as well as
the mobile one — `verify-security.sh` cannot mint a user-scoped JWT without it,
and 13 of its checks silently skip if it is missing.

**Then:**

```bash
pnpm typecheck && pnpm lint && pnpm build:backend   # should be clean
cd packages/backend && node dist/index.js           # :4000
curl -s localhost:4000/health                       # expect database + cache ok
pnpm --filter @hive/mobile exec expo start --web    # :8081
```

**Tooling the figure work needs:** `k6` (`brew install k6`) for the load
profiles, and `adb` if you are recapturing device screenshots over USB.

**Before running the test suite**, check nothing else is running it —
`hive-test` is shared between CI and every developer:

```bash
pgrep -fl "vitest.mjs run"
```

Repeated runs exhaust the shared GoTrue sign-in quota; each run creates ~40 auth
users, and past the quota sign-ins stall rather than fail. **Every failure that
has ever been seen from this was a timeout, never a failed assertion.** A red run
straight after someone else's is the quota, not a regression — pause, then re-run
the failing file alone before believing it.

---

## 5. Do not break these

- **Do not quote money in dollars.** The catalogue is integer **paise**: a 4×6
  print is ₹30, so two is `total_cents: 6000` = **₹60**. The `*_cents` columns
  are named historically and hold paise. Every graded document said `$9.98`
  until 16 August.
- **Do not say the app has never run on a device.** It has, on Android. The
  report said otherwise in five places while Figure 2.7 showed it running.
- **Do not invent a performance number.** See §3d.
- **Do not claim 29/29 on the security script.** It is 27 passed, 0 failed,
  **2 skipped**.
- **Do not rewrite git history.** The commit log is graded evidence — Report
  Chapter 5, and 5 marks for attendance rest on 422 commits over 151 days.
  Commits follow the `Area: <area> (<Owner>)` convention, which decides author
  and committer; see `docs/design/REVAMP-HANDOFF.md`.

---

## 6. The pre-submission cleanup

Do this **last**, after the Word transfer, so you are not deleting files while
still copying out of them. An ordinary `git rm` commit — **not** a history
rewrite.

**Safe to remove** — internal process artefacts:

```
docs/plans/**
docs/design/REVAMP-HANDOFF.md
docs/01-PROJECT-AUDIT-AND-COMPLETION-PLAN.md
docs/02-FOUR-PERSON-DEVELOPMENT-AND-GIT-PLAN.md
docs/PHASE-2-EXECUTION-PLAN.md
docs/REMAINING-DELIVERABLES.md   ← this file
HANDOVER.md
ENV_handover.md
CLAUDE.md
```

**Must stay** — cited as evidence from the graded material, worth **10 of the 20
continuous-evaluation marks**:

| File | Cited for |
|---|---|
| `docs/PROGRESS-REPORT.md` | Task progress & timelines — 5 marks, "25 weekly entries" |
| `docs/IMPLEMENTATION-STATUS.md` | Communication & reporting — 5 marks |
| `docs/security.md` | same 5; also holds both `verify-security.sh` runs |
| `docs/architecture.md` | same 5; and the Figure 2.1 source |

Also referenced from the capstone set and therefore keep: `docs/demo-script.md`,
`docs/environment-setup.md`, `docs/DEMO_USERS.md`, `docs/database.md` (Figure 2.3
source), `docs/user-flows.md`, `docs/api.md`.

A file that exists only in git history is a file your supervisor will not find.

**`docs/README.md` indexes several files on the remove list — edit it, do not
delete it.** Then re-grep to confirm nothing dangles:

```bash
grep -rn "docs/plans\|REVAMP-HANDOFF\|HANDOVER\|PHASE-2-EXECUTION" docs/capstone/ docs/README.md
```
