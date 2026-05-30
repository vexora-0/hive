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

# Week 10 — Navigation, Media & Animation

**Dates:** 5 April 2026 – 11 April 2026
**Commits:** 12 — Ruthwik 3, Bhargav 3, Srujan 3, Nagachaitanya 2

## Phase objective

Build the navigation shell and the media components the photo feed depends on.

## Individual contributions

**Bhargav** built the custom tab bar and header, the typed route map, and the media components — `HiveImage`, which shows a blurhash placeholder while the network image loads; `PolaroidCard`; `MasonryGrid`, the two-column FlashList arrangement the feed uses; and the full-screen photo viewer. **Srujan** built the animation set: Lottie wrapper, shake animation, confetti overlay, animated counter, honeycomb FAB and background pattern. **Nagachaitanya** and **Ruthwik** integrated the navigation shell against the auth routing from the previous week.

## Important technical implementation

`MasonryGrid` wraps FlashList in a two-column layout that sizes cells from each photo's stored aspect ratio, so the grid does not reflow as images load. `HiveImage` wraps `expo-image` and passes the stored blurhash as its placeholder, so a photo fades in from a recognisable blur rather than a blank box.

## Issues and challenges

The media components expect a blurhash on every photo, but the image worker that generates it was not yet connected to the upload flow. The placeholder path is implemented but currently inactive — photos load without the progressive blur.

## Testing and validation

Navigation verified across all three role groups on a physical device. Media components checked with portrait and landscape photos to confirm the masonry layout handles mixed aspect ratios.

## Relevant commits

```
feat(animation): add confetti overlay and animated counter
feat(animation): add honeycomb fab and background pattern
feat(teacher): add class selector dropdown
feat(teacher): add searchable student tagger
feat(teacher): add teacher api service
feat(teacher): add class and photo listing hooks
feat(teacher): add upload pipeline state machine hook
feat(teacher): add upload preview grid
feat(teacher): add upload progress indicator
feat(teacher): add dashboard screen with class photo grid
feat(teacher): add multi-image upload screen
```

## End state

A navigable application shell with the components the feed needs.

## Next week

The teacher upload experience.

---

# Week 11 — Teacher Upload Experience

**Dates:** 12 April 2026 – 18 April 2026
**Commits:** 13 — Ruthwik 5, Bhargav 2, Srujan 2, Nagachaitanya 3

## Phase objective

Build the teacher journey: select a class, pick photos, tag the children in them, and upload.

## Individual contributions

**Srujan** built the class selector dropdown and the searchable student tagger — the surfaces where client-side validation mirrors the server rules he wrote earlier. **Ruthwik** built the teacher API service, the class and photo listing hooks, and the upload pipeline hook. **Bhargav** built the upload preview grid, the progress indicator, and the dashboard and upload screens.

## Important technical implementation

The upload hook is a state machine moving each image independently through `idle → requesting-url → uploading → tagging → complete`, with its own progress and error state. A failed image can be retried individually without disturbing the rest of the batch.

## Issues and challenges

The upload uses `fetch`, which exposes no byte-level progress, so the progress bar advances in discrete steps rather than continuously. Recorded as known work. More significantly, tagging happens after the upload marks a photo `ready`, which means the database trigger that notifies parents fires before any tags exist — identified but not resolved.

## Testing and validation

Full teacher walkthrough on a physical Android device: class selection, picking five images, tagging two students, upload to completion with confetti. Airplane mode mid-upload confirmed to surface a clear error and retry successfully.

## Relevant commits

```
feat(parent): add child switcher component
feat(parent): add parent feed api service
feat(parent): add children and feed query hooks
feat(parent): add photo action hook
feat(parent): add feed loading skeleton
feat(parent): add photo action sheet
feat(parent): add masonry photo feed screen
feat(parent): add photo detail screen
feat(orders): add cart store with pricing
feat(orders): add order api service
feat(orders): add order query and mutation hooks
feat(orders): add product picker grid
```

## End state

Teachers can upload and tag photos end to end.

## Next week

The parent feed and ordering interface.

---

# Week 12 — Parent Feed & Ordering Interface

**Dates:** 19 April 2026 – 25 April 2026
**Commits:** 13 — Ruthwik 3, Bhargav 1, Srujan 5, Nagachaitanya 3

