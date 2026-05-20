# Plan 02 — Contracts & Data Model

**Branch:** `fix/order-contract`
**Size:** M (~5–6 hours)
**Depends on:** Plan 01
**Closes:** G-01, G-18, G-19, G-31, G-36, G-37

---

## Goal

Make the ordering feature work. It currently **cannot succeed at all** — three layers disagree three different ways. Then fix the surrounding data-model defects that would otherwise bite during seeding (Plan 06) and testing (Plan 08).

---

## The defect, precisely

Three independent mismatches, each fatal on its own:

**1. Field naming** — mobile sends `snake_case`, the validator requires `camelCase`.

| Mobile sends (`orderService.ts:53-57`) | Backend requires (`order.validator.ts:16-42`) |
|---|---|
| `items[].photo_id` | `items[].photoId` |
| `items[].product_type` | `items[].productType` |
| `items[].unit_price` | *(not accepted — server prices)* |
| `shipping_address` | `shippingAddress` **(required)** |

Result: Zod rejects with 400 — `photoId` missing, `shippingAddress` missing. **The request never reaches the database.**

**2. Product vocabulary** — three different sets:

| Layer | Values |
|---|---|
| Mobile `cartStore.ts:9-17` | `print_4x6`, `print_5x7`, `print_8x10`, `digital_download`, `photo_book`, `magnet`, `mug` |
| Backend `order.validator.ts:3-14` | `4x6`, `5x7`, `8x10`, `11x14`, `16x20`, `digital`, `photo_book`, `magnet`, `mug`, `canvas` |
| DB CHECK `00009:252-260` | `print_4x6`, `print_5x7`, `print_8x10`, `digital_download`, `photo_book`, `magnet`, `mug` |

Only `photo_book`, `magnet`, `mug` overlap all three. Per **DEC-4**, the DB/mobile `print_*` set wins.

**3. Currency unit** — backend prices in **cents** (`order.service.ts:9-20`, `'4x6': 299`) and writes that integer into `decimal(10,2)` documented as USD. Mobile prices in **dollars** (`4.99`) and renders `$${n.toFixed(2)}`. A $4.99 print would store as `299.00` and display as **$299.00**.

Per **DEC-6**, integer cents everywhere; format to dollars only at render.

---

## Prerequisites

```bash
git checkout main && git pull
git checkout -b fix/order-contract main
```

---

## Step 1 — Create the shared product catalogue

**New file:** `packages/backend/src/constants/products.ts`

Single source of truth. Export:
- `PRODUCT_TYPES` — the seven `print_*`/`digital_download`/`photo_book`/`magnet`/`mug` values as a `const` tuple
- `ProductType` — the type union derived from it
- `PRODUCT_PRICES_CENTS` — `Record<ProductType, number>`, integer cents
- `PRODUCT_LABELS` — `Record<ProductType, string>`, human-readable

Prices in cents, converted from the existing mobile dollar values (which are the ones users have seen):

| Type | Label | Cents |
|---|---|---|
| `print_4x6` | 4x6 Print | 499 |
| `print_5x7` | 5x7 Print | 799 |
| `print_8x10` | 8x10 Print | 1299 |
| `digital_download` | Digital Download | 299 |
| `photo_book` | Photo Book | 2999 |
| `magnet` | Magnet | 999 |
| `mug` | Mug | 1499 |

**New file:** `apps/mobile/src/features/orders/constants/products.ts`

Mirror it exactly — same seven values, same cents, same labels. Add a header comment: *"Must stay in sync with `packages/backend/src/constants/products.ts`. Values are integer cents."*

> There is no shared package in this monorepo (`packages/` contains only `backend`). Creating one for seven constants costs more than it saves. A mirrored file with a cross-reference comment plus test T-19 (Plan 08), which asserts the two agree, is the right trade-off here.

---

## Step 2 — Rewrite the order validator

**File:** `packages/backend/src/validators/order.validator.ts`

**Do:**
1. Delete the local `productTypes` array. Import `PRODUCT_TYPES` from `../constants/products`.
2. Keep `createOrderSchema` field names as **camelCase** (`photoId`, `productType`, `quantity`, `shippingAddress`, `notes`) per DEC-5.
3. **Do not accept `unitPrice` from the client.** The server prices. This is a security property, not a style choice — test T-15 asserts it.
4. Keep `shippingAddress` required, but see Step 5 (the DB column is nullable; align it).
5. Keep `getOrdersSchema` as is — Step 6 wires it up.

---

## Step 3 — Fix the mobile order payload

**File:** `apps/mobile/src/features/orders/services/orderService.ts`

