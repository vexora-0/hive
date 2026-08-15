# Hive — UI Revamp Brief

**This file is the single source of truth for the revamp.** Every implementation agent
builds against it and the verifier judges against it. If a screen and this file
disagree, the screen is wrong.

Grounded in a four-axis research sweep (competitor teardown, visual language, motion,
photo-feed/role UX) covering Brightwheel, Procare, Tadpoles, Lillio, Famly, Storypark,
Kinderpedia, ClassDojo, Kangarootime, Tinybeans, FamilyAlbum, Chatbooks, Artifact
Uprising, Lovevery, Maisonette, Google Photos, Apple Photos, Frame.io, Glass and
Linear. Colour and type figures marked **[measured]** were computed from the repo's own
tokens in CIE LCh and WCAG contrast, not asserted.

---

## 1. Why this exists

`CLAUDE.md` §10 says "Do not redesign the UI." This revamp was explicitly requested by
the product owner and overrides that line **for this branch only**. Recorded as a
deviation in §11.

## 2. What the app actually is

A **keepsake**, not a learning tool. A parent opens Hive to see what their child did
today, and occasionally to order a print. Teachers upload and tag. Admins keep the
roster straight.

**None of Hive's users are children.** Parents, teachers and admins are the users; the
child is the *subject*. Warmth belongs in the photography, the ground and the copy —
never in the chrome. That single reframe is what keeps "playful" from becoming
"childish".

---

## 3. The direction

> **A child's photograph, mounted like a print on warm paper, in an app whose chrome is
> as calm as a good camera app — one marigold, one ink line, and nothing else competing
> for the frame.**

*Mounted* — the photo is the subject, given a border to breathe.
*Warm paper* — the ground is a page, never a white screen.
*Calm chrome* — the interface withdraws.
*One marigold* — a single voice, and it is a surface, never a label.

### What the research validated — keep

- **The paper ground `#FDF8F1`.** [measured] L\*97.8 C\*4.0 H83 — inside the band on all
  three coordinates against Tinybeans `#fcf8f5` and Famly `#F7F6F2`. **Do not touch it.**
- **"Marigold is a surface, never a label."** [measured] `#F0A03A` is 2.03:1 on paper —
  it genuinely cannot carry text. Chatbooks reached the identical structure
  independently. Enforce this harder, not less.
- **The two-family radius system.** Photos take `print: 4` / `mount: 6`; only containers
  take 18–36. Artifact Uprising's radius census is dominated by `0`; Lovevery's content
  radii are 2–6px. **Defend this line absolutely.**
- **The `PhotoMount` idea** — a generous border so the image can breathe, square corners,
  both orientations first-class. This is the keepsake mechanism.
- **Fraunces confined to three sizes**, sans doing the work. Four of five premium
  comparators use serif-display + neutral-sans.
- **`ReduceMotion.System` on every motion config**, and `STAGGER_STEP = 45` capped at 8.

### The eight moves

**1 · The photograph becomes the row.** Every competitor subordinates the image to a log
entry — Brightwheel titles the row "Sharing a pic and note" *above* the photo, Procare
stamps all-caps "PHOTO" with a camera sticker. The image **is** the row: no event-type
label, no camera glyph, no type chip, no system-generated title. A photo at true aspect
ratio occupying 60–70% of the viewport so one photo dominates. Teacher's words second,
in ink. Metadata one quiet line. **No competitor occupies this position.**

**2 · The chrome withdraws.** Famly's opaque `#591AB2` bar, Kinderpedia's magenta,
Procare's teal gradient — every screen ~15% brand chrome. Paper-toned headers, no fill,
no in-app logo lockup. The photograph is the only saturated thing on screen. The parent
home opens **directly on the feed** — never a launcher grid.

**3 · The palette collapses to seven families with one voice.** 71 tokens across 52 hex
values today, with duplicates already shipped (`success.main` and `primary.mint` are
both `#4E9A6B`). The accent tier is measurably flat — marigold C\*65.8, rose 50.3, plum
44.5, leaf 38.9, peacock 26.7 — so no colour is the protagonist. Replaced by a four-tier
chroma hierarchy enforced **in the values**, not in a comment (§4).

