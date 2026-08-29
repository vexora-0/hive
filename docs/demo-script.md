# Demo Script

> ## Read this first if you are presenting
>
> **Bhargav is not presenting and will not be in the room.** This script has to
> stand on its own, so it is written for someone who was not there when the
> code was written.
>
> **Do one full dry run before the real thing — do not skip this.** Follow this
> script start to finish, on the machine you will actually present from, with
> enough time to fix something if it breaks. Two specific reasons:
>
> 1. **Several fixes landed on 9 August and are verified only by having been
>    clicked through in a browser, not by tests.** Ordering, the order item
>    counts, the shipping-address guard, order numbers, deep links and the
>    teacher class picker all changed that day. They worked when checked. They
>    are not covered by the test suite, so a dry run is the only thing standing
>    between you and finding out live.
> 2. **This script is a browser demo, but the app has run on a phone.** On 16
>    August it ran on a physical iPhone through Expo Go over the LAN, and a
>    standalone Android build was installed to close deep links. Nothing was
>    captured from either run, so if someone asks to see it on a device the
>    honest answer is that it has been done and observed, not recorded.
>
> **If something breaks mid-demo**, the fastest recovery is almost always to
> reload the browser tab. The three checks in "Before you start" — Redis,
> backend `/health`, and the web server — catch nearly everything else, so run
> them again rather than debugging live. If the parent feed is empty or the
> screen is blank, you are probably signed in as the wrong role: sign out and
> back in.
>
> **The single most likely thing to go wrong** is using the OTP login instead of
> "Use a password instead". It is listed again below because it matters that
> much.

Target **8–10 minutes**. Rehearse end to end twice and time it.

**This is a browser demo.** The app runs in Chrome through `react-native-web`
at `http://localhost:8081`. That is a deliberate choice for a live run, not the
only surface the screens have been seen on - the app was driven on a physical
iPhone on 16 August, and on a standalone Android build. The product targets iOS
and Android; web is a verification convenience. See "Questions to expect".

Three things that will derail a live run if you skip them:

- **Sign in with a password, not an OTP.** The demo accounts use `.demo`
  addresses, which cannot receive mail, and Supabase's default SMTP is
  rate-limited anyway. On the login screen: pick the role, then
  **"Use a password instead"**. This is the single most likely thing to go
  wrong.
- **Nothing is deployed.** There is no hosted URL and no APK. Everything runs
  locally against the `hive-dev` Supabase project.
- **Navigate with the in-app tabs, not the address bar.** A cold load of a
  path such as `/orders` is not the same as tapping through to it — see
  "What not to show".

---

## Before you start

Two terminals, both left running.

```bash
# 1 — infrastructure and API
docker start hive-redis                       # or: redis-server --daemonize yes
redis-cli ping                                # MUST answer PONG
pnpm --filter @hive/backend seed:demo:reset   # clean data
pnpm dev:backend
curl -s localhost:4000/health | jq            # expect "database": "ok"
```

> **Start Redis anyway, but it is no longer fatal.** Order submission goes
> through the idempotency middleware, which talks to Redis before the handler
> runs. With Redis down this used to make `POST /orders` **hang** — still open
> after two minutes on 9 August, with no response and no error. Fixed in
> `1f09cf8`: Redis commands now fail after two retries instead of queueing
> forever, the middleware catches that and continues without idempotency, and
> `POST /orders` answers in well under a second. `/health` now reports
> `"cache"` alongside `"database"`, deliberately without changing the status
> code. So a demo survives a Redis outage — it just loses double-submit
> protection, which is worth having on stage. If Docker is not running on the
> machine, the plain
> `redis-server --daemonize yes` above is enough.

```bash
# 2 — the app in a browser
pnpm --filter @hive/mobile exec expo start --web    # http://localhost:8081
```

Then, before anyone is watching:

- Open `http://localhost:8081` and wait for the first bundle. It is a cold
  Metro build and takes a few seconds; every reload after it is fast.
- Sign in once as each account below to confirm it works, then sign out.
  Signing out clears the query cache, so nothing leaks between roles.
- `curl -s localhost:8081 -o /dev/null -w "%{http_code}\n"` should be `200`.

### Accounts

