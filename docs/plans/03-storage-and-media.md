# Plan 03 — Storage & Media Pipeline

**Branch:** `security/private-photo-storage`
**Size:** L (~1 day) — **the longest pole in the project**
**Depends on:** Plan 01
**Closes:** G-02, G-12, G-13, G-24, G-42

---

## Goal

Fix the project's most severe security finding and its worst performance problem — which happen to share one solution.

**Today:** every child's photo is a permanent, unauthenticated, publicly reachable URL, served at full resolution (up to 25 MB) directly through the Node process from a local disk that is wiped on every deploy.

**After this plan:** photos live in a private Supabase Storage bucket, are served only via short-lived signed URLs to authorised users, and the feed loads 400 px thumbnails instead of originals.

---

## The three findings

**G-02 — Photos are public.** `app.ts:60` mounts `express.static` on `/uploads` with **no authentication middleware**. Independently, the Supabase bucket is created `public: true` (`00015:1104`) with an explicit `TO public` SELECT policy (`:1129`). The README's claim of "signed URLs and role-based access control" is not true of the running code.

**G-12 — No thumbnails exist.** A repo-wide grep for `.add(` finds only `Set.add`. **Neither BullMQ queue is ever enqueued.** So `thumbnail_s3_key`, `blurhash`, `width` and `height` are permanently `null`, `parentService.ts:90` maps `thumbnailUri: null`, and `feed.tsx:113` falls back to the full-resolution original. A 20-photo feed page can transfer hundreds of megabytes.

The worker could not succeed even if enqueued — it downloads from **S3** (`imageProcessor.job.ts:33`) while files are written to **local disk** (`photo.service.ts:140`), and it updates a `content_type` column that does not exist (the column is `mime_type`).

**G-24 — Three storage strategies coexist.** Local disk (used), S3 presigned (`utils/signedUrl.ts`, never imported), and Supabase Storage (`utils/supabaseStorage.ts`, never imported). `requestUpload`'s comments say "Supabase Storage" while the file is written to disk by a different function, and the column is named `s3_key` but holds a local relative path.

---

## Prerequisites

```bash
git checkout main && git pull
git checkout -b security/private-photo-storage main
```

Confirm the `photos` bucket exists in the Supabase dashboard (created by `00015`).

---

## Step 1 — Make the bucket private

**New migration:** `supabase/migrations/00020_photos_bucket_private.sql`

**Do:**
1. `UPDATE storage.buckets SET public = false WHERE id = 'photos';`
2. `DROP POLICY IF EXISTS "photos_public_read" ON storage.objects;`
3. Keep the authenticated upload/update policies, but tighten them — currently `WITH CHECK (bucket_id = 'photos')` lets **any** authenticated user (including any parent) write anywhere in the bucket. Restrict inserts to the `service_role`, since all uploads now go through the backend:
   ```sql
   DROP POLICY IF EXISTS "photos_authenticated_upload" ON storage.objects;
   DROP POLICY IF EXISTS "photos_authenticated_update" ON storage.objects;
   ```
   The backend uses the service-role key, which bypasses storage RLS — so no replacement policy is needed for it to work.
4. Prefix every `CREATE POLICY` with `DROP POLICY IF EXISTS` (idempotency, matching Plan 02 Step 10).

---

## Step 2 — Rewrite the upload to use Supabase Storage

**File:** `packages/backend/src/services/photo.service.ts`

`saveUploadedFile(photoId, tempFilePath)` currently: reads the photo row → `fs.mkdirSync` → `fs.renameSync` into `uploads/` → sets `status='ready'`.

**Replace with:**
1. Read the photo row (`s3_key`, `status`, `school_id`, `uploaded_by`, `mime_type`).
2. Read the temp file into a Buffer.
3. **Validate magic bytes** (G-40) — run `sharp(buffer).metadata()`. If it throws, or the detected format isn't jpeg/png/heif, delete the temp file and throw a 400 `AppError`. This replaces trusting the client-supplied MIME in `middleware/upload.ts:26`.
4. Process with `sharp` — see Step 3.
5. Upload the original via `supabaseAdmin.storage.from('photos').upload(key, buffer, { contentType, upsert: true })`.
6. Upload the thumbnail to `{keyWithoutExt}_thumb.jpg`.
7. Update the photo row with `thumbnail_s3_key`, `blurhash`, `width`, `height`, `mime_type`, and `processed_at`.
8. **Do not set `status='ready'` here** — Plan 05 moves that to the confirm step so tagging happens first. Leave it as `'processing'`.
9. `fs.unlinkSync` the temp file in a `finally` block so failures don't leak files (G-I11).

