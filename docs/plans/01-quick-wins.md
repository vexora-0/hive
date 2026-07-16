# Plan 01 — Quick Wins & Credential Hygiene

**Branch:** `fix/quick-wins`
**Size:** S (~3–4 hours)
**Depends on:** nothing
**Closes:** G-03, G-06, G-09, G-10, G-16, G-20, G-25, G-45

---

## Goal

Remove the most visible signs of an unfinished project and the one committed credential, at the lowest possible cost. Every task here is independent, small, and carries no risk of breaking anything else.

The headline item is **G-03**: three screens say "Coming Soon" while ~700 lines of finished notification code sits in the repo with zero imports. Fixing that is a file-swap, not development.

---

## Prerequisites

```bash
pnpm install
git checkout -b fix/quick-wins main
```

---

## Step 1 — Wire the notification screens (G-03)

**The finding:** `NotificationCenter.tsx` (209 lines), `NotificationCard.tsx` (282 lines), `useNotifications.ts` (199 lines) and `notificationService.ts` are complete and working. A repo-wide grep shows **zero imports of any of them**. Meanwhile all three notification screens render a `EmptyState` reading "Coming Soon".

**Files:**
- `apps/mobile/src/app/(parent)/notifications.tsx`
- `apps/mobile/src/app/(teacher)/notifications.tsx`
- `apps/mobile/src/app/(admin)/notifications.tsx`

