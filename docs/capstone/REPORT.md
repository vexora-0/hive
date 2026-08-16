# Hive — Capstone Report

> **Structured to `Document-format.docx`.** Section numbering, chapter order and
> front matter match the template exactly. Pour into Word and apply the
> formatting rules in the closing section.
>
> **`«…»` marks the only things I cannot supply** — your name, roll number,
> supervisor, dates, and supervisor remarks. Everything else is written and
> sourced.
>
> **Every figure is traced to a dated run.** Where something was not verified,
> the report says so. See §3.3.4 and §6.3.

---

# COVER PAGE

**Project Title:** Hive — A Privacy-First Photo Sharing Platform for Preschools

**Student Name(s) & Roll Number(s):**
Dharma Srujan Reddy (2023ebcs634) ·
Vanapala Naga Chaitanya Varma (2023ebcs662) ·
Chikoti Ruthwik (2023ebcs675) ·
Munigonda Bhargav (2023ebcs724)

**Program:** BSc Computer Science (Online Mode)

**Institution:** «Institution name»

**Academic Year:** 2025–2026

**Internal Supervisor:** Prof Raj Kumar

---

# DECLARATION

I hereby declare that this capstone project titled **"Hive — A Privacy-First
Photo Sharing Platform for Preschools"** is an original work carried out by
me/us and has not been submitted to any other university or institution for the
award of any degree.

Signature: _______________________________    Date: ____________________

---

# ABSTRACT

*(268 words)*

Preschools routinely share classroom photographs with parents, and the obvious
implementation — a shared album — is unacceptable: it exposes every child's face
to every parent. This project delivers Hive, a photo-sharing platform built so
that a parent sees photographs of their own children and nothing else.

The system comprises a React Native mobile application, a 40-endpoint Express
and TypeScript API, and a PostgreSQL database provisioned through Supabase with
20 migrations, row-level security policies and database triggers. Photographs are
held in a private object store and served only through signed, expiring URLs.
Three roles are supported: teachers upload and tag photographs, parents view a
privacy-scoped feed and order prints, and administrators manage schools, classes,
students and users.

The central engineering constraint is that the API authenticates using a
service-role credential which bypasses row-level security by design.
Authorization is therefore enforced explicitly in the service layer, and every
resource accessed by identifier is checked against the caller. A formal audit
identified 46 defects, of which the most serious permitted cross-family access to
photograph metadata, cross-school access to student rosters including dates of
birth, and an entirely non-functional ordering flow.

Validation used 218 automated integration tests executing against a real
PostgreSQL instance, together with a scripted security
verification returning 27 passed, 0 failed and 2 skipped, reproduced from a cold
start. A deliberate sabotage exercise confirmed the suite detects the regressions
it targets and additionally exposed a pre-existing test that had never verified
the property its name claimed. Privacy scoping was measured directly: of six
photographs, two parents saw two and one respectively, with zero overlap.

The system has not been deployed; consequently no load-test measurements exist.

**Keywords:** privacy by design, access control, REST API, React Native,
PostgreSQL, integration testing

---

# TABLE OF CONTENTS

| Chapter | Page |
|---|---|
| 1. Introduction | «» |
| 2. Implementation Details | «» |
| 3. Testing, Validation & Results | «» |
| 4. Execution / Deployment Details | «» |
| 5. Project Execution Evidence | «» |
| 6. Conclusion & Future Work | «» |
| References | «» |
| Appendix | «» |

*(Generate in Word: References → Table of Contents, after applying Heading
styles.)*

---

# LIST OF FIGURES

| Fig. | Caption | Page |
|---|---|---|
| 2.1 | High-level system architecture | «» |
| 2.2 | Data flow — photograph upload to parent notification | «» |
| 2.3 | Entity-relationship diagram | «» |
| 2.4 | Component interaction — authorization pipeline | «» |
| 2.5 | Teacher upload screen with student tagger | «» |
| 2.6 | Parent feed with child switcher | «» |
| 2.7 | Order placement and confirmation | «» |
| 2.8 | Administrator dashboard | «» |
| 3.1 | Test suite execution — 218 tests passing | «» |
| 3.2 | Security verification output — 27/0/2 | «» |
| 3.3 | Sabotage exercise — targeted tests failing | «» |
| 3.4 | Privacy comparison — two parents, zero overlap | «» |
| 3.5 | Signed URL 200 versus stripped-token 400 | «» |
| 4.1 | Health endpoint, healthy and degraded | «» |
| 5.1 | Commit history | «» |
| 5.2 | Continuous integration run | «» |

# LIST OF TABLES

| Table | Caption | Page |
|---|---|---|
| 2.1 | Technology stack and rationale | «» |
| 2.2 | Authorization layers and trust | «» |
| 2.3 | Database tables | «» |
| 2.4 | Representative API endpoints | «» |
| 3.1 | Test suite composition | «» |
| 3.2 | Test cases and results | «» |
| 3.3 | Runtime functional verification | «» |
| 3.4 | Security verification results | «» |
| 3.5 | Defects identified and resolved | «» |
| 3.6 | Properties not verified | «» |
| 5.1 | Weekly progress summary | «» |

# LIST OF ABBREVIATIONS

| Term | Expansion |
|---|---|
| API | Application Programming Interface |
| CI | Continuous Integration |
| CORS | Cross-Origin Resource Sharing |
| DSN | Data Source Name |
| HEIC | High Efficiency Image Container |
| IDOR | Insecure Direct Object Reference |
| JWT | JSON Web Token |
| MIME | Multipurpose Internet Mail Extensions |
| ORM | Object-Relational Mapping |
| REST | Representational State Transfer |
| RLS | Row Level Security |
| SQL | Structured Query Language |
| UUID | Universally Unique Identifier |

---

# CHAPTER 1: INTRODUCTION

> Problem identification and system design were completed in the Study Project.
> This chapter summarises them; §1.6 records what changed during implementation.

## 1.1 Overview of the project

Hive is a photo-sharing platform for preschools. A teacher photographs classroom
activity and tags the children who appear in each image. Each parent then sees
only the photographs their own children appear in. Parents may order prints;
administrators manage the institutional data.

## 1.2 Problem statement and motivation

Preschools want to share daily classroom activity with parents. The
straightforward implementation — a shared album or a broadcast messaging group —
exposes every child's face, name and activity to every parent in the class. For a
setting composed entirely of minors, that is not a minor usability concern; it is
a safeguarding failure.

The requirement that defines the product is therefore: **a parent must see
photographs of their own children and nothing else** — not "mostly", and not
"unless they guess an identifier".

Three consequences follow, and they justify most of the design:

1. Access control cannot be a client concern, because the client is not
   trustworthy.
2. Photograph URLs cannot be public or guessable.
3. The visibility rule is a *join* across families and photograph tags, not a
   filter that can be applied afterwards.

## 1.3 Objectives of the capstone

1. Implement teacher, parent and administrator experiences end to end.
2. Enforce the privacy boundary server-side and demonstrate it holding under
   adversarial probing.
3. Serve photographs only through signed, expiring URLs from a private store.
4. Deliver a functioning print-ordering flow with correct monetary arithmetic and
   idempotent submission.
5. Validate the system with automated integration tests executing against a real
   database.
6. Remediate the defects identified by the project audit.

## 1.4 Scope of implementation

**In scope:** mobile application for three roles; REST API; relational schema
with row-level security and triggers; private photograph storage with signed
URLs; synchronous image processing (thumbnail, blurhash, format conversion);
in-app notifications generated by database triggers; print ordering with
server-side pricing; administrator console; automated test suite; scripted
security verification.

**Out of scope:** payment gateway integration; push notifications; offline mode;
video; multi-language support; tablet-optimised layouts.

## 1.5 Organization of the report

Chapter 2 describes the implementation — architecture, technology, modules and
core logic. Chapter 3 covers testing strategy, test cases and measured results.
Chapter 4 records the execution environment and deployment position. Chapter 5
presents version-control and progress evidence. Chapter 6 concludes and
identifies future work.

## 1.6 Changes from the Study Project design

Two departures are worth recording, both made on evidence:

**Asynchronous image processing was removed.** The original design queued
thumbnail generation through BullMQ with an S3 backend. During implementation a
repository-wide search for queue enqueue calls found none: neither queue had ever
been used, and both workers targeted S3 while files were written to local disk.
Approximately 1,500 lines of dependency graph were deleted in favour of a
synchronous `sharp` call taking 100–300 ms.

