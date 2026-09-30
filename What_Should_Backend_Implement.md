# What Should Backend Implement

**Target:** `https://back-end-kwba.onrender.com` (Laravel + Sanctum)
**Frontend audited:** `masahati` React/Vite app
**Date:** 2026-09-27
**Scope:** 48 distinct `METHOD + path` combinations (54 call sites) were probed.

**Result: 46 of 48 endpoints exist and are correctly auth-protected. 4 require changes. 2 of those are one-line fixes.**

This document is self-contained: it includes the full endpoint table (section 5) and reproduction commands (section 6).

---

## 1. What backend should implement

### 1.1 Blocking

#### 1.1.1 `GET /api/special-requests/open` returns 404 for authenticated owners

This breaks the owner's entire Market screen. A customer creates a request successfully, and it never appears for any space owner.

**Evidence**

| Request | Result |
|---|---|
| `OPTIONS /api/special-requests/open` (no token) | `200`, `Allow: GET` - a route **is** registered |
| `GET` (no token) | `401` - auth middleware ran, so the route matched |
| `GET` (valid owner token) | `404` `No query results for model [App\Models\SpecialRequest]` |
| `GET /api/special-requests/1` (valid token) | `404` - **byte-identical error message** |

**Root cause.** `/api/special-requests/{id}` is registered *before* `/api/special-requests/open`, so the literal segment `open` is captured by the `{id}` parameter. Implicit route-model binding then searches for a `SpecialRequest` whose primary key equals the string `"open"`, fails, and throws `ModelNotFoundException`.

The identical error on `/1` proves the `{id}` binding is answering in both cases.

**Fix (about 2 lines):**

```php
// the literal route must be registered first
Route::get('/special-requests/open', ...);

// and the parameter must be constrained so no literal can ever be captured
Route::get('/special-requests/{id}', ...)->whereNumber('id');
```

**Note:** this contradicts the team's own contract. `BACKEND_SPECIAL_REQUESTS_BROADCAST_CONTRACT.md:86` specifies `GET /api/special-requests/open`, line 356 states it must return `200 JSON list (never HTML)`, and line 366 states unauthenticated must return `401 JSON`. Unauthenticated behaviour is correct; the authenticated path is not.

**Frontend impact.** The owner's Market tab renders an empty list with no error and no banner. Two separate code paths fail silently:

- `src/lib/owner.js:518` `fetchMarketRequests()` is called inside `Promise.allSettled` in `loadOwnerDashboardImpl` (`owner.js:1296-1317`), where a failure is replaced with an empty array via `pick(4, [])`.
- `src/components/dashboard/owner/Market.jsx:107` has a guard `if (Array.isArray(data?.market)) return;`. Because the dashboard supplies an empty array rather than `undefined`, this guard returns early and the Market tab never runs its own fetch, which would otherwise have set the demo flag and surfaced something visible.

---

#### 1.1.2 `POST /api/special-requests/{requestId}/offers` - route does not exist

Owners cannot submit proposals on customer requests.

| Request | Result |
|---|---|
| `OPTIONS /api/special-requests/{requestId}/offers` | `404`, no `Allow` header |
| `POST` (no token) | `404` - **not** `401`, so no middleware is involved; the URI is simply unrouted |

**Expected request body** (from `src/lib/owner.js:527`):

```json
{
  "space_id": 12,
  "price_per_hour": 50,
  "duration_hours": 3,
  "notes": "optional free text",
  "currency": "ش.ج"
}
```

**Expected response:** `{ "message": "...", "offer": { ... } }`

**This endpoint is already documented** in `BACKEND_SPECIAL_REQUESTS_BROADCAST_CONTRACT.md` with a sample path (`/api/special-requests/41/offers`), so it appears to have been implemented under a different route name or lost in a merge.

**Please confirm the intended route before building it.** If it exists under another path, the fix is a one-line frontend change instead of new backend work.

**Frontend impact - silent data loss.** `submitProposalWithFallback` (`src/lib/owner.js:817`) stores the proposal in `localStorage` and reports success to the user. The write is **never retried against the server**, so a submitted proposal is permanently lost with no error shown. This is the most severe consequence in this document.