All of these use the password **`testing123`** on this machine — the seed's
`DEMO_PASSWORD`, and the admin's `ADMIN_PASSWORD`. All four were confirmed to
sign in on 9 August 2026. They are local seed credentials on a development
project, not real accounts.

| Role | Email |
|---|---|
| Parent | `parent.rajesh@bloom.demo` — two children, the account to demo |
| Teacher | `teacher.sarita@bloom.demo` — Sunflower class at Bloom |
| Admin | `vexxclaude@gmail.com` — platform admin, no school of its own |
| Parent | `parent.vikram@stars.demo` — the other school, for the privacy proof |

Full roster and dataset: [`DEMO_USERS.md`](DEMO_USERS.md).

Have open in tabs: [`architecture.md`](architecture.md) (diagram G-1),
[`user-flows.md`](user-flows.md), [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md).

---

## What not to show, and why

Three things work well enough in conversation and badly enough on a projector.
Each has an honest one-line answer if someone asks.

- **A live photo upload through the browser.** The tagging gate and the class
  default were both checked in Chrome, and the upload pipeline is exercised end
  to end by the API tests — but **an actual file upload through the web file
  picker was never completed end to end**. The risk is web-specific picker
  behaviour, not the pipeline. If asked: "the upload path is covered by the API
  tests; we haven't driven the web file picker, and web isn't the target
  platform anyway."
- **The Download button on a photo.** It is an intentional disabled "Coming
  Soon" placeholder — visible rather than silently inert. Say that if someone
  clicks it.
- **Typing paths into the address bar generally.** `/orders` specifically was
  fixed on 9 August and re-checked in the browser — a route group like
  `(parent)` contributes nothing to the URL, so `(admin)/orders` and
  `(parent)/orders` both claimed `/orders`, `(admin)` sorted first, and a
  parent's cold load was bounced to the feed. `RoleGate` now redirects to the
  caller's own group's copy of the same screen, carrying the query string.
  `/notifications`, `/profile` and `/dashboard` collide the same way and **were
  each walked through on 11 August**, in Chrome as a signed-in parent:
  `/notifications` and `/profile` cold-load to the parent's own screen, and
  `/dashboard`, which has no parent equivalent, falls back to `/feed`. Navigate
  with the in-app tabs anyway and there is nothing to go wrong.

---

## 0:00 — The problem

> "Preschools want to share photos with parents. The obvious way — a shared
> album or a WhatsApp group — means every parent sees every child. That's a
> child-privacy problem, and it's the reason this app exists.
>
> In Hive, a teacher tags which children are in each photo, and a parent sees
> **only** the photos their own child is tagged in. Not the class. Not another
> family's child."

State the constraint first. Everything after is a consequence of it.

---

## 1:00 — Architecture

Show the system diagram in `architecture.md` (labelled G-1 in Plan 10).

> "React Native and Expo on the front. An Express API in the middle. Supabase
> for Postgres, auth and object storage.
>
> Two things worth pointing out. First, there are **two data paths** — most
> screens go through our API, but a few queries go straight to Supabase with the
> user's own token. Second, our backend uses the service-role key, which
> **bypasses row level security entirely**. So row level security protects only
> that second path. Every API endpoint has to enforce authorization itself, in
> the service layer. That single fact caused three of the security bugs we found
> in our own audit."

---

## 2:00 — Teacher

Sign in as `teacher.sarita@bloom.demo`.

> "Sarita teaches Sunflower class at Bloom Preschool."

Show the dashboard — her class's photos are already there from the seed.

Then open **Upload** and talk through the screen **without completing an
upload** (see "What not to show" for why):

- The class picker already reads **Sunflower**, her own class. Worth pointing
  at: it used to default to `classes[0]`, and the list is ordered by name, so a
  teacher at a school whose first class alphabetically was a colleague's would
  file a whole batch under the wrong class unless she noticed the dropdown.
  Not a privacy fault — a colleague's class stays listed and pickable, and the
  read paths are school-scoped either way — but a data-integrity one.
- The **Upload button stays disabled until at least one child is tagged**, and
  says why. If you want to show the tagging sheet itself you have to select a
  file first — that is the point at which you are relying on the browser's file
  picker, so decide beforehand whether to go that far and **stop before
  pressing Upload** either way.

