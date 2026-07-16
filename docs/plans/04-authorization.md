# Plan 04 — Authorization & Access Control

**Branch:** `security/authorization`
**Size:** M (~4–5 hours)
**Depends on:** Plan 03 (Step 1 touches `feed.service.getPhotoDetails`, which Plan 03 also edits)
**Closes:** G-04, G-05, G-08, G-17

---

## Goal

Close every IDOR/BOLA vulnerability found in the audit, and stop the mobile app rendering screens the user has no right to see.

**The root cause of all of these:** the backend uses `supabaseAdmin` — created with `SUPABASE_SERVICE_KEY` (`config/supabase.ts:5-7`) — for every query. The service-role key **bypasses RLS entirely by design**. So the 505-line RLS policy set in `00011` protects only the handful of queries the mobile app makes directly to Supabase (`useChildren`, `useClasses`, `getClassStudents`, `authStore.initialize`). Every API endpoint must therefore re-implement authorization by hand — and in four places it doesn't.

This plan makes the API's authorization explicit, so the statement *"RLS is defence in depth; the API enforces the same rules in the service layer"* becomes true rather than aspirational. That distinction matters in a viva.

---

## Prerequisites

```bash
git checkout main && git pull
git checkout -b security/authorization main
```

---

## Step 1 — Photo detail IDOR (G-04) — **CRITICAL**

**The finding:** `GET /api/v1/feed/photos/:id` → `feed.controller.getPhotoDetails:42-44` → `feed.service.getPhotoDetails(id, baseUrl)`. **The service signature accepts no user ID** (`feed.service.ts:154-157`) and filters only on `status='ready'`.

Any authenticated parent, iterating photo UUIDs, retrieves any photo in the system — its URL, original filename, class name, school name, and the full list of tagged student IDs. That last field leaks a **cross-school child roster**.

**Files:** `packages/backend/src/services/feed.service.ts`, `controllers/feed.controller.ts`

**Do:**
1. Change the signature to `getPhotoDetails(photoId: string, userId: string)`.
2. Before returning, verify the caller is a parent of at least one tagged student:
   ```
   photo_student_tags pst
     JOIN parent_student_mappings psm ON psm.student_id = pst.student_id
   WHERE pst.photo_id = :photoId AND psm.parent_id = :userId
   ```
   Use a single `head: true` count query rather than fetching rows.
3. If the count is zero, throw `AppError('Photo not found', 404, 'PHOTO_NOT_FOUND')` — **404, not 403**. A 403 confirms the photo exists, which is itself an information leak.
4. **Filter `taggedStudentIds` to only this parent's children** before returning. Even an authorised parent should not learn which *other* children are in the photo. This is a second, separate leak in the same function.
5. Update the controller to pass `req.user!.id`.

---

## Step 2 — Cross-school IDORs (G-08) — **HIGH**

**The finding:** three endpoints take a resource ID from the URL and never check it belongs to the caller's school. Any teacher can enumerate another school's classes, its **complete student roster including dates of birth**, and all of its photos.

### 2a — `GET /schools/:id/classes` and `GET /schools/:id/students`

**File:** `packages/backend/src/routes/schools.routes.ts` (lines ~19-66)

Both handlers query by `req.params.id` with no comparison to `req.user.schoolId`.

**Do:** At the top of each handler:
- If `req.user.role === 'admin'`, allow any school (platform admins legitimately need cross-school access).
- Otherwise require `req.params.id === req.user.schoolId`, else throw `AppError(..., 403, 'FORBIDDEN')`.

Extract this into a small helper — it is used three times:
```ts
function assertSchoolAccess(req: Request, schoolId: string): void
```
Put it in `packages/backend/src/middleware/roleGuard.ts` next to the existing guard.

### 2b — `GET /photos?classId=`

**File:** `packages/backend/src/services/photo.service.ts` — `getPhotosByClass:282`

Filters only on `class_id`.

**Do:** Add a `userId` (or `schoolId`) parameter. Look up the class's `school_id` and compare to the caller's before querying photos. Throw 403 on mismatch, 404 if the class doesn't exist. Update `photo.controller.getPhotos` to pass `req.user!.schoolId`.

> `photo.service.requestUpload:62-78` already does exactly this check correctly. Copy its shape for consistency.

---

## Step 3 — Photo file/confirm ownership (G-17) — **HIGH**

**The finding:** `POST /photos/:id/file` and `POST /photos/:id/confirm` take a photo ID and verify nothing. `photo.service.saveUploadedFile` and `confirmUpload` both load the row but only check `status`. Teacher A can overwrite the file content of any other teacher's photo — at their own school or, combined with Step 2, any school.

**File:** `packages/backend/src/services/photo.service.ts`

