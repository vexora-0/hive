# Hive — Development Progress Report

**Team:** Ruthwik · Bhargav · Srujan · Nagachaitanya
**Project:** Hive — a privacy-first photo sharing platform for preschools
**Repository:** github.com/vexora-0/hive
**Phase 1 development period:** 1 February 2026 – 1 May 2026

---

## About the project

Hive lets preschools share classroom photos with parents without compromising any child's privacy. Teachers upload photos organised by class and tag which children appear in each one. Each parent then sees a feed containing **only** photos their own child is tagged in — never another family's. Parents can also order prints, frames and albums.

Administrators manage the underlying structure: schools, classes, students, teacher assignments, and the parent-to-child links that drive the entire privacy model.

**Stack:** React Native (Expo SDK 54) · Node.js + Express + TypeScript · PostgreSQL via Supabase for data, authentication and object storage · Zustand and TanStack Query for client state · pnpm workspaces with Turborepo.

---

## Note on this report and the repository history

The original local Git repository was lost when the development laptop failed. The code survived and was recovered, but the commit history did not. On 3 March 2026 the recovered codebase was uploaded to GitHub as a single snapshot commit (`1bfe1d9`). That upload was a **recovery action, not a development milestone**.

This report and the accompanying Git history were reconstructed afterwards from the recovered codebase.

- **The code is authentic.** Every file is byte-for-byte what the team wrote, verified against the recovered snapshot.
- **Commit boundaries, dates and per-commit authorship are reconstructed**, not recovered. They reflect the team's account of how work was divided, mapped onto the module dependency order the code itself demonstrates.
- **The original snapshot is preserved** on the `backup/original-import` tag and branch and in an offline bundle, so the pre-reconstruction state remains fully recoverable.
- Because the 3 March snapshot already contained the complete application, commits dated after it describe code that existed by that date. The dates express the development sequence, not verified timestamps.

This is stated plainly so the history is read for what it is: an accurate record of *what* was built and by whom, with reconstructed timing.

---

## How we worked

We ran the backend and mobile tracks in parallel from week one rather than finishing one before starting the other, so nobody sat idle waiting on another layer and integration problems surfaced early.

| Member | Primary areas |
|---|---|
| **Ruthwik** | Backend architecture and API services — photos, feed, orders, storage, jobs, server assembly; and the mobile service and hook layer consuming those APIs |
| **Bhargav** | Mobile application — design system, component library, navigation, media, feature screens, app shell; repository tooling |
| **Srujan** | Data layer across the stack — schema, migrations, RLS, triggers, indexing, validation on server and client, data-entry components |
| **Nagachaitanya** | Authentication and authorisation end to end, notifications, admin console (API and UI), client–server integration |

Areas overlap deliberately: Ruthwik wrote both the order API and the client hooks calling it; Srujan owned validation on both sides; Nagachaitanya owned authentication from the database trigger through to the login screen.

---

# Week 1 — Project Foundations & First Tables

**Dates:** 1 February 2026 – 7 February 2026
**Commits:** 12 — Ruthwik 1, Bhargav 4, Srujan 3, Nagachaitanya 3

## Phase objective

Establish the repository both applications would live in, and begin the relational schema. The data model came first because nothing could be built against an unsettled schema.

## Individual contributions

**Bhargav** set up the monorepo — pnpm workspace layout, Turborepo task graph — and scaffolded the Expo application with Expo Router, the eight path aliases used throughout the client, and the icon and splash assets. **Nagachaitanya** configured the shared ESLint, Prettier and commitlint tooling, and designed the `profiles` table linking to Supabase `auth.users`. **Ruthwik** scaffolded the backend package: strict TypeScript with `@/*` aliases, the dependency set, and build and watch scripts. **Srujan** began the schema with the required Postgres extensions, the `schools` table as the top-level tenant, and `classes`.

## Important technical implementation

The monorepo uses pnpm workspaces with Turborepo rather than a single package, so the API and the app can be built and typechecked independently while sharing lint and commit conventions. Both packages run TypeScript in strict mode from the first commit.

## Issues and challenges

Deciding whether classes should belong to schools or exist independently. Scoping them to a school made every downstream authorisation check simpler, since a teacher's school membership then implies which classes they can touch.

## Testing and validation

Migrations applied against a clean Supabase project; both packages confirmed to install and typecheck.

