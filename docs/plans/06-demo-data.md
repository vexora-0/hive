# Plan 06 — Demo Data & Seeding

**Branch:** `feat/demo-seed`
**Size:** M (~4–5 hours)
**Depends on:** Plan 02 (product CHECK), Plan 03 (storage), Plan 05 (upload ordering)
**Closes:** G-11

---

## Goal

Produce a realistic demo dataset with **one command**. Right now there is no working path to demo data at all.

---

## The finding

`supabase/seed.sql` (403 lines) inserts `profiles` rows directly:

```sql
INSERT INTO profiles (id, email, full_name, role, school_id) VALUES
    ('aa000000-0000-4000-8000-000000000001', 'admin@hive.app', ...);
```

But `profiles.id` is `PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE` (`00003:39`). Those `auth.users` rows do not exist, so **every insert fails with a foreign-key violation.** The file's own header admits this:

> *"In a real environment these IDs must match auth.users entries... If running against a live Supabase instance, create the auth users first, then update these IDs."*

`auth.users` cannot be populated with plain SQL — Supabase Auth owns password hashing, identity records, and confirmation state. It must go through the Admin API.

**Consequence:** there is no demo data, so nothing downstream can be meaningfully tested or demonstrated.

---

## Approach

Replace `seed.sql` with a TypeScript script that uses `supabase.auth.admin.createUser` for identities, then inserts domain rows, then uploads real photos through the same storage path the app uses.

**Why TypeScript rather than SQL:** it is the only way to create auth users, it can upload files to Storage, it can call the real service functions, and it is idempotent by construction. `scripts/seedAdmin.ts` already proves the pattern works.

---

## Prerequisites

```bash
git checkout develop && git pull
git checkout -b feat/demo-seed develop
```

You need `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `packages/backend/.env`, plus `ADMIN_EMAIL`/`ADMIN_PASSWORD` from Plan 01 Step 4.

---

## Step 1 — Prepare demo photos

**New directory:** `packages/backend/src/scripts/seed-assets/`

Add **12–15 real JPEG images** suitable for a preschool context — classroom activities, art, outdoor play. Sources: Unsplash or Pexels (both permit this use; record the licence in a `CREDITS.md` alongside them).

**Requirements:**
- Real photographs, **not** lorem-ipsum placeholders or solid colours. An evaluator notices.
- Mixed portrait and landscape so `MasonryGrid` shows varied aspect ratios.
- Resize to ~1600 px on the long edge before committing — you do not need 5 MB originals in git.
- **No identifiable real children.** Prefer activity/scene shots, or clearly stock imagery. Note this choice in Plan 10's limitations section; it is the right call for a child-privacy product and worth saying so.

Add a `.gitattributes` entry if the repo starts feeling heavy, but ~15 resized JPEGs is fine.

---

## Step 2 — Write the seed script

**New file:** `packages/backend/src/scripts/seedDemo.ts`

### Dataset to create

| Entity | Count | Notes |
|---|---|---|
| Schools | 2 | Bloom Preschool (Bangalore), Little Stars Academy (Mumbai) — reuse the names from `seed.sql` |
| Classes | 4 | 2 per school |
| Admin | 1 | platform admin, `school_id = null` |
| Teachers | 3 | 2 at Bloom, 1 at Little Stars |
| Parents | 4 | 3 at Bloom, 1 at Little Stars |
| Students | 12 | 3 per class |
| Parent↔student links | 6 | includes **one parent with two children** (exercises `ChildSwitcher`) and **one child with two parents** (exercises the M:N mapping) |
| Photos | 15 | uploaded to Storage with real thumbnails |
| Photo tags | ~30 | 1–3 students per photo; **at least one photo tagged with two children of the same parent** (exercises feed dedup) |
| Orders | 3 | one per status: `pending`, `confirmed`, `shipped` |
| Order items | ~6 | mixed product types from the Plan 02 catalogue |
| Notifications | — | **do not insert directly** — let the triggers produce them |

### Structure

```
1. Parse args (--reset)
2. If --reset: delete domain rows and auth users in FK-safe order
3. Create auth users via supabase.auth.admin.createUser
   → the handle_new_user trigger creates a `profiles` row with role from user_metadata