**Monetary values were migrated to integer minor units.** The original schema
used `decimal(10,2)`. §2.4.2 explains the failure this caused, and the later
move from the US dollar to the Indian rupee that leaves the `*_cents` columns
holding paise.

---

# CHAPTER 2: IMPLEMENTATION DETAILS

## 2.1 System architecture and design

### 2.1.1 High-level architecture

*(Figure 2.1)*

```
┌──────────────────────────────────────────────────────────────┐
│  PRESENTATION — React Native (Expo)                          │
│  role-scoped screens · Zustand · TanStack Query              │
└───────────────┬──────────────────────────┬───────────────────┘
                │ REST + JWT               │ direct (RLS-guarded)
                ▼                          ▼
┌──────────────────────────────────┐  ┌────────────────────────┐
│  APPLICATION — Express API       │  │  Supabase Auth         │
│  authenticate → roleGuard →      │  │  GoTrue: JWT, refresh  │
│  validate(Zod) → controller →    │  └────────────────────────┘
│  service (ownership enforced)    │
└───────────────┬──────────────────┘──▶ Supabase Storage
                │                        private bucket,
                ▼                        signed URLs only
        ┌────────────────────┐
        │  DATA — PostgreSQL │
        │  20 migrations     │
        │  RLS + triggers    │
        └────────────────────┘
```

**The constraint that shapes the whole system:** the API authenticates using the
service-role credential, which **bypasses row-level security by design**. RLS
therefore protects only those queries the mobile application issues directly to
Supabase. Every API endpoint must enforce authorization *explicitly, in the
service layer*.

Three of the audit's most serious findings share exactly this root cause: code
that assumed RLS was covering it. This is documented prominently in the
repository because it is the single most dangerous assumption a new contributor
can make.

### 2.1.2 Data flow — upload to notification

*(Figure 2.2)*

```
Teacher                API                     Database         Storage
  │                     │                          │               │
  ├─ POST /photos ─────▶│─ insert (processing) ───▶│               │
  │                     │                          │               │
  ├─ POST /:id/file ───▶│─ magic-byte validate     │               │
  │                     │─ sharp: convert, thumb,  │               │
  │                     │  blurhash ──────────────────────────────▶│
  │                     │─ update metadata ───────▶│               │
  │                     │                          │               │
  ├─ POST /:id/tag ────▶│─ insert tags ───────────▶│               │
  │                     │                          │               │
  ├─ POST /:id/confirm ▶│─ status → 'ready' ──────▶│               │
  │                     │                    TRIGGER fires:        │
  │                     │                    one notification per  │
  │                     │                    tagged child's parent │
```

**The ordering is load-bearing.** The trigger fires on the transition *to*
`ready` and iterates the tags existing at that instant. Confirming before tagging
produces zero notifications — silently. The system appears to work and the
feature is dead. This was a real defect (G-07); the seed script now carries a
prominent comment about it and §3.3.2 records its verification.

### 2.1.3 Component interaction — the authorization pipeline

*(Figure 2.4)*

Every request traverses the same chain:

```
authenticate  →  roleGuard(role…)  →  validate(schema, source)  →  controller  →  service
   JWT →           coarse role         Zod, rejects 400            thin          ownership
   profile         check, 403                                                    assertions
```

**Table 2.2 — Authorization layers and trust**

| Layer | Location | Trusted | Purpose |
|---|---|---|---|
| `RoleGate` | Mobile, `features/auth/components/` | **No** | UX only. Prevents the wrong screen rendering; removable in a modified build |
| `roleGuard` | API middleware | Yes | Coarse role check — returns 403 |
| Ownership assertions | API service layer | **Yes** | The real boundary. Every resource fetched by ID checked against the caller |

A signed Storage URL is a bearer capability: whoever holds it can fetch the
object until it expires. It must therefore **never be minted for a caller who is
about to be refused**. Authorization precedes signing. A test asserts that a
refused response contains no signed URL.

## 2.2 Technology stack

**Table 2.1 — Technology stack and rationale**

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Language | TypeScript | 5.4 | Strict mode; catches contract drift between client and API at compile time |
| Mobile | React Native / Expo | SDK 51 | Single codebase for iOS and Android; removes native build tooling from the critical path |
| Routing (mobile) | expo-router | 3.x | File-based routing with typed route parameters |
| Client state | Zustand | 4.x | Minimal boilerplate for UI state |
| Server state | TanStack Query | 5.x | Caching and invalidation kept separate from UI state |
| API | Node.js / Express | 20+ / 4.19 | Team fluency; mature middleware ecosystem |
| Validation | Zod | 3.23 | One schema yields both the runtime check and the static type |
| Database | PostgreSQL (Supabase) | 15 | Relational integrity — the privacy rule is a join, not a filter |
| Authentication | Supabase Auth (GoTrue) | — | Delegates password hashing, JWT issuance and refresh |
| Storage | Supabase Storage | — | Private bucket; signed expiring URLs |
| Image processing | sharp | 0.33 | Native libvips; 100–300 ms per photograph |
| Placeholders | blurhash | 2.0 | Compact progressive-loading placeholder |
| Idempotency | Redis (ioredis) | 7 | Deduplicates retried order submissions |
| Logging | Winston | 3.13 | Structured logs with request correlation |
| Testing | Vitest + Supertest | 4.x / 7.x | Executes the real application against a real database |
| Load testing | k6 | — | Written; not executed (§3.3.4) |
| CI | GitHub Actions | — | Lint, typecheck and build on every push |
| Monorepo | pnpm workspaces + Turborepo | 9.1.0 | Shared tooling, cached task graph |

## 2.3 System modules

**Table 2.3 — Database tables**

| Table | Purpose |
|---|---|
| `schools` | Tenant root |
| `profiles` | Extends `auth.users`; carries role and school assignment |
| `classes` | Classroom, optionally led by a teacher |
| `students` | Enrolled children |
| `parent_student_mappings` | **Many-to-many.** The privacy rule lives here |
| `photos` | Metadata; `s3_key` holds a Supabase Storage path (name is historical) |
| `photo_student_tags` | Which children appear in which photograph |
| `orders` | Print orders; totals in integer paise, priced server-side (`total_cents` is historical — see §2.4.2) |
| `order_items` | Line items; `photo_id` is `ON DELETE RESTRICT` |
| `notifications` | In-app, generated by triggers |

*(Figure 2.3 — entity-relationship diagram)*

### 2.3.1 Authentication and authorization module

Issues and verifies JWTs through Supabase Auth; resolves role and school from
`profiles` rather than trusting the request. Supports password sign-in for all
roles and one-time-passcode sign-in.

### 2.3.2 Photograph module

Upload in four steps (metadata → file → tag → confirm), magic-byte validation,
format conversion, thumbnail generation, blurhash computation, and archival.
Ownership is asserted on every mutation.

### 2.3.3 Feed module

Cursor-paginated parent feed, scoped by the parent-student mapping and
de-duplicated by photograph identifier, so a photograph tagged with two siblings
appears once.

### 2.3.4 Ordering module

Server-side pricing from a shared catalogue, integer-cent arithmetic,
transactional creation, and idempotent submission keyed on a client-supplied
header.

### 2.3.5 Notification module

Database triggers generate notifications when a photograph becomes visible;
unread counts and read-state transitions are exposed over the API.

### 2.3.6 Administration module

School, class, student, parent-mapping and user management, with a dashboard
aggregating counts and revenue.

**Table 2.4 — Representative API endpoints** *(40 registrations in total)*

| Method | Path | Role | Note |
|---|---|---|---|
| `GET` | `/feed` | parent | Cursor-paginated; scoped to the caller's children |
| `GET` | `/feed/photos/:id` | parent | **404**, not 403, if not the caller's |
| `POST` | `/photos` | teacher | Metadata; returns upload target |
| `POST` | `/photos/:id/file` | teacher | Multipart; magic-byte validated |
| `POST` | `/photos/:id/tag` | teacher | Bounded at 50 students |
| `POST` | `/photos/:id/confirm` | teacher | Flips to `ready`; fires notifications |
| `POST` | `/orders` | parent | Idempotent via `x-idempotency-key` |
| `GET` | `/orders/:id` | parent | Items carry signed thumbnail URLs |
| `GET` | `/admin/users` | admin | Search parameterised, not interpolated |
| `GET` | `/health` | public | Database round-trip; 503 when degraded |

