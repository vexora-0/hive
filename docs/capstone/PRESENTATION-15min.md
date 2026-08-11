# Hive — 15-minute capstone presentation

**Slide content and timing.** Pour into the institute's
`Capstone_Project_15_Min_Demo_Template.pptx`; slide numbering here is indicative,
the *timing and content* are the part that matters.

**Budget: 15 minutes.** Roughly 6 minutes of explanation, 6 of live demo, 3 of
buffer and questions. The rubric splits this evenly — technical explanation (5),
live demo (5), Q&A (5) — so do not spend 12 minutes on slides and rush the demo.

> Full command-by-command demo choreography already exists in
> `docs/demo-script.md`. This file is the *presentation* wrapper around it.

---

## Slide 1 — Title (0:00–0:20)

**Hive — privacy-first photo sharing for preschools**
Your name · BITS ID · supervisor · date

Say only: *"Hive lets preschool teachers share classroom photos with parents,
where each parent sees only their own child."* Then move. Do not read the slide.

---

## Slide 2 — The problem (0:20–1:20)

A preschool wants to share classroom photos with parents. The naive solution is a
shared album — and it is unacceptable, because it shows every parent every
child's face.

**The requirement that defines the product:** a parent must see photos of their
own children and nothing else. Not "mostly"; not "unless they guess a URL".

Three consequences worth stating out loud, because they justify every design
choice that follows:

- Access control cannot be a UI concern — the client is not trustworthy
- Photo URLs cannot be public or guessable
- The rule is a **join** across families and tags, not a filter you can bolt on

---

## Slide 3 — What was built (1:20–2:20)

| | |
|---|---|
| Mobile | React Native / Expo — teacher, parent and admin experiences |
| API | 40 endpoints, Express + TypeScript |
| Database | PostgreSQL, 20 migrations, RLS + triggers |
| Storage | Private bucket, signed expiring URLs |
| Scale | 199 source files, ~28,000 lines, 367 commits, 4 contributors, 6 months |

Three roles: **teacher** uploads and tags · **parent** sees a scoped feed and
orders prints · **admin** manages schools, classes, students, users.

---

## Slide 4 — Architecture, and the one rule (2:20–3:40)

Show the three-tier diagram. Then spend most of this slide on one point, because
it is the thing an examiner will probe:

> **The API authenticates as the service role, which bypasses Row Level Security
> by design.** RLS protects only the queries the mobile app makes *directly*.
> Every API endpoint must therefore enforce authorization explicitly in the
> service layer.

Three of the audit's most serious findings traced to exactly this: code that
assumed RLS was covering it. Naming this unprompted demonstrates you understand
your own system's sharpest edge.

**Three layers, only two trusted:**

| Layer | Trusted? |
|---|---|
| `RoleGate` in the mobile app | **No** — UX only; removable in a modified build |
| `roleGuard` middleware | Yes — coarse role check |
| Ownership assertions in services | **Yes** — the real boundary |

---

## Slide 5 — My contribution (3:40–4:40)

*Adjust emphasis to your own examiner's expectations; be specific, not modest.*

Data layer: schema, migrations, validation, seed data. 70 commits.

Two worth describing, because in each the **diagnosis** was the work:

**The ordering contract.** Three layers disagreed three ways — snake_case vs
camelCase, three different product vocabularies, and cents vs dollars. A $4.99
print stored `299.00` and displayed **$299.00**. No order had ever been placed
successfully. Fixed with one shared catalogue, server-side pricing, and an
integer-cent migration.

**The seed script.** `seed.sql` had never worked — it inserted into `profiles`,
whose primary key references `auth.users`, which SQL cannot populate because
Supabase Auth owns password hashing. Replaced with an idempotent script that
creates identities through the Admin API and pushes photos through the
application's own image pipeline.

---

## Slide 6 — Engineering decisions (4:40–5:40)

Pick two. These are the strongest:

**What we deleted.** An asynchronous BullMQ + S3 thumbnailing pipeline was
removed entirely. A repository-wide search for queue `.add(` found only
`Set.add` — **neither queue was ever enqueued**, and both workers targeted S3
while files went to local disk. ~1,500 lines of dependency graph deleted in
favour of a synchronous `sharp` call taking 100–300 ms. *Infrastructure that is
never exercised is liability, not architecture.*

**404, not 403.** A parent requesting another family's photo gets **404**. A 403
would confirm the resource exists — a disclosure in itself. 403 is reserved for
the school boundary, where the caller already legitimately knows the school
exists.

---

## Slide 7 — Testing strategy (5:40–6:40)

**178 tests, 8 files, 178/178 passing in 115 s.**

Integration, not unit: Vitest + Supertest drive the **real Express app against a
real PostgreSQL** — the app boots, middleware runs, Postgres enforces its
constraints.

