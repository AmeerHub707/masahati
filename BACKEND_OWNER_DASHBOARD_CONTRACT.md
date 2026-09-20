# Masahati — Space Owner Dashboard Backend Contract

The space owner dashboard (`/dashboard/space-owner`) is **DONE on the frontend** (production API
calls + a local demo fallback). Owners get: an **overview**, the **open market** feed, **my
proposals**, **my spaces** management (add + activate/stop), and **settings**.

This document is the contract the backend developer must implement for the parts that are not yet
covered by `BACKEND_SPECIAL_REQUESTS_BROADCAST_CONTRACT.md` (which already covers the market feed,
submit-proposal, proposal history and notifications — read it first).

It covers:

1. `GET /api/owner/offers` — already specified in the broadcast contract (§4); re-listed here with
   the exact shape the owner UI consumes.
2. `GET /api/owner/spaces` and `POST /api/owner/spaces` — space CRUD (list + create).
3. `PATCH /api/owner/spaces/{spaceId}/active` — activate / stop a space. **Not implemented yet.**
4. `GET /api/owner/bookings` — owner-side bookings/history. **Not implemented yet.**
5. `PUT /api/owner/spaces/{spaceId}` and `DELETE /api/owner/spaces/{spaceId}` — space edit + delete
   (used by the redesigned "مساحاتي" management view). **Not implemented yet.**

---

## Auth model

| Role key (backend) | Frontend role | Notes |
|---|---|---|
| `customer` | `customer` | Creates special requests, accepts/rejects offers |
| `space_owner` | `space_owner` / `owner` | Reads market feed, submits proposals, owns spaces |

All endpoints below require `Authorization: Bearer <token>` (Sanctum opaque token, same as the
rest of the app). Every error response must be **JSON** (`{ "message": "..." }`), never an HTML
page.

---

## 1) Owner proposal history

```
GET /api/owner/offers     (auth: space_owner)
```

Returns the current owner's submitted offers with their request context and live status.

### Success (200)
```json
{
  "data": [
    {
      "offer_id": 88,
      "request_id": 41,
      "request_title": "قاعة محاضرات لدورة تدريبية",
      "status": "pending",
      "price_per_hour": 150,
      "currency": "ش.ج",
      "duration_hours": 3,
      "created_at": "2026-09-18 11:00:00"
    }
  ]
}
```

- The frontend accepts `{ data: [...] }`, `{ offers: [...] }`, or a bare array.
- Field mapping: `offer_id`/`id`, `request_id`, `request_title`/`title`, `price_per_hour`/`price`,
  `duration_hours`/`hours`, `created_at`/`created`.
- `status` values: `pending` | `accepted` | `rejected` | `closed` (request was closed/accepted
  before a decision on this offer). The UI groups pending vs resolved, and shows a "راجع
  مراسلاتك" hint on accepted offers.

---

## 2) List owner spaces

```
GET /api/owner/spaces     (auth: space_owner)
```

Returns all spaces owned by the current owner.

### Success (200)
```json
{
  "data": [
    {
      "space_id": 12,
      "title": "قاعة العروض الكبرى",
      "description": "قاعة واسعة تتسع لـ 120 شخصاً بإضاءة طبيعية.",
      "location": "وسط المدينة",
      "image": "/storage/spaces/12.jpg",
      "price_per_hour": 150,
      "capacity": 120,
      "amenities": [
        { "key": "internet" },
        { "key": "projector" },
        { "key": "ac" }
      ],
      "internet": true,
      "power": true,
      "is_active": true,
      "rating": 4.8
    }
  ]
}
```

Notes:

- `amenities` may be an array of objects with `key`/`name`, or a bare array of strings. Known keys:
  `internet`, `electricity`, `projector`, `ac`, `microphone`.
- `internet` / `power` boolean flags are convenience copies of `amenities`; the frontend falls back
  to `wifi`/`electricity`/`has_internet`/`has_power` aliases if they are absent.
- `is_active`: `false` marks a space as stopped; it is hidden from the booking flow but stays in the
  owner's list ("متوقفة" section).
