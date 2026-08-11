# Hive — Implementation and Testing

**Capstone report chapters 4 and 5**
Privacy-first photo sharing for preschools

---

> **How to use this file.** This is the *content* for the Implementation and
> Testing chapters, written to the rubric's four documentation criteria. It is
> deliberately format-agnostic Markdown so it can be poured into the institute's
> `Document-format.docx` template without rewriting. Headings map to numbered
> report sections; tables are already in final form.
>
> **Every number here is measured, not estimated.** Where a figure comes from a
> run on a specific date, the date is given. Where something was *not* verified,
> §5.7 says so rather than leaving the reader to assume. Provenance is stated
> throughout because an examiner who spot-checks one number and finds it invented
> will discount all of them.

---

# 4. Implementation

## 4.1 What the system does

Hive is a photo-sharing platform for preschools. A teacher photographs classroom
activity and tags the children who appear. Each parent then sees **only** the
photos their own children appear in — never the rest of the class. Parents can
order prints of those photos; an administrator manages schools, classes,
students and users.

The privacy rule is the product. A preschool photo app that shows every parent
every child is not a smaller version of this system; it is a different, and
unacceptable, one. That constraint drove the architecture, and §5.4 shows it
holding at runtime.

## 4.2 Technology stack and why

| Layer | Choice | Reason |
|---|---|---|
| Mobile | React Native (Expo, expo-router) | One codebase for iOS and Android; Expo removes native build tooling from the critical path |
| API | Node.js + Express + TypeScript | Team fluency; TypeScript catches contract drift between mobile and API at compile time |
| Database | PostgreSQL via Supabase | Relational integrity matters — the privacy rule is a join, not a filter |
| Auth | Supabase Auth (GoTrue) | Delegates password hashing, JWT issuance and session refresh rather than hand-rolling them |
| Storage | Supabase Storage, private bucket | Signed, expiring URLs; no object is publicly addressable |
| Image processing | `sharp`, synchronous in-request | ~100–300 ms per photo — imperceptible next to upload, and removes an entire class of "stuck in processing" failures |
| State (client) | Zustand + TanStack Query | Server state cached and invalidated separately from UI state |
| Validation | Zod at every route boundary | One schema defines both the runtime check and the TypeScript type |
| Tests | Vitest + Supertest | Runs the real Express app against a real Postgres — not mocks |

**A deliberate rejection.** An earlier design used BullMQ workers and an S3
client for asynchronous thumbnailing. Both were removed. A repository-wide search
for queue `.add(` calls found only `Set.add` — **neither queue was ever
enqueued**, and both workers targeted S3 while files were written to local disk.
Roughly 1,500 lines of dependency graph were deleted in favour of the synchronous
`sharp` call. Infrastructure that is never exercised is not architecture; it is
liability that still has to be reviewed, patched and explained.

## 4.3 System architecture

Three tiers, with one rule that shapes everything else.

```
┌──────────────────────────────────────────────────────────────┐
│  React Native (Expo)                                         │
│  role-scoped screens · Zustand · TanStack Query              │
└───────────────┬──────────────────────────┬───────────────────┘
                │ REST + JWT               │ direct (RLS-guarded)
                ▼                          ▼
┌──────────────────────────────────┐  ┌────────────────────────┐
│  Express API (TypeScript)        │  │  Supabase Auth         │
│  authenticate → roleGuard →      │  │  GoTrue: JWT, refresh  │
│  validate(Zod) → service         │  └────────────────────────┘
│                                  │
│  ownership checks in the service │──▶ Supabase Storage
│  layer — see 4.4                 │    private bucket,
└───────────────┬──────────────────┘    signed URLs only
                ▼
        ┌────────────────────┐
        │  PostgreSQL        │
        │  20 migrations     │
        │  RLS + triggers    │
        └────────────────────┘
```

