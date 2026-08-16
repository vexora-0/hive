# Hive — 15-minute capstone presentation

> **Mapped to `Capstone_Project_15_Min_Demo_Template.pptx`.** Ten slides, in the
> template's own order and headings. Content below goes on the slide; the
> *Say* lines are what you speak, not what you print.
>
> **`«…»` marks what only you can supply.**
>
> **Budget.** Slides 1–6 in 6 minutes, live demo 6 minutes, slides 8–10 in
> 2 minutes, 1 minute spare. The rubric splits this evenly — technical
> explanation 5, live demo 5, Q&A 5 — so do not spend twelve minutes on slides
> and rush the demo.
>
> Full demo choreography: `docs/demo-script.md`. Viva answers: `VIVA-PREP.md`.

---

## Slide 1 — Title (0:00–0:20)

**Hive — A Privacy-First Photo Sharing Platform for Preschools**

Presented by: «Your name — roll number»
Team members: Srujan · Ruthwik · Bhargav · Nagachaitanya
Under the guidance of: «Supervisor name»
BSc Computer Science (Online Mode) — 2025–2026

**Say:** *"Hive lets preschool teachers share classroom photos with parents,
where each parent sees only their own child."* Then move on. Do not read the
slide aloud.

---

## Slide 2 — Problem Statement (0:20–1:30)

**Background**
Preschools want to share daily classroom activity with parents. Photographs are
the natural medium.

**Gap in the existing system**
The obvious implementations all broadcast: a shared album, or a class messaging
group, shows **every child's face to every parent**. In a setting composed
entirely of minors, that is a safeguarding failure, not a usability complaint.

**Importance**
The requirement that defines the product: a parent must see photographs of their
own children **and nothing else** — not "mostly", and not "unless they guess an
identifier".

**Say:** the three consequences, because they justify every later design choice —
access control cannot live in the client; photo URLs cannot be public or
guessable; and visibility is a *join* across families and tags, not a filter you
apply afterwards.

---

## Slide 3 — Objectives & Scope (1:30–2:20)

**Objectives**
1. Teacher, parent and administrator experiences, end to end
2. Privacy boundary enforced server-side and **demonstrated** under probing
3. Photographs served only via signed, expiring URLs from a private store
4. Working print orders — correct money arithmetic, idempotent submission
5. Automated integration tests against a real database
6. Remediate the defects found by the project audit

**In scope**
Three role-based apps · REST API · relational schema with RLS and triggers ·
private storage · synchronous image processing · trigger-generated notifications ·
ordering · administration console · test suite · scripted security verification

**Out of scope**
Payments · push notifications · offline mode · video · multi-language · tablet
layouts

---

## Slide 4 — Existing System / Literature Review (2:20–3:20)

| Approach | How it shares | Limitation |
|---|---|---|
| **Shared album** (Google Photos, iCloud) | One album, all parents | No per-child scoping. Every parent sees every child |
| **Messaging group** (WhatsApp) | Broadcast to all | Same exposure, plus photos leave institutional control entirely |
| **Commercial platforms** (ClassDojo, Brightwheel, Tadpoles) | Per-child feeds | Solve the problem, but are closed, subscription-based, and hold the data off-site |

**The gap this project addresses**

The first two are unacceptable on privacy. The third is acceptable but
proprietary — and none is a *reference implementation* a school could self-host
or audit.

**Say — this is the slide that earns the "literature review" mark:** *"The
per-child scoping model is well established commercially. What is not published
is how you enforce it when your API layer legitimately bypasses row-level
security — which is the case for any service-role backend. That enforcement
model is what this project implements and verifies."*

Cite OWASP API Security Top 10 (2023), **API1 Broken Object Level Authorization**
— the category all four of this project's critical defects fall under. That
grounds the work in a recognised framework rather than in opinion.

---

## Slide 5 — Proposed System Architecture (3:20–4:40)

**System overview** — three tiers

```
React Native (Expo)  ──REST + JWT──▶  Express API (TypeScript)  ──▶  PostgreSQL
   role-scoped screens                authenticate → roleGuard →       20 migrations
                                      validate → service               RLS + triggers
                                              │
                                              └──▶ Private object store
                                                   signed, expiring URLs
```