## Relevant commits

```
chore: initialize pnpm monorepo with turborepo pipeline
chore: add eslint and prettier configuration
chore: enforce conventional commits and ignore rules
chore: scaffold express backend package
chore: scaffold expo application with expo router
chore: add mobile environment template and ignore rules
chore: add app icons, splash and lottie assets
feat(db): enable required postgres extensions
feat(db): add schools table
feat(db): add profiles table linked to supabase auth
feat(db): add classes table
```

## End state

A working monorepo and the first three tables of the schema.

## Next week

The privacy model — parent-student mappings and photo tagging.

---

# Week 2 — Core Schema & Privacy Model

**Dates:** 8 February 2026 – 14 February 2026
**Commits:** 12 — Ruthwik 1, Bhargav 2, Srujan 7, Nagachaitanya 1

## Phase objective

Complete the relational schema, in particular the tables that make the privacy guarantee structural rather than procedural.

## Individual contributions

**Srujan** built the remaining core tables: `students`, `parent_student_mappings` with its `UNIQUE (parent_id, student_id)` constraint, `photos` with its processing status, and `photo_student_tags` — the pivot that determines who can see what. Then the row level security policy set, the trigger set and the index strategy. **Ruthwik** designed `orders` and `order_items`, including the idempotency key that would later prevent duplicate submissions. **Nagachaitanya** designed the `notifications` table with its type check constraint and `jsonb` payload for deep-link data. **Bhargav** started the design system with the colour palette and the spacing and typography scales.

## Important technical implementation

The privacy model is enforced structurally: a parent reaches a photo only through `parent_student_mappings` to `student` to `photo_student_tags`. There is no direct parent-to-photo relationship, so the guarantee is a property of the schema rather than something a query can accidentally bypass.

## Issues and challenges

The first sketch attached photos to classes and derived parent access from enrolment. That broke for photos where only some children in the class appear. Replacing it with per-photo student tagging was the most important design correction of the project.

## Testing and validation

Foreign key and unique constraints verified by deliberate violation — duplicate parent-student pairs and orphaned class references were both correctly rejected.

## Relevant commits

```
feat(db): add students table
feat(db): add parent-student mapping for photo visibility
feat(db): add photos table with processing status
feat(db): add photo-student tags as the privacy pivot
feat(db): add orders and order items tables
feat(db): add in-app notifications table
feat(theme): add colour palette with semantic ramps
feat(theme): add spacing scale and typography system
feat(db): add row level security policies for all tables
feat(db): add updated-at and parent notification triggers
perf(db): add composite indexes for feed and cursor pagination
```

## End state

The complete ten-table schema with row level security, triggers and indexes applied.

## Next week

Backend configuration and the server's error-handling foundation.

---

# Week 3 — Data Security & Backend Configuration

**Dates:** 15 February 2026 – 21 February 2026
**Commits:** 12 — Ruthwik 5, Bhargav 2, Srujan 3, Nagachaitanya 1

## Phase objective

Close the signup gap left by Supabase Auth owning `auth.users`, and build the backend's configuration, logging and error-handling foundation.

## Individual contributions

**Nagachaitanya** implemented the `handle_new_user` trigger creating a `profiles` row automatically when Supabase Auth inserts into `auth.users`, reading the intended role from signup metadata. **Ruthwik** built the environment configuration validated with Zod at startup, Winston logging with JSON in production, the standard response envelope, and the global error handler with its `AppError` class. **Srujan** added the storage bucket migration, relaxed the photo hash constraint for client uploads, and wrote the Zod request validation middleware. **Bhargav** completed the design tokens with the cross-platform shadow system and the unified theme export.

## Important technical implementation

Environment configuration is validated at startup, so the process refuses to boot on bad config rather than failing at first request. The shadow system includes a `platformShadow` helper reconciling the iOS `shadow*` model with Android `elevation`, so no component needs a `Platform.select`.

## Issues and challenges

A user could authenticate before their profile row existed, leaving the client with a session but no role. The `handle_new_user` trigger closed this by creating the profile in the same transaction as the auth user, with the role read from signup metadata and a defensive fallback to `parent`.

## Testing and validation

Trigger verified by creating an auth user and confirming a matching profile row with the correct role. Error handler verified against thrown `AppError`, Zod errors and unexpected exceptions.

## Relevant commits

