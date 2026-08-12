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

# Phase 2

# Week 17 — Authorization & Access Control

**Dates:** 24 May 2026 – 30 May 2026
**Commits:** 12 — Nagachaitanya 12
**Covers:** Plan 01 (Steps 1, 3, 5) and Plan 04, worked across Weeks 14–17

## Phase objective

Close the four IDOR findings in the API, stop the app rendering screens the signed-in user has no right to see, and wire up the notification centre that Phase 1 left unimported.

## Individual contributions

**Nagachaitanya** did all twelve commits in this window. Weeks 14 to 17 were scheduled as four people working in parallel on Plans 00, 02, 03 and 04; in practice only Plan 01's authorization and notification items and Plan 04 were started. Plan 00 (Bhargav), Plan 02 (Srujan) and Plan 03 (Ruthwik) have not begun, so the mobile package still fails `tsc --noEmit` with the same 22 errors it carried out of Phase 1, and photo storage is still local disk served without authentication.

The commit split above is not a four-way split, and this report does not present it as one.

## Important technical implementation

The root cause of all four IDORs is one architectural fact: the backend queries exclusively through `supabaseAdmin`, built with `SUPABASE_SERVICE_KEY`, and the service-role key is exempt from row level security by design. The 505-line policy set in migration `00011` therefore never sees an API request — it protects only the four places the mobile app talks to Supabase directly. Every endpoint has to re-implement authorization by hand, and in four places it did not.

`feed.service.getPhotoDetails` accepted no user ID at all and filtered only on `status='ready'`, so any parent iterating photo UUIDs could retrieve any photo in the system together with its full tagged-student list — a cross-school child roster. It now requires that one of the caller's own children is tagged in the photo, and returns 404 rather than 403 on refusal: a 403 confirms the photo exists, which is itself a leak when IDs are enumerable. It also returns only the caller's own children in `taggedStudentIds`, because authorization is not binary — a parent entitled to the photo is still not entitled to know who else is in it.

`assertSchoolAccess` in `middleware/roleGuard.ts` and `assertPhotoOwnership` in `photo.service.ts` are the two new guards. Both allow platform admins through explicitly, which matters because admins carry `school_id = null` and a plain equality check would lock them out of everything.

On the client, `RoleGate` wraps each group's navigator. `app/index.tsx` already redirected by role, but it is only consulted when entering through the root, and `hive://` is a registered scheme — so `hive://(admin)/dashboard` mounted the admin console for a parent. The component's doc comment states that it is a UX control and not a security control, so that nobody later mistakes it for the boundary.

## Issues and challenges

**Nothing could be run.** The repository has no `.env`, only `.env.example`, so the backend cannot boot, the app cannot start, and no Supabase call can be made. Plan 04's Verification section is eight curl checks across two accounts at different schools plus six device checks, and not one of them has been executed. The fixes are reviewed code, not observed behaviour, and the Done-when boxes have been left unticked to say so.

Verification was therefore static: `pnpm typecheck`, `pnpm lint`, and a per-commit diff of the mobile typecheck output against the 22-error baseline captured before any change. That baseline held identical after every mobile commit, with no error in `RoleGate.tsx`, any `_layout.tsx`, or any `notifications.tsx`.

Plan 04 is documented as depending on Plan 03, which has not started. The overlap is `getPhotoDetails`, which both plans edit. The authorization block sits above the URL construction and does not touch it, so Plan 03 can swap `/uploads/...` for signed Storage URLs without conflict.

One decision was left open by the plan and had to be made: whether tagging a student requires being the photo's uploader or merely a teacher at the same school. Uploader, matching `/file` and `/confirm`, so a single guard covers all three routes.

## Testing and validation

No automated tests exist yet — Plan 08 has not started. Static checks only:

- `pnpm --filter @hive/backend typecheck` — clean after every commit
- `pnpm lint` — 8 problems, down from 9; all remaining are pre-existing and none are in code touched this week
- `pnpm --filter @hive/mobile typecheck` — 22 errors, byte-identical to the pre-work baseline
- `grep -rn "school_admin" packages apps supabase` — no matches

## Relevant commits

```
feat(notifications): wire notification centre into all three role screens
refactor(rbac): remove unsupported school_admin role across API and app
security(admin): sanitise user search to prevent PostgREST filter injection
security(feed): enforce parent ownership on the photo detail endpoint
security(feed): return only the requesting parent's tagged children
security(schools): scope class and student listings to the caller's school
security(photos): scope class photo listing to the caller's school
security(photos): verify photo ownership on file upload, confirm and tag
feat(auth): add RoleGate component for route-level access control
security(app): guard parent, teacher and admin route groups by role
refactor(app): remove unused auth state reads from the root layout
docs(plans): record plan 01 and 04 deviations and update the tracker
```

## End state

G-03, G-04, G-05, G-08, G-09, G-16 and G-17 are addressed in code and unverified in practice. No screen in the app reads "Coming Soon". Checkpoint CP-2 is not met: it also requires an order to be placeable (Plan 02) and photos in private storage with thumbnails (Plan 03), neither of which has been started.

## Next week

Plan 08's backend test harness — Vitest and Supertest, with a guard that refuses to run against the demo database. Writing the auth and RBAC tests is the only way the authorization work above stops being unverified, and T-6 and T-7 exist precisely to catch a regression of this week's two worst findings.

---

# Week 21 — Test Harness & Observability

**Dates:** 21 June 2026 – 27 June 2026
**Commits:** 8 — Nagachaitanya 8
**Covers:** Plan 08 (harness, auth tests, error tests) and Plan 09 Step 3, worked across Weeks 18–21

## Phase objective

Give the project a test runner it never had, cover the authentication and error paths, and make production failures visible without shipping children's data to a third party.

## Individual contributions

**Nagachaitanya** did all eight commits. Plans 02, 03, 05, 06 and 07 remain unstarted, so the schedule's W18–W21 split across four people did not happen; the other three test files in Plan 08 (photos, feed, orders, admin) belong to Ruthwik and Srujan and are not written.

## Important technical implementation

The harness is Vitest plus Supertest against a real Supabase project. The piece worth describing is the guard in `tests/setup.ts`: the suite deletes every row in every domain table and deletes the auth users it creates, so it refuses to start unless `.env.test` exists, and refuses outright if `SUPABASE_URL` contains the demo project ref. That ref is hard-coded rather than read from configuration — a guard that reads the value it is guarding against is not a guard.

`createTestUser` signs the user in for real and returns the Supabase-issued access token. A hand-built JWT would defeat the point: the tests exist to prove `authenticate` verifies tokens against Supabase and reads role and school from the `profiles` row, which is the only thing standing between the API and an unauthenticated caller, since `supabaseAdmin` bypasses RLS.

T-4 asserts 403 and specifically *not* 401 for a wrong-role caller, because `lib/api.ts` signs the user out on any 401 — a `roleGuard` returning 401 would present as a mysterious logout rather than an error. T-34 throws an error whose message embeds a database password and asserts the response body contains neither it nor the connection string under `NODE_ENV=production`, then asserts the opposite outside production so both sides of the branch are exercised.

On observability, Sentry is off unless a DSN is set. `beforeSend` walks the entire event — request, extra, contexts, exception values, stack frame variables, breadcrumbs — redacting sensitive keys and regex-matching bearer tokens, JWTs, email addresses and storage URLs. `http`/`fetch` breadcrumbs are dropped wholesale because they record full request URLs, and on mobile `attachScreenshot` and `attachViewHierarchy` are disabled: a screenshot of this app is, by definition, a photograph of a child.

Backend initialisation had to move into `config/instrument.ts`, imported first for its side effect. A bare `initSentry()` placed between import statements does not run first — imports are hoisted, so it would execute after every module in the file had already loaded, including the ones Sentry patches.

