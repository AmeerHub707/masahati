# Masahati — Owner Ads Broadcast Backend Contract

The owner "إعلاناتي" (ADs) feature is **DONE on the frontend** (production + local demo fallback).
Owners can create, edit, publish, and delete ADs. When published, an AD is **broadcast to all
customers** (not owners) as an in-app notification/banner.

This document is the contract the backend developer must implement.

---

## Auth model

| Role key (backend) | Frontend role | Notes |
|---|---|---|
| `space_owner` / `owner` | `space_owner` / `owner` | Creates/edits/publishes/deletes ADs; only owners see ADs tab |
| `customer` | `customer` | Receives broadcast ADs as in-app banners |

All endpoints below require `Authorization: Bearer *** (Sanctum opaque token)`.
Every error response must be **JSON** (`{ "message": "..." }`), never an HTML page.

---

## 1) Broadcast: "new AD published" → all customers

### Realtime (recommended: Pusher / Reverb / WebSockets)

When `POST /api/owner/ads/{id}/publish` succeeds, broadcast a `AdPublished`
event on a **public** channel:

```
Channel:  ads
Event:    AdPublished
```

Payload (must match what a customer would GET from their AD feed):

```json
{
  "ad": {
    "ad_id": 12,
    "title": "عرض خاص للمنصة",
    "description": "خصم 20% على جميع المساحات لفترة محدودة.",
    "link": "https://masahati.example.com/promo",
    "image": "/storage/ads/12.jpeg",
    "owner_name": "مركز النور للتدريب",
    "owner_avatar": "/storage/avatars/5.jpg",
    "published_at": "2026-09-20 14:30:00",
    "expires_at": "2026-10-04 14:30:00"
  }
}
```

A **public** channel means any authenticated customer can subscribe.
The feed is intentionally shared by all customers (there is no per-customer
targeting for the basic broadcast).

### Alternative transport (if push is not available yet)

The customer dashboard polls `GET /api/ads/open` every 30–60 seconds.
**This works with nothing extra on your side.** Just implement the feed endpoint.

---

## 2) Owner AD list

```
GET /api/owner/ads     (auth: space_owner)
```

Returns all ADs owned by the current owner.

### Success (200)

```json
{
  "data": [
    {
      "ad_id": 12,
      "title": "عرض خاص للمنصة",
      "description": "خصم 20% على جميع المساحات...",
      "link": "https://masahati.example.com/promo",
      "image": "/storage/ads/12.jpeg",
      "target": "customers",
      "status": "published",
      "created_at": "2026-09-18 10:00:00",
      "published_at": "2026-09-18 11:00:00",
      "expires_at": "2026-10-04 11:00:00",
      "impressions": 142
    }
  ]
}
```