**Keep multer's disk storage** — streaming a 25 MB upload to disk then reading it is gentler on memory than `memoryStorage`, and the temp file is deleted immediately.

**Rename the column concept, not the column.** `photos.s3_key` now holds a Supabase Storage object path. Renaming the column would touch six files for no functional gain. Instead update `COMMENT ON COLUMN photos.s3_key` in migration `00020` to say *"Object path in the Supabase Storage `photos` bucket"*, and note it in Plan 10's database doc.

---

## Step 3 — Generate thumbnail, blurhash and dimensions synchronously (G-12, G-42, DEC-2)

In the same request, after magic-byte validation:

1. **HEIC → JPEG (G-42):** if `metadata.format` is `heif`/`heic`, convert with `.jpeg({ quality: 90 })`, change the storage key extension to `.jpg`, and set `mime_type = 'image/jpeg'`. Android cannot render HEIC, so this is a correctness fix, not an optimisation.
2. **Dimensions:** take `width` and `height` from the processed metadata.
3. **Thumbnail:** `.resize(400, null, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 })`.
4. **Blurhash:** resize to 32×32, `.ensureAlpha().raw()`, then `encode(pixels, 32, 32, 4, 3)` from the `blurhash` package.

Reuse the logic from `jobs/imageProcessor.job.ts:94-165` — it is correct; it was simply never reachable. **Do not copy its two bugs**: it writes `content_type` (must be `mime_type`) and it reads from S3.

**Expected cost:** ~100–300 ms for a typical phone photo — imperceptible against the upload itself.

> If `sharp` fails to install on your platform, that is the one thing that could force BullMQ back. Verify `pnpm --filter @hive/backend exec node -e "require('sharp')"` works **before** starting this step.

---

## Step 4 — Serve signed URLs

**Files:** `packages/backend/src/utils/supabaseStorage.ts`, `services/feed.service.ts`, `services/photo.service.ts`

**Do:**
1. In `supabaseStorage.ts`, replace `getSupabasePhotoPublicUrl` with:
   ```ts
   export async function getSignedPhotoUrl(path: string, expiresIn = 3600): Promise<string | null>
   ```
   wrapping `supabaseAdmin.storage.from('photos').createSignedUrl(path, expiresIn)`.
2. Add a batch helper using `createSignedUrls(paths, expiresIn)` — the feed signs up to 40 URLs per page (original + thumbnail × 20), and one round trip beats forty.
3. Replace all four URL builders:

| File | Line | Currently |
|---|---|---|
| `feed.service.ts` | ~128 | `` `${origin}/uploads/${photo.s3_key}` `` |
| `feed.service.ts` | ~177 | same, in `getPhotoDetails` |
| `photo.service.ts` | ~321 | same, in `getPhotosByClass` |
| `photo.service.ts` | ~418 | same, in the dead `getParentFeed` — **delete that function instead** (G-15) |

4. The `baseUrl` / `origin` parameter threaded through these functions becomes unused. Remove it from the signatures and from the three controllers that compute `${req.protocol}://${req.get('host')}`.
5. **Signed URLs expire.** The mobile client caches feed pages for 5 minutes (`STALE_TIME_MS`) and images via `expo-image`. A 1-hour expiry comfortably covers this. Note it in Plan 10's architecture doc.

---

## Step 5 — Remove the public static route (G-02)

**File:** `packages/backend/src/app.ts`

Delete:
```ts
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
```
and the now-unused `import path from 'path'`.

**This single line is the most severe security finding in the project.** Do it in its own commit so it is unmistakable in the history.

Also delete `packages/backend/uploads/` from the working tree and remove the two `.gitignore` entries for it.

---

## Step 6 — Delete the dead subsystems (G-13, G-24, DEC-2)

**Delete these files:**
```
packages/backend/src/jobs/imageProcessor.job.ts
packages/backend/src/jobs/notificationSender.job.ts
packages/backend/src/config/s3.ts
packages/backend/src/utils/signedUrl.ts
```

