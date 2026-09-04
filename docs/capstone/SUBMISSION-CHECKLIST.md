# Capstone submission - checklist and evidence plan

Maps every rubric criterion to what exists and what is outstanding.
**100 marks.** Both institute templates were read when these drafts were
written and the drafts follow their structure; whether the built deck uses the
BITS standard template is unconfirmed, and item 9 of Section 11 records that.

**Section 11 carries the examiner's own twelve-item checklist**, which this file
predates. Read it first. Sections 1 to 10 are the rubric mapping.

Last checked against the repository on 29 August 2026.

| File | Follows |
|---|---|
| `REPORT.md` | `Document-format.docx` - 6 chapters, front matter, appendix. Built to `Hive-Capstone-Report.docx` |
| `PRESENTATION-15min.md` | `Capstone_Project_15_Min_Demo_Template.pptx` - 10 slides |
| `VIVA-PREP.md` | Q&A preparation |
| `SUMMARY.md` | The summary document with the unique value proposition - Section 11, item 2 |
| `SOURCE-CODE-LINK.txt` | The repository link in a plain text file - Section 11, item 4 |

---

## 1. Where the marks are

| Section | Marks | State |
|---|---|---|
| Continuous evaluation (supervisor) | 20 | Evidence exists - Section 2 |
| Implementation | 30 | Code complete and verified |
| Testing, validation & results | 15 | Strong except performance - Section 4 |
| **Documentation** | **20** | Screenshots captured and the report built to `Hive-Capstone-Report.docx`; **supervisor signature outstanding** |
| **Presentation, demo & viva** | **15** | Slides drafted, demo video recorded; **rehearsal and the BITS template check outstanding** |

---

## 2. Continuous evaluation - 20 marks

Supervisor-assessed, but assessed *from evidence*. The paper trail here is
unusually strong; make sure the supervisor has actually seen it.

| Criterion | Marks | Point them at |
|---|---|---|
| Attendance & regularity | 5 | 461 commits over 154 active days, 1 February to 20 August 2026, four contributors - counted at `3156632`, 25 Aug |
| Task progress & timelines | 5 | `docs/PROGRESS-REPORT.md` - 25 weekly entries |
| Ownership | 5 | Per-person plan ownership; `## Deviations` sections recording what differed and why |
| Communication & reporting | 5 | `IMPLEMENTATION-STATUS.md`, `security.md`, `architecture.md` |

⚠️ **Report Section 5.3 needs your records** - review dates and feedback
received. Only you have these.

---

## 3. Implementation - 30 marks

| Aspect | Marks | Evidence |
|---|---|---|
| Feature completeness | 10 | Three roles end to end; 42 endpoint registrations across 7 domains; upload → tag → feed → diary → order → notify |
| Functional correctness | 10 | Report Table 3.3 - order 201 with correct paise, idempotency, atomicity, notifications, privacy scoping |
| Code quality | 5 | TypeScript strict, Zod at every boundary, `pnpm lint` 0 errors, and CI that blocks on lint, typecheck, build **and 247 tests**, with no step allowed to fail |
| Tech stack | 5 | Report Section 2.2 - including what was *removed* and why |

**Strongest single talking point:** the BullMQ/S3 deletion. Removing ~1,500 lines
of never-executed infrastructure signals engineering judgement better than
adding a framework does.

---

## 4. Testing, validation & results - 15 marks

| Aspect | Marks | State |
|---|---|---|
| Test cases & coverage | 5 | **Strong** - 247 backend integration across 9 files + 117 mobile unit, 364 in all. Table 3.2 documents T-01 to T-44 with inputs, expected results and outcomes |
| Result analysis | 5 | **Strong** - Section 3.3.7, the sabotage finding, and Section 3.3.8's seven device defects |
| Performance / reliability | 5 | ✅ **k6 executed 16 Aug against a local instance.** Smoke: 42/42 checks, 0.00% failures, p95 1.13 s, feed page **3,908 bytes** against a 2 MB threshold. See Section 3.3.6 |

⚠️ **The one soft spot in the submission.** Options, best first:

1. ~~**Deploy, then run k6.**~~ **Ruled out.** Not deploying is a decision, and
   Report Section 4.2.2 records it as one. That closes this option rather than
   leaving it outstanding.
2. **Run k6 against a local backend.** ✅ Done, 16 Aug. Not production, but it
   *is* a measurement, and it is labelled "local, single instance, seeded
   dataset" everywhere it appears.