**Do:**
1. Change `CreateOrderItemPayload` to `{ photoId, productType, quantity }` — drop `unit_price` entirely.
2. Change `CreateOrderPayload` to `{ items, shippingAddress, notes }`.
3. Update `createOrder` to send those names.

**File:** `apps/mobile/src/features/orders/stores/cartStore.ts`

**Do:**
1. Import `PRODUCT_PRICES_CENTS` and `ProductType` from `../constants/products`; delete the local `PRODUCT_PRICES`.
2. Rename `CartItem.unitPrice` → `unitPriceCents` so the unit is unmissable at every call site.
3. `getTotal()` returns **cents**. Rename to `getTotalCents()` and fix all callers.

**Files:** `ProductPicker.tsx`, `OrderBottomSheet.tsx`, `OrderDetailSheet.tsx`, `OrderHistoryCard.tsx`, `(parent)/orders.tsx`

**Do:** Add one shared formatter and use it everywhere a price is rendered:
```ts
export const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
```
Put it in `apps/mobile/src/features/orders/constants/products.ts`. Replace every `toFixed(2)` on a raw number in the orders feature. **Search for `toFixed` across `features/orders/` and fix each hit** — a missed one shows a 100× wrong price.

---

## Step 4 — Align the database CHECK constraint

**New migration:** `supabase/migrations/00017_align_product_types.sql`

The existing CHECK already matches the seven chosen values, so this migration mainly makes it explicit and safe to re-run. Do:
1. `ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_type_check;`
2. Re-add it listing exactly the seven `PRODUCT_TYPES` values.
3. Add a `COMMENT ON COLUMN order_items.product_type` cross-referencing `constants/products.ts`.

> If your live database already has `order_items` rows with values outside the seven (unlikely — no order has ever succeeded), the `ALTER` will fail. Check first: `SELECT DISTINCT product_type FROM order_items;`

---

## Step 5 — Convert money to integer cents

**New migration:** `supabase/migrations/00018_order_totals_cents.sql`

**Do:**
1. `ALTER TABLE orders RENAME COLUMN total_amount TO total_cents;`
2. `ALTER TABLE orders ALTER COLUMN total_cents TYPE integer USING (total_cents)::integer;`
3. Same for `order_items.unit_price` → `unit_price_cents`, type `integer`.
4. Update the `COMMENT ON` for both to say **"integer cents"**.
5. Make `orders.shipping_address` `NOT NULL` to match the validator (G-D8), **or** relax the validator — pick one. Recommended: make the column `NOT NULL DEFAULT ''` is wrong for real data, so instead **keep the column nullable and keep Zod requiring it** — the API contract can be stricter than the schema. Add a comment saying so, and skip the ALTER.

**File:** `packages/backend/src/services/order.service.ts`

**Do:**
1. Delete the local `PRODUCT_PRICES`; import `PRODUCT_PRICES_CENTS`.
2. Rename the interface fields: `total_amount` → `total_cents`, `unit_price` → `unit_price_cents`.
3. Update the insert payloads and both select lists.
4. `notifyAdminsOfNewOrder` already divides by 100 for display — verify it still does after the rename.

**File:** `apps/mobile/src/features/orders/services/orderService.ts` — update the response types to `total_cents` / `unit_price_cents`.

---

## Step 6 — Wire the orphaned validators (G-18)

| Route | File | Add |
|---|---|---|
| `GET /orders` | `packages/backend/src/routes/order.routes.ts` | `validate(getOrdersSchema, 'query')` |
| `POST /photos/:id/tag` | `packages/backend/src/routes/photo.routes.ts` | `validate(tagStudentsSchema, 'body')` |

**`tagStudentsSchema` needs adjusting first.** It currently requires `photoId` in the body, but the route takes the ID from the URL. Split it:
```ts
export const tagStudentsBodySchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(50),
});
```
Add the `.max(50)` cap — currently `photo.controller.tagStudents:68` reads `req.body.studentIds` **with no validation at all** and passes it straight into `.in('id', studentIds)`.

Then simplify `order.controller.getOrders` to read the validated `req.query` instead of re-parsing the limit by hand.

---

## Step 7 — Fix the foreign-key contradictions (G-19)

**The finding:** three columns are `NOT NULL` **and** `ON DELETE SET NULL`. These are mutually exclusive — deleting the referenced row raises a not-null violation instead of nulling the column. **Deleting a profile or a photo is impossible today.**

| Column | File | Fix |
|---|---|---|
| `photos.uploaded_by` | `00007:149` | Keep `NOT NULL`, change to `ON DELETE RESTRICT` — you should not be able to delete a teacher who has photos without handling them |
| `photo_student_tags.tagged_by` | `00008:192` | Same — `ON DELETE RESTRICT` |
| `order_items.photo_id` | `00009:250` | Keep `NOT NULL`, change to `ON DELETE RESTRICT` — an order line must always reference a real photo |