> "Tagging used to be labelled 'Optional'. It isn't optional — the parent feed
> is an inner join on the tag table and nothing in the app can tag a photo
> after upload, so an untagged photo reached no parent, notified nobody, and
> could never be fixed. It's now required, with the reason on screen.
>
> Note the order too: tag first, then confirm. A database trigger fires when
> the photo becomes `ready` and reads the tag rows to work out whose parents to
> notify. We originally confirmed first, so the trigger always ran against zero
> tags and **no parent was ever notified**. The feature looked like it worked,
> because teachers still got their own notification.
>
> On upload, `sharp` validates the file by its magic bytes — not the
> `Content-Type` header, which a client can lie about — and generates a
> thumbnail and a blurhash."
>
> **If asked about HEIC:** it is converted on the phone, not the server. The
> iOS picker is asked for a compatible representation, so it hands back JPEG.
> `sharp`'s prebuilt libvips has no HEVC decoder, so an iPhone HEIC reaching the
> server is refused with a 400 telling the teacher to re-save as JPEG. Do not
> say the server converts HEIC — it does not, and it is a thirty-second thing
> to check.

---

## 4:00 — Parent feed

Sign out, sign in as `parent.rajesh@bloom.demo`.

> "Rajesh has **two children**, Aarav and Diya."

The feed loads with real photos. Use the per-child chips at the top to switch
child — the feed changes. Then click a photo to open it.

> "One photo is tagged with both his children. It appears **once**, not twice —
> the feed de-duplicates."

The unread count on the **Alerts** tab is a badge — point at it now, you come
back to it at 6:30.

---

## 5:30 — Privacy proof · the most important minute

This is the segment to rehearse hardest. Two demonstrations.

**1. A different parent cannot see those photos.**

Sign out, sign in as `parent.vikram@stars.demo` — a parent at the *other*
school.

> "Same app, same feed screen. Different photos. There are six photos in the
> database; Rajesh sees two, Vikram sees one, and there is **zero overlap**."

Those are real counts, re-checked against the API on 9 August 2026 — 2 and 1.

**2. The photo URL itself is not public.**

Have this ready in a terminal, already run once so you know it works. Verified
on 9 August 2026 against the running dev backend — `200` then `400`:

```bash
set -a && . apps/mobile/.env && set +a

TOKEN=$(curl -s "$EXPO_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"email":"parent.rajesh@bloom.demo","password":"testing123"}' | jq -r .access_token)

URL=$(curl -s 'localhost:4000/api/v1/feed?limit=1' \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].url')

curl -s -o /dev/null -w "signed:   %{http_code}\n" "$URL"           # 200
curl -s -o /dev/null -w "stripped: %{http_code}\n" "${URL%%\?*}"    # 400
```

> "The bucket is private. The app never gets a permanent link — it gets a signed
> URL generated per request, and only *after* we've checked the caller is
> allowed the photo. Strip the signature and Supabase refuses it.
>
> That ordering matters: a signed URL is access. It must never be minted for
> someone who's about to be refused."

Optionally, the cross-school check. The seed uses fixed UUIDs, so this is
copy-pasteable — also verified on 9 August:

```bash
STOKEN=$(curl -s "$EXPO_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"email":"teacher.sarita@bloom.demo","password":"testing123"}' | jq -r .access_token)

# Sarita teaches at Bloom. Little Stars is a0000000-…-0002.
curl -s localhost:4000/api/v1/schools/a0000000-0000-4000-8000-000000000002/students \
  -H "Authorization: Bearer $STOKEN"
# {"success":false,"message":"You do not have access to this school","code":"FORBIDDEN"}

# Her own school, …-0001, returns the roster.
curl -s localhost:4000/api/v1/schools/a0000000-0000-4000-8000-000000000001/students \
  -H "Authorization: Bearer $STOKEN" | jq '.data | length'    # 6
```

> "That's a real IDOR we found in our own audit — three endpoints took a school
> ID from the URL and never compared it to the caller's."

---

## 6:30 — Notifications

Sign back in as Rajesh. The **Alerts** tab carries an unread badge; open it.

> "'New photo of Diya Kumar.' Generated by a database trigger when the photo
> was confirmed, addressed to the parents of the tagged children — not
> broadcast to the class."

