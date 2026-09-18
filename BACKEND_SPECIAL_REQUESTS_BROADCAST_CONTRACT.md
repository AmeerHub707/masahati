# Masahati — Special Requests Broadcast Backend Contract

The customer dashboard "الطلبات الخاصة" (reverse auction / RFQ) feature is **DONE on the
frontend** (production + a local demo fallback). When a customer publishes a special request,
it must be **broadcast to all space owners** so they can see it and submit proposals.

This document is the contract the backend developer must implement. It covers:

1. A **broadcast** (realtime push) so owners learn about new requests immediately.
2. REST endpoints for the **owner market feed** and **submitting proposals**.
3. **Notifications** for both roles.
4. The current customer-only endpoints already called by the frontend.

> The frontend **never blocks** on push: it polls the market/notifications feed with a
> graceful fallback. So implement push whenever convenient — the app works with pure polling,
> and improves automatically once push is live.

---

## Auth model

| Role key (backend) | Frontend role | Notes |
|---|---|---|
| `customer` | `customer` | Creates special requests, accepts/rejects offers |
| `space_owner` | `owner` | Views the market feed, submits proposals |

All endpoints below except the public broadcast channel require `Authorization: Bearer <token>`
(Sanctum opaque token, same as the rest of the app).

---

## 1) Broadcast: "new special request" → all owners

### Realtime (recommended: Pusher / Reverb / WebSockets)

When `POST api/special-requests` succeeds, the backend **broadcasts** a `SpecialRequestCreated`
event on a **public** channel:

```
Channel:  special-requests
Event:    SpecialRequestCreated
```

Payload (must match what an owner would GET from the feed):

```json
{
  "request": {
    "request_id": 41,
    "title": "قاعة محاضرات لدورة تدريبية",
    "description": "أبحث عن قاعة تتسع لـ 40 متدرباً...",
    "space_type": "whole",
    "capacity": 40,
    "schedule_preset": "weekly",
    "schedule_count": 8,
    "schedule_label": "أسبوعي × 8",
    "preferred_time": "10:00 ص – 1:00 م",
    "area": "وسط المدينة",
    "amenities": ["internet", "projector", "ac"],
    "budget": 180,
    "status": "open",
    "offers_count": 0,
    "created_at": "2026-09-18 10:30:00"
  }
}
```

A public channel means **any authenticated owner** can subscribe
(`Echo.private` or `Echo.channel` — choose the public channel variant for all owners, or
`private-special-requests` with owner-role authorization middleware if you want a private one).

Why public: the market feed is intentionally shared by *all* owners (they compete on price),
so there is no per-owner targeting needed for the initial broadcast.

### Alternative transport (if push is not available yet)

The frontend polls `GET api/special-requests/open` (below) every 30–60 s while the owner is on
the market tab. **This works with nothing extra on your side.** No action needed — just implement
the feed endpoint.

---

## 2) Owner market feed

```
GET /api/special-requests/open     (auth: space_owner)
```

Returns all **open** special requests (status = `open` and not expired), newest first.

### Success (200)
```json
{
  "data": {
    "requests": [
      {
        "request_id": 41,
        "title": "قاعة محاضرات لدورة تدريبية",
        "description": "أبحث عن قاعة تتسع لـ 40 متدرباً...",
        "space_type": "whole",
        "capacity": 40,
        "schedule_preset": "weekly",
        "schedule_count": 8,
        "schedule_label": "أسبوعي × 8",
        "preferred_time": "10:00 ص – 1:00 م",
        "area": "وسط المدينة",
        "amenities": ["internet", "projector", "ac"],
        "budget": 180,
        "status": "open",
        "offers_count": 2,
        "created_at": "2026-09-18 10:30:00",
        "expires_at": "2026-10-02 10:30:00"
      }
    ]
  },
  "pagination": { "current_page": 1, "last_page": 3, "total": 23 }
}
```

- `expires_at`: **optional**. When present and in the past, the frontend renders the request as
  expired/closed and hides the proposal form. The frontend respects whatever the backend sends.
