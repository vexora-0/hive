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
- The image pipeline — magic-byte validation, thumbnailing, blurhash, and why
  HEIC is handled on the device rather than the server
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

**Lead with the one that is solid:** *"A twenty-photograph feed page transfers
3,908 bytes. Before we generated thumbnails the client fell back to
full-resolution originals and a page could exceed 100 MB."* That is four orders
of magnitude and it is measured, not estimated.

The k6 suite ran on 16 August against a **local instance** — say "local", never
imply production. Smoke, 1 VU over 30 s: **42/42 checks, 0.00% failures, p95
1.13 s**, every threshold passed.

**If they ask about the load profile, do not hide it — it failed, and the reason
is the good part.** 50 VUs over 5 minutes recorded 69% failures. It decomposes
exactly: 2,657 requests were **429s from our own per-identity rate limiter**
(50 VUs sharing three tokens), and 492 were **403s from the cross-school check**,
because the run was configured with a class from the wrong school. Neither is a
capacity failure. *"We measured our own rate limiter. The honest conclusion is
that we have no capacity number, because at that concurrency the application was
never the bottleneck."*

Volunteer the accounting if pressed: 4,727 requests issued, 2,070 in the server
log, 2,657 refused upstream — the limiter is mounted ahead of the logging
middleware, which is why the two totals differ.

Also measured: 178 backend tests in 115 s (that figure belongs to the 178-test
suite — it is 218 now and has not been re-timed, so do not restate it), and 100
mobile unit tests in 281 ms.

Then pivot: *"A real capacity figure needs per-user identities and a deployed
target. Deployment is first in future work because it unlocks the load tests, the
HTTPS checks and the iOS build together."*

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
3. Pipeline: original uploaded, 400 px thumbnail generated, blurhash computed,
   dimensions recorded. **HEIC is transcoded on the device, not here** — see
   below
4. `POST /photos/:id/tag` — students tagged, capped at 50
5. `POST /photos/:id/confirm` — `status → 'ready'`

### "You say you convert HEIC. Show me."

**Do not claim the server converts HEIC.** It does not, and an examiner can
falsify it in half a minute. The honest answer:

`sharp`'s prebuilt libvips ships libheif with an AV1 codec and **no HEVC
codec**, and an iPhone HEIC is HEVC-coded. libheif parses the container, so
`metadata()` succeeds and reports `format: 'heif'` — the failure only surfaces
when the pixels are decoded. We found that by testing a real HEVC HEIC on 24
July 2026; the error is *"No decoding plugin installed for this compression
format"*. Code review could not have caught it, because the metadata call
succeeds.

So the transcode happens **on the device**: the iOS picker is asked for a
compatible representation
(`UIImagePickerPreferredAssetRepresentationMode.Compatible`), and the phone
hands back JPEG. No HEIC leaves the device. The server keeps the conversion
branch — it does convert AVIF, which shares the HEIF container — and refuses an
HEVC HEIC that arrives anyway with a 400 reading *"This photo is in a format the
server cannot read (HEIC). Please re-save it as JPEG and try again"*, rather
than leaking `bad seek to 80687`.

Fixing it server-side means building `sharp` from source against libheif with
`libde265`. That is a Dockerfile and licensing decision, not application code,
and it is recorded as an open decision rather than done.

**Step 5 must come after step 4.** The notification trigger fires on the
transition *to* `ready` and loops over the tags that exist at that instant.
Reverse them and every parent notification silently disappears — the demo looks
fine and the feature is dead. That ordering bug was real, and it is now the
thing the seed script comments most loudly about.

### "Why integer minor units?"

Because floats lose money. The concrete failure: columns were `decimal(10,2)`
documented as USD, the API wrote integer cents into them, and the client priced
in dollars and rendered `toFixed(2)`. The **$2.99 digital download stored
`299.00` and displayed as $299.00** — a 100× error in the direction that
overcharges the customer.