**Edit `packages/backend/src/index.ts`:** remove the two worker imports, the two `start*Worker()` calls, and their `close()` calls in `shutdown`.

**Keep** `config/redis.ts` and `middleware/idempotency.ts` — per **DEC-3**, Redis stays for idempotency, which Plan 02's order flow depends on. Remove only the `redisConnection` export if nothing else uses it.

**Edit `packages/backend/package.json`:** remove `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `bullmq`. Keep `sharp`, `blurhash`, `ioredis`.

**Edit `packages/backend/src/config/env.ts`:** remove `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` from the schema (Plan 01 already removed them from `.env.example`).

Then `pnpm install` to refresh the lockfile.

---

## Step 7 — Clean up `requestUpload`

**File:** `packages/backend/src/services/photo.service.ts`

`requestUpload` returns `{ photoId, uploadUrl: '', s3Key }` — `uploadUrl` has been a meaningless empty string since the S3 flow was abandoned.

**Do:**
1. Drop `uploadUrl` from the `UploadResult` interface and the return.
2. Update `UploadUrlResponse` in `apps/mobile/src/features/teacher/services/teacherService.ts` to match, and remove the unused destructure in `useUpload.ts:173`.
3. Fix the misleading comments at `:80` and `:107` — they say "Supabase Storage" for a step that only creates a DB row.
4. Rename `requestUpload` → `createPhotoRecord` and the route `POST /photos/upload-url` → `POST /photos`. **Optional** — it improves clarity but touches the mobile service too. Skip if time is short; note it in Deviations.

---

## Verification

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm build:backend
grep -rn "express.static\|/uploads" packages/backend/src     # nothing
grep -rn "s3Client\|getSignedUrl\|bullmq\|imageProcessingQueue" packages/backend/src   # nothing
ls packages/backend/src/jobs 2>/dev/null                     # no such directory
```

**Database:**
```sql
SELECT id, public FROM storage.buckets WHERE id = 'photos';   -- public = false
SELECT policyname FROM pg_policies WHERE tablename = 'objects';
```

**Manual — the decisive checks:**
- [ ] Teacher uploads a photo; it completes without error
- [ ] In Supabase Dashboard → Storage → photos, **both** the original and `_thumb.jpg` exist
- [ ] `photos` row now has non-null `thumbnail_s3_key`, `blurhash`, `width`, `height`
- [ ] Parent feed loads and images appear
- [ ] **Copy a photo URL from the network tab, open it in a private browser window → it works** (signed URL, still valid)
- [ ] **Wait for expiry, or strip the `?token=` query → it returns 400/403**, not the image
- [ ] `curl https://<backend>/uploads/photos/<anything>` → **404**, not an image
- [ ] Upload a HEIC file → stored as `.jpg`, renders on Android
- [ ] Upload a `.txt` renamed to `.jpg` → rejected with 400
- [ ] Feed page network transfer is now **hundreds of KB, not hundreds of MB** — record the before/after for Plan 11

---

## Commit sequence

```
security(storage): make the photos bucket private and remove public read
feat(storage): upload photos to Supabase Storage instead of local disk
feat(photos): generate thumbnails, blurhash and dimensions during upload
feat(photos): convert HEIC uploads to JPEG for cross-platform rendering
security(photos): validate image magic bytes instead of trusting client MIME
feat(photos): serve photos through short-lived signed URLs
security(api): remove the unauthenticated static uploads route
chore(deps): delete unreachable BullMQ workers and unused S3 client
refactor(photos): remove the vestigial empty uploadUrl from the upload contract
```

---

## Rollback

If Supabase Storage proves unworkable mid-plan, the fallback that still fixes the **security** half:

1. Keep local disk and `saveUploadedFile` as it was.
2. Replace `express.static` with an authenticated route: `GET /api/v1/photos/:id/file` → `authenticate` → ownership check → `res.sendFile`.
3. Still generate thumbnails with `sharp` to disk (Step 3 is independent of storage backend).

This leaves files ephemeral on deploy (G-I4) and blocks horizontal scaling (G-I5), but closes G-02 and G-12. Record the decision in Deviations and in Plan 10's limitations section.

---

## Done when