**Combined with 1.1.1, the entire owner-to-customer special-requests marketplace is non-functional in production:** owners can neither see open requests nor respond to them.

---

### 1.2 High

#### 1.2.1 `PATCH /api/notifications/read` returns 405 - only POST is registered

| Request | Result |
|---|---|
| `OPTIONS /api/notifications/read` | `200`, **`Allow: POST`** |
| `PATCH` (no token) | `405 Method Not Allowed`, `Allow: POST` |

The frontend calls `PATCH` (`src/lib/notifications.js:171`). "Mark all as read" therefore fails on every attempt.

**Masked:** `markAllNotificationsReadWithFallback` (`notifications.js:196`) sets the local `masahati_notifications_read_v1` flag and reports success regardless. The badge clears visually, but the backend still holds every notification as unread, so they reappear on the next device or session.

**Fix (1 line) - recommended, keeps the contract consistent:**

```php
Route::match(['post', 'patch'], '/notifications/read', ...);
```

The alternative is a one-line frontend change to `POST`. `PATCH` is the semantically correct verb for a partial update, so aliasing is preferable.

---

#### 1.2.2 `/api/owner/documents` returns `files` as an array; the frontend requires an object

**Actual response:**

```json
{
  "status": "none",
  "files": [],
  "note": null,
  "review_note": null,
  "admin_note": null,
  "submitted_at": null,
  "submittedAt": null,
  "reviewed_at": null,
  "reviewedAt": null
}
```

**What the frontend reads** - `normalizeDocFiles`, `src/lib/owner.js:1097`:

```js
for (const id of ['assets', 'cert']) {
  const f = files[id];          // files['assets'], files['cert']
}
```

Because `files` is an array, `files.assets` and `files.cert` are both `undefined` and the function returns `{}`. **The owner never sees the name, size, or type of any document they uploaded** - not immediately after uploading, and not on any later visit.

**Required shape:**

```json
"files": {
  "assets": { "name": "assets.pdf", "size": 284913, "type": "application/pdf" },
  "cert":   { "name": "cert.pdf",   "size": 118233, "type": "application/pdf" }
}
```

Only `name`, `size`, and `type` are read - the file bytes are never expected client-side. The `POST /api/owner/documents` upload endpoint must return the same corrected shape, since the frontend re-normalises its response.

**Confidence note:** the test account has no submitted documents, so a populated response could not be observed directly. This is still a confirmed defect because the *container type* is wrong, and the frontend lookup fails on type regardless of what the array would contain.

**Secondary observation:** the response also returns duplicate camelCase and snake_case keys (`submittedAt` alongside `submitted_at`, `reviewedAt` alongside `reviewed_at`). The frontend tolerates both, so this is cosmetic, but it suggests two serializers are being applied to the same resource.

---

### 1.3 Non-breaking issues

#### 1.3.1 `POST /api/login` returns no `user` object and no `role`

**Actual:** `{"message":"...","token":"14|...","name":"Ameer-Ayyad"}`

The frontend must resolve the user's role to route them to the correct dashboard. Since the response has no `role` and no `user` wrapper, `login()` (`src/lib/authStore.js:41`) falls through to a **second** `GET /api/profile` request to obtain it (`authStore.js:54-67`).

This works, but it doubles login latency on every attempt and adds a failure mode: if `/api/profile` is slow or errors, the user lands on the wrong screen.

**Suggested response:**

```json
{
  "token": "...",
  "user": { "id": 1, "name": "...", "email": "...", "role": "space_owner" }
}
```

**Confirmed working:** the request field is `login`, not `email`. Sending `email` returns `422 {"message":"The login field is required."}`.

#### 1.3.2 `GET` endpoints returning `201 Created`

`GET /api/profile`, `GET /api/dashboard/bookings`, and `GET /api/dashboard/favorites` all return **201**. The frontend only checks `res.ok`, so there is no user-visible break, but `201` on a `GET` is semantically wrong and produces noise in API monitoring, caches, and stricter clients. These should be `200`.