```
feat(db): create profile automatically on user signup
feat(db): add photos storage bucket
fix(db): make photo hash nullable for client uploads
feat(config): add validated environment configuration
feat(config): add structured winston logging
feat(config): add supabase admin client
feat(theme): add cross-platform shadow system
feat(theme): add shared constants and unified theme export
feat(api): add standard response envelope
feat(api): add global error handler with AppError
feat(api): add zod request validation middleware
```

## End state

A backend that validates its own configuration and returns consistent, well-formed errors.

## Next week

Authentication middleware and the storage layer.

---

# Week 4 — Authentication, Access Control & Storage Layer

**Dates:** 22 February 2026 – 28 February 2026
**Commits:** 12 — Ruthwik 4, Bhargav 2, Srujan 2, Nagachaitanya 3

## Phase objective

Secure the API with token verification and role-based access, and prepare the storage layer for photo uploads.

## Individual contributions

**Nagachaitanya** built the authentication middleware, which verifies the Bearer token against Supabase then loads the user's profile to attach role and school to the request, plus the role guard and the rate limiters. **Ruthwik** built the storage client configuration, signed URL and Supabase Storage helpers, the hashing helper, and the multipart upload middleware with its MIME and size gates. **Srujan** wrote the photo upload and tagging validation schemas. **Bhargav** built the first UI primitives — `Text` with its twelve-variant scale, `Button` and `TextInput` with focus and error states.

## Important technical implementation

Authorisation runs at two layers: the middleware attaches role and school to every request and the guard rejects wrong-role callers before a controller runs; the service layer then re-checks resource ownership. Row level security remains the last line for any query reaching the database directly.

## Issues and challenges

Each authenticated request makes two round trips — one to verify the token, one to load the profile. Accepted for now and recorded as a scaling concern rather than optimised prematurely.

## Testing and validation

Auth middleware exercised with a missing header, a malformed token, an expired token and a valid token, confirming 401 for the first three and correct role attachment for the last. Role guard verified by calling a teacher endpoint as a parent.

## Relevant commits

```
feat(auth): add supabase jwt authentication middleware
feat(auth): add role-based access guard
feat(ui): add text component with typography variants
feat(ui): add button and text input primitives
feat(api): add global and auth rate limiting
feat(storage): add s3 and redis client configuration
feat(storage): add signed url and supabase storage helpers
feat(utils): add sha-256 hashing helper
feat(photos): add photo upload and tagging schemas
chore(auth): reserve server-side auth validation module
feat(photos): add multipart upload middleware
```

## End state

A secured API surface ready for feature endpoints.

## Next week

The photo, feed and notification services.

---

# Week 5 — Photo, Feed & Notification Services

**Dates:** 1 March 2026 – 7 March 2026
**Commits:** 12 — Ruthwik 3, Bhargav 4, Srujan 2, Nagachaitanya 2

## Phase objective

Build the two services that carry the product: photo upload with tagging, and the parent feed that enforces the privacy boundary.

## Individual contributions

**Ruthwik** implemented the photo service handling the full lifecycle — creating a record scoped to the teacher's school, persisting the file, and tagging students with school-boundary verification — plus the feed service, which resolves a parent's children first and only then finds photos tagged with those students. Added controllers and routes for both. **Nagachaitanya** built the notification service with unread-first ordering and unread counts, plus its controller and routes. **Bhargav** added the card, avatar and badge components and the layout wrappers.

## Important technical implementation

The feed applies the privacy boundary at the start of the query rather than filtering afterwards. Both list endpoints paginate on `(created_at, id)` encoded base64url rather than by offset, so a page cannot shift or duplicate rows when new uploads arrive mid-scroll.

## Issues and challenges

A photo tagged with two siblings appeared twice in a parent's feed. Deduplicating by photo ID after the tag join fixed the visible symptom, though the interaction between deduplication and page-size accounting remained imperfect and is recorded as known work.

## Testing and validation

Feed verified with two parent accounts at the same school: each saw only their own child's photos, with no overlap. Tagging verified to reject students from another school.

## Relevant commits

```
chore(storage): add local uploads directory
feat(ui): add card component with elevation variants
feat(ui): add avatar and badge components
feat(photos): implement photo service with tagging and cursor pagination
feat(photos): add photo controller and routes
feat(layout): add safe area and screen container
feat(layout): add keyboard avoiding wrapper
feat(feed): implement parent feed service scoped to tagged children
feat(notifications): implement notification service with unread counts
feat(feed): add feed controller and routes
feat(notifications): add notification controller and routes
```