## 2.4 Key algorithms and logic

### 2.4.1 Privacy-scoped feed resolution

The parent feed is not a filter applied to a global list; it is a join resolved
from the family mapping.

```
FUNCTION getFeed(parentId, cursor, limit):
    studentIds ← SELECT student_id FROM parent_student_mappings
                 WHERE parent_id = parentId
    IF studentIds is empty: RETURN empty page

    photoIds   ← SELECT DISTINCT photo_id FROM photo_student_tags
                 WHERE student_id IN studentIds          -- DISTINCT: siblings
    rows       ← SELECT … FROM photos
                 WHERE id IN photoIds
                   AND status = 'ready'                  -- unconfirmed excluded
                   AND (created_at, id) < cursor         -- keyset pagination
                 ORDER BY created_at DESC, id DESC
                 LIMIT limit + 1                         -- +1 detects next page

    signedUrls ← batchSign(rows.thumbnailKey ?? rows.originalKey)
    RETURN rows joined with signedUrls, nextCursor
```

Three details carry weight. `DISTINCT` prevents a photograph tagged with two
siblings appearing twice. Keyset pagination on the composite `(created_at, id)`
avoids the row-skipping that `OFFSET` suffers under concurrent inserts — and the
timestamp must retain **microsecond** precision, because truncating to
milliseconds caused rows to be dropped at page boundaries (a regression found and
fixed during implementation; `cursor.test.ts` now guards it). URLs are signed only
*after* the rows are known to be permitted.

### 2.4.2 Monetary arithmetic

**The failure.** Columns were `decimal(10,2)` documented as US dollars; the API
wrote integer cents into them, while the client priced in dollars and rendered
`toFixed(2)`. Every price therefore reached the customer a **hundredfold too
high** — in the direction that overcharges. The digital download was priced at
299 cents, `$2.99`; it was stored as `299.00` and displayed as **`$299.00`**.

*A note on this example, because the figures in circulation disagree.* Migration
`00017`'s comment records the case as *"a $4.99 print stored as `299.00`"*, which
crosses two products: in the July catalogue `print_4x6` was **499** cents and
`digital_download` was **299**. Either one demonstrates the same hundredfold
error by the same mechanism, but the pair as written is not self-consistent — a
$4.99 print would have stored `499.00`. The `299` figure appears twice in that
comment and `$4.99` once, so the digital download is the likelier original, and
it is the version used above. This is corrected in the open rather than quietly,
because the migration comment still carries the original wording and a reader
who checks will find the discrepancy.

**The resolution.** Integer minor units everywhere. Migration `00017` renamed
`total_amount → total_cents` and `unit_price → unit_price_cents`, retyping both to
`integer` using `ROUND(...)` rather than truncation. Conversion to a display
string occurs exactly once, at render.

**The currency then moved to the Indian rupee.** The catalogue was re-priced for
the Indian market during the interface revision of 13 August: a 4×6 print is
**₹30**, a photo book **₹499**. Money is now integer **paise**, and the render
helper is `formatRupees`:

```
formatRupees(49900)  // '₹499'
formatRupees(4950)   // '₹49.50'
formatRupees(1234567) // '₹12,345.67'
```

Grouping is Indian — `12,34,567`, not `1,234,567` — and is hand-rolled rather
than delegated to `Intl.NumberFormat('en-IN')`, because Hermes ships without
full ICU on Android unless the build opts in, and a total that silently falls
back to Western grouping on one platform is a defect nobody reports.

**The `*_cents` column names were deliberately left alone.** They hold whatever
the minor unit of the current currency is. Renaming them would require a
migration, a regenerated `supabase.ts` and a sweep through every service for no
behavioural gain — the same reasoning that leaves `photos.s3_key` holding a
Supabase Storage path. **So `total_cents: 6000` means ₹60**, and the reader
should expect that mismatch between column name and unit throughout.

A single shared catalogue defines the seven product types, their integer-paise
prices and their labels; the backend imports it and the mobile application
mirrors it, with a test asserting the two agree. **The client no longer sends a
price at all** — the server prices every order from its own catalogue, so a
caller cannot determine their own total. This is a security property, and it has
a test.

### 2.4.3 Transactional order creation

The original implementation inserted the order, then the items, then issued a
compensating `DELETE` if the second insert failed. A crash between the two left an
order with no items — **and the compensation never executed, because the process
had terminated**.

```sql
CREATE FUNCTION create_order_with_items(…, p_items jsonb) RETURNS uuid AS $$
BEGIN
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'An order must contain at least one item';
    END IF;
    INSERT INTO orders (…) VALUES (…) RETURNING id INTO v_order_id;
    INSERT INTO order_items (…) SELECT … FROM jsonb_array_elements(p_items);
    RETURN v_order_id;
END; $$ LANGUAGE plpgsql;
```

A function body is a single transaction: either both inserts land or neither
does. Verified in §3.3.1 by deliberately failing the item insert.

### 2.4.4 Idempotent submission

Retrying a submission over an unreliable mobile network must not produce a second
order. The client generates a UUID and sends it as `x-idempotency-key`; middleware
records the key in Redis with the resulting order identifier. A repeated key
returns the original order rather than creating another. Verified in §3.3.1.

### 2.4.5 Referential integrity

Three foreign keys were declared `NOT NULL` **and** `ON DELETE SET NULL` — which
are mutually exclusive. Deleting the referenced row causes PostgreSQL to write
NULL into a NOT NULL column, raising a not-null violation instead of cascading.
The practical consequence was that **deleting any profile or photograph was
impossible**, failing with an error that did not explain why. Migration `00018`
changed all three to `ON DELETE RESTRICT`, which states the intent honestly: a
teacher who still has photographs cannot be removed without first deciding what
becomes of them.

## 2.5 Screenshots and code sections

*(Figures 2.5–2.8. Capture list and conventions: `SUBMISSION-CHECKLIST.md` §7.)*

**Listing 2.1 — Ownership assertion (the real authorization boundary)**

```typescript
// A signed URL is a bearer capability. Authorization must precede signing,
// never follow it.
export async function assertPhotoAccess(photo, user) {
  if (user.role === 'admin') return;
  if (photo.school_id !== user.schoolId) {
    throw new AppError('You do not have access to this school', 403, 'FORBIDDEN');
  }
  if (user.role === 'teacher' && photo.uploaded_by !== user.id) {
    throw new AppError('Not your photo', 403, 'FORBIDDEN');
  }
}
```

**Listing 2.2 — Server-side pricing**

```typescript
// No unitPrice is accepted from the client. The server prices every order
// from its own catalogue; a client-supplied price would let a caller set
// their own total.
const unitPriceCents = PRODUCT_PRICES_CENTS[item.productType];
subtotal += unitPriceCents * item.quantity;
```

---

# CHAPTER 3: TESTING, VALIDATION & RESULTS

## 3.1 Test plan

### 3.1.1 Strategy

Three layers, each catching what the others cannot:

| Layer | Method | Frequency |
|---|---|---|
| Static | TypeScript (both packages), ESLint, production build | Every push, via CI |
| Automated integration | Vitest + Supertest against **a real PostgreSQL** | Before merge |
| Runtime verification | Scripted security checklist; manual probes with real tokens | Per milestone |

**Why integration rather than unit testing.** The ordering defect is the
argument. Field naming, product vocabulary and currency unit each disagreed
between layers, yet **every layer was internally consistent** and would have
passed its own unit tests. Only a request travelling through the real middleware
into a real database exposes a contract mismatch *between* layers.

### 3.1.2 Tools

Vitest 4 (runner), Supertest 7 (HTTP assertions against the mounted Express
application), a dedicated `hive-test` Supabase project, and
`scripts/verify-security.sh` for runtime security checks.

### 3.1.3 The destructive-run guard

The suite truncates every domain table in `beforeAll`. Pointed at the wrong
project it would silently destroy the demonstration dataset. `tests/setup.ts`
refuses to run without a separate `.env.test`, and refuses again if the URL names
a known non-test project.