#### 1.3.3 OTP and password-reset endpoints are throttled before validation

`POST /api/verify-otp`, `POST /api/resend-otp`, and `POST /api/reset-password` all returned **429** on their first unauthenticated probe, indicating the throttle middleware runs before request validation.

The frontend has no 429-specific handling, so a rate-limited user sees the generic `تعذر إتمام الطلب (429)` - a server-error message - rather than "too many attempts, please wait". Since `handleResendOtp` implements a deliberate 30-second cooldown, users will hit this during normal use.

Two suggestions: return a `Retry-After` header, and add a specific 429 branch in the frontend's `request()` (`src/lib/api.js:224-236`).

---

### 1.4 Missing documentation

These are documentation gaps, not runtime failures. All listed endpoints exist and respond correctly.

**21 endpoints the frontend calls have no contract** in any of the six `BACKEND_*.md` files:

| Method | Path | Frontend call site |
|---|---|---|
| POST | `/api/login` | `authStore.js:42` |
| POST | `/api/register/customer` | `authStore.js:80` |
| POST | `/api/change-pass` | `authStore.js:165` |
| PATCH | `/api/customer/profile` | `authStore.js:182` |
| POST | `/api/uploadPicture` | `authStore.js:194` |
| PATCH | `/api/profile/picture` | `authStore.js:206` |
| POST | `/api/logout` | `authStore.js:217` |
| DELETE | `/api/delete-user` | `authStore.js:229` |
| POST | `/api/verify-otp` | `VerifyOtpPage.jsx:76` |
| POST | `/api/resend-otp` | `VerifyOtpPage.jsx:110` |
| GET | `/api/dashboard/stats` | `dashboard.js:120` |
| GET | `/api/dashboard/upcoming-booking` | `dashboard.js:121` |
| GET | `/api/dashboard/bookings` | `dashboard.js:122` |
| GET | `/api/dashboard/favorites` | `dashboard.js:123` |
| POST | `/api/dashboard/favorites/toggle` | `dashboard.js:170` |
| GET | `/api/dashboard/spaces` | `dashboard.js:183` (dead code) |
| POST | `/api/special-requests/{id}/offers/{id}/accept` | `requests.js:455` |
| POST | `/api/special-requests/{id}/offers/{id}/reject` | `requests.js:654` |
| POST | `/api/special-requests/{id}/close` | `requests.js:668` |
| PATCH | `/api/owner/bookings/{id}/status` | `owner.js:787` |
| GET | `/api/owner/reviews` | `owner.js:682` |

**Four endpoints are marked `NOT IMPLEMENTED YET` but are now live.** `BACKEND_OWNER_DASHBOARD_CONTRACT.md` still lists these as pending, but all four are implemented, correctly auth-protected, and responding:

| Endpoint | Contract line | Observed |
|---|---|---|
| `PATCH /api/owner/spaces/{spaceId}/active` | `:197` | `401` unauth, `Allow: PATCH` - exists |
| `GET /api/owner/bookings` | `:232` | `401` unauth, `Allow: GET` - exists |
| `PUT /api/owner/spaces/{spaceId}` | `:298` | `401` unauth, `Allow: PUT, DELETE` - exists |
| `DELETE /api/owner/spaces/{spaceId}` | `:353` | `401` unauth, `Allow: PUT, DELETE` - exists |

Please update the contract so these stop being tracked as pending.

**One stale code comment should be deleted.** `src/lib/owner.js:784-785` states *"الواجهة غير مفعّلة بعد في الباك إند"* ("not yet enabled in the backend") above `PATCH /api/owner/bookings/{id}/status`. That endpoint is live and working. The comment is what led to it being treated as pending.

**`api.txt` is missing.** Code comments repeatedly cite `api.txt` as the source of the endpoint list, but the file is not in the repository. Please provide a canonical copy.

---

## 2. What I need from you (frontend)

### 2.1 Security - do this first

**Rotate both account passwords.** Two real production account credentials were used for this audit and they are present in the chat transcript used to generate this document. They must be considered compromised.

