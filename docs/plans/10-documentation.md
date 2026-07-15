# Plan 10 — Documentation & Diagrams

**Branch:** `docs/submission`
**Size:** L (~1 day)
**Depends on:** Plans 01–09 (document what exists, not what was intended)
**Closes:** G-22, G-43

---

## Goal

Produce the documentation an evaluator actually reads, in the format this course expects.

**The format is known.** `report.md` in the repo root is a progress report from a different project (SkillSwap — `CodeMaverick2/skillswap`, team Tejas/Rushil/Aayush/Harsh) and serves as a **template**. It shows the expected shape: what we're building → features → work split → week-by-week log → submission status table → backlog with issue links → next steps. Mirror that structure for Hive.

---

## Step 1 — Rewrite the README (G-22) — **do this first**

**The finding:** `README.md` describes a **different application**. It claims:

| README says | Reality |
|---|---|
| Mobile: **Flutter** (`:23`) | React Native 0.81 + Expo SDK 54 |
| State: **Provider / Riverpod** (`:27`) | Zustand + TanStack Query |
| Structure: `lib/screens`, `lib/widgets`, `lib/providers`, `lib/models` (`:31-51`) | `src/app`, `src/features`, `src/components`, `src/theme` |
| "Flutter SDK" prerequisite (`:59`) | Not used |
| Signed URLs + RBAC (`:17`) | Only true **after Plan 03/04** |
| Push notifications (`:16`) | Not implemented — in-app only |
| CDN layer (`:86`) | Not configured (Supabase Storage provides one) |

**An evaluator reads the README first.** A Flutter README on a React Native repo undermines everything else before they see a line of code.

**Rewrite covering:** what Hive is and the problem it solves · actual tech stack · real project structure · setup (prerequisites, install, env, migrations, `pnpm seed`, run) · demo accounts (link `DEMO_USERS.md`) · deployed URL and APK · architecture summary with a link to the full doc · testing (`pnpm test`, 36 tests) · security summary · limitations and future scope · team · licence.

**Remove every claim not yet true.** Push notifications and the CDN belong in Future Scope, not Features.

---

## Step 2 — Architecture (`docs/architecture.md`)

Cover:
- **System overview** — Expo app → Express API → Supabase (Postgres + Auth + Storage). Diagram G-1.
- **Monorepo layout** — pnpm workspaces, Turborepo, why a monorepo for two deployables.
- **The two data paths** — this is the most interesting architectural fact in the project and the best viva material:
  - **Path A (API)** — mobile → Express → `supabaseAdmin` (service-role key). **Bypasses RLS**, so authorization is enforced explicitly in the service layer.
  - **Path B (direct)** — mobile → Supabase with the user's JWT (`useChildren`, `useClasses`, `getClassStudents`, `authStore.initialize`). **RLS applies.**
  - Why both exist: complex multi-table reads and server-owned pricing need a backend; simple owned-row reads don't.
- **Request lifecycle** — requestId → helmet → CORS → rate limit → auth → roleGuard → validate → controller → service → Supabase → response envelope.
- **Photo pipeline** — record → upload → sharp (thumbnail, blurhash, HEIC) → private Storage → tag → confirm → triggers → signed URL. Diagram G-4.
- **Key decisions with trade-offs** — one paragraph each:
  - Supabase Storage over S3/Cloudinary (DEC-1)
  - Synchronous `sharp` over a BullMQ queue (DEC-2) — *explicitly state you removed a queue rather than added one, and why that was the better engineering call at this scale*
  - Cursor over offset pagination
  - Integer cents (DEC-6)
  - Redis retained only for idempotency (DEC-3)

---

## Step 3 — Database (`docs/database.md`)