**Module description**
Authentication & authorization · Photographs (upload, tag, process) · Feed
(privacy-scoped) · Ordering · Notifications (trigger-generated) · Administration

**Spend most of this slide on one point — an examiner will probe it:**

> **The API authenticates as the service role, which bypasses row-level security
> by design.** RLS therefore protects only the queries the mobile app makes
> *directly*. Every endpoint must enforce authorization **explicitly, in the
> service layer**.

Three of the audit's four critical findings trace to exactly this: code that
assumed RLS was covering it. Naming your system's sharpest edge unprompted is
worth more than any diagram.

**Three layers, only two trusted:**

| Layer | Trusted? |
|---|---|
| `RoleGate` in the mobile app | **No** — UX only; removable in a modified build |
| `roleGuard` middleware | Yes — coarse role check |
| Ownership assertions in services | **Yes** — the real boundary |

---

## Slide 6 — Tools & Technologies (4:40–5:30)

| | |
|---|---|
| **Language** | TypeScript 5.4 (strict) |
| **Frameworks** | React Native / Expo SDK 51 · Express 4.19 |
| **Database** | PostgreSQL 15 via Supabase — RLS, triggers, 20 migrations |
| **Storage** | Supabase Storage, private bucket, signed URLs |
| **Tools** | Zod · TanStack Query · Zustand · sharp · Redis · Vitest + Supertest · k6 · Docker · GitHub Actions · pnpm + Turborepo |

**Say — one decision, and make it the deletion:**

*"We removed an asynchronous BullMQ and S3 thumbnailing pipeline. A
repository-wide search for queue enqueue calls found none — neither queue had
ever been used, and both workers targeted S3 while files went to local disk. We
deleted about 1,500 lines in favour of a synchronous `sharp` call taking 100 to
300 milliseconds. Infrastructure that is never exercised is liability, not
architecture."*

---

## LIVE DEMO — maps to Slide 7, "Implementation / Demo" (5:30–11:30)

Put 3–4 screenshots on the slide as a fallback; run the demo live.

**1 · Teacher uploads and tags (≈90 s)**
Sign in as Sarita. Upload, tag two children, confirm.
**Say:** tagging happens *before* confirm — the notification trigger fires on the
transition to `ready` and iterates the tags existing at that instant. Reverse the
order and every parent notification silently disappears. That was a real defect.

**2 · Parent feed (≈60 s)**
Sign in as Rajesh. Two children, so the child switcher is meaningful. His
children's photographs only.

**3 · THE PRIVACY PROOF (≈90 s) — the most important ninety seconds**
Do not skip this under time pressure. Cut slide 6 instead.
- Rajesh (Bloom, two children) sees **2** of 6 photographs
- Vikram (Little Stars) sees **1**
- **Zero overlap.** No parent sees all six
- Then the terminal: Sarita requesting Little Stars' roster →
  **`403 "You do not have access to this school"`**; her own school → **200**

**4 · Signed URL (≈30 s)**
Open a photograph URL — **200**. Strip `?token=` — **400**. The bucket is
private; only signed access works.

**5 · Order (≈60 s)**
Place an order → **201**, `total_cents: 6000` for 2 × `print_4x6` at ₹30 —
**₹60**. Re-send the same idempotency key → **the same order**, not a duplicate.

**6 · Administration (≈45 s)**
Dashboard with real counts.

---

## Slide 8 — Results & Analysis (11:30–12:40)

**Output — verified at runtime, not by code review**

| Measurement | Result |
|---|---|
| Automated tests | **218 / 218 passing** (115 s was timed on the preceding 178-test suite) |
| Security verification | **27 passed · 0 failed · 2 skipped** — reproduced from cold |
| Privacy: 6 photographs | Rajesh sees **2**, Vikram **1**, **zero overlap** |
| Order placement | **201**, `total_cents: 6000` — **₹60**, integer paise |
| Idempotency | Same key twice → **the same order** |
| Atomicity | Invalid item → rejected, **no orphaned order** |
| Notifications | 16 generated, correct parents, correct child names |
| Signed URL | 200 signed · **400** with the token stripped |
| Health under database loss | **503 `degraded`** |