3. **Reframe reliability.** ✅ Available and used. 503 on database loss, a 429
   from the write limiter at request 98 (11 Aug), 485 ms rather than a hang with
   Redis stopped, idempotency under retry, cold-start reproducibility - these
   *are* reliability results.

2 is done and 3 is used. The honest ceiling here is a local measurement plus
reliability results, and that is exactly what the report claims. Never invent
numbers.

---

## 5. Documentation - 20 marks

| Aspect | Marks | State |
|---|---|---|
| Implementation & testing chapters | 7 | ✅ `REPORT.md` chapters 2 and 3, plus Section 3.3.8 device verification |
| Results, screenshots, tables | 7 | ✅ 16 tables; **all 16 numbered figures placed** - 17 application captures from a physical device, re-taken 24 Aug against the current build including two of the diary (Section 4.3), 7 terminal transcripts, 4 diagrams. Outstanding: page numbers in the two lists, which can only be filled after pagination |
| Clarity, formatting, references | 6 | ✅ Transferred and formatted - `Hive-Capstone-Report.docx`, built 28 Aug. Section 8 |

---

## 6. Presentation, demo & viva - 15 marks

| Aspect | Marks | State |
|---|---|---|
| Technical explanation | 5 | ✅ Slides 1-6, 8-10 drafted |
| Live demo | 5 | ✅ Choreographed; **rehearse against a clock** |
| Q&A and confidence | 5 | ✅ `VIVA-PREP.md` |

✅ **Report Section 4.4 carries the demonstration video link:**
https://youtu.be/rOvrgbP5F4o. It covers teacher upload and tagging, the parent
feed, the privacy comparison between two parents at different schools,
signed-URL behaviour, order placement and the administration dashboard. Keep it
open during the viva - it is the fallback if the live demo fails.

---

## 7. Screenshots - 7 marks ride on this

✅ **Captured.** The whole set was re-taken on 24 August against the current
build, on a physical Android device against the local API, and lives in
`docs/capstone/screenshots/figures/`. Two earlier captures from 16 August are
kept and labelled as such in Report Table 4.2. Terminal evidence is in
`docs/capstone/evidence/`.

The rules they were captured under, for anything re-shot: same window size,
light mode, seeded data present, OS chrome cropped. **Fabricate nothing** -
these are results, and a doctored screenshot is worse than a missing one.

### Application - Report figures 2.5-2.8

| Fig. | Screenshot | Shows |
|---|---|---|
| - | Login screen | Entry point, role selection |
| - | Teacher dashboard | Class-scoped view |
| 2.5 | Upload with student tagger open | The tagging gate |
| 2.6 | Parent feed - Rajesh, child switcher expanded | Two children - the many-to-many model |
| - | Feed after switching child | Different photos - scoping is live |
| - | Photo detail | Signed URL rendering, blurhash placeholder |
| 2.7 | Order detail sheet | **2 × ₹30 → ₹60** and **1 × ₹99 → ₹99**, total **₹159** - per-line arithmetic *and* the total, plus per-item signed thumbnails. Captured on a physical Android device |
| - | Order history with thumbnails | Signed per-item URLs |
| - | Notifications list | "New photo of Diya Kumar" - trigger-generated |
| - | Diary, the parent landing tab | One child's journey since the first photograph, month by month |
| - | Diary month expanded | Day entries with times and the teacher who posted |
| 2.8 | Admin dashboard | Non-zero counts |

### Evidence - these carry the results marks

| Fig. | Screenshot | Shows |
|---|---|---|
| 3.1 | **`pnpm test` - 247/247 across 9 files, plus 117 mobile unit** | Headline test result |
| 3.2 | **`verify-security.sh` - 29/0/1** | Security verification |
| 3.3 | **Sabotage run - 5 tests failing, 242 passing** | The suite detects regressions |
| 3.4 | **Rajesh's feed beside Vikram's** | 2 vs 1, zero overlap |
| 3.5 | **Signed URL 200 beside stripped-token 400** | Private bucket |
| - | Cross-school `curl` → **403** | G-08 |
| - | Order POST → **201**, `total_cents: 6000` - ₹60 | G-01 |
| - | Same idempotency key → same order ID | Idempotency |
| 4.1 | `/health` 200, then **503** on a second instance with the database unreachable | Degradation detected |
| 5.1 | Commit history | Version control evidence |
| 5.2 | GitHub Actions - all four checks green | Lint, typecheck, build and **247 tests** now block a merge, with no step allowed to fail. The tick beside `Test backend` means the suite passed, which it did not before 16 Aug |
| 2.1 | Architecture diagram | Three tiers |
| 2.3 | ER diagram | Schema |