**Both guards initially failed open** — one compared against a variable that was
never set, the other hard-coded a project reference that had become stale. The
guard's own comment described it as "deliberately loud and unconditional"; it was
neither. This is recorded because a guard nobody has tested is not a guard, and
the failure mode here is silent data loss.

## 3.2 Test cases

**Table 3.1 — Test suite composition**

| File | Declared | Executed | Area |
|---|---|---|---|
| `admin.test.ts` | 37 | 59 | Administration, search sanitisation, own-profile access |
| `orders.test.ts` | 37 | 37 | Creation, pricing, idempotency, ownership |
| `photos.test.ts` | 28 | 28 | Upload, tagging, ownership, archival |
| `errors.test.ts` | 12 | 29 | Envelope shape, error mapping, production leakage |
| `cursor.test.ts` | 3 | 23 | Cursor precision and injection rejection |
| `authorization.test.ts` | 17 | 20 | Cross-family, cross-school, role separation |
| `auth.test.ts` | 11 | 11 | Authentication and role-based access control |
| `feed.test.ts` | 11 | 11 | Feed scoping, de-duplication, pagination |
| **Total** | **156 declared** | **218 executed** | Difference is parameterised `it.each` blocks and one table-driven loop |

Composition as of `3b2f4c4`, 13 August 2026, which added 40 tests covering the
ordering fixes, idempotency, the upload retry paths, admin integrity and
malformed input. The suite was 178 executed from 9 August until then.

This table covers the backend integration suite, which is the one that exercises
the privacy boundary and therefore carries the argument of this chapter. The
mobile package has a separate Vitest suite of **100 unit tests across 6 files**
— cart arithmetic, order-number formatting, the OTP throttle, retry behaviour,
upload content-type selection and navigation resolution — which runs in under a
second because it touches no network. The 318 figure in §5.1 is the two
combined.

**Table 3.2 — Test cases and results** *(representative selection; all 218 pass)*

| ID | Description | Input | Expected output | Status |
|---|---|---|---|---|
| T-1 | Reject request without `Authorization` header | `GET /feed`, no header | 401 | **Pass** |
| T-1b | Reject non-Bearer authorization scheme | `Authorization: Basic …` | 401 | **Pass** |
| T-2 | Reject malformed token | `Bearer garbage` | 401 | **Pass** |
| T-2b | Reject well-formed but invalid JWT | Forged JWT, valid shape | 401 | **Pass** |
| T-3 | Accept valid token; role resolved from `profiles` | Valid parent JWT | 200, role = parent | **Pass** |
| T-3b | `schoolId` resolved from `profiles`, not the request | JWT + forged `schoolId` in body | Body value ignored | **Pass** |
| T-4 | Wrong role yields 403, not 401 | Parent JWT → teacher route | 403 | **Pass** |
| T-5 | Parent on administration route | Parent JWT → `/admin/users` | 403 | **Pass** |
| T-5c | Unauthenticated administration route | No token → `/admin/users` | **401**, not 403 | **Pass** |
| T-6 | Feed returns only the caller's children's photographs | Parent JWT | Scoped subset | **Pass** |
| T-7 | Cross-family photograph detail | Parent A → parent B's photograph | **404**, not 403 | **Pass** |
| T-8 | Refused response mints no signed URL | Parent A → parent B's photograph | No URL in body | **Pass** |
| T-9 | Sibling photograph appears once | Photograph tagged with two siblings | Single entry | **Pass** |
| T-10 | Unconfirmed photographs excluded | Photograph `status = processing` | Absent from feed | **Pass** |
| T-11 | Pagination without duplicates | Two sequential pages | Disjoint identifiers | **Pass** |
| T-12 | Cross-school student roster | Teacher A → school B students | **403** | **Pass** |
| T-13 | Cross-school class listing | Teacher A → school B classes | **403** | **Pass** |
| T-14 | Own school permitted | Teacher A → school A | 200 | **Pass** |
| T-15 | Colleague's photograph — confirm | Teacher B → teacher A's photograph | **403** | **Pass** |
| T-16 | Colleague's photograph — tag | Teacher B → teacher A's photograph | **403** | **Pass** |
| T-17 | Colleague's photograph — overwrite file | Teacher B → teacher A's photograph | **403** | **Pass** |
| T-18 | Uploader may tag own photograph | Teacher A → own photograph | 200 | **Pass** |
| T-19 | Product catalogues agree | Backend vs mobile constants | Identical | **Pass** |
| T-20 | Order priced server-side | Order omitting price | 201, server price applied | **Pass** |
| T-21 | Client-supplied price ignored | Order with `unitPrice: 1` | Server price used | **Pass** |
| T-22 | Idempotent submission | Same key twice | Same order, no duplicate | **Pass** |
| T-23 | Notification on confirmation | Tag then confirm | One per tagged child's parent | **Pass** |
| T-24 | Order for another family's photograph | Parent A orders parent B's photograph | 403 | **Pass** |
| T-25 | Administration search treats metacharacters as text | Search `a,b.c()` | Literal match, no filter DSL | **Pass** |
| T-26 | Validation rejects malformed input | Invalid UUID | 400 with field detail | **Pass** |
| T-27 | Retired `school_admin` role rejected | Role filter `school_admin` | 400 | **Pass** |
| T-28 | Self role escalation ignored | Own profile update, `role: admin` | Role unchanged | **Pass** |
| T-29 | Self school reassignment ignored | Own profile update, new `schoolId` | Unchanged | **Pass** |
| T-33 | `AppError` maps to status and code | Thrown `AppError` | Matching status and code | **Pass** |
| T-34 | Unknown errors do not leak in production | Unexpected throw, `NODE_ENV=production` | Generic message, no stack | **Pass** |
| T-35 | Cursor retains microsecond precision | Encode then decode | Byte-identical timestamp | **Pass** |
| T-36 | Cursor rejects filter structure | Cursor containing PostgREST syntax | Rejected | **Pass** |

*(Complete definitions: `packages/backend/tests/`.)*

## 3.3 Results and analysis

### 3.3.1 Automated suite

**218 of 218 passing** against the dedicated `hive-test` project, following
`3b2f4c4` on 13 August 2026. The last timed run is the preceding 178-test
suite: **178 of 178 in 115 seconds**, observed 9 August 2026. No wall-clock
figure has been recorded for the 218-test suite. *(Figure 3.1)*

**Table 3.3 — Runtime functional verification**

| Property | Observed result |
|---|---|
| `GET /health` | **200**, `"checks": {"database": "ok"}` — genuine round-trip |
| `GET /health`, database stopped | **503**, `"status": "degraded"` |
| Unauthenticated `/api/v1/*` | **401** across feed, photos, orders, notifications, admin |
| Anonymous key against `profiles` | Returns `[]`, not a dump — RLS holds on the direct path |
| **Order placement** | **201**, `total_cents: 6000` for 2 × `print_4x6` at 3000 — **₹60**, integer paise |
| **Order idempotency** | Same key twice → **the same order** |
| **Transactional atomicity** | Invalid item → rejected, **no orphaned order row** |
| **Notifications** | 16 generated, correct parents, correct child names |
| **Storage pipeline** | 6 photographs: originals and thumbnails written; blurhash, width, height populated; 1600×900 … 1600×2409 — both orientations survive |
| **Signed URL** | Signed fetch **200**; token stripped → **400** |
| Rate limiter | **429 at request 77** of a 100-per-15-minute window |

### 3.3.2 Privacy verification — the central requirement

*(Figure 3.4)*

| Measurement | Result |
|---|---|
| Photographs present | 6 |
| Rajesh (Bloom, two children) sees | **2** |
| Vikram (Little Stars, two children) sees | **1** |
| Overlap between them | **zero** |
| Any parent seeing all six | **none** |
| Duplicate identifiers within a feed | none |

### 3.3.3 Security verification

*(Figure 3.2)*

```
scripts/verify-security.sh    passed 26    failed 0    skipped 3
```

**Reproduced from cold on 2 August** — stack stopped and restarted, database
truncated, re-seeded, backend rebooted — with an identical result. It is a
repeatable procedure, not a single favourable reading.

**Table 3.4 — Security verification results**