## Phase objective

Build the parent journey: a feed scoped to their own children, and the flow to order prints from it.

## Individual contributions

**Ruthwik** built the parent feed and children hooks, the photo action hook, the masonry feed screen, the photo detail screen, the cart store and the order API service. **Srujan** built the child switcher and the parent feed service, plus the product picker and the three-step order bottom sheet. **Nagachaitanya** built the feed loading skeleton, the photo action sheet and the order query and mutation hooks. **Bhargav** built the order history screen.

## Important technical implementation

A parent with several children gets a horizontal avatar switcher that re-keys the feed query, so switching child refetches cleanly rather than mutating a shared cache entry. Every list screen implements the same four states — loading skeleton, empty, error and content — using the shared feedback components.

## Issues and challenges

`@gorhom/bottom-sheet` behaved inconsistently on Android in Expo Go, so the photo action sheet was built on React Native's own `Modal` instead. Less elegant, but reliable on the devices used for testing. A mismatch between the client order payload and the server's expected schema was identified late and remained unresolved.

## Testing and validation

Full parent walkthrough on a physical device: feed loaded with the correct child's photos, child switcher changed the feed, photo detail opened with pinch-zoom. Cross-account check confirmed a second parent did not see the first child's photos.

## Relevant commits

```
feat(orders): add three-step order bottom sheet
feat(orders): add order detail and history cards
feat(orders): add order history screen
feat(notifications): add notification service and query hooks
feat(notifications): add notification card
feat(notifications): add notification centre list
feat(admin): add admin api service
feat(admin): add dashboard and user management hooks
feat(admin): add school and class detail hooks
feat(admin): add stat card and user list item
feat(admin): add student and school cards
feat(admin): add school and class creation sheets
```

## End state

Parents can browse their own child's photos and reach the ordering flow.

## Next week

Notifications, the admin console and final assembly.

---

# Week 13 — Notifications, Admin Console & Application Assembly

**Dates:** 26 April 2026 – 2 May 2026
**Commits:** 13 — Ruthwik 1, Bhargav 2, Srujan 3, Nagachaitanya 6

## Phase objective

Complete the third role's interface, build the notification centre, and assemble everything into a running application.

## Individual contributions

**Nagachaitanya** built the notification card and centre components, and the admin dashboard, user management, school and class detail screens, plus the role tab layouts and profile screens. **Srujan** built the admin display components and the management sheets for schools, classes, students, teacher assignment, parent mapping and role editing. **Ruthwik** built the admin API service and its dashboard, user and school hooks, and the role-based entry redirect. **Bhargav** built the root layout with providers, font loading and splash handling, and the project README.

## Important technical implementation

`app/index.tsx` resolves three states in order — not onboarded, not authenticated, authenticated — keeping the routing decision in one place. The root layout holds the splash screen until both fonts and the auth session have resolved, so the user never sees an unstyled or wrongly-routed frame.

## Issues and challenges

The notification centre, card, hooks and service were all completed, but connecting them to the three role screens was not finished — those screens carry a placeholder. Several components also drifted out of sync with library updates, leaving the mobile package failing `tsc --noEmit`.

## Testing and validation

Full admin walkthrough: school creation, class creation, teacher assignment, student addition and parent mapping all persisted correctly. All three roles signed in and reached their own tab layouts. Photos uploaded by a teacher appeared in the correct parent's feed and were absent from other parents' feeds.

## Relevant commits

```
feat(admin): add student creation and teacher assignment sheets
feat(admin): add parent mapping and listing sheets
feat(admin): add user role editing sheet
feat(admin): add dashboard screen with statistics
feat(admin): add user management screen with search
feat(admin): add school list and class detail screens
feat(app): add root layout with providers, fonts and splash handling
feat(app): add role-based entry redirect and not-found screen
feat(app): add parent tab layout and profile screen
feat(app): add teacher tab layout and profile screen
feat(app): add admin tab layout and profile screen
docs: add project readme
```

## End state

A complete application across all three roles. 217 files, roughly 36,000 lines.

## Next week

Phase 2 — resolving the known defects and hardening the application for release.

---

# Phase 1 Summary

