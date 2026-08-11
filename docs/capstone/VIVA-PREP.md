# Viva preparation

**Q&A and confidence — 5 marks.**

Confidence in a viva is not volume. It is knowing which parts of your system are
weak and being unembarrassed about them. The fastest way to lose this mark is to
defend something indefensible; the fastest way to earn it is to say "that is a
real limitation, here is why, here is what I would do".

Answers below are grouped by how likely they are, hardest first.

---

## The questions you are most likely to get

### "Show me where authorization actually happens."

Service layer, not middleware and not the client. Three layers, only two trusted:

- `RoleGate` in the mobile app is **UX only** — it stops the wrong screen
  rendering and is trivially removed in a modified build
- `roleGuard` middleware does the coarse role check
- **Ownership assertions in the service layer are the real boundary** — every
  resource fetched by ID is compared against the caller

Then volunteer the reason: *"The API authenticates as the service role, which
bypasses RLS by design. RLS only protects queries the mobile app makes directly.
Three of our most serious findings came from code that assumed RLS was covering
it."*

### "You use Supabase. What did you actually build?"

Fair question, and the honest answer is strong. Supabase provides Postgres, an
auth service and object storage. It does **not** provide:

- The privacy model — a many-to-many parent↔student mapping, and a feed query
  that resolves it without duplicating siblings' shared photos
- Any of the 40 endpoints, their validation, or their ownership checks. **The API
  bypasses RLS entirely**, so every authorization decision is code we wrote
- The image pipeline — magic-byte validation, thumbnailing, blurhash, HEIC
  conversion
- Server-side order pricing, integer-cent money handling, transactional order
  creation, idempotency

*"Supabase removed the parts that are solved problems. The authorization model is
ours, and it is where the defects were."*

### "Why 404 and not 403 for another family's photo?"

A 403 confirms the resource exists. An attacker enumerating IDs learns which are
real — that is a disclosure even without the photo. 404 reveals nothing.

403 **is** correct for the school boundary, because a teacher already
legitimately knows other schools exist; there is nothing to conceal.

### "Your tests pass. How do you know they test anything?"

This is the sabotage exercise, and it is the best answer in the report.

Deleted one line — the ownership check — and re-ran. Exactly the 3 targeted tests
failed. **And a similarly-named test stayed green**: both its teachers were at
different schools, so the school check refused first and the ownership check
never executed. It had never tested what its name claimed.

*"A passing suite proves nothing until you make it fail on purpose. When we did,
it found a test that was lying to us."*

### "What are your performance numbers?"

**"There are none, and I would rather tell you that than invent them."**

The k6 suite — smoke, load, stress, spike — is written and committed, but has
never run because there is no deployed target. The only timing figure measured is
the test suite: 178 tests in 115 s including database truncation and ~40 auth
user creations.

Then pivot: *"Deployment is the first item of future work precisely because it
unlocks the load tests, the HTTPS checks and device testing at the same time."*

Do not estimate. An invented number is the one thing that can lose the
credibility of every real number in the report.

### "Is it deployed? Can I use it?"

No. No hosted URL, no APK. It runs locally and has been driven end to end in
Chrome via Expo's web target, so the screens are exercised — but web is a
verification convenience and the product targets iOS and Android.

Say it plainly and move to what *is* proven: the privacy boundary, verified over
HTTP with real tokens and reproduced from a cold start.

---

## Technical depth questions

### "Walk me through what happens when a teacher uploads a photo."

1. `POST /photos` — metadata row created, `status = 'processing'`
2. `POST /photos/:id/file` — multipart upload. **The declared MIME type is not
   trusted**; `sharp` reads the header bytes
3. Pipeline: HEIC → JPEG if needed, original uploaded, 400 px thumbnail
   generated, blurhash computed, dimensions recorded
4. `POST /photos/:id/tag` — students tagged, capped at 50
5. `POST /photos/:id/confirm` — `status → 'ready'`

**Step 5 must come after step 4.** The notification trigger fires on the
transition *to* `ready` and loops over the tags that exist at that instant.
Reverse them and every parent notification silently disappears — the demo looks
fine and the feature is dead. That ordering bug was real, and it is now the
thing the seed script comments most loudly about.

### "Why integer cents?"

Because floats lose money. The concrete failure: columns were `decimal(10,2)`
documented as USD, the API wrote cents into them, and the client priced in
dollars and rendered `toFixed(2)`. A **$4.99 print stored `299.00` and displayed
as $299.00** — a 100× error in the direction that overcharges the customer.