Reporting hooks into `errorHandler` instead of `Sentry.setupExpressErrorHandler`, so only unexpected errors are sent. `AppError` is excluded on purpose: a 403 on a cross-school request is the authorization layer working as designed, and reporting those would bury genuine failures.

## Issues and challenges

**The 36-test suite has never been run.** There is no `.env.test` and no test Supabase project, so `pnpm test` cannot reach a database. Twelve of the thirty-six tests are written; none have executed. Plan 08's sabotage exercise — reverting each fix and confirming the matching test fails — has not been done either, and until it is, there is no evidence these tests test anything.

Two things *were* executed, and both passed:

- **The database guard**, in both branches. With no `.env.test` the suite refuses with a message naming the file to create; with `SUPABASE_URL` pointed at the demo project ref it refuses with an explicit warning that it would wipe the demo data.
- **The Sentry scrubber**, against a synthetic event carrying a JWT, two email addresses, a client IP, a signed storage URL, an `/uploads` URL, a password field and a hostname. None survived; a user-agent string and a student's first name did, confirming it redacts rather than blanks.

One bug was found and fixed while writing this: `.env.example` ships `SENTRY_DSN=` with no value, which dotenv turns into an empty string, and an empty string fails `z.string().url()`. Anyone following the setup instructions would have hit a startup validation failure. The schema now preprocesses empty to undefined.

Incidentally, `require('sharp')` loads on this machine — the check CLAUDE.md flags as the gate on Plan 03's synchronous-thumbnail approach. The fixture JPEG was generated with it.

## Testing and validation

- `pnpm --filter @hive/backend typecheck` — clean, now covering `tests/` through a second `tsconfig.test.json` pass
- `pnpm lint` — 8 problems, unchanged and all pre-existing
- `pnpm --filter @hive/mobile typecheck` — 22 errors, still identical to the Plan 00 baseline
- Test-database guard — executed, refuses correctly in both branches
- Sentry `beforeSend` — executed, no sensitive value survived
- `pnpm test` — **not run.** No test project exists.

## Relevant commits

```
test(setup): add Vitest and Supertest harness with test database guard
test(helpers): add fixtures and factory helpers for test data
test(auth): cover authentication and role-based access control
test(errors): cover validation and error handler behaviour
ci: add test task to the turbo pipeline
security(obs): stop logging client IPs and raw error objects on auth failures
feat(obs): integrate Sentry with PII scrubbing on backend and mobile
docs(report): add week 21 progress report
```

## End state

A working test harness with 12 of Plan 08's 36 tests written and none executed. Error reporting wired on both apps, scrubbed and verified in isolation, but never confirmed end to end against a live Sentry project. Checkpoint CP-4 (36 tests green, CI on every PR) is not met — CI is Ruthwik's Plan 09 Step 5 and does not exist yet.

## Next week

Plan 10's security document and the auth sequence diagram. The threat model, the three authorization layers and the remediation table are all things this stream now has real material for.

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
- Image magic bytes verified; a HEIC→JPEG branch added, which turned out **not**
  to work for iPhone HEIC — `sharp`'s prebuilt libvips has no HEVC decoder, so
  the branch converts AVIF and refuses HEVC with an actionable 400. Established
  by testing a real HEVC HEIC on 24 July. The working fix is on the device: the
  iOS picker is asked for a compatible representation, so the phone transcodes
  before upload
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

# Week 18 — API Consistency & Architecture Documentation

**Dates:** 31 May – 6 June 2026 · **Commits:** 4 — Ruthwik 4

## Phase objective
Close the audit findings remaining in the photo and feed services, and document
the architecture while it was fresh.

## Individual contributions
**Ruthwik** — `POST /photos/:id/tag` was running with no validation at all: a
schema existed but required a field the route takes from the URL, so it could
never be wired up. Split it and applied it with a 50-item cap bounding the
generated filter. Also replaced two hand-rolled error responses with `AppError`,
so the same failure can no longer be formatted two ways.

