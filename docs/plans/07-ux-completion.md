# Plan 07 — UX Completion

**Branch:** `feat/ux-completion`
**Size:** M (~6 hours)
**Depends on:** Plan 02, Plan 04, Plan 06
**Closes:** G-26, G-27, G-28, G-29, G-30, G-32, G-33

---

## Goal

Turn *visibly unfinished* into *finished*. Everything works by now — this plan makes it feel like a product.

**Explicitly not in scope:** redesigning anything. The audit found the design system genuinely good — a coherent palette, a 12-variant type scale, platform-aware shadows, and a 30-component library with skeletons, empty states, error boundaries and offline banners already wired. The gap is not visual quality; it is **missing feedback and three placeholder screens**. Spend the budget there.

---

## Step 1 — Toast system (G-28)

**The finding:** there is **no toast or snackbar anywhere in the app**. Outside the upload flow's confetti, success and failure are both silent. A parent who places an order gets no confirmation; an admin who changes a role sees nothing.

**New files:**
- `apps/mobile/src/components/feedback/Toast.tsx`
- `apps/mobile/src/components/feedback/ToastProvider.tsx`

**Design — match the existing system, don't invent:**
- Variants `success` / `error` / `info`, coloured from `colors.success.main`, `colors.error.main`, `colors.info.main`.
- Text via the existing `<Text>` component; spacing from `theme/spacing`; radius from `layout.cardRadius`; elevation from `shadows.medium`.
- Slide in from the bottom above the tab bar, auto-dismiss after 3 s (`ANIMATION_DURATION` for the transition), swipe or tap to dismiss.
- Use `moti` — already a dependency and already used elsewhere.
- Respect safe-area insets via `react-native-safe-area-context`.

**API:**
```ts
const toast = useToast();
toast.success('Order placed');
toast.error('Could not place order. Please try again.');
```

**Wire the provider** in `apps/mobile/src/app/_layout.tsx` inside `<ErrorBoundary>` so toasts render above every screen.

**Export** from `components/feedback/index.ts` alongside the existing exports.

### Where to use it

| Flow | Success | Error |
|---|---|---|
| Place order | "Order placed successfully" | "Could not place order. Please try again." |
| Admin: create school / class / student | "\<Name\> created" | surface the API message |
| Admin: assign teacher | "Teacher assigned" | surface the API message |
| Admin: map parent | "Parent linked" | **surface the 409 text** — "This parent is already mapped to this student" is genuinely useful |
| Admin: change role | "Role updated" | surface the API message |
| Remove student / parent mapping | "Removed" | surface the API message |
| Tag students (teacher) | — (confetti covers it) | "Could not tag students" |

**Order errors matter most.** `useCreateOrder` (`features/orders/hooks/useOrders.ts:38`) has **no `onError` handler at all** — add one. Until Plan 02 landed, every order failed silently with a 400.

---

## Step 2 — Confirmation dialogs (G-29)

**The finding:** destructive admin actions fire immediately with no confirmation — removing a student from a class, removing a parent mapping.

**New file:** `apps/mobile/src/components/feedback/ConfirmDialog.tsx`

Use RN `Modal` for Expo Go compatibility — `PhotoActionSheet.tsx` already sets this precedent and explains why in its own comment.

```ts
interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;     // default 'Confirm'
  destructive?: boolean;     // renders the confirm button in colors.error.main
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Apply to:**

| Action | File | Message |
|---|---|---|
| Remove student from class | `(admin)/class-detail.tsx` | "Remove \<name\> from \<class\>? They will stay enrolled at the school." |
| Remove parent mapping | `features/admin/components/ParentListSheet.tsx` | "Unlink \<parent\> from \<student\>? They will stop seeing this child's photos." |
| Change user role | `features/admin/components/UserEditSheet.tsx` | "Change \<name\> to \<role\>? This changes what they can access." |
| Sign out | all three `profile.tsx` | "Sign out of Hive?" |

Write messages that state the **consequence**, not just "Are you sure?" — the parent-unlink one is the model.

---

## Step 3 — Meaningful empty states (G-30)

**The finding:** a brand-new parent with no linked children sees "No photos yet — Ask your teacher to share some moments." They cannot self-serve; an admin must link them. A teacher with no `school_id` sees an empty class dropdown and no explanation at all — `useClasses` is `enabled: !!schoolId`, so the query never runs.

**File:** `apps/mobile/src/app/(parent)/feed.tsx`

Branch the empty state on `children.length === 0`:

```
title:   "No children linked yet"
message: "Your school needs to link your child to your account.
          Contact them with the email you signed up with:  <user.email>"
