# Demo Accounts

Created by `pnpm seed`. Passwords come from your `.env` — they are deliberately
not written here.

| Role | Email | Password from | School |
|---|---|---|---|
| Admin | *your* `ADMIN_EMAIL` | `ADMIN_PASSWORD` | — (platform-wide, no school of its own) |
| Teacher | `teacher.sarita@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Teacher | `teacher.dinesh@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Teacher | `teacher.kavitha@stars.demo` | `DEMO_PASSWORD` | Little Stars Academy |
| Parent | `parent.rajesh@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Parent | `parent.lakshmi@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Parent | `parent.anita@bloom.demo` | `DEMO_PASSWORD` | Bloom Preschool |
| Parent | `parent.vikram@stars.demo` | `DEMO_PASSWORD` | Little Stars Academy |

`.demo` domains so nobody mistakes these for real addresses.

**Sign in with the password, not a one-time code.** On the login screen pick the
role, then tap **"Use a password instead"**. `.demo` domains cannot receive
mail, and Supabase's default SMTP is rate-limited to a few messages an hour — so
OTP is unusable for these accounts and unreliable for a live demonstration even
with real addresses.

---

## The demo path

**Teacher — `teacher.sarita@bloom.demo`**
Owns Sunflower class. Dashboard shows her class photos. Upload → pick images →
select class → tag students → watch it complete. The class picker now defaults
to her own class rather than the first one alphabetically, and the Upload button
stays disabled until at least one child is tagged.

**Parent — `parent.rajesh@bloom.demo`** ← the account to demo
**Two children**, Aarav and Diya, so the child switcher is meaningful. Has
photos, notifications and one photo containing both children — which exercises
feed deduplication.

**Parent — `parent.vikram@stars.demo`** ← the privacy proof
Different school entirely. Sign in as him after showing Rajesh's feed: none of
Bloom's photos appear. This is the single most persuasive minute of the demo.

**Admin — your `ADMIN_EMAIL`**
Dashboard statistics, both schools, class detail with students and parent
mappings, and the order fulfilment queue. The seeded admin has **no school of
its own**, which is deliberate: a school-less admin is a platform admin and sees
every school's orders. `GET /admin/orders` used to answer 400 in exactly that
case and the screen rendered it as "No orders yet".

For the browser demo, and for which parts of these flows to show and which to
avoid, follow [`demo-script.md`](demo-script.md).

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
| Orders | 4, spanning pending, confirmed and shipped, with 6 order items |

Counted against `hive-dev` on 9 August 2026; the table above matched exactly.

Notifications are **not** inserted directly. They are produced by the
`notify_parents_on_photo` trigger when each photo transitions to `ready`, which
is the behaviour worth demonstrating. The seed prints the resulting count and
warns if it is zero — zero means tagging ran after the status flip, the bug
fixed in Plan 05.

Migration `00024` dropped the *other* photo trigger — the per-row
`upload_complete` notification sent to the uploading teacher. A confirmed batch
of 20 photos produced 20 rows telling a teacher about photos she had just
watched upload. Parent notifications are unaffected.

The seeded orders use fixed UUIDs beginning `f0000000-…`. Screens show a short
order number derived from both ends of the id rather than its first eight
characters, because sharing a prefix made all three render as the same number.

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