**4 · Refine the ink; split off a neutral ground for photography.** [measured] Ink
`#14162B` is C\*15.8 — **twice the chroma of its closest comparator** (Tinybeans C\*7.7),
which is why it reads as saturated navy at surface size. Becomes `#181A24` (C\*7.5,
16.40:1 on paper). And a C\*16 violet surround shifts the apparent white balance of a
photograph, so the **photo viewer gets its own near-neutral ground** `#0B0B0C` (C\*0.4).
Tab bar and ink panels keep `ink.900`.

**5 · One icon hand.** Single-weight line family everywhere; **fill reserved strictly for
the selected/active state** so fill carries meaning. Never differentiate icons by hue —
Brightwheel's 12-colour tile grid and Procare's 13 multicolour stickers are the
category's most dating device.

**6 · Typography optics.** [measured] Fraunces x-height ratio 0.482, Jakarta 0.536 — so
the h3 (Fraunces 20) → h4 (Jakarta 17) handover is an optical step of only **5.8%**
despite a 17.6% nominal difference. That is why the sub-heading level reads weak. h3 goes
to **22pt** (optical step 16.4%), plus negative tracking on display sizes.

**7 · Motion recalibrated — subtract, don't add.** `ConfettiOverlay` (40 pieces, 2500ms)
fires on **both** order-success and upload-success; a teacher would see it every working
day, against Apple's HIG rule on frequent interactions. `spring.bouncy` is ζ=0.39 with
26% overshoot and a 655ms settle — toy physics, past NN/g's 500ms "real drag" line.

**8 · Delight comes from meaning, not effects.** FamilyAlbum (18M users, 4.8/5) carries
its entire emotional payload by stamping each photo with **the child's age at the time**.
That costs one date subtraction and does more for a parent than any animation.

---

## 4. Colour

A comment cannot enforce a hierarchy; **chroma tiers can**.

| Tier | Role | Chroma band | Constraint |
|---|---|---|---|
| **1 — The voice** | Marigold only | C\* > 60 | **Surface only. Never text.** Exactly one hue lives here. |
| **2 — Readable accent + semantics** | Accent text, success/warning/error | C\* 34–57 | Must clear 4.5:1 on paper |
| **3 — Identity / role markers** | Rings, dots, initials | C\* 20–36 | Must clear 4.5:1 on paper |
| **4 — Neutrals** | Ink ramp, greys, borders | C\* ≤ 13 | — |

**Paper — keep entirely.** `page #FDF8F1` · `raised #FFFFFF` · `sunk #F4EDE2` · `edge #E9DFD0`

**Ink — refined.**

| Token | Hex | Measured |
|---|---|---|
| `ink.900` | **`#181A24`** *(was `#14162B`)* | C\*7.5 · **16.40:1** on paper · **8.08:1** under ink-on-marigold |
| `ink.800…500` | derive | hold H 285–290, **C\* ≤ 9**, step L\* ≈ +6 |
| `text.secondary` | `#4F5468` | 7.10:1 — keep |
| `text.tertiary` | `#6B7085` | **4.64:1 — the floor.** Nothing lighter carries text on paper. |
| `text.onInk` | `#EDE7DD` | 14.09:1 on `#181A24` |

**Immersive — photo-adjacent only.** `viewer.ground` **`#0B0B0C`** (new, C\*0.4) ·
`overlay.photoFoot` `rgba(11,11,12,0.55)` (white caption measures 8.85:1 over a scrimmed
mid-tone photo). **Applies to:** photo viewer, photo-first hero, lightbox. **Not to:** tab
bar, ink panels.

**Marigold — tier 1, the only voice.** `#F0A03A` (C\*65.8, **2.03:1 — surface only**) ·
ink-on-marigold **8.08:1** (the letterpress button) · `marigold.ink #9C5A10` (**5.12:1**,
the readable form for accent *text*) · `marigold.wash #FDF0DC`.

**Semantic — text-grade values only.** `success #2F7049` (5.62:1) · `warning #8A5100`
(6.10:1) · `error #A32E2A` (6.67:1).
**The `.main` tier may survive as fills only** — `success.main` 3.23:1, `warning.main`
2.54:1, `error.main` 4.04:1 all **fail AA as text today**.

