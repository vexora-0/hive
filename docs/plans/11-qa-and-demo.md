# Plan 11 — QA, Load Testing & Demo Preparation

**Branch:** `chore/qa`
**Size:** M (~6 hours)
**Depends on:** all previous plans
**Closes:** final verification; produces `docs/performance.md` results

---

## Goal

Prove the thing works, measure it, and make sure the demo cannot fail.

---

## Step 1 — Load testing with k6

**New directory:** `packages/backend/loadtest/`

k6 is the right choice here: a single binary, JS-scripted, no runtime to install.

```
loadtest/
├── lib/auth.js       fetch and cache JWTs for test users
├── smoke.js          1 VU, 30 s   — does it work at all
├── load.js           50 VU, 5 min — expected peak
├── stress.js         → 300 VU ramp — where does it break
└── spike.js          0 → 200 → 0  — recovery behaviour
```

**Scenarios, weighted by realistic traffic shape:**

| Weight | Scenario | Endpoint(s) |
|---|---|---|
| 60% | Parent feed + paginate | `GET /feed`, then `GET /feed?cursor=` |
| 20% | Photo detail | `GET /feed/photos/:id` |
| 10% | Teacher dashboard | `GET /photos?classId=` |
| 5% | Order creation | `POST /orders` with a fresh idempotency key |
| 5% | Admin dashboard | `GET /admin/dashboard` |

**Thresholds** (fail the run if breached):
```js
thresholds: {
  http_req_duration: ['p(50)<200', 'p(95)<800', 'p(99)<2000'],
  http_req_failed:   ['rate<0.01'],
}
```

**Run against the deployed Render instance**, not localhost — you are measuring the real deployment. Seed the load-test database first (`pnpm seed`).

**Watch for:** the free-tier Render instance will likely be the bottleneck before the code is. That is a legitimate finding — report it as *"the application is constrained by the free-tier host at N concurrent users; the identified application-level bottleneck is X"* rather than pretending you tested unconstrained.

### The headline measurement

**Measure the feed payload before and after thumbnails.** This is your single most persuasive number.

Before (Plan 03): `thumbnail_s3_key` was always null, so the feed served full-resolution originals — a 20-item page could be hundreds of MB.
After: 400 px thumbnails — expect a **50–100× reduction**.

If you no longer have a pre-Plan-03 build, reconstruct it honestly: measure the average original vs thumbnail object size in Supabase Storage and compute the page total. State the method.

Record in `docs/performance.md`:

| Metric | Before | After |
|---|---|---|
| Feed page payload (20 photos) | | |
| p50 / p95 / p99 latency | | |
| Throughput (req/s) | | |
| Error rate | | |
| Max stable concurrent VUs | | |

---

## Step 2 — Full manual QA

Run the complete checklist from the audit (§16.3). Every box, on a **real device against the deployed backend** — not a simulator, not localhost.

### Pre-flight
- [ ] Clean clone → `pnpm install` → `pnpm typecheck` → `pnpm lint` → `pnpm build:backend` → `pnpm test` all pass
- [ ] All migrations apply to a **fresh** database
- [ ] `pnpm seed` produces the full demo dataset
- [ ] `/health` returns 200 from a phone on **mobile data**
- [ ] APK installs on the demo device
- [ ] OTP email arrives within 30 s
- [ ] Zero console errors on any screen

### Auth
- [ ] Teacher signup → OTP → teacher dashboard
- [ ] Parent signup → OTP → feed
- [ ] Admin password login → admin dashboard
- [ ] Demo accounts sign in with password
- [ ] Wrong OTP → error + shake
- [ ] Sign out → login; session does not resurrect
- [ ] App restart keeps the user signed in
- [ ] `hive://(admin)/dashboard` as a parent → redirected

### Teacher
- [ ] Class dropdown lists the right classes
- [ ] Pick 5 images; all preview
- [ ] Tag 2 students; tags persist
- [ ] Upload completes; progress reaches 100%; confetti fires
- [ ] Photos appear on the dashboard
- [ ] Airplane mode mid-upload → clear error → retry succeeds
- [ ] Upload 10 at once → all complete, at most 3 concurrent

### Parent
- [ ] Feed shows only this child's photos
- [ ] Child switcher changes the feed
- [ ] Pull-to-refresh works
- [ ] Scroll past 20 → page 2 loads, no duplicates
- [ ] Tap → detail; pinch-zoom works
- [ ] Long-press → action sheet
- [ ] **Order end-to-end → success toast → appears in history at the correct price**
- [ ] **Notification appears after a teacher uploads a photo of this child**
- [ ] Parent with no children → actionable empty state