Wrote the architecture document and the environment setup guide, the latter
handing deployment ownership to Bhargav.

**Bhargav, Srujan, Nagachaitanya** — no commits. Bhargav was working through the
type errors locally; the other two were blocked on the environment.

## Issues and challenges
This was the first week the unevenness became a problem. Three people had
nothing merged, and the reason was structural: Plans 03 and 05 were a single
sequential track, and Plan 00 blocked verification of everything else. The
schedule assumed parallelism the dependency graph did not permit.

## Testing and validation
Typecheck and build pass. Backend lint clean in all files touched.

## End state
The photo and feed services carry no outstanding audit findings.

## Next week
The test harness.

---

# Week 19 — Test Harness & Feed Coverage

**Dates:** 7 – 13 June 2026 · **Commits:** 2 — Ruthwik 2

## Phase objective
Build the test infrastructure and cover the privacy boundary.

## Individual contributions
**Ruthwik** — Vitest harness with a guard that refuses to run unless
`.env.test` exists and warns if it points at the same project as `.env`. The
suite truncates every domain table; wiping the demo dataset the night before a
submission is a real failure mode and worth an unconditional check.

Eight feed tests over two schools with unrelated families, all asking one
question: can a parent reach a photo that is not of their own child.

## Important technical implementation
Two surprises. Vitest 4 was installed rather than 3, and `poolOptions` was
removed in that major — the plan's config would have failed. The config also
has to be `.mts`, because the backend package is CommonJS and Vitest 4 loads
config natively, rejecting ESM syntax in a `.ts` file.

## Issues and challenges
The tests cannot run. Writing them ahead is still worthwhile — a wrong test
fails loudly the first time it executes, unlike production code, which fails
silently in front of an evaluator.

## Testing and validation
The harness fails correctly: a clear error naming the missing variables and
pointing at the setup guide, not a crash and not a false pass.

## End state
Harness plus 8 feed tests, none executed.

## Next week
Photo tests, and the compile blocker.

---

# Week 20 — Photo Tests & the Compile Blocker

**Dates:** 14 – 20 June 2026 · **Commits:** 3 — Bhargav 2, Ruthwik 1

## Phase objective
Get the mobile package compiling, and cover the upload path.

## Individual contributions
**Bhargav** — Started on the 22 type errors. FlashList v2 removed
`estimatedItemSize`, which v1 required, and six call sites still passed it —
every list screen failed to typecheck. Also removed the `hashing` upload state,
abandoned when migration `00016` made the hash nullable but still declared in
three `Record<ImageUploadState, …>` maps.

**Ruthwik** — Eleven photo tests covering ownership, magic-byte validation, size
limits, cross-school tagging and idempotent re-tagging. The important one is
notification ordering: `notify_parents_on_photo` fires on the transition to
`ready` and loops over tags, so the original pipeline always ran it against zero
rows. Teachers still got their own notification, which is why it survived. The
symptom is a message that silently never arrives, so this is the only automated
way to catch a regression.

## End state
19 backend tests written. Mobile errors 22 → 15.

## Next week
Finish the type errors and the outstanding quick wins.

---

# Week 21 — Zero Type Errors

**Dates:** 21 – 27 June 2026 · **Commits:** 10 — Bhargav 7, Nagachaitanya 2, Srujan 1

## Phase objective
Make the application compile, and close the remaining Plan 01 items.

## Individual contributions
**Bhargav** — Cleared the rest. `@react-navigation/bottom-tabs` was reached only
transitively through `expo-router`, so its types were unresolvable — the runtime
worked while the build did not; it is now an explicit dependency. `expo-image`
stopped exporting `ContentFit`. Reanimated's `withSequence` returns
`AnimatableValue` against a `SharedValue<number>`.

