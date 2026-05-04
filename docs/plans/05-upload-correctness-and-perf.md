# Plan 05 — Upload Correctness & Query Performance

**Branch:** `fix/upload-and-feed`
**Size:** M (~5 hours)
**Depends on:** Plan 02, Plan 03
**Closes:** G-07, G-14, G-15, G-34, G-35

---

## Goal

Make the upload pipeline produce the notifications it was designed to produce, and fix the two query patterns that break as data grows.

---

## Step 1 — Tag before ready, so parents actually get notified (G-07)

**The finding.** The database trigger `notify_parents_on_photo` (`00012:871-926`) fires when `photos.status` transitions to `'ready'`, then loops over `photo_student_tags` to insert a notification per tagged child's parent.

But the client pipeline (`useUpload.ts:186-200`) runs:

```
uploadPhotoFile()  → backend sets status = 'ready'   ← trigger fires HERE
      ↓
tagStudents()      → tags inserted AFTER
```

**At the moment the trigger runs, the photo has zero tags.** The loop body never executes. **Parents are never notified about new photos** — the `'new_photos'` notification type can never be produced.

The sibling trigger `notify_teacher_on_upload_complete` fires correctly, which is why teachers see "Photo processed successfully" but parents see an empty list. That asymmetry is the diagnostic.

**A second, related defect (G-5.5):** `saveUploadedFile` sets `status='ready'`, then `confirmUpload` requires `status==='processing'` and throws `INVALID_STATE` otherwise (`photo.service.ts:168-174`). So upload-then-confirm always fails on the second call. Currently harmless because `teacherService.confirmUpload:80` is never called — but it is exactly the function needed here.

### The fix

Reorder to **upload → tag → confirm**, with `'ready'` set only at confirm.

**Backend — `packages/backend/src/services/photo.service.ts`:**
1. `saveUploadedFile` — Plan 03 Step 2 already left `status` as `'processing'`. Verify that is the case.
2. `confirmUpload` — rewrite:
   - Call `assertPhotoOwnership` (added in Plan 04 Step 3).
   - Require `status === 'processing'`; this now holds correctly.
   - Verify the object exists in Supabase Storage (`fileExistsInStorage`, already in `utils/supabaseStorage.ts`).
   - Set `status = 'ready'`. **This is the single write that fires both triggers.**
3. Remove the stale "no server-side thumbnail for now" comment at `:186` — Plan 03 added thumbnails.

**Mobile — `apps/mobile/src/features/teacher/hooks/useUpload.ts`:**

Change `processImage` to:
```
requesting-url → createPhotoRecord
uploading      → uploadPhotoFile      (status stays 'processing')
tagging        → tagStudents          (if any students selected)
confirming     → confirmUpload        (status → 'ready', triggers fire)
complete
```
Add a `'confirming'` value to `ImageUploadState` and a progress step for it. `teacherService.confirmUpload` already exists — just call it.

**Edge case:** if the teacher selects **no** students, still call `confirmUpload` — the photo must become `'ready'` or it will never appear in the teacher's own dashboard. It simply produces no parent notifications, which is correct.

**Failure handling:** if `tagStudents` fails after a successful upload, the photo is stranded in `'processing'`. That is acceptable and recoverable (`retryImage` re-runs the chain), and far better than a `'ready'` photo with no tags — which is invisible to parents *and* generates no notification. Note this trade-off in a code comment.

---

## Step 2 — Rewrite the feed query (G-14)

**The finding.** `feed.service.getFeed:62-99` runs two queries:

```ts
// 1. EVERY tag row for the parent's children — no limit, no pagination
const { data: allTags } = await supabaseAdmin
  .from('photo_student_tags')
  .select('photo_id, student_id')
  .in('student_id', studentIds);

// ... build photoIds from all of them ...

// 2. Pass every photo ID back in as a filter
.in('id', photoIds)
```

For a child with 2,000 tagged photos this builds a 2,000-UUID `IN` clause inside a URL. **PostgREST returns 414 URI Too Long** well before that. The parent feed does not degrade as usage grows — it stops working.

### The fix

One query, joined and paginated at the database:

```ts
supabaseAdmin
  .from('photo_student_tags')
  .select('photo_id, student_id, photos!inner(id, s3_key, thumbnail_s3_key, blurhash, width, height, status, created_at, uploaded_by, class_id)')
  .in('student_id', studentIds)
  .eq('photos.status', 'ready')
  .order('created_at', { referencedTable: 'photos', ascending: false })
  .limit(limit + 1)
```

**Three things to get right:**

1. **Deduplication.** A photo tagged with two of the parent's children returns two rows. Dedupe by `photo_id` **after** fetching. This is the bug that makes the dead `getParentFeed` wrong (see Step 3) — it computes `hasNext` from the *deduplicated* count, which truncates the feed early. Instead: fetch `limit + 1` **distinct photos** by over-fetching (e.g. `limit * 2 + 1` rows) and deduping, or track `hasNext` from the raw row count before dedup. Prefer over-fetching with a comment explaining why.