### 2.2 Access - needed to finish verification

**A staging backend URL plus test accounts.** I deliberately sent no writes with a valid token, so **28 of 32 write endpoints are unverified** - route existence only. Without staging I cannot confirm request bodies, validation rules, or status transitions. This is the largest remaining gap.

**One account that contains real data** (at least one space, booking, ad, and special request). Both supplied accounts returned empty collections, so per-item field names are unverified for 8 endpoints. Only the collection wrapper keys were confirmed.

### 2.3 Repo hygiene

**Commit the audit artifacts.** `api-audit-results.json`, `scripts/api-audit.mjs`, and this document are currently uncommitted.

**Investigate `TOKEN_KEY = '***'`.** `src/lib/api.js:22-23` ships as:

```js
const TOKEN_KEY = '***';
const USER_KEY = '***:user';
```

Verified at byte level (hex `2A 2A 2A`) - this is real committed source, not a display artefact. It is functionally consistent, so the app works today, but a placeholder reached `main`. **Was a real value replaced during a scrub, and was anything else in that file affected?** Note this is not a security control: the localStorage key name provides no protection, since any XSS reads the value regardless of its name.

### 2.4 After the backend ships

**Remove or gate the demo fallbacks.** The frontend wraps most endpoints in `*WithFallback` helpers backed by `localStorage` demo stores, which is why none of the issues above were noticed. The failure modes that hid them:

| Fallback | Line | Wraps | Consequence when the endpoint fails |
|---|---|---|---|
| `loadMarketWithFallback` | `owner.js:803` | `GET /special-requests/open` | empty market, no error (1.1.1) |
| `submitProposalWithFallback` | `owner.js:817` | `POST .../offers` | **proposal saved locally, never synced - data loss** (1.1.2) |
| `markAllNotificationsReadWithFallback` | `notifications.js:196` | `PATCH /notifications/read` | badge clears locally, server unchanged (1.2.1) |
| `loadOwnerDocumentsWithFallback` | `owner.js:1213` | `GET /owner/documents` | `status: 'none'` read from localStorage (1.2.2) |
| `submitOwnerDocumentsWithFallback` | `owner.js:1224` | `POST /owner/documents` | optimistic `pending`; **file bytes never re-sent** |
| `loadOwnerBookingsWithFallback` | `owner.js:1032` | `GET /owner/bookings` | returns `{ demo: true, bookings: [] }` - indistinguishable from a real empty state |
| `deleteSpaceWithFallback` | `owner.js:1008` | `DELETE /owner/spaces/{id}` | reports "space deleted" while the record still exists |
| `acceptOfferWithFallback` | `requests.js:579` | `POST .../accept` | **fabricates a booking** and injects it into the dashboard - a phantom booking appears in "My bookings" |
| `dashboard.js:120-124` | - | all 5 customer dashboard calls | `.catch(() => null)` on every call; renders an all-zero dashboard with no banner |

The owner dashboard loader is the worst case. `loadOwnerDashboardImpl` (`owner.js:1296-1317`) uses `Promise.allSettled`, and demo mode engages **only if all six requests fail**:

```js
const bookingsApi = pick(3, []);   // one failed request -> silent empty list
const reviewsApi  = pick(5, []);
```

A single 404 among six endpoints produces a normal-looking dashboard with `demo: false` and an empty list.

Once 1.1 and 1.2 are resolved, these fallbacks should be removed or restricted to an explicit developer flag, otherwise the next missing endpoint will be equally invisible.

---

## 3. Questions I have for you

**Q1. Does `POST /special-requests/{id}/offers` exist under a different route name?**
It is documented with a sample path but is unrouted. This determines whether section 1.1.2 is new backend work or a one-line frontend change. **Please check before building.**

**Q2. Who else consumes `/api/owner/documents` and `/api/login`?**
The fixes for 1.2.2 and 1.3.1 both change response shapes. I only know about this one frontend. A mobile app, an admin panel, or Postman-based testing could break. Can you grep your side, or should the new shape be shipped additively?

**Q3. Is there a staging backend and a set of test accounts?**
See 2.2. Without it, 28 of 32 write endpoints stay unverified.