Now integer cents everywhere, converted to dollars exactly once, at render, in a
single helper. There is a test asserting the mobile and backend catalogues agree.

### "Why is order creation a database function?"

Atomicity. It previously inserted the order, then the items, then issued a
compensating `DELETE` if the second failed. A crash between the two left an order
with no items — **and the compensation never ran, because the process was gone**.

A PL/pgSQL function body is a single transaction. Verified by deliberately
failing the item insert: the item was rejected and **no orphaned order row**
remained.

### "How does the parent feed avoid showing duplicates?"

A photo tagged with two of the same parent's children would naturally appear
twice through the join. The feed de-duplicates by photo ID, and there is a
seeded photo tagged with both of Rajesh's children specifically to exercise it.
Verified: no duplicate IDs in a parent's feed.

### "What happens if the database goes down?"

`/health` returns **503** with `"status": "degraded"` and
`"checks": {"database": "error"}`. Verified by stopping Supabase mid-run.

**Volunteer the gap:** `/health` checks the database but **not Redis**. With
Redis stopped, `POST /orders` hangs — the idempotency middleware talks to Redis
before the handler runs, and a request stayed open past two minutes. So the
health check would report `ok` while ordering is dead. That is a known,
documented defect, not something we discovered in the viva.

Naming this unprompted is worth more than being caught by it.

---

## Questions about process

### "Four people. What did *you* do?"

Data layer — schema, migrations, validation, seed data. 70 of 367 commits.

Lead with the two where diagnosis was the work:

- **The ordering contract**: three layers disagreeing three ways; no order had
  ever been placed. Root-caused and fixed across all three.
- **The Supabase types**: assumed stale, actually hand-written and failing the
  client library's `GenericSchema` contract, so every query row collapsed to
  `never`. One correct type file cleared seven of the app's 22 compile errors.

### "How did you coordinate?"

Documented file ownership per person, reserved migration number ranges, and
trunk-based development on `main` with same-day merges.

**And say where it failed**, because it did: two contributors independently
implemented much of the authorization plan. The merge reconciled cleanly and kept
the stronger version of each, but the effort went twice. The fix is agreeing
ownership *before* starting, not after.

### "What was the hardest bug?"

Good options — pick one and tell it as a story with a root cause:

- **The ordering contract** — three layers, each internally consistent, all
  mutually incompatible. No single-layer test could have caught it.
- **The test that never tested anything** — found only by sabotage, after months
  of it passing.
- **The guard that failed open** — the suite truncates every table, and the guard
  meant to prevent it running against the demo database compared against a
  variable that was never set. Its own comment called it "deliberately loud and
  unconditional". It was neither.

### "What would you do differently?"

1. **Deploy in week two, not never.** Almost every unverified item traces back to
   the absence of a deployed target.
2. **Agree file ownership before starting**, not after discovering duplicated
   work.
3. **Write the integration tests earlier.** The ordering defect would have been
   caught in week one by a single end-to-end order test.

---

## Traps

**"So it's fully working?"** — No. It works locally and is verified locally.
Nothing is deployed and nothing has run on a physical device. Answer the question
asked, not the one you wish had been asked.

**"You said 26 security checks passed — so it's secure?"** — 26 passed, 0 failed,
**3 skipped**. The skips need HTTPS and a deployed origin. And passing 26 checks
means those 26 properties hold; it is not proof of the absence of vulnerabilities.

**"Why didn't you use [X]?"** — If you evaluated it, say what you compared and
why. If you did not, say so. "We didn't evaluate that" is a complete answer;
inventing a comparison you never did is how a viva turns bad.

**A number you cannot source.** Every figure in the report is traceable to a
dated run. If you are asked where one came from and cannot say, you have found
the one to check tonight.

---

## The night before

- [ ] Re-run `pnpm test` **once**, alone, and note the result. Repeated runs
      exhaust the shared sign-in quota and produce timeouts that look like
      failures
- [ ] Re-run `scripts/verify-security.sh`, confirm 26/0/3
- [ ] Seed fresh demo data; confirm Rajesh sees 2 photos and Vikram 1
- [ ] Record a screen capture of the full demo as insurance
- [ ] Re-read §5.7 of the report — the limitations are what you will be pressed on
- [ ] Confirm every number in your slides against a real run