Tap one — it opens the photo rather than only marking itself read. There is a
**mark-all-read** action for clearing a backlog. The list sorts by recency
alone; it used to sort unread-first, so marking a row read re-sorted it out
from under the finger that had just tapped it.

---

## 7:00 — Order

This is the flow that was completely broken this morning, so it is worth
showing all the way through.

Photo → **Order Print** → choose a product and quantity → continue to checkout.

**Stop on the address step before filling it in.** *Place Order* is disabled.
Click into the address field and back out of it — the required-field message
appears on blur, so the parent gets a stated reason rather than a greyed-out
button.

> "That guard is new today. The server requires a shipping address and nothing
> checked before submitting, so an empty address failed as an opaque 400.
>
> There was a worse one behind it. The sheet sent `notes: null` for the
> untouched optional field, and the schema used Zod's `.optional()` — which
> accepts `undefined` but not `null`. So **every order placed without a note
> returned 400**. And the idempotency middleware cached that 400 against the
> key for 24 hours, so retrying with a corrected payload replayed the original
> failure. Only 2xx is cached now."

Now fill the address and place the order. Then open **Orders** from the tab bar
— the new order is at the top, with its item count and status.

> "Prices live on the **server**. The client sends a product type and a
> quantity, never a price. Money is integer paise everywhere - client,
> validator and column — never a float.
>
> The request carries an idempotency key. Send the same one twice and you get
> the same order back, not a duplicate — so a double tap or a retry on a flaky
> connection can't charge twice."

---

## 8:00 — Admin

Sign in as `vexxclaude@gmail.com`.

> "Admin is the only role that crosses schools."

Dashboard (statistics) → Users → Schools → class detail → link a parent to a
student. Then open the **fulfilment queue** and advance the order just placed.

> "This queue was unreachable until today. `GET /admin/orders` threw 400 when
> the caller had no school of their own — which is exactly how the platform
> admin is created — and the screen rendered that 400 as 'No orders yet'. So
> the orders existed and the console said there were none. A school-less admin
> now sees every school's orders.
>
> Linking a parent is also what sets their school. Nothing else ever did:
> signup can't know a school, and placing an order requires one, so a real
> parent could browse the feed and never be able to order. Only the demo seed
> hid it, by writing the column directly."

> "Every destructive action confirms first, and states the consequence rather
> than asking 'are you sure' — unlinking a parent says they'll stop seeing that
> child's photos. And when the server rejects something, we show its actual
> message: try linking a parent twice and you get 'This parent is already
> mapped to this student', which tells you what happened."

---

## 9:00 — Engineering

```bash
pnpm test      # 247 tests across 9 files
```

**Do not run this live.** It takes about two and a half minutes at best, and it
runs against a *shared remote* Supabase project — if anyone else is running it,
or you have run it a few times already, sign-ins hit the project's quota and
tests start timing out at 30 seconds. Run it once beforehand and show the
output.

> "247 tests, against a real Supabase project rather than mocks - they sign
> users in, write real rows, and put real objects in storage. The known
> weakness is that the project is shared between CI and four developers, so
> overlapping runs used to delete each other's fixtures mid-test. That's fixed;
> what's left is the sign-in quota, which is an infrastructure limit rather
> than a test defect."

Be straight about coverage if the subject comes up:

> "Today was about two dozen defect fixes and they added exactly one test file
> — 23 cases on a pagination bug. Everything else in today's round is held up
> by review and the typechecker, not by tests. That's the honest position."

Show [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md) §4 and §5.

> "We keep an explicit split between what we've *proven* runs and what is only
> written. Most of the second list is there because for most of this phase we
> had no environment to run anything in."

---

## Questions to expect

**"Why are you showing this in a browser and not on a phone?"**
Because it is honest about where the project is. The app is React Native and
targets iOS and Android; the browser build exists through `react-native-web` as
a way to *see* the screens, and it is the only surface any of them has been seen
rendering on. Until 9 August nothing had been observed rendering at all —
bundling proves imports resolve, not that a screen draws. Two web-only defects
had to be fixed first: zustand's `import.meta` made the whole bundle a parse
error under a classic `<script>` tag, and `expo-secure-store` has no web
implementation, so the session was never stored and sign-in bounced straight
back to login. Neither affects native. It has since run on real hardware - a
physical iPhone through Expo Go on 16 August, and a standalone Android build
that closed deep links - but nothing was captured from either run, so the
browser is what we can show live.