```

Showing their own email is the detail that makes this actionable — it is the exact string the admin needs for `mapParentToStudent`, which looks parents up **by email** (`admin.service.ts:511`).

**File:** `apps/mobile/src/app/(teacher)/dashboard.tsx`

When `profile.school_id` is null:
```
title:   "No school assigned"
message: "An administrator needs to assign you to a school before you can upload photos."
```
Also disable the upload FAB in this state — currently it navigates to a screen where nothing can be selected.

**File:** `apps/mobile/src/app/(teacher)/upload.tsx`

Guard the same way, in case the user reaches it directly.

---

## Step 4 — Real onboarding animations (G-26)

**The finding:** `OnboardingSlide.tsx:42-44` renders an empty `<View style={styles.animationPlaceholder} />` with the comment *"replace source with a real .json asset"*. This is the **first screen a new user sees**. `+not-found.tsx:35-37` has the same placeholder.

`assets/lottie/bee.json` exists and `LottieWrapper.tsx` is written — neither is used here.

**Do:**
1. Inspect `assets/lottie/bee.json` — confirm it is a valid, non-trivial Lottie.
2. Wire it into `+not-found.tsx` via `LottieWrapper`.
3. For the three onboarding slides, either:
   - source three free Lottie files from [lottiefiles.com](https://lottiefiles.com) matching the slide copy (check licences, record in `CREDITS.md`), **or**
   - if time is short, reuse `bee.json` on all three and replace the placeholder `View` with a large themed `Ionicons` glyph on the other two.

Even the fallback beats an empty grey box. Do **not** leave the placeholder.

Check `slides.ts` in `features/onboarding/data/` for an existing animation field to populate.

---

## Step 5 — Real upload progress (G-27)

**The finding:** `useUpload.ts` sets progress to hardcoded constants — `0.1 → 0.3 → 0.35 → 0.85 → 0.9 → 1`. The bar is cosmetic; it does not reflect bytes transferred. `teacherService.uploadPhotoFile` uses `fetch`, which exposes no upload progress.

**File:** `apps/mobile/src/features/teacher/services/teacherService.ts`

Replace `fetch` with `XMLHttpRequest`, which React Native supports and which does expose progress:

```ts
export function uploadPhotoFile(
  photoId, localUri, contentType, filename,
  onProgress?: (fraction: number) => void,
): Promise<void>
```

Wire `xhr.upload.onprogress` → `onProgress(e.loaded / e.total)`. Keep the same error semantics: non-2xx throws with the server's `message`.

**File:** `useUpload.ts` — pass a callback mapping real progress into the 0.35–0.85 band the upload step occupies, leaving the surrounding steps as discrete jumps.

> **This is the one optional step in this plan.** It is the largest single item and purely cosmetic. If time is tight, skip it and note in Plan 10's limitations that progress is step-based. Everything else here is higher value per hour.

---

## Step 6 — Refactor `schools.routes.ts` (G-32)

**The finding:** `schools.routes.ts` defines a Zod schema inline (`:12`) and puts three handlers with direct `supabaseAdmin` calls in the routes file. **Every other domain** uses separate route/controller/service/validator files.

**Do:** Create `services/school.service.ts`, `controllers/school.controller.ts`, and move `createClassSchema` into `validators/school.validator.ts`. Reduce `schools.routes.ts` to route definitions plus middleware, matching `photo.routes.ts`.

Carry over the `assertSchoolAccess` checks added in Plan 04 Step 2a — do not lose them in the move.

---

## Step 7 — Consistent error emission (G-33)

**The finding:** two error paths coexist. Most code throws `AppError` and lets the global handler format it. But `photo.controller.getPhotos:87-91` and `order.controller.createOrder:18-23` hand-roll `res.status(...).json({ success: false, ... })`.

**Do:** Replace both with `throw new AppError(...)`. Then grep for `success: false` across `packages/backend/src` — every remaining hit should be inside `middleware/` or `utils/apiResponse.ts`, never in a controller.

---

## Step 8 — Small polish

| # | Item | File | Fix |
|---|---|---|---|
| 8a | Feed never shows who took the photo | `parentService.ts:96` hardcodes `uploadedBy: { name: '' }` | Have the feed endpoint return the uploader's `full_name` via a join, and render it on `PolaroidCard` |
| 8b | Order detail shows a grey box | `OrderDetailSheet.tsx:189` `itemImagePlaceholder` | Render the real thumbnail — signed URLs exist since Plan 03 |
| 8c | Inconsistent `TabBar` import | `(admin)/_layout.tsx:6` | Use the barrel `@/components/navigation` like the other two |
| 8d | "Coming Soon" badge on download | `PhotoActionSheet.tsx:54` | Keep it — it is honest, and download is explicitly future scope (DEC-10). Just confirm the button is visibly disabled, not silently inert. |

---

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm build:backend
grep -rn "success: false" packages/backend/src/controllers    # nothing
grep -rn "animationPlaceholder\|beePlaceholder" apps/mobile/src   # nothing
```

**Manual:**
- [ ] Place an order → green success toast; order appears in history
- [ ] Place an order while offline → red error toast with a readable message
- [ ] Create a school → success toast
- [ ] Map an already-mapped parent → error toast showing the 409 message
- [ ] Remove a student → confirm dialog appears; Cancel does nothing; Confirm removes and toasts
- [ ] Sign out → confirm dialog
- [ ] New parent with no children → "No children linked yet" with their own email shown
- [ ] Teacher with no school → "No school assigned"; upload FAB disabled
- [ ] Onboarding → all three slides show a real animation or icon, no grey boxes
- [ ] 404 screen shows the bee
- [ ] Upload progress advances smoothly (if Step 5 done)
- [ ] Feed cards show the uploading teacher's name
- [ ] Order detail shows real photo thumbnails
- [ ] Toasts sit above the tab bar and respect the notch

---

## Commit sequence

```
feat(ui): add toast provider for global success and error feedback
feat(ux): surface toasts on order, admin and tagging mutations
feat(ui): add confirmation dialog for destructive actions
feat(ux): confirm student removal, parent unlinking, role change and sign out
feat(ux): add actionable empty states for unlinked parents and unassigned teachers
feat(onboarding): replace placeholder boxes with real animations
perf(upload): report real byte-level upload progress
refactor(schools): extract schools routes into controller and service
refactor(api): emit all controller errors through AppError
feat(ux): show uploader name in feed and real thumbnails in order detail
```

---

## Done when

- [ ] Every mutation gives visible feedback
- [ ] Every destructive action is confirmed
- [ ] No placeholder boxes anywhere in the app
- [ ] Empty states tell the user what to actually do
- [ ] No hand-rolled error responses in controllers
- [ ] Typecheck, lint, build pass
- [ ] Merged into `main`

---

## Deviations

*Record here anything that differed from this plan, and why.*