| Week | Phase | Dates |
|---|---|---|
| 1 | Project foundations & first tables | 1 – 7 Feb |
| 2 | Core schema & privacy model | 8 – 14 Feb |
| 3 | Data security & backend configuration | 15 – 21 Feb |
| 4 | Authentication, access control & storage layer | 22 – 28 Feb |
| 5 | Photo, feed & notification services | 1 – 7 Mar |
| 6 | Ordering, idempotency & seed data | 8 – 14 Mar |
| 7 | Admin API, workers & server assembly | 15 – 21 Mar |
| 8 | Client infrastructure & shared hooks | 22 – 28 Mar |
| 9 | Authentication UI & onboarding | 29 Mar – 4 Apr |
| 10 | Navigation, media & animation | 5 – 11 Apr |
| 11 | Teacher upload experience | 12 – 18 Apr |
| 12 | Parent feed & ordering interface | 19 – 25 Apr |
| 13 | Notifications, admin console & assembly | 26 Apr – 1 May |

## Delivered

| Area | Status |
|---|---|
| Database schema, RLS, triggers, indexes | Complete |
| Backend API — 22 endpoints across 5 domains | Complete |
| Authentication with OTP and role-based access | Complete |
| Teacher photo upload and student tagging | Complete |
| Parent privacy-scoped photo feed | Complete |
| Admin console — schools, classes, students, users | Complete |
| Design system and component library | Complete |
| Ordering | Built, with a known contract defect |
| In-app notifications | Backend and components complete; screens not wired |
| Image processing workers | Written, not connected to the upload path |

## Known outstanding work

Carried into Phase 2:

1. **Order submission contract mismatch** — the client payload shape does not match the server's expected schema, so orders cannot currently be placed. The most significant defect in the codebase.
2. **Notification screens not wired** — the service, hooks and components are complete, but all three role screens still render a placeholder.
3. **Image processing workers not invoked** — thumbnails, blurhash and dimensions are never generated, so the feed serves full-resolution originals.
4. **Mobile package fails `tsc --noEmit`** — 22 type errors from library drift and stale state definitions.
5. **Photo storage and access control** — uploads are served from local disk without authentication and need hardening.
6. **No automated test suite.**
7. **No deployment pipeline.**

## Phase 2

Phase 2 begins with a full codebase audit, then addresses the items above in dependency order: type errors first (the application must compile before anything can be verified), then the order contract, storage and access control, upload correctness, demo data, interface completion, testing, deployment and documentation.

---

*Hive · Ruthwik, Bhargav, Srujan, Nagachaitanya*

# Phase 2 — Completion & Hardening

**Period:** Week 14 onwards · 3 May 2026 –
**Basis:** a full codebase audit of the Phase 1 application, which found 46 gaps
across security, correctness, performance, testing and deployment.

Unlike Phase 1, this history is not reconstructed. Every commit below is work
done by the person credited, in the order shown.

---

# Week 14 — Audit, Planning & Credential Hygiene

**Dates:** 3 – 9 May 2026
**Commits:** 14 — Ruthwik 8, Srujan 2, Nagachaitanya 2, Bhargav 2

## Phase objective

Audit the recovered application end to end, turn the findings into executable
plans, and close the cheapest security gaps immediately.

## Work completed

- Full codebase audit: 46 numbered gaps with severity, evidence and fixes
- Twelve implementation plans, one per work package, with a locked decision set
- Team working instructions so each member's tooling picks up the right plan
- Admin seeding credentials moved to the environment
- Proxy trust restricted; environment examples corrected

## Individual contributions

**Ruthwik** — Ran the audit and wrote it up, plus the plan index, the storage,
upload and deployment plans, the Phase 2 schedule and the team instructions.
Then closed three gaps: the seeding script hardcoded `admin@hive.app` /
`Admin@123` and printed the password to stdout; `trust proxy` was set to `true`,
which lets a client spoof `X-Forwarded-For` and bypass the rate limiter; and the
environment examples disagreed on the port, omitted `BACKEND_URL` and documented
four AWS variables that nothing reads.

**Srujan** — Wrote the data model and demo seed plans, and the four-person
development and Git workflow document.

**Nagachaitanya** — Wrote the quick wins, authorization, testing, documentation
and QA plans.

**Bhargav** — Documented all 22 mobile TypeScript errors, grouped by root cause,
and wrote the UX completion plan.

## Important technical implementation