2. **Cursor pagination on a joined column.** The existing `.or()` cursor syntax against `photos.created_at` is unreliable through a join. **Verify it works against real data before relying on it.** If PostgREST rejects it, the robust fallback is a Postgres RPC:
   ```sql
   CREATE FUNCTION get_parent_feed(p_parent_id uuid, p_student_id uuid, p_cursor_ts timestamptz, p_cursor_id uuid, p_limit int)
   ```
   returning already-joined, already-deduplicated, already-paginated rows. This is cleaner, faster, and uses `idx_pst_student_id INCLUDE (photo_id)` properly. **Recommended** if the PostgREST version costs more than 30 minutes to get right.

3. **`taggedStudentIds`** must still be populated per photo, and per Plan 04 Step 1 it must contain **only this parent's children**. The joined rows give you exactly that.

**Keep the existing behaviour** for: empty `studentIds` → `{ photos: [], nextCursor: null }`; `studentId` filter narrowing to one child.

---

## Step 3 — Delete the dead duplicate feed (G-15)

`photo.service.ts:340-449` — `getParentFeed`, 110 lines, **never routed**. `feed.service.getFeed` is the live implementation.

It also contains the pagination bug described above (`:413`), so leaving it is an active trap for anyone who copies from it.

**Delete the function.** Check its imports (`env`, `AppError`) are still used elsewhere in the file before removing them.

---

## Step 4 — Remove the `getSchools` N+1 (G-34)

**The finding:** `admin.service.getSchools:230-242` runs `Promise.all` over each school, issuing **two additional count queries per school** — students and teachers. For 20 schools that is 41 queries.

**File:** `packages/backend/src/services/admin.service.ts`

**Do:** Replace with two batched queries after fetching the page:
1. `students` filtered by `.in('school_id', schoolIds)`, selecting `school_id`, counted in JS.
2. `profiles` filtered by `.in('school_id', schoolIds).eq('role','teacher')`, same.

3 queries total, independent of page size. The `classes(id, name, grade)` embed already batches correctly — leave it.

Keep the `_count` response shape exactly as is so `SchoolCard.tsx` keeps working.

---

## Step 5 — Limit upload concurrency (G-35)

**The finding:** `useUpload.startUpload:229` fires `Promise.allSettled` over **all** idle images at once. With `MAX_UPLOAD_IMAGES = 20` and a 25 MB cap, that is up to 500 MB in flight simultaneously — which stalls a phone connection and can time out every request at once.

**File:** `apps/mobile/src/features/teacher/hooks/useUpload.ts`

**Do:** Process in batches of 3. A simple sequential-batch loop is enough — no dependency needed:
```ts
const CONCURRENCY = 3;
for (let i = 0; i < idleImages.length; i += CONCURRENCY) {
  await Promise.allSettled(
    idleImages.slice(i, i + CONCURRENCY).map((img) => processImage(img, classId, studentIds)),
  );
}
```

**While in this file, also fix G-P5:** `addImages:153` returns `Math.min(assets.length, MAX_UPLOAD_IMAGES - images.length)` computed from the **stale closure value** of `images.length`, outside the `setImages` updater. Compute the count inside the updater and return it via a ref, or accept the count from the caller.

---

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm build:backend
grep -n "getParentFeed" packages/backend/src   # nothing
```

**Manual — the decisive test for Step 1:**
- [ ] As a teacher, upload one photo and tag a student whose parent you can log in as
- [ ] Photo reaches `status='ready'` (visible on the teacher dashboard)
- [ ] **Sign in as that parent → Alerts tab shows "New photo of \<child\>"**
- [ ] Teacher's own Alerts shows "Photo processed successfully"
- [ ] Upload with **no** students tagged → photo still becomes `ready`, appears on the teacher dashboard, generates no parent notification

**Manual — feed:**
- [ ] Feed loads and paginates past 20 items with no duplicates and no missing photos
- [ ] A photo tagged with two of the parent's children appears **once**
- [ ] Switching child filters correctly
- [ ] `taggedStudentIds` contains only the requesting parent's children

**Manual — perf:**
- [ ] Upload 10 photos at once → at most 3 in flight; all complete
- [ ] Admin schools list still shows correct class/student/teacher counts

**Load sanity for Step 2** — insert ~500 tag rows for one student in a scratch DB and confirm the feed still responds. This is the specific failure the rewrite prevents; verifying it is worth 10 minutes and gives Plan 11 a real before/after.

---

## Commit sequence

```
fix(upload): tag students before marking a photo ready so parents are notified
fix(photos): restore the confirm step to the upload pipeline
perf(feed): replace unbounded tag fetch with a single paginated join
refactor(photos): remove the dead duplicate parent feed implementation
perf(admin): batch school student and teacher counts
perf(upload): limit concurrent uploads to three
fix(upload): compute added image count from current state
```

---

## Done when

- [ ] A parent receives a notification when their child's photo is uploaded
- [ ] Feed paginates correctly with no duplicates
- [ ] Feed still responds with 500+ tags on one student
- [ ] `getParentFeed` deleted
- [ ] Admin schools list issues 3 queries, not 2N+1
- [ ] Uploads run 3 at a time
- [ ] Typecheck, lint, build pass
- [ ] Merged into `develop`

---

## Deviations

*Record here anything that differed from this plan, and why.*
