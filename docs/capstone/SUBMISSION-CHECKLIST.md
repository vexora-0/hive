# Capstone submission — checklist and evidence plan

Maps every rubric criterion to what exists and what is outstanding.
**100 marks.** Both institute templates have been read; the drafts in this
folder follow their exact structure.

| File | Follows |
|---|---|
| `REPORT.md` | `Document-format.docx` — 6 chapters, front matter, appendix |
| `PRESENTATION-15min.md` | `Capstone_Project_15_Min_Demo_Template.pptx` — 10 slides |
| `VIVA-PREP.md` | Q&A preparation |

---

## 1. Where the marks are

| Section | Marks | State |
|---|---|---|
| Continuous evaluation (supervisor) | 20 | Evidence exists — §2 |
| Implementation | 30 | Code complete and verified |
| Testing, validation & results | 15 | Strong except performance — §4 |
| **Documentation** | **20** | **Drafted; screenshots + template transfer outstanding** |
| **Presentation, demo & viva** | **15** | **Drafted; demo video + rehearsal outstanding** |

---

## 2. Continuous evaluation — 20 marks

Supervisor-assessed, but assessed *from evidence*. The paper trail here is
unusually strong; make sure the supervisor has actually seen it.

| Criterion | Marks | Point them at |
|---|---|---|
| Attendance & regularity | 5 | 429 commits over 151 active days, 1 Feb – 16 Aug, four contributors |
| Task progress & timelines | 5 | `docs/PROGRESS-REPORT.md` — 25 weekly entries |
| Ownership | 5 | Per-person plan ownership; `## Deviations` sections recording what differed and why |
| Communication & reporting | 5 | `IMPLEMENTATION-STATUS.md`, `security.md`, `architecture.md` |

⚠️ **Report §5.3 needs your records** — review dates and feedback received. Only
you have these.

---

## 3. Implementation — 30 marks

| Aspect | Marks | Evidence |
|---|---|---|
| Feature completeness | 10 | Three roles end to end; 40 endpoints; upload → tag → feed → order → notify |
| Functional correctness | 10 | Report Table 3.3 — order 201 with correct paise, idempotency, atomicity, notifications, privacy scoping |
| Code quality | 5 | TypeScript strict, Zod at every boundary, `pnpm lint` 0 errors, CI on every push |
| Tech stack | 5 | Report §2.2 — including what was *removed* and why |

**Strongest single talking point:** the BullMQ/S3 deletion. Removing ~1,500 lines
of never-executed infrastructure signals engineering judgement better than
adding a framework does.

---

## 4. Testing, validation & results — 15 marks

| Aspect | Marks | State |
|---|---|---|
| Test cases & coverage | 5 | **Strong** — 218 backend + 100 mobile, Table 3.2 has 37 documented cases |
| Result analysis | 5 | **Strong** — §3.3.7, the sabotage finding, and §3.3.8's seven device defects |
| Performance / reliability | 5 | ✅ **k6 executed 16 Aug against a local instance.** Smoke: 42/42 checks, 0.00% failures, p95 1.13 s, feed page **3,908 bytes** against a 2 MB threshold. See §3.3.6 |

⚠️ **The one soft spot in the submission.** Options, best first:

1. **Deploy, then run k6.** Converts the weakest criterion into a real result and
   simultaneously fixes Report §4.2.2 and three limitations.
2. **Run k6 against a local backend.** Not production, but it *is* a measurement.
   Label it honestly: "local, single instance, seeded dataset".
3. **Reframe reliability.** 503 on database loss, a 429 from the write limiter
   at request 98 (11 Aug), idempotency under retry, cold-start reproducibility —
   these *are* reliability results.

Do at least 2 or 3. Never invent numbers.

---

## 5. Documentation — 20 marks

| Aspect | Marks | State |
|---|---|---|
| Implementation & testing chapters | 7 | ✅ `REPORT.md` chapters 2 and 3, plus §3.3.8 device verification |
| Results, screenshots, tables | 7 | ✅ 14 tables; **all 16 numbered figures placed** — 17 application captures from a physical device (§4.3), 6 terminal transcripts, 4 diagrams. Outstanding: page numbers in the two lists, which can only be filled after pagination |
| Clarity, formatting, references | 6 | ⚠️ Transfer to Word + formatting — §8 |

---

## 6. Presentation, demo & viva — 15 marks

| Aspect | Marks | State |
|---|---|---|
| Technical explanation | 5 | ✅ Slides 1–6, 8–10 drafted |
| Live demo | 5 | ✅ Choreographed; **rehearse against a clock** |
| Q&A and confidence | 5 | ✅ `VIVA-PREP.md` |

⚠️ **Report Chapter 4.4 requires a demo video link.** Record the six-minute flow
from `docs/demo-script.md`. This doubles as insurance if the live demo fails.

---

## 7. Screenshots — 7 marks ride on this

Same window size, light mode, seeded data present, OS chrome cropped.
**Fabricate nothing** — these are results, and a doctored screenshot is worse
than a missing one.

### Application — Report figures 2.5–2.8

