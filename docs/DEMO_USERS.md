# Demo Accounts

Created by `pnpm seed`. Passwords come from your `.env` — they are deliberately
not written here.

| Role | Email | Password from | School |
|---|---|---|---|
| Admin | *your* `ADMIN_EMAIL` | `ADMIN_PASSWORD` | — (platform-wide) |
| Teacher | `teacher.sarita@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Teacher | `teacher.dinesh@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Teacher | `teacher.kavitha@stars.demo` | `DEMO_PASSWORD` | Little Stars Academy |
| Parent | `parent.rajesh@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Parent | `parent.lakshmi@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Parent | `parent.anita@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Parent | `parent.vikram@stars.demo` | `DEMO_PASSWORD` | Little Stars Academy |

`.demo` domains so nobody mistakes these for real addresses.

---

## The demo path

**Teacher — `teacher.sarita@bloom.demo`**
Owns Sunflower class. Dashboard shows her class photos. Upload → pick images →
select class → tag students → watch it complete.

**Parent — `parent.rajesh@bloom.demo`** ← the account to demo
**Two children**, Aarav and Diya, so the child switcher is meaningful. Has
photos, notifications and one photo containing both children — which exercises
feed deduplication.

**Parent — `parent.vikram@stars.demo`** ← the privacy proof
Different school entirely. Sign in as him after showing Rajesh's feed: none of
Bloom's photos appear. This is the single most persuasive minute of the demo.

**Admin — your `ADMIN_EMAIL`**
Dashboard statistics, both schools, class detail with students and parent
mappings.

---

## What the dataset contains

| | |
|---|---|
| Schools | 2 — Bloom Preschool (Bangalore), Little Stars Academy (Mumbai) |
| Classes | 4, with teachers assigned to three |
| Students | 9 |
| Parent links | 8, including one parent with two children and one child with two parents |
| Photos | 6, processed with real thumbnails and blurhashes |
| Tags | 9 — including one photo with two siblings |

Notifications are **not** inserted directly. They are produced by the
`notify_parents_on_photo` trigger when each photo transitions to `ready`, which
is the behaviour worth demonstrating. The seed prints the resulting count and
warns if it is zero — zero means tagging ran after the status flip, the bug
fixed in Plan 05.

---

## Running it

```bash
pnpm seed              # idempotent, safe to re-run
pnpm seed:demo:reset   # wipe demo data first
```

Photos need JPEGs in `packages/backend/src/scripts/seed-assets/` — see the
README there. Without them the script seeds everything else and skips photos,
so the rest of the demo still works.

**Before any demo:** `pnpm seed:demo:reset` for clean data, then sign in once as
each role to confirm.