### Admin
- [ ] Dashboard shows non-zero orders and revenue
- [ ] Create school → appears in list
- [ ] Create class → assign teacher
- [ ] Add student → map parent by email
- [ ] Search returns correct results
- [ ] Role change persists
- [ ] Destructive actions prompt for confirmation

### Cross-cutting
- [ ] Offline banner in airplane mode
- [ ] Back-navigation never lands on a blank screen
- [ ] Every button acts or is visibly disabled
- [ ] No unhandled promise rejections in logs
- [ ] Signed photo URLs expire correctly

**Log every failure in `docs/qa-log.md`** with severity, then fix. Keep the log — it is evidence of process, and the reference `report.md` shows this course values that.

---

## Step 3 — Security verification

Re-run the checks from Plan 04 against the **deployed** instance:

- [ ] `curl https://<backend>/uploads/photos/anything` → 404
- [ ] Parent A → Parent B's child's photo → 404
- [ ] Teacher X → school Y's students → 403
- [ ] Teacher X → upload to teacher Y's photo → 403
- [ ] Unsigned/expired Storage URL → rejected
- [ ] A triggered 500 returns "Internal server error", **no stack trace** (confirms `NODE_ENV=production`)
- [ ] Rate limiting fires after 100 requests in 15 minutes
- [ ] `CORS_ORIGINS` is explicit, not `*`
- [ ] `grep -rn "Admin@123\|service_role"` across the repo → nothing
- [ ] Sentry events contain no tokens, emails, or photo URLs

**Rotate the Supabase keys before final submission** (audit S-15 — `README_MIGRATIONS.md:20` exposes the project ref `fhvwsmtivwtmbdscdoyz`). Update Render and both `.env` files afterwards, then re-run `/health`.

---

## Step 4 — Demo script

**New file:** `docs/demo-script.md`

Target **8–10 minutes**. Structure:

| Time | Segment | Account | Show |
|---|---|---|---|
| 0:00 | Problem & solution | — | Preschools need to share photos with parents privately. Each parent must see **only their own child**. |
| 1:00 | Architecture | — | Diagram G-1. Mention the two data paths and why. |
| 2:00 | Teacher upload | `teacher.sarita@bloom.demo` | Pick class → 3 photos → tag 2 students → upload → confetti |
| 4:00 | Parent feed | `parent.rajesh@bloom.demo` | **Two children** → switch → feed changes. Tap a photo. |
| 5:30 | **Privacy proof** | — | **The most important 60 seconds.** Sign in as a different parent — the photo just uploaded is *not* there. Then show a raw photo URL being rejected without a signature. |
| 6:30 | Notifications | parent | "New photo of \<child\>" — arrived via a DB trigger |
| 7:00 | Order | parent | Select product → address → place → success → history |
| 8:00 | Admin | admin | Dashboard stats → schools → class detail → map a parent |
| 9:00 | Engineering | — | `pnpm test` green live · CI badge · Sentry dashboard · load test numbers |

**Rehearse it end to end at least twice.** Time it.

**Prepare for these questions** — they are the ones an examiner asks:
- *"How do you stop a parent seeing another child's photo?"* → `photo_student_tags` pivot + service-layer ownership check + private bucket + signed URLs. Three layers.
- *"Why a backend if you have Supabase?"* → server-owned pricing, multi-table authorisation, image processing, idempotency.
- *"Why did you remove the job queue?"* → measured `sharp` at ~200 ms; a queue added a Redis dependency and a failure mode for no benefit at this scale. **Removing complexity deliberately is a strong answer.**
- *"What would break at 10,000 users?"* → cite the audit's honest assessment.
- *"What did you get wrong?"* → the order contract drifted across three layers because nobody owned it end to end. Cite the audit and the fix. **This is a good answer, not a bad one.**

---

## Step 5 — Video fallback

**Record a full walkthrough** and commit to `docs/demo/hive-demo.mp4` (the reference `report.md` shows this course expects one).

Screen-record the device running the deployed app. Narrate. 5–8 minutes.

**This is insurance against the demo-day failure modes that have nothing to do with your code:** campus WiFi, Render cold start, an OTP that doesn't arrive, a flat battery. Record it the day before, not the morning of.

---

## Step 6 — Final submission pack