**"Is it deployed? Can I try it?"**
No, and deployment is out of scope as of 16 August - decided against rather
than deferred. There is no hosted URL, no APK and no `eas.json`. The Dockerfile
and the CI workflow exist; nothing is hosted. That is also what keeps the HTTPS
check in our own `verify-security.sh` skipped, and why the k6 figures are a
local measurement.

**"What did you fix today, and how do you know it works?"**
Roughly two dozen defect fixes: ordering was completely broken (a `null` note
rejected by an `.optional()` schema, then that failure cached for 24 hours by
the idempotency middleware), the admin fulfilment queue answered 400 and
rendered as "No orders yet", a real parent's `school_id` was never set so they
could never order, and the upload pipeline could file one child's photo under
another child's class because multer's temp filename was `tmp_${Date.now()}`
with three concurrent uploads. A review of the first fix round found three
regressions it had introduced — cursor pagination dropping rows on a
millisecond-truncated timestamp, a rate-limit bypass via a forged bearer token,
and WebP accepted at three format gates and refused at the fourth — and those
were fixed too.

How we know: the parent, teacher and admin flows above were clicked through in
Chrome; typecheck, lint and build are clean; the API suite is 247 tests. But
**the only tests this round added are the 23 in `tests/cursor.test.ts`**. The
rest is guarded by review and the typechecker. `verify-security.sh` **was**
re-run on 11 August, after the round touched the rate limiter, CORS and the
error handler: **27 passed, 0 failed, 2 skipped**. It was run again on 16
August, once a forced-500 route existed to point `FORCE_500_PATH` at:
**29 passed, 0 failed, 1 skipped**. The single remaining skip is HTTPS, which
needs a deployment and so will not close.

**"How do you stop a parent seeing another child's photo?"**
Three layers. A `photo_student_tags` pivot decides visibility; a service-layer
ownership check runs on every request; the bucket is private and URLs are signed
per request. Row level security is a fourth, for direct client queries.

**"Why a backend at all if you have Supabase?"**
Server-owned pricing, multi-table authorization, image processing, and order
idempotency. None of those belong in a client.

**"Why did you remove the job queue?"**
`sharp` takes roughly 200 ms. A queue added a Redis dependency and a whole
failure mode for no benefit at this scale. Removing complexity deliberately is
the right call, and we documented why.

**"What breaks at 10,000 users?"**
Synchronous image processing becomes the bottleneck — that's when the queue we
removed earns its place. Feed pagination is cursor-based and holds up; storage
and auth are Supabase's problem before ours.

**"What did you get wrong?"**
The order contract drifted across three layers — the client sent one product
vocabulary, the validator expected another, and the database `CHECK` allowed a
third. Every order failed before reaching the database. Nobody owned it end to
end. We found it in our own audit, fixed it with a shared catalogue, and added
a test asserting the client and server agree.

A more uncomfortable one, worth volunteering: **for six weeks the app didn't
compile, and the other three streams kept working anyway** — verifying by
reading rather than running. That's why so much was written but unproven, and
it's the single biggest process lesson from the phase.

---

## Day-of checklist

- [ ] **One full dry run of this script completed, start to finish, on the
      machine you are presenting from.** Not optional. The 9 August fixes are
      verified only by having been clicked through in a browser, and are not
      covered by the test suite. Do it early enough that a surprise is fixable
- [ ] Redis up and `redis-cli ping` answering `PONG` — ordering survives
      without it now, but loses double-submit protection. `/health` reports it
      as `"cache"`
- [ ] Backend up, `curl -s localhost:4000/health | jq` returning
      `"database": "ok"`
- [ ] `pnpm seed:demo:reset` for clean data
- [ ] `expo start --web` up, `localhost:8081` returning 200, first bundle
      already built
- [ ] Signed-in once as each of the three accounts, then signed out
- [ ] Signed-URL and cross-school commands pasted into a terminal **and run
      once** so you have seen 200 / 400 / 403 yourself
- [ ] Browser zoom set so the app is legible from the back of the room;
      notifications silenced; a second window for the terminal
- [ ] Diagrams open in tabs
- [ ] `pnpm test` run once beforehand, output kept on screen — **not** run live
- [ ] Video fallback accessible **offline**
