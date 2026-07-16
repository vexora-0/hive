# Security Design

Written after a full codebase audit that found 46 gaps, three of them critical.
This documents the model, what was wrong, and what closed it.

## Threat model

**Assets** — children's photographs; children's names, dates of birth and class
enrolment; parent contact details; order and address data.

**Actors** — unauthenticated internet; a parent (legitimate, scoped to their own
children); a teacher (scoped to their school); an admin (cross-school); a
compromised or curious authenticated user.

**The property that matters:** a parent must be unable to reach a photo their
own child is not tagged in. Everything else is ordinary application security.

## Authentication

Supabase Auth. Email OTP for parents and teachers; password for admin and demo
accounts. **No custom cryptography anywhere** — password hashing is entirely
Supabase's bcrypt.

Sessions persist through an `expo-secure-store` adapter, so refresh tokens sit
in the iOS Keychain or Android Keystore rather than plain AsyncStorage.

Tokens are verified server-side on every request; the API then loads the user's
role and school from `profiles` rather than trusting any client claim.

## Authorization — defence in depth

| Layer | Purpose | Trusted |
|---|---|---|
| `RoleGate` (client) | Don't render a screen the user can't use | **No** |
| `roleGuard` + ownership checks (API) | The real control | **Yes** |
| Row level security | Last line; protects direct Supabase access | **Yes** |

**The architectural fact that drives all of this:** the API holds the
service-role key, which is exempt from RLS by design. The 505-line policy set
protects only the queries the mobile client makes directly. Every endpoint must
therefore re-implement authorization explicitly — and four did not. That is the
single most important thing to understand about this codebase.

## Findings and remediation

| Severity | Finding | Closed by |
|---|---|---|
| **Critical** | `/uploads` served by `express.static` with no auth; storage bucket public. Every child's photo a permanent public URL. | `security(api): remove the unauthenticated static uploads route` · `security(storage): make the photos bucket private` |
| **Critical** | `getPhotoDetails` took no user — any parent could read any photo by UUID, including its tagged-children list | `security(feed): enforce parent ownership on the photo detail endpoint` |
| **Critical** | No route group checked role; a parent could deep-link into the admin UI | `security(app): guard every role group with RoleGate` |
| **High** | Any teacher could list another school's students, including dates of birth | `security(photos): scope class listings and photo mutations to the caller` |
| **High** | Any teacher could overwrite another teacher's photo by ID | same |
| **High** | Admin seed hardcoded `admin@hive.app` / `Admin@123` and printed the password | `security(scripts): move admin seed credentials to environment variables` |
| **High** | `trust proxy: true` let a client spoof `X-Forwarded-For` and bypass rate limiting | `security(api): trust a single proxy hop` |
| **High** | Raw search interpolated into a PostgREST `or()` filter — clause injection | `security(admin): sanitise user search` |
| **Medium** | Client-declared MIME trusted on upload | magic-byte validation via `sharp` |
| **Medium** | Client IPs and whole error objects logged on auth failure | `security(obs): stop logging client IPs and raw error objects` |

## Specific decisions worth stating

**404, not 403, on cross-family access.** A 403 confirms the resource exists. The
photo detail endpoint returns 404 for a photo that is not yours, so the response
carries no information either way.

**`taggedStudentIds` is filtered to the requesting parent.** Authorisation is not
binary — an authorised viewer still must not learn which *other* children appear
in a photo they can legitimately see.

**Wrong role redirects home, not to login.** Being signed in as the wrong role is
not an authentication failure, and sending someone to a login screen they are
already past is confusing.

## Input validation

Zod at every route boundary, with the parsed result replacing the raw input so
downstream code cannot reach the unvalidated version.

`POST /photos/:id/tag` previously ran with **no validation at all** — a schema
existed but required a field the route took from the URL, so it could never be
wired up. It now validates and caps the array at 50, which bounds the generated
`IN` filter.

## File upload security

Private bucket · signed URLs expiring in one hour · magic-byte verification
rather than the declared type · 25 MB cap enforced at both the multipart layer
and the bucket · HEIC converted to JPEG · storage paths derived from server-side
UUIDs, never client input.

Signed URLs **are bearer tokens** — anyone holding one can read that photo until
it expires. Acceptable at a one-hour lifetime, but it is a real property, not an
absence of one.

## Secrets

`.env`, `.env.local`, `.env.test` are gitignored; only `.example` templates are
committed. A scan for JWT-shaped strings, `AKIA*` AWS keys, `sk_live`/`sk_test`
and password assignments across all source, SQL, JSON and Markdown returned
**zero hits**.

The service-role key is server-only. The anon key in the mobile bundle is public
by design — RLS enforces access for it.

## Known limitations

Stated rather than omitted:

- **The service-role key bypasses RLS.** API authorization is only as good as the
  explicit checks in each service. Mitigated, not eliminated.
- **OTP lockout is client-side only.** The attempt counter lives in component
  state and resets on remount. Real protection is Supabase Auth's rate limits.
- **No audit log.** Role changes, parent mappings and deletions are logged to
  stdout but not persisted.
- **No 2FA**, and no password reset flow for the admin account.
- **Rate limiting is per-instance and in-memory** — it does not hold across
  multiple instances.

## Verification

`docs/environment-setup.md` §7 carries the runtime checklist: an unsigned photo
URL must 403, a cross-family photo request must 404, a cross-school student
listing must 403. **These have not yet been executed** — the fixes are written
and compiled, not proven.
