# Google Auth — Frontend / Backend Contract (Masahati)

This document is the exact contract the **Laravel backend team** must implement so the
Google Sign-In flow matches the frontend. The frontend is DONE and needs no changes here.

## Flow

1. Browser loads Google Identity Services (`https://accounts.google.com/gsi/client`)
   and the user signs in via the "المتابعة عبر Google" button.
2. GIS returns a **credential** (the Google `id_token` JWT) to the frontend.
3. Frontend POSTs that id_token (and an optional role on signup) to the backend.
4. Backend verifies the token, creates/finds the user, and returns a Sanctum token.
5. Frontend stores the token and sends it as `Authorization: Bearer <token>` on every
   subsequent request (already handled by `src/lib/api.js`).

## `POST /api/auth/google`

- **Request body:**
  ```json
  {
    "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
    "role": "space_owner"
  }
  ```
  - `id_token` — **required**. The Google credential JWT from GIS.
  - `role` — **optional**. `"customer"` | `"space_owner"`. Sent only from the **signup page**
    (the user picks a role there), or from the **login page after the user picks a role in
    the popup** because their email wasn't registered. The **login page never sends it the
    first time** — backend must check whether the email exists first (see below).
- **Success response (expected shape):**
  ```json
  {
    "message": "تم تسجيل الدخول بنجاح",
    "user": { "id": 5, "name": "Ahmad Ali", "email": "ahmad@gmail.com", "avatar": "..." },
    "token": "1|abcdef123456..."
  }
  ```
  - `token` is the Sanctum bearer token. It must be present on success — the frontend
    throws an error if it is missing.
  - **Role values:** `user.role` must be exactly `"space_owner"` or `"customer"`. These are
    the canonical role names. `user.role` is read by the frontend to choose the dashboard
    and the role badge — no aliases (`owner`, `student`) are accepted.

## Login flow (email already registered vs not)

`POST /api/auth/google` called WITH **no** `role` (login page first attempt) MUST:

1. Look up the user by the Google email (`sub` claim of the verified id_token).
2. **If found** → return `200 { message, user, token }` with that user's existing role.
   The frontend redirects straight to their dashboard (no role popup).
3. **If NOT found** → return **`409`** with JSON `{ "code": "NOT_REGISTERED", "message": "..." }`.
   The frontend shows a popup asking the user to pick `customer` or `space_owner`, then calls
   this same endpoint AGAIN with that `role` to create the account.
4. When a `role` IS present, create the account with exactly that role (`customer`/`space_owner`).
- **Errors:** return proper `4xx/5xx` with a JSON `{ "message": "..." }` (and `errors`
  for `422`) so the frontend can surface a clear Arabic message.

## Owner registration — document is now OPTIONAL

Strategy change: space owners no longer must attach a proof-of-ownership document at signup.

- `POST /api/register/space-owner` must treat `proof_document` as **nullable/optional**
  (frontend only appends it when a file is chosen).
- Owners go straight to `/dashboard` after signup (no "pending approval" gate).
- **Backend enforcement (important):** an owner who has **not** uploaded an approved
  ownership document **must not be able to create a space**. The "create space" endpoint
  should require an approved document and reject the request otherwise. The frontend will
  also gate the button in the dashboard UI, but the backend is the source of truth.

### Implementing the OPTIONAL document (fixes `store() on null` crash)

The field must be nullable AND the file access must be guarded. Otherwise the endpoint
crashes with `Call to a member function store() on null` whenever the owner signs up
without a document (the default case now):

```php
$data = $request->validate([
    'name' => 'required|string|max:255',
    'email' => 'required|email|unique:users,email',
    'phone' => 'required|string',
    'password' => 'required|string|min:6|confirmed',
    'proof_document' => 'nullable|file|mimes:pdf,png,jpg,jpeg|max:5120', // اختيارية
]);

if ($request->hasFile('proof_document')) {
    $data['proof_document'] = $request->file('proof_document')
                                     ->store('proof_documents', 'public');
}
```

Apply the same `hasFile()` guard anywhere else `proof_document` is touched
(Google-auth owner creation, space-creation checks).

## Acceptance criteria (how the backend team verifies)

1. `POST /api/auth/google` with a valid Google `id_token` + `role: "customer"` → `200` with
   a Sanctum `token`; the user can call protected routes with `Authorization: Bearer`.
2. Same call **without** `role` for an email that IS registered → `200` returning that
   user's existing role (no `NOT_REGISTERED`).
3. Same call **without** `role` for an email that is NOT registered → **`409`**
   `{ "code": "NOT_REGISTERED" }` (NOT auto-created as customer).
4. After the user picks a role, calling again WITH `role` creates the account with that role.
5. `register/space-owner` succeeds **without** `proof_document`.
6. A space-creation request from an owner with no approved document is **rejected**.