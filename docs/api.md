# API Reference

Base URL `/api/v1`. All endpoints except `/health` require authentication.

## Conventions

| | |
|---|---|
| Auth | `Authorization: Bearer <supabase-jwt>` |
| Success | `{ "success": true, "data": … }` |
| Paginated | `{ "success": true, "data": [...], "cursor": "…" \| null }` |
| Error | `{ "success": false, "message": "…", "code": "…" }` |
| Cursor | base64url of `{ createdAt, id }` — opaque; pass it back unchanged |
| Correlation | `X-Request-ID` echoed on every response |

Money is **integer cents** throughout. Never parse it as a float.

### Status codes

| Code | Meaning |
|---|---|
| 400 | Validation failed — `errors[]` names the fields |
| 401 | Missing, malformed or expired token |
| 403 | Authenticated but not permitted |
| 404 | Not found — **also returned when a resource exists but is not yours**, so the response does not confirm existence |
| 409 | Conflict — duplicate idempotency key or mapping |
| 429 | Rate limited — 100 requests / 15 min |
| 503 | `/health` only: database unreachable |

---

## Health

**`GET /health`** — no auth. Verifies the database with a 2s timeout.

```json
{ "status": "ok", "service": "hive-backend", "version": "1.0.0",
  "uptimeSeconds": 1420, "checks": { "database": "ok" } }
```

Returns **503** with `"database": "error"` when Supabase is unreachable, so a
platform health check removes the instance from rotation.

---

## Photos — teacher, admin

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/photos/upload-url` | Create a photo record, returns `photoId` and storage path |
| `POST` | `/photos/:id/file` | Upload the file (multipart, field `file`) |
| `POST` | `/photos/:id/tag` | Tag students — **call before confirm** |
| `POST` | `/photos/:id/confirm` | Mark ready; fires parent notifications |
| `GET` | `/photos?classId=&cursor=&limit=` | List a class's photos |
| `DELETE` | `/photos/:id` | Archive a photo (soft delete) |
| `DELETE` | `/photos/:id/tag/:studentId` | Remove one student's tag |

**Order matters.** `confirm` transitions the photo to `ready`, which fires
`notify_parents_on_photo`. Tag first or no parent is notified.

`POST /photos/upload-url`
```json
{ "classId": "uuid", "filename": "IMG_1234.jpg",
  "contentType": "image/jpeg", "fileSize": 2048576 }
```

`POST /photos/:id/tag`
```json
{ "studentIds": ["uuid", "uuid"] }
```
Max 50. Students must be at the photo's school, else **400**.

Uploads are capped at 25 MB and validated by **magic bytes**, not the declared
content type. HEIC is converted to JPEG. Uploading to another school's class, or
onto another teacher's photo, returns **403**.

`DELETE /photos/:id` sets `status = 'archived'` rather than deleting the row.
The photo leaves the teacher's grid and every parent's feed — both feed queries
filter `status = 'ready'` — but the stored objects remain, so an order already
placed against it still renders its thumbnail. Both `DELETE` routes are guarded
like tagging: **the uploader at their own school, or an admin**. A same-school
colleague gets **403**. Archiving an already-archived photo returns **400**;
removing a tag that is not there returns **404**. Both answer **204** on
success.

---

## Feed — parent

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/feed?studentId=&cursor=&limit=` | Photos of the parent's children |
| `GET` | `/feed/photos/:id` | Single photo detail |

```json
{ "success": true,
  "data": [{ "id": "uuid", "url": "https://…?token=…",
             "thumbnailUrl": "https://…?token=…", "blurhash": "L6Pj…",
             "width": 1600, "height": 1200, "created_at": "…",
             "taggedStudentIds": ["uuid"] }],
  "cursor": "eyJjcmVhdGVkQXQi…" }
```

`url` and `thumbnailUrl` are **signed and expire after one hour**. Do not
persist them.

`taggedStudentIds` contains **only the requesting parent's children** — an
authorised viewer still must not learn which other children appear.

`GET /feed/photos/:id` returns **404** for a photo not tagged with one of your
children, rather than 403, so the response does not confirm it exists.

---