## End state

The core product loop working at the API level.

## Next week

Ordering, idempotency and demo data.

---

# Week 6 — Ordering, Idempotency & Seed Data

**Dates:** 8 March 2026 – 14 March 2026
**Commits:** 12 — Ruthwik 2, Bhargav 3, Srujan 4, Nagachaitanya 2

## Phase objective

Build the ordering flow with server-owned pricing, and protect it against duplicate submission.

## Individual contributions

**Ruthwik** built the Redis-backed idempotency middleware and the order service, which prices every line item server-side from a fixed table and verifies that every referenced photo is tagged with one of the requesting parent's children. **Srujan** wrote the order and admin validation schemas, produced the migration guide and combined migration script, and wrote the development seed data. **Bhargav** completed the feedback component set — skeleton shimmer, empty state, offline banner and error boundary.

## Important technical implementation

Order creation requires an `X-Idempotency-Key`. The middleware takes a Redis lock, caches the response for 24 hours and returns the cached result on retry, so a network retry cannot produce a duplicate order. A concurrent request with the same key receives 409 rather than racing.

## Issues and challenges

The original design had no protection against a client retrying a request that had actually succeeded. The idempotency middleware was added specifically for this and became the most involved piece of the week. Separately, the seed script inserts `profiles` rows directly, but those reference `auth.users`, which Supabase Auth owns — so it could not run end to end. Recorded as outstanding.

## Testing and validation

Idempotency verified by replaying an identical order request and confirming a single row in `orders`. Cross-parent order attempts confirmed rejected with 403.

## Relevant commits

```
feat(feedback): add skeleton shimmer and empty state
feat(feedback): add offline banner
feat(feedback): add top-level error boundary
feat(orders): add order validation schemas and product types
docs(db): add migration guide for hosted supabase
chore(db): add combined migration script and cli config
feat(db): add development seed data
feat(orders): add redis-backed idempotency middleware
feat(orders): implement order service with server-side pricing
feat(admin): add admin validation schemas
feat(orders): add order controller and routes
```

## End state

An ordering API that cannot be double-charged or used to order another family's photos.

## Next week

The admin console API and server assembly.

---

# Week 7 — Admin API, Workers & Server Assembly

**Dates:** 15 March 2026 – 21 March 2026
**Commits:** 12 — Ruthwik 3, Bhargav 3, Srujan 2, Nagachaitanya 3

## Phase objective

Complete the API surface with the admin endpoints, add background workers, and bring the backend up as a running process.

## Individual contributions

**Nagachaitanya** built the admin service covering dashboard statistics, user search and role management, school and class creation, student management and parent-to-student mapping by email lookup, plus the controller and routes. **Ruthwik** built the school endpoints, both background workers — image processing with Sharp for thumbnails, blurhash and dimensions, and notification dispatch — and assembled the Express application with Helmet, CORS, body limits, rate limiting, request logging and a health check. **Srujan** built the mobile Supabase client with its `expo-secure-store` adapter and generated the database types from the live schema. **Bhargav** built the authenticated API client and the React Query configuration.

## Important technical implementation

Supabase sessions persist through a `SecureStore` adapter, so refresh tokens live in the iOS Keychain or Android Keystore rather than plain AsyncStorage. The API client attaches the current access token to every request and signs the user out on a 401.

## Issues and challenges

The image processing and notification workers were written and start correctly on boot, but connecting them to the upload flow was not completed. Photos therefore reach `ready` without thumbnails. Recorded as outstanding work.

## Testing and validation

Backend started against the live Supabase project; `/health` confirmed responsive and all route modules mounted without collision. Admin endpoints exercised with curl across school creation, class creation, teacher assignment and parent mapping.

## Relevant commits

```
feat(admin): implement admin service for schools, users and students
feat(admin): add admin controller and routes
feat(lib): add supabase client with secure store adapter
feat(types): add generated database and environment types
feat(schools): add school class and student endpoints
feat(jobs): add image processing worker for thumbnails and blurhash
feat(jobs): add notification dispatch worker
feat(lib): add authenticated api client
feat(lib): configure react query defaults
feat(api): assemble express application with security middleware and routes
feat(utils): add client logger and retry with backoff
```

