# Capstone submission — checklist and evidence plan

Maps every rubric criterion to what exists, what is missing, and who does it.
**100 marks total.**

---

## 1. Where the marks are, and where we stand

| Section | Marks | State |
|---|---|---|
| Continuous evaluation (supervisor) | 20 | Evidence exists — see §2 |
| Implementation | 30 | Code complete and verified |
| Testing, validation & results | 15 | Strong, except performance |
| **Documentation** | **20** | **Chapters drafted; screenshots outstanding** |
| **Presentation, demo & viva** | **15** | **Content drafted; rehearsal outstanding** |

The two bolded rows are where remaining effort pays best.

---

## 2. Continuous evaluation — 20 marks

Supervisor-assessed, but it is assessed *from evidence*. This project has an
unusually strong paper trail; make sure the supervisor has seen it.

| Criterion | Marks | Evidence to point at |
|---|---|---|
| Attendance & regularity | 5 | 367 commits, 1 Feb – 9 Aug, four contributors |
| Task progress & timelines | 5 | `docs/PROGRESS-REPORT.md` — weekly, W1 onward; `docs/PHASE-2-EXECUTION-PLAN.md` |
| Ownership | 5 | Per-person plan ownership; `## Deviations` sections recording what differed and why |
| Communication & reporting | 5 | `docs/IMPLEMENTATION-STATUS.md`, `docs/security.md`, `docs/architecture.md`, handover docs |

**Do:** send the supervisor a one-page summary linking these, rather than
assuming they will find them.

---

## 3. Implementation — 30 marks

| Aspect | Marks | Evidence |
|---|---|---|
| Feature completeness | 10 | Three roles end to end; 40 endpoints; upload → tag → feed → order → notify |
| Functional correctness | 10 | §5.5 of the report — order 201 with correct cents, idempotency, atomicity, notifications, privacy scoping |
| Code quality | 5 | TypeScript strict, Zod at every boundary, `pnpm lint` 0 errors, CI on every push |
| Tech stack | 5 | §4.2 — including what was *removed* (BullMQ/S3) and why |

**Strongest single talking point:** the BullMQ/S3 deletion. Removing ~1,500 lines
of never-executed infrastructure is a better signal of engineering judgement than
adding a framework.

---

## 4. Testing, validation & results — 15 marks

| Aspect | Marks | State |
|---|---|---|
| Test cases & coverage | 5 | **Strong** — 178 tests, 8 files, 178/178 in 115 s |
| Result analysis | 5 | **Strong** — §5.10, including the sabotage finding |
| Performance / reliability | 5 | **Weak** — no load figures; k6 never run |

⚠️ **The one soft spot in the whole submission.** Options, best first:

1. **Deploy and run k6.** Converts the weakest criterion into a real result.
   Highest value remaining action in the project.
2. **Run k6 against a local backend.** Not a production measurement, but it is
   a measurement — and honest labelling ("local, single instance") is fine.
3. **Present reliability instead.** 503 on database loss, 429 at request 77,
   idempotency under retry, cold-start reproducibility. These *are* reliability
   results; frame them as such.

Do at least option 2 or 3. Do not leave the section empty and do not invent
numbers.

---

## 5. Documentation — 20 marks

| Aspect | Marks | State |
|---|---|---|
| Implementation & testing chapters | 7 | ✅ `REPORT-implementation-and-testing.md` |
| Results, screenshots, tables | 7 | ⚠️ Tables done; **screenshots outstanding** — §7 below |
| Clarity, formatting, references | 6 | ⚠️ Needs the institute template — §8 |

---

## 6. Presentation, demo & viva — 15 marks

| Aspect | Marks | State |
|---|---|---|
| Technical explanation | 5 | ✅ `PRESENTATION-15min.md` |
| Live demo | 5 | ✅ Content ready; **rehearse against a clock** |
| Q&A and confidence | 5 | ✅ `VIVA-PREP.md` |

