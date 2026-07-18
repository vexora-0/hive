# Hive — Handover

**State:** the core product loop is verified working against a live database.
**Last verified:** 18 July 2026.
**Not deployed.** Everything below runs locally.

For deeper detail: `CLAUDE.md` (working rules) · `docs/IMPLEMENTATION-STATUS.md`
(what exists and what is proven) · `docs/environment-setup.md` (setup, plus the
verification checklist).

---

## 1. What Hive is

Preschools photograph classroom activity and share it with parents. The
constraint that shapes every decision: **a parent must see photos of their own
child and no one else's** — structurally, not by convention.

Teachers upload and tag which children appear. Parents see a feed scoped to
their own children and can order prints. Admins manage schools, classes,
students and the parent↔child links the whole privacy model rests on.

**Stack:** Expo / React Native · Express + TypeScript · Supabase (Postgres, Auth,
Storage) · pnpm workspaces with Turborepo.

---

## 2. Run it

```bash
docker run -d --name hive-redis -p 6379:6379 redis:7-alpine
pnpm install
pnpm dev:backend
curl -s localhost:4000/health | jq      # expect "checks":{"database":"ok"}
pnpm dev:mobile
```

Env files are gitignored; create them from the `.env.example` templates. The
Supabase project, migrations and demo data already exist — **do not run
`pnpm db:reset`.**

`"database":"ok"` is the real signal: `/health` round-trips to Supabase, so a 503
means bad credentials rather than a dead process.

**Redis is not optional for orders.** Without it, order creation hangs
indefinitely rather than failing — ioredis queues rather than erroring. Two
minutes of silence, no error. Worth a timeout before this ships.

---

## 3. Demo accounts

Password is whatever you set as `DEMO_PASSWORD`; admin uses `ADMIN_PASSWORD`.

| Role | Email |
|---|---|
| Admin | your `ADMIN_EMAIL` |
| Teacher | `teacher.sarita@bloom.demo` |
| Parent | `parent.rajesh@bloom.demo` — **two children**, the account to demo |
| Parent | `parent.vikram@stars.demo` — other school, the privacy proof |

**Sign in with the password, not a one-time code.** Pick the role, then tap
*"Use a password instead"*. `.demo` domains cannot receive mail.

Re-seed anytime: `pnpm seed`

---

## 4. Verified working — runtime, not review

Confirmed against the live database on 18 July:

| Check | Result |
|---|---|
| Photos processed | 6/6 with thumbnail, blurhash, dimensions |
| Photo URL without a signature | **400** |
| Signed URL | 200; token stripped → 400 |
| Thumbnail vs original | **16 KB vs 211 KB — 13×** |
| Parent feed | correct children only; sibling photo appears once |
| Other family's photo | **404** (not 403 — 403 would confirm it exists) |
| Notifications | produced by trigger, correct child names |
| Order | `total_cents=998` = $9.98 for 2 × $4.99 |
| Duplicate idempotency key | cached replay, no second order |
| Ordering another family's photo | **403** |
| Teacher → another school's class | **403** |
| Admin dashboard | 2 schools, 8 users, 6 photos, 3 orders, $34.95 |

---

## 5. Not verified

- **Nothing is deployed.** No Render service, no public URL.
- **Tests have never run.** The harness and ~19 backend tests exist but need a
  separate `hive-test` Supabase project — the suite truncates every table, so
  pointing it at the demo project wipes the data.
- **The mobile app has not been driven end to end by hand.** The flows above were
  verified over the API with real tokens. Someone needs to tap through it.
- **k6 load suite** written, never run — needs a deployed target.
- **CI** written, never triggered.

`docs/environment-setup.md` §7 is the manual checklist. It asks for failures to
be reported, not ticks.

---

## 6. Four bugs that only running found

Worth reading before trusting anything that has only been reviewed.

**`processed_at` did not exist.** Written by the upload path, present in no
migration — inherited from a deleted background worker. PostgREST rejects an
entire update over one unknown column, so thumbnails, blurhash and dimensions
silently never persisted. Every upload would have left the feed on
full-resolution originals: exactly the defect the storage rewrite existed to fix,
reintroduced by one copied line.

**The seed filed every photo under the wrong school.** It derived the school by
comparing the first eight characters of a class UUID; every class id shares them.
Photos were invisible to the teacher who uploaded them.

**The dashboard selected a dead column twice.** First `total`, which never
existed; then `total_amount`, after a migration renamed it to `total_cents`. The
first time it failed silently and reported zero. The second was caught only
because an error check had been added alongside the first fix.

**Orders hang without Redis.** Not an error — a silent indefinite wait.

All four typecheck cleanly. Static review cannot catch a missing column, a string
comparison that is always true, or a client that queues forever.

---

## 7. What is left

| Item | Owner | Notes |
|---|---|---|
| **Rotate the Supabase service key** | Ruthwik | It was pasted into a chat log. Settings → API → revoke, reissue, update `.env`. |
| Create `hive-test` project | Bhargav | Unblocks `pnpm test`; free tier allows two |
| Deploy to Render | Bhargav | Dockerfile and CI are written. `NODE_ENV=production` is critical — anything else returns internal error messages to clients. |
| Drive the app by hand | all | §7 checklist in `docs/environment-setup.md` |
| Order, admin and mobile tests | Srujan, Nagachaitanya | Harness exists; feed and photo tests written |
| Custom SMTP | Bhargav | Default Supabase SMTP is rate-limited; OTP unreliable for a live demo |
| One lint error | Nagachaitanya | `no-namespace` in `middleware/auth.ts` — the only thing keeping CI red |

---

## 8. Two things to know before changing code

**The API bypasses row level security.** Every service uses the service-role key,
which is exempt by design. The 505-line policy set protects only the queries the
mobile client makes directly to Supabase. **Every endpoint must enforce
authorization explicitly in its service function** — four originally did not, and
that was the source of three critical findings.

**Tag before confirm.** `notify_parents_on_photo` fires when a photo becomes
`ready` and loops over `photo_student_tags`. Flip the status before tagging and
the loop runs empty — no parent is ever notified, while the teacher still gets
their own notification, so it looks half-working. Both the app and the seed tag
first. Do not reorder them.

---

## 9. History

Weeks 1–13 (Feb–May) are a **reconstruction.** The original repository was lost
to a laptop failure; the code survived as a single recovery commit pushed 3 March
2026. The code is authentic and verified byte-identical to that snapshot; the
commit boundaries, dates and per-commit authorship are not recovered. This is
stated at the top of `docs/PROGRESS-REPORT.md` and should stay stated.

The original snapshot is preserved as tag `backup/original-import` and branch
`backup/main-original`, both on the remote, plus a local bundle.

Phase 2 (May onward) is genuine history.