- **ER diagram** (G-2) — 10 tables. Use [dbdiagram.io](https://dbdiagram.io) or Mermaid `erDiagram`.
- **Table-by-table** — purpose, key columns, relationships. Much of this can be lifted from the `COMMENT ON` statements already in the migrations, which are genuinely good.
- **The privacy model** — `photo_student_tags` is the pivot. A parent sees a photo only when a row links it to a student who is linked to them via `parent_student_mappings`. Say this plainly; it is the core of the product.
- **Indexing strategy** — explain two specific choices, since they show real thought:
  - `idx_photos_class_feed (class_id, status, created_at DESC, id DESC)` mirrors the feed's exact `ORDER BY`.
  - `idx_pst_student_id INCLUDE (photo_id)` enables an index-only scan for the feed join.
- **RLS** — the four `SECURITY DEFINER` helpers and the policy set, **with the honest caveat** that the API path bypasses them and re-implements the rules in the service layer.
- **Triggers** — `set_updated_at`, `handle_new_user`, `notify_parents_on_photo`, `notify_teacher_on_upload_complete`. Note that the last one requires tags to exist *before* the status flips (Plan 05) — a genuinely interesting ordering constraint.
- **Migration list** — 00001 through the final number, one line each.

---

## Step 4 — API reference (`docs/api.md`)

All ~22 endpoints. For each: method, path, auth, role, request schema, response shape, error codes.

Document the conventions once at the top:
- Success `{ success: true, data }`
- Paginated `{ success: true, data, cursor }`
- Error `{ success: false, message, code }`
- Auth: `Authorization: Bearer <supabase-jwt>`
- Cursor: base64url of `{ createdAt, id }`
- Idempotency: `X-Idempotency-Key` on `POST /orders`

**Consider generating it** with `zod-to-json-schema` from the existing validators. Optional, but it guarantees the docs match the code and is a nice thing to mention.

---

## Step 5 — Security (`docs/security.md`)

**This is your strongest differentiator.** Most student projects have no security section. You have a real audit, findings with severities, and fixes with commits.

Structure:
1. **Threat model** — assets (children's photos, PII), actors (parent, teacher, admin, unauthenticated), trust boundaries.
2. **Authentication** — Supabase Auth, email OTP, password for admin/demo, JWT verification, SecureStore. Note explicitly: **no custom crypto anywhere** — password hashing is entirely Supabase's bcrypt.
3. **Authorization — defence in depth:**
   - Client `RoleGate` — UX only, never trusted
   - Server `roleGuard` + explicit ownership checks — the real control
   - RLS — last line, protects Path B
4. **Findings and remediations** — a table of the audit's issues with severity, fix, and the commit that closed each. Include the three criticals: unauthenticated `/uploads`, photo-detail IDOR, absent route guards.
5. **Input validation** — Zod at every boundary; PostgREST filter injection and its fix.
6. **File upload security** — MIME magic-byte verification, size limits, private bucket, signed URLs.
7. **Secrets** — `.env` gitignored, no committed credentials (state that a scan for JWT/AWS/Stripe patterns returned zero hits — that is a real result worth reporting), service-role key never client-side.
8. **Known limitations** — OTP lockout is client-side only (`useOTP.ts` state resets on remount) and real protection is Supabase's rate limits; no audit log; no 2FA. **Honesty here reads as maturity.**

---

## Step 6 — Testing (`docs/testing.md`)

Strategy and why: high-value tests over coverage percentage. The 36-test matrix, grouped, each mapped to the defect it guards. How to run. What is **not** tested and why (no E2E — Detox setup exceeded the budget; manual QA script instead). Include the **sabotage verification** from Plan 08 — reverting four fixes and confirming the expected tests fail. That is a genuinely strong thing to show.

---

## Step 7 — Deployment (`docs/deployment.md`)

Topology diagram (G-7). Prerequisites. Supabase setup (project, migrations, storage bucket, **custom SMTP** from Plan 01 Step 8). Backend on Render with the full env table. Mobile EAS build. CI pipeline. Health checks and monitoring. Rollback. Note the free-tier cold-start behaviour.

---

## Step 8 — Performance (`docs/performance.md`)

Populated by Plan 11's load tests. Structure it now:
- **The headline** — feed payload before vs after thumbnails. This is your single most persuasive number.
- Load test methodology (k6, scenarios, VU counts).
- Results: p50/p95/p99, throughput, error rate.
- Identified bottlenecks and honest scaling limits — the audit's assessment: comfortable at 100 concurrent, degrades beyond, 10,000 would need re-architecture and **is not a target for this project**. Saying that is stronger than claiming otherwise.
- Optimisations made: thumbnails, single-join feed query, batched admin counts, upload concurrency limit.

---

## Step 9 — Limitations & future scope (`docs/limitations.md`)

Per DEC-10, document as deliberate scope, not omissions:

**Out of scope by design**
- Payments — orders are *requests*, not purchases. **State this as a scoping decision**; it turns a perceived gap into a considered boundary.
- Push notifications — in-app only.
- Photo download, captions, untagging, admin order fulfilment, parent cancellation, profile editing.
- Dark mode (palette has `navyDark`/`navyMedium` ready), tablet layouts (`supportsTablet: false` — phone-first is deliberate).

**Known technical limitations**
- OTP lockout is client-side only.
- Unused columns: `photos.caption`, `students.avatar_url`, `schools.logo_url`.
- Upload progress is step-based (if Plan 07 Step 5 was skipped).
- Photo deduplication via SHA-256 was designed (`idx_photos_dedup`) but the client never computes the hash; `00016` relaxed the constraint accordingly.
- Free-tier cold starts.

**Future scope** — a short prioritised list.

---

## Step 10 — Progress report (`docs/progress-report.md`)

Mirror `report.md`'s structure for Hive:
1. What we are building.
2. Features built, grouped by role.
3. How we split the work.
4. Week-by-week log.
5. Submission status table.
6. Next / future scope.

**On the work-split and week-by-week sections — be accurate.** The audit found the repository is a single commit by a single author. Whatever the four of you actually did, describe *that*. A reconstructed week-by-week log that git history contradicts is worse than a brief honest one, because the evaluator can check and because each of you will be asked about your own contributions in the viva.

If the plan changes and the team does divide the remaining work, `docs/02-FOUR-PERSON-DEVELOPMENT-AND-GIT-PLAN.md` is ready to drive it and the log can then be genuine.

---

## Step 11 — Diagrams

| # | Diagram | Tool | Notes |
|---|---|---|---|
| G-1 | System architecture | Mermaid | App → API → Supabase; show both data paths |
| G-2 | ER diagram | dbdiagram.io or Mermaid `erDiagram` | 10 tables |
| G-3 | Auth sequence | Mermaid `sequenceDiagram` | OTP → `auth.users` → `handle_new_user` → profile → role route |
| G-4 | Upload sequence | Mermaid | record → upload → sharp → Storage → tag → confirm → triggers → notifications |
| G-5 | Feed data flow | Mermaid | tags → ownership check → joined query → signed URLs |
| G-6 | User flow map | Excalidraw / Figma | Three role journeys |
| G-7 | Deployment topology | Mermaid | Expo/EAS → Render → Supabase → Sentry |
| G-8 | Order + idempotency sequence | Mermaid | Redis lock, cached replay, 409 on concurrent |

**Write G-1, G-3, G-4, G-5, G-7 and G-8 as Mermaid inside the markdown files.** They render natively on GitHub, they diff in review, and they cannot go stale in a way nobody notices. Export PNGs only if the report requires images.

---

## Step 12 — Documentation index

Add a `docs/README.md` linking every document, and link it from the root README. Ensure `docs/01-PROJECT-AUDIT-AND-COMPLETION-PLAN.md`, `docs/02-…`, and `docs/plans/` are all reachable — the audit and plans are themselves evidence of engineering rigour and should be visible, not buried.

---

## Verification

- [ ] README describes React Native, not Flutter
- [ ] Every command in the README works from a clean clone
- [ ] Every documented endpoint exists; every existing endpoint is documented
- [ ] Every Mermaid diagram renders on GitHub
- [ ] No documented feature is unimplemented
- [ ] Every stated limitation is genuinely a limitation
- [ ] A person who has never seen the repo can set it up from the README alone — **test this on a teammate**

---

## Commit sequence

```
docs: rewrite README to reflect the actual React Native and Expo stack
docs: add architecture overview and system diagrams
docs: add database design, ER diagram and RLS explanation
docs: add complete API reference
docs: add security design, threat model and remediation record
docs: add testing strategy and results
docs: add deployment guide and rollback procedure
docs: add performance analysis and scaling assessment
docs: add limitations and future scope
docs: add progress report and documentation index
```

---

## Done when

- [ ] All ten documents written
- [ ] All eight diagrams complete and rendering
- [ ] README verified from a clean clone by someone else
- [ ] Docs index links everything
- [ ] Merged into `develop`

---

## Deviations

**Only Step 5 and diagram G-3 were done, by Nagachaitanya**, matching the W22
row in `PHASE-2-EXECUTION-PLAN.md` §4. `docs/security.md` covers all eight
sections Step 5 asks for. The G-3 auth sequence is inline Mermaid in that
file's appendix rather than in `architecture.md`, which does not exist yet —
it belongs with the authorization narrative it illustrates, and can be moved
or cross-linked when Step 2 lands.

Not done: Steps 1–4 and 6–12 (README, architecture, database, API reference,
testing, deployment, performance, limitations, progress report, the other
seven diagrams, documentation index). Those are Bhargav's and Srujan's.

**Step 5's item 7 asked to state that a secret scan returned zero hits. It did
not, at first.** `git grep` for `Admin@123` found a live hit in
`packages/backend/src/scripts/seedAdmin.ts` — Plan 01 Step 4, which the W14
schedule leaves unassigned. Rather than write a security document claiming no
committed credentials while one sat in the tree, Step 4 was implemented (commit
`security(scripts): move admin seed credentials to environment variables`). A
second hit in `supabase/seed.sql:9` surfaced later, when `verify-security.sh`
scanned the whole repository rather than just `packages/` and `apps/`.

The scan result reported in §7 is therefore real and current: zero JWTs, zero
AWS keys, zero Stripe keys, zero PEM blocks, zero tracked `.env` files, zero
hardcoded credentials.

**`docs/security.md` reports open findings as prominently as closed ones.**
Step 5's structure implies a remediation record; the document also carries an
Open table, and states outright that **G-02 — `/uploads` served with no
authentication — is more serious than anything the document reports as
fixed**. Without that, a reader would reasonably conclude from §4 that photos
are protected. They are not, until Plan 03 lands.

Likewise §8 records that none of the §4 remediations have been verified
against a running system, and that the test suite has never executed. Step 5's
note that "honesty here reads as maturity" is taken at face value.