**Q4. Can I get an account that actually contains data?**
See 2.2. Needed to verify item-level response fields for 8 collection endpoints.

**Q5. Is `GET /api/ads/open` implemented, and should the frontend call it?**
It is specified four times across `BACKEND_OWNER_ADS_CONTRACT.md` and `BACKEND_OWNER_DASHBOARD_CONTRACT.md`, but no code in `src/` ever requests it. `dashboard.js:159` hardcodes `ads: []` and `AdBanner.jsx` is purely presentational. The customer ad feed is therefore wired to nothing. Either we wire it up or we remove it from the contracts so it stops being treated as pending work.

**Q6. `cancelBooking()` makes no HTTP request at all - should I implement it or remove the affordance?**
`src/lib/dashboard.js:202-205` sleeps 250 ms and returns `{ ok: true }` without calling the API. A customer cancelling a booking currently changes local state only, and the cancellation is lost on reload. Implementing it needs a new backend endpoint, which is why it is not in section 1.

**Q7. If you will not alias `PATCH` on `/notifications/read`, may I change the frontend to `POST`?**
Fallback for 1.2.1 if you prefer to keep POST only.

**Q8. Is the throttling on the OTP endpoints intentional, and what are the limits?**
See 1.3.3.

**Q9. Can the contract be updated to mark the four live endpoints as done?**
See the table in section 1.4. This also lets the stale comment at `owner.js:784-785` be deleted.

**Q10. Was a real `TOKEN_KEY` value scrubbed from `api.js:22`?**
See 2.3.

---

## 4. Unconfirmed - needs access, not reported as broken

These are **not** known failures. They are gaps in what could be verified, listed separately so they are never mistaken for confirmed defects. There is no evidence any of them are broken.

| Area | Count | Why unverified |
|---|---|---|
| Write endpoints never called with a valid token | 28 of 32 | Deliberate: no writes were sent with a valid token |
| Collection endpoints, item-level fields | 8 | Test accounts returned empty arrays |
| Multipart uploads | 4 | Not exercised: `/owner/documents`, `/uploadPicture`, `/profile/picture`, `/register/space-owner` |
| `POST /api/assistant/chat` model path | 1 | Probed with an empty body only (`422`), so no paid LLM call was made |

**Important:** route-shadowing bugs like 1.1.1 were only detectable with an authenticated request. Any of the 28 unverified write endpoints could carry the same class of bug and this audit could not see it.

**One note on `/api/assistant/chat`:** it is called three different ways on a single route, and all three must return `{ reply, spaces? }`:

| Caller | Auth | Body |
|---|---|---|
| `assistant.js:24` (anonymous) | none | `{ message }` |
| `ownerAssistant.js:166` | Bearer | `{ message, owner_context }` |
| `customerAssistant.js:134` | Bearer | `{ message, customer_context }` |

---

## 5. Full endpoint status table

`Unauth status` is the response to an unauthenticated request: `401` proves the route exists behind auth, `404` proves it does not, `422` proves a public route reached validation, `429` proves throttling. `Allow` is the server's own list of registered methods.