**New migration:** `supabase/migrations/00019_fix_fk_constraints.sql` — drop and re-add each constraint with the corrected action.

---

## Step 8 — Make order creation atomic (G-37)

**The finding:** `order.service.createOrder:117-157` inserts `orders`, then inserts `order_items`, and on failure issues a compensating `DELETE`. A crash between the two leaves an order with no items.

**Do:** Add a Postgres function in migration `00019` (or a new `00020` — keep numbering sequential):

```sql
CREATE OR REPLACE FUNCTION create_order_with_items(
    p_order jsonb,
    p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE v_order_id uuid;
BEGIN
    INSERT INTO orders SELECT * FROM jsonb_populate_record(null::orders, p_order)
    RETURNING id INTO v_order_id;

    INSERT INTO order_items
    SELECT * FROM jsonb_populate_recordset(null::order_items, p_items);

    RETURN v_order_id;
END;
$$;
```

Call it from `order.service.createOrder` via `supabaseAdmin.rpc('create_order_with_items', {...})`. Delete the compensating-delete block.

> If the `jsonb_populate_record` approach proves awkward against your column set, an explicit-parameter version is fine. The requirement is **one transaction**, not this exact implementation.

---

## Step 9 — Fix `markAsRead` 404 semantics (G-31)

**The finding:** `notification.service.markAsRead:81` destructures `count` from an `update()` made **without** `{ count: 'exact' }`. `count` is always `null`, so `if (count === 0)` never fires — marking a nonexistent or another user's notification returns `200 OK`.

**File:** `packages/backend/src/services/notification.service.ts`

**Do:** Add `{ count: 'exact' }` to the update options so `count` is populated, then the existing `count === 0` → 404 check works. Cross-user writes were already prevented by `.eq('user_id', userId)`; this fixes the error contract only.

---

## Step 10 — Make policy migrations idempotent (G-36)

**The finding:** `00011` and `00015` use bare `CREATE POLICY`. Re-running either fails with "policy already exists", so migrations cannot be replayed onto a partially-migrated database.

**Do:** In both files, precede every `CREATE POLICY x ON y` with `DROP POLICY IF EXISTS x ON y;`.

> Editing applied migrations is normally bad practice. It is correct here because these are `CREATE`-only statements whose re-run behaviour is the thing being fixed, and no environment depends on their current non-idempotent form. Note it in the commit body.

---

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm build:backend
grep -rn "total_amount\|unit_price[^_]" packages apps    # should only match migrations
grep -rn "toFixed" apps/mobile/src/features/orders       # every hit must be inside formatCents
```

**Apply migrations to a scratch Supabase project**, then:

```sql
SELECT DISTINCT product_type FROM order_items;                       -- only the 7 values
\d orders                                                            -- total_cents integer
SELECT conname, confdeltype FROM pg_constraint
  WHERE conrelid IN ('photos'::regclass,'order_items'::regclass);    -- 'r' (restrict), not 'n'
```

**Manual — the critical one:**
- [ ] As a parent, long-press a photo → Add to cart → pick 4x6 → quantity 2 → enter address → **Place order succeeds**
- [ ] The order appears in history showing **$9.98**, not $998 or $0.10
- [ ] Order detail lists the right product and quantity
- [ ] Ordering a photo *not* tagged with your child returns 403
- [ ] Re-submitting with the same `X-Idempotency-Key` returns the original order, not a duplicate
- [ ] Admin dashboard now shows 1 order and $9.98 revenue

---

## Commit sequence

```
feat(orders): add shared product catalogue with integer cent pricing
fix(orders): align mobile order payload with backend validator contract
fix(orders): remove client-supplied unit price so the server owns pricing
fix(db): align order_items product type constraint with the catalogue
fix(db): store order totals as integer cents
fix(orders): validate order listing and photo tagging payloads
fix(db): replace contradictory null/set-null foreign key actions
feat(orders): create orders and items in a single transaction
fix(notifications): return 404 when marking a missing notification
fix(db): make policy migrations idempotent
```

---

## Done when

- [ ] A parent can place an order end-to-end and see it at the correct price
- [ ] `grep -rn "school_admin\|total_amount"` clean outside migrations
- [ ] All migrations apply cleanly to a **fresh** database
- [ ] Typecheck, lint, build all pass
- [ ] Merged into `main`
- [ ] Index progress tracker updated

---

## Deviations

*Record here anything that differed from this plan, and why.*