He also corrected two regressions introduced during the same effort. The
navigation typing fix had moved `navigate()` to its single-argument form on a
misreading of the error — the `as never` casts were the cause, not the overload,
and the change silently discarded route params on every tab tap. And widening
`ClassItem.grade` to `string | null` to match the schema left three render sites
unguarded, so screen readers announced "Selected class: Butterflies, null."

**Nagachaitanya** — Wired `NotificationCenter` into all three role screens.
Roughly 700 lines of finished code had sat unimported while every role showed a
placeholder. Also sanitised the admin search, where the raw term was
interpolated into a PostgREST `or()` filter and could inject a clause, and
removed `school_admin` — a role absent from the `profiles.role` CHECK, so the
admin UI offered something the database would reject.

**Srujan** — `getDashboardStats` selected `orders.total`; the column is
`total_amount`. The error was never checked, so both the order count and revenue
silently reported zero regardless of the data.

## End state
**The mobile package typechecks with zero errors for the first time.**

## Next week
Authorization.

---

# Week 22 — Authorization

**Dates:** 28 June – 4 July 2026 · **Commits:** 3 — Nagachaitanya 3

## Phase objective
Close every remaining IDOR.

## Individual contributions
**Nagachaitanya** — `getPhotoDetails` accepted a photo ID and no user, filtering
only on status: any authenticated parent could read any photo in the system by
UUID, including its URL, filename, class and school names, and the full list of
tagged children at other schools. It now verifies the caller is a parent of a
tagged child, returns 404 rather than 403 so the response does not confirm
existence, and filters `taggedStudentIds` to the requesting parent's own
children — an authorised viewer still must not learn who else is in the frame.

Three further endpoints took an ID from the URL and checked nothing: any teacher
could list another school's class photos, or overwrite and confirm another
teacher's photo.

On the client, no route group checked anything, so a parent deep-linking
`hive://(admin)/dashboard` got the full admin interface. `RoleGate` renders
nothing while auth resolves, to avoid a flash of the wrong screen, and redirects
a mismatched role to their own home rather than to login — being signed in as
the wrong role is not an authentication failure.

## Issues and challenges
A single-person week again. The authorization work was one coherent slice in
files nobody else could safely touch concurrently.

## End state
Every P0 security finding closed.

## Next week
The order contract.

---

# Week 23 — The Order Contract

**Dates:** 5 – 11 July 2026 · **Commits:** 6 — Srujan 3, Bhargav 1, Nagachaitanya 1, Ruthwik 1

## Phase objective
Make ordering work. It never had.

## Individual contributions
**Srujan** — Three layers disagreed three ways. The mobile cart used
`print_4x6` with dollar prices, the validator used `4x6` with cent prices, and
the database CHECK allowed only the `print_*` set — overlapping on three values
out of seven. Every request failed Zod validation before reaching the database.

One catalogue now defines the seven types, labels and prices in integer cents,
mirrored on the client. The client-supplied price is gone entirely: a client
must not influence what it is charged. Migration `00017` renames `total_amount`
to `total_cents`, since the service was writing cents into a decimal column
documented as USD — a $4.99 print stored as 299.00 and rendered as $299.00.

**Bhargav** — Toast and confirmation dialog components. Outside the upload
flow's confetti the app gave no feedback at all.

**Nagachaitanya** — `getSchools` issued two count queries per school; 41 round
trips for a 20-school page. Two batched queries now.

## End state
Ordering works end to end in code.

## Next week
Demo data and documentation.

---

# Week 24 — Demo Data & Documentation

**Dates:** 12 – 18 July 2026 · **Commits:** 7 — Srujan 3, Ruthwik 2, Bhargav 1, Nagachaitanya 1

## Phase objective
Produce a demo dataset and the documentation the submission needs.

