# Hive — 4-Person Parallel Development & Git Plan

**Companion to:** `docs/01-PROJECT-AUDIT-AND-COMPLETION-PLAN.md` (gap IDs `G-xx` refer to that document's §21 Master Gap Analysis)
**Team:** Bhargav M · Ruthwik Chikoti · Naga Chaitanya Varma · Dharma Srujan Reddy
**Target:** 6 working days to submission-ready

---

## 1. Development Strategy

### 1.1 The problem this plan has to solve

Two constraints shape everything below.

**First, the repository currently has one commit by one author.** `git log` shows a single commit `1bfe1d9 "upload"` authored by `Bhargav`. For a four-person graded project this is a genuine evaluation risk that no amount of code quality compensates for — an evaluator who runs `git shortlog -sne` sees one contributor. Everything from here forward must produce **real, attributable, meaningful commits from four people**. Not padding — actual owned work.

**Second, four people editing one codebase creates merge conflicts** unless ownership is drawn deliberately.

### 1.2 Why not "frontend / backend / database / testing"

The brief rules that split out, and it's right to. In this codebase specifically it would fail badly:

- The most severe bug (G-01, orders) spans mobile + validator + service + migration. A "frontend dev" and a "backend dev" would both need to change it, coordinate on the contract, and block each other. Owned by **one person**, it's a two-hour fix.
- A "database dev" would have almost nothing to do — the schema is already good. They'd have four migrations totalling perhaps three hours.
- A "testing dev" cannot write tests for code that three other people are actively rewriting.

### 1.3 The split we're using: **vertical feature slices + one platform owner**

Three developers own **end-to-end vertical slices** — for their feature they own the migration, the validator, the service, the controller, the route, the mobile service, the hooks, the components, the screens, and the tests. They can complete their work without waiting on anyone.

The fourth owns the **platform**: cross-cutting infrastructure (auth middleware, route guards, theme, shared UI), plus testing, CI/CD, deployment, and documentation. Their files are the ones everyone depends on but nobody else should edit.

| Dev | Slice | Owns |
|---|---|---|
| **Dev 1** | **Orders & Commerce** | The single most broken feature, end to end |
| **Dev 2** | **Photos, Storage & Media** | The security-critical and performance-critical path |
| **Dev 3** | **Admin, Notifications & Data** | The broadest CRUD surface + the biggest quick win |
| **Dev 4** | **Platform, Security, QA & DevOps** | Everything shared, plus tests, deploy, docs |

**File overlap between the four is close to zero.** Section 7 makes this explicit, and section 12 defines the protocol for the handful of genuinely shared files.

### 1.4 Assigning people to roles

The slices differ in difficulty. Suggested mapping, adjust to your team:

- **Dev 2 (Photos/Storage)** is the hardest and most security-sensitive — give it to your strongest backend person.
- **Dev 4 (Platform/QA/DevOps)** has the widest surface and most tooling — give it to whoever is most comfortable with build tooling and writing prose, since they own the report-facing documentation.
- **Dev 1 (Orders)** is the most self-contained full-stack slice — ideal for someone who wants a clean, demonstrable, end-to-end story.
- **Dev 3 (Admin/Notifications)** has the most individual tasks but each is small — good for someone who prefers steady visible progress.

---

## 2. Developer 1 — Orders & Commerce

### Primary responsibility
Own the entire ordering feature from the product catalogue through to order history. This feature currently **cannot work at all** (G-01); by the end you own the one that does.

### Why this is a coherent slice
Orders touch a validator, a service, a controller, a route, a DB CHECK constraint, a Zustand store, an API service, four components, and a screen — but **nothing outside orders touches any of those files**. It is the cleanest vertical boundary in the repo.

### Tasks

| # | Gap | Task | Effort |
|---|---|---|---|
| 1.1 | G-01a | Create `packages/backend/src/constants/products.ts` — the **single source of truth** for product types, labels, and prices in integer cents. Export the type union. | S |
| 1.2 | G-01b | Mirror it in `apps/mobile/src/features/orders/constants/products.ts` (values must match exactly; add a comment cross-referencing the backend file) | XS |
| 1.3 | G-01c | Rewrite `order.validator.ts` to use the shared vocabulary; keep camelCase (`photoId`, `productType`, `shippingAddress`) to match every other endpoint | S |
| 1.4 | G-01d | Fix `orderService.createOrder` in mobile to send camelCase and drop client-side `unit_price` (the server prices it — never trust the client) | S |
| 1.5 | G-01e | Migration: align the `order_items.product_type` CHECK with the shared catalogue | XS |
| 1.6 | G-01f | Migration: rename `orders.total_amount` → `total_cents` as `integer`, or add an explicit comment fixing the unit. Update `order.service.ts` and every mobile price formatter. | S |
| 1.7 | G-19a | Fix `order_items.photo_id` `NOT NULL` + `ON DELETE SET NULL` contradiction | XS |
| 1.8 | G-18a | Apply `getOrdersSchema` to `GET /orders` | XS |
| 1.9 | G-37 | Wrap order + order_items in a Postgres function so the write is atomic | S |
| 1.10 | G-33a | Replace the hand-rolled `res.status().json()` in `order.controller.createOrder` with `AppError` | XS |
| 1.11 | G-28a | Add order success/failure toasts (consumes Dev 4's `<Toast>`) | S |
| 1.12 | U-7 | Render the real photo thumbnail in `OrderDetailSheet` instead of `itemImagePlaceholder` | S |
| 1.13 | — | Admin read-only order list endpoint + screen (closes the loop; RLS `orders_admin_select` already exists) | M |
| 1.14 | — | Tests T-14 – T-19 (order validation, server pricing, unauthorised photo, idempotency ×2, totals) | M |
| 1.15 | — | k6 order-creation scenario | S |

### Files owned (exclusive)
```
packages/backend/src/constants/products.ts          [new]
packages/backend/src/validators/order.validator.ts
packages/backend/src/services/order.service.ts
packages/backend/src/controllers/order.controller.ts
packages/backend/src/routes/order.routes.ts
supabase/migrations/00017_*.sql … 00019_*.sql       [reserved range]
apps/mobile/src/features/orders/**                  [entire folder]
apps/mobile/src/app/(parent)/orders.tsx
packages/backend/tests/orders.test.ts               [new]
```

### APIs owned
`POST /api/v1/orders` · `GET /api/v1/orders` · `GET /api/v1/orders/:id` · `GET /api/v1/admin/orders` *(new)*

### UI owned
`OrderBottomSheet` · `OrderDetailSheet` · `OrderHistoryCard` · `ProductPicker` · `(parent)/orders.tsx` · new admin orders screen

### Tests owned
T-14, T-15, T-16, T-17, T-18, T-19 + `cartStore` unit tests (T-35)

### Documentation
API reference for the orders endpoints · order sequence diagram with idempotency (**G-8** in the audit's diagram list) · the "payments are out of scope, orders are requests" scoping note

### Dependencies
- **Needs from Dev 4:** the `<Toast>` component (day 2). *Workaround:* use `Alert.alert` until it lands, then swap — a one-line change.
- **Needs from Dev 3:** nothing.
- **Provides to Dev 4:** a working order flow, required before the end-to-end demo script.
- **Migration ordering:** your migrations are 00017–00019. Do not use numbers outside that range.

### Deliverables
A working order: a parent selects a photo, picks a product, sets quantity, enters an address, submits, sees a success toast, and finds the order in history at the correct price — with an admin able to see it. Plus 7 tests and the sequence diagram.

### Recommended commit sequence
```
feat(orders): add shared product catalogue with cents-based pricing
fix(orders): align mobile payload with backend validator contract
fix(db): correct order_items product_type check constraint
fix(orders): store order totals in integer cents consistently
fix(db): resolve order_items.photo_id null/cascade contradiction
feat(orders): wrap order creation in an atomic transaction
feat(orders): surface success and failure toasts on checkout
feat(orders): show photo thumbnails in order detail
feat(admin): add read-only order listing endpoint and screen
test(orders): cover validation, pricing, authorisation and idempotency
docs(orders): document order API and idempotency sequence
```

---

## 3. Developer 2 — Photos, Storage & Media

### Primary responsibility
Own the photo lifecycle: upload → storage → processing → authorised delivery → feed. This slice contains **the project's most severe security finding (G-02) and its worst performance problem (G-12)**, which happen to have the same fix.

### Why this is a coherent slice
The photo path is self-contained: `photo.*`, `feed.*`, `upload.ts`, `supabaseStorage.ts`, `useUpload.ts`, `teacherService.ts`. Nobody else needs to touch these.

### Tasks

| # | Gap | Task | Effort |
|---|---|---|---|
| 2.1 | G-02a | Migration: flip the `photos` bucket to `public = false`; drop the `TO public` read policy | XS |
| 2.2 | G-02b | Rewrite `photo.service.saveUploadedFile` to upload to Supabase Storage instead of `fs.renameSync` | M |
| 2.3 | G-12 | Generate a 400px thumbnail with `sharp` **synchronously in the upload request**; upload as `{key}_thumb.jpg`; persist `thumbnail_s3_key`, `width`, `height`, `blurhash` | M |
| 2.4 | G-42 | Convert HEIC → JPEG in the same `sharp` pass; update `mime_type` and the storage key | S |
| 2.5 | G-02c | Replace all four URL builders with `createSignedUrl(path, 3600)` (`feed.service.ts:128,177`; `photo.service.ts:321,418`) | S |
| 2.6 | G-02d | **Delete `app.use('/uploads', express.static(...))`** — coordinate with Dev 4 (§12) | XS |
| 2.7 | G-04 | Add ownership check to `getPhotoDetails`: thread `req.user.id`, `EXISTS` on tags ⋈ mappings, return **404** not 403 | S |
| 2.8 | G-08b | Scope `getPhotosByClass` to the caller's school | S |
| 2.9 | G-17 | Ownership checks on `POST /photos/:id/file` and `/confirm` | S |
| 2.10 | G-07 | Reorder the pipeline to **tag → confirm → ready** so `notify_parents_on_photo` sees the tags; fix the `confirmUpload` state guard | S |
| 2.11 | G-14 | Rewrite `feed.service.getFeed` as one paginated `photo_student_tags` ⋈ `photos!inner` query (removes the unbounded `IN` clause) | M |
| 2.12 | G-15 | Delete the dead duplicate `photo.service.getParentFeed` | XS |
| 2.13 | G-13 | Delete `jobs/`, `config/redis.ts`, `middleware/idempotency`'s Redis dep *(coordinate — Dev 1 needs idempotency)*, and the `bullmq`/`ioredis`/`@aws-sdk/*` dependencies | M |
| 2.14 | G-18b | Apply `tagStudentsSchema` to `POST /photos/:id/tag` | XS |
| 2.15 | G-40 | Verify magic bytes via `sharp().metadata()` rather than trusting the client MIME | XS |
| 2.16 | G-35 | Cap upload concurrency at 3 in `useUpload.startUpload` | XS |
| 2.17 | G-27 | Real upload progress via `XMLHttpRequest.upload.onprogress` *(optional — drop if time is short)* | M |
| 2.18 | — | Tests T-6, T-8, T-9, T-10, T-11, T-12, T-13, T-20, T-21, T-22, T-23, T-24, T-25 | L |
| 2.19 | — | k6 feed + upload scenarios; **capture before/after payload sizes** | S |

> **Note on 2.13:** `middleware/idempotency.ts` uses Redis and Dev 1's order flow depends on it. If you remove Redis entirely, replace the idempotency store with a Postgres table (`orders.idempotency_key` is already `UNIQUE`, so the DB constraint alone gives you most of the guarantee). **Agree this with Dev 1 before starting.** Simplest option: keep Redis solely for idempotency and delete only BullMQ.

### Files owned (exclusive)
```
packages/backend/src/services/photo.service.ts
packages/backend/src/services/feed.service.ts
packages/backend/src/controllers/photo.controller.ts
packages/backend/src/controllers/feed.controller.ts
packages/backend/src/routes/photo.routes.ts
packages/backend/src/routes/feed.routes.ts
packages/backend/src/validators/photo.validator.ts
packages/backend/src/middleware/upload.ts
packages/backend/src/utils/supabaseStorage.ts
packages/backend/src/utils/signedUrl.ts               [delete]
packages/backend/src/config/s3.ts                     [delete]
packages/backend/src/jobs/**                          [delete]
supabase/migrations/00020_*.sql … 00022_*.sql         [reserved range]
apps/mobile/src/features/teacher/**                   [entire folder]
apps/mobile/src/features/parent/**                    [entire folder]
apps/mobile/src/app/(teacher)/upload.tsx
apps/mobile/src/app/(teacher)/dashboard.tsx
apps/mobile/src/app/(parent)/feed.tsx
apps/mobile/src/app/(parent)/photo/[id].tsx
apps/mobile/src/components/media/**
packages/backend/tests/photos.test.ts, feed.test.ts    [new]
```

### APIs owned
All `/api/v1/photos/*` and `/api/v1/feed/*`

### UI owned
`HiveImage` · `PolaroidCard` · `MasonryGrid` · `PhotoViewer` · `StudentTagger`* · upload/dashboard/feed/photo-detail screens
*(*`StudentTagger` lives in `components/forms/` — see §12 for the shared-folder rule.)*

### Tests owned
13 tests — the largest test share, matching the largest risk surface

### Documentation
Photo upload sequence diagram (**G-4**) · feed data flow (**G-5**) · the storage decision rationale (why Supabase Storage over S3) · the before/after performance table

### Dependencies
- **Needs from Dev 4:** `app.ts` access for task 2.6 (one-line deletion — take it on **day 1** before Dev 4 starts on `app.ts`).
- **Needs from Dev 3:** nothing, but **G-07 (2.10) makes Dev 3's notification screens meaningful** — coordinate so you can demo them together.
- **Provides to everyone:** working thumbnails, which every screen showing a photo depends on.
- **Migrations:** 00020–00022 only.

### Deliverables
Photos stored privately in object storage, served via short-lived signed URLs only to authorised users, with thumbnails cutting feed payload by 50–100×, parents correctly notified on upload, and three IDOR vulnerabilities closed. Plus 13 tests and two diagrams.

### Recommended commit sequence
```
security(storage): make photos bucket private and drop public read policy
feat(storage): upload photos to Supabase Storage instead of local disk
feat(photos): generate thumbnails and blurhash during upload
feat(photos): convert HEIC uploads to JPEG
security(photos): serve photos via short-lived signed URLs
security(photos): remove unauthenticated static uploads route
security(feed): enforce parent ownership on photo detail endpoint
security(photos): scope class photo listing to the caller's school
security(photos): verify photo ownership on file upload and confirm
fix(upload): tag students before marking photo ready so parents are notified
perf(feed): replace unbounded tag fetch with a single paginated join
refactor(photos): remove duplicate parent feed implementation
chore(deps): remove BullMQ, S3 and unused image processing workers
fix(photos): validate tag payload and verify image magic bytes
perf(upload): limit concurrent uploads to three
test(photos): cover upload, tagging, authorisation and feed privacy
docs(photos): document upload pipeline and storage architecture
```

---

## 4. Developer 3 — Admin, Notifications & Data

### Primary responsibility
Own the admin console, the notification feature, and database/data integrity. This slice contains **the single cheapest high-impact win in the project** (G-03).

### Why this is a coherent slice
Admin and notifications share a shape: both are CRUD over `profiles`/`schools`/`students`/`notifications`, both are read-heavy, and neither overlaps the photo or order paths. Bundling schema-integrity work here is natural because this developer already owns the tables everyone else reads.

### Tasks

| # | Gap | Task | Effort |
|---|---|---|---|
| 3.1 | **G-03** | **Replace the "Coming Soon" `EmptyState` in all three `notifications.tsx` screens with the existing `<NotificationCenter />`.** ~700 lines of finished code is currently unimported. **Do this first — highest value per minute in the whole plan.** | S |
| 3.2 | G-06 | Fix `getDashboardStats`: `orders.total` → `total_amount`, use `{count:'exact',head:true}`, and check the error instead of swallowing it | XS |
| 3.3 | G-09 | Unify the role vocabulary: remove every `school_admin` reference (6 sites) in `roleGuard` calls, `updateUserRoleSchema`, and `notifyAdminsOfNewOrder` | XS |
| 3.4 | G-16 | Sanitise the `search` parameter to stop PostgREST filter injection | XS |
| 3.5 | G-11 | Rewrite seeding as `packages/backend/src/scripts/seedDemo.ts` — create auth users via `supabase.auth.admin.createUser`, then schools, classes, students, mappings, and sample photos. `seed.sql` cannot work as written. | M |
| 3.6 | G-19b | Fix `photos.uploaded_by` and `photo_student_tags.tagged_by` `NOT NULL` + `ON DELETE SET NULL` | S |
| 3.7 | G-36 | Make migrations idempotent (`DROP POLICY IF EXISTS` before `CREATE POLICY` in 00011 and 00015) | XS |
| 3.8 | G-31 | Fix `markAsRead` so it actually returns 404 | XS |
| 3.9 | G-34 | Remove the N+1 in `getSchools` (2 count queries per school) | S |
| 3.10 | G-32 | Refactor `schools.routes.ts` into controller + service + validator, matching every other domain | S |
| 3.11 | G-08a | Scope `/schools/:id/*` to the caller's school | S |
| 3.12 | G-29 | Shared `<ConfirmDialog>` on destructive admin actions (remove student, remove parent mapping) | S |
| 3.13 | G-30 | Meaningful empty states: "no children linked" (parent) and "no school assigned" (teacher) | XS |
| 3.14 | M-9 | Wire the orphaned `updateSchoolSchema` into a `PATCH /admin/schools/:id` route | S |
| 3.15 | — | Tests T-27, T-28, T-29, T-30, T-31, T-32 | M |
| 3.16 | — | ER diagram (**G-2**) and the database design document | M |

### Files owned (exclusive)
```
packages/backend/src/services/admin.service.ts
packages/backend/src/services/notification.service.ts
packages/backend/src/controllers/admin.controller.ts
packages/backend/src/controllers/notification.controller.ts
packages/backend/src/routes/admin.routes.ts
packages/backend/src/routes/notification.routes.ts
packages/backend/src/routes/schools.routes.ts
packages/backend/src/validators/admin.validator.ts
packages/backend/src/services/school.service.ts        [new]
packages/backend/src/scripts/seedDemo.ts               [new]
supabase/seed.sql                                      [rewrite/remove]
supabase/migrations/00023_*.sql … 00026_*.sql          [reserved range]
apps/mobile/src/features/admin/**                      [entire folder]
apps/mobile/src/features/notifications/**              [entire folder]
apps/mobile/src/app/(admin)/**                         [entire folder]
apps/mobile/src/app/(parent)/notifications.tsx
apps/mobile/src/app/(teacher)/notifications.tsx
apps/mobile/src/app/(parent)/profile.tsx
apps/mobile/src/app/(teacher)/profile.tsx
packages/backend/tests/admin.test.ts, notifications.test.ts  [new]
```

### APIs owned
All `/api/v1/admin/*` · all `/api/v1/notifications/*` · all `/api/v1/schools/*`

### UI owned
All admin screens and sheets (`AddSchoolSheet`, `AddClassSheet`, `AddStudentSheet`, `AssignTeacherSheet`, `MapParentSheet`, `ParentListSheet`, `UserEditSheet`, `UserListItem`, `StudentCard`, `SchoolCard`, `StatCard`) · `NotificationCenter` · `NotificationCard` · all three notifications screens · profile screens · `<ConfirmDialog>`

### Tests owned
T-27 – T-32 (6 tests)

### Documentation
ER diagram · database design doc · admin API reference · notification flow description

### Dependencies
- **Needs from Dev 2:** G-07 (tag-before-ready) for `new_photos` notifications to actually appear. Your screens work regardless; the *content* depends on it. **Coordinate for the demo.**
- **Needs from Dev 4:** nothing blocking.
- **Provides to everyone:** the demo dataset (3.5) — **everyone needs this by day 3 for meaningful testing.** Prioritise it.
- **Migrations:** 00023–00026 only.

### Deliverables
Working notifications on all three roles, an admin dashboard showing real numbers, a consistent role model, a one-command demo dataset, and a clean `schools` module. Plus 6 tests and the ER diagram.

### Recommended commit sequence
```
feat(notifications): wire notification centre into parent, teacher and admin screens
fix(admin): correct dashboard revenue query and count aggregation
refactor(rbac): remove unsupported school_admin role across the API
security(admin): sanitise user search to prevent filter injection
feat(seed): add demo data seeding script with real auth users
fix(db): resolve null/cascade contradictions on photo foreign keys
fix(db): make policy migrations idempotent
fix(notifications): return 404 when marking a missing notification
perf(admin): remove N+1 school count queries
refactor(schools): extract schools routes into controller and service
security(schools): scope school endpoints to the caller's school
feat(admin): confirm destructive actions before executing
feat(ux): add guidance empty states for unlinked parents and teachers
feat(admin): support editing school details
test(admin): cover dashboard, mappings, search and notifications
docs(db): add ER diagram and database design document
```

---

## 5. Developer 4 — Platform, Security, QA & DevOps

### Primary responsibility
Own everything shared: auth middleware, route guards, the design system, shared UI, configuration, observability — plus the test harness, CI/CD, deployment, and all report-facing documentation.

### Why this is a coherent slice
These are exactly the files the other three must **not** edit. Concentrating them in one owner turns the highest-conflict files into zero-conflict files. It also means one person owns the artefacts an evaluator reads first: the README, the diagrams, the CI badge, and the deployed URL.

### Tasks

| # | Gap | Task | Effort |
|---|---|---|---|
| 4.1 | G-10 | Remove hardcoded admin credentials from `seedAdmin.ts`; read from env; fail loudly; never log the password. **Do this in the first hour.** | XS |
| 4.2 | G-45 | Configure custom SMTP (Resend free tier) in Supabase so OTP emails don't hit the default rate limit **during the demo** | XS |
| 4.3 | G-05 | Build `<RoleGate>` / `useRequireRole` and apply it in all three route group layouts; use the `role`/`isAuthenticated` that `_layout.tsx:43-44` currently reads and ignores | S |
| 4.4 | G-20 | `app.set('trust proxy', 1)` instead of `true` | XS |
| 4.5 | G-25 | Fix both `.env.example` files: port mismatch (3000 vs 4000), missing `BACKEND_URL`, remove unused AWS vars | XS |
| 4.6 | G-28b | Build the shared `<Toast>` / `<ToastProvider>` (Dev 1 and Dev 3 consume it — **ship by day 2**) | S |
| 4.7 | G-38 | `X-Request-ID` middleware; promote request logging from `debug` to `info` so it's visible in production | XS |
| 4.8 | G-39 | Sentry in both backend and mobile | S |
| 4.9 | V-6 | Real `/health` — ping Supabase, return `{status, db, uptime, version}` | XS |
| 4.10 | G-26 | Wire `assets/lottie/bee.json` into `OnboardingSlide` and `+not-found` (currently empty `View` placeholders) | S |
| 4.11 | G-21a | Set up Vitest + Supertest in the backend, Vitest in mobile; add a `test` task to `turbo.json` | M |
| 4.12 | G-21b | Write the platform tests: T-1 – T-5, T-26, T-33, T-34, T-37, T-38 | M |
| 4.13 | G-23a | Backend Dockerfile (multi-stage, non-root) | S |
| 4.14 | G-23b | GitHub Actions: install → lint → typecheck → build → test on every PR | S |
| 4.15 | G-23c | Deploy the backend to Render; configure env vars; verify from a phone on mobile data | M |
| 4.16 | V-9 | EAS build profile for a shareable APK | S |
| 4.17 | V-7 | Branch protection on `main`; require CI green | XS |
| 4.18 | G-22 | **Rewrite the README** — it currently describes Flutter, Provider/Riverpod, and a `lib/` tree that does not exist | S |
| 4.19 | G-43 | Architecture doc, security design doc, testing strategy, deployment guide, limitations & future scope, env reference | L |
| 4.20 | — | Diagrams **G-1** (architecture), **G-3** (auth sequence), **G-6** (user flows), **G-7** (deployment) | M |
| 4.21 | — | k6 harness + the consolidated load-test report | M |
| 4.22 | G-44 | Own the contribution statement and verify `git shortlog` shows four real contributors | XS |

### Files owned (exclusive)
```
packages/backend/src/app.ts
packages/backend/src/index.ts
packages/backend/src/middleware/auth.ts
packages/backend/src/middleware/roleGuard.ts
packages/backend/src/middleware/rateLimiter.ts
packages/backend/src/middleware/errorHandler.ts
packages/backend/src/middleware/validate.ts
packages/backend/src/config/env.ts, logger.ts, supabase.ts
packages/backend/src/utils/apiResponse.ts
packages/backend/src/scripts/seedAdmin.ts
packages/backend/Dockerfile                            [new]
packages/backend/loadtest/**                           [new]
packages/backend/tests/setup.ts, platform.test.ts      [new]
apps/mobile/src/app/_layout.tsx
apps/mobile/src/app/index.tsx
apps/mobile/src/app/+not-found.tsx
apps/mobile/src/app/(auth)/**                          [entire folder]
apps/mobile/src/features/auth/**                       [entire folder]
apps/mobile/src/features/onboarding/**                 [entire folder]
apps/mobile/src/components/ui/**
apps/mobile/src/components/feedback/**
apps/mobile/src/components/layout/**
apps/mobile/src/components/navigation/**
apps/mobile/src/components/animation/**
apps/mobile/src/theme/**
apps/mobile/src/lib/**
apps/mobile/src/hooks/**, utils/**, types/navigation.ts
.github/workflows/**                                   [new]
turbo.json, .eslintrc.js, .prettierrc, root package.json
README.md, docs/**
supabase/migrations/00027_*.sql +                      [reserved range]
```

### APIs owned
`/health` · all authentication and authorization **middleware** (not the routes that use it)

### UI owned
The entire design system and shared component library · auth and onboarding screens · `<RoleGate>` · `<Toast>` · `TabBar` · `HeaderBar`

### Tests owned
T-1 – T-5, T-26, T-33, T-34, T-37, T-38 (10 tests) **plus the harness everyone else's tests run on**

### Documentation
README · architecture · security design · testing strategy · deployment guide · env reference · limitations · **four of the eight diagrams** · load test report · contribution statement

### Dependencies
- **Blocks Dev 1 and Dev 3** on `<Toast>` (4.6) — **ship it by end of day 2**; they use `Alert.alert` until then.
- **Blocks everyone** on the test harness (4.11) — **ship it by end of day 3**.
- **Blocked by Dev 2** on `app.ts`: let Dev 2 land the `/uploads` deletion on day 1 before you touch that file.
- **Blocked by everyone** for final deployment and the load-test report — those come last by design.
- **Migrations:** 00027+ only.

### Deliverables
A deployed, monitored, CI-verified application with role-based routing, a working test harness, an accurate README, four diagrams, a load-test report, and a contribution statement backed by real git history.

### Recommended commit sequence
```
security(auth): move admin seed credentials to environment variables
security(api): restrict trusted proxy hops to prevent rate limit bypass
feat(auth): add role-based route guards to all navigation groups
feat(ui): add toast provider for global user feedback
feat(obs): add request correlation IDs and production request logging
feat(obs): integrate Sentry error tracking
feat(api): add dependency-aware health check
feat(onboarding): replace placeholder animations with Lottie assets
chore(config): correct environment variable examples
test(setup): add Vitest and Supertest harness with turbo task
test(platform): cover authentication, RBAC, validation and error handling
build(docker): add multi-stage backend Dockerfile
ci: add lint, typecheck, build and test workflow
chore(deploy): deploy backend to Render with production configuration
docs: rewrite README to reflect the actual React Native stack
docs: add architecture, security and deployment documentation
docs: add system, auth and deployment diagrams
perf: add k6 load test suite and results report
```

---

## 6. Workload Balance

| Dev | Slice | Tasks | Est. effort | Backend | Mobile | DB | Tests | Docs |
|---|---|---|---|---|---|---|---|---|
| 1 | Orders | 15 | ~2.0 days | ●●● | ●●● | ●● | 7 | ●● |
| 2 | Photos/Storage | 19 | ~2.5 days | ●●●●● | ●●● | ●● | 13 | ●●● |
| 3 | Admin/Notifications | 16 | ~2.0 days | ●●●● | ●●●● | ●●● | 6 | ●●● |
| 4 | Platform/QA/DevOps | 22 | ~2.5 days | ●●● | ●●● | ● | 10 | ●●●●● |

**Difficulty balance.** Dev 2 has the hardest engineering (storage migration, signed URLs, query rewrite); Dev 4 has the widest surface but individually easier tasks with a heavy writing load; Devs 1 and 3 sit in between. Test counts are proportional to risk owned, not padded to be equal.

**Load-balancing rule:** Dev 1 finishes earliest (orders is the most self-contained slice). From **day 4**, Dev 1 should pick up: the k6 scenarios from Dev 4, or Dev 2's optional G-27 (real upload progress). Agree this at the day-3 checkpoint rather than leaving it implicit.

---

## 7. File / Module Ownership

### Backend

| Path | Owner |
|---|---|
| `app.ts`, `index.ts`, `middleware/*`, `config/*`, `utils/apiResponse.ts`, `scripts/seedAdmin.ts` | **Dev 4** |
| `middleware/upload.ts`, `utils/supabaseStorage.ts`, `utils/signedUrl.ts`, `config/s3.ts`, `jobs/*` | **Dev 2** |
| `services|controllers|routes|validators/photo.*`, `feed.*` | **Dev 2** |
| `services|controllers|routes|validators/order.*`, `constants/products.ts` | **Dev 1** |
| `services|controllers|routes|validators/admin.*`, `notification.*`, `schools.routes.ts`, `scripts/seedDemo.ts` | **Dev 3** |
| `tests/setup.ts`, `loadtest/*`, `Dockerfile` | **Dev 4** |

### Mobile

| Path | Owner |
|---|---|
| `app/_layout.tsx`, `app/index.tsx`, `app/+not-found.tsx`, `app/(auth)/**` | **Dev 4** |
| `components/{ui,feedback,layout,navigation,animation}/**`, `theme/**`, `lib/**`, `hooks/**`, `utils/**` | **Dev 4** |
| `features/{auth,onboarding}/**` | **Dev 4** |
| `features/{teacher,parent}/**`, `components/media/**`, `app/(teacher)/{upload,dashboard}.tsx`, `app/(parent)/{feed,photo/[id]}.tsx` | **Dev 2** |
| `features/orders/**`, `app/(parent)/orders.tsx` | **Dev 1** |
| `features/{admin,notifications}/**`, `app/(admin)/**`, all `notifications.tsx`, all `profile.tsx` | **Dev 3** |

### Supabase

| Range | Owner |
|---|---|
| `migrations/00017–00019` | **Dev 1** |
| `migrations/00020–00022` | **Dev 2** |
| `migrations/00023–00026` | **Dev 3** |
| `migrations/00027+` | **Dev 4** |
| `seed.sql`, `seedDemo.ts` | **Dev 3** |

**Reserving migration number ranges is the single most effective conflict-prevention measure in this plan.** Two people creating `00017_*.sql` simultaneously is the most likely and most annoying conflict in a Supabase project, and reserved ranges eliminate it entirely.

---

## 8. API Ownership

| Endpoint group | Owner | Contract-stable by |
|---|---|---|
| `POST/GET /api/v1/orders*`, `GET /api/v1/admin/orders` | Dev 1 | End of day 1 |
| `/api/v1/photos/*`, `/api/v1/feed/*` | Dev 2 | End of day 2 |
| `/api/v1/admin/*`, `/api/v1/notifications/*`, `/api/v1/schools/*` | Dev 3 | End of day 2 |
| `/health`, all auth middleware | Dev 4 | Day 1 |

**Contract rule.** An owner may change their own request/response shape freely **until their "contract-stable" date**. After that, any change is a breaking change: announce it in the team channel, and update every consumer in the same PR. This exists because G-01 — the project's worst bug — is precisely a contract that drifted with nobody owning it.

---

## 9. Dependency Map

```
Dev 4: <Toast>            ──────►  Dev 1 (order feedback)
                          ──────►  Dev 3 (admin feedback)
                                   [workaround: Alert.alert]

Dev 4: test harness       ──────►  Dev 1, Dev 2, Dev 3 (all tests)
                                   [hard blocker — ship by end of day 3]

Dev 2: /uploads removal   ──────►  Dev 4 (then owns app.ts)
                                   [Dev 2 goes first, day 1]

Dev 2: thumbnails (G-12)  ──────►  Dev 1 (order detail images)
                          ──────►  Dev 3 (admin photo counts look right)
                                   [soft — screens work without it]

Dev 2: tag-before-ready   ──────►  Dev 3 (new_photos notifications
       (G-07)                              have content)
                                   [soft — screens work, list is empty]

Dev 3: demo seed (G-11)   ──────►  Dev 1, Dev 2, Dev 4 (realistic testing)
                                   [soft but important — ship by day 3]

Dev 1: working orders     ──────►  Dev 4 (demo script, load tests)
Dev 2: signed URLs        ──────►  Dev 4 (load tests, deployment)
Dev 3: seed + admin       ──────►  Dev 4 (demo script)
All                       ──────►  Dev 4 (deployment, final docs)
```

**Only two hard blockers exist:** the test harness and the `app.ts` sequencing. Both are resolved by day 3 and by day 1 respectively. Everything else has a workaround, which is the point of the split.

---

## 10. Parallel Execution Matrix

| Task | D1 | D2 | D3 | D4 | Depends on | Parallel? |
|---|:--:|:--:|:--:|:--:|---|---|
| Remove hardcoded credentials (G-10) | | | | ✔ | — | ✅ |
| Configure SMTP (G-45) | | | | ✔ | — | ✅ |
| Fix dashboard stats (G-06) | | | ✔ | | — | ✅ |
| Unify role vocabulary (G-09) | | | ✔ | | — | ✅ |
| **Wire notification screens (G-03)** | | | ✔ | | — | ✅ |
| Sanitise admin search (G-16) | | | ✔ | | — | ✅ |
| Trust proxy (G-20) | | | | ✔ | — | ✅ |
| Fix `.env.example` (G-25) | | | | ✔ | — | ✅ |
| Remove `/uploads` static (G-02d) | | ✔ | | | — | ✅ **day 1, first** |
| Product catalogue (G-01a/b) | ✔ | | | | — | ✅ |
| Order contract fix (G-01c–f) | ✔ | | | | G-01a | ✅ |
| Bucket → private (G-02a) | | ✔ | | | — | ✅ |
| Storage migration (G-02b) | | ✔ | | | G-02a | ⚠️ after G-02a |
| Thumbnails (G-12) | | ✔ | | | G-02b | ⚠️ after G-02b |
| Signed URLs (G-02c) | | ✔ | | | G-02b | ⚠️ after G-02b |
| HEIC conversion (G-42) | | ✔ | | | G-12 | ⚠️ after G-12 |
| Photo-detail IDOR (G-04) | | ✔ | | | — | ✅ |
| Cross-school IDOR (G-08) | | ✔ | ✔ | | — | ✅ split by file |
| Upload ownership (G-17) | | ✔ | | | — | ✅ |
| Route guards (G-05) | | | | ✔ | — | ✅ |
| Tag-before-ready (G-07) | | ✔ | | | G-02b | ⚠️ after G-02b |
| Feed query rewrite (G-14) | | ✔ | | | — | ✅ |
| Remove BullMQ (G-13) | | ✔ | | | G-12 | ⚠️ after G-12 |
| FK constraints (G-19) | ✔ | | ✔ | | — | ✅ split by table |
| Demo seed (G-11) | | | ✔ | | G-01e | ⚠️ after order CHECK |
| `<Toast>` (G-28b) | | | | ✔ | — | ✅ |
| Order toasts (G-28a) | ✔ | | | | G-28b | ⚠️ after Toast |
| Confirm dialogs (G-29) | | | ✔ | | — | ✅ |
| Empty states (G-30) | | | ✔ | | — | ✅ |
| Onboarding animation (G-26) | | | | ✔ | — | ✅ |
| Atomic orders (G-37) | ✔ | | | | G-01 | ⚠️ |
| Schools refactor (G-32) | | | ✔ | | — | ✅ |
| N+1 removal (G-34) | | | ✔ | | — | ✅ |
| Test harness (G-21a) | | | | ✔ | — | ✅ |
| Feature tests | ✔ | ✔ | ✔ | ✔ | G-21a | ⚠️ after harness |
| Sentry (G-39) | | | | ✔ | — | ✅ |
| Dockerfile + CI (G-23a/b) | | | | ✔ | — | ✅ |
| Deploy (G-23c) | | | | ✔ | all P0 | ❌ last |
| Load tests | ✔ | ✔ | | ✔ | deploy | ❌ last |
| README (G-22) | | | | ✔ | — | ✅ |
| Diagrams | ✔ | ✔ | ✔ | ✔ | — | ✅ all four |

**Roughly 75% of tasks are fully parallel.** The serialised remainder is concentrated in Dev 2's storage chain (which is inherently sequential) and the final deploy/load-test phase (which must come last).

---

## 11. Branch Strategy

```
main                       protected · always deployable · release tags only
 └── develop               integration branch · CI must be green
      ├── feat/orders-*            Dev 1
      ├── feat/photos-*            Dev 2
      ├── security/photos-*        Dev 2
      ├── feat/admin-*             Dev 3
      ├── feat/notifications-*     Dev 3
      ├── security/platform-*      Dev 4
      ├── ci/*, docs/*, test/*     Dev 4
```

**Rules**
1. Never commit directly to `main` or `develop`.
2. Branch from `develop`; PR back into `develop`.
3. One PR per logical change — not one giant PR per developer.
4. Every PR needs one approval from another team member. **Review across slices**, so everyone reads code they didn't write (this matters for the viva).
5. CI must be green before merge.
6. `git pull --rebase origin develop` at the start of each day.
7. `develop` → `main` only at the integration checkpoints in §17.

---

## 12. Shared Files & Conflict Protocol

These files are genuinely shared. Each has a named owner and a rule.

| File | Owner | Protocol |
|---|---|---|
| `packages/backend/src/app.ts` | **Dev 4** | Dev 2 makes the one-line `/uploads` deletion on **day 1, first**. After that, only Dev 4 edits it. Route registrations: request via the team channel. |
| `apps/mobile/src/app/_layout.tsx` | **Dev 4** | Nobody else edits. Providers (Toast, Sentry) are added by Dev 4 only. |
| `apps/mobile/src/theme/**` | **Dev 4** | Others **consume** but never edit. Need a new colour or spacing token? Ask Dev 4. |
| `apps/mobile/src/components/ui/**` | **Dev 4** | Same rule. New shared components go here via Dev 4. |
| `apps/mobile/src/components/forms/**` | **shared** | `StudentTagger`, `ClassSelector` → Dev 2. `OTPInput` → Dev 4. `ChildSwitcher` → Dev 2. **Split by file, documented here.** |
| `apps/mobile/src/types/supabase.ts` | **Dev 3** | Schema owner regenerates it. Others request updates after a migration. |
| `packages/backend/package.json` | **shared** | **Announce every dependency change in the team channel before committing.** `pnpm-lock.yaml` conflicts are resolved by re-running `pnpm install`, never by hand-editing. |
| `apps/mobile/package.json` | **shared** | Same rule. |
| `turbo.json`, root `package.json`, ESLint, Prettier | **Dev 4** | Nobody else edits. |
| `supabase/migrations/**` | **ranges** | Reserved ranges per §7. Never reuse or renumber someone else's file. |
| `README.md`, `docs/**` | **Dev 4** | Others write their sections in **separate files** under `docs/`, which Dev 4 links from the README. Avoids four people editing one markdown file. |

**Conflict-resolution rule.** If two people find themselves needing the same file, **stop and reassign in the team channel** rather than both editing. In a six-day window a five-minute conversation beats a merge conflict every time.

---

## 13. Commit Strategy

Commitlint with `@commitlint/config-conventional` is **already configured** (`commitlint.config.js`) and currently has zero commits obeying it. Start now.

```
<type>(<scope>): <imperative summary>
```

| Type | Use for |
|---|---|
| `feat` | New user-visible capability |
| `fix` | Bug fix |
| `security` | Security fix — **use this liberally; it makes the audit trail visible** |
| `perf` | Performance improvement |
| `refactor` | Restructure without behaviour change |
| `test` | Tests |
| `docs` | Documentation |
| `build` / `ci` / `chore` | Tooling, pipeline, dependencies |

**Scopes:** `orders`, `photos`, `feed`, `storage`, `upload`, `admin`, `notifications`, `auth`, `rbac`, `db`, `ui`, `ux`, `obs`, `api`, `deps`, `seed`, `config`, `deploy`

**Rules**
1. One logical change per commit. A commit that fixes a bug *and* renames a variable *and* adds a test is three commits.
2. Imperative mood: "add", not "added"/"adds".
3. Body explains **why**, not what — the diff shows what.
4. Reference the gap ID: `Closes G-01`.
5. Commit at least twice daily so history reflects real progress.
6. **Never fabricate commits to inflate counts.** An evaluator can spot padding, and it's worse than a low count. The work in this plan is genuinely enough for four people to produce 15–20 substantive commits each.

**Example of a good commit:**
```
fix(orders): align mobile payload with backend validator contract

The mobile client sent snake_case fields (photo_id, shipping_address)
while the Zod schema required camelCase, so every order request failed
validation with a 400 before reaching the database. Standardises on
camelCase to match all other endpoints and removes the client-supplied
unit_price, which the server must own to prevent price tampering.

Closes G-01
```

---

## 14. Integration & Merge Order

Merge order matters where changes interact. Within a day, merge in this order:

**Day 1**
1. Dev 2 — `/uploads` static removal *(unblocks Dev 4 on `app.ts`)*
2. Dev 4 — credentials, trust proxy, env examples
3. Dev 3 — dashboard stats, role vocabulary, **notification screens**
4. Dev 1 — product catalogue

**Day 2**
1. Dev 1 — order contract + migration *(before Dev 3's seed, which inserts orders)*
2. Dev 2 — private bucket + storage migration
3. Dev 3 — FK fixes, idempotent migrations
4. Dev 4 — `<Toast>`, route guards

**Day 3**
1. Dev 2 — thumbnails, signed URLs, HEIC
2. Dev 3 — demo seed *(after Dev 1's order CHECK and Dev 2's storage)*
3. Dev 1 — toasts, atomic orders
4. Dev 4 — test harness *(unblocks everyone)*

**Day 4–5**
Tests → CI → deploy → load tests → docs. Order is forced by the dependency chain.

---

## 15. Testing Ownership

| Dev | Tests | Count |
|---|---|---|
| 1 | T-14 – T-19, T-35 (orders, pricing, idempotency, cart) | 7 |
| 2 | T-6, T-8 – T-13, T-20 – T-25 (photos, feed privacy, upload, tagging) | 13 |
| 3 | T-27 – T-32 (admin, search injection, notifications) | 6 |
| 4 | T-1 – T-5, T-26, T-33, T-34, T-37, T-38 (auth, RBAC, validation, errors, routing) **+ the harness** | 10 |

**Total: 36 tests.** Every test guards a defect this audit actually found — none are written for coverage's sake, which is the point the brief makes about avoiding meaningless 100% coverage.

**Rule:** you write tests for the code **you** own. If you break someone else's test, you fix it or you talk to them — you never delete or skip it.

---

## 16. Documentation Ownership

| Document | Owner | Location |
|---|---|---|
| README (rewrite) | Dev 4 | `README.md` |
| Architecture | Dev 4 | `docs/architecture.md` |
| Security design | Dev 4 | `docs/security.md` |
| Testing strategy + results | Dev 4 | `docs/testing.md` |
| Deployment guide | Dev 4 | `docs/deployment.md` |
| Environment reference | Dev 4 | `docs/environment.md` |
| Limitations & future scope | Dev 4 *(inputs from all)* | `docs/limitations.md` |
| Database design + ER | Dev 3 | `docs/database.md` |
| Orders API + idempotency | Dev 1 | `docs/api-orders.md` |
| Photos/feed API + storage rationale | Dev 2 | `docs/api-photos.md` |
| Admin/notifications API | Dev 3 | `docs/api-admin.md` |
| Load test report | Dev 4 *(scenarios from 1 & 2)* | `docs/performance.md` |
| Contribution statement | Dev 4 *(verified against git)* | `docs/contributions.md` |

**Diagrams**

| # | Diagram | Owner |
|---|---|---|
| G-1 | System architecture | Dev 4 |
| G-2 | ER diagram | Dev 3 |
| G-3 | Auth sequence | Dev 4 |
| G-4 | Upload sequence | Dev 2 |
| G-5 | Feed data flow | Dev 2 |
| G-6 | User flow / navigation map | Dev 4 |
| G-7 | Deployment topology | Dev 4 |
| G-8 | Order + idempotency sequence | Dev 1 |

**Everyone writes their own API docs in their own file.** Nobody edits a shared markdown file. Dev 4 links them from the README.

---

## 17. Integration Checkpoints

| # | When | Merge to | Gate | Owner |
|---|---|---|---|---|
| **CP-1** | End of day 1 | `develop` | Backend boots; app builds; no "Coming Soon" screens; no credentials in the repo | Dev 4 |
| **CP-2** | End of day 2 | `develop` | Order flow works end-to-end on a device; photos in private storage; role guards enforced | Dev 1 + Dev 2 |
| **CP-3** | End of day 3 | `develop` → **`main`** | Thumbnails live; notifications populated; demo seed loads; **first release tag `v0.1.0`** | Dev 4 |
| **CP-4** | End of day 4 | `develop` | All 36 tests green; CI passing on every PR | Dev 4 |
| **CP-5** | End of day 5 | `develop` → **`main`** | Deployed and reachable from a phone; Sentry receiving; load tests run; **tag `v0.9.0`** | Dev 4 |
| **CP-6** | End of day 6 | **`main`** | Full manual QA checklist green; demo rehearsed; docs complete; **tag `v1.0.0`** | All four |

**At each checkpoint, all four sit together for 30 minutes**, merge in the §14 order, run the app end-to-end on a real device, and fix whatever breaks. Do not skip this — integration bugs found on day 6 are the ones that ruin demos.

---

## 18. Day-by-Day Execution Plan

### Day 1 — Quick wins & foundations
| Dev | Work |
|---|---|
| 1 | Product catalogue (backend + mobile); begin the order contract rewrite |
| 2 | **Remove `/uploads` static (first — unblocks Dev 4)**; bucket → private migration; begin the storage rewrite |
| 3 | **Wire the notification screens (G-03)**; dashboard stats; role vocabulary; search sanitisation |
| 4 | Remove hardcoded credentials; SMTP; trust proxy; env examples; begin `<RoleGate>` |

**End of day:** three "Coming Soon" screens are gone; the admin dashboard shows real numbers; no credentials in the repo. **CP-1.**

### Day 2 — Contracts & security
| Dev | Work |
|---|---|
| 1 | Finish order contract; product_type migration; unit fix; `getOrdersSchema` |
| 2 | Storage upload rewrite; photo-detail IDOR; cross-school IDOR; upload ownership |
| 3 | FK constraint fixes; idempotent migrations; `markAsRead` 404; begin demo seed |
| 4 | Finish `<RoleGate>`; ship `<Toast>`; request IDs; Sentry |

**End of day:** orders submit successfully; three IDORs closed; role guards live. **CP-2.**

### Day 3 — Media & data
| Dev | Work |
|---|---|
| 1 | Order toasts; atomic transaction; order detail thumbnails |
| 2 | **Thumbnails + signed URLs + HEIC**; tag-before-ready; feed query rewrite |
| 3 | Finish demo seed; confirm dialogs; empty states; schools refactor; N+1 |
| 4 | **Ship the test harness**; onboarding animation; Dockerfile; begin README |

**End of day:** the app is fast, notifications have real content, demo data exists. **CP-3 → tag `v0.1.0`.**

### Day 4 — Testing
| Dev | Work |
|---|---|
| 1 | 7 order tests; k6 order scenario; orders API doc |
| 2 | 13 photo/feed tests; upload + feed diagrams |
| 3 | 6 admin/notification tests; ER diagram; database doc |
| 4 | 10 platform tests; GitHub Actions; branch protection |

**End of day:** 36 tests green in CI. **CP-4.**

### Day 5 — Deploy & document
| Dev | Work |
|---|---|
| 1 | Admin order list; help with k6 |
| 2 | Optional: real upload progress; performance before/after numbers |
| 3 | Finish database and admin docs; verify the seed on a fresh DB |
| 4 | **Deploy to Render**; EAS build; load tests; architecture + security + deployment docs |

**End of day:** live, deployed, monitored. **CP-5 → tag `v0.9.0`.**

### Day 6 — QA & demo prep
| Dev | Work |
|---|---|
| All | Run the full manual QA checklist together; fix every finding |
| 1 | Rehearse the parent/order demo segment |
| 2 | Rehearse the teacher/upload demo segment |
| 3 | Rehearse the admin demo segment |
| 4 | Record the video fallback; finalise docs; verify `git shortlog` shows four contributors |

**End of day:** submission-ready. **CP-6 → tag `v1.0.0`.**

---

## 19. Final Merge Plan

1. Freeze feature work at the end of day 5. Day 6 is fixes only.
2. Every branch merged into `develop`; no orphans.
3. CI green on `develop`.
4. Full manual QA on a build from `develop`.
5. `develop` → `main` via a reviewed PR.
6. Tag `v1.0.0`.
7. Verify from a clean clone: `pnpm install && pnpm typecheck && pnpm lint && pnpm build:backend && pnpm test` all succeed.
8. Confirm `git shortlog -sne` lists four contributors with meaningful counts.
9. Delete merged feature branches.

---

## 20. Final QA Responsibilities

| Area | Primary | Cross-checker |
|---|---|---|
| Auth & routing | Dev 4 | Dev 3 |
| Teacher upload flow | Dev 2 | Dev 1 |
| Parent feed | Dev 2 | Dev 4 |
| Order flow | Dev 1 | Dev 2 |
| Admin console | Dev 3 | Dev 1 |
| Notifications | Dev 3 | Dev 2 |
| Security checklist | Dev 4 | Dev 2 |
| Performance | Dev 4 | Dev 2 |
| Docs & diagrams | Dev 4 | All |
| Deployment | Dev 4 | Dev 3 |

**Every area is checked by someone who didn't build it.** This catches the "works on my machine and in my mental model" class of bug, and it means each of you has seen more of the system than your own slice — which is exactly what a viva examiner probes.

---

## 21. Individual Deliverables Summary

| Dev | Ships |
|---|---|
| **1** | A working end-to-end ordering feature — the project's most broken flow, fixed at all three layers. Shared product catalogue, atomic order creation, admin order visibility, 7 tests, orders API doc, order sequence diagram. |
| **2** | Private, authorised photo storage with signed URLs — closing the project's most severe security finding. Thumbnails cutting feed payload 50–100×, three IDORs closed, correct notification ordering, a rewritten feed query, removal of a dead queue subsystem, 13 tests, two diagrams. |
| **3** | A fully working notification feature across three roles (~700 lines of dead code brought to life), a correct admin dashboard, a consistent role model, a one-command demo dataset, schema integrity fixes, 6 tests, the ER diagram and database doc. |
| **4** | Role-based route protection, a shared toast system, observability (request IDs + Sentry), the full test harness and CI pipeline, a deployed backend, an installable mobile build, an accurate README, four diagrams, and the load-test report. |

Each of these is a distinct, defensible, individually explainable contribution — which is what an evaluator asks each of you about.

---

## 22. Risks to This Plan

| Risk | Likelihood | Mitigation |
|---|---|---|
| Dev 2's storage migration takes longer than a day | Medium | It's the critical path — start day 1 and check in at CP-2. Fallback: keep local disk but put it behind an authenticated route; this fixes the *security* half of G-02 even without the storage move. |
| Test harness slips past day 3 | Medium | Dev 4 should build it on day 2 if `<Toast>` and route guards finish early. It blocks three people. |
| Demo seed depends on both Dev 1 and Dev 2 | Medium | Dev 3 should write it against the *intended* contracts on day 2 and adjust on day 3, rather than waiting. |
| `pnpm-lock.yaml` conflicts | High | Announce dependency changes; resolve by re-running `pnpm install`, never by hand. |
| Someone finishes early and idles | Medium | Dev 1 is the likely case — reassign at the day-3 checkpoint (§6). |
| Scope creep into P3 items | High | The P3 list in the audit exists to be **documented, not built**. Future scope in the report is a strength, not a gap. |