*Why:* the ordering defect is the argument. Every layer was internally consistent
and would have passed its own unit tests. Only a real HTTP request through real
middleware into a real database catches a mismatch **between** layers.

**Then: the sabotage exercise.** Deleted one line — the ownership check — and
re-ran. Exactly the 3 targeted tests failed, as intended. **And a similarly-named
test stayed green** — both its teachers were at different schools, so the school
check refused first and the ownership check never ran. That test had never tested
what its name claimed.

> Land this line: *"A passing suite proves nothing until you make it fail on
> purpose. When we did, it found a test that was lying to us."*

---

## Slide 8 — Security verification (6:40–7:20)

```
scripts/verify-security.sh    passed 26    failed 0    skipped 3
```

Reproduced **from cold** the next day — stack restarted, database truncated,
re-seeded — same result. A repeatable procedure, not a lucky reading.

The three skips need HTTPS and a deployed origin. **Say that they are skips, not
passes.** Claiming 29/29 is the kind of thing a viva finds.

---

## LIVE DEMO (7:20–13:00)

Full choreography is in `docs/demo-script.md`. Order, and why:

**1. Teacher uploads and tags (≈90 s).** Sign in as Sarita, upload, tag two
children, confirm. Note that tagging happens *before* confirm — the notification
trigger fires on the transition to `ready` and loops over tags that exist at that
moment. Reverse the order and every parent notification silently disappears.

**2. Parent feed (≈60 s).** Sign in as Rajesh. Two children, so the child
switcher is meaningful. Photos of his children only.

**3. THE PRIVACY PROOF (≈90 s) — the most important minute.** Do not skip under
time pressure; cut slide 6 instead.

- Rajesh (Bloom, two children) sees **2** of 6 photos
- Vikram (Little Stars) sees **1**
- **Zero overlap.** No parent sees all six
- Then the `curl`: Sarita asking for Little Stars' roster →
  **`403 "You do not have access to this school"`**; her own school → 200

**4. Signed URL (≈30 s).** Open a photo URL — 200. Strip `?token=` — **400**.
The bucket is private; only signed access works.

**5. Order (≈60 s).** Place an order. **201**, `total_cents: 998` for
2 × 499. Re-send the same idempotency key → **the same order**, not a duplicate.

**6. Admin (≈45 s).** Dashboard with real counts, schools, users.

---

## Slide 9 — Limitations, stated first (13:00–13:50)

**Volunteer these before you are asked.** An examiner who extracts a limitation
you concealed will discount everything else; one you name yourself reads as
judgement.

| Not done | Why |
|---|---|
| **Nothing is deployed** | No hosted URL or APK |
| **No performance figures** | k6 suite written; no target to run it against |
| **Never seen on a physical device** | Driven end to end in Chrome; iOS/Android unverified |
| **Sentry has never carried an error** | Needs a DSN — an account signup |
| **CI test step is advisory** | Repository secrets absent; lint/typecheck/build do block |

Then: *"Deployment is the first item of future work, because it is the single
step that unlocks the other four."*

---

## Slide 10 — What I would do next (13:50–14:30)

1. **Deploy** — unblocks HTTPS/CORS checks, k6, and device testing at once
2. **Physical device build** — keychain session, image picker, deep links
3. **Make the CI test step blocking** — add the three repository secrets
4. **HEIC and magic-byte rejection** — the paths no seed asset exercises

---

## Slide 11 — Close (14:30–15:00)

*"The privacy boundary is the product, and it holds under direct probing:
cross-family 404, cross-school 403, same-school 403 — verified over HTTP with
real tokens and reproduced from cold. What is not proven is anything requiring a
deployment, and I have been specific about which items those are."*

Stop talking. Take questions.

---

# Delivery notes

**Timing discipline.** If you are behind at 7:20, cut slide 6 and shorten slide
3 — never the privacy proof. The live demo is 5 marks; a slide about design
choices is part of another 5 you have already earned.

**The five sentences worth rehearsing verbatim:**

1. *"The API bypasses RLS by design, so every endpoint enforces authorization
   explicitly in the service layer."*
2. *"Rajesh sees two photos, Vikram sees one, and there is zero overlap."*
3. *"A passing suite proves nothing until you make it fail on purpose."*
4. *"Twenty-six passed, zero failed, three skipped — and the three are skips, not
   passes."*
5. *"Nothing is deployed, so there are no performance numbers. I would rather
   show none than invent them."*

**Have ready in tabs before you start:** backend running with `/health` green ·
mobile app signed out · a terminal for the `curl` probes · `verify-security.sh`
output already on screen · the ER diagram.

**If the live demo fails:** do not debug on stage past ~20 seconds. Say *"I have
a recording of this flow"* and continue. Record a screen capture of the full demo
beforehand and keep it open in a tab — the mark is for showing the system works,
not for the network cooperating.