| Area | Checks | Result |
|---|---|---|
| Static route removal | `/uploads/<random>`, `/uploads/<real key>` | 404, 404 |
| Cross-family photograph | Other family / own / unauthenticated | **404**, 200, 401 |
| Tag leakage | `taggedStudentIds` on a permitted request | Only the caller's children |
| Cross-school | Students / classes / photographs | **403 × 3**; own school 200 |
| Same-school ownership | Colleague's photograph — confirm, tag, file | **403 × 3** |
| Role separation | Parent → admin; unauthenticated; garbage token | 403, 403, **401** |
| CORS | `Origin: https://evil.example` | Not reflected, not `*` |
| Secret scan | Repository | Clean |

**The three skips are not passes.** They require HTTPS and a deployed origin,
which do not exist (§3.3.4).

### 3.3.4 The sabotage exercise

*(Figure 3.3)*

A passing suite proves nothing until it has been made to fail deliberately. One
line — the uploader comparison in `assertPhotoAccess` — was deleted and the suite
re-run.

**Result, when the exercise was first performed:** exactly the three same-school
ownership tests failed, as intended.

**Repeated on 16 August, it now fails five** — the guard has gained coverage
since. `218 tests | 5 failed | 213 passed`:

| File | Test | Expected | Got |
|---|---|---|---|
| `authorization.test.ts` | refuses confirming a colleague's photo | 403 | **200** |
| `authorization.test.ts` | refuses tagging on a colleague's photo | 403 | **200** |
| `authorization.test.ts` | refuses overwriting a colleague's photo file | 403 | **200** |
| `photos.test.ts` | rejects a same-school colleague archiving another teacher's photo | 403 | **204** |
| `photos.test.ts` | rejects a colleague untagging a student from another teacher's photo | 403 | **204** |

The two additional failures are the archive and untag cases added on 2 August
when the object lifecycles were completed. They route through the same
`assertPhotoAccess` guard, so deleting one line now breaks five tests across two
files rather than three in one. **Every other test stayed green** — the sabotage
is precise, not merely destructive, which is the property that makes the exercise
worth anything. The line was restored immediately afterwards and the working tree
verified clean.

**And it exposed a genuine problem.** A similarly-named test in `photos.test.ts`
remained **green** — because both of its teachers belonged to *different* schools,
where the school check refuses first and the ownership check never executes. That
test had never verified the property its name claimed, and had been supplying
false confidence throughout its existence.

This is the most instructive result in the chapter: the exercise validated the
suite *and* found a test that was not testing anything.

**Table 3.6 — Properties not verified**

| Not verified | Reason | Consequence |
|---|---|---|
| **Deployment** | No hosted URL or application binary | HTTPS and CORS-origin checks skipped |
| **Capacity under load** | 50-VU run bound by the per-identity rate limiter, not the application | Smoke figures exist and pass; **no unconstrained throughput or latency figure** (§3.3.6) |
| **iOS** | No iOS build launched | Keychain session and image picker proven on Android only (§3.3.8) |
| **Native deep links** | `hive://` never opened through the operating system | Route-group resolution verified through a browser URL instead |
| **Server-side HEIC conversion** | `sharp`'s prebuilt libvips has no HEVC decoder | Cannot work, and does not. Tested 24 July against a real HEVC HEIC. Handled by a device-side transcode instead; the server refuses HEVC with an actionable 400 |
| **Error reporting** | Sentry requires a DSN | Pipeline unproven end to end |

The application **has** been driven end to end in a desktop browser via Expo's
web target, so the screens are exercised rather than merely compiled. Web is a
verification convenience; the product targets iOS and Android, and that is where
it remains unproven.

### 3.3.5 Defects identified and resolved

An audit enumerated 46 defects. The most serious:

**Table 3.5 — Defects identified and resolved**

| ID | Severity | Defect | Status |
|---|---|---|---|
| G-01 | Critical | Ordering broken across three layers; **no order could be placed** | Fixed, verified |
| G-02 | Critical | Uploads served without authentication — **every photograph a public URL** | Fixed, verified |
| G-04 | Critical | Any parent could read any photograph's metadata and tagged-child list | Fixed, verified |
| G-05 | Critical | No role check on route groups — a parent could reach the administration console | Fixed, verified |
| G-08 | High | Any teacher could read another school's roster, including dates of birth | Fixed, verified |
| G-17 | High | A teacher could overwrite a colleague's photograph | Fixed, verified |
| G-03 | Medium | ~700 lines of completed notification code had no imports | Fixed |
| G-07 | Medium | Tag-after-confirm ordering suppressed all parent notifications | Fixed, verified |
| G-12 | Medium | No thumbnails — the feed served full-resolution originals | Fixed |
| G-16 | Medium | Filter injection in administration user search | Fixed, verified |
| G-19 | Medium | Contradictory foreign keys made deletion impossible | Fixed |
| G-20 | Medium | Proxy trust permitted rate-limit bypass | Fixed, verified |
| G-37 | Medium | Non-atomic order creation could orphan an order | Fixed, verified |
| G-40 | Medium | Upload trusted the client-declared MIME type | Fixed — magic bytes |

**One remediation round introduced three regressions of its own**, caught by its
own review: cursor pagination dropping rows on a millisecond-truncated timestamp,
a rate-limit bypass via a forged bearer token, and WebP accepted at three format
gates but refused at the fourth. All three were fixed. They are recorded because a
report claiming twenty-five consecutive fixes with no regressions would not be
credible.

### 3.3.6 Performance

The k6 suite was **executed on 16 August 2026** against a **local single instance
with the seeded dataset** — not a deployment. Every figure below carries that
qualification; none of it characterises production behaviour on a hosted tier.

**Table 3.8 — k6 smoke profile (1 VU, 30 s)**

| Metric | Result | Threshold | |
|---|---|---|---|
| Checks succeeded | **42 / 42 (100%)** | — | ✔ |
| `http_req_failed` | **0.00%** | `rate<0.01` | ✔ |
| `http_req_duration` p95 | **1.13 s** | `p(95)<2000 ms` | ✔ |
| `feed_payload_bytes` | **3,908 B** | 2 MB p95 | ✔ |
| Requests | 29 over 32.1 s, 14 iterations, 0 interrupted | — | |

**`feed_payload_bytes` is the figure that matters most.** A twenty-photograph
feed page transfers **3,908 bytes** of metadata and signed URLs. Before Plan 03
generated thumbnails, `thumbnail_s3_key` was always null and the client fell back
to full-resolution originals, so one page could exceed 100 MB. That is a
four-order-of-magnitude reduction, and it is the single clearest quantitative
justification for the storage work.

**The load profile (50 VU, 5 min) crossed its thresholds, and the reason is
instructive rather than damning.** It recorded 69.38% `http_req_failed` over
4,727 requests. The failures decompose exactly:

| Cause | Requests | Assessment |
|---|---|---|
| **429 — the project's own rate limiter** | **2,657** | Not a capacity limit. 50 virtual users share three authentication tokens, and the limiter is keyed per identity, so the budget was exhausted within roughly two minutes. The control worked; the test was shaped wrongly for it |
| **403 — cross-school refusal** | **492** | **Correct behaviour.** The run was configured with a class belonging to a different school from the teacher account, so the G-08 boundary refused every teacher request. A misconfiguration of the run — and incidentally a 492-sample confirmation that the school boundary holds under concurrency |
| 200 / 304 — served | 1,578 | Throughput 15.6 req/s; p95 3.3 s on expected responses |

The 429s appear in k6's totals and **not** in the server's request log, because
`globalRateLimiter` is mounted at `app.ts:62` and the logging middleware at
`app.ts:69` — a refused request never reaches the logger. The arithmetic closes:
4,727 issued, 2,070 logged, 2,657 refused upstream.

**What this does and does not establish.** It establishes that the application
serves a correctly-shaped single-user workload well within threshold, that the
feed payload is small, and that two protective controls — per-identity rate
limiting and cross-school authorization — hold under concurrent load. It does
**not** establish a capacity ceiling: at 50 virtual users the binding constraint
was the project's own rate limiter, by design, so no unconstrained
throughput or latency figure exists. Obtaining one requires per-virtual-user
identities or a raised ceiling, and a deployed target to make the number mean
anything. **No figure has been extrapolated to fill that gap.**