## Individual contributions
**Srujan** — `seed.sql` could never run: it inserted `profiles` rows directly,
but `profiles.id` references `auth.users`, which cannot be populated with plain
SQL. Every insert failed on a foreign key, so there had never been a demo
dataset. The replacement creates auth users through the Admin API, then domain
rows, then processes photos through the same helper the upload endpoint uses —
so demo photos get real thumbnails and blurhashes rather than hand-inserted rows
that would not match production. Photos are tagged before the status flips, and
the script reports the resulting notification count, warning on zero. Also wrote
the database design document and the demo account guide.

**Ruthwik** — API reference for all 22 endpoints.

**Nagachaitanya** — Security design: threat model, the three-layer authorization
model, and a table of every audit finding with the commit that closed it.

**Bhargav** — Order results now surface as toasts; `useCreateOrder` had no error
handler at all, so a failed order was completely silent. Parents with no linked
children now see the email address an administrator needs, and teachers with no
school see why their class list is empty.

## End state
All 46 audit gaps closed except the remaining Plan 08 tests and deployment.

---

# Week 25 — First Real Execution

**Dates:** 17 – 18 July 2026 · **Commits:** 18 — Nagachaitanya 7, Ruthwik 6, Srujan 4, Bhargav 1

## Phase objective

Stop writing and start running. A Supabase project became available, so the work
of the previous eleven weeks could finally be executed rather than reviewed.

## Work completed

- Plan 02 finished: atomic order creation, foreign key contradictions, order
  listing validation, `markAsRead` 404, idempotent policy migrations
- Duplicated work between two streams reconciled; dead code removed
- Real seed photographs added, demo dataset created on the live database
- **Four defects found and fixed that only running could surface**
- Password sign-in opened to teachers and parents
- Handover document written

## Individual contributions

**Srujan** — Closed the rest of Plan 02: order creation and its line items now
happen in one transaction rather than an insert followed by a compensating
delete; the three `NOT NULL` columns declared `ON DELETE SET NULL` were
corrected, since the combination made deleting a profile or photo impossible.
Added eleven Unsplash photographs — scenes and materials, no identifiable
children — and fixed the seed's school assignment.

**Nagachaitanya** — Validation on order listing, the `markAsRead` 404 that could
never fire because `count` was read without requesting it, and idempotent policy
migrations. Also drove much of the runtime verification.

**Ruthwik** — Reconciled the duplicated streams, removed dead code, and fixed
two of the four runtime defects.

**Bhargav** — Opened password sign-in to teachers and parents.

## The four defects

Each typechecks cleanly. That is the point of recording them.

**`processed_at` did not exist.** Written by the photo upload path and present in
no migration, inherited from a deleted background worker. PostgREST rejects an
entire update over one unknown column, so `thumbnail_s3_key`, `blurhash`, `width`
and `height` silently never persisted. Every upload would have left the feed on
full-resolution originals — precisely the defect the storage rewrite existed to
fix, reintroduced by one copied line.

**The seed filed every photo under the wrong school.** It derived the school by
comparing the first eight characters of a class UUID against another class UUID.
Every class id shares those characters, so every photo was attributed to the
wrong school and became invisible to the teacher who uploaded it.

**The dashboard selected a dead column, twice.** First `total`, which never
existed; then `total_amount`, after a migration renamed it to `total_cents`. The
first failure was silent and reported zero. The second was caught only because an
error check had been added alongside the first fix — which is the entire argument
for checking them.

**Order creation hangs without Redis.** Not an error: a silent, indefinite wait.
ioredis queues rather than failing, so the request never returns.

## Testing and validation

The first end-to-end verification against a live database:

| Check | Result |
|---|---|
| Photos processed | 6/6 with thumbnail, blurhash, dimensions |
| Photo URL without a signature | 400 |
| Signed URL | 200; token stripped → 400 |
| Thumbnail vs original | 16 KB vs 211 KB — **13×** |
| Parent feed | correct children only; sibling photo appears once |
| Another family's photo | 404 |
| Notifications | produced by trigger, correct child names |
| Order | `total_cents=998` = $9.98 for 2 × $4.99 |
| Duplicate idempotency key | cached replay, no second order |
| Ordering another family's photo | 403 |
| Teacher → another school's class | 403 |
| Admin dashboard | 2 schools, 8 users, 6 photos, 3 orders, $34.95 |