## End state

A complete, running API across five domains — 22 endpoints.

## Next week

Client infrastructure and shared hooks.

---

# Week 8 — Client Infrastructure & Shared Hooks

**Dates:** 22 March 2026 – 28 March 2026
**Commits:** 12 — Ruthwik 3, Bhargav 2, Srujan 2, Nagachaitanya 4

## Phase objective

Give the mobile application the shared foundations every screen would need: utilities, hooks, global state and a bootstrapped administrator.

## Individual contributions

**Bhargav** built the client logging and retry helpers, the input validators and date formatting, the client-side file hashing helper, and the global application store. **Ruthwik** built the shared hooks — network status backed by NetInfo, app-state foreground detection, debounce and a double-submit guard — and the server bootstrap with graceful shutdown. **Srujan** added the admin seeding script. **Nagachaitanya** began the client auth layer with the auth store holding session, profile and role.

## Important technical implementation

The server closes connections in order on shutdown — HTTP first to stop accepting work, then workers, then Redis — so an in-flight image job is not killed mid-write on deploy. The retry helper uses exponential backoff and is applied to every read-only API call, so a flaky connection recovers rather than surfacing an error.

## Issues and challenges

`expo-secure-store` throws in the web target. The storage adapter wraps every call in try/catch so the web build degrades rather than crashing.

## Testing and validation

Session persistence verified by force-quitting and relaunching the app. Retry behaviour verified by toggling airplane mode mid-request.

## Relevant commits

```
feat(utils): add input validators and date formatting
feat(utils): add client-side file hashing
feat(api): add server bootstrap with graceful shutdown
feat(hooks): add network status and app state hooks
feat(hooks): add debounce and double-submit guard hooks
feat(stores): add global application store
chore(scripts): add admin user seeding script
feat(auth): add auth store with session and role state
feat(auth): add supabase auth service
feat(auth): add session listener hook
feat(auth): add otp lifecycle hook with lockout
```

## End state

A client with its shared infrastructure in place, ready for the authentication flow.

## Next week

Authentication UI and onboarding.

---

# Week 9 — Authentication UI & Onboarding

**Dates:** 29 March 2026 – 4 April 2026
**Commits:** 12 — Ruthwik 2, Bhargav 5, Srujan 2, Nagachaitanya 2

## Phase objective

Build the sign-in journey end to end: OTP entry, session handling, role-based routing and first-run onboarding.

## Individual contributions

**Nagachaitanya** built the auth service wrapping OTP send, OTP verify and password sign-in, the session hook that listens for Supabase auth state changes and routes by role, and the login and OTP verification screens. **Srujan** built the `OTPInput` component with its six-cell layout, auto-advance, paste handling and shake-on-error. **Bhargav** built the onboarding carousel and its persisted completion state. **Ruthwik** wired the entry-point state resolution.

## Important technical implementation

On `SIGNED_IN` the session hook fetches the user's profile and redirects to the route for their role. If no profile exists yet the user is sent to onboarding instead, which handles the window between auth user creation and the trigger completing. The OTP hook enforces a resend cooldown and a lockout after three failed attempts, with countdown timers cleaned up on unmount.

## Issues and challenges

An early version left a stale session in memory after sign-out, so the next launch briefly rendered an authenticated screen. Clearing the store explicitly in the `SIGNED_OUT` branch fixed it. Keyboard occlusion on smaller Android screens was resolved with the shared `KeyboardAvoid` wrapper.

## Testing and validation

Full auth walkthrough on a physical Android device: signup with a real email, OTP received and verified, profile created by the trigger, redirect to the correct role route. Wrong OTP confirmed to shake and decrement attempts, with lockout after three failures.

## Relevant commits

```
feat(ui): add six-digit otp input component
feat(auth): add auth stack layout and login screen
feat(auth): add otp verification and onboarding screens
feat(onboarding): add onboarding slide component and content
feat(onboarding): persist onboarding completion state
feat(nav): add custom tab bar
feat(nav): add header bar and typed route map
feat(media): add blurhash-backed image component
feat(media): add polaroid card and masonry grid
feat(media): add full-screen photo viewer
feat(animation): add lottie wrapper and shake animation
```

## End state

A user can sign in and be routed to the right place.

## Next week

Navigation, media and animation components.

---