**Do:**
1. Open `apps/mobile/src/features/notifications/components/NotificationCenter.tsx`. Confirm its props and default export.
2. In each of the three screens, replace the `<EmptyState title="Coming Soon" ... />` body with `<NotificationCenter />`, keeping the existing `ScreenContainer` + `HeaderBar` wrapper.
3. Confirm `useNotifications.ts` calls the right endpoints — the backend routes are `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, and all three exist and work.
4. If `NotificationCenter` needs props (e.g. a role filter), pass what each screen needs. Do **not** add new backend endpoints — the API is complete.

**Expected result:** all three screens show a real, scrollable, pull-to-refresh notification list with empty and loading states.

> **Note:** parents will see an empty list until Plan 05 fixes the tag-before-ready ordering (G-07). Teachers will already see "Photo processed successfully" notifications, because `notify_teacher_on_upload_complete` fires correctly today. That asymmetry is expected at this stage and is not a bug in this plan.

---

## Step 2 — Fix the admin dashboard statistics (G-06)

**The finding:** `admin.service.ts:61-63` runs `.from('orders').select('id, total')`. The column is `total_amount` (`00009:228`). PostgREST errors, `data` is `null`, the error is never checked, and both `totalOrders` and `totalRevenue` silently fall back to `0`. **The admin dashboard always shows 0 orders and $0 revenue.**

**File:** `packages/backend/src/services/admin.service.ts`

**Do:**
1. In `getDashboardStats`, change the orders query to fetch a count and a sum properly:
   - For the count, use `.select('id', { count: 'exact', head: true })` like the other three stats do.
   - For revenue, select `total_amount` (not `total`).
2. **Check the error on every one of the four queries.** Currently none are checked. Throw an `AppError` if any fails, rather than returning silent zeros — a visibly failing dashboard is better than a silently wrong one.
3. Leave the return shape (`totalSchools`, `totalUsers`, `totalPhotos`, `totalOrders`, `totalRevenue`) unchanged so the mobile `StatCard`s keep working.

> Plan 02 renames `total_amount` to cents. When it does, revisit the revenue formatting on the admin dashboard.

---

## Step 3 — Remove the `school_admin` role (G-09, DEC-7)

**The finding:** `profiles.role` has `CHECK (role IN ('teacher','parent','admin'))` (`00003:42`). But `school_admin` is referenced in six places. Two consequences: the admin UI offers a role the database will reject, and **a real `admin` cannot upload a photo** because the photo routes guard on `('teacher','school_admin')`.

**Files and edits:**

| File | Change |
|---|---|
| `packages/backend/src/routes/photo.routes.ts` | 5 × `roleGuard('teacher', 'school_admin')` → `roleGuard('teacher', 'admin')` |
| `packages/backend/src/validators/admin.validator.ts` | `updateUserRoleSchema` enum → `['parent','teacher','admin']` |
| `packages/backend/src/services/order.service.ts` | `notifyAdminsOfNewOrder` — `.eq('role','school_admin')` → `.eq('role','admin')` |
| `apps/mobile/src/features/admin/components/UserEditSheet.tsx` | Remove `school_admin` from the role options if present |
| `apps/mobile/src/types/supabase.ts` | Remove `school_admin` from the `UserRole` union if present |

**Verify:** `grep -rn "school_admin" packages apps supabase` returns **zero** results.

> `notifyAdminsOfNewOrder` filters by `school_id` too. Platform admins have `school_id = null` (see `seedAdmin.ts`), so this notification still won't fire for them. That's acceptable for now — Plan 06's seed will create school-scoped admins.

---

## Step 4 — Remove hardcoded admin credentials (G-10)

**The finding:** `scripts/seedAdmin.ts:24-25` hardcodes `admin@hive.app` / `Admin@123`, and prints the password to stdout at line 95.

**File:** `packages/backend/src/scripts/seedAdmin.ts`

**Do:**
1. Replace the two constants with `process.env.ADMIN_EMAIL` and `process.env.ADMIN_PASSWORD`.
2. Exit with a clear error if either is unset — do not fall back to a default.
3. Delete the `console.log` that prints the password (line ~95). Log the email only.
4. Add `ADMIN_EMAIL` and `ADMIN_PASSWORD` to `packages/backend/.env.example` with placeholder values.

---

## Step 5 — Sanitise the admin user search (G-16)

**The finding:** `admin.service.getUsers:94-98` interpolates raw user input into a PostgREST `.or()` filter:
```ts
query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
```
`or()` takes a comma-separated filter DSL. A search containing `,`, `(`, `)` or `.` escapes the intended expression and injects a new filter clause.

**File:** `packages/backend/src/services/admin.service.ts`

**Do:** Strip or reject the DSL metacharacters before interpolation. Simplest safe version:
```ts
const safe = search.replace(/[,()\\.*%]/g, '').trim();
if (safe) query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
```
The Zod schema already caps length at 100, so no extra length check is needed.

---

## Step 6 — Restrict trusted proxies (G-20)

**The finding:** `app.ts:20` sets `app.set('trust proxy', true)`, which trusts *every* hop. `req.ip` then comes from a client-controlled `X-Forwarded-For`, and the rate limiter keys on `req.ip` — so rotating that header gives unlimited requests.

**File:** `packages/backend/src/app.ts`

**Do:** Change to `app.set('trust proxy', 1)` — trust exactly one proxy hop, which matches Render/ngrok. Keep the explanatory comment, updated.

---

## Step 7 — Fix the environment examples (G-25)

**The findings:** `packages/backend/.env.example` says `PORT=3000` but `config/env.ts:6` defaults to `4000` and `BACKEND_URL` defaults to `:4000`. Mobile's example points at `:3000`. `BACKEND_URL` is missing from the example entirely. AWS variables are documented but unused.

**Files:** `packages/backend/.env.example`, `apps/mobile/.env.example`

**Do:**
1. Backend: set `PORT=4000`; add `BACKEND_URL=http://localhost:4000`; add `ADMIN_EMAIL` / `ADMIN_PASSWORD` from Step 4; **delete** `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` (Plan 03 removes the code that reads them).
2. Mobile: `EXPO_PUBLIC_API_URL=http://localhost:4000`.
3. Add a comment above `SUPABASE_SERVICE_KEY` warning that it bypasses RLS and must never reach the client.

> Do **not** remove the AWS keys from `config/env.ts` yet — Plan 03 deletes `config/s3.ts`, and removing the schema entries first would break the build. The example file is documentation; the schema entries are optional with defaults, so they're harmless until then.

---

## Step 8 — Configure OTP email delivery (G-45)

**The finding:** Supabase's default SMTP is rate-limited to a handful of emails per hour. During a live demo with an evaluator, **OTP emails will silently stop arriving**. This is a demo-day failure with no code fix.

**This is a dashboard task, not a code task.**