## Issues and challenges

Password sign-in was reachable only for the admin, so every other account
depended on an OTP arriving. The seeded accounts use `.demo` domains, which
cannot receive mail. The parent account the demo guide calls "the account to
demo" could not be signed into at all.

More broadly: roughly 150 commits had been described as done on the strength of a
passing typecheck. Four of them were wrong in ways no amount of review would have
caught. The status documents now separate *verified* from *written*, and that
distinction is the most useful thing the week produced.

## End state

The core product loop is verified working against a live database.

---

# Phase 2 Summary

| Week | Focus | Commits |
|---|---|---|
| 14 | Audit, planning, credential hygiene | 14 |
| 15 | Private photo storage & image processing | 7 |
| 16 | Feed query, upload ordering, type recovery | 9 |
| 17 | Observability, Docker, CI, load tests | 5 |
| 18 | API consistency & architecture docs | 4 |
| 19 | Test harness & feed coverage | 2 |
| 20 | Photo tests & the compile blocker | 3 |
| 21 | Zero type errors | 10 |
| 22 | Authorization | 3 |
| 23 | The order contract | 6 |
| 24 | Demo data & documentation | 7 |
| 25 | First real execution | 18 |

## Contribution

| Member | Commits (whole project) |
|---|---|
| Ruthwik | 77 |
| Srujan | 57 |
| Bhargav | 52 |
| Nagachaitanya | 47 |

Phase 2 weeks were **uneven, and deliberately reported as such.** Weeks 19 and
22 were single-person; week 21 was mostly one person. The cause was structural:
the storage and feed work was one sequential track, the type errors blocked
everyone else's verification, and the authorization slice touched files nobody
could safely edit concurrently. The Phase 2 schedule assumed a parallelism the
dependency graph did not permit. Smoothing the numbers would misrepresent how
the work actually went.

## Delivered

| Area | Status |
|---|---|
| Application compiles (both packages) | ✔ |
| Photos private, signed URLs, thumbnails | ✔ |
| Ordering | ✔ |
| Authorization — all IDORs closed | ✔ |
| In-app notifications | ✔ |
| Demo seeding | ✔ |
| Toasts, confirmations, empty states | ✔ |
| Docker, CI, health checks, request IDs | ✔ |
| Documentation — 10 documents | ✔ |
| Test harness + 19 backend tests | ✔ |
| Order, admin and mobile tests | ✗ |
| Deployment | ✗ |

## What is verified, and what is not

**Verified at runtime** (18 July, live database): private storage and signed
URLs, thumbnail generation, the parent feed and its privacy boundary, cross-family
404s, notification triggers, order creation at the correct price, idempotency,
cross-school 403s, and the admin dashboard.

**Still unverified:** nothing is deployed; the test suite has never run, because
it needs a separate Supabase project — it truncates every table, so pointing it
at the demo project would wipe the data; the mobile app has not been driven end
to end by hand; the k6 suite and CI have never executed.

## Remaining work

| Item | Owner |
|---|---|
| **README still describes Flutter** — the first thing an evaluator reads | Bhargav |
| `hive-test` Supabase project, then run the suite | Bhargav |
| Deploy to Render | Bhargav |
| Mobile tests — cart, upload state machine, RoleGate | Bhargav |
| `tests/orders.test.ts` | Srujan |
| `tests/admin.test.ts` | Nagachaitanya |
| `no-namespace` lint error — the only thing keeping CI red | Nagachaitanya |
| `docs/performance.md` — k6 results, needs a deployed target | Ruthwik |
| `docs/testing.md`, `docs/demo-script.md` | all |
| Custom SMTP — default Supabase is rate-limited | Bhargav |

---

*Hive · Ruthwik, Bhargav, Srujan, Nagachaitanya*