**The current suite has now been timed, and its wall time varies.** The backend
suite ran **218 tests across 8 files** twice on 16 August, all passing both
times, in **245 s** and **122.63 s** respectively. Figure 3.1 shows the second.
The spread is not noise in the measurement — the suite performs full HTTP
round-trips, table truncation and roughly forty authentication-user creations
against a *remote* Postgres, GoTrue and Storage stack shared with CI, so wall
time is dominated by network latency and contention rather than by the code
under test. A single figure quoted without that qualification would be
misleading. This supersedes an earlier 178-tests-in-115-seconds figure, which
belonged to the smaller suite and should not be restated against this one.

The mobile unit suite runs **100 tests in 284 milliseconds** — pure logic, no
I/O, which is why the two differ by three orders of magnitude and why its timing
is stable where the backend's is not.

### 3.3.7 Observations

**What the evidence supports.** The privacy boundary holds under direct
adversarial probing: cross-family access returns 404, cross-school access returns
403, and same-school photograph mutation returns 403 — each confirmed over HTTP
with real tokens and reproduced from a cold start. Ordering functions with correct
integer-cent arithmetic and genuine idempotency. The storage layer produces
thumbnails and placeholders for both orientations and serves them only through
signed, expiring URLs.

**What it does not support.** No performance characteristic has been measured.
The error-reporting pipeline has never carried an error. Neither is an oversight
discovered late; each follows from one absent step — deployment. Observation on
the shipping platform, previously listed here, is now partly closed: the
application has been driven end to end on a physical Android device, and §3.3.8
records both what that proved and what it did not.

**A note on suite stability.** Repeated runs exhaust the shared authentication
provider's sign-in quota; each run creates roughly forty users, and beyond the
quota sign-ins stall rather than fail. Three runs within half an hour produced
timeouts. **Every failure observed was a timeout, never a failed assertion**, and
the same files passed in isolation immediately afterwards. The 178/178-in-115s
figure is a measurement of that suite *running alone*.

### 3.3.8 Device verification

The application was driven end to end on a **physical Android device** — a
OnePlus CPH2487, connected over USB with `adb reverse` mapping the development
server and API to the handset. Every application figure in §4.3 is a capture
from that device rather than a browser.

**Table 3.7 — Behaviour verified on the device**

| Behaviour | Result |
|---|---|
| Keychain-backed session | Survives force-quit and cold start |
| Native image picker | Opens, selects and cancels correctly |
| Upload, end to end | Completes with genuine per-file progress (G-27) |
| Role routing | Teacher lands on the teacher dashboard (G-05) |
| Privacy scoping | Aarav 2 photographs, Diya 1 — correct per child (G-04) |
| Safe-area handling | Floating action button clears the tab bar against a real inset |
| Order arithmetic | Order detail renders 2 × ₹30 → ₹60, 1 × ₹99 → ₹99, total ₹159 |

**Seven defects were found that no other method had surfaced**, four of them
invisible to a type checker, a test suite and a desktop browser alike: a
truncated age line when two siblings are tagged, order-status labels breaking
mid-word, a truncated upload button, an admin photograph count including
archived rows, a notification badge clipping the tab indicator, a failed image
that never retried, and a disabled *Place order* button that gave no reason.

**The most significant is worth stating in full, because it is the clearest
argument for testing on hardware.** The application opened to a blank screen and
never recovered — no crash, no error, nothing in the logs. `app/_layout.tsx`
returns `null` while authentication loads, and the root layout is itself a route
component: returning `null` destroys the navigator, so expo-router tears down and
re-creates the root route, producing a *fresh* component instance whose `useRef`
bootstrap guard is reset. The bootstrap therefore ran again, set the loading flag
again, and rendered `null` again. **The loop ran 145 times in one session,
measured, with no exit and no symptom beyond an application that would not
paint.**

What made it expensive was that everything below the root looked guilty. The
feed's render logged continuously with correct data — 2 photographs, 3 rows,
every gate open — because React kept executing the component body during the
brief windows the tree existed. But the list's `onLayout` and `renderItem` never
fired once, because nothing survived long enough to commit. That reads exactly
like a broken list. The fix moves the guard to module scope so it outlives the
component that triggers it; the device then showed one initialisation instead of
145, and one mount instead of a remount every ~600 ms.

**This class of defect is not reachable by the other methods used in this
project.** It is a lifecycle race between a navigation library and a React ref,
with correct types, passing integration tests and a functioning browser build.

**What the device run did *not* establish.** Only Android was exercised — no iOS
build has been launched, so the keychain session and the image picker are proven
on one platform of two. Native `hive://` deep links remain unverified on either:
route-group resolution was checked through a browser URL, which does not
traverse the operating system's linking path.

---

# CHAPTER 4: EXECUTION / DEPLOYMENT DETAILS

## 4.1 Execution environment

| Component | Configuration |
|---|---|
| Runtime | Node.js 20+ (verified on 22.21.1 and 26.4.0) |
| Package manager | pnpm 9.1.0 (workspaces + Turborepo) |
| API | Express on port 4000 |
| Mobile | Expo development server on port 8081 |
| Database | Supabase PostgreSQL 15 — `hive-dev` (development), `hive-test` (tests) |
| Cache | Redis 7 in Docker, port 6379 |
| Migrations | 20, applied via `supabase db push --include-all` |
| Container | Multi-stage Dockerfile for the API |

## 4.2 Deployment steps

### 4.2.1 Local execution (verified)

```bash
docker run -d --name hive-redis -p 6379:6379 redis:7-alpine
pnpm install
# create packages/backend/.env and apps/mobile/.env from the .env.example templates
pnpm db:migrate            # supabase db push --include-all
pnpm --filter @hive/backend seed:admin
pnpm seed                  # demo dataset: schools, classes, students, photographs, orders
pnpm dev:backend
curl -s localhost:4000/health | jq     # expect "checks":{"database":"ok"}
pnpm dev:mobile
```

`"database":"ok"` is the meaningful signal — `/health` round-trips to PostgreSQL,
so 503 indicates bad credentials rather than a stopped process. *(Figure 4.1)*

Full instructions, including the anon versus service-role key distinction and the
common failure modes, are in `docs/environment-setup.md`.

### 4.2.2 Cloud deployment — not completed

**The system is not deployed.** There is no hosted URL and no distributable
application binary. A container image builds and continuous integration runs on
every push, but no hosting target was provisioned.

This is stated plainly because it is the root cause of every entry in Table 3.6.
The intended path — a container platform for the API, with the database, auth and
storage already hosted, and Expo Application Services for mobile binaries — is
described in §6.4.

## 4.3 Demonstration screenshots

**Capture conditions.** Every application figure below was taken on a **physical
Android device** (OnePlus CPH2487) running the application against the local API
over `adb reverse`, not in a browser or an emulator. All are 1240 px wide,
captured in light mode against the seeded demonstration dataset, and cropped
uniformly to remove the operating-system status bar. Nothing is composed,
retouched or recreated; where a figure shows a number, that number came from the
database.

**Table 4.2 — Application figures**

| Fig. | File | What it evidences |
|---|---|---|
| — | `app-01-login.png` | Entry point and role selection |
| — | `app-02-teacher-dashboard.png` | Class-scoped teacher view |
| **2.5** | `fig-2.5-upload-tagger.png` | **The tagging gate** — student tagger open during upload |
| 2.5b | `fig-2.5b-tagger-tagged.png` | Children tagged; the upload control becomes enabled |
| 2.5c | `fig-2.5c-upload-sent.png` | Upload completing with real per-file progress (G-27) |
| **2.6** | `fig-2.6-feed-child-switcher.png` | **The many-to-many model** — Rajesh's switcher showing Aarav and Diya |
| — | `app-03-feed-switched-child.png` | Feed after switching child — different photographs, scoping is live |
| — | `app-04-photo-detail.png` | Signed-URL rendering with a blurhash placeholder |
| 2.7a | `fig-2.7a-order-sheet-60.png` | Order sheet priced from the server catalogue |
| **2.7** | `fig-2.7-order-confirm.png` | **Monetary correctness** — 2 × ₹30 → ₹60, 1 × ₹99 → ₹99, total **₹159**, with per-item signed thumbnails. Per-line arithmetic *and* the total, against a database row of `total_cents: 15900` |
| — | `app-05-order-history.png` | Order history with per-item signed URLs |
| — | `app-06-notifications.png` | Trigger-generated notifications naming the correct child |
| — | `app-07-parent-profile.png` | Parent profile |
| — | `app-08-upload-empty.png` | Upload empty state |
| **2.8** | `fig-2.8-admin-dashboard.png` | **Administration** — non-zero counts, `totalPhotos` excluding archived rows |

