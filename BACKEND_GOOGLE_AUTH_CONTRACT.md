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
    "role": "student"
  }
  ```
  - `id_token` — **required**. The Google credential JWT from GIS.
  - `role` — **optional**. `"student"` | `"owner"`. Sent only from the **signup page**
    (the user picks a role there). The **login page never sends it** — backend must then
    match an existing account by email, or fall back to `student` for a brand-new user.
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

## Acceptance criteria (how the backend team verifies)

1. `POST /api/auth/google` with a valid Google `id_token` + `role: "student"` → `200` with
   a Sanctum `token`; the user can call protected routes with `Authorization: Bearer`.
2. Same call **without** `role` (login page) → matches an existing email or creates a
   student; never fails because of a missing role.
3. `register/space-owner` succeeds **without** `proof_document`.
4. A space-creation request from an owner with no approved document is **rejected**.