- `image`: leave empty string when the space has no photo (the card renders a gradient fallback).

---

## 3) Create a space

```
POST /api/owner/spaces     (auth: space_owner)
```

### Request body (what the frontend sends)
```json
{
  "title": "غرفة الاجتماعات الذكية",
  "description": "10 مقاعد مع شاشة عرض وكاميرا.",
  "location": "المنطقة الشرقية",
  "price_per_hour": 100,
  "capacity": 10,
  "amenities": ["internet", "projector", "ac"],
  "internet": true,
  "power": true,
  "image": ""
}
```

### Success (201)
```json
{
  "message": "تمت إضافة المساحة.",
  "space": {
    "space_id": 24,
    "title": "غرفة الاجتماعات الذكية",
    "is_active": true,
    "rating": 0
  }
}
```

- The frontend maps `body.space` or the whole `body` back through `mapSpace` — send the created
  space record (same shape as §2) so the list can refresh instantly.
- A newly created space should default to `is_active: true`.

### Errors
| Status | Body | When |
|---|---|---|
| 401 | `{ "message": "غير مصرح." }` | missing/revoked token |
| 403 | `{ "message": "هذه الصفحة متاحة لمالكي المساحات فقط." }` | non-owner |
| 422 | `{ "message": "…" }` | missing/invalid fields (`title`, `price_per_hour`, `capacity`…) |

---

## 4) Activate / stop a space   ⚠️ NOT IMPLEMENTED YET

```
PATCH /api/owner/spaces/{spaceId}/active     (auth: space_owner)
```

### Request body
```json
{ "is_active": false }
```

### Success (200)
```json
{
  "message": "تم تحديث حالة المساحة.",
  "space": {
    "space_id": 12,
    "title": "قاعة العروض الكبرى",
    "is_active": false
  }
}
```

- Toggling a space off must stop it from being selectable in the customer booking flow and from
  appearing as "أضف مساحة" options in new proposals.
- Re-enabling (`is_active: true`) restores the space immediately.

### Errors
| Status | Body | When |
|---|---|---|
| 404 | `{ "message": "المساحة غير موجودة." }` | bad `spaceId`, or space belongs to another owner |
| 422 | `{ "message": "الحالة غير صالحة." }` | `is_active` missing or not boolean |

---

## 5) Owner bookings / history   ⚠️ NOT IMPLEMENTED YET

```
GET /api/owner/bookings     (auth: space_owner)
```

Returns confirmed bookings on the owner's spaces (created when a customer accepts an offer).
The frontend currently renders an empty state, but the endpoint keeps the overview honest.

### Success (200)
```json
{
  "data": [
    {
      "booking_id": 5,
      "space_name": "قاعة العروض الكبرى",
      "image": "/storage/spaces/12.jpg",
      "date": "2026-09-25",
      "time_from": "10:00:00",
      "time_to": "13:00:00",
      "hours": 3,
      "price": 450,
      "customer_name": "أحمد خالد",
      "status": "confirmed"
    }
  ]
}
```

- Field mapping: `booking_id`/`id`, `space_name`/`title`, `date`, `time_from`/`time_to` (the UI
  renders `time_from – time_to`, falling back to `time`), `hours`, `price`/`cost`,
  `customer`/`customer_name`, `status`.
- `status` may be anything (`pending` | `confirmed` | `completed` | `cancelled`) — the UI shows the
  list verbatim for now.

---

## Field mapping reference (frontend normalization in `src/lib/owner.js`)

| Backend key (Laravel) | Frontend field |
|---|---|
| `space_id` / `id` | `space.id` |
| `title` / `name` | `space.title` |
| `location` / `area` | `space.location` |
| `image` | `space.image` (prefixed via `imageUrl`) |
| `price_per_hour` / `price` | `space.price_per_hour` |
| `capacity` | `space.capacity` |
| `amenities` (array of `{key}` or strings) | `space.amenities` (key strings) |
| `internet` / `has_internet` / `wifi` | `space.internet` |
| `power` / `has_power` / `electricity` | `space.power` |
| `is_active` | `space.is_active` |
| `rating` | `space.rating` |
| `offer_id` / `id` | `offer.id` |
| `request_id` | `offer.requestId` |
| `request_title` / `title` | `offer.requestTitle` |
| `status` (`pending`/`accepted`/`rejected`/`closed`) | `offer.status` |
| `price_per_hour` / `price` | `offer.price_per_hour` |
| `currency` | `offer.currency` (default `ش.ج`) |
| `duration_hours` / `hours` | `offer.duration_hours` |
| `created_at` / `created` | `offer.created_at` |

