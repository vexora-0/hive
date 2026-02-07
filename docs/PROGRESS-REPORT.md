# Hive — Development Progress Report

**Team:** Ruthwik · Bhargav · Srujan · Nagachaitanya
**Project:** Hive — a privacy-first photo sharing platform for preschools
**Repository:** github.com/vexora-0/hive
**Phase 1 development period:** 1 February 2026 – 1 May 2026

---

## About the project

Hive lets preschools share classroom photos with parents without compromising any child's privacy. Teachers upload photos organised by class and tag which children appear in each one. Each parent then sees a feed containing **only** photos their own child is tagged in — never another family's. Parents can also order prints, frames and albums.

Administrators manage the underlying structure: schools, classes, students, teacher assignments, and the parent-to-child links that drive the entire privacy model.

**Stack:** React Native (Expo SDK 54) · Node.js + Express + TypeScript · PostgreSQL via Supabase for data, authentication and object storage · Zustand and TanStack Query for client state · pnpm workspaces with Turborepo.

---

## Note on this report and the repository history

The original local Git repository was lost when the development laptop failed. The code survived and was recovered, but the commit history did not. On 3 March 2026 the recovered codebase was uploaded to GitHub as a single snapshot commit (`1bfe1d9`). That upload was a **recovery action, not a development milestone**.

This report and the accompanying Git history were reconstructed afterwards from the recovered codebase.

- **The code is authentic.** Every file is byte-for-byte what the team wrote, verified against the recovered snapshot.
- **Commit boundaries, dates and per-commit authorship are reconstructed**, not recovered. They reflect the team's account of how work was divided, mapped onto the module dependency order the code itself demonstrates.
- **The original snapshot is preserved** on the `backup/original-import` tag and branch and in an offline bundle, so the pre-reconstruction state remains fully recoverable.
- Because the 3 March snapshot already contained the complete application, commits dated after it describe code that existed by that date. The dates express the development sequence, not verified timestamps.

This is stated plainly so the history is read for what it is: an accurate record of *what* was built and by whom, with reconstructed timing.

---

## How we worked

We ran the backend and mobile tracks in parallel from week one rather than finishing one before starting the other, so nobody sat idle waiting on another layer and integration problems surfaced early.

| Member | Primary areas |
|---|---|
| **Ruthwik** | Backend architecture and API services — photos, feed, orders, storage, jobs, server assembly; and the mobile service and hook layer consuming those APIs |
| **Bhargav** | Mobile application — design system, component library, navigation, media, feature screens, app shell; repository tooling |
| **Srujan** | Data layer across the stack — schema, migrations, RLS, triggers, indexing, validation on server and client, data-entry components |
| **Nagachaitanya** | Authentication and authorisation end to end, notifications, admin console (API and UI), client–server integration |

Areas overlap deliberately: Ruthwik wrote both the order API and the client hooks calling it; Srujan owned validation on both sides; Nagachaitanya owned authentication from the database trigger through to the login screen.

---

# Week 1 — Project Foundations & First Tables

**Dates:** 1 February 2026 – 7 February 2026
**Commits:** 12 — Ruthwik 1, Bhargav 4, Srujan 3, Nagachaitanya 3

## Phase objective

Establish the repository both applications would live in, and begin the relational schema. The data model came first because nothing could be built against an unsettled schema.

## Individual contributions

**Bhargav** set up the monorepo — pnpm workspace layout, Turborepo task graph — and scaffolded the Expo application with Expo Router, the eight path aliases used throughout the client, and the icon and splash assets. **Nagachaitanya** configured the shared ESLint, Prettier and commitlint tooling, and designed the `profiles` table linking to Supabase `auth.users`. **Ruthwik** scaffolded the backend package: strict TypeScript with `@/*` aliases, the dependency set, and build and watch scripts. **Srujan** began the schema with the required Postgres extensions, the `schools` table as the top-level tenant, and `classes`.

## Important technical implementation

The monorepo uses pnpm workspaces with Turborepo rather than a single package, so the API and the app can be built and typechecked independently while sharing lint and commit conventions. Both packages run TypeScript in strict mode from the first commit.

## Issues and challenges

Deciding whether classes should belong to schools or exist independently. Scoping them to a school made every downstream authorisation check simpler, since a teacher's school membership then implies which classes they can touch.

## Testing and validation

Migrations applied against a clean Supabase project; both packages confirmed to install and typecheck.

## Relevant commits

```
chore: initialize pnpm monorepo with turborepo pipeline
chore: add eslint and prettier configuration
chore: enforce conventional commits and ignore rules
chore: scaffold express backend package
chore: scaffold expo application with expo router
chore: add mobile environment template and ignore rules
chore: add app icons, splash and lottie assets
feat(db): enable required postgres extensions
feat(db): add schools table
feat(db): add profiles table linked to supabase auth
feat(db): add classes table
```

## End state

A working monorepo and the first three tables of the schema.

## Next week

The privacy model — parent-student mappings and photo tagging.

---