- [ ] Bucket is private; `/uploads` returns 404
- [ ] Photos and thumbnails both land in Supabase Storage
- [ ] Feed renders thumbnails via signed URLs
- [ ] An unsigned URL is rejected
- [ ] `jobs/`, `config/s3.ts`, `utils/signedUrl.ts` deleted; deps removed
- [ ] Before/after payload sizes recorded for Plan 11
- [ ] Typecheck, lint, build pass
- [ ] Merged into `main`

---

## Deviations

### Completed by Ruthwik, W15 (11–14 May)

**Absorbed Plan 05's Step 1 (backend half).** The plan left `status='ready'` in
`saveUploadedFile` and deferred the tag-before-ready fix to Plan 05. That is not
separable — rewriting the upload path and then returning to the same function a
week later to move one line means touching it twice. `saveUploadedFile` now
leaves the photo in `processing`; `confirmUpload` performs the transition.
**Plan 05 Step 1's backend half is therefore already done.**

**Extracted `utils/imageProcessor.ts`** rather than inlining the sharp pipeline
in the service, because Plan 06's seed script needs byte-identical processing.
Srujan can import `processAndUploadPhoto(buffer, storagePath, mimeType)`.

**Step 7 rename skipped.** `requestUpload` → `createPhotoRecord` and the route
rename were listed as optional. Dropped — it touches the mobile service for no
functional gain. The vestigial `uploadUrl: ''` was removed as planned.

**`sharp` verified before starting:** loads with libvips 8.15.3. The Rollback
section was not needed.

**Sharp format check corrected.** The plan says to test `format === 'heif' ||
format === 'heic'`. Sharp's type union contains only `heif` — HEIC containers
report as `heif`, and comparing against `'heic'` is a compile error.

### Not verified — no `.env` exists

None of this has been exercised at runtime. Outstanding:

- Migration `00020` has **not been applied** to Supabase
- No photo has been uploaded to the private bucket
- No signed URL has been resolved, and no expired/unsigned URL rejected
- HEIC conversion untested
- Feed thumbnail rendering untested

Everything below the line in Verification is still open. Whoever creates the
first working `.env` (Plan 09) should run it.

### Superseded — the above ran on 24 July 2026 (Ruthwik)

Migration `00020` is applied, photos are in the private bucket, an unsigned URL
returns 400 and a signed one 200, and the feed serves 16 KB thumbnails against
211 KB originals. The one item that did **not** come out as written is HEIC.

### HEIC conversion does not work, and cannot on the prebuilt `sharp`

Tested against a genuine HEVC-coded HEIC — the format an iPhone produces — on
24 July 2026. The upload is rejected:

```
POST /api/v1/photos/:id/file   → 400 INVALID_IMAGE
heif: Error while loading plugin: No decoding plugin installed
for this compression format (11.6003)
```

**Why.** `sharp` 0.33.5 ships a prebuilt libvips whose libheif has the AV1 codec
and no HEVC codec. `sharp.format.heif.input.fileSuffix` is `['.avif']`, and
`heif({compression:'hevc'})` fails with `Unsupported compression`. libheif still
*parses* the container, so `sharp(buffer).metadata()` succeeds and reports
`format: 'heif'` — the failure only appears when the pixels are decoded. That is
why the branch looked correct in review: the guard it depends on passes.

An AVIF, which shares the HEIF container and also reports `format: 'heif'`, does
convert correctly — verified end to end: stored as `.jpg`, `mime_type`
`image/jpeg`, thumbnail, blurhash and dimensions all written. So the branch works;
it just cannot reach the format it was written for.

**What was done about it.**

1. **Device-side, which is the real fix.** `(teacher)/upload.tsx` now passes
   `preferredAssetRepresentationMode: Compatible`, so iOS transcodes to JPEG in
   the picker and no HEIC leaves the phone. Costs nothing and needs no new
   dependency.
2. **Server-side, as a backstop.** The conversion is wrapped, and a failure now
   returns "This photo is in a format the server cannot read (HEIC). Please
   re-save it as JPEG and try again." It previously leaked the raw libvips text
   — `bad seek to 80687` — straight to the client.

**What would fix it properly.** A libvips built against libheif with `libde265`,
which means building `sharp` from source (`--build-from-source` with
`libheif-dev`/`libde265-dev` present) rather than using the prebuilt binary. That
is a deployment decision, not a code one: it lands in the Dockerfile, adds build
time to every deploy, and brings HEVC patent licensing into scope. Not taken
unilaterally — flagged for whoever owns the deploy.