**The two side-by-side comparisons (3.4 and 3.5) are worth more than any single
shot.** They show the property, not just the feature.

---

## 8. Transfer to the Word template

✅ **Done.** The report is built to `docs/capstone/Hive-Capstone-Report.docx`
(28 August) from `REPORT.md`. What the build covered:

- [x] Chapter by chapter into `Document-format.docx`
- [x] Replace every `«…»` - name, roll number, institution, supervisor, dates,
      supervisor remarks, video link
- [x] Insert figures with captions **beneath**; tables with captions **above**
- [x] Update List of Figures and List of Tables after captioning
- [x] Generate the Table of Contents from Heading styles
- [x] Apply: Times New Roman · 12 pt body, 14 pt headings · 1.5 spacing ·
      1 inch margins · page numbers bottom-centre
- [ ] **Supervisor signature** - not obtained. The examiner states the viva will
      not be conducted without a signed final report. This is the single
      blocking item in the whole submission
- [ ] Export the signed document to **PDF**

**Chapter 1 note.** The template says problem identification and system design
come from the Study Project. Reuse your earlier submission where it is stronger
than the summary in `REPORT.md` Section 1.1-1.5; **keep Section 1.6**, which
records the two design changes made during implementation.

---

## 9. Priority order

Screenshots, the demo video, the Word build and a local performance result are
all done. What is left, in the order it blocks the viva:

1. **Get the report signed** - the viva does not happen without it. Everything
   else on this list is recoverable; this one is not
2. **Run the plagiarism check** over both the document and the code, and keep
   the report - Section 11, item 6, and nothing has started
3. **Finish `SUMMARY.md` and `USER-MANUAL.md`**, then put them in the Drive
   folder - Section 11, items 2 and 7
4. **Produce the code zip** from a clean tree - Section 11, item 3
5. **Confirm the deck is on the BITS standard template**, or rebuild it on one -
   Section 11, item 9. The template file is not in this repository
6. **Rehearse the demo twice with a timer**
7. **Finish the marketing videos and posters** - Section 11, items 11 and 12
8. **Share the Drive links publicly and email them with a description of each** -
   the examiner's closing instruction, at the end of Section 11

Items 4 and 6 need nothing from anyone else.

---

## 10. Do not

- **Invent a performance number.** One unsourced figure discredits every sourced
  one, and a viva will find it.
- **Quote an order total in dollars.** The catalogue was re-priced in rupees on
  13 August (`d08fa4a`). A 4×6 print is ₹30, so 2 of them is `total_cents: 6000`
  = **₹60** - re-verified 16 Aug against a freshly built backend. Every graded
  document said `$9.98` / `998` until then, which a screenshot of the order sheet
  would have contradicted on the very figure that carries the correctness marks.
  The columns are still named `*_cents` and hold paise; Section 2.4.2 and `VIVA-PREP.md`
  both explain why, and a viva is likely to ask.
- **Claim 30/30 on the security script.** It is 29 passed, 0 failed, **1
  skipped** (16 Aug; 27/0/2 on 11 Aug, 26/0/3 on 1 Aug). The remaining skip is
  HTTPS, and it needs a deployment - nothing else will close it.
- **Say "fully working".** It works locally, on a physical Android device, and -
  since 16 August - on a physical iPhone. Nothing is deployed, and the iOS run
  was through Expo Go rather than a standalone build, with nothing captured.
- **Call the absence of a deployment an oversight.** It is a decision, recorded
  in Report Section 4.2.2. Say what follows from it instead: the HTTPS check
  stays skipped, the k6 figures stay local, and there is no capacity number. Say
  also what does exist - a container image built on every push, with CI running
  the full suite against it, so the artefact that *would* be deployed is built
  and verified.
- **Quote 218 or 178 as the test count**, or 22, 31 or 40 as the endpoint count.
  It is **247 backend integration tests across 9 files, 117 mobile unit tests,
  364 in all**, and **42 endpoint registrations across 7 domains**. The smaller
  figures are real but historical, and several documents carried them for weeks
  after they stopped being true.