**Identity — tier 3, demoted.** peacock `#17798C`→`#2E6B77` (5.70:1) · leaf `#4E9A6B`
(3.23:1 ✗)→`#3F7355` (**5.24:1**) · plum `#7B5EA7`→`#6A5A85` (5.82:1) · rose `#E0688A`
(3.05:1 ✗)→`#9E4F63` (**5.30:1**).

**Warm paper + cool ink is deliberate.** Famly pairs warm paper with warm near-black;
Tinybeans with a cool violet-charcoal. Hive stays on the Tinybeans side (H≈286) because
warm-on-warm-on-warm collapses into sepia — the nostalgia cliché adjacent to
"pastel-cheap". The slight warm/cool tension is what keeps the ground reading as *paper*
rather than as *filter*.

---

## 5. Typography — keep Fraunces + Plus Jakarta Sans

The research argues **against** changing: four of five premium comparators use
serif-display + neutral-sans. All four refinements below are **zero dependency change** —
`@expo-google-fonts/fraunces@0.4.1` already ships `Fraunces_300Light`,
`Fraunces_400Regular` and all italics.

1. **h3: 20pt → 22pt.** Fixes the 5.8% optical step to 16.4%.
2. **Negative tracking on display, in absolute points** (RN `letterSpacing` is points,
   not em, so it must be scaled per size): **40 → -2.0 · 32 → -1.6 · 25 → -1.0 · 22 →
   -0.9**. Nothing below 20pt gets negative tracking.
3. **`Fraunces_300Light` at ≥32pt only.** Below that it thins out on a classroom-lit
   phone. Hold 600 at 20–25pt.