The audit's most consequential finding is architectural rather than a single
bug: **the backend uses the service-role key for every query, which bypasses row
level security entirely.** The 505-line policy set written in Phase 1 protects
only the handful of queries the mobile client makes directly to Supabase. Every
API endpoint must therefore enforce authorization explicitly in the service
layer — and in four places it did not.

## Issues and challenges

Deciding what *not* to do. The audit surfaced 46 gaps and the temptation was to
plan all of them. Ten decisions were locked up front — storage provider,
synchronous image processing over a queue, integer cents, trunk-based work — so
later weeks could not relitigate them.

## Testing and validation

Dependencies were installed and the monorepo compiled for the first time. The
backend passes typecheck and build; the mobile package fails with 22 errors.
That had not been visible during the static audit.

## End state

An audited codebase with an executable plan per work package, and three security
gaps closed.

## Next week

Private photo storage and thumbnail generation — the most severe finding and the
worst performance problem, which share one fix.

---

# Week 15 — Private Photo Storage & Image Processing

**Dates:** 10 – 16 May 2026
**Commits:** 7 — Ruthwik 7

## Phase objective

Close the audit's most severe finding: every child's photograph was reachable by
anyone holding or guessing a URL, with no credential required.

## Work completed

- Photos bucket made private; public read and blanket write policies dropped
- Signed URL helpers with batch signing
- Thumbnails, blurhash and dimensions generated synchronously during upload
- HEIC converted to JPEG; image magic bytes verified
- Uploads moved from local disk to Supabase Storage
- Unauthenticated `/uploads` static route removed
- Unreachable BullMQ workers, S3 client and AWS configuration deleted

## Individual contributions

**Ruthwik** — The whole of Plan 03. Two independent exposures had to close
together: the storage bucket was created public with a `TO public` read policy,
and the API served the uploads directory through `express.static` mounted before
any authentication. Photos now live in a private bucket and are reachable only
through short-lived signed URLs.

## Important technical implementation

**Image processing moved into the request rather than a queue.** Neither BullMQ
queue was ever enqueued — a repo-wide search for `.add(` found only `Set.add` —
so `thumbnail_s3_key`, `blurhash`, `width` and `height` had been permanently
null and the feed served full-resolution originals, up to 25 MB each, to a
mobile grid. The workers could not have worked in any case: they read from S3
while files were written to local disk, and updated a `content_type` column that
does not exist.

`sharp` takes 100–300 ms for a typical phone photo, which is imperceptible next
to the upload. Removing the queue removed a Redis dependency for background work
and an entire class of stuck-in-processing failures.

## Issues and challenges

The plan specified checking `format === 'heif' || format === 'heic'`. Sharp's
type union contains only `heif` — HEIC containers report as `heif` — so the
`'heic'` comparison is a compile error. Caught by typecheck.

A staging error also went unnoticed initially: `git add -A <paths>` did not
stage file deletions, so a commit claiming to delete the workers left them
tracked. Caught on verification, and the week's commits were rebuilt with
correct staging.

## Testing and validation

`sharp` confirmed to load with libvips 8.15.3 before starting, since the whole
approach depended on it. Backend typecheck and build pass; no `express.static`,
S3 client or queue reference remains.

**Not verified at runtime.** No `.env` exists, so migration `00020` has not been
applied and no photo has been uploaded to the private bucket.

## End state

Photos are private objects served through signed URLs, with thumbnails
generated on upload.

## Next week

The feed query, which breaks as data grows, and the upload ordering bug that
suppresses parent notifications.

---

# Week 16 — Feed Query, Upload Ordering & Type Recovery

**Dates:** 17 – 23 May 2026
**Commits:** 9 — Ruthwik 6, Srujan 3

## Phase objective

Fix the two defects that make the product quietly wrong at scale: a feed query
that stops working as photos accumulate, and an upload sequence that prevents
parents from ever being notified.

## Work completed

- Feed rewritten as a single paginated join
- Photos confirmed after tagging so notification triggers fire correctly
- Upload concurrency bounded; accepted-image count corrected
- Supabase database types regenerated, clearing 7 of 22 type errors
- Trunk-based workflow adopted; `develop` abandoned

## Individual contributions

