# UI Revamp — Handoff and Review Map

The revamp lives on `revamp/ui`. It crosses the ownership map in
`docs/02-FOUR-PERSON-DEVELOPMENT-AND-GIT-PLAN.md` §7, which `CLAUDE.md` §6 says requires
the owner's review. **Commits are split by owning area so each owner reviews and lands
their own**, rather than one person merging work across four people's files.

Read `docs/design/UI-REVAMP-BRIEF.md` first — it is the ground truth every commit was
built against, including the 50-item rubric each screen was checked against.

---

## Who reviews what

| Area | Owner | What changed |
|---|---|---|
| `theme/**`, `components/**` | **Bhargav** | The design system: palette, type scale, motion tokens, and every shared component |
| `app/_layout.tsx` | **Nagachaitanya** | Two additional Fraunces cuts registered with `useFonts` |
| `app/(auth)/**`, `features/auth/**` | **Nagachaitanya** | Sign-in, OTP, onboarding, profile |
| `app/(admin)/**`, `features/admin/**` | **Nagachaitanya** | Admin console |
| `app/(parent)/**`, `features/parent/**`, `features/orders/**` | **Ruthwik** | Parent feed, photo detail, orders |
| `app/(teacher)/**`, `features/teacher/**` | **Ruthwik** | Teacher dashboard and upload |
| `docs/design/**` | **Srujan** | The brief and this file |

Feature-component ownership follows `docs/02-…` §7; where a plan assigned a file to
someone else, defer to that document.

---

## How to land your area

```bash
git fetch
git log --oneline main..origin/revamp/ui        # the commits, newest first
git show <sha>                                   # read yours
git checkout main && git cherry-pick <sha>       # land it under your own name
```

Every commit message ends with an `Area:` line naming the owner, so
`git log --grep "Area: Bhargav"` finds yours.

If you would rather not cherry-pick, review the branch and say so — but **do not let
someone else commit under your name**. The git history is what a capstone's individual
contribution is assessed from, and an author field that says you wrote something you have
not read is worth less than an honest one.

---

## What to look hard at when you review

**Bhargav — the design system.** The palette moved on measured grounds, not taste. Five
values that were in use as text failed WCAG AA on paper and are now fixed: rose 3.05:1,
leaf 3.23:1, `warning.main` 2.54:1, `error.main` 4.04:1, and the ink ramp's chroma
climbing to C\*25.9. Check that nothing you own still sets type in a `.light` value, and
that `colors.primary.amber` never carries text anywhere — it is 2.03:1 and the rule is
that it is a surface only. The token **key names are unchanged on purpose** so the app
re-skins from `theme/colors.ts`; if you disagree with a value, change the value, not the
key.

**Nagachaitanya — `_layout.tsx` and auth.** The only change to `_layout.tsx` is two extra
font cuts (`Fraunces_300Light`, `Fraunces_400Regular_Italic`) passed to `useFonts`. Both
ship inside the `@expo-google-fonts/fraunces` package already pinned in `package.json`, so
this is **not** a dependency change and needs no team agreement — but it does gate the
splash screen, so confirm the app still boots if a font fails to load.

**Ruthwik — parent and teacher.** Two real bugs were fixed in your areas' dependencies,
both worth understanding rather than just accepting:
- `MasonryGrid` had `optimizeItemArrangement` on, which lets FlashList reorder items to
  level the two columns. It was **silently breaking chronological order in the feed**. It
  never threw and no test caught it.
- `expo-image` in a recycled list without a `recyclingKey` briefly paints the *previous*
  photo into a recycled tile. In an app whose whole premise is that a parent sees only
  their own child, that reads as a privacy breach.

---

## Deviation, recorded

`CLAUDE.md` §10 says "Do not redesign the UI. The design system is good." This branch
departs from that on the product owner's explicit instruction. The line still stands for
everyone else, and this file plus `UI-REVAMP-BRIEF.md` §11 are the record of why it was
crossed here.