**Do:**
1. Add a shared guard used by both functions:
   ```ts
   async function assertPhotoOwnership(photoId: string, user: AuthUser): Promise<PhotoRow>
   ```
   It loads the photo, then:
   - `admin` → allow
   - `teacher` → require `photo.uploaded_by === user.id` **and** `photo.school_id === user.schoolId`
   - otherwise → 403
2. Have `saveUploadedFile`, `confirmUpload` and `tagStudents` all call it.
3. `tagStudents:216-229` already checks the school but **not** `uploaded_by`. Tightening it to the uploader is the safer default; if you want any teacher at a school to tag a colleague's photo, keep it school-scoped and write that intent as a comment. Either is defensible — decide and document.
4. Update the controllers to pass `req.user!`.

---

## Step 4 — Mobile route guards (G-05) — **CRITICAL**

**The finding:** no route group layout performs any auth or role check. `(parent)/_layout.tsx`, `(teacher)/_layout.tsx` and `(admin)/_layout.tsx` are pure `<Tabs>` definitions. `app/_layout.tsx:43-44` reads `isAuthenticated` and `role` into variables and **never uses them**. Only `app/index.tsx` redirects, and any direct navigation bypasses it — the `hive://` scheme is registered at `app.json:8`, so `hive://(admin)/dashboard` renders the admin UI for a parent.

The backend `roleGuard` means API calls 403, so data is not fully disclosed. But the UI is, and any screen reading Supabase directly would leak whatever RLS permits.

**New file:** `apps/mobile/src/features/auth/components/RoleGate.tsx`

```tsx
interface RoleGateProps {
  allow: UserRole[];
  children: React.ReactNode;
}
```

Behaviour:
1. Read `isLoading`, `isAuthenticated`, `role` from `useAuthStore`.
2. While `isLoading` → render `null` (the splash screen is still up).
3. If not authenticated → `<Redirect href="/(auth)/login" />`.
4. If `role` is resolved and not in `allow` → `<Redirect href={getRoleRoute(role)} />` (send them to *their* home, not to login — being logged in as the wrong role is not an auth failure).
5. If authenticated but `role` is still null → `<Redirect href="/(auth)/login" />` (profile fetch failed).
6. Otherwise render `children`.

**Apply it** by wrapping the `<Tabs>` in each group layout:

| File | `allow` |
|---|---|
| `apps/mobile/src/app/(parent)/_layout.tsx` | `['parent']` |
| `apps/mobile/src/app/(teacher)/_layout.tsx` | `['teacher']` |
| `apps/mobile/src/app/(admin)/_layout.tsx` | `['admin']` |

**Also clean up `app/_layout.tsx`:** remove the two unused `isAuthenticated` / `role` reads at lines 43-44, or wire them into a meaningful loading gate. Leaving dead reads is what made this bug easy to miss.

---

## Step 5 — Verify the API error path on the client

`lib/api.ts:34-37` calls `supabase.auth.signOut()` on **any** 401. With route guards in place, a role mismatch now yields 403 (not 401), so this stays correct — but confirm no endpoint returns 401 for an authorisation (rather than authentication) failure. `roleGuard` correctly returns 403; `authenticate` correctly returns 401. Nothing to change; verify and move on.

---

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm build:backend
```

**Manual — API, using two accounts at different schools.** Grab JWTs from the app's network log or by signing in via the Supabase SDK.

- [ ] Parent A requests Parent B's child's photo → **404**
  ```bash
  curl -H "Authorization: Bearer $PARENT_A" $API/api/v1/feed/photos/$PHOTO_OF_B
  ```
- [ ] Parent A requests their **own** child's photo → 200, and `taggedStudentIds` contains **only their own children**
- [ ] Teacher at school X lists school Y's students → **403**
  ```bash
  curl -H "Authorization: Bearer $TEACHER_X" $API/api/v1/schools/$SCHOOL_Y/students
  ```
- [ ] Same for `/classes`
- [ ] Teacher X requests photos for a class at school Y → **403**
- [ ] Teacher X uploads a file to teacher Y's photo ID → **403**
- [ ] Admin can still access all schools
- [ ] Teacher can still do everything at their own school

**Manual — app:**
- [ ] Sign in as parent → land on feed
- [ ] Deep-link `hive://(admin)/dashboard` → **redirected to the parent feed**, admin UI never renders
- [ ] Deep-link `hive://(teacher)/upload` as a parent → redirected
- [ ] Sign out, then deep-link any protected route → redirected to login
- [ ] Cold start while signed in → no flash of the wrong screen before the redirect
- [ ] Each role still reaches its own tabs normally

---

## Commit sequence

