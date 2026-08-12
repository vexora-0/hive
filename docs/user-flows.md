# User Flows

The three role journeys through the app, plus the entry flow they share.

Diagram G-6. Written as Mermaid rather than Excalidraw so it renders on GitHub,
diffs in review, and cannot go stale without someone noticing — the same reason
the plan gives for the other diagrams.

Route names match the directories under `apps/mobile/src/app/`.

---

## Entry — shared by all roles

Role is **never** chosen by the user. The picker on the login screen only
decides which sign-in method to show; the actual role comes from the `profiles`
row after authentication, and the server enforces it on every request
regardless of what the client believes.

```mermaid
flowchart TD
    A[App launch] --> B{Session in storage?}
    B -->|No| C["(auth)/onboarding — 3 slides"]
    C --> D["(auth)/login"]
    B -->|Yes| E[Fetch profile]

    D --> F{Sign-in method}
    F -->|"Email + password"| G[signInWithPassword]
    F -->|"One-time code"| H["(auth)/verify-otp"]
    H --> G

    G --> E
    E --> I{profiles.role}
    I -->|parent| P["(parent)/feed"]
    I -->|teacher| T["(teacher)/dashboard"]
    I -->|admin| M["(admin)/dashboard"]
    E -->|No profile row| D
```

> A new user has no `profiles` row until the `handle_new_user` trigger fires on
> signup. Until then there is no role, so the app returns to login rather than
> guessing one.

---

## Parent

The privacy boundary is enforced server-side: the feed query is scoped to the
photos this parent's children are tagged in. A parent who guesses another
photo's ID gets a 404, not a 403 — a 403 would confirm the photo exists.

```mermaid
flowchart TD
    F["(parent)/feed"] --> G{Has tagged photos?}
    G -->|No| E["Empty state — 'No photos yet'"]
    G -->|Yes| H[Masonry grid, blurhash placeholders]

    H --> S[Switch child] --> H
    H --> D["(parent)/photo — detail"]

    D --> V[Ownership checked, THEN signed URL minted]
    V --> W[Full photo]
    W --> C[Add to cart]
    C --> O["(parent)/orders — cart"]
    O --> Q[Place order]
    Q --> R{Idempotency key seen?}
    R -->|Yes| RR[Return the same order — no duplicate]
    R -->|No| RN[Create order + items in one transaction]
    RN --> TT[Toast: 'Order placed successfully']

    H --> N["(parent)/notifications"]
    N --> NN["'New photo of &lt;child&gt;'"]
    NN --> D

    H --> PR["(parent)/profile — sign out, confirmed"]
```

**Order money is integer cents end to end.** Never a float, in the client, the
validator or the column.

---

## Teacher

Tagging happens **before** confirming. That ordering is the whole point: the
notification trigger fires on the transition to `ready` and reads the tag rows,
so confirming first would notify nobody.

```mermaid
flowchart TD
    D["(teacher)/dashboard"] --> U["(teacher)/upload"]
    U --> P[Pick images]
    P --> IOS["iOS picker returns a compatible<br/>representation — HEIC transcoded on device"]
    IOS --> C[Select class]
    C --> R[Create photo record — status: processing]
    R --> F[Upload file]
    F --> S["sharp: validate magic bytes, AVIF→JPEG,<br/>thumbnail, blurhash, dimensions.<br/>HEVC HEIC refused with 400"]
    S --> T[Tag the children in the photo]
    T --> X[Confirm — status: ready]
    X --> TR[DB trigger reads tags]
    TR --> NT[One notification per tagged child's parent]
    NT --> CF[Confetti]

    S -->|Not an image| ERR[400 — rejected on magic bytes,<br/>not the Content-Type header]

    D --> N["(teacher)/notifications"]
    D --> PR["(teacher)/profile"]
```

> The MIME check reads the file's magic bytes. Trusting the client's
> `Content-Type` header is what allowed a renamed `.txt` through before.

---

## Admin

Every destructive action confirms first, and every mutation reports its outcome
as a toast — success or the server's own error text.

```mermaid
flowchart TD
    D["(admin)/dashboard — stats"] --> S["(admin)/schools"]
    D --> U["(admin)/users"]

    S --> CS[Create school] --> TS[Toast: '&lt;name&gt; created']
    S --> CC[Create class] --> TS
    S --> CD["(admin)/class-detail"]

    CD --> AT[Assign teacher] --> TT[Toast]
    CD --> AS[Add student] --> TT
    CD --> RS[Remove student] --> K1{Confirm:<br/>'stays enrolled at the school'}
    K1 -->|Cancel| CD
    K1 -->|Remove| TT

    CD --> PL[Parent list] --> MP[Link parent]
    MP --> K2{Already linked?}
    K2 -->|Yes| E409["Toast surfaces the 409 text verbatim"]
    K2 -->|No| TT
    PL --> RP[Unlink parent] --> K3{Confirm:<br/>'stops seeing this child's photos'}
    K3 -->|Unlink| TT

    U --> CR[Change role] --> K4{Confirm:<br/>'changes what they can access'}
    K4 -->|Change| TT
    U --> AH[Assign school] --> TT
```

**Admin is the only role that crosses schools.** Teachers and parents are scoped
to their own; `assertSchoolAccess` returns 403 otherwise, and it lives in the
service layer because the backend bypasses row level security.

---

## Where each boundary is enforced

| Boundary | Enforced by | Failure |
|---|---|---|
| Signed in at all | `authenticate` middleware | 401 |
| Right role for the route | `roleGuard` | 403 |
| Own school only | `assertSchoolAccess`, service layer | 403 |
| Own child's photo only | ownership check in `getPhotoDetails` | 404 — deliberately not 403 |
| Own photo to modify | `assertPhotoOwnership` | 403 |
| Direct client queries | Row level security, migration `00011` | empty result |

`RoleGate` on the mobile side stops the wrong screen rendering, but it is UX
only and never trusted — it is trivially removed in a modified build.

---

## Related

- [`architecture.md`](architecture.md) — system diagram and both data paths
- [`database.md`](database.md) — ER diagram
- [`security.md`](security.md) — the authorization model in full
- [`DEMO_USERS.md`](DEMO_USERS.md) — accounts, and the intended demo path