**The rule that shapes everything:** the API authenticates as the service role,
which **bypasses Row Level Security by design**. RLS therefore protects only the
handful of queries the mobile app issues directly to Supabase. Every API endpoint
must enforce authorization *explicitly, in the service layer*. Three of the
audit's most serious findings — cross-family photo metadata, cross-school
rosters, and cross-teacher photo mutation — trace to exactly one root cause:
code that assumed RLS was covering it.

This is stated plainly in the project's working instructions because it is the
single most dangerous thing a new contributor can get wrong.

## 4.4 Authorization: three layers, only two of them trusted

| Layer | Where | Trusted? |
|---|---|---|
| `RoleGate` | Mobile, `features/auth/components/RoleGate.tsx` | **No.** UX only — stops the wrong screen rendering. Trivially removed in a modified build. |
| `roleGuard` middleware | API, per route | **Yes** — coarse role check |
| Ownership assertions | API, service layer | **Yes** — the real boundary. Every resource fetched by ID is checked against the caller. |

A signed Storage URL is a bearer capability: anyone holding it can fetch the
object until it expires. It must therefore **never be minted for a caller who is
about to be refused**. Authorization precedes signing, not the reverse.

## 4.5 Data model

20 migrations, applied in filename order. Nine domain tables:

| Table | Purpose |
|---|---|
| `schools` | Tenant root |
| `profiles` | Extends `auth.users`; carries role and school |
| `classes` | Classroom, optionally led by a teacher |
| `students` | Children enrolled |
| `parent_student_mappings` | **Many-to-many.** The privacy rule lives here |
| `photos` | Metadata; `s3_key` holds a Supabase Storage path (name is historical) |
| `photo_student_tags` | Which children appear in which photo |
| `orders`, `order_items` | Print orders, priced server-side |
| `notifications` | In-app, produced by database triggers |

**Three schema decisions worth defending in a viva:**

**Money is integer cents, everywhere.** The columns were originally
`decimal(10,2)` documented as USD, but the API wrote cents into them while the
mobile client priced in dollars and rendered `toFixed(2)`. A $4.99 print stored
`299.00` and displayed as **$299.00** — a 100× error in the direction that
overcharges the customer. Migration `00017` renamed `total_amount → total_cents`
and `unit_price → unit_price_cents` and retyped both to `integer`. Formatting to
dollars now happens exactly once, at render, in a single `formatCents` helper.

**Foreign keys now express what they mean.** Three columns were declared
`NOT NULL` *and* `ON DELETE SET NULL`. Those are mutually exclusive: deleting the
referenced row makes Postgres write NULL into a NOT NULL column, so it raises a
not-null violation instead of cascading. The practical effect was that **deleting
any profile or photo was impossible**, and failed with an error that did not
explain why. Migration `00018` changed all three to `ON DELETE RESTRICT`, which
is the honest statement of the intent: you should not be able to delete a teacher
who still has photos without deciding what happens to them.

**Order creation is one transaction.** It previously inserted the order, then the
items, then issued a compensating `DELETE` if the second insert failed. A crash
between the two left an order with no items — and the compensation never ran,
because the process was gone. A PL/pgSQL function body is a single transaction,
so `create_order_with_items` makes it atomic. §5.5 shows this verified by
deliberately failing the second insert.

## 4.6 The API

40 route registrations across seven routers, all under `/api/v1`. Every route
runs the same pipeline:

```
authenticate → roleGuard(role…) → validate(schema, source) → controller → service
```

