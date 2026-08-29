# Hive - A Privacy-First Photo Sharing Platform for Preschools

**Project summary for the viva supervisor**

| | |
|---|---|
| Programme | BSc Computer Science (Online Mode), BITS Pilani |
| Academic year | 2025-2026 |
| Internal supervisor | Prof Raj Kumar |
| Team | Dharma Srujan Reddy (2023ebcs634), Vanapala Naga Chaitanya Varma (2023ebcs662), Chikoti Ruthwik (2023ebcs675), Munigonda Bhargav (2023ebcs724) |
| Repository | https://github.com/vexora-0/hive |
| Demonstration video | https://youtu.be/_kvid-1KXxA |

---

## 1. What Hive is

Hive is a mobile application and API that lets a preschool share classroom photographs with parents. A teacher photographs the day and tags which children appear in each image. Each parent then opens the app and sees only the photographs their own children appear in. Parents can also read a diary covering one child's whole time at the school, and order prints of anything they can see. Administrators manage schools, classes, students, users and the parent-to-child links. The system runs as an Expo React Native application talking to an Express and TypeScript API over a PostgreSQL database provisioned through Supabase.

## 2. The problem, and why the obvious solution fails

Preschools already share photographs with parents. They do it through a shared album, a WhatsApp class group, or a folder link. All three work, and all three have the same defect: every parent sees every child. In a setting where every subject is a three-year-old, that is not an inconvenience, it is a safeguarding failure. A parent receives the face, the name and the daily routine of twenty other people's children, and the school has no record of who saw what.

The requirement that defines this product is one sentence: a parent must see photographs of their own children and nothing else. Not mostly, and not unless someone guesses an identifier. Three consequences follow, and they account for most of the design.

1. Access control cannot live in the client, because the client is not trustworthy.
2. Photograph URLs cannot be public or guessable, because a URL that leaks is a permanent leak.
3. The visibility rule is a join across families and photograph tags, not a filter applied to a list that was already assembled.

The third point is where the obvious alternatives break. A shared album is permissive by construction and gets a filter bolted on top. The default answer is "show it", and privacy is whatever the filter remembers to remove. Any bug in that filter, any new screen that forgets to apply it, any endpoint written in a hurry, and the failure mode is exposure of every photograph to every parent.

## 3. Unique Value Proposition

**Hive inverts that default. A parent has no relationship to a photograph anywhere in the database, so the failure mode of a mistake is showing nothing rather than showing everything.**

A parent reaches a photograph only by walking a four-hop chain:

```
profiles (parent)
  -> parent_student_mappings
       -> students
            -> photo_student_tags
                 -> photos
```

There is no parent_id column on photos. There is no class-wide visibility rule. There is nothing to filter, because there is no permissive set to filter down from. Every photograph a parent sees is the result of a join that had to be written correctly for any row at all to come back. A dropped WHERE clause in a feed query does not widen the result set, it empties it. A new endpoint that forgets the privacy rule does not leak, it returns nothing and is caught the moment anyone opens the screen. That is the property a shared album, a messaging group and a generic photo app structurally cannot have: their storage model already holds a direct link between the viewer and the whole collection, and their privacy is a subtraction from it.

`photo_student_tags` is the pivot, and its consequence is deliberate. A photograph with no tags is invisible to every parent in the system, which is why tagging happens before a photograph is marked ready, and why the database trigger that notifies parents fires on that transition and not on upload.

Three further properties follow from the same commitment, and none of them is available from a folder link.

**Photographs are never at a public address.** The storage bucket is private. The application never holds a permanent URL. It receives a signed URL with a one-hour lifetime, minted per request, and only after the API has verified who is asking. There is no address to forward, screenshot or index that still works tomorrow.

**Authorization is enforced on the server and nowhere else that counts.** The API authenticates to the database with a service-role credential that bypasses row-level security by design, so the row-level policies protect only the handful of queries the app makes to the database directly. Every API endpoint therefore re-derives authorization in its service function, and every resource fetched by identifier is checked against the caller. Client-side route guards exist, but they are treated as a convenience for the user interface and are trusted with nothing.

**The boundary is measured, not asserted.** Two parent accounts were signed in against the same seeded dataset of six photographs. One saw two, the other saw one, and the overlap between them was zero. No account saw all six. That is the product's central claim, expressed as a number that a supervisor can reproduce from the repository.

## 4. What was built

**Roles.** Teacher: upload photographs to a class and tag the children in each. Parent: a privacy-scoped feed of what arrived, a per-child diary covering that child's whole time at the school read forwards month by month, in-app notifications, and print orders. Administrator: schools, classes, students, users and parent-to-child mappings.