**Table 4.3 — The privacy comparison (Figure 3.4)**

The two most important figures in the submission, and they are only meaningful as
a pair. Both were captured on the same device at the same resolution with the
same crop, so the comparison is between the application's behaviour and nothing
else.

| Fig. | File | Account | Result |
|---|---|---|---|
| **3.4a** | `fig-3.4a-rajesh-feed.png` | `parent.rajesh@bloom.demo` — Bloom Preschool, two children | **2 photographs**, Aarav and Diya |
| **3.4b** | `fig-3.4b-vikram-feed.png` | `parent.vikram@stars.demo` — Little Stars Academy | **1 photograph**, Arjun and Myra |

Six photographs exist in the dataset. Neither parent sees all six, and the two
sets **do not intersect**. This is the central requirement of the product
demonstrated as an observable property rather than asserted as a feature — §3.3.2
gives the same result measured at the API.

*Evidence figures 3.1, 3.2, 3.3, 3.5, 4.1, 5.1 and 5.2 are terminal and
repository captures rather than application screenshots; §3.3 and Chapter 5 carry
their results in full. Figures 2.1 and 2.3 are the architecture and
entity-relationship diagrams in Chapter 2.*

## 4.4 Demonstration video

«Link — record the flow in `docs/demo-script.md`, approximately six minutes:
teacher upload and tagging, parent feed, the privacy comparison, signed-URL
behaviour, order placement, administration dashboard.»

---

# CHAPTER 5: PROJECT EXECUTION EVIDENCE

## 5.1 Version control evidence

**Repository:** https://github.com/vexora-0/hive

*Counted at commit `d691359`, 16 August 2026. Figure 5.1 is a capture of the same
commit — its `git log --oneline` lists `d691359` at the head — so the two agree
by construction. Any commit made after that point moves the total; the figures
below are a dated snapshot, not a live count.*

| Metric | Value |
|---|---|
| Commits | 429 |
| Contributors | 4 |
| Period | 1 February – 16 August 2026 |
| Active development days | 151 |
| Source files | 219 TypeScript / TSX |
| Lines of source | ~37,200 |
| Migrations | 20 |
| Automated tests | 318 — 218 backend integration, 100 mobile unit |

| Contributor | Commits |
|---|---|
| Bhargav | 144 |
| Nagachaitanya | 99 |
| Ruthwik | 96 |
| Srujan | 82 |

*Source files and lines count `apps/mobile/src` and `packages/backend/src`,
excluding tests, generated types and configuration. Per-contributor counts
exclude merges and are normalised through `.mailmap`, which folds four
alternate author identities; they total 421, with a further 8 merge commits
making 429.*

*(Figure 5.1 — commit history. Figure 5.2 — continuous integration run.)*

Conventional commit messages are used throughout, with `security:` reserved for
remediation so the audit trail is visible in the log.

## 5.2 Weekly progress summary

**Table 5.1 — Weekly progress**
*(Condensed from `docs/PROGRESS-REPORT.md`, which holds the full record.
Supervisor remarks to be completed by the supervisor.)*

| Week | Task planned | Task completed | Supervisor remark |
|---|---|---|---|
| 1 | Project foundations, first tables | Repository, tooling, `schools`, `profiles` |  |
| 2 | Core schema and privacy model | Classes, students, parent-student mapping |  |
| 3 | Data security, backend configuration | RLS policies, triggers, environment validation |  |
| 4 | Authentication, access control, storage | JWT middleware, role guard, storage bucket |  |
| 5 | Photograph, feed and notification services | Upload, tagging, scoped feed, notifications |  |
| 6 | Ordering, idempotency, seed data | Order service, Redis idempotency |  |
| 7 | Administration API, server assembly | Administration endpoints, application bootstrap |  |
| 8 | Client infrastructure, shared hooks | API client, query configuration, stores |  |
| 9 | Authentication UI, onboarding | Login, OTP entry, onboarding carousel |  |
| 10 | Navigation, media, animation | Tab bar, image components, animations |  |
| 11 | Teacher upload experience | Upload screen, student tagger, progress |  |
| 12 | Parent feed and ordering interface | Feed, child switcher, order sheets |  |
| 13 | Notifications, administration console | Notification centre, administration screens |  |
| 14 | Audit, planning, credential hygiene | 46-defect audit; credentials moved to environment |  |
| 15 | Private storage, image processing | Private bucket, signed URLs, thumbnails, blurhash |  |
| 16 | Feed query, upload ordering, type recovery | Query rewrite; tag-before-confirm; type regeneration |  |
| 17 | Observability, containerisation, load tests | Request IDs, structured logs, Dockerfile, k6 suite |  |
| 18 | API consistency, architecture documentation | Unified error surface; architecture chapter |  |
| 19 | Test harness and feed coverage | Vitest + Supertest harness; feed tests |  |
| 20 | Photograph tests, compile blocker | Photograph tests; 22 type errors addressed |  |
| 21 | Zero type errors | Both packages compile clean |  |
| 22 | Authorization | Cross-family, cross-school and ownership checks |  |
| 23 | The order contract | Shared catalogue, integer cents, atomic creation |  |
| 24 | Demonstration data and documentation | Seed script with photographs and orders |  |
| 25 | First real execution | Migrations applied; suite run; security script run |  |

## 5.3 Supervisor interaction summary

| Review date | Key feedback received | Action taken |
|---|---|---|
|  |  |  |

*(Complete from your own records.)*

---

# CHAPTER 6: CONCLUSION & FUTURE WORK

## 6.1 Summary of implementation

Hive was delivered as a three-tier system: a React Native application for
teachers, parents and administrators; a 40-endpoint Express API in TypeScript;
and a PostgreSQL database of ten domain tables across 20 migrations, with
row-level security and triggers. Photographs are held privately and served only
through signed, expiring URLs.

The defining constraint — that the API bypasses row-level security by design —
was addressed by enforcing authorization explicitly in the service layer, with
every resource accessed by identifier checked against the caller.

## 6.2 Achievements

1. **The privacy boundary holds under adversarial probing** — cross-family 404,
   cross-school 403, same-school photograph mutation 403, each verified over HTTP
   with real tokens and reproduced from a cold start.
2. **218 automated integration tests**, executing against a real database rather
   than mocks. The 115-second timing was measured on the 178-test suite that
   preceded them; the larger suite has not been timed.
3. **A sabotage exercise that validated the suite and found a defective test** —
   one that had never verified the property its name claimed.
4. **27 of 27 attempted security checks passed**, 0 failed, 2 skipped —
   reproduced cold. One skip needs a deployment (HTTPS); the other needs
   `FORCE_500_PATH` set alongside `NODE_ENV=production`.
5. **A previously non-functional ordering flow made to work**, with correct
   integer-cent arithmetic and genuine idempotency.
6. **Approximately 1,500 lines of never-executed infrastructure removed** — the
   asynchronous queue and object-store client neither of which had ever run.
7. **An optional dependency stopped being able to take out the critical flow.**
   With Redis unreachable, `POST /orders` did not fail — it hung, for over two
   minutes. `maxRetriesPerRequest: null`, left behind by the removed queue,
   combined with the client's offline queue to produce a command that retried
   forever and never settled, so the idempotency middleware's existing failure
   path never ran. Commands now fail after two retries with the offline queue
   disabled; order submission answered in 485 ms with Redis stopped.

## 6.3 Limitations

Stated explicitly; each is evidenced in Table 3.6.

1. **The system is not deployed.** No hosted URL, no application binary.
2. **No performance measurement against a deployment exists.** The k6 suite has
   now run — locally, on 16 August — and the smoke profile passes every threshold
   with a 3,908-byte feed page (§3.3.6). What is missing is a *capacity* figure:
   at 50 virtual users the binding constraint was the project's own per-identity
   rate limiter rather than the application, so no unconstrained throughput or
   latency number has been obtained, and none has been estimated.
