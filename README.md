# Hive

A privacy-first photo sharing platform for preschools.

Teachers photograph the day and tag which children appear. Each parent sees
**only** the photos their own child is tagged in — never the class, never
another family's child. Parents can order prints of what they see.

The privacy boundary is the product. Everything else follows from it.

---

## Contents

- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Running it on the web](#running-it-on-the-web)
- [Demo accounts](#demo-accounts)
- [Testing](#testing)
- [Security](#security)
- [Current state](#current-state)
- [Limitations and future scope](#limitations-and-future-scope)
- [Team](#team)

---

## How it works

| Role | What they can do |
|---|---|
| **Teacher** | Upload photos to a class, tag the children in each one |
| **Parent** | See a feed of photos their children are tagged in, get an alert per new photo, order prints |
| **Admin** | Manage schools, classes, students, teachers and parent–child links |

A photo becomes visible to a parent only when a teacher tags their child in it.
Tagging happens *before* the photo is confirmed, so the notification a parent
receives is generated from real tags rather than an empty list — an ordering bug
that made notifications silently never arrive, now fixed and covered by a test.

Photos live in a **private** storage bucket. The app never receives a permanent
URL; it receives a short-lived signed one, generated per request, only after the
caller's access has been checked.

---

## Tech stack

| Layer | Technology |
|---|---|
| Mobile | React Native 0.81 · Expo SDK 54 · expo-router |
| Web | `react-native-web`, for verification only — see [Running it on the web](#running-it-on-the-web) |
| State | Zustand (client state) · TanStack Query (server state) |
| Backend | Node.js 20+ · Express 4 · TypeScript |
| Validation | Zod at every route boundary |
| Database | PostgreSQL via Supabase · 20 migrations · row level security |
| Storage | Supabase Storage, private bucket + signed URLs |
| Images | `sharp` — thumbnails, blurhash, dimensions, HEIC→JPEG |
| Auth | Supabase Auth — email OTP, with password sign-in |
| Idempotency | Redis, order submission only |
| Monorepo | pnpm workspaces + Turborepo |

---

## Project structure

```
hive/
├── apps/
│   └── mobile/                  # React Native + Expo
│       └── src/
│           ├── app/             # expo-router routes, grouped by role:
│           │                    #   (auth) (admin) (teacher) (parent)
│           ├── components/      # ui · media · forms · feedback · navigation
│           ├── features/        # auth · teacher · parent · admin ·
│           │                    #   orders · notifications · onboarding
│           ├── theme/           # design tokens — colours, spacing, type
│           ├── stores/          # Zustand stores
│           ├── lib/             # supabase client, api client
│           └── types/           # generated database types
├── packages/
│   └── backend/
│       ├── src/
│       │   ├── routes/          # route definitions + middleware
│       │   ├── controllers/     # request/response only
│       │   ├── services/        # business logic AND authorization
│       │   ├── validators/      # Zod schemas
│       │   ├── middleware/      # auth, roleGuard, errors, request IDs
│       │   └── scripts/         # seedAdmin, seedDemo
│       └── tests/               # Vitest + Supertest
├── supabase/migrations/         # 20 SQL migrations — `00001`–`00018`, `00020`,
│                                #   `00024`. The numbering has holes because
│                                #   ranges were reserved per plan and some were
│                                #   never used; filename order is still the
│                                #   correct apply order.
└── docs/                        # architecture, api, database, security
```

Authorization lives in the **service** layer, not the routes — see
[Security](#security) for why that matters here.

---

## Getting started

### Prerequisites

- Node.js >= 20
- pnpm 9.1.0 (`npm i -g pnpm@9.1.0`)
- Docker — for Redis only
- Two Supabase projects: one for development, one for tests

### 1. Install

```bash
pnpm install
```

### 2. Environment

```bash
cp packages/backend/.env.example      packages/backend/.env
cp apps/mobile/.env.example           apps/mobile/.env
cp packages/backend/.env.test.example packages/backend/.env.test
```

Fill in the Supabase URL and keys. Full walkthrough, including which key goes
where and why: **[`docs/environment-setup.md`](docs/environment-setup.md)**.

Two things that cost people an hour:

- The **anon/publishable** key belongs in the mobile app; the **service-role**
  key belongs only in the backend. It bypasses row level security entirely.
- `EXPO_PUBLIC_API_URL` cannot be `localhost` on a physical device — use your
  machine's LAN IP (`ipconfig getifaddr en0`).

### 3. Database

```bash
npm i -g supabase && supabase login
supabase link --project-ref <your-ref>
pnpm db:migrate                        # applies all 20 migrations
```

> `supabase/combined_migrations.sql` is now generated from the migration
> directory by `./scripts/build-combined-migrations.sh` and carries all 20 —
> it used to stop at `00015`. Prefer the CLI anyway; the combined file is for
> pasting into the SQL editor against an **empty** database.

### 4. Redis

```bash
docker run -d --name hive-redis -p 6379:6379 redis:7-alpine
# or, without Docker:  redis-server --daemonize yes
redis-cli ping    # PONG
```

Redis backs order idempotency. Ordering now survives without it — commands
fail fast and the middleware continues without deduplication — but you lose
double-submit protection, so start it. `/health` reports it as `"cache"`,
deliberately without changing the status code.

### 5. Seed and run

```bash
pnpm --filter @hive/backend seed:admin   # your admin account
pnpm seed                                # demo schools, classes, children, photos
pnpm dev:backend                         # http://localhost:4000
pnpm dev:mobile                          # Expo
```

Confirm the backend is genuinely healthy — `/health` round-trips to the
database, so a 503 means bad credentials rather than a dead process:

```bash
curl -s localhost:4000/health | jq
# { "status": "ok", "checks": { "database": "ok" }, ... }
```

---

## Running it on the web

```bash
pnpm --filter @hive/mobile exec expo start --web    # http://localhost:8081
```

The app also runs in a browser through `react-native-web`. This is how the
screens were first seen rendering on 9 August 2026 — parent feed, photo detail,
the order sheet and checkout, the teacher dashboard and upload screen, the
notification badge, and the admin console. Point `EXPO_PUBLIC_API_URL` at
`http://localhost:4000` and sign in with a password.

**Web is a verification convenience, not a target.** The product is an iOS and
Android app; nothing about the web build is styled, tested or supported as a
shipping surface. It exists because bundling proves imports resolve and nothing
more — a screen that draws is a different claim, and until 9 August nobody had
made it.

Two web-only defects had to be fixed to get there, both without changing native
behaviour:

- zustand's ESM build reads `import.meta.env.MODE`. `expo start --web` serves
  the bundle as a classic `<script>`, where `import.meta` is a **parse** error,
  so a single occurrence made the whole bundle unparseable — 200 on the bundle
  request, an empty root element, and a completely silent console.
  `babel-preset-expo`'s web-only `unstable_transformImportMeta` rewrites it.
- `expo-secure-store` has no web implementation, so every session write threw
  and was swallowed. Sign-in appeared to succeed and bounced straight back to
  login. Web now stores the session in `localStorage`; native still uses the
  keychain.

Three dependencies were added for the web build: `react-dom` and
`@lottiefiles/dotlottie-react` (required by existing dependencies to build for
web) and `@react-navigation/native` (an unmet peer).

---

## Demo accounts

`pnpm seed` creates two schools, four classes, nine children and eight users.
Credentials and the intended demo path: **[`docs/DEMO_USERS.md`](docs/DEMO_USERS.md)**.

The account to demo is the parent with **two children** — it exercises the child
switcher, and one photo is tagged with both children to show the feed
de-duplicating it.

Sign in with **"Use a password instead"**. The demo accounts use `.demo`
addresses, which cannot receive an OTP email.

---

## Testing

```bash
pnpm test          # Vitest + Supertest against the test Supabase project
```

**178 tests across 8 files.** The suite talks to a **real, remote** Supabase
project — `hive-test` — over the network: it signs users in to mint real JWTs,
writes real rows and puts real objects in storage. There is no local database
and no mocking layer. A full pass takes about 2.5 minutes.

That project is shared between CI and every developer, which is the source of
the only known instability:

> ⚠️ **Do not start a run while another is in flight.** Check first:
> `pgrep -fl "vitest.mjs run"`.
>
> Until `e4e689e`, each test file truncated every table in a global
> `beforeAll`, so two overlapping runs deleted each other's fixtures mid-test —
> roughly one run in five failed, in a different place each time, and passed on
> a re-run. Cleanup is now scoped to the schools the running process created,
> so concurrent runs no longer corrupt each other's data.
>
> They still **exhaust the shared GoTrue sign-in quota**: each run creates
> around 40 auth users, and once the quota is hit sign-ins stall rather than
> fail. This was reproduced on 9 August simply by running the suite three
> times inside half an hour, with `pgrep` checked clear before each. The first run was
> 177/178 with one 30 s timeout; by the third, every one of the 21 tests in
> `orders.test.ts` timed out at 30 s and the run took over fifteen minutes
> instead of two and a half. **Every failure observed was a timeout, never a
> failed assertion**, and the same files passed in isolation immediately
> afterwards. CI wants its own project, or a workflow-level concurrency gate.
>
> The practical consequence: a red run tells you very little on its own. Re-run
> the failing file alone, after a pause, before believing it.

The suite also refuses to run when the test and development URLs match — set
`DEV_SUPABASE_URL` in `.env.test` so the guard can compare them.

---

## Security

The backend queries through the Supabase **service-role** key, which bypasses
row level security by design. Row level security therefore protects only the few
queries the mobile app makes directly. **Every API endpoint has to enforce
authorization itself**, in the service layer.

Three layers, each with a different job:

| Layer | Purpose |
|---|---|
| `RoleGate` (mobile) | UX only — never trusted. Stops the wrong screen rendering. |
| `roleGuard` + ownership checks (server) | The real control. Verified per request. |
| Row level security (migration `00011`) | Last line, for direct client queries. |

Verified against a running instance, not by code review:

- A teacher requesting another school's classes **or student roster** gets `403`
- A parent requesting an admin endpoint gets `403`
- A signed photo URL works; the same URL with the token stripped does not
- Two parents at different schools have **zero overlap** in their feeds
- Request logs carry a correlation ID and contain no tokens or client IPs

Two of those were re-checked by hand on 9 August 2026 against the running dev
backend: a feed photo's signed URL returned 200 and the same URL with `?token`
removed returned 400; a Bloom teacher requesting Little Stars' student roster
returned 403 `FORBIDDEN`, and her own school's roster returned 200. The rest of
the list dates from the 1 August `verify-security.sh` run and has **not** been
re-run since — see [Limitations](#limitations-and-future-scope).

Full write-up: **[`docs/security.md`](docs/security.md)**.

---

## Current state

*As of 9 August 2026.*

Academic project, built in two phases. Phase 1 built the application; Phase 2
fixed what it left broken — a 46-item audit covering a broken order flow,
publicly-readable photos, missing authorization checks and 22 type errors.

Checks, re-run rather than copied forward:

| Check | Result |
|---|---|
| `pnpm typecheck` | Clean, both packages |
| `pnpm lint` | 0 errors, 27 warnings (3 backend, 24 mobile — mostly unused imports) |
| `pnpm build:backend` | Succeeds |
| `pnpm test` | 178 tests, 8 files. Not observed fully green on 9 August — every failure was a 30 s timeout from the shared test project's sign-in quota, and the affected files passed in isolation. See [Testing](#testing) |

**9 August was a defect round**, not a feature round: 25 commits across
ordering, upload, auth, notifications, the admin console, the API error surface
and the web build. The starting symptom was that the app "wasn't
running properly", and the first cause was infrastructure rather than code — the
`hive-dev` Supabase project had stopped resolving (NXDOMAIN), so the backend
could reach no database at all. It was restored, and migration `00024` has since
been applied to it and verified.

The defects worth naming, because they each made a whole flow unusable:

- **No order could be placed.** The order sheet sent `notes: null` for the
  untouched optional field and the Zod schema used `.optional()`, which accepts
  `undefined` but not `null` — so every order without a note returned 400. The
  idempotency middleware then cached that 400 against the key for 24 hours, so
  retrying with a corrected payload replayed the original failure. The client
  now omits the key when blank, the schema takes `.nullish()`, and only 2xx is
  cached.
- **The admin fulfilment queue was unreachable.** `GET /admin/orders` threw 400
  when the caller had no school of their own, which is exactly how the seeded
  platform admin is created — and the screen rendered that 400 as "No orders
  yet". A school-less admin now gets every school's orders.
- **A real parent could never order.** Nothing ever set `profiles.school_id`;
  the signup trigger cannot know a school, and `createOrder` refuses a parent
  without one. Only the demo seed, which writes it directly, hid this. Linking
  a parent to a student now back-fills it.
- **The upload pipeline could file one child's photo under another child's
  class.** multer's temp filename was `tmp_${Date.now()}` — millisecond
  resolution, no per-request entropy — and the client uploads three photos at
  once. Two requests entering in the same millisecond shared a path, and
  `diskStorage` truncates on open. Now a UUID.
- **Tagging was labelled "Optional".** The parent feed is an inner join on
  `photo_student_tags` and nothing in the app can tag a photo after upload, so
  an untagged photo reached no parent and could never be fixed. It is now
  required, with the reason shown.
- **Auth could strand a user**: a cold-start hang that held a blank splash
  screen indefinitely, a sign-out that left the session in SecureStore, and any
  401 — including a token momentarily stale at the refresh boundary — signing
  the user out mid-task.

Four more were found only by driving the running app in a browser, none of them
visible from reading the code: every order card read "0 items" because the list
endpoints never selected the items; all three seeded orders displayed the same
`#F0000000`, because four call sites truncated the UUID to its first eight
characters and the seed's ids share that prefix; the shipping-address error was
unreachable, since it rendered on a flag only the submit handler set and the
disabled button made that handler unreachable; and a cold load of `/orders`
landed on the feed, because a route group contributes nothing to the URL so
`(admin)/orders` claimed it first.

A first fix round introduced three regressions of its own, found by an
adversarial review of that round and fixed: cursor pagination silently dropping
rows (the cursor was round-tripped through `new Date().toISOString()`, which
truncates to milliseconds, while Postgres stores microseconds), a rate-limit
bypass in which an unauthenticated caller sending a fresh random bearer token
per request got a new empty bucket every time, and WebP accepted at three
format gates then rejected at the fourth.

**Most of this round is guarded by review and typecheck, not by tests.** The
only coverage it added is `tests/cursor.test.ts` — 23 cases on the pagination
fix. Nothing else in the round has an automated guard.

What is proven to run, and what is merely written, is tracked in
**[`docs/IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md)** — §4 lists
what has actually been executed, §5 what has not. Read §5 before believing any
feature works.

---

## Limitations and future scope

Stated plainly rather than omitted. The first four are about what has *not* been
proven, and matter more than the feature gaps below them.

- **Nothing has been seen running on a real device.** The screens were driven
  end to end in Chrome on 9 August, through `react-native-web` — that is the
  whole of the evidence. No iOS or Android build has been launched, no
  simulator run is recorded, and web is not the target platform. Anything
  platform-specific — the keychain-backed session, the image picker, deep
  links, `AppState` transitions — is unverified where it actually ships.
- **Nothing is deployed.** No hosted URL, no APK, no `eas.json`. The Dockerfile
  and the CI workflow exist; nothing is hosted. This is also what blocks the
  HTTPS and CORS checks in `verify-security.sh` and the k6 load suite.
- **`scripts/verify-security.sh` has not been re-run since 1 August**, when it
  reported 26 passed, 0 failed, 3 skipped. The 9 August round changed the rate
  limiter, the CORS configuration and the error handler — three of the things
  that script exists to check. Treat that 1 August result as stale, not as
  current evidence.
- **The CI test step is `continue-on-error: true`.** It exists and it runs, but
  it cannot turn a pull request red until `TEST_SUPABASE_URL`,
  `TEST_SUPABASE_SERVICE_KEY` and `TEST_SUPABASE_ANON_KEY` exist as repository
  secrets. Until then the 178 tests guard nothing on a pull request. Lint,
  typecheck and build are blocking.

Feature gaps, deliberate or unstarted:

- **No push notifications.** Alerts are in-app only. The notification records
  and UI exist; delivery to a device does not.
- **Photo download is disabled** — deliberately. The button is visible and
  marked "Coming Soon" rather than silently inert.
- **No payment integration.** Orders are recorded, not charged.
- **Custom SMTP is not configured**, so OTP email is rate-limited by Supabase's
  default sender. Password sign-in is the reliable path.
- **No CDN configuration** beyond what Supabase Storage provides.
- **Sentry is wired but has never received an error.**
- **Losing Redis loses double-submit protection.** The idempotency middleware
  talks to Redis before the order handler, so an outage disables order
  deduplication — recoverable, but real. It used to be worse: `maxRetriesPerRequest:
  null`, left behind by the removed BullMQ, meant commands queued forever and
  `POST /orders` **hung** rather than failing, observed still open after two
  minutes on 9 August. Fixed in `1f09cf8`; `/health` now reports the cache.

Upload progress used to be listed here as approximate. It no longer is: the
client uploads with `XMLHttpRequest` and reports `event.loaded / event.total`
from `xhr.upload.onprogress`, so the bar tracks bytes actually transferred.

---

## Documentation

Everything else lives in **[`docs/`](docs/README.md)** — architecture, database
schema, API reference, user flows, security model, the 46-item audit this phase
was built from, and the twelve plans that addressed it.

---

## Team

Group 145

- Bhargav M
- Ruthwik Chikoti
- Naga Chaitanya Varma
- Dharma Srujan Reddy

**Project Advisor:** Lakshya Jain

---

## Licence

Developed as part of an academic course. Not licensed for production use.
