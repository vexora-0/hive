# Hive — Project Audit & Completion Plan

**Repository:** `hive` (pnpm + Turborepo monorepo)
**Audit date:** 3 May 2026
**Audit basis:** Full static read of every source file, migration, config and validator in the repository at the close of Phase 1.
The audit was performed by static reading first; dependencies were then installed and the monorepo compiled. The backend passes `typecheck` and `build`; **the mobile package fails `tsc --noEmit` with 22 errors** (see `plans/00-typecheck-fixes.md`). Every finding below is tagged:

- **[OBSERVED]** — confirmed by reading code; deterministic from the source.
- **[POTENTIAL]** — strongly indicated by code but needs a runtime check to be certain.
- **[RECOMMENDATION]** — an improvement, not an existing defect.

---

## 1. Executive Summary

Hive is a **preschool photo-sharing platform**: teachers upload classroom photos, tag which children appear in them, and each parent sees a private feed containing only photos their own child is tagged in. Parents can order prints. Admins manage schools, classes, students, teachers, and parent↔child links.

**The honest state of the project:** this is a well-architected, well-documented, visually polished codebase whose *seams are unfinished*. The individual layers are of genuinely good quality — the design system, the RLS policy set, the component library, the error/empty/skeleton states, and the service/controller separation are all above typical BSc standard. What is broken is almost entirely **integration between layers**: contracts that don't match, subsystems that were built but never wired up, and authorization that was designed but never enforced on the path actually used.

This is good news for your timeline. You are not rebuilding. You are **connecting things that already exist**, and most of the highest-value fixes are small.

**The five findings that matter most:**

1. **The ordering feature cannot work at all.** [OBSERVED] The mobile app, the backend validator, and the database CHECK constraint disagree three ways — on field naming, on product-type values, and on currency units. Every order request fails Zod validation with a 400 before it reaches the database. This is the flagship revenue feature and it has never worked.

2. **Every child's photo is a permanently public URL with no authentication.** [OBSERVED] `app.ts` serves the entire uploads directory via `express.static` with no auth middleware, and the Supabase storage bucket is also configured `public: true`. The product's single core promise — parents see only their own child — is not enforced on the file itself. The README's claim of "signed URLs and role-based access control" is not true of the running code.

3. **The notification feature is ~700 lines of finished, working, completely unreferenced code.** [OBSERVED] `NotificationCenter.tsx`, `NotificationCard.tsx`, `useNotifications.ts`, and `notificationService.ts` have **zero imports anywhere**, while all three notification screens render a "Coming Soon" `EmptyState`. The backend API for it is complete and working. This is the single cheapest large win available — roughly an hour of wiring converts a visibly unfinished feature into a working one.

4. **There is no role-based route protection anywhere in the mobile app.** [OBSERVED] No route group layout checks the user's role. A logged-in parent who deep-links to `/(admin)/dashboard` gets the admin UI. The backend does guard its own routes, so data is not fully exposed — but the UI is, which will be noticed in a demo.

5. **The entire repository is a single commit by a single author.** [OBSERVED] `git log` shows one commit, `1bfe1d9 upload`, by `Bhargav`. For a four-person graded project this is an evaluation risk independent of code quality, and it is the reason Document 2 matters as much as this one.

**Estimated effort to submission-ready:** roughly 5–7 working days for four people working in parallel, with the P0 list alone being about 2 days. The plan is sequenced in §23 and split in Document 2.

---

## 2. Existing Architecture

### 2.1 Actual stack (differs from the README)

| Layer | README claims | **Actual code** |
|---|---|---|
| Mobile | Flutter | **React Native 0.81 + Expo SDK 54 + Expo Router 6 (TypeScript)** |
| State | Provider / Riverpod | **Zustand 4 + TanStack Query 5** |
| Backend | Node + Express + TS | Node 20 + Express 4 + TypeScript ✅ |
| DB | PostgreSQL (Supabase) | PostgreSQL (Supabase) ✅ |
| Storage | Supabase Storage / S3 | **Local disk via multer** (S3 + Supabase code exists but is unused) |

**[OBSERVED]** `README.md:23-27` and the project-structure block at `README.md:31-51` describe a Flutter app with `lib/screens`, `lib/providers`, `lib/models`. No such directory exists. The real app is at `apps/mobile/src/` with `app/` (Expo Router file routes), `features/`, `components/`, `theme/`. **The README describes a different application than the one in the repository.** An evaluator reading the README first will be immediately confused.

### 2.2 Repository layout

```
hive/
├── apps/mobile/              @hive/mobile — Expo app
│   └── src/
│       ├── app/              Expo Router routes: (auth) (parent) (teacher) (admin)
│       ├── features/         auth, parent, teacher, admin, orders, notifications, onboarding
│       ├── components/       ui, forms, media, feedback, layout, navigation, animation
│       ├── theme/            colors, spacing, typography, shadows, constants
│       ├── lib/              api.ts, supabase.ts, queryClient.ts
│       ├── hooks/ stores/ utils/ types/
├── packages/backend/         @hive/backend — Express API
│   └── src/
│       ├── routes/ controllers/ services/ validators/ middleware/
│       ├── jobs/             BullMQ workers (dead — see §9.3)
│       ├── config/ utils/ scripts/
│       └── uploads/photos/   local file storage
└── supabase/
    ├── migrations/           00001–00016
    ├── combined_migrations.sql, seed.sql, config.toml
```

### 2.3 Request flow

Two parallel and inconsistent data paths coexist **[OBSERVED]**:

- **Path A — via the Express API.** Mobile → `lib/api.ts` (`apiRequest`) attaches the Supabase JWT as a Bearer token → Express `authenticate` middleware calls `supabaseAdmin.auth.getUser(token)`, then loads `profiles.role`/`school_id` → `roleGuard` → controller → service → `supabaseAdmin` (service-role key). Used by: feed, photos, orders, notifications, admin.
- **Path B — direct from the app to Supabase.** Mobile calls `supabase.from(...)` directly with the user's own JWT, so RLS applies. Used by: `useChildren`, `useClasses`, `teacherService.getClassStudents`, `authStore.initialize`.

**This split is the root cause of the security posture in §11.** Path A uses the **service-role key, which bypasses RLS entirely**. So the 505-line RLS policy set in `00011_create_rls_policies.sql` — which is genuinely good work and is the most security-critical file in the project — protects only Path B. Every endpoint on Path A must re-implement authorization by hand in the service layer, and in several places it doesn't.

### 2.4 Roles

Three roles exist in the DB: `teacher`, `parent`, `admin` (`profiles.role` CHECK, `00003:42`). A fourth, `school_admin`, is referenced throughout the backend but **cannot exist** — see finding G-09.

---

## 3. Existing Feature Inventory

Legend: ✅ Complete · ⚠️ Partial · ❌ Missing · 🐛 Broken · 🧪 Needs testing · 🔧 Needs improvement

### Authentication & onboarding

| Feature | Status | Evidence |
|---|---|---|
| Email OTP send/verify | ✅ | `authService.ts:22-57`, Supabase Auth |
| Admin email+password login | ✅ | `authService.signInWithPassword:64` |
| Profile auto-creation on signup | ✅ | trigger `handle_new_user`, `00014` |
| Role captured at signup (teacher/parent) | ✅ | `raw_user_meta_data->>'role'`, `00014:1058` |
| Onboarding carousel | ⚠️ | `OnboardingSlide.tsx:42` — "Lottie animation placeholder", renders an empty `View` |
| OTP resend cooldown + lockout | ⚠️🔧 | `useOTP.ts` — client-side component state only; resets on remount (§11 S-07) |
| Session persistence (SecureStore) | ✅ | `lib/supabase.ts:33-40` |
| **Role-based route protection** | ❌ | **No group layout checks role** (§11 S-03) |
| Password reset | ❌ | Not implemented (OTP-only for teacher/parent; admin has no reset path) |
| Email verification | ✅ | Implicit in OTP flow |

### Teacher

| Feature | Status | Evidence |
|---|---|---|
| Class selector | ✅ | `useClasses.ts` → direct Supabase, RLS-protected |
| Multi-image picker (max 20) | ✅ | `upload.tsx`, `MAX_UPLOAD_IMAGES` |
| Upload pipeline state machine | ✅ | `useUpload.ts:166-213` |
| Upload retry w/ backoff | ✅ | `retryWithBackoff`, 3 attempts |
| Student tagging UI | ✅ | `StudentTagger.tsx` (392 lines) |
| Upload progress bar | 🐛 | Progress is **hardcoded steps** (0.1→0.3→0.35→0.85→0.9→1), not real bytes-transferred — `useUpload.ts:172-203`. The bar is cosmetic. |
| Photo dedup by SHA-256 | ❌ | Client never computes it (`teacherService.requestUploadUrl` omits `sha256Hash`); `00016` dropped the NOT NULL to accommodate this. `utils/hash.ts` exists but is unreferenced. |
| Thumbnail generation | ❌ | Worker exists, never enqueued (§9.3). `thumbnail_s3_key` is always `null`. |
| Blurhash generation | ❌ | Same — `blurhash` column always `null`, so `HiveImage`'s blurhash placeholder never activates |
| Teacher dashboard photo grid | ✅ | `dashboard.tsx` + `useTeacherPhotos` |
| Notifications screen | 🐛 | "Coming Soon" placeholder (§3 note below) |

### Parent

| Feature | Status | Evidence |
|---|---|---|
| Child switcher | ✅ | `ChildSwitcher.tsx`, `useChildren.ts` |
| Photo feed (infinite scroll) | ✅ | `useFeed.ts`, `feed.service.getFeed` |
| Masonry grid + Polaroid cards | ✅ | `MasonryGrid`, `PolaroidCard` |
| Pull-to-refresh | ✅ | `feed.tsx:171-172` |
| Skeleton loading | ✅ | `FeedSkeleton.tsx` |
| Empty state | ✅ | `feed.tsx:174-179` |
| Offline banner | ✅ | `OfflineBanner`, `useNetworkStatus` |
| Photo detail screen | ⚠️ | Works, but **no authorization** on the endpoint (§11 S-02) |
| Long-press action sheet | ✅ | `PhotoActionSheet.tsx` |
| Download photo | ❌ | `usePhotoActions.ts:61-66` — logs "not yet implemented"; UI shows a "Coming Soon" badge |
| **Place an order** | 🐛 | **Broken end-to-end** (§5.1 / G-01) |
| Order history | ⚠️ | UI complete; can never show real data because orders can't be created |
| Notifications screen | 🐛 | "Coming Soon" placeholder |

### Admin