---

## 6) Update a space   ⚠️ NOT IMPLEMENTED YET

```
PUT /api/owner/spaces/{spaceId}     (auth: space_owner)
```

### Request body (what the frontend sends — same shape as create)
```json
{
  "title": "غرفة الاجتماعات الذكية",
  "description": "10 مقاعد مع شاشة عرض وكاميرا.",
  "location": "المنطقة الشرقية",
  "price_per_hour": 110,
  "capacity": 10,
  "amenities": ["internet", "projector", "ac"],
  "internet": true,
  "power": true,
  "image": ""
}
```

### Success (200)
```json
{
  "message": "تم تحديث المساحة.",
  "space": {
    "space_id": 12,
    "title": "غرفة الاجتماعات الذكية",
    "price_per_hour": 110,
    "is_active": true,
    "rating": 4.6
  }
}
```

- Send the updated record (same shape as §2) so the list can refresh instantly.
- Must 404 if the space belongs to another owner or does not exist.

### Errors
| Status | Body | When |
|---|---|---|
| 401 | `{ "message": "غير مصرح." }` | missing/revoked token |
| 403 | `{ "message": "هذه الصفحة متاحة لمالكي المساحات فقط." }` | non-owner |
| 404 | `{ "message": "المساحة غير موجودة." }` | bad `spaceId` or not owned by this owner |
| 422 | `{ "message": "…" }` | missing/invalid fields |

---

## 7) Delete a space   ⚠️ NOT IMPLEMENTED YET

```
DELETE /api/owner/spaces/{spaceId}     (auth: space_owner)
```

### Success (200)
```json
{
  "message": "تم حذف المساحة."
}
```

- The space disappears from the owner's list, the customer booking flow, and future proposal
  options. If the backend keeps soft-deletes / rejects deletion of a space with confirmed
  bookings, return a clear JSON error so the UI can show it.

### Errors
| Status | Body | When |
|---|---|---|
| 401 | `{ "message": "غير مصرح." }` | missing/revoked token |
| 403 | `{ "message": "هذه الصفحة متاحة لمالكي المساحات فقط." }` | non-owner |
| 404 | `{ "message": "المساحة غير موجودة." }` | bad `spaceId` or not owned by this owner |

---

## Verification checklist (after deploy)

```
# owner (need an owner token)
GET    https://back-end-kwba.onrender.com/api/owner/spaces     -> 200 JSON list of spaces
POST   https://back-end-kwba.onrender.com/api/owner/spaces     -> 201 JSON created space
PATCH  https://back-end-kwba.onrender.com/api/owner/spaces/12/active -> 200 JSON (is_active flipped)
GET    https://back-end-kwba.onrender.com/api/owner/offers      -> 200 JSON list of offers
GET    https://back-end-kwba.onrender.com/api/owner/bookings    -> 200 JSON list (may be empty)

# any
GET    https://back-end-kwba.onrender.com/api/owner/spaces (no token) -> 401 JSON
```

Note: the "مساحاتي" view always tries the real API first (GET/POST/PATCH + PUT/DELETE above) and
falls back to a local demo store when the endpoint is missing or the backend is unreachable —
that is why the UI keeps working before the backend routes for §4/§6/§7 are implemented.

Endpoints already specified in `BACKEND_SPECIAL_REQUESTS_BROADCAST_CONTRACT.md` (market feed
`GET /api/special-requests/open`, submit `POST /api/special-requests/{id}/offers`, notifications)
are unchanged — the owner dashboard consumes the same shapes.