| Fig. | Screenshot | Shows |
|---|---|---|
| — | Login screen | Entry point, role selection |
| — | Teacher dashboard | Class-scoped view |
| 2.5 | Upload with student tagger open | The tagging gate |
| 2.6 | Parent feed — Rajesh, child switcher expanded | Two children — the many-to-many model |
| — | Feed after switching child | Different photos — scoping is live |
| — | Photo detail | Signed URL rendering, blurhash placeholder |
| 2.7 | Order detail sheet | **2 × ₹30 → ₹60** and **1 × ₹99 → ₹99**, total **₹159** — per-line arithmetic *and* the total, plus per-item signed thumbnails. Captured on a physical Android device |
| — | Order history with thumbnails | Signed per-item URLs |
| — | Notifications list | "New photo of Diya Kumar" — trigger-generated |
| 2.8 | Admin dashboard | Non-zero counts |

### Evidence — these carry the results marks

| Fig. | Screenshot | Shows |
|---|---|---|
| 3.1 | **`pnpm test` — 218/218** | Headline test result |
| 3.2 | **`verify-security.sh` — 27/0/2** | Security verification |
| 3.3 | **Sabotage run — 5 tests failing, 213 passing** | The suite detects regressions |
| 3.4 | **Rajesh's feed beside Vikram's** | 2 vs 1, zero overlap |
| 3.5 | **Signed URL 200 beside stripped-token 400** | Private bucket |
| — | Cross-school `curl` → **403** | G-08 |
| — | Order POST → **201**, `total_cents: 6000` — ₹60 | G-01 |
| — | Same idempotency key → same order ID | Idempotency |
| 4.1 | `/health` 200, then **503** on a second instance with the database unreachable | Degradation detected |
| 5.1 | Commit history | Version control evidence |
| 5.2 | GitHub Actions run **with its annotations** | CI exists and runs — **and** that the test step exits 1 on every run while `continue-on-error` shows it green. Do not crop to the green ticks; the contradiction is the evidence |
| 2.1 | Architecture diagram | Three tiers |
| 2.3 | ER diagram | Schema |

**The two side-by-side comparisons (3.4 and 3.5) are worth more than any single
shot.** They show the property, not just the feature.

---

## 8. Transfer to the Word template

Structure already matches; this is mechanical.

- [ ] Paste chapter by chapter into `Document-format.docx`
- [ ] Replace every `«…»` — name, roll number, institution, supervisor, dates,
      supervisor remarks, video link
- [ ] Insert figures with captions **beneath**; tables with captions **above**
- [ ] Update List of Figures and List of Tables after captioning
- [ ] Generate the Table of Contents from Heading styles
- [ ] Apply: Times New Roman · 12 pt body, 14 pt headings · 1.5 spacing ·
      1 inch margins · page numbers bottom-centre
- [ ] Export to **PDF**

**Chapter 1 note.** The template says problem identification and system design
come from the Study Project. Reuse your earlier submission where it is stronger
than the summary in `REPORT.md` §1.1–1.5; **keep §1.6**, which records the two
design changes made during implementation.

---

## 9. Priority order

1. **Capture the 23 screenshots** — 7 marks, mechanical, needs only a running
   instance
2. **Record the demo video** — required by Chapter 4.4, and it is your fallback
   if the live demo fails
3. **Transfer to the Word template and format** — 6 marks
4. **Produce a performance result** (§4) — currently the weakest criterion
5. **Rehearse the demo twice with a timer**
6. **Fill §5.3 and the supervisor remarks column** from your own records
7. **Send the supervisor a summary** linking §2's evidence

Items 1, 2 and 5 need nothing from anyone else.

---

## 10. Do not

- **Invent a performance number.** One unsourced figure discredits every sourced
  one, and a viva will find it.
- **Quote an order total in dollars.** The catalogue was re-priced in rupees on
  13 August (`d08fa4a`). A 4×6 print is ₹30, so 2 of them is `total_cents: 6000`
  = **₹60** — re-verified 16 Aug against a freshly built backend. Every graded
  document said `$9.98` / `998` until then, which a screenshot of the order sheet
  would have contradicted on the very figure that carries the correctness marks.
  The columns are still named `*_cents` and hold paise; §2.4.2 and `VIVA-PREP.md`
  both explain why, and a viva is likely to ask.
- **Claim 29/29 on the security script.** It is 27 passed, 0 failed, **2
  skipped** (11 Aug; 26/0/3 on 1 Aug). One skip needs a deployment (HTTPS); the
  other needs `FORCE_500_PATH` **and** `NODE_ENV=production`.
- **Say "fully working".** It works locally and on a physical Android device.
  Nothing is deployed, and iOS has never been launched.
- **Undersell the device testing.** It is no longer true that nothing has run on
  hardware, and the report said so in five places after it had stopped being
  true. Seven defects were found on the device — one of them, a root layout
  remounting 145 times into a blank screen, was unreachable by typecheck, test
  suite and browser alike. That is a *result*, not a caveat: Report §3.3.8.
  Saying "never run on a device" while showing an Android screenshot is worse
  than either statement alone.
- **Hide the limitations.** Report §6.3 and slide 9 state them deliberately.
  Volunteering them reads as judgement; being caught concealing one discounts
  everything else.