**Backend.** Express and TypeScript, 42 endpoint registrations across 7 domains. Zod validation at every route boundary, cursor pagination on every list endpoint, a uniform response envelope, per-identity rate limiting, and a request pipeline that verifies the token, loads the caller's role and school, rejects the wrong role, validates the body and only then reaches the service layer where the ownership checks live.

**Database.** PostgreSQL through Supabase: 10 tables, 20 migrations, row-level security policies and triggers. Parent notifications are generated by a database trigger rather than application code, so they cannot be skipped by a caller.

**Storage and images.** Supabase Storage with a private bucket and one-hour signed URLs. Uploads are checked by magic bytes rather than by the client-declared content type. `sharp` produces a thumbnail, a blurhash placeholder and the recorded dimensions synchronously, in roughly 100 to 300 milliseconds, which replaced a job queue that had been designed but never actually invoked.

**Mobile.** Expo SDK 54, React Native 0.81, expo-router with routes grouped by role, Zustand for client state and TanStack Query for server state, over an in-house design system.

**Ordering.** Money is held in integer minor units throughout, so a 4x6 print is 3000 paise and displays as 30 rupees. Prices are set on the server and never taken from the client. Order creation is transactional, and Redis holds an idempotency key so a retried submission produces the same order rather than a second one. Redis is used for that and nothing else.

**Scale of the work.** 461 commits from 4 contributors between 1 February and 20 August 2026, across 245 TypeScript and TSX source files, roughly 44,350 lines.

## 5. How it was validated

An audit partway through the project enumerated 46 defects, and the second phase of work was spent remediating them. The most serious were all the same shape: an API that authenticates as the service role will leak unless each endpoint re-derives authorization for itself. Cross-family photograph metadata was readable by any parent, another school's student roster including dates of birth was readable by any teacher, the uploads directory was served with no authentication at all, and the ordering flow was non-functional because the client, the validator and the database disagreed three ways.

Validation rests on four things.

**364 automated tests.** 247 backend integration tests across 9 files, executing against a real PostgreSQL instance rather than mocks, so a broken authorization check fails a test instead of passing a stub. Plus 117 mobile unit tests. Lint, typecheck, build, the full backend suite and a container image build all run on every push, and every one of them blocks a pull request.

**A scripted security verification.** `scripts/verify-security.sh` covers static route removal, cross-family and cross-school access, tag leakage, same-school ownership, role separation, CORS origin reflection and a repository secret scan. It reports 29 passed, 0 failed, 1 skipped. The single skip is the HTTPS check, which needs a deployed origin. A skip is recorded as a skip and not counted as a pass.

**A sabotage exercise.** A passing test suite proves nothing until it has been made to fail on purpose. One line, the uploader comparison inside the photograph access guard, was deleted and the suite re-run. Exactly the tests that target that guard failed and nothing else moved. The exercise also found a test that had never verified the property its name claimed, because both of its accounts belonged to different schools and the school check refused first, so the ownership check under test never executed.

**Running the application.** The system was driven end to end on a physical Android handset and on a physical iPhone. That surfaced a class of defect nothing else reached, including a render loop in which the root layout returned null while authentication loaded, destroyed its own navigator, and re-mounted 145 times in a single session with no crash and nothing in the logs.

## 6. What was deliberately not done

These are decisions, and they are recorded as decisions rather than left implicit.

**Nothing is deployed.** There is no hosted URL and no distributable binary. The system is demonstrated locally and on physical hardware over a local network, and the container image is built and tested on every push, so provisioning a host is a configuration step rather than development work. Two things follow and are stated plainly: the HTTPS security check stays skipped, so the honest score is 29 passed, 0 failed, 1 skipped and never 30 out of 30, and the load figures are a local measurement labelled as such.

**No capacity figure is claimed.** The single-user load profile passes every threshold, with a twenty-photograph feed page transferring 3,908 bytes. At fifty virtual users the binding constraint was the application's own per-identity rate limiter rather than the application itself, so no unconstrained throughput number was obtained, and none has been estimated to fill the gap.

**Server-side HEIC conversion does not work**, and the reason is external: the prebuilt libvips that `sharp` ships has no HEVC decoder, while an iPhone HEIC is HEVC-coded. The device transcodes to JPEG before upload instead, and a HEVC file that reaches the server anyway is refused with a message a teacher can act on.

**Out of scope by choice**, from the beginning: payment gateway integration, push notifications, offline mode, video, multi-language support and tablet-optimised layouts.

Known limitations are stated in the report rather than omitted, and they include an image pipeline that does not yet apply EXIF orientation, administrator actions that are logged to standard output but not persisted as an audit trail, and signed URLs which, for their one-hour lifetime, are bearer tokens like any other.

## 7. Links

- Repository, public: https://github.com/vexora-0/hive
- Demonstration video: https://youtu.be/_kvid-1KXxA
