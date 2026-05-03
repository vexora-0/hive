# Plan 00 — Fix the 22 TypeScript Errors

**Branch:** `fix/typecheck-errors`
**Owner:** Bhargav
**Size:** S (~3 hours)
**Depends on:** nothing — **this blocks everything else**
**Phase 2 week:** W14 (3 – 9 May)

---

## Why this is first

`pnpm --filter @hive/mobile typecheck` fails with **22 errors**. The mobile app does not compile. Until it does, nobody can verify that any other change works — a broken build masks every other failure.

The backend is clean: `typecheck` and `build` both pass. This is mobile-only.

Verify before starting:
```bash
pnpm install
pnpm --filter @hive/backend typecheck   # passes
pnpm --filter @hive/mobile typecheck    # 22 errors
```

---

## The 22 errors, grouped

### Group A — FlashList v2 removed `estimatedItemSize` (6 errors)

`@shopify/flash-list@2.0.2` dropped the prop; v1 required it. Every call site still passes it.

| File | Line |
|---|---|
| `src/app/(admin)/class-detail.tsx` | 174 |
| `src/app/(admin)/schools.tsx` | 145 |
| `src/app/(admin)/users.tsx` | 174 |
| `src/app/(parent)/orders.tsx` | 196 |
| `src/components/media/MasonryGrid.tsx` | 70 |
| `src/features/notifications/components/NotificationCenter.tsx` | 145 |

**Fix:** delete the `estimatedItemSize` prop from all six. v2 measures automatically. Check the v2 changelog for any other renamed prop on the same components while you're in there.

### Group B — Supabase generic inference collapsing to `never` (8 errors)

`createClient<Database>` is typed, but these queries resolve the row type to `never`, so property access fails.

| File | Lines | Property |
|---|---|---|
| `src/features/auth/services/authService.ts` | 98 | `role` |
| `src/features/auth/stores/authStore.ts` | 104 | `role` |
| `src/features/teacher/hooks/useClasses.ts` | 27, 28, 29 | `id`, `name`, `grade` |
| `src/features/teacher/services/teacherService.ts` | 116, 117, 118 | `id`, `full_name`, `avatar_url` |

**Root cause to confirm first:** open `src/types/supabase.ts` and check the `Database` type actually declares `public.Tables` with `Row` shapes for `profiles`, `classes` and `students`. If the generated types are stale or the shape doesn't match what `@supabase/supabase-js@2.43` expects, every query degrades to `never` — one fix at the type level clears all eight errors.

**Preferred fix:** regenerate the types against the live schema:
```bash
npx supabase gen types typescript --project-id <ref> --schema public > apps/mobile/src/types/supabase.ts
```
**Fallback** if regeneration isn't possible: annotate the return types at each call site explicitly. Do this only if the root fix fails — eight local casts is worse than one correct type file.

> Srujan owns `types/supabase.ts` (he generated it in Phase 1). Coordinate before regenerating.

### Group C — Stale `hashing` upload state (3 errors)

`ImageUploadState` in `src/features/teacher/hooks/useUpload.ts` is `idle | requesting-url | uploading | saving | tagging | complete | error`. There is no `hashing` — client-side hashing was dropped (see migration `00016`). Two components still map it.

| File | Lines |
|---|---|
| `src/features/teacher/components/UploadPreview.tsx` | 39, 50 |
| `src/features/teacher/components/UploadProgress.tsx` | 30 |

**Fix:** remove the `hashing` key from all three `Record<ImageUploadState, …>` literals.

> Plan 05 adds a `confirming` state to this union. When it does, these same three records need the new key — they are `Record<ImageUploadState, …>`, so TypeScript will flag them. Leave a comment noting that.

### Group D — Missing or renamed module exports (2 errors)

| File | Line | Problem |
|---|---|---|
| `src/components/media/HiveImage.tsx` | 3 | `expo-image` no longer exports `ContentFit` |
| `src/components/navigation/TabBar.tsx` | 3 | `@react-navigation/bottom-tabs` is **not a dependency** |

**HiveImage:** replace the `ContentFit` import with the inline union `'cover' | 'contain' | 'fill' | 'none' | 'scale-down'`, or import `ImageContentFit` if the current version exports that name. Check the installed version's `.d.ts` rather than guessing.

**TabBar:** the package isn't in `apps/mobile/package.json`. It's pulled in transitively by `expo-router`, so the runtime works but the types aren't resolvable. Either add it as an explicit dependency (`pnpm --filter @hive/mobile add @react-navigation/bottom-tabs`) or type the props from `expo-router`'s own exports. **Adding the explicit dependency is safer** — relying on a transitive package is what caused this.

### Group E — Reanimated and style typing (3 errors)

| File | Line | Error |
|---|---|---|
| `src/components/animation/AnimatedCounter.tsx` | 80 | Unused `@ts-expect-error` directive |
| `src/components/animation/ShakeAnimation.tsx` | 72 | `AnimatableValue` not assignable to `number` |
| `src/components/ui/TextInput.tsx` | 166 | No overload matches — `StyleProp<StyleProp<TextStyle>>` |

**AnimatedCounter:** the directive is now unnecessary — the underlying error was fixed upstream. Delete the line.

**ShakeAnimation:** `withSequence` returns `AnimatableValue`. Assign it into a `SharedValue<number>` rather than a bare `number`, or narrow at the assignment.

**TextInput:** the `style` prop is being double-wrapped — a `StyleProp<TextStyle>` passed into something already expecting `StyleProp`. Flatten it: accept `StyleProp<TextStyle>` in the props interface and pass it through directly rather than nesting it in another array.

---

## Order of work

Do the groups in this order — B first, because it might resolve on its own once the types are regenerated, and you don't want to hand-patch eight call sites you could have avoided.

1. **Group B** — regenerate types, re-run typecheck, see what's left
2. **Group A** — mechanical, six deletions
3. **Group C** — mechanical, three deletions
4. **Group D** — two import fixes, one dependency addition
5. **Group E** — three genuine type fixes

Re-run `pnpm --filter @hive/mobile typecheck` after each group. Errors sometimes cascade — fixing B may reduce the count elsewhere.

---

## Verification

```bash
pnpm --filter @hive/mobile typecheck   # 0 errors
pnpm --filter @hive/backend typecheck  # still 0
pnpm lint                              # no new warnings
pnpm build:backend                     # still succeeds
```

**Then run the app.** A type fix that changes runtime behaviour is worse than the error it replaced:

- [ ] App launches without a red screen
- [ ] Parent feed renders — exercises `MasonryGrid` after the FlashList change
- [ ] Admin users and schools lists render and scroll
- [ ] Orders list renders
- [ ] Teacher upload shows preview and progress — exercises the `hashing` removal
- [ ] Tab bar renders on all three roles
- [ ] OTP input shake still animates — exercises `ShakeAnimation`
- [ ] Photo images load — exercises `HiveImage`

---

## Commit sequence

```
fix(types): regenerate supabase database types to restore row inference
fix(ui): remove estimatedItemSize for FlashList v2 compatibility
fix(upload): drop the removed hashing state from progress components
fix(media): use inline content fit union for expo-image
chore(deps): add explicit bottom-tabs dependency for tab bar types
fix(animation): correct shared value typing in shake and counter
fix(ui): flatten nested style prop typing in text input
```

---

## Done when

- [ ] `pnpm typecheck` passes across the whole monorepo
- [ ] App runs with no visual or behavioural regression on the checklist above
- [ ] Merged into `develop`
- [ ] **Announce it** — this unblocks all three other developers

---

## Deviations

*Record here anything that differed from this plan, and why.*