| Method | Path | Unauth status | Allow | Verdict |
|---|---|---|---|---|
| POST | `/api/login` | 422 | POST | EXISTS |
| GET | `/api/profile` | 401 | GET | EXISTS (returns 201, see 1.3.2) |
| POST | `/api/register/customer` | 422 | POST | EXISTS |
| POST | `/api/register/space-owner` | 422 | POST | EXISTS |
| POST | `/api/auth/google` | 422 | POST | EXISTS |
| POST | `/api/change-pass` | 401 | POST | EXISTS |
| PATCH | `/api/customer/profile` | 401 | PATCH | EXISTS |
| POST | `/api/uploadPicture` | 401 | POST | EXISTS |
| PATCH | `/api/profile/picture` | 401 | PATCH | EXISTS |
| POST | `/api/logout` | 401 | POST | EXISTS |
| DELETE | `/api/delete-user` | 401 | DELETE | EXISTS |
| POST | `/api/forgot-password` | 422 | POST | EXISTS |
| POST | `/api/verify-otp` | 429 | POST | EXISTS (throttled, see 1.3.3) |
| POST | `/api/resend-otp` | 429 | POST | EXISTS (throttled, see 1.3.3) |
| POST | `/api/reset-password` | 429 | POST | EXISTS (throttled, see 1.3.3) |
| GET | `/api/dashboard/stats` | 401 | GET | EXISTS, all 4 expected keys present |
| GET | `/api/dashboard/upcoming-booking` | 401 | GET | EXISTS |
| GET | `/api/dashboard/bookings` | 401 | GET | EXISTS (returns 201, see 1.3.2) |
| GET | `/api/dashboard/favorites` | 401 | GET | EXISTS (returns 201, see 1.3.2) |
| POST | `/api/dashboard/favorites/toggle` | 401 | POST | EXISTS |
| GET | `/api/dashboard/spaces` | 401 | GET | EXISTS (dead code) |
| GET | `/api/special-requests` | 401 | GET, POST | EXISTS |
| POST | `/api/special-requests` | 401 | GET, POST | EXISTS |
| GET | `/api/special-requests/{id}` | 401 | GET | EXISTS (shadows `/open`, see 1.1.1) |
| POST | `/api/special-requests/{id}/offers/{id}/accept` | 401 | POST | EXISTS |
| POST | `/api/special-requests/{id}/offers/{id}/reject` | 401 | POST | EXISTS |
| POST | `/api/special-requests/{id}/close` | 401 | POST | EXISTS |
| GET | `/api/special-requests/open` | 401 | GET | **404 when authenticated - see 1.1.1** |
| POST | `/api/special-requests/{id}/offers` | 404 | - | **MISSING - see 1.1.2** |
| GET | `/api/owner/spaces` | 401 | GET, POST | EXISTS |
| POST | `/api/owner/spaces` | 401 | GET, POST | EXISTS |
| PATCH | `/api/owner/spaces/{spaceId}/active` | 401 | PATCH | EXISTS (contract says pending, see 1.4) |
| PUT | `/api/owner/spaces/{spaceId}` | 401 | PUT, DELETE | EXISTS (contract says pending, see 1.4) |
| DELETE | `/api/owner/spaces/{spaceId}` | 401 | PUT, DELETE | EXISTS (contract says pending, see 1.4) |
| GET | `/api/owner/bookings` | 401 | GET | EXISTS (contract says pending, see 1.4) |
| PATCH | `/api/owner/bookings/{bookingId}/status` | 401 | PATCH | EXISTS (stale comment, see 1.4) |
| GET | `/api/owner/reviews` | 401 | GET | EXISTS |
| GET | `/api/owner/documents` | 401 | GET, POST | EXISTS (**shape mismatch - see 1.2.2**) |
| POST | `/api/owner/documents` | 401 | GET, POST | EXISTS |
| GET | `/api/owner/offers` | 401 | GET | EXISTS |
| GET | `/api/owner/ads` | 401 | GET, POST | EXISTS |
| POST | `/api/owner/ads` | 401 | GET, POST | EXISTS |
| PUT | `/api/owner/ads/{adId}` | 401 | PUT, DELETE | EXISTS |
| DELETE | `/api/owner/ads/{adId}` | 401 | PUT, DELETE | EXISTS |
| POST | `/api/owner/ads/{adId}/publish` | 401 | POST | EXISTS |
| GET | `/api/notifications` | 401 | GET | EXISTS |
| PATCH | `/api/notifications/read` | 405 | POST | **WRONG METHOD - see 1.2.1** |
| POST | `/api/assistant/chat` | 422 | POST | EXISTS |

### Verified working

- 46 of 48 endpoints exist with correct methods and auth protection.
- Both supplied accounts authenticate successfully using `{"login", "password"}`.
- `GET /api/profile` returns the full expected shape for both roles: `{name, phone, email, role, picture, proof_document}`.
- `GET /api/dashboard/stats` returns all 4 expected keys.
- Every collection endpoint returns the correct wrapper key: `spaces`, `bookings`, `reviews`, `ads`, `offers`, `requests`, `notifications`, `data`.
- Documents `status` values match the frontend's `DOC_STATUS` enum.