**The sabotage exercise — the result worth the most**

Deleted one line, the ownership check, and re-ran. **Exactly the 3 targeted tests
failed** — as intended. **And a similarly-named test stayed green:** both its
teachers were at *different* schools, so the school check refused first and the
ownership check never executed. It had never tested what its name claimed.

> **Say this verbatim:** *"A passing suite proves nothing until you make it fail
> on purpose. When we did, it found a test that was lying to us."*

**Performance:** none measured — see slide 9. Say it here rather than let it look
like an omission.

---

## Slide 9 — Challenges & Limitations (12:40–13:40)

**Technical challenges met**

- **The ordering contract** — field naming, product vocabulary and currency unit
  each disagreed across three layers. Every layer was internally consistent, so
  no unit test could have caught it. A **$2.99** digital download stored `299.00`
  and displayed as **$299.00** — a hundredfold overcharge. Fixed with one shared
  catalogue, server-side pricing, and an integer-minor-unit migration.
  *(The catalogue was later re-priced in rupees, which is why the demonstration
  shows ₹ — the columns are still named `*_cents` and now hold paise.)*
- **A guard that failed open** — the suite truncates every table; the guard meant
  to stop it running against the demo database compared a variable that was never
  set. Its own comment called it "deliberately loud and unconditional". It was
  neither.

**Limitations — volunteer these before you are asked**

| Not done | Why |
|---|---|
| **Not deployed** | No hosted URL, no app binary |
| **No capacity figure** | k6 *has* run locally — smoke passes every threshold, feed page 3,908 B. But at 50 VU the limit hit was our own rate limiter, not the app, so there is no unconstrained number |
| **iOS unverified; native deep links unverified** | Run end to end on a physical **Android** device — that is where seven defects were found (slide 8a). iOS not launched; `hive://` never opened through the OS |
| **Error reporting never carried an error** | Needs a DSN — an account signup |

**Say:** *"Deployment is the first item of future work, because it is the single
step that unlocks the other four."*

An examiner who extracts a concealed limitation discounts everything else. One
you name yourself reads as judgement.

---

## Slide 10 — Conclusion & Future Work (13:40–14:40)

**Conclusion**

The privacy boundary is the product, and it holds under direct probing:
cross-family **404**, cross-school **403**, same-school photograph mutation
**403** — verified over HTTP with real tokens and reproduced from a cold start.
218 integration tests run against a real database, and a sabotage exercise
confirmed they detect the regressions they target.

**Future work**

1. **Deploy** — unblocks the HTTPS and CORS checks, load tests and device testing
   at once
2. **Run the k6 suite** against that deployment
3. **iOS and Android builds** — keychain sessions, image picker, deep links
4. ~~Make the CI test step blocking~~ — done 16 Aug: 218 tests now gate a merge
5. Payments · push notifications · photograph search · retention policy

**Close on:** *"What is not proven is anything requiring a deployment, and I have
been specific about which items those are."* Then stop and take questions.

---

# Delivery notes

**Timing discipline.** Behind at 5:30? Cut slide 6 and shorten slide 3 — never
the privacy proof. The live demo is 5 marks; a slide about tooling is part of
another 5 you have already earned.

**Five sentences worth rehearsing verbatim**

1. *"The API bypasses RLS by design, so every endpoint enforces authorization
   explicitly in the service layer."*
2. *"Rajesh sees two photographs, Vikram sees one, and there is zero overlap."*
3. *"A passing suite proves nothing until you make it fail on purpose."*
4. *"Twenty-six passed, zero failed, three skipped — and the three are skips, not
   passes."*
5. *"Nothing is deployed, so there are no performance numbers. I would rather
   show none than invent them."*

**Open in tabs before you start**
Backend running with `/health` green · mobile app signed out · a terminal for the
`curl` probes · `verify-security.sh` output already on screen · the ER diagram ·
**the recorded demo**.

**If the demo breaks:** do not debug on stage past twenty seconds. Say *"I have a
recording of this flow"*, switch, and keep talking. The mark is for showing the
system works, not for the network cooperating.

**Rehearse twice with a timer.** The most common failure in a 15-minute slot is
reaching the demo at minute twelve.