**Do:**
1. Create a free [Resend](https://resend.com) account.
2. Supabase Dashboard → Project Settings → Authentication → SMTP Settings → enable custom SMTP, enter the Resend credentials.
3. Set a sender name and address.
4. **Test it:** trigger a real OTP from the app and confirm delivery within 30 seconds.
5. Record the setup steps in `docs/deployment.md` (create the file as a stub; Plan 10 fills it out).

---

## Verification

```bash
pnpm typecheck          # must pass
pnpm lint               # no new warnings
pnpm build:backend      # must succeed
grep -rn "school_admin" packages apps supabase   # must return nothing
grep -rn "Admin@123" packages                    # must return nothing
```

**Manual checks — run the app:**
- [ ] Parent → Alerts tab shows a real list (may be empty), **not** "Coming Soon"
- [ ] Teacher → Alerts tab shows notifications, likely including "Photo processed successfully"
- [ ] Admin → Alerts tab shows a real list
- [ ] Admin dashboard shows correct counts for schools, users, and photos
- [ ] Admin dashboard shows 0 orders / $0 revenue **only because no orders exist yet** (Plan 02 fixes order creation; confirm the query no longer errors by checking backend logs for a Supabase error)
- [ ] Admin user search with a normal string works
- [ ] Admin user search for `a,role.eq.admin` returns normal results, not an altered set
- [ ] `pnpm seed:admin` fails cleanly when `ADMIN_EMAIL` is unset

---

## Commit sequence

```
feat(notifications): wire notification centre into all three role screens
fix(admin): correct dashboard revenue column and surface query errors
refactor(rbac): remove unsupported school_admin role across API and app
security(scripts): move admin seed credentials to environment variables
security(admin): sanitise user search to prevent PostgREST filter injection
security(api): trust a single proxy hop to prevent rate limit bypass
chore(config): correct environment examples and document required variables
```

Step 8 has no commit — it is a dashboard change. Note it in the PR description.

---

## Done when

- [ ] All seven commits are on `fix/quick-wins`
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build:backend` all pass
- [ ] Zero occurrences of `school_admin` or `Admin@123` in the repo
- [ ] No screen in the app reads "Coming Soon"
- [ ] A real OTP email arrives within 30 seconds
- [ ] Merged into `main`
- [ ] `docs/plans/00-INDEX.md` progress tracker updated

---

## Deviations

**Steps 1, 3, 4 and 5 were done, by Nagachaitanya.** Plan 01 is eight
independent tasks split across the team (`PHASE-2-EXECUTION-PLAN.md` §4):
Step 2 is Srujan's, Steps 6 and 7 Ruthwik's. Step 8 is a Supabase dashboard
task requiring account access.

**Step 4 was picked up late and was not assigned to anyone.** The W14 row
allocates Steps 1/3/5 here, Step 2 to Srujan and Steps 6/7 to Ruthwik, leaving
Step 4 unowned. It was taken on in W22 for two reasons: it is an admin
credential, which falls under this stream's ownership, and `docs/security.md`
Step 5 requires stating that no credentials are committed — which could not be
written honestly while `Admin@123` sat in `seedAdmin.ts`.

A second occurrence turned up afterwards in a comment at `supabase/seed.sql:9`,
found by `scripts/verify-security.sh` scanning the whole repository rather than
just `packages/` and `apps/` as the plan's grep does. Both are gone;
`git grep "Admin@123"` now matches only the audit and plan documents that
report the finding.

**Step 3 was already partly done.** `UserEditSheet.tsx` offers no role picker
containing `school_admin`, and `types/supabase.ts` already declares
`UserRole = 'teacher' | 'parent' | 'admin'`. Only the three backend files needed
changing. `grep -rn "school_admin" packages apps supabase` now returns nothing.

**A note was added to `notifyAdminsOfNewOrder` rather than left implicit.** The
plan flags that platform admins have `school_id = null` and so will not receive
the notification; that is now stated in the code, so the next reader does not
rediscover it as a bug.

**Step 5's regex is the plan's, unchanged.** `/[,()\\.*%]/g`. The guard also
skips the filter entirely when nothing survives stripping, so a search of `...`
returns the unfiltered list rather than matching `%%`.

### Not verified

The repository contains no `.env` — only `.env.example` — so the backend cannot
boot and the app cannot run. Every manual check in the Verification section
above is untested: the three Alerts tabs have not been seen on a device, and the
search behaviour has not been exercised against a live PostgREST. What was
verified is static: `pnpm typecheck` (backend clean, mobile unchanged at its 22
pre-existing Plan 00 errors), `pnpm lint` (no new problems; one pre-existing
warning removed), and the `school_admin` grep.