## Orders — parent

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/orders` | Place an order — **requires `X-Idempotency-Key`** |
| `GET` | `/orders?cursor=&limit=` | Order history |
| `GET` | `/orders/:id` | Single order with items |
| `PATCH` | `/orders/:id/cancel` | Cancel your own order — **only while `pending`** |

```json
{ "items": [{ "photoId": "uuid", "productType": "print_4x6", "quantity": 2 }],
  "shippingAddress": "123 MG Road, Bangalore 560034",
  "notes": "Gift wrap please" }
```

**No price field.** The server prices from its own catalogue; a client cannot
influence what it is charged.

Product types: `print_4x6` `print_5x7` `print_8x10` `digital_download`
`photo_book` `magnet` `mug`.

Ordering a photo not tagged with one of your children returns **403**.

**Idempotency.** `X-Idempotency-Key` is required. A repeat returns the original
response; a concurrent request with the same key returns **409** rather than
racing. Keys are cached 24 hours.

**Cancelling.** A parent may cancel only while the order is `pending`; once an
admin confirms it, prints may already be in production, so a later attempt
returns **400 INVALID_TRANSITION**. Somebody else's order returns **404**, not
403. Cancelling sets `status = 'cancelled'` — the record is kept.

---

## Own profile — any role

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/me` | The caller's own profile |
| `PATCH` | `/me` | Update `fullName` and `phone` |

```json
{ "fullName": "Asha Rao", "phone": "+91 98765 43210" }
```

Deliberately narrow. **`role` and `school_id` are not accepted** — they decide
what the caller can see, and a self-service endpoint that took them would be a
privilege escalation in one request. Both stay behind
`PATCH /admin/users/:id/role` and `/school`. `email` is the login identity and
lives in Supabase Auth, not `profiles`.

Unknown fields are stripped by the validator, so sending `role` succeeds and
changes nothing. `phone: null` clears the number; omitting a field leaves it
alone. An empty body returns **400**.

---

## Notifications — any role

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/notifications?cursor=&limit=` | Unread first, then newest |
| `GET` | `/notifications/unread-count` | `{ "count": 3 }` |
| `PATCH` | `/notifications/:id/read` | Mark read |

Types: `new_photos` `upload_complete` `new_order` `order_status`.

---

## Admin

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/dashboard` | Counts and revenue |
| `GET` | `/admin/users?search=&role=&cursor=&limit=` | List and search |
| `PATCH` | `/admin/users/:id/role` | Change role |
| `PATCH` | `/admin/users/:id/school` | Assign school |
| `GET`/`POST` | `/admin/schools` | List / create |
| `PATCH` | `/admin/schools/:id` | Update name, address, phone, logo |
| `GET` | `/admin/orders?status=&cursor=&limit=` | Fulfilment queue for the school |
| `PATCH` | `/admin/orders/:id/status` | Advance an order |
| `GET` | `/admin/classes/:classId` | Detail with students and teacher |
| `PATCH` | `/admin/classes/:classId/teacher` | Assign or unassign |
| `POST`/`DELETE` | `/admin/classes/:classId/students[/:studentId]` | Add / remove |
| `GET`/`POST`/`DELETE` | `/admin/students/:studentId/parents[/:parentId]` | Manage guardians |
| `GET` | `/admin/teachers?schoolId=` | For assignment dropdowns |

Roles are `parent`, `teacher`, `admin`. Mapping a parent uses their email — they
must have signed up first, else **404**. A duplicate mapping returns **409**.

`PATCH /admin/schools/:id` is a partial update — only the fields sent are
written. `email` is accepted by the validator and ignored, because the `schools`
table has no such column.

**Order fulfilment.** `PATCH /admin/orders/:id/status` accepts `confirmed`,
`processing`, `shipped`, `delivered`, `cancelled` — never `pending`, which an
order is born in and cannot return to. Only forward moves are legal:

```
pending → confirmed → processing → shipped → delivered
   ↓          ↓
cancelled  cancelled
```

Anything else returns **400 INVALID_TRANSITION**; `delivered` and `cancelled`
are terminal. Every accepted change sends the parent an `order_status`
notification. A school-scoped admin may only act on their own school's orders
(**403** otherwise); a platform admin (`school_id = null`) may act anywhere and
must pass `?schoolId=` to list.

---

## Schools — teacher, admin

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/schools/:id/classes` | Active classes |
| `GET` | `/schools/:id/students?classId=` | Active students |
| `POST` | `/schools/:id/classes` | Create a class (admin) |

Scoped to the caller's own school. Admins are cross-school by design; anyone
else requesting another school gets **403**.
