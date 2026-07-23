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
| State | Zustand (client state) · TanStack Query (server state) |
| Backend | Node.js 20+ · Express 4 · TypeScript |
| Validation | Zod at every route boundary |
| Database | PostgreSQL via Supabase · 19 migrations · row level security |
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
├── supabase/migrations/         # 19 SQL migrations
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
pnpm db:migrate                        # applies all 19 migrations
```

> Use the CLI, **not** `supabase/combined_migrations.sql` — that file stops at
> `00015` and omits four migrations, including the one that makes the photos
> bucket private.

### 4. Redis

```bash
docker run -d --name hive-redis -p 6379:6379 redis:7-alpine
```

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

**59 tests, 58 passing.** The one failure is a defect in the test rather than
the product: its fixture creates a photo row without putting a file in storage,
so the confirm endpoint correctly returns "file not found".

> ⚠️ The suite truncates every table in `beforeAll`. `.env.test` **must** point
> at a separate Supabase project. A guard refuses to run when the test and
> development URLs match — set `DEV_SUPABASE_URL` so it can.

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

Full write-up: **[`docs/security.md`](docs/security.md)**.

---

## Current state

Academic project, built in two phases. Phase 1 built the application; Phase 2
fixed what it left broken — a 46-item audit covering a broken order flow,
publicly-readable photos, missing authorization checks and 22 type errors.

What is proven to run, and what is merely written, is tracked honestly in
**[`docs/IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md)** — §4 lists
what has actually been executed, §5 what has not. Read §5 before believing any
feature works.

**Not yet deployed.** No hosted URL or APK exists; the Dockerfile and CI
workflow exist and CI runs green on every push, but nothing is hosted.

---

## Limitations and future scope

Stated plainly rather than omitted:

- **No push notifications.** Alerts are in-app only. The notification records
  and UI exist; delivery to a device does not.
- **Photo download is disabled** — deliberately. The button is visible and
  marked "Coming Soon" rather than silently inert.
- **Upload progress is approximate.** The bar moves through fixed stages rather
  than tracking bytes transferred.
- **No payment integration.** Orders are recorded, not charged.
- **Custom SMTP is not configured**, so OTP email is rate-limited by Supabase's
  default sender. Password sign-in is the reliable path.
- **No CDN configuration** beyond what Supabase Storage provides.
- Nothing has been verified **on a physical device**.

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