```
security(feed): enforce parent ownership on the photo detail endpoint
security(feed): return only the requesting parent's tagged children
security(schools): scope class and student listings to the caller's school
security(photos): scope class photo listing to the caller's school
security(photos): verify photo ownership on file upload, confirm and tag
feat(auth): add RoleGate component for route-level access control
security(app): guard parent, teacher and admin route groups by role
refactor(app): remove unused auth state reads from the root layout
```

---

## Notes for the report

This plan produces good viva material. Record for Plan 10's security document:

- **The service-role key bypasses RLS.** This is the architectural fact that makes explicit service-layer authorization mandatory. Being able to explain *why* RLS alone was insufficient here demonstrates real understanding.
- **404 vs 403 on the photo endpoint** — returning 403 confirms existence. Choosing 404 is a deliberate information-leak defence.
- **Filtering `taggedStudentIds`** — authorisation is not binary. An authorised parent still should not learn which other children appear in the photo.
- **Defence in depth** — client route guards for UX, server guards for security, RLS as the last line for direct Supabase access. Three layers, each with a stated purpose.

---

## Done when

- [ ] All four IDOR checks above return 403/404 as expected
- [ ] Deep-linking to another role's route redirects
- [ ] Legitimate access for every role still works
- [ ] Typecheck, lint, build pass
- [ ] Merged into `main`
- [ ] Findings recorded for Plan 10

---

## Deviations

**Step 1 — one filtered query instead of a count plus a filter.** The plan asks
for a `head: true` count for the ownership check and, separately, filtering
`taggedStudentIds` afterwards. Both requirements are satisfied by a single
query: fetch the caller's own student IDs, then select `photo_student_tags` for
this photo `.in('student_id', ownStudentIds)`. Empty means not entitled;
non-empty *is* the filtered tag list. One round trip fewer, and it avoids
relying on a PostgREST embed between `photo_student_tags` and
`parent_student_mappings`, which have no direct foreign key between them — the
join the plan sketches would have had to route through `students`.

A parent with no children mapped at all short-circuits to 404 before the tag
query runs.

**Step 2b — `getPhotosByClass` takes `AuthUser`, not a school ID.** The plan
offers "a `userId` (or `schoolId`) parameter". Neither works alone: platform
admins carry `school_id = null`, so a bare school comparison locks them out of
every class. Passing the whole `AuthUser` lets the admin bypass sit next to the
check it bypasses, and matches the shape the plan already chose for
`assertPhotoOwnership`.

**Step 2a — `assertSchoolAccess` is used on all three handlers**, including
`POST /schools/:id/classes`. That route is already `roleGuard('admin')`, so the
call is a no-op today; it is there so the route stays correct if the guard is
ever widened.

**Step 3 — tagging is uploader-scoped.** The plan explicitly leaves this open
and asks for a decision. Decided: `tagStudents` uses the same
`assertPhotoOwnership` guard as `/file` and `/confirm`, so a teacher may tag
only photos they uploaded. Letting a colleague at the same school tag your photo
is a defensible product choice, but nothing in the app needs it, and one guard
across three routes is easier to keep correct than two that differ subtly. The
reasoning is in the guard's doc comment.

`saveUploadedFile` unlinks the temp file when the ownership check refuses —
multer has already written it to disk by the time the service runs, so without
this a rejected upload leaves the file behind.

**Step 5 — verified, no change, as predicted.** Every `401` in the backend is an
authentication failure: `auth.ts:29` (missing header), `:49` (invalid token),
`:68` (no profile row), and two defensive `!req.user` branches in `roleGuard.ts`.
Every authorization failure returns `403`. So `lib/api.ts`'s sign-out-on-401
stays correct now that a role mismatch yields 403.

**Migration `00022` was reserved for this plan but not used.** Plan 04 contains
no schema change — every fix is in the service layer, which is the point. The
number stays unallocated rather than being consumed.

**Plan 03 has not been started, and this plan nominally depends on it.** The
overlap is `feed.service.getPhotoDetails`, which both plans edit. The
authorization block added here sits above the URL construction and does not
touch it, so Plan 03 can replace the `/uploads/...` strings with signed Supabase
Storage URLs without conflict.

### Not verified

The repository contains no `.env`, so the backend cannot boot, the app cannot
run, and no Supabase call can be made. **None of the Verification section above
has been executed** — not one curl, not one device check. The four IDOR fixes
and the route guards are reviewed code, not observed behaviour.

What was verified: `pnpm typecheck` (backend clean throughout), `pnpm lint` (8
problems, down from 9, all pre-existing), and a per-commit diff of the mobile
typecheck output against the 22-error Plan 00 baseline — identical after every
mobile change, with no error in `RoleGate.tsx`, any `_layout.tsx`, or any
`notifications.tsx`.

The Done-when boxes are deliberately left unticked. They should be ticked by
whoever first runs this against a real backend with two accounts at different
schools.
