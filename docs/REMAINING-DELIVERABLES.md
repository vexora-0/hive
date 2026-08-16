# Remaining deliverables — capstone submission

**Internal working document. Delete before submitting for review**, along with
the rest of the process artefacts — see the cleanup section at the end, which
lists what must *not* be deleted with them.

**State as of 16 August 2026.** Every figure below was re-measured that day
against a running system rather than copied forward. Re-check anything you are
about to rely on; this file goes stale the same way the others did.

**The report is now built as a formatted `.docx`.** One command regenerates it:

```bash
python3 build/make-report.py     # -> docs/capstone/Hive-Capstone-Report.docx
```

Times New Roman, 12 pt body, 14 pt headings, 1.5 spacing, 1 inch margins,
centred page numbers, generated table of contents, all 16 numbered figures
placed with captions beneath. Regenerate rather than editing the `.docx` by
hand — a hand edit is lost the next time anyone runs the build.

---

## 1. Where it stands

| Rubric section | Marks | State |
|---|---|---|
| Continuous evaluation | 20 | Evidence exists. Needs supervisor remarks — §2 below |
| Implementation | 30 | Complete and verified |
| Testing, validation & results | 15 | Strong. Performance is no longer empty — §3 |
| Documentation | 20 | Chapters written, figures placed, **`.docx` built and formatted**. Outstanding: placeholders and page numbers |
| Presentation, demo & viva | 15 | Drafted; **video + rehearsal outstanding** |

**Verified on 16 August, uncached:**

| Check | Result |
|---|---|
| `pnpm typecheck` | Clean, both packages |
| `pnpm lint` | **0 errors**, 6 warnings (3 backend, 3 mobile) |
| `pnpm build:backend` | Succeeds |
| Backend suite | **218 / 218 passed**, 8 files — **245 s** and again **122.63 s**; wall time is network-bound against a shared remote database, so it varies |
| Mobile suite | **100 / 100 passed**, 6 files, **284 ms** |
| k6 smoke, 1 VU / 30 s | 42/42 checks, **0.00% failures**, p95 **1.13 s**, feed page **3,908 B** |
| `verify-security.sh` | **27 passed, 0 failed, 2 skipped** — full run, re-run 16 Aug |
| Endpoints | **40** — matches the claim exactly |
| Repository | **~428 commits** and moving, 4 contributors, 151 active days, 1 Feb – 16 Aug |

**The commit count drifts every time anyone commits, including the commit that
corrects it.** `make-report.py` compares §5.1's stated count against the
repository on every build and warns when they disagree, because Figure 5.1 is a
capture *of* the repository and the document would otherwise contradict its own
picture. Snap it once, at the very end, and rebuild.

Assets already committed:

- `docs/capstone/screenshots/figures/` — **17 application figures**, all captured
  on a physical Android device (OnePlus CPH2487), 1240 px wide, status bar
  cropped
- `docs/capstone/evidence/` — k6 smoke, k6 load and both test-suite transcripts

---

## 2. Only Bhargav can do these

**34 `«»` placeholders** need a human. Of the rest: the 8 Table of Contents
entries are gone — pandoc generates a real contents page with real page numbers —
and the remaining 27 are the page columns in LIST OF FIGURES and LIST OF TABLES,
which cannot be filled until pagination is final. Read them off the generated
contents once the document is open in Word.

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
| 1 | **Fill the ~34 placeholders** | part of 6 | §2 above. 25 are the weekly supervisor remarks |
| 2 | **Record the demo video** | — | Required by Report §4.4. Follow `docs/demo-script.md`. Doubles as insurance if the live demo fails |
| 3 | **Rehearse the demo twice with a timer** | 5 | Slide timings are in `PRESENTATION-15min.md` |
| 4 | **Fill the figure/table page numbers** | part of 7 | Only possible once pagination is final. Open the built `.docx` in Word, update fields, read the page numbers off the generated contents, and type them into LIST OF FIGURES and LIST OF TABLES |
| 5 | **Export to PDF** | part of 6 | Last step |

### 3b. Evidence figures — all captured

All sixteen numbered figures are rendered and placed. Transcripts live in
`docs/capstone/evidence/` so any figure can be checked against the run that
produced it.

| Fig. | Source | Result captured |
|---|---|---|
| 3.1 | both test suites | 218 / 218 in 122.63 s · 100 / 100 in 284 ms |
| 3.2 | `scripts/verify-security.sh` | 27 passed, 0 failed, 2 skipped — full 67-line run |
| 3.3 | sabotage: delete the uploader comparison in `assertPhotoAccess` | **5 failed, 213 passed** — three G-17 cases plus archive and untag |
| 3.4 | Rajesh's feed beside Vikram's | 2 photographs vs 1, zero overlap |
| 3.5 | signed URL, then with `?token=` stripped | `HTTP/2 200` `image/jpeg` 42,497 B · `HTTP/2 400` |
| 4.1 | `/health` healthy, then a second instance with the database unreachable | 200 `ok` · 503 `degraded` |
| 5.1 | `git rev-list` / `git shortlog` | 428 commits, 4 contributors, 151 active days |
| 5.2 | `gh run list` / `gh run view --job` | green run **with its annotations** — see below |

**Capture transcripts, do not write them.** A review pass found two figures whose
output could not have come from the commands printed above them — the facts were
right, the pairing was not reproducible. Everything here is now literal stdout
piped to a file. If a figure needs re-taking, pipe the real command to the `.txt`
and re-render; do not retype it.

**Figure 4.1 needed a method change.** The original capture stopped a *local*
Supabase stack. The project is on hosted Supabase, which cannot be stopped, so a
second instance of the same build is booted on port 4100 with the database host
made unreachable. Genuine degradation, and the running instance is untouched.

**Figure 5.2 must keep its annotations.** The CI run reports green *and* its
annotations record `exit code 1` on the test step, because the harness guard
refuses without the `TEST_SUPABASE_*` repository secrets. Cropping to the green
ticks would make the figure a lie. See Report §6.3 item 5.

**Do not run `verify-security.sh` within ~15 minutes of a k6 run** — the
rate-limit window will still be consumed and that check fails spuriously.

### 3c. Needs an account, a dashboard or a card

| Task | Blocks | Effort |
|---|---|---|
| **Deploy the backend** | CP-5; the 2 remaining skips in `verify-security.sh` (HTTPS, CORS); any real capacity figure | Plan 09 Step 6 |
| **Build an APK** (`eas.json` does not exist) | CP-5 | Plan 09 |
| **Add 3 CI repository secrets** — `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_KEY`, `TEST_SUPABASE_ANON_KEY` | Worse than "ungated": without them the harness guard refuses, the step **exits 1 on every push**, and `continue-on-error: true` paints it green. Figure 5.2 shows both halves | **A settings page. Cheapest real win on this list, and it removes a limitation from the report** |
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