| Feature | Status | Evidence |
|---|---|---|
| Dashboard stat cards | 🐛 | `admin.service.ts:63` selects `orders.total` — **column does not exist** (it's `total_amount`). Orders/revenue always render 0. |
| User list + search + filter | ✅🔧 | Works; search has a filter-injection flaw (§11 S-05) |
| Change user role | 🐛 | Offers `school_admin`, which violates the `profiles.role` CHECK → DB error (G-09) |
| Assign user to school | ✅ | `assignUserToSchool` |
| School list + create | ✅ | `AddSchoolSheet`, `createSchool` |
| School `email` field | 🐛 | Validator accepts it; `schools` table has no `email` column; value silently dropped (`admin.service.ts:282-288`) |
| Class create | ✅ | `schools.routes.ts:70` |
| Class detail (students + teacher) | ✅ | `getClassDetail` |
| Assign/unassign teacher | ✅ | `assignTeacher` |
| Add/remove student | ✅ | `createStudent`, `removeStudentFromClass` |
| Map parent↔student by email | ✅ | `mapParentToStudent` |
| Notifications screen | 🐛 | "Coming Soon" placeholder |
| Order management / fulfilment | ❌ | No admin order endpoints at all, though RLS policies for it exist (`00011:677-687`) |

### Cross-cutting

| Feature | Status | Evidence |
|---|---|---|
| Design system | ✅ | `theme/` — colors, spacing, typography, shadows, constants |
| Component library | ✅ | 30+ components across 7 folders |
| Error boundary | ✅ | `ErrorBoundary.tsx` |
| Global error handler | ✅ | `errorHandler.ts` |
| Structured logging | ✅ | Winston, JSON in prod |
| Rate limiting | ⚠️ | Global limiter active; `authRateLimiter` **exported but never used** |
| Idempotency | ✅ | `idempotency.ts` — genuinely well done (Redis lock + cached response) |
| Cursor pagination | ✅🔧 | Consistent across 5 endpoints; two correctness bugs (G-14, G-15) |
| **In-app notifications** | 🐛 | **Backend + components complete, screens are placeholders** (G-03) |
| Background jobs | ❌ | Both BullMQ workers are dead code (§9.3) |
| Push notifications | ❌ | README claims them; no `expo-notifications` dependency exists |
| Tests | ❌ | **Zero.** No test runner in any `package.json`. |
| CI/CD | ❌ | No `.github/` directory |
| Docker | ❌ | No Dockerfile or compose file |

---

## 4. Missing Features

Promised in the README or implied by the schema, but absent:

| # | Feature | Where promised | Reality |
|---|---|---|---|
| M-1 | Push notifications | `README.md:16` | No `expo-notifications`; only in-app notifications exist, and those are unwired |
| M-2 | Signed URLs | `README.md:17` | `signedUrl.ts` exists and is **never imported**; URLs are plain public paths |
| M-3 | CDN layer | `README.md:86` | No CDN configured anywhere |
| M-4 | Photo captions | `photos.caption` column | Column exists, never written, never read (feed maps `caption: null` at `parentService.ts:92`) |
| M-5 | Photo delete / archive | `status='archived'` in CHECK | No endpoint, no UI |
| M-6 | Untag a student | RLS policy `pst_teacher_delete` exists | No endpoint, no UI |
| M-7 | Admin order fulfilment | RLS `orders_admin_update` exists | No endpoint, no UI |
| M-8 | Parent cancel order | RLS `orders_parent_delete` exists | No endpoint, no UI |
| M-9 | Edit school | `updateSchoolSchema` defined | Validator exists; **no route uses it** |
| M-10 | Profile editing (name/avatar) | `profiles_self_update` RLS | No UI; profile screen is read-only |
| M-11 | Password reset | — | No flow for the admin password account |
| M-12 | Student avatars | `students.avatar_url` | Column exists, never populated by any code path |
| M-13 | School logos | `schools.logo_url` | Validator accepts `logoUrl`; no upload UI |

**Note on M-4/M-12/M-13:** these are the "database fields that are never used" the brief asks about. `photos.caption`, `students.avatar_url`, `schools.logo_url` are all written into the schema and read by TypeScript interfaces but never populated by any code path.

---

## 5. Broken / Incorrect Implementations

### 5.1 The order flow — a three-way contract mismatch [OBSERVED] 🐛 P0

This is the most severe functional defect in the project. Three layers disagree:

**Layer 1 — Mobile sends** (`orderService.ts:53-57`):
```ts
{ items: [{ photo_id, product_type: 'print_4x6', quantity, unit_price: 4.99 }],
  shipping_address, notes }
```

**Layer 2 — Backend expects** (`order.validator.ts:16-42`):
```ts
{ items: [{ photoId, productType: '4x6', quantity }],
  shippingAddress /* REQUIRED */, notes }
```

**Layer 3 — Database allows** (`00009:252-260`):
```sql
CHECK (product_type IN ('print_4x6','print_5x7','print_8x10',
                        'digital_download','photo_book','magnet','mug'))
```

Three independent failures, each sufficient to break the feature on its own:

1. **Field naming.** Mobile sends `snake_case`; the Zod schema requires `camelCase`. `items.0.photoId` is missing and `shippingAddress` is missing → **the request fails validation with 400 before touching the database.** No order has ever been created through this app.
2. **Product-type vocabulary.** Even after fixing naming, the backend enum (`'4x6'`, `'digital'`, plus `'11x14'`, `'16x20'`, `'canvas'`) and the DB CHECK (`'print_4x6'`, `'digital_download'`, no large sizes, no canvas) overlap on only three values: `photo_book`, `magnet`, `mug`. Ordering a 4x6 print — the primary product — would violate the CHECK constraint.
3. **Currency units.** `order.service.ts:9-20` prices in **cents** (`'4x6': 299`) and writes `total_amount: subtotal` into a `decimal(10,2)` column documented as "Total order amount in USD" (`00009:243`). Mobile prices in **dollars** (`cartStore.ts:9-17`, `print_4x6: 4.99`) and renders `$${price.toFixed(2)}`. A $4.99 print would be stored as `299.00` and displayed as **$299.00**.

**Fix:** pick one vocabulary (recommend the DB's `print_4x6` set, since changing a CHECK constraint on a table with data is the riskier edit), one casing (camelCase in the API, matching every other endpoint), and one unit (cents in the DB with an explicit `total_cents` rename, or dollars throughout — cents is safer for money). Then define the product catalogue **once** in a shared module and import it in all three places. Effort: **M**.

### 5.2 Tagging happens *after* the photo goes live, killing parent notifications [OBSERVED] 🐛 P0

The DB trigger `notify_parents_on_photo` (`00012:871-926`) fires when `photos.status` transitions to `'ready'`, then loops over `photo_student_tags` to notify each tagged child's parents.

But the client's pipeline (`useUpload.ts:186-200`) is:

```
uploadPhotoFile(...)   → backend sets status = 'ready'   ← trigger fires HERE
   ↓
tagStudents(...)       → tags inserted AFTER
```

**At the moment the trigger runs, the photo has zero tags.** The loop body never executes. **Parents are never notified about new photos** — the headline notification type (`'new_photos'`) can never be produced.

The sibling trigger `notify_teacher_on_upload_complete` does fire correctly, so teachers get "Photo processed successfully". This asymmetry is a good clue during testing.

**Fix (recommended):** tag first, then flip to `'ready'`. Change the pipeline to upload the file into a `'processing'` state, apply tags, then call a confirm endpoint that sets `'ready'`. `confirmUpload` already exists in both `photo.service.ts:156` and `teacherService.ts:80` — the latter is currently dead code and this is exactly what it was written for. Effort: **S**.

### 5.3 Admin dashboard statistics query a non-existent column [OBSERVED] 🐛 P0

`admin.service.ts:61-71`:
```ts
supabaseAdmin.from('orders').select('id, total')   // ← `total` does not exist
...
totalOrders  = ordersResult.data?.length ?? 0      // → 0
totalRevenue = ordersResult.data?.reduce(...) ?? 0 // → 0
```

The column is `total_amount` (`00009:228`). PostgREST returns an error, `data` is `null`, and both stats silently fall back to `0`. The error is never checked. **The admin dashboard always shows 0 orders and $0 revenue** regardless of the data. This is exactly the kind of thing an evaluator clicks first. Effort: **XS**.

### 5.4 Both background workers are dead code [OBSERVED] 🐛 P1

**[OBSERVED]** A repo-wide grep for `.add(` finds exactly one hit, and it is `Set.add` in `photo.service.ts:408`. **Neither `imageProcessingQueue` nor `notificationQueue` is ever enqueued.** `index.ts` starts both workers on boot; they connect to Redis and idle forever.

Three consequences:
- No thumbnails are ever generated → the feed serves **full-resolution originals** (up to 25 MB each) to a mobile grid. This is the single biggest performance problem in the app (§12.1).
- No blurhash → `HiveImage`'s progressive-loading placeholder never activates, despite being fully implemented.
- No image dimensions → `width`/`height` stay `null`, so `MasonryGrid` cannot size cells from real aspect ratios.

Worse, **the worker could not succeed even if it were enqueued** — two independent bugs:
- `imageProcessor.job.ts:33-52` downloads from **S3** (`GetObjectCommand`), but files are written to the **local filesystem** by `photo.service.saveUploadedFile:140` (`fs.renameSync`). It would throw `NoSuchKey` on every job.
- `imageProcessor.job.ts:125` updates a `content_type` column. The `photos` table has `mime_type` (`00007:153`). That update would error.

Similarly `notificationSender.job.ts:44` inserts `read: false`, but the column is `is_read` (`00010:290`) — that insert would fail too.

**[RECOMMENDATION]** Given your timeline, do **not** revive BullMQ. Redis + a queue + a worker is real operational complexity for a demo. Generate the thumbnail **synchronously with `sharp` inside the upload request** — it takes ~100–300 ms for a phone photo, which is imperceptible next to the upload itself. Delete or clearly document the queue code. This removes a Redis dependency from your deployment and eliminates an entire class of "why is nothing processing" demo failures. Effort: **M**.

### 5.5 `confirmUpload` can never succeed after `uploadFile` [OBSERVED] 🐛 P2

`saveUploadedFile` sets `status='ready'` (`photo.service.ts:145`). `confirmUpload` then requires `status==='processing'` and throws `INVALID_STATE` otherwise (`photo.service.ts:168-174`). Any client calling upload-then-confirm gets a 400 on the second call. Currently harmless because `teacherService.confirmUpload` is never invoked — but this is precisely the function you need in §5.2's fix, so it must be corrected as part of that change.

### 5.6 `getParentFeed` is a dead duplicate of `getFeed` [OBSERVED] 🔧 P2

`photo.service.ts:340-449` (110 lines) implements the parent feed. So does `feed.service.ts:27-152`. Only the latter is routed. The dead copy also contains a **pagination correctness bug** worth understanding before you copy patterns from it: it deduplicates photos *after* fetching `limit + 1` rows, then computes `hasNext = uniquePhotos.length > limit` (`:413`). When a photo is tagged with two of the parent's children, dedup shrinks the set below `limit` and `hasNext` goes false — **truncating the feed early**. Delete the dead function. Effort: **XS**.

### 5.7 `markAsRead` never returns 404 [OBSERVED] 🐛 P2

`notification.service.ts:81-102` destructures `count` from a Supabase `update()` call made **without** `{ count: 'exact' }`. `count` is therefore always `null`, so `if (count === 0)` never fires. Marking a nonexistent or someone else's notification returns `200 OK`. Not a data leak — the `.eq('user_id', userId)` filter still prevents cross-user writes — but the error contract is wrong and it will mask bugs. Effort: **XS**.

### 5.8 Validators written but never wired [OBSERVED] 🔧 P1

| Schema | Defined | Used? |
|---|---|---|
| `tagStudentsSchema` | `photo.validator.ts:29` | ❌ `POST /photos/:id/tag` has **no validation** |
| `getOrdersSchema` | `order.validator.ts:44` | ❌ `GET /orders` parses limit by hand |
| `updateSchoolSchema` | `admin.validator.ts:19` | ❌ no update-school route exists |

The tagging one matters: `photo.controller.tagStudents:68` reads `req.body.studentIds` with **no validation at all** and passes it to `.in('id', studentIds)`. A non-array or a huge array goes straight to PostgREST. Effort to wire all three: **XS**.

---

## 6. UI/UX Audit

**This is the strongest part of the project and needs the least work.** Let me be specific about why, because the brief asks for polish and the honest answer is that the foundation is already there — what's missing is *consistency of wiring*, not visual design.

### 6.1 What already exists and is good

- **A real design system.** `theme/` exports `colors` (a coherent warm amber/blue/mint/lavender palette with full semantic status ramps), `spacing`, `grid`, `layout`, `typography` (Baloo 2 for display + Nunito for body, with a 12-variant `textStyles` scale), `shadows` (with a `platformShadow` helper for the iOS/Android split), and `constants` for magic numbers. Composed into a single `theme` object. This is better than most student projects and better than plenty of production apps.
- **A genuine component library.** `ui/` (Text, Button, Card, Avatar, Badge, TextInput), `feedback/` (SkeletonShimmer, EmptyState, ErrorBoundary, OfflineBanner), `layout/` (SafeArea, ScreenContainer, KeyboardAvoid), `media/` (HiveImage, PolaroidCard, MasonryGrid, PhotoViewer), `forms/` (OTPInput, ClassSelector, StudentTagger, ChildSwitcher), `animation/` (Confetti, HoneycombFAB, AnimatedCounter, Lottie wrapper). Each has JSDoc.
- **States are handled.** Loading skeletons, empty states, error boundaries, and offline banners are implemented and used. `feed.tsx` alone wires skeleton + empty + offline + pull-to-refresh + infinite scroll correctly.
- **Accessibility groundwork.** `MIN_TAP_SIZE = 44`, `accessibilityRole`, `accessibilityLabel`, and `accessibilityState` appear throughout (e.g. `ProductPicker.tsx:76-78`, every `Tabs.Screen`).

### 6.2 What actually needs fixing

| # | Issue | Evidence | Severity |
|---|---|---|---|
| U-1 | **Three screens say "Coming Soon"** while a complete notification UI sits unimported | `(parent|teacher|admin)/notifications.tsx` | **P0** — most visible unfinished thing in the app |
| U-2 | **Onboarding animation is an empty box** | `OnboardingSlide.tsx:42-44` "replace source with a real .json asset"; `assets/lottie/bee.json` exists but is not used here | P1 — it's the literal first screen |
| U-3 | **404 screen has a placeholder bee** | `+not-found.tsx:35-37` | P2 |
| U-4 | Upload progress bar is cosmetic | `useUpload.ts` stepwise constants | P1 |
| U-5 | Feed never shows who took the photo | `parentService.ts:96` hardcodes `uploadedBy: { name: '' }` | P2 |
| U-6 | No dark mode | `app.json` pins `"userInterfaceStyle": "light"`; palette has `navyDark`/`navyMedium` suggesting it was planned | P3 — **do not attempt before submission** |
| U-7 | Order detail shows a grey box instead of the photo | `OrderDetailSheet.tsx:189` `itemImagePlaceholder` | P2 |
| U-8 | `supportsTablet: false`; no tablet/landscape layouts | `app.json:13` | P3 — deliberate and defensible for a phone-first app |
| U-9 | No confirmation dialogs for destructive actions | Remove-student, remove-parent-mapping fire immediately | P1 |
| U-10 | Two `TabBar` import styles | `(admin)/_layout.tsx:6` imports from `.../TabBar` while `(parent)`/`(teacher)` use the barrel `.../navigation` | P3 cosmetic |

**[RECOMMENDATION]** Do not redesign anything. The brief explicitly warns against redesigning for appearance, and here that warning is correct — the visual language is already coherent and appropriate for the domain. Spend the UI budget on U-1, U-2, U-4, and U-9, which convert *visibly unfinished* into *finished*. That is what an evaluator responds to.

---

## 7. Product Flow Audit

### 7.1 Current journeys

**Parent:** Onboarding (3 slides, empty animations) → Login (email) → OTP → Feed. Then: switch child, scroll, tap → detail, long-press → action sheet → "Add to cart" navigates to the Orders tab with a `photoId` param → order sheet → **submit fails silently with a 400**.

Dead ends: notifications tab (Coming Soon), download (logs and does nothing), order submission (broken).

**Teacher:** Login → OTP → Dashboard (class selector + photo grid) → FAB → Upload → pick images → select class → tag students → upload → confetti. **This flow works and is the best demo path in the app.**

Dead ends: notifications tab.

**Admin:** Password login → Dashboard (**orders/revenue always 0**) → Users / Schools → class detail → manage students, teachers, parent mappings. Mostly works.

Dead ends: notifications tab; no way to see or fulfil orders.

### 7.2 Gaps

| # | Gap | Impact |
|---|---|---|
| F-1 | A brand-new parent with no linked children sees "No photos yet" with **no explanation and no action** | They cannot self-serve; an admin must map them. Needs a distinct empty state: "No children linked to your account yet — ask your school to add you." |
| F-2 | A brand-new teacher with no `school_id` sees an empty class dropdown and no error | `useClasses` is `enabled: !!schoolId`; with no school the query never runs and the UI just sits empty |
| F-3 | Order failure is invisible | The mutation has no `onError` toast |
| F-4 | No toast/snackbar system anywhere in the app | Success and failure are both silent outside the upload flow's confetti |
| F-5 | No confirmation on destructive admin actions | See U-9 |
| F-6 | Admin cannot create a teacher or parent account | They must sign up themselves first — `mapParentToStudent` even returns "The parent must sign up first" (`admin.service.ts:516`). This is a real onboarding cliff for a demo. |

### 7.3 Prioritised recommendations

**Must have for submission**
1. Fix the order flow end-to-end (§5.1).
2. Wire the three notification screens (§5.4 note / G-03).
3. Add a toast system and use it for order success/failure and admin mutations.
4. Role-guarded routing (§11 S-03).
5. Empty states for "no children linked" (F-1) and "no school assigned" (F-2).

**Should have**
6. Confirmation dialogs on destructive actions.
7. Real upload progress.
8. Admin order list (read-only is enough to close the loop).
9. Real onboarding animations.

**Nice to have / future scope**
10. Photo download, captions, untagging, dark mode, push notifications, tablet layouts.

---

## 8. Image / File Handling Audit

This is the area the brief flags specifically, and it is indeed one of the weakest parts of the codebase.

### 8.1 Three storage mechanisms coexist; only one is used [OBSERVED]

| Mechanism | Code | Status |
|---|---|---|
| **Local disk (multer)** | `middleware/upload.ts`, `photo.service.saveUploadedFile` | ✅ **The only one actually used** |
| AWS S3 presigned | `config/s3.ts`, `utils/signedUrl.ts` | ❌ Never imported by any route |
| Supabase Storage | `utils/supabaseStorage.ts`, bucket in `00015` | ❌ Never imported; bucket created but unused |

`photo.service.requestUpload` compounds the confusion: its comments say "Supabase Storage" (`:80`, `:107`), it returns `uploadUrl: ''` (`:109`), and the file is then written to local disk by a different function. The column is named `s3_key` but holds a local relative path. **Three abandoned strategies is itself a finding** — it will read as indecision to an evaluator, and it doubles the surface area for bugs.

### 8.2 Findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| I-1 | **`/uploads` is served with no authentication whatsoever** | `app.ts:60` `app.use('/uploads', express.static(...))` — mounted *before* any auth, and no route-level guard | **Critical** |
| I-2 | Photo URLs are permanent, unsigned, and guessable-by-structure | `${origin}/uploads/photos/{schoolId}/{classId}/{photoId}.jpg` | **Critical** |
| I-3 | The Supabase bucket is `public: true` with an explicit `TO public` SELECT policy | `00015:1104`, `:1129-1133` | **Critical** (if that path is ever activated) |
| I-4 | Local disk is ephemeral | `fs.renameSync` to `packages/backend/uploads/` — wiped on every deploy on Render/Railway/Heroku/Fly | **High** |
| I-5 | Local disk breaks horizontal scaling | Instance A's files are invisible to instance B | **High** |
| I-6 | No ownership check on `POST /photos/:id/file` | `photo.controller.uploadFile:29-36` and `photo.service.saveUploadedFile` never compare the photo's `school_id`/`uploaded_by` to `req.user` | **High** |
| I-7 | No file deletion anywhere | No endpoint; replaced/failed photos leave orphans forever | Medium |
| I-8 | MIME type is trusted from the client | `upload.ts:26` checks `file.mimetype`, which is client-supplied. Magic bytes are never verified. | Medium |
| I-9 | Dedup is dead | Client omits `sha256Hash`; `00016` dropped NOT NULL; `idx_photos_dedup` is unused | Medium |
| I-10 | Size limit is enforced in two places with no shared constant | multer 25 MB, Zod 25 MB, `MAX_FILE_SIZE_MB` 25 — three independent literals | Low |
| I-11 | Orphaned temp files on failure | `upload.ts` writes `tmp_*` to disk; only some error paths `unlinkSync` | Low |
| I-12 | HEIC is accepted but never converted | Only the dead worker handles HEIC→JPEG; Android cannot render HEIC | Medium |

### 8.3 Storage recommendation

You asked which provider to use. **Use Supabase Storage.** The reasoning is specific to this repo, not generic:

- **You already have it.** The `photos` bucket exists (`00015`), `utils/supabaseStorage.ts` is written, the client SDK is installed in both apps, and you already authenticate against Supabase. Zero new accounts, zero new secrets, zero new billing.
- **It solves I-4 and I-5 for free.** Object storage is not ephemeral and is not instance-local.
- **It solves I-1/I-2/I-3 properly** — flip the bucket to **private** and serve `createSignedUrl(path, 3600)`. That makes the README's "signed URLs" claim true, and it is a *strong* talking point in a viva: "photos are private objects; the API issues short-lived signed URLs only after verifying the requesting parent is linked to a tagged child."
- **S3 would mean** a new AWS account, IAM policy, and credentials for a feature you already have. Cloudinary/Firebase mean a fourth vendor. Neither buys you anything here.

**Migration path (≈ half a day):**
1. Flip `00015` bucket to `public = false`; drop the `TO public` read policy.
2. In `saveUploadedFile`, replace `fs.renameSync` with `supabaseAdmin.storage.from('photos').upload(key, buffer)`.
3. Generate the thumbnail with `sharp` in the same request and upload it as `{key}_thumb.jpg` (this also closes §5.4).
4. Replace the URL builders in `feed.service.ts:128`, `:177` and `photo.service.ts:321`, `:418` with `createSignedUrl`.
5. Delete `app.use('/uploads', ...)`, `config/s3.ts`, `utils/signedUrl.ts`, and the `@aws-sdk/*` dependencies.

Keep `sharp`. Drop `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, and (if you take the §5.4 recommendation) `bullmq` + `ioredis`.

---

## 9. Backend / API Audit

### 9.1 Endpoint inventory

| Method | Path | Auth | Role | Validated | Notes |
|---|---|---|---|---|---|
| GET | `/health` | — | — | — | ✅ |
| POST | `/api/v1/photos/upload-url` | ✅ | teacher, school_admin† | ✅ | Returns empty `uploadUrl` |
| POST | `/api/v1/photos/:id/file` | ✅ | teacher, school_admin† | ❌ | **No ownership check (I-6)** |
| POST | `/api/v1/photos/:id/confirm` | ✅ | teacher, school_admin† | ❌ | Unreachable state (§5.5) |
| POST | `/api/v1/photos/:id/tag` | ✅ | teacher, school_admin† | ❌ | **Schema exists, unused (§5.8)** |
| GET | `/api/v1/photos` | ✅ | teacher, school_admin† | ✅ | **No school scoping (S-04)** |
| GET | `/api/v1/feed` | ✅ | parent | partial | Manual limit clamp |
| GET | `/api/v1/feed/photos/:id` | ✅ | parent | ❌ | **No ownership check (S-02)** |
| POST | `/api/v1/orders` | ✅ | parent | ✅ | **Contract mismatch (§5.1)** |
| GET | `/api/v1/orders` | ✅ | parent | partial | ✅ scoped by `parent_id` |
| GET | `/api/v1/orders/:id` | ✅ | parent | ❌ | ✅ scoped by `parent_id` |
| GET | `/api/v1/notifications` | ✅ | any | partial | ✅ scoped |
| GET | `/api/v1/notifications/unread-count` | ✅ | any | — | ✅ |
| PATCH | `/api/v1/notifications/:id/read` | ✅ | any | ❌ | Wrong 404 semantics (§5.7) |
| GET/POST/PATCH/DELETE | `/api/v1/admin/*` (14 routes) | ✅ | admin | mostly ✅ | See §5.3, G-09 |
| GET | `/api/v1/schools/:id/classes` | ✅ | teacher, **admin** | — | **IDOR (S-04)** |
| GET | `/api/v1/schools/:id/students` | ✅ | teacher, **admin** | — | **IDOR (S-04)** |
| POST | `/api/v1/schools/:id/classes` | ✅ | admin | ✅ | |

† `school_admin` is not a valid role — see G-09.

### 9.2 Architectural observations

- **Layering is clean and consistent** — routes → controllers → services → Supabase, with `AppError` for operational errors and a well-structured global handler. This is genuinely good and worth pointing out in your report.
- **`schools.routes.ts` breaks the pattern** [OBSERVED] — it defines a Zod schema inline (`:12`) and puts three handlers with direct `supabaseAdmin` calls in the routes file. Every other domain uses controller + service + validator files. Refactor for consistency (**S**).
- **Role-guard vocabulary is inconsistent** [OBSERVED]: photos use `roleGuard('teacher', 'school_admin')`; schools use `roleGuard('teacher', 'admin')`; admin uses `roleGuard('admin')`. Net effect: **a real `admin` cannot upload a photo**, and the nonexistent `school_admin` is granted photo access. Standardise on `teacher` and `admin` (**XS**).
- **Response envelopes are inconsistent** [OBSERVED]: success is `{success, data}`, paginated is `{success, data, cursor}` — fine. But `photo.controller.getPhotos:87-91` and `order.controller.createOrder:18-23` hand-roll `res.status(...).json({success:false,...})` instead of throwing `AppError`. Two error-emission paths. Standardise on `AppError` (**S**).
- **`trust proxy` is set to `true`** (`app.ts:20`) — trusts *every* hop. Combined with an IP-keyed rate limiter this lets a client spoof `X-Forwarded-For` to bypass limits (S-08).
- **No OpenAPI/Swagger spec** — worth adding for the report (§19).

### 9.3 Background jobs

Covered in §5.4. Summary: both workers are unreachable dead code containing three additional bugs (wrong storage backend, `content_type` vs `mime_type`, `read` vs `is_read`). **Recommendation: delete them and do thumbnailing synchronously.**

---

## 10. Database Audit

### 10.1 What's good

The schema is the second-strongest part of the project. Ten tables, sensible normalisation, `parent_student_mappings` as a proper M:N join with a `UNIQUE (parent_id, student_id)` constraint, `photo_student_tags` as the privacy pivot with `UNIQUE (photo_id, student_id)`, `updated_at` triggers on all six mutable tables, and **well-chosen indexes** — including composite covering indexes that match the actual query patterns (`idx_photos_class_feed` mirrors the feed's `ORDER BY created_at DESC, id DESC` exactly, and `idx_pst_student_id ... INCLUDE (photo_id)` is a thoughtful index-only-scan optimisation). Every table and most columns carry `COMMENT ON`. This is strong work.

### 10.2 Findings

| # | Finding | Evidence | Severity |
|---|---|---|---|
| D-1 | **`NOT NULL` + `ON DELETE SET NULL` are contradictory** | `photos.uploaded_by` (`00007:149`), `photo_student_tags.tagged_by` (`00008:192`), `order_items.photo_id` (`00009:250`) | **High** — deleting a profile or photo raises a not-null violation instead of cascading. Data deletion is impossible today. |
| D-2 | **`product_type` CHECK disagrees with the API enum** | `00009:252` vs `order.validator.ts:3-14` | **Critical** (§5.1) |
| D-3 | **`profiles.role` CHECK excludes `school_admin`** | `00003:42` vs 6 backend references | **High** (G-09) |
| D-4 | `schools` has no `email` column | `00002` vs `createSchoolSchema:20` | Medium |
| D-5 | `photos.sha256_hash` made nullable, defeating dedup | `00016` | Medium |
| D-6 | Migrations are not idempotent | `CREATE POLICY` without `DROP`/`IF NOT EXISTS` in `00011` and `00015` | Medium — re-running fails |
| D-7 | No transaction around order + order_items | `order.service.ts:117-157` uses a manual compensating delete | Medium — a crash between the two inserts leaves an order with no items |
| D-8 | `orders.shipping_address` is nullable in DB but required by Zod | `00009:229` vs `order.validator.ts:36` | Low |
| D-9 | No soft-delete except `photos.status='archived'` (unused) and `is_active` flags | — | Low |
| D-10 | No `deleted_at` / audit columns | — | Low |
| D-11 | **`seed.sql` cannot run** | Inserts `profiles` rows whose `id` must reference `auth.users`, which don't exist. The file's own header admits this (`seed.sql:5-8`). | **High** — there is no working demo-data path |
| D-12 | Hardcoded admin credentials committed | `scripts/seedAdmin.ts:24-25` `admin@hive.app` / `Admin@123`, echoed to stdout at `:95` | **High** |

### 10.3 RLS

`00011` is 505 lines of careful, well-commented policy covering all ten tables with four `SECURITY DEFINER` helper functions (`get_my_role`, `get_my_school_id`, `is_parent_of`, `get_my_student_ids`). The parent-photo policy correctly requires an `EXISTS` join through `photo_student_tags` → `parent_student_mappings`.

**[OBSERVED] But it is bypassed on the primary data path.** Every backend service uses `supabaseAdmin`, created with `SUPABASE_SERVICE_KEY` (`config/supabase.ts:5-7`), which is exempt from RLS by design. RLS therefore only protects the handful of direct-from-app queries (`useChildren`, `useClasses`, `getClassStudents`, `authStore.initialize`).

**[RECOMMENDATION]** Keep RLS — it is defence in depth, it protects Path B, and it is excellent viva material. But **do not rely on it for the API**, and be precise about this in your report. The correct framing is: "RLS is the last line of defence and secures direct client access; the API enforces the same rules explicitly in the service layer because it holds a service-role key." Then make that second half *true* by fixing S-02 and S-04.

---

## 11. Security Audit

### CRITICAL

**S-01 — Unauthenticated public access to every child's photo**
- **Problem:** `app.ts:60` mounts `express.static` on `/uploads` with no authentication. Separately, the Supabase bucket is `public: true` (`00015:1104`) with a `TO public` SELECT policy (`:1129`).
- **Risk:** Anyone who obtains or constructs a URL — from a shared screenshot, a browser history, a proxy log, or the network tab — can view any child's photograph without any credential. There is no rate limit on static files and no logging. For a platform whose entire value proposition is child-photo privacy, and given that children are involved, this is as serious as an application finding gets.
- **Affected:** `packages/backend/src/app.ts:60`; `supabase/migrations/00015_storage_photos_bucket.sql:1101-1133`; URL construction at `feed.service.ts:128,177` and `photo.service.ts:321,418`.
- **Fix:** Make the bucket private. Serve photos only through an authenticated endpoint that verifies the caller is a parent of a tagged child (or a teacher at the photo's school), then returns a short-lived signed URL. Remove the static mount entirely.
- **Priority:** P0. Effort: **M**.

**S-02 — IDOR: any parent can read any photo's metadata**
- **Problem:** `GET /api/v1/feed/photos/:id` → `feed.controller.getPhotoDetails:42-44` → `feed.service.getPhotoDetails(id, baseUrl)`. **The service signature does not accept a user ID** (`feed.service.ts:154-157`) and performs no ownership check — it filters only on `status='ready'`.
- **Risk:** Any authenticated parent, iterating or guessing photo UUIDs, retrieves any photo in the system: its URL, filename, class name, school name, and the list of tagged student IDs. This directly defeats the privacy model. It also leaks a *cross-school* child roster via `taggedStudentIds`.
- **Affected:** `packages/backend/src/services/feed.service.ts:154-204`; `controllers/feed.controller.ts:36-49`.
- **Fix:** Pass `req.user.id` into the service; add an `EXISTS` check against `photo_student_tags` ⋈ `parent_student_mappings` for that parent; return 404 (not 403) on failure to avoid confirming the photo exists.
- **Priority:** P0. Effort: **S**.

**S-03 — No role-based route protection in the mobile app**
- **Problem:** No route group layout performs an auth or role check. `(parent)/_layout.tsx`, `(teacher)/_layout.tsx`, and `(admin)/_layout.tsx` are pure `<Tabs>` definitions. `app/_layout.tsx:43-44` reads `isAuthenticated` and `role` into variables and **never uses them**. Only `app/index.tsx` redirects, and it is bypassed by any direct navigation.
- **Risk:** A parent deep-linking `hive://(admin)/dashboard` (the `hive` scheme is registered at `app.json:8`) renders the full admin UI. Backend `roleGuard` means the API calls 403, so data is not disclosed — but the app appears broken/insecure, and any screen that reads from Supabase directly rather than the API would leak whatever RLS permits.
- **Affected:** `apps/mobile/src/app/_layout.tsx:43-44`; all three group layouts.
- **Fix:** Add a shared `<RoleGate allow={['parent']}>` wrapper (or a `useRequireRole` hook) in each group layout that redirects to `/(auth)/login` when unauthenticated and to the correct role route on mismatch.
- **Priority:** P0. Effort: **S**.

### HIGH

**S-04 — IDOR: cross-school data access for teachers**
- **Problem:** Three endpoints take a resource ID from the URL and never verify it belongs to the caller's school:
  - `GET /schools/:id/classes` (`schools.routes.ts:19-38`) — no check that `req.params.id === req.user.schoolId`
  - `GET /schools/:id/students` (`:41-66`) — same; returns every child's full name and DOB
  - `GET /photos?classId=` (`photo.service.getPhotosByClass:282-338`) — filters only on `class_id`
- **Risk:** Any authenticated teacher can enumerate another school's classes, its complete student roster **including dates of birth**, and all of its photos. This is a cross-tenant breach of children's PII.
- **Fix:** Compare against `req.user.schoolId` in each; for `getPhotosByClass`, join `classes` and verify `school_id`.
- **Priority:** P0. Effort: **S**.

**S-05 — PostgREST filter injection in admin search**
- **Problem:** `admin.service.getUsers:94-98` interpolates the raw user-supplied `search` string into a PostgREST `.or()` filter:
  ```ts
  query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
  ```
  The `or()` argument is a comma-separated filter DSL. A search containing `,` or `)` — e.g. `x,role.eq.admin` — escapes the intended expression and injects a new filter clause.
- **Risk:** Not classical SQL injection (PostgREST parameterises the final SQL), but an attacker-controlled *filter tree*. At minimum it distorts results; combined with other filters it can be used to enumerate rows the query was meant to exclude. Reachable only by an authenticated admin, which caps severity.
- **Fix:** Reject or escape `,`, `(`, `)`, `.` in `search` (the Zod schema already caps length at 100 — add a character allow-list), or run two separate `.ilike()` queries and merge.
- **Priority:** P1. Effort: **XS**.

**S-06 — Hardcoded admin credentials in a committed file**
- **Problem:** `scripts/seedAdmin.ts:24-25` — `ADMIN_EMAIL = 'admin@hive.app'`, `ADMIN_PASSWORD = 'Admin@123'`, printed to stdout at `:95`.
- **Risk:** Anyone with repo access — including your evaluator and anyone the repo is later shared with — has admin credentials for any environment where this script was run. `Admin@123` is also trivially guessable.
- **Fix:** Read both from `process.env`; fail loudly if unset; never log the password.
- **Priority:** P0 (**XS** effort — do this in the first hour).

**S-07 — Brute-force protection is client-side only**
- **Problem:** `useOTP.ts` tracks `otpAttempts` and `lockoutUntil` in React component state. Unmounting the screen or restarting the app resets both. Meanwhile `authRateLimiter` (`rateLimiter.ts:19`) is **defined and exported but never applied to any route** — because authentication never touches the Express API at all; the app calls Supabase Auth directly.
- **Risk:** The advertised "3 attempts then 5-minute lockout" provides no real protection. Actual protection is whatever Supabase Auth's defaults give you.
- **Fix:** Enable Supabase Auth rate limits in the dashboard and document it. If you want app-level enforcement, persist attempt counts to `SecureStore`. **[RECOMMENDATION]** For your timeline, configure Supabase and document honestly rather than building a server-side OTP proxy.
- **Priority:** P1. Effort: **S**.

**S-08 — `trust proxy: true` enables rate-limit bypass**
- **Problem:** `app.ts:20` trusts all proxies, so `req.ip` is taken from a client-controllable `X-Forwarded-For`. The rate limiter keys on `req.ip` (`rateLimiter.ts:14`).
- **Risk:** A client rotating `X-Forwarded-For` gets unlimited requests.
- **Fix:** Set `trust proxy` to the specific hop count or CIDR of your actual proxy (e.g. `1`).
- **Priority:** P1. Effort: **XS**.

**S-09 — No ownership check on file upload / confirm / tag**
- **Problem:** `POST /photos/:id/file`, `/confirm`, and `/tag` take a photo ID and never verify the caller uploaded it. `tagStudents` does check the *school* matches (`photo.service.ts:216-229`) — good — but `saveUploadedFile` and `confirmUpload` check nothing at all.
- **Risk:** Teacher A at school X can overwrite the file content of teacher B's photo (also at X, or at any school). Combined with S-04, a teacher can discover other schools' photo IDs.
- **Fix:** Load the photo, compare `school_id` to `req.user.schoolId` and/or `uploaded_by` to `req.user.id`, throw 403.
- **Priority:** P1. Effort: **S**.

### MEDIUM

| # | Issue | Evidence | Fix |
|---|---|---|---|
| S-10 | CORS defaults to `*` with `credentials: true` | `env.ts:38` default `'*'`; `app.ts:26-27` | Require an explicit origin list in production |
| S-11 | Error messages leak internals in non-production | `errorHandler.ts:97-100` returns `err.message` when `NODE_ENV !== 'production'` | Correct behaviour, but ensure `NODE_ENV=production` is actually set on deploy |
| S-12 | Client-supplied MIME trusted | `upload.ts:26` | Verify magic bytes with `sharp().metadata()` |
| S-13 | No CSRF protection | Token-in-header auth, no cookies — **not exploitable**, note for completeness | None needed |
| S-14 | `helmet()` at defaults | `app.ts:23` | Fine for a JSON API; add HSTS on deploy |
| S-15 | Supabase project ref committed | `README_MIGRATIONS.md:20` `fhvwsmtivwtmbdscdoyz` | Low risk (refs are semi-public), but rotate keys before final submission |
| S-16 | No audit log for admin actions | Role changes, mappings, deletions are only `logger.info` | Add an `audit_log` table (P3) |
| S-17 | `req.ip` may be undefined → all clients share the `'unknown'` bucket | `rateLimiter.ts:14` fallback | Minor; fix with S-08 |

### LOW

- S-18: No dependency vulnerability scanning (no `npm audit` in CI; no CI at all).
- S-19: `express.json({ limit: '1mb' })` is sensible; multipart capped at 25 MB — both fine.
- S-20: Passwords are handled entirely by Supabase Auth (bcrypt) — **correct, no custom crypto anywhere.** Good.

### Security summary

| Severity | Count |
|---|---|
| Critical | 3 (S-01, S-02, S-03) |
| High | 6 (S-04 – S-09) |
| Medium | 8 |
| Low | 3 |

---

## 12. Performance Audit

### 12.1 The one that actually matters

**Full-resolution images are served to a mobile feed.** [OBSERVED] Because no thumbnail is ever generated (§5.4), `thumbnail_s3_key` is always `null`, so `parentService.ts:90` maps `thumbnailUri: null` and `feed.tsx:113` falls back to `item.uri` — the original. A 20-item feed page can therefore transfer **hundreds of megabytes** to a phone, over mobile data, through your Node process.

Everything else in this section is a rounding error next to this. Fix it first (see §8.3 step 3).

### 12.2 Frontend

| # | Issue | Evidence | Severity |
|---|---|---|---|
| P-1 | Full-res images in feed | Above | **Critical** |
| P-2 | `express.static` streams every image through Node | `app.ts:60` | High — object storage + CDN offloads this entirely |
| P-3 | `useUpload.startUpload` uploads all 20 images **concurrently** | `Promise.allSettled(idleImages.map(...))` (`:229`) | Medium — 20 × 25 MB in parallel will stall a phone connection. Add a concurrency limit of 3. |
| P-4 | `useUpload` callbacks depend on the whole `images` array | `:245`, `:278` | Medium — every progress tick recreates `startUpload`/`retryImage` |
| P-5 | `addImages` returns a count from stale closure state | `:153` uses `images.length` outside the setter | Low |
| P-6 | No `React.memo` on `PolaroidCard` | — | Low — FlashList mitigates |
| P-7 | Bundle: Skia + Lottie + Reanimated + Moti + SVG all included | `package.json` | Low — Skia (`@shopify/react-native-skia`, a large native dep) appears only via `ConfettiOverlay`; consider whether it earns its place |
| P-8 | `sha256File` builds a string char-by-char over the whole file | `utils/hash.ts:19-21` | Low — **currently dead code**, but would freeze the JS thread on a 25 MB file if ever wired up |

### 12.3 Backend

| # | Issue | Evidence | Severity |
|---|---|---|---|
| P-9 | **Unbounded tag fetch in the feed** | `feed.service.ts:62-67` selects **every** `photo_student_tags` row for the parent's children with **no limit**, then passes every resulting photo ID into `.in('id', photoIds)` (`:95`) | **High** — for a child with 2,000 tagged photos this builds a 2,000-UUID `IN` clause in a URL. PostgREST will return **414 URI Too Long** well before that. The parent feed *breaks as usage grows*. |
| P-10 | N+1 in `getSchools` | `admin.service.ts:230-242` — 2 extra count queries **per school** | Medium |
| P-11 | N+1-ish in `getClassDetail` | 4 sequential round trips | Low |
| P-12 | `getDashboardStats` fetches **all** order rows to count them | `admin.service.ts:61-63` | Medium — use `{count:'exact', head:true}` |
| P-13 | No Redis caching despite Redis being a dependency | — | Low |
| P-14 | No compression middleware | `app.ts` | Low |
| P-15 | Two DB round trips per authenticated request | `auth.ts:41,57` — `getUser` then `profiles` | Medium at scale; cache profile in Redis or trust JWT claims |

**Fix for P-9** (the important one): replace the two-query approach with a single joined query on `photo_student_tags` with `photos!inner(...)`, paginated at the DB level, rather than fetching all tags client-side. Effort: **M**.

### 12.4 Database

Indexes are good (§10.1). Missing: none critical. `idx_photos_dedup` is currently useless because dedup is dead (I-9). **[RECOMMENDATION]** Do not add more indexes — the existing set already matches the query patterns, and premature indexing is exactly what the brief warns against.

---

## 13. Scalability & Load Engineering

### 13.1 Honest assessment by scale

| Users | Verdict | Binding constraint |
|---|---|---|
| **10 concurrent** | ✅ Fine | None |
| **100 concurrent** | ⚠️ Degraded | P-1/P-2: Node streaming full-res images saturates bandwidth and event loop |
| **1,000 concurrent** | ❌ Fails | Above, plus local disk (I-4/I-5) making multi-instance impossible, plus P-15 doubling Supabase load |
| **10,000** | ❌ Not a realistic target | Would need a genuine re-architecture — and **is not worth designing for in this project** |

**[RECOMMENDATION]** Be honest about this in your report and viva. "We tested to N and identified X as the bottleneck" is a much stronger answer than an architecture diagram full of components you never ran. Target **100 concurrent users** as your demonstrated ceiling.

### 13.2 What to actually change

| Change | Needed? | Why |
|---|---|---|
| Move photos to object storage | ✅ **Yes** | Fixes the #1 bottleneck *and* the #1 security hole simultaneously. Highest ROI change in the project. |
| Generate thumbnails | ✅ **Yes** | 50–100× payload reduction |
| Make the backend stateless | ✅ **Yes** | Follows automatically from object storage; enables any PaaS to scale it |
| Fix the feed query (P-9) | ✅ **Yes** | Otherwise the feed breaks on data volume, not user count |
| Redis for caching | ❌ **No** | You have Redis only for BullMQ, which we recommend deleting. Adding caching is premature. |
| Message queue / workers | ❌ **No** | Synchronous `sharp` is sufficient at this scale (§5.4) |
| Load balancer | ❌ **No** | Your PaaS provides one |
| CDN | ⚠️ **Free** | Supabase Storage serves via CDN already — mention it, don't build it |

**Do not add infrastructure to look sophisticated.** Deleting Redis and BullMQ will make your architecture *more* defensible, not less, because you can explain the trade-off you made and why.

### 13.3 Load testing plan

Use **k6** — single binary, JS-scripted, no runtime to install, trivial CI integration.

```
packages/backend/loadtest/
├── smoke.js       1 VU,   30 s  — does it work at all
├── load.js        50 VU,  5 min — expected peak
├── stress.js      → 300 VU ramp — where does it break
└── spike.js       0→200→0       — recovery behaviour
```

Scenarios, weighted by real traffic shape:
1. **Parent feed** (60%) — `GET /feed` + paginate. The dominant read path.
2. **Photo detail** (20%) — `GET /feed/photos/:id`.
3. **Teacher upload** (10%) — the full 3-step pipeline with a fixture image.
4. **Order creation** (5%) — with idempotency keys.
5. **Admin dashboard** (5%) — `GET /admin/dashboard`.

Metrics and targets to report:

| Metric | Target |
|---|---|
| p50 latency | < 200 ms |
| p95 latency | < 800 ms |
| p99 latency | < 2 s |
| Error rate | < 1% |
| Throughput | ≥ 100 req/s |
| Feed payload / page | < 2 MB (currently far higher — this is your headline before/after) |

**Run it twice — before and after the thumbnail fix.** That before/after table is one of the most persuasive artefacts you can put in a BSc report, and it costs you nothing extra.

---

## 14. Third-Party Integrations

| Service | Purpose | Integrated? | Required? | Recommended provider | Priority |
|---|---|---|---|---|---|
| Auth | Login, OTP, sessions | ✅ Yes | ✅ **Required** | **Supabase Auth** (in use) | — |
| Database | Relational store | ✅ Yes | ✅ **Required** | **Supabase Postgres** (in use) | — |
| Email (OTP delivery) | Deliver codes | ⚠️ Supabase default SMTP | ✅ **Required** | **Supabase + Resend** free tier | **P0** — the default SMTP is rate-limited to a few emails/hour and **will fail during a live demo** |
| Object storage | Photos | ❌ Code exists, unused | ✅ **Required** | **Supabase Storage** (§8.3) | **P0** |
| Backend hosting | Run Express | ❌ None | ✅ **Required** | **Render** free tier / Railway | **P0** |
| Mobile distribution | Share the app | ❌ None | ✅ **Required** | **Expo EAS Build** (free tier) or Expo Go | **P0** |
| Redis | BullMQ | ⚠️ Configured, jobs dead | ❌ **Not required** | — remove | P1 (removal) |
| AWS S3 | Storage | ⚠️ Configured, unused | ❌ **Not required** | — remove | P1 (removal) |
| Error tracking | Crash/error visibility | ❌ None | ⚠️ Should have | **Sentry** free tier | P1 |
| Push notifications | Alerts | ❌ None | ❌ Optional | Expo Push | P3 |
| Analytics | Usage metrics | ❌ None | ❌ Optional | PostHog | P3 |
| Payments | Charge for prints | ❌ None | ❌ **Out of scope** | — | P3 — orders are intentionally "request" not "purchase"; **say this explicitly in the report** so it reads as a scoping decision, not an omission |
| CDN | Image delivery | ❌ | ❌ Free with Supabase | — | — |

**Required to work:** Supabase (Auth + DB + Storage), an SMTP provider, backend hosting, a mobile build.
**Optional production improvements:** Sentry, analytics, push, payments.

---

## 15. Logging, Monitoring & Observability

### Current state

- **Winston** with JSON in production and colourised output in development (`config/logger.ts`) — good.
- `defaultMeta: { service: 'hive-backend' }` — good.
- Request logging at `debug` level (`app.ts:47-52`) — **invisible in production**, since the level is `info` there.
- A client-side `utils/logger.ts` wrapper exists.
- **No error tracking, no metrics, no uptime monitoring, no log aggregation.**

### Findings

| # | Finding | Evidence |
|---|---|---|
| L-1 | Request logs disappear in production | `app.ts:49` uses `logger.debug`; prod level is `info` (`logger.ts:23`) |
| L-2 | No request correlation ID | `X-Request-ID` is allow-listed in CORS (`app.ts:33`) but never generated, read, or logged |
| L-3 | Auth failures log `req.ip` — PII under GDPR-style regimes | `auth.ts:45` |
| L-4 | Full error objects logged, risking token leakage | `auth.ts:83` `logger.error('Authentication error', { error: err })` — if `err` is a Supabase error it may embed request context |
| L-5 | No log persistence — console only, lost on restart | `logger.ts:24` |
| L-6 | No health check beyond a static 200 | `app.ts:64` doesn't verify DB or storage connectivity |

### Recommendations

**Do (P1, ~2 hours total):**
1. Promote request logging to `info` and add a `X-Request-ID` middleware (generate a UUID, attach to `req`, include in every log line, echo in the response header). This is cheap and is genuinely impressive in a viva.
2. Add **Sentry** to both apps — free tier, ~15 minutes each, and gives you a real screenshot of captured errors for the report.
3. Extend `/health` to ping Supabase and return `{ status, db, uptime, version }`.
4. Redact: never log tokens, passwords, or full error objects from auth paths.

**Don't:** Prometheus, Grafana, ELK, or OpenTelemetry. All are disproportionate here and none will earn marks a Sentry screenshot doesn't.

---

## 16. Testing & QA

### Current state

**There are zero tests.** [OBSERVED] No test runner, no test files, no `test` script in any `package.json`, no CI. `turbo.json` defines `build`, `dev`, `lint`, `typecheck`, `clean` — no `test` task.

This is the single largest gap between this project and a professional codebase, and it's also the one most likely to be probed in a viva.

### Recommended setup

Keep it minimal and high-signal:

- **Backend:** Vitest + Supertest. Vitest needs almost no config and is fast.
- **Mobile:** Vitest (or Jest via `jest-expo`) + React Native Testing Library for hooks and pure logic only. **Do not attempt full component rendering tests** — the RN testing setup cost is high and the marginal value here is low.
- **E2E:** **Skip Detox/Maestro.** Use a scripted manual demo run instead (§16.3). Detox setup alone can consume more time than your entire remaining budget.

### 16.1 Critical test matrix

Aim for ~35–40 tests total. These are chosen because each one guards a bug this audit actually found.

| # | Area | Test | Guards |
|---|---|---|---|
| T-1 | Auth | `authenticate` rejects a missing Bearer header → 401 | — |
| T-2 | Auth | `authenticate` rejects an invalid token → 401 | — |
| T-3 | Auth | `authenticate` attaches `role`/`schoolId` from `profiles` | — |
| T-4 | RBAC | `roleGuard` returns 403 for a wrong role | — |
| T-5 | RBAC | Parent cannot reach `/admin/*` | — |
| T-6 | **Security** | **Parent A cannot fetch Parent B's child's photo detail** | **S-02** |
| T-7 | **Security** | **Teacher at school X cannot list school Y's students** | **S-04** |
| T-8 | **Security** | **Teacher cannot upload a file onto another teacher's photo** | **S-09** |
| T-9 | **Security** | Photo URL without auth → 401 | **S-01** |
| T-10 | Feed | Parent sees only photos tagged with their own children | Core privacy |
| T-11 | Feed | Feed excludes `status != 'ready'` | — |
| T-12 | Feed | Cursor pagination returns no duplicates across pages | G-14 |
| T-13 | Feed | Photo tagged with two of the parent's children appears once | §5.6 |
| T-14 | **Orders** | **A valid order payload from the real mobile client is accepted** | **§5.1** |
| T-15 | Orders | Prices come from the server, not the client | Tamper resistance |
| T-16 | Orders | Ordering a photo not tagged with your child → 403 | `order.service.ts:83` |
| T-17 | Orders | Duplicate `X-Idempotency-Key` returns the cached response, not a second order | `idempotency.ts` |
| T-18 | Orders | Concurrent identical keys → one 201, one 409 | `idempotency.ts:57` |
| T-19 | Orders | `total_amount` matches the sum of items in the correct unit | §5.1(3) |
| T-20 | Upload | Rejects a non-image MIME | `upload.ts:26` |
| T-21 | Upload | Rejects > 25 MB | `upload.ts:22` |
| T-22 | Upload | Teacher cannot upload to another school's class | `photo.service.ts:72` |
| T-23 | **Upload** | **After tag-then-confirm, tagged parents have a `new_photos` notification** | **§5.2** |
| T-24 | Tagging | Tagging a student from another school → 400 | `photo.service.ts:245` |
| T-25 | Tagging | Re-tagging the same student is idempotent | `uq_photo_student_tag` |
| T-26 | Validation | Every Zod schema rejects malformed input | — |
| T-27 | **Admin** | **Dashboard stats return real order counts and revenue** | **§5.3** |
| T-28 | Admin | Assigning a nonexistent teacher → 404 | `admin.service.ts:405` |
| T-29 | Admin | Mapping an already-mapped parent → 409 | `admin.service.ts:532` |
| T-30 | **Admin** | **Search containing `,` does not alter the filter** | **S-05** |
| T-31 | Notifications | `markAsRead` on another user's notification → 404 | §5.7 |
| T-32 | Notifications | Unread count is accurate | — |
| T-33 | Errors | `AppError` maps to the right status and code | — |
| T-34 | Errors | Unknown errors do not leak stack traces in production | `errorHandler.ts:97` |
| T-35 | Mobile | `cartStore` totals and quantity edge cases | — |
| T-36 | Mobile | `useUpload` state machine reaches `error` on failure | — |
| T-37 | Mobile | `getRoleRoute` maps every role | — |
| T-38 | **Mobile** | **`RoleGate` redirects a parent away from admin routes** | **S-03** |

### 16.2 Priority

If you can only write ten, write **T-6, T-7, T-9, T-10, T-14, T-16, T-17, T-23, T-27, T-38**. Every one of them guards a P0 defect found in this audit — which also means each one is a story you can tell in the viva.

### 16.3 Manual QA checklist for the demo

**Pre-demo (day before)**
- [ ] `pnpm install` from clean, `pnpm build:backend` succeeds
- [ ] `pnpm typecheck` and `pnpm lint` pass with zero errors
- [ ] All migrations apply to a **fresh** database without error
- [ ] Seed data loads and produces a populated demo account
- [ ] Backend deployed and `/health` returns 200 from a phone on mobile data
- [ ] Mobile app builds and installs on the actual demo device
- [ ] OTP email arrives within 30 s (test the real address you'll demo with)
- [ ] Every `.env` is set in the deployed environment
- [ ] No console errors or warnings on any screen

**Auth**
- [ ] Teacher signup → OTP → lands on teacher dashboard
- [ ] Parent signup → OTP → lands on feed
- [ ] Admin password login → admin dashboard
- [ ] Wrong OTP shows an error and shakes
- [ ] Sign out returns to login; session does not resurrect
- [ ] App restart keeps the user signed in
- [ ] Deep-link to another role's route redirects correctly

**Teacher**
- [ ] Class dropdown lists the right classes
- [ ] Pick 5 images; all thumbnails render
- [ ] Tag 2 students; tags persist
- [ ] Upload completes; progress reaches 100%; confetti fires
- [ ] Photos appear on the dashboard immediately
- [ ] Airplane-mode mid-upload → clear error → retry succeeds

**Parent**
- [ ] Feed shows only this child's photos
- [ ] Child switcher changes the feed
- [ ] Pull-to-refresh works
- [ ] Scroll past 20 items loads page 2
- [ ] Tap opens detail; pinch-zoom works
- [ ] Long-press opens the action sheet
- [ ] **Place an order end-to-end; it appears in history with the correct price**
- [ ] Notification appears after a teacher uploads a photo of this child
- [ ] Parent with no children sees a helpful empty state

**Admin**
- [ ] **Dashboard shows non-zero orders and revenue**
- [ ] Create a school; it appears in the list
- [ ] Create a class; assign a teacher
- [ ] Add a student; map a parent by email
- [ ] User search returns correct results
- [ ] Role change persists

**Cross-cutting**
- [ ] Offline banner appears in airplane mode
- [ ] No unhandled promise rejections in logs
- [ ] Back-navigation never lands on a blank screen
- [ ] Every button either acts or is visibly disabled

---

## 17. DevOps & Deployment

### Current state

| Item | Status |
|---|---|
| Turborepo pipeline | ✅ `build`, `dev`, `lint`, `typecheck`, `clean` |
| pnpm workspace | ✅ |
| Prettier + ESLint | ✅ |
| Commitlint (conventional commits) | ✅ Configured — **but zero commits follow it** |
| TypeScript strict mode | ✅ Both packages |
| `.env.example` | ⚠️ Present but wrong (§18) |
| **Dockerfile** | ❌ |
| **CI/CD** | ❌ No `.github/` |
| **Deployment config** | ❌ None |
| **Migration automation** | ❌ Manual (`README_MIGRATIONS.md`) |
| **Health check** | ⚠️ Static only |
| **Rollback / backups** | ❌ Supabase free tier gives daily backups — document it |

### Recommended architecture (deliberately simple)

```
Expo app (EAS Build / Expo Go)
      │  HTTPS
      ▼
Express API  ──►  Render / Railway free tier
      │            (Docker or native Node build)
      ▼
Supabase  ──►  Postgres + Auth + Storage (+ CDN)
```

No Kubernetes, no Terraform, no service mesh. This is the right size for the project and defensible in a viva.

### Actions

| # | Action | Priority | Effort |
|---|---|---|---|
| V-1 | Dockerfile for the backend (multi-stage, non-root user) | P1 | S |
| V-2 | `docker-compose.yml` for local dev (backend + Redis if kept) | P2 | S |
| V-3 | GitHub Actions: install → lint → typecheck → build → test on PR | P1 | S |
| V-4 | Deploy the backend to Render; set env vars | **P0** | M |
| V-5 | `pnpm db:migrate` script wrapping `supabase db push` | P1 | XS |
| V-6 | Real health check (DB ping) | P1 | XS |
| V-7 | Branch protection on `main`; require CI green | P1 | XS |
| V-8 | Document the rollback procedure (redeploy previous commit; restore Supabase backup) | P2 | XS |
| V-9 | EAS build profile for a shareable APK | P1 | S |

---

## 18. Configuration & Secrets

### Secrets scan result

**[OBSERVED] Clean — no committed credentials.** A scan for JWT-shaped strings, `AKIA*` AWS keys, `sk_live`/`sk_test`, service-role keys, and password assignments across all `.ts/.tsx/.sql/.json/.md/.toml` files returned **zero hits**. `.gitignore` correctly excludes `.env`, `.env.local`, `.env.*.local`. Only `.env.example` files are tracked. **This is good practice and worth stating in your report.**

Two exceptions to flag:
- `scripts/seedAdmin.ts:24-25` — hardcoded admin password (S-06).
- `README_MIGRATIONS.md:20` — the live Supabase project ref `fhvwsmtivwtmbdscdoyz` (S-15, low risk).

### `.env.example` defects [OBSERVED]

| # | Issue | Evidence |
|---|---|---|
| C-1 | `PORT=3000` but `env.ts` defaults to `4000` and `BACKEND_URL` defaults to `:4000` | `.env.example:1` vs `config/env.ts:6,32` |
| C-2 | Mobile `EXPO_PUBLIC_API_URL=http://localhost:3000` — inconsistent with both of the above | `apps/mobile/.env.example:3` |
| C-3 | **`BACKEND_URL` is missing entirely** from `.env.example` despite being in the schema | `config/env.ts:32` |
| C-4 | AWS vars documented as if required — they are unused | `.env.example:7-10` |
| C-5 | `app.json` has no `extra` block, so `Constants.expoConfig.extra.apiUrl` is always `undefined` | `app.json` vs `lib/api.ts:5` — the fallback saves it, but the primary path is dead code |

### Required environment variables

**Backend (`packages/backend/.env`)**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `4000` | HTTP port |
| `NODE_ENV` | No | `development` | **Must be `production` on deploy** (controls error verbosity) |
| `SUPABASE_URL` | **Yes** | — | Project URL |
| `SUPABASE_SERVICE_KEY` | **Yes** | — | Service-role key — **bypasses RLS, never expose** |
| `BACKEND_URL` | No | `http://localhost:4000` | Public origin for URL building |
| `CORS_ORIGINS` | No | `*` | **Set explicitly in production** |
| `REDIS_URL` | No | `redis://localhost:6379` | Only if BullMQ is kept |
| `AWS_*`, `S3_BUCKET` | No | — | **Unused — remove** |

**Mobile (`apps/mobile/.env`)**

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | **Yes** | Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Anon key (public by design; RLS enforces access) |
| `EXPO_PUBLIC_API_URL` | **Yes** | Backend base URL |

---

## 19. Documentation Gaps

### Current state

`README.md` (100 lines, **describes the wrong stack** — §2.1), `supabase/README_MIGRATIONS.md` (good, accurate), inline JSDoc (genuinely good across components and services), SQL `COMMENT ON` (excellent).

### Required documents

| # | Document | Status | Priority |
|---|---|---|---|
| N-1 | **Rewrite README with the actual stack** | 🐛 **Wrong** | **P0** |
| N-2 | Problem statement & objectives | ❌ | P0 |
| N-3 | Architecture doc | ❌ | P0 |
| N-4 | Database design + ER diagram | ⚠️ SQL comments only | P0 |
| N-5 | API reference (all 20+ endpoints) | ❌ | P0 |
| N-6 | Setup / run instructions | ⚠️ Wrong commands | P0 |
| N-7 | Environment variable reference | ⚠️ Incomplete | P1 |
| N-8 | Security design doc (RLS, RBAC, auth flow) | ❌ | P1 |
| N-9 | Testing strategy + results | ❌ | P1 |
| N-10 | Deployment guide | ❌ | P1 |
| N-11 | Load test methodology + results | ❌ | P1 |
| N-12 | Known limitations & future scope | ❌ | P1 |
| N-13 | Team contribution statement | ❌ | **P0** — see §20 |

### Diagrams to prepare

| # | Diagram | Tool | Priority |
|---|---|---|---|
| G-1 | System architecture (app → API → Supabase) | Mermaid / draw.io | P0 |
| G-2 | ER diagram (10 tables + relationships) | dbdiagram.io | P0 |
| G-3 | Auth sequence (OTP → JWT → profile → role route) | Mermaid | P0 |
| G-4 | Photo upload sequence (pick → slot → upload → tag → confirm → notify) | Mermaid | P0 |
| G-5 | Parent feed data flow (tags → RLS/service check → signed URL) | Mermaid | P1 |
| G-6 | User flow / navigation map per role | Figma / Excalidraw | P1 |
| G-7 | Deployment topology | draw.io | P1 |
| G-8 | Order sequence with idempotency | Mermaid | P2 |

**[RECOMMENDATION]** Write G-3 and G-4 as Mermaid **in the repo**, not as images. They render on GitHub, they diff in code review, and they demonstrate engineering maturity.

---

## 20. Final Demo Readiness

### What you can already demonstrate well

- Clean monorepo with a real design system and component library
- Complete teacher upload flow with tagging (**your best demo path**)
- Parent feed with infinite scroll, skeletons, empty states, offline handling
- Full admin CRUD across schools, classes, students, teachers, parent mappings
- 505 lines of thoughtful RLS
- Cursor pagination, idempotency middleware, structured logging, Zod validation
- Well-indexed, well-commented schema

### What will visibly fail

| # | Risk | Trigger | Fix |
|---|---|---|---|
| R-1 | **Ordering fails** | Evaluator taps "Place order" | §5.1 |
| R-2 | **Three "Coming Soon" screens** | Any tap on Alerts | G-03 |
| R-3 | **Admin dashboard shows 0 orders / $0** | Opening the admin dashboard | §5.3 |
| R-4 | **No demo data** | `seed.sql` cannot run (D-11) | Rewrite the seed path |
| R-5 | **No parent notifications** | "Show us the notification when a photo is uploaded" | §5.2 |
| R-6 | **Photos load slowly or time out** | Feed with real photos on mobile data | §12.1 |
| R-7 | **README describes Flutter** | Evaluator reads the README first | N-1 |
| R-8 | **OTP email doesn't arrive** | Supabase default SMTP rate limit | Configure Resend |
| R-9 | **Nothing is deployed** | "Can we try it?" | V-4 |
| R-10 | **Single-author git history** | Evaluator checks contributions | Document 2 |

### Demo readiness checklist

**Functional**
- [ ] Order placed end-to-end and visible in history with the correct price
- [ ] Notifications work for parent, teacher, and admin
- [ ] Admin dashboard shows real numbers
- [ ] Parent notified when their child's photo is uploaded
- [ ] Thumbnails load fast on mobile data
- [ ] Role-based routing enforced

**Data**
- [ ] 2 schools, 4 classes, 12 students, 3 teachers, 4 parents, 30+ photos, 3+ orders
- [ ] Demo accounts documented with credentials
- [ ] Photos are real, appropriate images — **not lorem-ipsum placeholders**

**Infrastructure**
- [ ] Backend deployed with a public URL
- [ ] `/health` returns 200
- [ ] Mobile app installable on the demo device
- [ ] **A recorded video fallback exists in case the network fails**

**Presentation**
- [ ] README accurate
- [ ] Architecture + ER diagrams ready
- [ ] Security findings and fixes documented (**this audit is itself strong evidence of rigour — cite it**)
- [ ] Load test before/after numbers
- [ ] Test suite runs green in front of the evaluator
- [ ] Each team member can explain their own contribution

---

## 21. Master Gap Analysis

| ID | Area | Issue | Current State | Expected State | Sev | Pri | Effort | Depends | Fix |
|---|---|---|---|---|---|---|---|---|---|
| G-01 | Orders | Mobile sends `snake_case` + dollar prices + `print_4x6`; backend Zod requires `camelCase` + cents + `4x6`; DB CHECK requires `print_4x6`. Every order 400s at validation | Feature has never worked | Order places, persists, appears in history with correct price | Critical | **P0** | M | — | Define the product catalogue once in a shared module; standardise on camelCase API, `print_*` values, integer cents; align `order.validator.ts`, `cartStore.ts`, `order.service.ts` prices, and the `00009` CHECK |
| G-02 | Security | `/uploads` served by `express.static` with no auth; Supabase bucket `public:true` with `TO public` read | Every child photo is a permanent public URL | Private bucket; short-lived signed URLs issued only after an ownership check | Critical | **P0** | M | — | Delete `app.ts:60`; flip bucket private in `00015`; add authorised signed-URL endpoint |
| G-03 | Notifications | `NotificationCenter`, `NotificationCard`, `useNotifications`, `notificationService` have **zero imports**; 3 screens render "Coming Soon" | ~700 lines of finished dead code | All three screens render the real notification list | High | **P0** | S | — | Replace the `EmptyState` body of the three `notifications.tsx` screens with `<NotificationCenter />` |
| G-04 | Security | `getPhotoDetails(photoId, baseUrl)` takes no user ID and performs no ownership check | Any parent reads any photo | 404 unless the caller is a parent of a tagged child | Critical | **P0** | S | — | Thread `req.user.id`; add an `EXISTS` check on tags ⋈ mappings |
| G-05 | Security | No route group layout checks role; `_layout.tsx:43-44` reads `role` and ignores it | Parent can deep-link to admin UI | Each group redirects on role mismatch | Critical | **P0** | S | — | Add `<RoleGate allow={[...]}>` to all three group layouts |
| G-06 | Admin | `select('id, total')` — column is `total_amount` | Orders and revenue always show 0 | Real counts and revenue | High | **P0** | XS | — | Fix the column; use `{count:'exact',head:true}`; check the error |
| G-07 | Upload | Tagging happens after `status='ready'`, so `notify_parents_on_photo` loops over zero tags | Parents never notified | Parents notified on every tagged upload | High | **P0** | S | G-01 order of ops | Tag first, then call confirm to flip to `ready`; fix the `confirmUpload` state guard |
| G-08 | Security | `/schools/:id/classes`, `/schools/:id/students`, `getPhotosByClass` never compare to `req.user.schoolId` | Cross-school student roster + DOB readable by any teacher | 403 outside your own school | High | **P0** | S | — | Add school-scope checks to all three |
| G-09 | RBAC | `school_admin` used in 6 places but excluded by the `profiles.role` CHECK | Admin UI offers a role the DB rejects; a real `admin` cannot upload photos | One consistent role vocabulary | High | **P0** | XS | — | Replace `school_admin` with `admin` in `roleGuard` calls, `updateUserRoleSchema`, and `notifyAdminsOfNewOrder` |
| G-10 | Security | `seedAdmin.ts` hardcodes `admin@hive.app` / `Admin@123` and prints it | Credentials in git | Env-provided, never logged | High | **P0** | XS | — | Read from `process.env`; fail if unset |
| G-11 | Data | `seed.sql` inserts `profiles` rows referencing nonexistent `auth.users` | Seed cannot run; no demo data | One command produces a full demo dataset | High | **P0** | M | — | Rewrite as a TS script using `supabase.auth.admin.createUser` then insert domain rows |
| G-12 | Perf | No thumbnails generated → feed serves full-res originals | Feed page can exceed 100 MB | `_thumb.jpg` served; page < 2 MB | High | **P0** | M | G-02 | Generate with `sharp` synchronously during upload |
| G-13 | Jobs | Neither BullMQ queue is ever enqueued; workers also target the wrong storage and wrong column names | Dead subsystem + a Redis dependency for nothing | Removed, or genuinely used | Medium | P1 | M | G-12 | Delete `jobs/`, `config/redis.ts`, `bullmq`, `ioredis` |
| G-14 | Perf | `feed.service` fetches **all** tags unbounded, then `.in('id', [n IDs])` | 414 URI Too Long as photo count grows | Single paginated join | High | P1 | M | — | Rewrite as one `photo_student_tags` + `photos!inner` query with DB-level pagination |
| G-15 | Correctness | Dead `getParentFeed` dedups after fetching `limit+1`, so `hasNext` can be wrong | Feed truncates early | Deleted | Low | P2 | XS | — | Delete `photo.service.ts:340-449` |
| G-16 | Security | `admin.getUsers` interpolates raw `search` into a PostgREST `.or()` filter | Filter injection | Sanitised | High | P1 | XS | — | Character allow-list, or two `.ilike()` queries |
| G-17 | Security | `POST /photos/:id/file` and `/confirm` verify no ownership | Teacher can overwrite another's photo | 403 on mismatch | High | P1 | S | — | Load photo; compare `school_id`/`uploaded_by` |
| G-18 | Validation | `tagStudentsSchema` and `getOrdersSchema` defined but never applied | Unvalidated `studentIds` reaches PostgREST | All inputs validated | Medium | P1 | XS | — | Add `validate(...)` to the routes |
| G-19 | DB | `NOT NULL` + `ON DELETE SET NULL` on 3 FKs | Deleting a profile/photo raises a constraint error | Coherent delete behaviour | High | P1 | S | — | Make the columns nullable, or switch to `ON DELETE CASCADE`/`RESTRICT` |
| G-20 | Security | `trust proxy: true` trusts all hops | Rate limit bypass via `X-Forwarded-For` | Trust only your proxy | Medium | P1 | XS | — | `app.set('trust proxy', 1)` |
| G-21 | Testing | Zero tests, zero CI | No regression safety | ~35 high-value tests + CI | High | P1 | L | — | Vitest + Supertest; GitHub Actions |
| G-22 | Docs | README describes Flutter/Provider and a nonexistent directory tree | Misleads the reader immediately | Accurate | High | **P0** | S | — | Rewrite §Tech Stack and §Project Structure |
| G-23 | DevOps | No deployment, Dockerfile, or CI | Cannot be demonstrated live | Public URL + green CI | High | **P0** | M | — | Render + GitHub Actions |
| G-24 | Storage | Three storage strategies; two unused | Confusing, and the live one is ephemeral | One: Supabase Storage | High | P1 | M | G-02 | Migrate; delete S3 + local paths |
| G-25 | Config | `.env.example` port mismatch (3000/4000) and missing `BACKEND_URL`; AWS vars documented but unused | Setup fails for a new developer | Accurate and complete | Medium | P1 | XS | — | Correct both `.env.example` files |
| G-26 | UX | Onboarding animation is an empty `View` | First screen looks unfinished | Real Lottie plays | Medium | P1 | S | — | Wire `assets/lottie/bee.json` into `OnboardingSlide` |
| G-27 | UX | Upload progress is hardcoded steps | Progress bar is fake | Real bytes-transferred | Medium | P1 | M | — | `XMLHttpRequest.upload.onprogress` instead of `fetch` |
| G-28 | UX | No toast/snackbar anywhere | Success/failure silent | Feedback on every mutation | Medium | P1 | S | — | Add a toast provider; wire order + admin mutations |
| G-29 | UX | No confirmation on destructive admin actions | Accidental deletion | Confirm dialog | Medium | P1 | S | — | Shared `<ConfirmDialog>` |
| G-30 | UX | Parent with no children sees generic "No photos yet" | Dead end | Explanatory empty state | Medium | P1 | XS | — | Branch on `children.length === 0` |
| G-31 | Errors | `markAsRead` destructures `count` without `{count:'exact'}` → never 404s | Wrong contract | Correct 404 | Low | P2 | XS | — | Add the count option |
| G-32 | API | `schools.routes.ts` has inline handlers and an inline schema | Breaks the layering everywhere else | Controller + service + validator | Low | P2 | S | — | Refactor |
| G-33 | API | Two error-emission styles (`AppError` vs hand-rolled `res.json`) | Inconsistent responses | One | Low | P2 | S | — | Throw `AppError` everywhere |
| G-34 | Perf | `getSchools` N+1 (2 counts per school) | 2N+1 queries | Single aggregate | Medium | P2 | S | — | Aggregate query or a view |
| G-35 | Perf | Upload fires all 20 images concurrently | Stalls the connection | Concurrency limit 3 | Medium | P2 | XS | — | Simple pool in `startUpload` |
| G-36 | DB | Migrations not idempotent (`CREATE POLICY` without guard) | Re-running fails | Safe to re-run | Medium | P2 | XS | — | `DROP POLICY IF EXISTS` first |
| G-37 | DB | No transaction around order + items | Partial order on crash | Atomic | Medium | P2 | S | — | Postgres function or RPC |
| G-38 | Obs | Request logs at `debug` are invisible in prod; no request ID | Cannot trace a request | `info` + `X-Request-ID` | Medium | P1 | XS | — | Middleware |
| G-39 | Obs | No error tracking | Blind to production errors | Sentry | Medium | P1 | S | — | Add to both apps |
| G-40 | Files | MIME trusted from client; no magic-byte check | Content-type spoofing | Verified | Medium | P2 | XS | — | `sharp().metadata()` on upload |
| G-41 | Files | No deletion; orphans accumulate | Storage grows forever | Delete endpoint + cleanup | Low | P3 | M | G-24 | Add photo delete |
| G-42 | Files | HEIC accepted but never converted | Broken images on Android | Converted to JPEG | Medium | P1 | S | G-12 | Convert in the same `sharp` pass |
| G-43 | Docs | No API reference, architecture doc, or diagrams | Report incomplete | All present | High | P1 | L | — | §19 |
| G-44 | Process | One commit, one author | Contribution not evidenced | 4 contributors, conventional commits | High | **P0** | — | — | **Document 2** |
| G-45 | Email | Supabase default SMTP is heavily rate-limited | OTP may not arrive during the demo | Custom SMTP | High | **P0** | XS | — | Configure Resend free tier |
| G-46 | Data | `photos.caption`, `students.avatar_url`, `schools.logo_url` never populated | Dead columns | Used or documented as future scope | Low | P3 | — | — | Note in limitations |

---

## 22. Prioritised Backlog

### P0 — Submission blockers (~2 days for 4 people in parallel)

| ID | Task | Effort |
|---|---|---|
| G-10 | Remove hardcoded admin credentials | XS |
| G-06 | Fix admin dashboard stats column | XS |
| G-09 | Unify the role vocabulary | XS |
| G-45 | Configure custom SMTP for OTP | XS |
| G-03 | Wire the three notification screens | S |
| G-04 | Fix photo-detail IDOR | S |
| G-05 | Add role-based route guards | S |
| G-08 | Fix cross-school IDORs | S |
| G-07 | Reorder tag-then-confirm | S |
| G-22 | Rewrite the README | S |
| G-01 | **Fix the order flow end-to-end** | M |
| G-02 | **Private storage + signed URLs** | M |
| G-12 | **Thumbnail generation** | M |
| G-11 | Working seed / demo data | M |
| G-23 | Deploy backend + CI | M |
| G-44 | 4-person contribution plan | — |

### P1 — Important (~2 days)

G-13 (remove BullMQ, M) · G-14 (feed query, M) · G-16 (filter injection, XS) · G-17 (upload ownership, S) · G-18 (wire validators, XS) · G-19 (FK constraints, S) · G-20 (trust proxy, XS) · G-21 (**tests + CI, L**) · G-24 (storage consolidation, M) · G-25 (env examples, XS) · G-26 (onboarding animation, S) · G-27 (real progress, M) · G-28 (toasts, S) · G-29 (confirm dialogs, S) · G-30 (empty states, XS) · G-38 (request IDs, XS) · G-39 (Sentry, S) · G-42 (HEIC, S) · G-43 (**docs + diagrams, L**)

### P2 — Polish (~1 day)

G-15 · G-31 · G-32 · G-33 · G-34 · G-35 · G-36 · G-37 · G-40 · U-3 · U-5 · U-7 · U-10

### P3 — Future scope (document, don't build)

Push notifications · photo download · captions · untagging · admin order fulfilment · parent order cancellation · profile editing · student avatars · school logos · dark mode · tablet layouts · payments · audit log · analytics · G-41 · G-46

---

## 23. Implementation Roadmap

Dependencies are real here — following this order avoids rework.

**Phase 0 — Understanding (done)**
This document.

**Phase 1 — Security & correctness quick wins (day 1 morning)**
G-10, G-06, G-09, G-45, G-20, G-16, G-25. All XS. No dependencies. Do these first — they are cheap and several are security-relevant.

**Phase 2 — Contracts & data model (day 1 afternoon)**
G-01 (orders), G-19 (FK constraints), G-18 (validators), G-11 (seed).
*Blocks:* everything order-related and all demo data. **G-01 must land before order tests or the order UI polish.**

**Phase 3 — Storage & performance (day 2)**
G-02 → G-12 → G-24 → G-42, then G-13.
*Strictly ordered:* private storage first, then thumbnails on top of it, then delete the old paths. G-13 (removing BullMQ) must come **after** G-12, because synchronous thumbnailing is what replaces the queue.

**Phase 4 — Authorization (day 2, parallel with Phase 3)**
G-04, G-08, G-17, G-05. Independent of Phase 3 — different files.

**Phase 5 — Feature completion & UX (day 3)**
G-03 (notifications), G-07 (tag ordering), G-26, G-28, G-29, G-30, G-27.
*Depends on:* G-07 needs Phase 2's confirm-endpoint fix.

**Phase 6 — Performance (day 3–4)**
G-14 (feed query), G-34, G-35. *Depends on:* Phase 3 for meaningful before/after numbers.

**Phase 7 — Testing (day 4)**
G-21. *Depends on:* Phases 2–5, or you'll write tests against code you're about to change.

**Phase 8 — Deployment (day 4–5)**
G-23, V-1, V-3, V-6, V-9. *Depends on:* Phase 3 (a deployed backend with local disk storage would be broken).

**Phase 9 — Documentation (day 5, parallel)**
G-22, G-43, all diagrams. Can start early; finish after the code settles.

**Phase 10 — QA & demo prep (day 6)**
Load tests, the §16.3 checklist, demo script, video fallback.

---

## 24. Definition of Done

A task is done when **all** of the following are true:

**Functionality**
- [ ] Works on a real device against the deployed backend, not just locally
- [ ] Happy path verified manually
- [ ] At least one failure path verified (network error, invalid input, unauthorised)

**Backend**
- [ ] Input validated with Zod at the route boundary
- [ ] Authorization enforced **server-side** — never trusting the client
- [ ] Ownership/tenancy checked for every resource accessed by ID
- [ ] Errors thrown as `AppError` with an appropriate status and code
- [ ] No secrets, tokens, or PII in logs

**Frontend**
- [ ] Loading state present
- [ ] Error state present and actionable
- [ ] Empty state present where a list can be empty
- [ ] Success feedback (toast, navigation, or animation)
- [ ] Buttons disabled while a mutation is in flight
- [ ] Tap targets ≥ 44 px; `accessibilityLabel` on interactive elements
- [ ] Renders correctly on a small phone (≤ 375 pt wide)

**Quality**
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes with no new warnings
- [ ] No console errors or warnings during the flow
- [ ] No `any` introduced without a written justification
- [ ] Dead code removed, not commented out

**Testing**
- [ ] At least one test covers the change if it touches auth, orders, uploads, or the feed
- [ ] Full suite green

**Process**
- [ ] Conventional commit message (`feat:`, `fix:`, `security:`, …)
- [ ] No `.env` or secret committed
- [ ] PR reviewed by one other team member
- [ ] Merged to `develop` without conflicts
- [ ] `pnpm build:backend` succeeds after merge

---

## 25. Final Production / Submission Checklist

**Security**
- [ ] Photos are private; access requires authorization (G-02)
- [ ] All IDOR findings closed (G-04, G-08, G-17)
- [ ] Role guards on both client and server (G-05, G-09)
- [ ] No credentials in the repository (G-10)
- [ ] `CORS_ORIGINS` explicitly set; `NODE_ENV=production`
- [ ] Supabase keys rotated before final submission
- [ ] Rate limiting verified working behind the real proxy

**Functionality**
- [ ] Every P0 gap closed
- [ ] Zero "Coming Soon" screens
- [ ] Every button either acts or is visibly disabled
- [ ] Order flow works end-to-end
- [ ] Notifications work for all three roles

**Quality**
- [ ] Typecheck and lint clean across the monorepo
- [ ] ~35 tests passing
- [ ] CI green on `main`
- [ ] Production build succeeds

**Data**
- [ ] Migrations apply cleanly to a fresh database
- [ ] Seed produces a realistic demo dataset
- [ ] Demo accounts documented

**Operations**
- [ ] Backend deployed; `/health` green
- [ ] Mobile app installable
- [ ] Sentry receiving events
- [ ] Load test results recorded

**Documentation**
- [ ] README accurate
- [ ] Architecture, ER, and sequence diagrams complete
- [ ] API reference complete
- [ ] Security and testing sections written
- [ ] Limitations and future scope stated honestly
- [ ] **Team contribution statement backed by real git history**

**Demo**
- [ ] Script rehearsed end-to-end
- [ ] Video fallback recorded
- [ ] Each member can explain their own work and answer questions on it