- **Overstate the iOS run.** It is real and it covered all three roles, but it
  is an *observed pass*: no recording, no screenshots, no retained log, so it
  contributes no figure to Section 4.3 and nothing fails if it regresses. It also ran
  inside Expo Go's container, so the native paths executed under Expo Go's
  bundle identifier, not the application's. Android remains the substantial
  device evidence. If asked which platform is properly verified, the answer is
  Android.
- **Undersell the device testing.** It is no longer true that nothing has run on
  hardware, and the report said so in five places after it had stopped being
  true. Seven defects were found on the device - one of them, a root layout
  remounting 145 times into a blank screen, was unreachable by typecheck, test
  suite and browser alike. That is a *result*, not a caveat: Report Section 3.3.8.
  Saying "never run on a device" while showing an Android screenshot is worse
  than either statement alone.
- **Hide the limitations.** Report Section 6.3 and slide 9 state them deliberately.
  Volunteering them reads as judgement; being caught concealing one discounts
  everything else.

---

## 11. The examiner's twelve-item checklist

Issued after the rest of this file was written, so this section is the one that
governs. Status is what is true on 29 August 2026, not what we intend.

| # | Item | Status | Where it is |
|---|---|---|---|
| 1 | Signed final report | ⛔ **Built, not signed** | `docs/capstone/Hive-Capstone-Report.docx` |
| 2 | Summary document with a unique value proposition, on Drive | ✅ Written | `docs/capstone/SUMMARY.md`, rendered to `Hive-Summary.docx`. Not yet uploaded to Drive |
| 3 | Code submission as a zip in the Drive folder | ⬜ Not started | To be produced from a clean tree |
| 4 | Source code link in a txt file | ✅ Done | `docs/capstone/SOURCE-CODE-LINK.txt` |
| 5 | Test cases and validation reports in the final documentation | ✅ Done | Report Chapter 3; Table 3.2 carries T-01 to T-44 |
| 6 | Plagiarism compliance, document **and** code | ⬜ **Not started** | Needs a tool run. Our own action |
| 7 | User manual | ✅ Written | `docs/capstone/USER-MANUAL.md`, rendered to `Hive-User-Manual.docx`. All three roles, 14 screenshots |
| 8 | Installation guide | ✅ Done | `README.md` "Getting started" and `docs/environment-setup.md` |
| 9 | Final presentation in the BITS standard template | ⚠️ **Open** | Content in `PRESENTATION-15min.md`; deck exists outside the repository |
| 10 | Demonstration video link | ✅ Done | https://youtu.be/rOvrgbP5F4o, in Report Section 4.4 |
| 11 | Marketing videos for social media | 🔄 In progress | Produced by the team outside the repository |
| 12 | Posters for social media | 🔄 In progress | Produced by the team outside the repository |

**Item 1 blocks everything.** The examiner states the viva will not be conducted
without a signed final report. The document is built; only the supervisor's
signature is missing, and no one on the team can supply it.

**Item 3.** Zip a clean tree - no `node_modules`, no build output, no `.env`
files of any kind. Verify the archive by extracting it somewhere else and
checking that no secret came with it.

**Item 5** is the strongest item here. Table 3.2 lists T-01 to T-44 with input,
expected result and outcome; Table 3.3 records runtime functional verification;
Table 3.4 records the security script at 29 passed, 0 failed, 1 skipped; and
Section 3.3.4 is the sabotage exercise, which is the evidence that the suite
detects the regressions it targets.

**Item 6 has not started**, and nothing in the repository substitutes for it.
Both the document and the code need a tool run, and the report kept.

**Item 7.** Report Appendix A already carries a short per-role manual. The
standalone `USER-MANUAL.md` expands it into something a parent or a teacher
could follow without the report open.

**Item 9 is open, and should be recorded as open rather than assumed.** The BITS
standard template file is not in this repository, so nobody has checked the deck
against it. Either confirm the deck was built on it, or rebuild it on one.

### The examiner's closing instruction

**Items 2, 3, 4, 10, 11 and 12 must be kept in the team's Drive as _public_
links, and sent by email with a description of each.** Two things follow from
that and are easy to get wrong: a Drive link that is not set to public reads to
the examiner as a missing submission, so check each one while signed out; and
the email needs a line describing every link, not a bare list of URLs.