- The frontend accepts `{ data: { requests: [...] } }`, `{ requests: [...] }`, or a bare array —
  pick the paginated form above.
- Field mapping on the frontend: `request_id`/`id`, `description` = notes, `budget` = max budget.

### Errors
| Status | Body | When |
|---|---|---|
| 401 | `{ "message": "غير مصرح." }` | owner token missing/revoked |
| 403 | `{ "message": "هذه الصفحة متاحة لمالكي المساحات فقط." }` | non-owner caller |

---

## 3) Submit a proposal (owner → request)

```
POST /api/special-requests/{requestId}/offers     (auth: space_owner)
```

### Request body
```json
{
  "space_id": 12,
  "price_per_hour": 150,
  "duration_hours": 3,
  "notes": "القاعة مجهزة بشاشة عرض 120 بوصة وإنترنت 100 ميجا.",
  "currency": "ش.ج"
}
```

### Success (201)
```json
{
  "message": "تم إرسال عرضك، وسيصل صاحب الطلب للاختيار.",
  "offer": {
    "offer_id": 88,
    "owner_name": "مركز النور للتدريب",
    "owner_avatar": "/storage/avatars/5.jpg",
    "space_name": "قاعة العروض الكبرى",
    "space_image": "/storage/spaces/12.jpg",
    "price_per_hour": 150,
    "currency": "ش.ج",
    "duration_hours": 3,
    "location": "وسط المدينة",
    "notes": "القاعة مجهزة بشاشة عرض...",
    "rating": 4.8,
    "status": "pending",
    "created_at": "2026-09-18 11:00:00"
  }
}
```

### Rules and errors
| Status | Body | When |
|---|---|---|
| 401 | `{ "message": "غير مصرح." }` | no/invalid token |
| 403 | `{ "message": "هذه الصفحة متاحة لمالكي المساحات فقط." }` | non-owner |
| 404 | `{ "message": "الطلب غير موجود." }` | bad `requestId` |
| 422 | `{ "message": "طلب مغلق للعروض." }` | request is `accepted`, `closed`, or expired |
| 422 | `{ "message": "سبق أن قدّمت عرضاً لهذا الطلب." }` | owner already has a pending offer on it |

> **One offer per owner per request.** Enforce on your side (unique partial index or a check) —
> the frontend also disables the submit button after the first attempt, but the backend rule is
> the source of truth.

After a successful insert, the customer receives a notification (see §5):
"عرض جديد على طلبك «...»".

---

## 4) Owner proposal history

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
      "duration_hours": 3,
      "created_at": "2026-09-18 11:00:00"
    }
  ]
}
```

`status` values: `pending` | `accepted` | `rejected` | `closed` (request was closed/accepted
before a decision on this offer).

---

## 5) Notifications

```
GET  /api/notifications            (auth: customer OR space_owner)
PATCH /api/notifications/read      (auth: any) — mark all read
PATCH /api/notifications/{id}/read (auth: any) — mark one read   (optional)
```

### GET — Success (200)
```json
{
  "data": {
    "notifications": [
      {
        "id": 12,
        "type": "special_request_offer",
        "text": "عرض جديد على طلبك «قاعة محاضرات لدورة تدريبية»",
        "time": "منذ 5 دقائق",
        "read": false,
        "created_at": "2026-09-18 11:00:00"
      }
    ]
  },
  "pagination": { "current_page": 1, "last_page": 1, "total": 1 }
}
```

The frontend renders `text` verbatim; `time` may be either a ready Arabic relative string or an
ISO date the frontend can format. Keep them human-readable.

### Notification trigger rules (backend)
| Trigger | Recipient | `type` | Suggested `text` |
|---|---|---|---|
| New special request published | **all owners** | `special_request_new` | "طلب جديد في السوق: «...» — قدّم عرضك." |
| New offer on a request | **request owner** | `special_request_offer` | "عرض جديد على طلبك «...»" |
| Offer accepted | **offer owner** | `special_request_offer_accepted` | "تم قبول عرضك على «...»" |
| Offer rejected | **offer owner** | `special_request_offer_rejected` | "تم رفض عرضك على «...»" |

The "new request → all owners" notifications are nice-to-have on top of the channel broadcast;
the realtime event is the primary push, and the owner's dashboard badge can be derived from the
notification list.

### PATCH — Success (200)
```json
{ "message": "تم تحديث الإشعارات." }
```

---

## 6) Customer endpoints already implemented (reference)

These exist purely as the contract the current customer UI calls — no changes needed unless you
spot a mismatch:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/special-requests` | list **my** requests (array under `data` or `requests`) |
| POST | `/api/special-requests` | create a request (fires the broadcast, §1) |
| GET | `/api/special-requests/{id}` | detail incl. `offers` array |
| POST | `/api/special-requests/{id}/offers/{offerId}/accept` | accept an offer → creates booking, closes request |
| POST | `/api/special-requests/{id}/offers/{offerId}/reject` | reject an offer |
| POST | `/api/special-requests/{id}/close` | **(new)** manually close an open request (owner stops receiving it) |