4. Update profiles: set role (admin) and school_id (trigger can't know these)
5. Insert schools, classes, students, parent_student_mappings
6. For each photo:
     a. read the JPEG from seed-assets
     b. create the photo row     (status = 'processing')
     c. process with sharp + upload original and thumbnail to Storage
     d. insert photo_student_tags
     e. update status = 'ready'  ← LAST, so triggers fire with tags present
7. Insert orders via the create_order_with_items RPC (Plan 02 Step 8)
8. Print a summary and the demo credentials
```

### Critical ordering constraint

**Step 6e must come after 6d.** This is the same defect Plan 05 fixed in the app. If the seed sets `status='ready'` before tagging, `notify_parents_on_photo` loops over zero tags and **your demo has no parent notifications** — which is exactly what you most want to show.

Reuse the real processing code rather than duplicating it. Extract the sharp pipeline from `photo.service.ts` (Plan 03 Step 3) into an exported helper, e.g. `processAndUploadPhoto(buffer, key, mimeType)`, and call it from both the service and the seed. One implementation, guaranteed consistent.

### Idempotency

Look up each user by email first; skip if present. Use fixed UUIDs for schools, classes and students so re-running does not duplicate them — the existing `seed.sql` UUIDs (`a0000000-…`, `b0000000-…`) are fine to reuse.

Auth user IDs **cannot** be fixed — Supabase assigns them. So resolve profile IDs by email lookup after creation, and key `parent_student_mappings` off those.

### Credentials

All demo users get **password auth** (not OTP) so a demo never depends on email delivery:

| Role | Email | Password |
|---|---|---|
| Admin | from `ADMIN_EMAIL` | from `ADMIN_PASSWORD` |
| Teacher | `teacher.sarita@bloom.demo` | from `DEMO_PASSWORD` |
| Parent | `parent.rajesh@bloom.demo` | from `DEMO_PASSWORD` |

Read `DEMO_PASSWORD` from env with **no default** (Plan 01 Step 4 precedent). Use `.demo` domains so nobody mistakes them for real addresses.

> The app's parent/teacher login uses OTP. Password login exists (`authService.signInWithPassword`) but is only wired to the admin path. **Decide now:** either expose a password field for all roles on the login screen (Plan 07 can add it), or demo teacher/parent via OTP and keep password login for admin only. Recommended: expose it — an OTP dependency during a live demo is a real risk, and `signInWithPassword` already exists. Record the decision here.

---

## Step 3 — Wire up the script

**`packages/backend/package.json`** — add:
```json
"seed:demo": "tsx src/scripts/seedDemo.ts",
"seed:demo:reset": "tsx src/scripts/seedDemo.ts --reset"
```

**Root `package.json`** — add a passthrough:
```json
"seed": "pnpm --filter @hive/backend seed:demo"
```

---

## Step 4 — Retire `seed.sql`

Do **not** silently delete it — it documents intent and someone may look for it.

**Do:** Replace its contents with a short pointer explaining that direct `profiles` inserts cannot work because `profiles.id` references `auth.users`, and that `pnpm seed` is the supported path. Keep it under 20 lines.

---

## Step 5 — Write `DEMO_USERS.md`

**New file:** `docs/DEMO_USERS.md`

The reference report (`report.md`) shows this course expects one — SkillSwap shipped a `DEMO_USERS.md` with a single account that walks the whole app.

Include:
1. **A credentials table** — every demo account, role, school.
2. **A recommended demo path** — which account to use for which part:
   - `teacher.sarita@bloom.demo` → upload + tagging flow
   - `parent.rajesh@bloom.demo` → **two children**, so the child switcher is meaningful; has photos, notifications, and order history
   - admin → dashboard with non-zero stats, schools, users, class detail
3. **What each account already has**, so nothing surprises you live.
4. **Reset instructions** — `pnpm seed:demo:reset`.

---

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm build:backend
pnpm seed          # first run
pnpm seed          # second run — must be idempotent, no duplicates, no errors
```

**Database:**
```sql
SELECT role, count(*) FROM profiles GROUP BY role;          -- 1 admin, 3 teacher, 4 parent
SELECT count(*) FROM students;                              -- 12
SELECT count(*) FROM photos WHERE status = 'ready';         -- 15
SELECT count(*) FROM photos WHERE thumbnail_s3_key IS NULL; -- 0
SELECT count(*) FROM photo_student_tags;                    -- ~30
SELECT count(*) FROM orders;                                -- 3
SELECT type, count(*) FROM notifications GROUP BY type;     -- new_photos AND upload_complete both present
```

That last query is the important one. **If `new_photos` is zero, step 6e ran before 6d** — fix the ordering.

**Storage:** the dashboard shows 30 objects in `photos` (15 originals + 15 thumbnails).

**Manual:**
- [ ] Sign in as the demo parent → feed shows photos, child switcher shows **two** children
- [ ] Switching child changes the feed
- [ ] Alerts tab shows "New photo of …" notifications
- [ ] Orders tab shows 3 orders with sensible prices
- [ ] Sign in as the demo teacher → dashboard shows photos in their classes
- [ ] Sign in as admin → dashboard shows 2 schools, 8 users, 15 photos, 3 orders, non-zero revenue
- [ ] Every image loads (no broken thumbnails)

---

## Commit sequence

```
feat(seed): add demo photo assets with licence credits
feat(seed): add idempotent demo data seeding script
refactor(photos): extract image processing helper shared by service and seed
chore(seed): replace unusable seed.sql with a pointer to the seed script
docs(seed): document demo accounts and the recommended demo path
```

---

## Done when

- [ ] `pnpm seed` populates a fresh database end-to-end
- [ ] Running it twice is safe
- [ ] Both notification types exist in the database
- [ ] All three roles have a rich, demo-ready experience
- [ ] `DEMO_USERS.md` written and verified against the real data
- [ ] Merged into `develop`

---

## Deviations

*Record here anything that differed from this plan, and why.*