3. **iOS is unverified, and native deep links with it.** The application *has*
   been driven end to end on a physical Android device, which closed most of what
   this limitation formerly covered — the keychain-backed session, the image
   picker, upload progress, role routing and privacy scoping are all proven on
   hardware, and seven defects were found there that no other method surfaced
   (§3.3.8). What remains unproven: no iOS build has been launched, so those
   platform behaviours hold for one platform of two; and `hive://` deep links are
   unverified on either, because route-group resolution was checked through a
   browser URL rather than the operating system's linking path.
4. **The error-reporting pipeline has never carried an error.**
5. ~~The continuous-integration test step is advisory.~~ **Closed on 16 August,
   and worth recording because of what it turned out to be.** The step had been
   marked `continue-on-error: true` and was not merely failing to gate — it was
   *failing*, on every push, with the failure masked. The harness refused to
   start (*"SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in
   `packages/backend/.env.test`"*), the step exited 1, and the job still reported
   green. A green tick beside `Test backend` implied a guard that did not exist,
   and the only place the truth appeared was the run's annotations. Adding
   `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_KEY` and `TEST_SUPABASE_ANON_KEY`
   as repository secrets, pointing at the separate `hive-test` project, let the
   suite run: **218 tests passed across 8 files in 373.86 s in CI**. The escape
   hatch was then removed, and Figure 5.2 is the first run in which the tick
   beside `Test backend` means the suite passed. **All four checks — lint,
   typecheck, build and 218 tests — now block a merge.**
6. **Server-side HEIC conversion does not work.** `sharp`'s prebuilt libvips
   ships libheif without an HEVC decoder, and an iPhone HEIC is HEVC-coded, so
   the container parses and the pixel decode fails. Established by testing a
   real HEVC HEIC on 24 July 2026. The mobile client transcodes on the device
   instead, and the server refuses HEVC with an actionable 400. Magic-byte
   rejection, previously listed here alongside it, **is** covered — by
   `photos.test.ts` T-20.
7. **A Redis outage is reported but does not change the health status code.**
   `/health` surfaces `"cache"` alongside `"database"`, but only the database
   determines 200 against 503. This is deliberate — losing the idempotency cache
   degrades deduplication rather than availability, so the instance should stay
   in rotation — with the consequence that an orchestrator probing only the
   status code will not restart or drain an instance whose Redis is unreachable.

## 6.4 Future enhancements

**Immediate, in dependency order:**

1. **Deploy.** One step that simultaneously unblocks the HTTPS and CORS checks,
   the load tests, and device testing against a real origin.
2. **Execute the k6 suite** against that deployment and record the results.
3. **Produce iOS and Android builds** and verify the platform-specific paths.
4. ~~Make the test step blocking.~~ Done 16 August — see §6.3 item 5.

**Product:**

5. Payment gateway integration for print orders.
6. Push notifications, replacing in-app only.
7. Bulk upload with client-side compression.
8. Photograph search by child, class or date range.
9. Data-retention policy and parent-initiated deletion, appropriate to a
   child-privacy product.

---

# REFERENCES

*(IEEE style)*

[1] Supabase, "Row Level Security," Supabase Documentation. [Online]. Available:
https://supabase.com/docs/guides/database/postgres/row-level-security

[2] Supabase, "Storage: Access Control," Supabase Documentation. [Online].
Available: https://supabase.com/docs/guides/storage/security/access-control

[3] The PostgreSQL Global Development Group, *PostgreSQL 15 Documentation*, 2024.
[Online]. Available: https://www.postgresql.org/docs/15/

[4] OWASP Foundation, "OWASP API Security Top 10 — 2023," 2023. [Online].
Available: https://owasp.org/API-Security/editions/2023/en/0x00-header/

[5] OWASP Foundation, "API1:2023 Broken Object Level Authorization," 2023.
[Online]. Available:
https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/

[6] Expo, "Expo Router," Expo Documentation. [Online]. Available:
https://docs.expo.dev/router/introduction/

[7] Meta Platforms, "React Native Documentation," 2024. [Online]. Available:
https://reactnative.dev/docs/getting-started

[8] C. McDonnell, "Zod: TypeScript-first schema validation," 2024. [Online].
Available: https://zod.dev

[9] TanStack, "TanStack Query v5 Documentation," 2024. [Online]. Available:
https://tanstack.com/query/latest

[10] L. Segers, "sharp — High performance Node.js image processing," 2024.
[Online]. Available: https://sharp.pixelplumbing.com

[11] Vitest, "Vitest — Next generation testing framework," 2024. [Online].
Available: https://vitest.dev

[12] Grafana Labs, "k6 Documentation," 2024. [Online]. Available:
https://k6.io/docs/

[13] M. Jones, J. Bradley, and N. Sakimura, "JSON Web Token (JWT)," RFC 7519,
IETF, May 2015. [Online]. Available: https://www.rfc-editor.org/rfc/rfc7519

[14] R. Fielding and J. Reschke, "Hypertext Transfer Protocol (HTTP/1.1):
Semantics and Content," RFC 7231, IETF, June 2014. [Online]. Available:
https://www.rfc-editor.org/rfc/rfc7231

[15] Redis Ltd., "Redis Documentation," 2024. [Online]. Available:
https://redis.io/docs/

---

# APPENDIX

## Appendix A — User manual

**Teacher.** Sign in; select a class; tap upload; choose photographs; tag the
children who appear; confirm. Tagged children's parents are notified
automatically. **Tag before confirming** — confirmation is what makes a
photograph visible and triggers notification.

**Parent.** Sign in; the feed shows photographs of your children only. If you
have more than one child, use the child switcher to filter. Tap a photograph to
view it; use the action sheet to order prints. Order history and status are under
Orders; notifications under Alerts.

**Administrator.** The dashboard summarises schools, users, photographs and
orders. Manage schools, classes, students and users from their respective tabs;
assign teachers to classes and map parents to students.

*(Demonstration accounts and the recommended walkthrough: `docs/DEMO_USERS.md`.)*

## Appendix B — Installation guide

Prerequisites: Node.js 20+, pnpm 9.1.0, Docker (Redis only), a Supabase project.

```bash
git clone https://github.com/vexora-0/hive.git && cd hive
npm i -g pnpm@9.1.0          # corepack is absent on Node 25+
pnpm install
cp packages/backend/.env.example packages/backend/.env
cp apps/mobile/.env.example apps/mobile/.env
# populate both — see docs/environment-setup.md §2 for the key distinction
docker run -d --name hive-redis -p 6379:6379 redis:7-alpine
pnpm db:migrate
pnpm --filter @hive/backend seed:admin
pnpm seed
pnpm dev:backend    # terminal 1
pnpm dev:mobile     # terminal 2
```

**Three points that commonly cost an hour**, all documented in
`docs/environment-setup.md`:

- Run `pnpm install` after every pull; a stale module tree changes error counts.
- Migrations are not numerically contiguous; `--include-all` is required.
- The service-role key belongs only in the backend environment file. Placing it
  in the mobile environment would grant every application user full database
  access.

## Appendix C — Source code

https://github.com/vexora-0/hive

| Path | Contents |
|---|---|
| `apps/mobile/` | React Native application |
| `packages/backend/` | Express API |
| `packages/backend/tests/` | 218 integration tests |
| `apps/mobile/tests/` | 100 unit tests |
| `supabase/migrations/` | 20 migrations |
| `scripts/verify-security.sh` | Runtime security verification |
| `docs/` | Architecture, security, database, API, demonstration guide |

*The migration sequence contains deliberate gaps. Numbers were reserved per
developer in advance so that four people could add migrations in parallel without
renumbering each other's — `00019` and `00021`–`00023` were reserved and, in the
event, not needed. The directory holds 20 files, numbered `00001`–`00018`,
`00020` and `00024`.*

## Appendix D — Demonstration video

«Link»

---

# FORMATTING CHECKLIST

Apply on transfer into `Document-format.docx`:

- [ ] Times New Roman throughout
- [ ] 12 pt body, 14 pt headings
- [ ] 1.5 line spacing
- [ ] 1 inch margins, all sides
- [ ] Page numbers, bottom-centre
- [ ] Figures captioned "Figure N.N — …" beneath; tables captioned above
- [ ] List of Figures and List of Tables updated after captioning
- [ ] Table of Contents generated from Heading styles
- [ ] Every `«…»` placeholder replaced
- [ ] Export to **PDF**