### `POST /api/special-requests` — create request (fires broadcast)

Request body the frontend sends:
```json
{
  "title": "قاعة محاضرات لدورة تدريبية",
  "description": "أبحث عن قاعة تتسع لـ 40 متدرباً...",
  "space_type": "whole",
  "capacity": 40,
  "schedule_preset": "weekly",
  "schedule_count": 8,
  "preferred_time": "10:00 ص – 1:00 م",
  "area": "وسط المدينة",
  "amenities": ["internet", "projector", "ac"],
  "budget": 180
}
```

Success (201):
```json
{
  "message": "تم نشر طلبك بنجاح.",
  "request": {
    "request_id": 41,
    "title": "...",
    "status": "open",
    "offers_count": 0,
    "created_at": "2026-09-18 10:30:00"
  }
}
```

### `POST /api/special-requests/{id}/close`
Success (200):
```json
{ "message": "تم إغلاق الطلب.", "request": { "request_id": 41, "status": "closed", "title": "..." } }
```
After closing, a request disappears from `GET /api/special-requests/open` (owners stop seeing
it) and no more offers can be added.

---

## Field mapping reference (frontend normalization)

| Backend key (Laravel) | Frontend field |
|---|---|
| `request_id` / `id` | `id` |
| `title` | `title` |
| `description` / `details` / `notes` | `notes` |
| `space_type` (`whole`/`room`) | `space_type`, `spaceTypeLabel` |
| `capacity` | `capacity` |
| `schedule`/`schedule_preset`+`schedule_count` | `schedule`, `schedule_label` |
| `preferred_time` | `preferred_time` |
| `area`/`location` | `area` |
| `amenities` | `amenities` (keys array) |
| `budget`/`max_budget` | `budget` |
| `status` (`open`/`accepted`/`closed`) | `status` (`accepted`/`closed` both displayed as منتهي) |
| `expires_at` | `expires_at` |
| `offers_count` | `offers_count` |
| `offer_id`/`id` | `offer.id` |
| `owner_name` | `offer.owner_name` |
| `space_name`/`title` | `offer.space_name` |
| `price_per_hour`/`price` | `offer.price_per_hour` |
| `duration_hours`/`hours` | `offer.duration_hours` |
| `status` (`pending`/`accepted`/`rejected`) | `offer.status` |

---

## Verification checklist (after deploy)

```
# owner (need an owner token)
GET  https://back-end-kwba.onrender.com/api/special-requests/open   -> 200 JSON list (never HTML)
POST https://back-end-kwba.onrender.com/api/special-requests/41/offers  -> 201 JSON offer
POST https://back-end-kwba.onrender.com/api/special-requests/41/offers  (same owner again) -> 422

# customer
GET  https://back-end-kwba.onrender.com/api/special-requests        -> 200 list
POST https://back-end-kwba.onrender.com/api/special-requests        -> 201 AND owners receive SpecialRequestCreated
GET  https://back-end-kwba.onrender.com/api/notifications           -> 200 list

# any
GET  https://back-end-kwba.onrender.com/api/special-requests/open   (no token) -> 401 JSON
```

Every error must be **JSON** (`{ "message": "..." }`), never the Laravel HTML welcome page.