**Rehearse the demo at least twice with a timer**, and record one run as
insurance. If it breaks on the day, switch to the recording within 20 seconds
rather than debugging on stage.

---

## 7. Screenshots to capture — 7 marks ride on this

Capture at the same window size, light mode, with seeded demo data present.
Crop out the OS chrome. **Redact nothing that matters and fabricate nothing** —
these are results, and a doctored screenshot is worse than a missing one.

### Application

| # | Screenshot | Shows |
|---|---|---|
| 1 | Login screen | Entry point, role selection |
| 2 | Teacher dashboard | Class-scoped view |
| 3 | Upload with student tagger open | The tagging gate |
| 4 | Parent feed — Rajesh | Photos of his children |
| 5 | **Child switcher expanded** | Two children — the many-to-many model |
| 6 | Feed after switching child | Different photos — scoping is live |
| 7 | Photo detail | Signed URL rendering, blurhash placeholder |
| 8 | Order sheet with product picker | Pricing from the shared catalogue |
| 9 | Order confirmation | `$9.98` for 2 × $4.99 — correct cents |
| 10 | Order history with thumbnails | Signed per-item URLs |
| 11 | Notifications list | "New photo of Diya Kumar" — trigger-generated |
| 12 | Admin dashboard | Non-zero counts |

### Evidence — these carry the "results" marks

| # | Screenshot | Shows |
|---|---|---|
| 13 | **`pnpm test` — 178/178 passing, 115 s** | The headline test result |
| 14 | **`verify-security.sh` — 26/0/3** | Security verification |
| 15 | **Sabotage run — 3 targeted tests failing** | The suite detects regressions |
| 16 | Terminal: cross-school `curl` → **403** | G-08 |
| 17 | Terminal: signed URL 200, token stripped → **400** | G-02 |
| 18 | Terminal: order POST → **201**, `total_cents: 998` | G-01 |
| 19 | Terminal: same idempotency key → same order ID | Idempotency |
| 20 | `/health` 200, then **503** with database stopped | Degradation detected |
| 21 | GitHub Actions — green run | CI exists and runs |
| 22 | ER diagram | Schema |
| 23 | Architecture diagram | Three tiers |

**Two side-by-side comparisons are worth more than any single shot:**
Rajesh's feed next to Vikram's — 2 photos vs 1, zero overlap. And the signed URL
200 next to the stripped-token 400.

---

## 8. Blocked on missing templates

Three files referenced were **not present on this machine** — only
`Capstone-Rubrics.docx` was:

- `Document-format.docx` (and its duplicate) — report structure
- `Capstone_Project_15_Min_Demo_Template.pptx` — slide template

The drafted content is deliberately format-agnostic Markdown so it can be poured
in without rewriting. But **6 marks ride on "clarity, formatting, references"**,
which means matching the institute's required structure — chapter numbering,
front matter, citation style, figure and table captions.

**Re-share those files and the content can be mapped onto them directly.**

---

## 9. Priority order for remaining work

1. **Capture the 23 screenshots** (§7) — 7 marks, mechanical, needs a running
   instance and a couple of hours
2. **Get the report template** and pour the chapters in — 6 marks
3. **Produce a performance result** (§4, option 1/2/3) — 5 marks, currently the
   weakest criterion
4. **Rehearse the demo twice with a timer**, record one — 5 marks
5. **Send the supervisor a summary** linking the progress evidence — up to 20
   marks are assessed on impressions they form from it

Items 1 and 4 need nothing from anyone else and can start today.

---

## 10. Do not

- **Invent a performance number.** One unsourced figure discredits every sourced
  one, and a viva will find it.
- **Claim 29/29 on the security script.** It is 26 passed, 0 failed, **3
  skipped**.
- **Say "fully working".** It works locally. Nothing is deployed and nothing has
  run on a physical device.
- **Hide the limitations.** Volunteering them reads as judgement; being caught
  concealing them discounts everything else.