Representative endpoints:

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/feed` | parent | Cursor-paginated; scoped to the caller's children |
| `GET` | `/feed/photos/:id` | parent | 404 — not 403 — if the photo is not theirs |
| `POST` | `/photos` | teacher | Metadata; returns an upload target |
| `POST` | `/photos/:id/file` | teacher | Multipart; magic-byte validated |
| `POST` | `/photos/:id/tag` | teacher | Max 50 students, bounded |
| `POST` | `/photos/:id/confirm` | teacher | Flips to `ready` — fires notifications |
| `POST` | `/orders` | parent | Idempotent via `x-idempotency-key` |
| `GET` | `/orders/:id` | parent | Items carry signed thumbnail URLs |
| `GET` | `/admin/users` | admin | Search is parameterised, not interpolated |

**404 versus 403 is deliberate.** A parent requesting another family's photo gets
**404**, not 403. A 403 confirms the resource exists, which is itself a
disclosure — an attacker enumerating IDs learns which are real. A 403 is correct
for the *school* boundary, where the caller already legitimately knows the school
exists.

## 4.7 The ordering flow — a worked example

Ordering is the clearest example of a defect that spanned every layer, so it is
worth tracing end to end.

**The defect.** Three layers disagreed, three different ways, each fatal alone:

1. **Field naming** — the client sent `snake_case`; the validator required
   `camelCase`. Zod rejected with 400 before the request reached the database.
2. **Product vocabulary** — the client used `print_4x6`; the validator used
   `4x6`; the database CHECK allowed only the `print_*` set. Just three of ten
   values overlapped all three layers.
3. **Currency** — cents on the server, dollars on the client, as above.

**No order had ever been placed successfully.** The feature was shipped, and
broken, in a way no amount of unit testing on any single layer would have caught,
because each layer was internally consistent.

**The fix.** A single shared product catalogue defines the seven product types,
their integer-cent prices and their labels. The backend imports it; the mobile
app mirrors it with a cross-reference comment and a test asserting the two agree.
The client no longer sends a price at all — **the server prices every order from
its own catalogue**, so a caller cannot set their own total. That is a security
property, not a style preference, and it has a test.

**The result** (§5.5): `POST /api/v1/orders` → **201**, `total_cents: 998` for
2 × `print_4x6` at 499. Integer cents, no float. Re-sending the same
`x-idempotency-key` returned **the same order**, not a duplicate.

## 4.8 Team and individual contribution

Four contributors, 367 commits, 1 February – 9 August 2026.

| Contributor | Commits |
|---|---|
| Bhargav | 107 |
| Nagachaitanya | 99 |
| Ruthwik | 91 |
| Srujan | 70 |

**Srujan's ownership: the data layer** — schema, migrations, validation and seed
data. Specifically:

- **Plan 02, order contract and data model** — the shared catalogue, the
  camelCase contract, removal of client-supplied pricing, the integer-cent
  migration, the foreign-key corrections, the atomic order function, the wired
  listing validator, the `markAsRead` 404 contract, and making the RLS policy
  migrations replayable.
- **Plan 06, demo seeding** — the seed script that replaced an unusable
  `seed.sql`, including order history and photo idempotency.
- **Plan 00 Group B** — regenerating the Supabase type definitions, which cleared
  seven of the mobile app's 22 compile errors.
- **Plan 10** — the database chapter and ER documentation.

Two of those are worth singling out because the *diagnosis* was the work, not the
patch. The Supabase types had been assumed stale; they were in fact hand-written
and failed the `GenericSchema` contract the client library requires, so every
query row collapsed to `never`. And `seed.sql` had never worked at all — it
inserted into `profiles`, whose primary key references `auth.users`, which cannot
be populated by SQL because Supabase Auth owns password hashing. Both needed the
real cause found before a line was usefully changed.

---

# 5. Testing, validation and results

## 5.1 Strategy

Three layers, chosen so that each catches what the others cannot:

1. **Static** — TypeScript across both packages, ESLint, and a production build.
   Runs on every push via GitHub Actions.
2. **Automated integration** — Vitest + Supertest driving the **real Express app
   against a real PostgreSQL instance**. Not mocks: the app boots, the middleware
   chain runs, Postgres enforces its constraints.
3. **Runtime verification** — a scripted security checklist and manual probes
   against a running backend with real tokens.

**Why integration over unit tests.** The ordering defect in §4.7 is the argument.
Every layer was internally consistent and would have passed its own unit tests.
Only a test that sends a real HTTP request through the real middleware into a
real database catches a contract mismatch between layers.

## 5.2 Automated test suite

**178 tests across 8 files.** The 8 files declare 127 test cases statically; the
difference is parameterised `it.each` blocks that expand at runtime.

| File | Cases | Covers |
|---|---|---|
| `admin.test.ts` | 28 | Admin console, search sanitisation, own-profile access |
| `orders.test.ts` | 26 | Order creation, pricing, idempotency, ownership |
| `photos.test.ts` | 22 | Upload, tagging, ownership, archive/untag |
| `authorization.test.ts` | 17 | G-04, G-05, G-08, G-16, G-17 boundaries |
| `errors.test.ts` | 12 | Envelope shape, `AppError` mapping, production leakage |
| `auth.test.ts` | 11 | Authentication and RBAC |
| `feed.test.ts` | 8 | Parent feed scoping and pagination |
| `cursor.test.ts` | 3 | Cursor encode/decode, filter-injection rejection |

**Result — 178 of 178 passing in 115 s**, observed 9 August 2026 against the
dedicated `hive-test` Supabase project.

### 5.2.1 A destructive-run guard, and why it exists

The suite truncates every domain table in `beforeAll`. Pointed at the wrong
project it would silently erase the demo dataset. `tests/setup.ts` therefore
refuses to run unless a separate `.env.test` exists, and refuses again if the URL
names a known non-test project.

**Both guards initially failed open.** One compared against a variable that was
never set; the other hard-coded a project reference that had gone stale. The
guard's own comment claimed it was "deliberately loud and unconditional" — it was
neither. This is recorded because a guard nobody has tested is not a guard, and
the failure mode is silent data loss.

### 5.2.2 Honest note on suite stability

Repeated runs exhaust the shared Supabase sign-in quota: each run creates roughly
40 auth users, and past the quota sign-ins stall rather than fail. Running the
suite three times within half an hour produced timeouts — **every failure
observed was a timeout, never a failed assertion**, and the same files passed in
isolation immediately afterwards.

The 178/178 figure is therefore real, but it is a measurement of *the suite
running alone*. This is a limitation of sharing one test project across CI and
four developers, and it is stated rather than hidden because an examiner running
the suite twice will see it.

## 5.3 The sabotage exercise — did the tests detect anything?

A passing suite proves nothing until you show it can fail for the right reason.
A single line — `photo.uploaded_by === user.id` — was deleted from the ownership
assertion, and the suite re-run.

**Result:** exactly the 3 same-school ownership tests failed, as intended.

**And it found a real problem.** A similarly-named test in `photos.test.ts`
stayed **green** — because both of its teachers were at *different* schools,
where the school check refuses first and the ownership check never executes. That
test had never guarded the property its name claimed. It had been providing false
confidence for its entire existence.

This is the single most valuable result in the testing chapter: the exercise
found a test that did not test what it said it did. That is what sabotage testing
is for.

## 5.4 Privacy verification — the core requirement

The product's central claim, measured against seeded data.

| Measurement | Result |
|---|---|
| Photos in the database | 6 |
| Rajesh (Bloom, two children) sees | **2** |
| Vikram (Little Stars, two children) sees | **1** |
| Overlap between them | **zero** |
| Any parent seeing all 6 | **none** |
| Duplicate IDs in a feed | none — dedup holds for siblings in one photo |

The sibling case matters: a photo tagged with two of the same parent's children
must appear **once**, not twice. That is a join-cardinality bug waiting to
happen, and it is covered.

## 5.5 Functional verification at runtime

Executed against a running backend, not inferred from code review.

| Check | Result |
|---|---|
| `GET /health` | **200**, `"checks": {"database": "ok"}` — round-trips to Postgres |
| `GET /health`, database stopped | **503**, `"status": "degraded"` — degradation is detected, not silently ignored |
| Unauthenticated `/api/v1/*` | **401** across feed, photos, orders, notifications, admin |
| Malformed bearer token | **401** |
| Anon key against `profiles` | Returns `[]`, not a dump — RLS holds on the direct client path |
| **Order placement (G-01)** | **201**, `total_cents: 998` for 2 × 499. Integer cents |
| **Order idempotency** | Same `x-idempotency-key` twice → **the same order**, no duplicate |
| **Atomicity (G-37)** | Deliberately invalid item → item insert rejected, **no orphaned order row** |
| **Notifications (G-07)** | 16 generated, correct parents, correct child names |
| **Storage pipeline** | 6 photos processed: originals + `_thumb.jpg` written, `blurhash`, `width`, `height` populated. Dimensions 1600×900 … 1600×2409 — portrait and landscape both survive |
| **Signed URLs (G-02)** | Signed URL fetches **200**; same URL with `?token=` stripped returns **400** |
| Rate limiter | **429 at request 77** of a 100-per-15-minute window |

## 5.6 Security verification

`scripts/verify-security.sh` run against a backend booted with
`NODE_ENV=production` over the seeded dataset.

```
passed 26    failed 0    skipped 3
```

**Reproduced from cold on 2 August** — stack stopped and restarted, database
truncated, re-seeded, backend rebooted — with the same result. It is a repeatable
procedure, not a single lucky reading.

| Area | Checks | Result |
|---|---|---|
| G-02 static route | `/uploads/<random>`, `/uploads/<real key>` | 404, 404 — route is gone |
| G-04 photo detail | Another family's photo / own / unauthenticated | **404**, 200, 401 |
| G-04b tag leakage | `taggedStudentIds` on an entitled request | Only the caller's own children |
| G-08 cross-school | Another school's students / classes / photos | **403 × 3**; own school 200 |
| G-17 same-school | Colleague's photo `/confirm`, `/tag`, `/file` | **403 × 3** |
| G-05 role split | Parent → `/admin/*`; unauthenticated; garbage token | 403, 403, **401** |
| CORS | `Origin: https://evil.example` | Not reflected, not `*` |
| Secrets | Repository scan | Clean — no JWTs, keys, PEM blocks or tracked `.env` |

**G-17 deserves a note.** It was previously untestable: every probe used teachers
at *different* schools, where the school check refuses first and the ownership
check never runs. Only when the seed provided two teachers at the *same* school
did the check become observable — and it passed.

**The three skips are not interchangeable with passes.** They require HTTPS and a
deployed origin, which do not exist (§5.7).

## 5.7 What was not verified

Stated explicitly, because a results chapter that omits this is not a results
chapter.

| Not verified | Why | Consequence |
|---|---|---|
| **Nothing is deployed** | No hosted URL, no APK | HTTPS and CORS-origin checks skipped; k6 has no target |
| **k6 load suite never run** | Same — needs a deployed target | **No performance figures exist.** §5.8 |
| **Nothing seen on a physical device** | No iOS/Android build launched | Keychain session, image picker, deep links, `AppState` unverified where they ship |
| **HEIC and magic-byte rejection** | Every seed asset is already JPEG | Conversion path and the "`.txt` renamed `.jpg`" rejection are unproven |
| **Sentry has never received an error** | Needs a DSN — an account signup | Error pipeline unproven end to end |
| **CI test step is advisory** | Repository secrets absent | 178 passing tests do not yet block a pull request; lint, typecheck and build do |

**The app has been driven end to end in Chrome** via Expo's web target, so the
screens are no longer merely typechecked — but web is a verification convenience.
The product targets iOS and Android, and that is where it remains unproven.

## 5.8 Performance — stated honestly

**No load-test results exist.** The k6 suite (smoke, load, stress, spike
profiles) is written and committed, but it has never been executed because there
is no deployed target to point it at.

The only timing figure measured is the test suite: **178 tests in 115 s**,
including database truncation, roughly 40 auth-user creations and full HTTP
round-trips.

Presenting invented latency or throughput numbers would be worse than presenting
none. This section is short on purpose, and §6 lists deployment as the first item
of future work precisely because it is what unlocks the measurements.

## 5.9 Defects found and fixed

The project began with an audit that enumerated 46 gaps. The most serious, and
their disposition:

| Gap | Severity | Defect | Status |
|---|---|---|---|
| **G-01** | Critical | Order submission broken three ways; **no order could be placed** | Fixed, verified |
| **G-02** | Critical | `/uploads` served with no authentication — **every child's photo a public URL** | Fixed, verified |
| **G-04** | Critical | Any parent could read any photo's metadata and its full tagged-child list | Fixed, verified |
| **G-05** | Critical | No role check on route groups — a parent could deep-link into the admin console | Fixed, verified |
| **G-08** | High | Any teacher could read another school's roster, including dates of birth | Fixed, verified |
| **G-17** | High | A teacher could overwrite a colleague's photo | Fixed, verified |
| **G-03** | Medium | ~700 lines of finished notification code had zero imports | Fixed |
| **G-07** | Medium | Tag-after-confirm ordering meant parents never received notifications | Fixed, verified |
| **G-12** | Medium | No thumbnails — the feed served full-resolution originals | Fixed |
| **G-16** | Medium | Filter-injection in admin user search | Fixed, verified |
| **G-19** | Medium | Contradictory foreign keys made profile/photo deletion impossible | Fixed |
| **G-20** | Medium | `trust proxy: true` allowed rate-limit bypass via header rotation | Fixed, verified |
| **G-37** | Medium | Non-atomic order creation could leave an order with no items | Fixed, verified |
| **G-40** | Medium | Upload trusted the client's `Content-Type` | Fixed — magic bytes |

**A round of fixes introduced three regressions of its own**, caught by its own
second review: cursor pagination dropping rows on a millisecond-truncated
timestamp, a rate-limit bypass via a forged bearer token, and WebP accepted at
three format gates but refused at the fourth. All three were fixed. They are
recorded here because a report claiming a clean run of 25 fixes with no
regressions would not be credible.

## 5.10 Result analysis

**What the evidence supports.** The privacy boundary — the product's reason to
exist — holds under direct adversarial probing: cross-family photo access returns
404, cross-school roster access returns 403, and same-school photo mutation
returns 403, each confirmed over HTTP with real tokens and reproduced from a cold
start. The ordering flow works with correct integer-cent arithmetic and genuine
idempotency. The storage layer produces thumbnails and blurhashes for both
orientations and serves them only through signed, expiring URLs.

**What it does not support.** Nothing has been observed on the platform the
product actually ships on. No performance characteristic has been measured. The
error-reporting pipeline has never carried an error. These are not oversights
discovered late; they follow from a single missing step — deployment — which is
why §6 puts it first.

**The most instructive result** is the sabotage exercise. It confirmed the suite
detects the regression it targets, and simultaneously exposed a test that had
never tested what its name claimed. A suite is not evidence until you have made
it fail deliberately, and doing so was worth more than the number of tests
passing.

---

## References

1. Supabase documentation — Row Level Security, Auth, Storage.
   https://supabase.com/docs
2. PostgreSQL 15 documentation — constraints, referential actions, PL/pgSQL.
   https://www.postgresql.org/docs/15/
3. OWASP API Security Top 10 (2023) — API1 Broken Object Level Authorization,
   API5 Broken Function Level Authorization.
   https://owasp.org/API-Security/
4. Expo documentation — expo-router, expo-image, expo-secure-store.
   https://docs.expo.dev
5. Zod — schema validation. https://zod.dev
6. TanStack Query v5 — server-state caching. https://tanstack.com/query
7. `sharp` — image processing. https://sharp.pixelplumbing.com
8. Vitest and Supertest — integration testing.
   https://vitest.dev · https://github.com/ladjs/supertest
9. k6 — load testing. https://k6.io/docs/
10. Project repository documentation: `docs/architecture.md`,
    `docs/security.md`, `docs/database.md`, `docs/api.md`,
    `docs/IMPLEMENTATION-STATUS.md`