**If they quote "$4.99" back at you from migration `00017`:** that comment
crosses two products, and you should say so rather than defend it. The July
catalogue had `print_4x6` at 499 cents and `digital_download` at 299 — a $4.99
print would have stored `499.00`, not `299.00`. Same mechanism, same hundredfold
error, but the pair as written in that comment is not self-consistent. It is
flagged in Report §2.4.2. Owning a wrong comment costs nothing; defending one
you cannot reconcile costs the whole answer.

Now integer minor units everywhere, converted to a display string exactly once,
at render, in a single helper. There is a test asserting the mobile and backend
catalogues agree.

### "Your column is called `total_cents` but the app shows ₹. Which is it?"

**Rupees.** The catalogue was re-priced for the Indian market during the
interface revision of 13 August — a 4×6 print is ₹30, a photo book ₹499 — and
money is stored as integer **paise**. So `total_cents: 6000` is ₹60.

The column names were left alone deliberately. They hold whatever the minor unit
of the current currency is; renaming them means a migration, a regenerated
`supabase.ts` and a sweep through every service, for no behavioural gain. The
same reasoning leaves `photos.s3_key` holding a Supabase Storage path.

If pressed on whether that is good practice: no, and the honest answer is that
a column named for a unit it no longer holds is a trap for the next reader. It
is recorded in §2.4.2 rather than hidden, and the rename is cheap to do the next
time the schema is touched for another reason.

**Do not say the display helper is `formatCents`.** It is `formatRupees`, and it
groups the Indian way — `12,34,567`, not `1,234,567` — hand-rolled because
Hermes ships without full ICU on Android unless the build opts in.

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

**Volunteer the war story:** this used to be much worse for Redis. With Redis
stopped, `POST /orders` did not fail — it hung, past two minutes. The
idempotency middleware runs before the handler and already caught Redis
failures, but the failure never arrived: `maxRetriesPerRequest: null`, left
behind by the queue we removed, combined with the client's offline queue to make
a command that retried forever and never settled. An entirely optional
dependency could take out the most important flow in the product.

Commands now fail after two retries with the offline queue disabled, so the
middleware's existing catch fires and ordering degrades to "not deduplicated"
instead of "not working". Measured with Redis stopped: **485 ms**, not a hang.

`/health` now reports `"cache"` alongside `"database"`, but **deliberately does
not let Redis change the status code** — losing the idempotency cache degrades
deduplication rather than availability, so the instance should stay in rotation.
The residual limitation, if pressed: an orchestrator probing only the status
code will not drain an instance whose Redis is down.

Naming this unprompted is worth more than being caught by it.

---

## Questions about process

### "Four people. What did *you* do?"

Data layer — schema, migrations, validation, seed data. 82 of 422 commits.

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

**"So it's fully working?"** — No. It works locally and is verified locally, and
it runs on a physical Android device — but **nothing is deployed**, and iOS has
never been launched. Answer the question asked, not the one you wish had been
asked.

**"You said it runs on a device — so it's tested on mobile?"** — On Android, yes,
and that is where seven defects were found, including one the browser could not
expose: the root layout remounting 145 times into a blank screen. On iOS, no
build has been launched, so the keychain session and the image picker are proven
on one platform of two. Native `hive://` deep links are unverified on either —
route groups were checked through a browser URL, which does not go through the
operating system's linking path. Report §3.3.8 has the detail.

**"You said 27 security checks passed — so it's secure?"** — 27 passed, 0 failed,
**2 skipped** (11 August; it was 26/0/3 on 1 August). One skip needs HTTPS and a
deployed origin; the other needs `FORCE_500_PATH` pointed at a route that
reliably 500s, alongside `NODE_ENV=production`. And passing 27 checks means those
27 properties hold; it is not proof of the absence of vulnerabilities.

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
- [ ] Re-run `scripts/verify-security.sh`, confirm 27/0/2. It needs
      `SUPABASE_ANON_KEY` in the backend env, or 13 checks skip silently
- [ ] Seed fresh demo data; confirm Rajesh sees 2 photos and Vikram 1
- [ ] Record a screen capture of the full demo as insurance
- [ ] Re-read §5.7 of the report — the limitations are what you will be pressed on
- [ ] Confirm every number in your slides against a real run