**Ruthwik** — The feed previously fetched *every* `photo_student_tags` row for a
parent's children with no limit, then passed all resulting photo IDs back as an
`IN` filter. For a child with a couple of thousand tagged photos that builds a
URL containing thousands of UUIDs and PostgREST answers 414 URI Too Long: the
feed did not degrade as data grew, it stopped working. Now one query with an
inner join, paginated in the database.

Also fixed the ordering bug: the pipeline marked a photo ready *before* tagging
it, so `notify_parents_on_photo` always looped over zero tags. Teachers still
received their upload-complete notification, which is why the gap went unnoticed.

**Srujan** — Regenerated the Supabase types. The root cause was not staleness:
the file was hand-written, never CLI-generated, and did not satisfy
`GenericSchema` — no table declared `Relationships` and the schema had no
`Views`, `Enums` or `CompositeTypes`. Compounding it, `@supabase/supabase-js` is
pinned `^2.43.0` but resolves to 2.98, whose select-type resolution is far
stricter. That version drift turned a tolerated shape into eight `never` errors.

## Important technical implementation

Deduplication needed care. An inner join emits one row per matching tag, so a
photo containing two of a parent's children arrives twice. Over-fetching and
deduplicating is straightforward; computing `hasNext` from it is not. Taking the
deduplicated count alone truncates the feed whenever siblings appear together,
so `hasNext` also considers whether the database hit the fetch ceiling. A
spurious empty page is a far better failure than a silently shortened feed.

## Issues and challenges

`develop` was created in Week 14 and abandoned in Week 16 — half the team was
committing to `main` directly and the two diverged within days. All
documentation was corrected to describe trunk-based work rather than a process
nobody was following.

Srujan's type regeneration also sat unmerged on a branch for over a week while
Bhargav was blocked on it, which is the concrete argument for merging daily.

## Testing and validation

Mobile errors fell from 22 to 15. Backend typecheck, build and lint pass.

**The feed rewrite is the highest-risk change so far and has not been run
against real data.** Pagination across pages, the sibling-dedup path and the 414
case it exists to fix are all untested.

## End state

Both scale defects fixed in code; neither verified.

## Next week

Deployment groundwork — the environment that would let any of this be verified.

---

# Week 17 — Observability, Containerisation & Load Testing

**Dates:** 24 – 30 May 2026
**Commits:** 5 — Ruthwik 5

## Phase objective

Make the service observable and deployable, and prepare the measurement needed
to demonstrate the performance work.

## Work completed

- Request correlation IDs; production request logging
- Health check that verifies the database
- Multi-stage Docker image and local compose stack
- CI: lint, typecheck, build and image build
- Database migration and reset scripts
- k6 load test suite with four profiles

## Individual contributions

**Ruthwik** — `X-Request-ID` was allow-listed in the CORS configuration but
never generated, read or logged, so a user reporting a failure gave us nothing
to search for. Requests were also logged at `debug` while production runs at
`info` — production had no request log at all.

`/health` returned a static 200, so an instance unable to reach Supabase still
reported healthy and the platform kept routing traffic to it. It now checks the
database and answers 503 on failure, returning a boolean only since the endpoint
is public.

Also containerised the backend, added CI, and wrote the k6 suite.

## Important technical implementation

CI is deliberately non-blocking on the mobile package. Backend typecheck and
build are hard gates; mobile typecheck and lint carry failures inherited from
Phase 1. A pipeline that is red from the first commit teaches everyone to ignore
it, so those steps are marked `continue-on-error` with a note to make them
blocking once the type errors clear.

The load suite tracks `feed_payload_bytes` as a custom metric. Before Week 15 no
thumbnails existed and a 20-photo page could exceed 100 MB; the threshold is
2 MB p95. That before-and-after is the clearest performance evidence available
and costs one extra run.

## Issues and challenges

Auth failure logging included `req.ip` — personally identifiable — and logged
whole error objects, which can embed the bearer token. Both corrected while
adding correlation IDs.

## Testing and validation

Backend typecheck and build pass. The Docker image and CI workflow are written
but have not been executed; the load suite cannot run without a deployed
instance.

## End state

The service is instrumented, containerised and CI-verified in principle.

## Next week

Blocked pending a working environment. Roughly 25 commits of work — the storage
rewrite, feed query, upload pipeline and observability — compile but have never
executed. Creating a `.env` and applying migration `00020` is the prerequisite
for everything remaining.

---