- `target`: `customers` (broadcast to all customers) or `space_customers` (only customers who booked the owner's spaces).
- `status`: `draft` | `published` | `archived`
- `impressions`: count of how many times the AD was shown to customers (optional, for analytics)
- Field mapping on the frontend: `ad_id`/`id`, `description`/`notes`, `published_at`/`published_at`

---

## 3) Create an AD

```
POST /api/owner/ads     (auth: space_owner)
```

### Request body

```json
{
  "title": "عرض خاص للمنصة",
  "description": "خصم 20% على جميع المساحات لفترة محدودة.",
  "link": "https://masahati.example.com/promo",
  "image": "",
  "target": "customers",
  "schedule": { "preset": "once", "start": "2026-09-20", "end": "2026-10-04" }
}
```

- `schedule` is optional; when omitted the AD runs indefinitely until archived.
- `image`: base64 data URL or empty string (the frontend compresses to <5MB).
  The backend should decode base64 and store as a file, returning the path.

### Success (201)

```json
{
  "message": "تم إنشاء الإعلان.",
  "ad": {
    "ad_id": 12,
    "title": "عرض خاص للمنصة",
    "status": "draft",
    "created_at": "2026-09-18 10:00:00"
  }
}
```

### Errors

| Status | Body | When |
|---|---|---|
| 401 | `{ "message": "غير مصرح." }` | missing/revoked token |
| 403 | `{ "message": "هذه الصفحة متاحة لأصحاب المساحات فقط." }` | non-owner |
| 422 | `{ "message": "…" }` | missing/invalid fields (`title` is required, max 100 chars) |

---

## 4) Update an AD

```
PUT /api/owner/ads/{adId}     (auth: space_owner)
```

### Request body (same shape as create, plus optional status change)

```json
{
  "title": "عرض خاص مُحدّث",
  "description": "خصم 25%...",
  "link": "https://masahati.example.com/promo-v2",
  "image": "",
  "target": "customers",
  "status": "draft",
  "schedule": { "preset": "weekly", "count": 2 }
}
```

### Success (200)

```json
{
  "message": "تم تحديث الإعلان.",
  "ad": {
    "ad_id": 12,
    "title": "عرض خاص مُحدّث",
    "status": "draft",
    "updated_at": "2026-09-19 09:00:00"
  }
}
```

### Errors

| Status | Body | When |
|---|---|---|
| 401 | `{ "message": "غير مصرح." }` | missing/revoked token |
| 403 | `{ "message": "هذه الصفحة متاحة لأصحاب المساحات فقط." }` | non-owner |
| 404 | `{ "message": "الإعلان غير موجود." }` | bad `adId` or not owned by this owner |

---

## 5) Publish an AD (broadcast to customers)

```
POST /api/owner/ads/{adId}/publish     (auth: space_owner)
```

No body needed. Sets `status` = `published`, sets `published_at` = now,
fires the `AdPublished` broadcast event (§1), and the AD appears in
`GET /api/ads/open` for all customers.

### Success (200)

```json
{
  "message": "تم نشر الإعلان وبثه إلى جميع العملاء.",
  "ad": {
    "ad_id": 12,
    "title": "عرض خاص للمنصة",
    "status": "published",
    "published_at": "2026-09-20 14:30:00"
  }
}
```

### Errors

| Status | Body | When |
|---|---|---|
| 404 | `{ "message": "الإعلان غير موجود." }` | bad `adId` or not owned by this owner |
| 422 | `{ "message": "الإعلان غير مكتمل. أضف العنوان والوصف أولاً." }` | title/description empty |

---

## 6) Delete an AD

```
DELETE /api/owner/ads/{adId}     (auth: space_owner)
```

### Success (200)

```json
{ "message": "تم حذف الإعلان." }
```

The AD disappears from the owner's list, and from `GET /api/ads/open` for customers
(if it was previously published).

### Errors

| Status | Body | When |
|---|---|---|
| 401 | `{ "message": "غير مصرح." }` | missing/revoked token |
| 403 | `{ "message": "هذه الصفحة متاحة لأصحاب المساحات فقط." }` | non-owner |
| 404 | `{ "message": "الإعلان غير موجود." }` | bad `adId` or not owned by this owner |

---

## 7) Customer AD feed (what customers see)

```
GET /api/ads/open     (auth: customer OR space_owner)
```

Returns all currently-active published ADs (status = `published` and not expired),
newest first.

### Success (200)

```json
{
  "data": [
    {
      "ad_id": 12,
      "title": "عرض خاص للمنصة",
      "description": "خصم 20% على جميع المساحات لفترة محدودة.",
      "link": "https://masahati.example.com/promo",
      "image": "/storage/ads/12.jpeg",
      "owner_name": "مركز النور للتدريب",
      "owner_avatar": "/storage/avatars/5.jpg",
      "published_at": "2026-09-20 14:30:00",
      "expires_at": "2026-10-04 14:30:00"
    }
  ]
}
```

- `expires_at`: **optional**. When present and in the past, the frontend hides the AD.
- The frontend accepts `{ data: [...] }`, `{ ads: [...] }`, or a bare array.
- `target = space_customers` ads require the backend to filter by whether the customer
  has any bookings with the owning space_owner.

### Errors

| Status | Body | When |
|---|---|---|
| 401 | `{ "message": "غير مصرح." }` | no/invalid token |

---

## Field mapping reference (frontend normalization in `src/lib/ads.js`)

| Backend key (Laravel) | Frontend field |
|---|---|
| `ad_id` / `id` | `ad.id` |
| `title` | `ad.title` |
| `description` / `notes` | `ad.description` |
| `link` / `url` | `ad.link` |
| `image` | `ad.image` (prefixed via `imageUrl`) |
| `target` | `ad.target` |
| `status` (`draft`/`published`/`archived`) | `ad.status` |
| `created_at` / `created` | `ad.created_at` |
| `published_at` / `published` | `ad.sent_at` |
| `expires_at` / `expires` | `ad.expires_at` |
| `impressions` / `impressions_count` | `ad.impressions` |

---

## Verification checklist (after deploy)

```bash
# owner (need an owner token)
GET    https://back-end-kwba.onrender.com/api/owner/ads             -> 200 JSON list of ads
POST   https://back-end-kwba.onrender.com/api/owner/ads             -> 201 JSON created ad
PUT    https://back-end-kwba.onrender.com/api/owner/ads/12          -> 200 JSON updated ad
POST   https://back-end-kwba.onrender.com/api/owner/ads/12/publish  -> 200 JSON (status flipped to published)
DELETE https://back-end-kwba.onrender.com/api/owner/ads/12          -> 200 JSON

# customer
GET    https://back-end-kwba.onrender.com/api/ads/open               -> 200 JSON list of published ads

# any
GET    https://back-end-kwba.onrender.com/api/owner/ads (no token)    -> 401 JSON
```

Every error must be **JSON** (`{ "message": "..." }`), never the Laravel HTML welcome page.