4. **Italic as the editorial accent voice** — `Fraunces_400Regular_Italic`, exactly one
   line per screen (a child's name, a memory date, an empty-state sentence).

**Correct the code comment:** the shipped Fraunces TTF has no `fvar` — it is a static
instance pinned at SOFT=0 ("Sharp") and WONK=0 ("NonWonky"). The "wonky terminals"
described in `typography.ts` **are not rendering**.

**Voice:** sentence case with full stops in headlines. **Never ALL-CAPS micro-labels** —
they read cold and localise badly into Indian languages.

---

## 6. Illustration language

One hand with the icons. Inline `react-native-svg` (15.12.1, already installed).

- **Icons:** `viewBox="0 0 24 24"`, `strokeWidth={2}`, round cap and join, `fill="none"`.
- **Spot illustration:** drawn on `viewBox="0 0 120 120"` at `strokeWidth={2.5}`, rendered
  at 120–140pt. A 24-grid icon scaled to 120pt would render a 10pt stroke — a blob.
- **Colour:** a **single ink** — `ink.900` on paper, `text.onInk` on ink. Optionally one
  marigold layer at 30% opacity behind the line. **Never a multi-colour fill.**
- **Subject: objects and places, never people.** A paper mount, a folded paper plane, a
  honeycomb cell, a stack of prints, a school gate, a satchel on a hook, an open window.
  **No mascot, no cartoon child, no avatar figure, no Corporate-Memphis people.**
- **Where:** the three empty states, onboarding confirmation, pull-to-refresh, full-screen
  errors.
- **Where it must NOT appear:** any screen that also shows a photograph (an illustrated
  subject competes with the real one and always loses); as an avatar; inside a feed card;
  as decoration on a populated screen. **One per screen maximum.**
- **Decorative** — `accessibilityElementsHidden`; the state must read fully with the
  illustration removed.

---

## 7. Motion

**Vocabulary: damping ratio (ζ)** — the only figure that transfers between M3's tokens,
Reanimated's `{duration, dampingRatio}` and a design conversation.

- ζ 0.85–1.0 — premium soft, settles once
- **ζ 0.7–0.85 — Hive's house register**, one faint overshoot
- ζ ≤ 0.6 — children's toy. Forbidden on anything that travels far.

| Token | Now | To |
|---|---|---|
| `spring.bouncy` | ζ=0.39, 26% overshoot, 655ms | ζ≈0.65, ~380ms — **or delete** |
| `spring.press` | ζ=0.57, comment claims "no overshoot" | **fix the comment**, cap use to press states |
| tab puck (`snappy`) | ζ=0.69, ~5% overshoot | **ζ≈0.9, ~220ms, animate x only** |
| *(missing)* | — | **add exit tokens, 180–250ms** |

**Hard ceiling: 400ms on anything the user waits through; 500ms is an outright fail.**
**Springs for transform only** — `withSpring` on opacity at ζ<1 clamps at 1.0 and visibly
stalls. That is a bug class, not a style preference.

**Budget by frequency:** many-times-daily (tab switch, photo tap) → ≤200ms. Weekly (place
an order) → one crafted 300–400ms moment. Once-ever → the single deliberate flourish.

### Signature moments

1. **The photo open** — `measure()` the tapped tile, animate an absolutely-positioned
   `expo-image` into the full-screen frame at **ζ≈0.85 over 320–380ms**. Reduced-motion:
   a 150ms crossfade, and the detail screen must be fully correct with the transition
   skipped — Reanimated *omits* shared transitions under Reduce Motion rather than
   snapping them.
2. **The order sheet rises from its button**, photo still visible and continuous.
3. **The new-photos strip** — quiet, dismissible, ~250ms fade: "3 new from Tuesday".
4. **The age line** — 200ms fade-up *after* the photo settles.
5. **Pull-to-refresh** — one honeycomb cell filling, driven **by pull distance, not
   time**; rotates only while the request is genuinely in flight.
6. **The tab puck** — ζ≈0.9, ~220ms, `selectionAsync()` at finger-lift.

### Deletions

- **Delete `ConfettiOverlay` from both call sites.** Upload success is near-silent: a
  checkmark morph and one Success haptic **per batch, not per photo**.
- **No parallax** on hero photography — WCAG 2.3.3 names it as the archetypal
  non-essential motion. **No auto-advancing carousels.**
- **Stagger only the first screenful, once**, gated on a ref — FlashList recycles cells
  and a `delay(index * 45)` re-fires on every recycle.

---

## 8. Per-role direction

**PARENT — the album.** The feed *is* the home tab. Full-bleed mounted photographs at true
aspect ratio, **day-grouped under sticky headers doing real work** ("Tuesday, 12 Aug · 9
photos · Ms. Priya") — at a preschool the date **is** the event, which is why Hive needs
no event-grouping feature. **The age stamp** ("Aarav · 3y 2m") on the photo detail —
`useChildren` already returns `dateOfBirth`, so this is a date subtraction, not a data
change. Child switcher with an **"All" chip merging siblings into one chronological
feed** — the market leader forces two-child families to back out and drill in again with
no combined view, a cheap and visible win. Print orders start from **the photo already on
screen**, never from a second, worse gallery. **No likes, no view counts, no reaction
totals anywhere on a child's photo** — once shipped they are politically impossible to
remove.

**TEACHER — the tool.** Same tokens, denser register. The upload flow's signature move is
a **docked, horizontally-scrolling rail of student chips pinned to the bottom while the
photo strip pages above it**, each chip showing an accumulating count ("Aarav 7") so
coverage is visible without auditing. This inverts Google Photos' per-photo info-panel
model (~6 taps per photo) — fine for one face, catastrophic for 40 photos across 25
children. Upload progress is **per-file rows with individual retry**, never one aggregate
bar: when photo 14 fails the teacher must retry that file, not the batch.

**ADMIN — the companion, not the console.** Linear scopes mobile to "away-from-keyboard
activities" rather than desktop parity. **Deciding what admin cannot do on mobile is the
design work.** A single "today" card leads the dashboard. Every admin row leads with a
**human identity object** (avatar + name), IDs and raw timestamps demoted: "Aarav S ·
Sunflower · 3 prints · ₹450" scans as a person; the same fields as Order ID / Student ID
/ Created At scans as a table export **even with identical spacing**. Exactly one
persistent primary action per screen. Depth via the existing elevation tokens, **not**
frosted glass — real blur is expensive in RN and cool frosted material fights a warm
palette.

---

## 9. Structural debt to clear

### 9.1 Bottom sheets were hand-rolled fourteen times ✅ primitive built
No sheet primitive existed; fourteen components each re-declared `backdrop`, `sheet` and a
40×4 `handleBar`, `maxHeight` drifting across 65/70/85/88%, and **two different grounds**
(cream in seven, white in the seven admin sheets). `components/feedback/BottomSheet.tsx`
now owns scrim, radius, handle, safe-area inset, keyboard inset, entrance and a single
height policy. `PhotoActionSheet` is the migrated reference. **Thirteen call sites remain.**

### 9.2 Two FAB idioms
`HoneycombFAB` (hex) vs a bespoke round amber `Pressable` duplicated inline in
`(admin)/schools.tsx` and `(admin)/class-detail.tsx`. Pick one, delete the other.

### 9.3 Four ad-hoc skeletons
`FeedSkeleton` is the good one — it mirrors the real print ratios. Parent orders, teacher
dashboard, admin dashboard and `NotificationCenter` each hand-roll their own. Skeletons
must mirror the shape of what they replace, and be **delayed 200ms** before showing.

### 9.4 Three screens have no error state at all
`(admin)/schools.tsx`, `(admin)/orders.tsx`, and `(parent)/orders.tsx` (toast only). A
failed request must never be dressed up as an empty list. `(parent)/feed.tsx` is the
reference.

### 9.5 Native `Alert.alert()` × 3 in `(teacher)/upload.tsx`
Breaks the themed feedback system. Replace with the app's own toast or dialog.

### 9.6 Text glyphs standing in for icons
`▾` and `✓` in `ClassSelector`, `✓` in `StudentTagger` — the only non-Ionicons glyphs in
the app.

### 9.7 Two live defects found while writing this brief
- **`MasonryGrid` sets `optimizeItemArrangement`** (`MasonryGrid.tsx:69`), which lets
  FlashList reorder items to level the columns — **it silently breaks chronological order
  in the feed**. Never throws, no test catches it. **Turn it off.**
- **`expo-image` in a recycled list needs `recyclingKey`.** Without it a recycled tile
  briefly shows the previous photo — in this product that reads as a privacy breach.

### 9.8 Dead and placeholder surfaces
`MapParentSheet.tsx` (**zero imports — delete**) · `LottieWrapper` (reachable only via an
`EmptyState` prop no caller passes; `bee.json` is a stub ellipse) · `+not-found` hero is
an admitted placeholder · `(teacher)/dashboard` photos have **no tap action** · `(admin)/dashboard`
is six static numbers · `(parent)/photo/[id]` loading is a bare spinner on black.

### 9.9 Six screens are governed by two files
Three `notifications` (25 lines each, byte-identical) and three `profile` (13–14 lines)
are thin wrappers over `NotificationCenter.tsx` and `ProfileScreen.tsx`. **Redesigning
those two redesigns six tabs** — highest leverage in the app.

---

## 10. Rules of engagement

1. **The theme token API is frozen.** Values change freely; **keys do not**. New keys may
   be added; existing keys may not be renamed or removed. This is what lets screen agents
   work in parallel.
2. **Presentation layer only.** Never touch `features/*/services`, hooks or store
   interfaces, or anything under `packages/backend`.
3. **Stay in your lane.** Wave 2 agents edit only their own route group and their own
   `features/<role>/components`.
4. **Every list needs four states** — delayed skeleton, empty, error with retry, content.
5. **Accessibility:** `accessibilityRole` + label on every interactive element; targets ≥
   44px; text ≥ 4.5:1; motion respects Reduce Motion.
6. **Gate:** `typecheck` clean, `lint` **≤ 7 warnings** (today's baseline), zero errors.
7. **Do not run `pnpm test`** — backend suite, shared database, sign-in quota, nothing to
   say about UI.
8. **No new dependencies.** More weights of the two installed font families are free.
9. **Every motion value comes from `theme/motion.ts`** — no inline `{ duration: 300 }`.

### Out of scope on this branch (needs a dependency or a data change — record, don't build)

- **Full-resolution save + native share** in the viewer. Needs `expo-media-library` /
  `expo-sharing`. This is the research's single most damaging omission for a keepsake
  product — Famly parents screenshot photographs of their own children — but it is a
  `package.json` change the team must agree.
- **UPI-first checkout.** Payment integration, not UI.
- **Persisted `last_feed_seen_at` unread divider.** Needs storage; the *strip* can be
  built from data already in the feed.

---

## 11. Deviation record

`CLAUDE.md` §10 states "Do not redesign the UI." This branch departs from that on the
product owner's explicit instruction. The work also crosses the §6 ownership map:
`theme/**` and `components/ui/**` belong to Bhargav, `app/_layout.tsx` to Nagachaitanya,
and parts of the parent/teacher feature components to Ruthwik and Nagachaitanya.
**Commits are split by owning area so each owner can review and land their own.**

---

## 12. Verifier rubric — 50 binary fail conditions

Fail a screen for any of these.

**Photography**
1. A photograph with `borderRadius` > 6.
2. Any event-type label, camera glyph, type chip or system title above or on a photo.
3. A photo force-cropped to square outside a dense grid or selection view.
4. `expo-image` in a recycled list without `recyclingKey`.
5. FlashList masonry with `optimizeItemArrangement` left `true`.
6. Grid cells too small for a face. 2-up full-bleed; 3-up only for a dense archive.
7. A viewer that cannot swipe between photos, pinch-zoom, or dismiss by swipe-down.
8. No full-resolution save / native share in the viewer. *(deferred — see §10)*
9. The viewer serving the thumbnail instead of the original.

**Colour**
10. Marigold `#F0A03A` as text or as an icon that must be read (2.03:1).
11. Any non-marigold hue above C\*36 outside the semantic tier; any hue above C\*60 other
    than marigold.
12. Any text below 4.5:1 on `#FDF8F1`. Forbidden as text: `#E0688A`, `#4E9A6B`,
    `#E08A1E`, `#D64A45`.
13. A saturated filled app bar over the feed.
14. Colour encoding nothing — rainbow headings, multi-hue icon grids, hue-per-category.
15. Icons differentiated by hue instead of weight and fill.
16. `ink.900` as the photo viewer ground instead of `#0B0B0C`.
17. Pure `#FFFFFF` as a screen ground, or pure `#000000` anywhere.
18. A framework default hex surviving into the theme.

**Typography**
19. Display type ≥25pt at zero or positive tracking.
20. Fraunces below 18pt, or carrying body text.
21. `Fraunces_300Light` below 32pt.
22. ALL-CAPS micro-labels in navigation or as event types.
23. More than four radius values on one screen, or any radius outside the locked scale.

**Structure & content**
24. A launcher grid, module menu or hamburger as the parent home.
25. Any engagement metric on a child's photo.
26. A raw machine timestamp. Relative and human only.
27. Clinical register in copy.
28. An empty structured form as an empty state.
29. A generic single "No photos" empty state. Three variants required: first-use (**no
    CTA** — a dead CTA is worse than none), filtered-to-nothing (clear-filter), error.
30. Icon-only filter strips. Labelled pill chips, capped at three or four.
31. Segmented controls with more than three segments.
32. A key-value-pair detail screen, or an admin row leading with an ID instead of a person.
33. Delivery cost revealed at checkout rather than on the first screen.
34. A multi-step checkout wizard, or a card form more prominent than UPI. *(partially deferred)*
35. A print order starting anywhere other than the photo the parent is looking at.
36. Icons from more than one family, or mixed stroke weights.
37. An illustrated or cartoon child, mascot, or avatar figure anywhere.
38. Spot illustration on a screen that also shows a photograph.

**Motion**
39. Confetti or particles, anywhere.
40. Any animation over 400ms in the user's path; 500ms is an outright fail.
41. A spring with ζ < 0.6 on anything travelling further than a press.
42. `withSpring` on colour or opacity.
43. Staggered entrances that re-fire on FlashList cell recycle.
44. Parallax on hero photography, or an auto-advancing carousel.
45. Meaning carried by an exit animation.
46. A scroll-linked value driven by a spring instead of `Extrapolation.CLAMP`.
47. A literal `{ duration: 300 }` or inline spring in a screen file.
48. A skeleton with no 200ms delay, or whose shape does not match the final layout.
49. Two independently staggering groups on one screen.
50. A haptic at request time rather than at the animation's settle point, or one Success
    haptic per photo instead of per batch.