---

## 6. Reproducing the four defects

```bash
# obtain a token (note: the field is "login", not "email")
curl -s -X POST https://back-end-kwba.onrender.com/api/login \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d '{"login":"<owner email>","password":"<password>"}'
# -> {"message":"...","token":"...","name":"..."}

export OWNER_TOKEN="<token from above>"

# 1.1.1  expect: 404 No query results for model [App\Models\SpecialRequest]
curl -i -H "Authorization: Bearer $OWNER_TOKEN" \
  https://back-end-kwba.onrender.com/api/special-requests/open

# 1.1.1  control - same error proves the {id} binding is answering
curl -i -H "Authorization: Bearer $OWNER_TOKEN" \
  https://back-end-kwba.onrender.com/api/special-requests/1

# 1.1.2  expect: 404 with no Allow header
curl -i -X OPTIONS -H "Authorization: Bearer $OWNER_TOKEN" \
  https://back-end-kwba.onrender.com/api/special-requests/1/offers

# 1.2.1  expect: 405 with Allow: POST
curl -i -X PATCH -H "Authorization: Bearer $OWNER_TOKEN" \
  https://back-end-kwba.onrender.com/api/notifications/read

# 1.2.2  expect: "files": []
curl -s -H "Authorization: Bearer $OWNER_TOKEN" \
  https://back-end-kwba.onrender.com/api/owner/documents
```

**Expected results once fixed:** 1.1.1 returns `200` with a JSON list, 1.1.2 returns 2xx, 1.2.1 returns 2xx, 1.2.2 returns `files` as an object keyed by `assets` and `cert`.

---

## 7. Re-running the whole audit

```bash
# credentials are read from the environment and never written to disk
export OWNER_EMAIL='...'
export OWNER_PASSWORD='...'
export CUSTOMER_EMAIL='...'
export CUSTOMER_PASSWORD='...'

node scripts/api-audit.mjs                  # existence + authenticated reads
AUDIT_SKIP_A=1 node scripts/api-audit.mjs   # authenticated sweep only
```

Writes `api-audit-results.json` (raw evidence) and prints a per-endpoint verdict. The harness never sends a write with a valid token; its `OPTIONS` and unauthenticated sweeps cannot reach a controller at all. Account PII is redacted from the evidence file.

---

## 8. Recommended order of work

| # | Item | Section | Effort |
|---|---|---|---|
| 1 | Add `->whereNumber('id')` and reorder `/open` above `/{id}` | 1.1.1 | ~2 lines |
| 2 | Alias `PATCH` on `/notifications/read` next to the existing `POST` | 1.2.1 | 1 line |
| 3 | Confirm the intended route for the offers endpoint, then implement or relocate it | 1.1.2 | Confirm first |
| 4 | Return `files` as an object keyed `assets` / `cert` | 1.2.2 | Serializer change |
| 5 | Include `user` with `role` in the login response | 1.3.1 | Small |
| 6 | Return `200` instead of `201` on three `GET` endpoints | 1.3.2 | Trivial |
| 7 | Add `Retry-After` to throttled responses | 1.3.3 | Small |
| 8 | Update the contract to mark four live endpoints as done | 1.4 | Docs |
| 9 | Document the 21 undocumented endpoints; decide on `ads/open` | 1.4 | Docs |
| 10 | Provide staging plus a seeded test account | 2.2 | Access |
| 11 | Remove or gate the demo fallbacks once items 1-4 ship | 2.4 | Frontend |

Items 1 and 2 are one-liners that unblock two completely broken user flows.

---

## Appendix - evidence files

| File | Contents |
|---|---|
| `api-audit-results.json` | Raw per-endpoint evidence: status codes, `Allow` headers, redacted response bodies, authenticated shape checks. Contains no tokens, passwords, emails, or phone numbers. |
| `scripts/api-audit.mjs` | The re-runnable harness. Reads credentials from environment variables only. |