- [ ] `main` tagged `v1.0.0`
- [ ] `docs/submission/hive-preview.apk`
- [ ] `docs/demo/hive-demo.mp4`
- [ ] `docs/DEMO_USERS.md`
- [ ] All ten documents from Plan 10
- [ ] All eight diagrams
- [ ] `docs/performance.md` with real numbers
- [ ] `docs/qa-log.md`
- [ ] Deployed backend URL in the README
- [ ] `git shortlog -sne` reflects the actual contribution reality

### Submission status table

Add to `docs/progress-report.md`, mirroring `report.md`:

| Deliverable | Status |
|---|---|
| Working mobile app (Expo) + Express API | |
| Full photo loop (upload → tag → feed → order) | |
| Private storage with signed URLs | |
| Role-based access control | |
| Automated tests (36) + CI | |
| Deployed backend + health checks | |
| Load test results | |
| Demo video | |
| Seeded demo users | |
| Documentation + diagrams | |
| EAS preview APK | |

---

## Step 7 — Pre-demo checklist (day of)

- [ ] **Hit the backend URL 5 minutes before** — Render free tier sleeps after ~15 min idle and takes 30–60 s to wake. **This is the single most likely demo failure.**
- [ ] `pnpm seed:demo:reset` for clean data
- [ ] Verify OTP delivery once
- [ ] Demo device charged, notifications silenced, brightness up
- [ ] Backup device with the APK installed
- [ ] Video fallback accessible offline
- [ ] Diagrams open in a tab
- [ ] `pnpm test` run once so it's warm

---

## Commit sequence

```
test(load): add k6 load test suite with scenarios and thresholds
docs(performance): record load test results and scaling assessment
docs(qa): add manual QA log and results
docs(demo): add demo script and anticipated questions
docs(demo): add recorded walkthrough video
chore(submission): add preview APK and finalise submission pack
```

---

## Done when

- [ ] Load tests run against the deployed backend with recorded results
- [ ] Before/after payload improvement measured and written up
- [ ] Full manual QA passed; every failure fixed or logged
- [ ] Security checks pass against the deployed instance
- [ ] Supabase keys rotated
- [ ] Demo script rehearsed twice
- [ ] Video recorded and committed
- [ ] `main` tagged `v1.0.0`
- [ ] Every submission-pack item present

---

## Deviations

**Only Step 3 was done, by Nagachaitanya**, matching the W23 row in
`PHASE-2-EXECUTION-PLAN.md` §4. Not done: k6 load testing, the full manual QA
pass, the demo script, the video, the submission pack and the pre-demo
checklist — those need a deployed instance and belong to the other three.

**Step 3 became a script, not a checklist.** `scripts/verify-security.sh` runs
the checks against `$BASE_URL` and exits with the failure count so CI can gate
on it. Ten sections: G-02, G-04, G-05, G-08, G-17, the production error shape,
HTTPS and CORS, rate limiting, and repository hygiene. Every check that needs
a token or an ID reads it from the environment and reports **skip** when it is
absent — skips are counted separately from passes, and the summary says
explicitly that a run with skips does not verify `docs/security.md` §4. A
checklist that silently passes when it checked nothing is worse than no
checklist.

**The `/uploads` check is more subtle than the plan's line suggests.** Plan 11
lists `curl https://<backend>/uploads/photos/anything → 404`. That proves
nothing: `express.static` returns 404 for a missing file whether or not the
route is authenticated, so it passes today, while the route is wide open. The
script keeps that check but adds one gated on `REAL_S3_KEY` — fetching a path
that *does* exist — and labels it as the check that actually tests G-02.

**Rate limiting is opt-in** behind `RUN_RATE_LIMIT_CHECK=1`. Sending 120
requests at a free-tier instance is slow and consumes the limiter's window,
which is the last thing wanted shortly before a demo.

**Key rotation has not been done.** Audit S-15 — the project ref
`fhvwsmtivwtmbdscdoyz` at `supabase/README_MIGRATIONS.md:20` — still stands.
Rotating requires Supabase dashboard access and there is nothing deployed to
update afterwards. It is recorded in `docs/security.md` §7 as an open item.

### Not verified

**The script has never been run against a real instance.** Nothing is deployed
and there is no `.env`, so there is no backend to point it at. It has been
syntax-checked and executed end to end against an unreachable host to confirm
the control flow, skip handling and summary work, and its repository-hygiene
section — the only part that needs no server — passes.

That section earned its place immediately: it found `Admin@123` still
documented in a comment at `supabase/seed.sql:9`, which the earlier manual
grep had missed by scoping itself to `packages/` and `apps/`.

Everything in Step 3's checklist that requires HTTP remains unverified.
