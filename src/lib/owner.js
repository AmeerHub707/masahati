// وحدة لوحة صاحب المساحة — السوق المفتوح، العروض المقدمة، إدارة المساحات.
// تتصل بالباك إند الحقيقي (Laravel) عبر عميل api.js؛ لا يوجد وضع تجريبي.

import { request, imageUrl } from './api';
import { getUser } from './authStore';
import { mapRequest, mapOffer, listOf, isRequestOpen } from './requests';

const REQ_TIMEOUT_MS = 8000;

// ----- كاش لوحة المالك (عرض فوري عند العودة) -----
export function readOwnerCache() {
  try {
    const raw = localStorage.getItem('masahati_owner_cache');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function writeOwnerCache(payload) {
  try {
    localStorage.setItem('masahati_owner_cache', JSON.stringify(payload));
  } catch {
    /* التخزين غير متاح */
  }
}

export function clearOwnerCache() {
  try {
    localStorage.removeItem('masahati_owner_cache');
  } catch {
    /* التخزين غير متاح */
  }
}

// ----- مطبّعات (normalizers) -----
function normalizeAmenities(b) {
  const raw = Array.isArray(b.amenities) ? b.amenities : [];
  return raw
    .map((a) => {
      if (typeof a === 'string') return a;
      return a.key ?? a.name ?? '';
    })
    .filter(Boolean);
}

// حالة المساحة الموحّدة: active | inactive | pending (بانتظار مراجعة الإدارة) | rejected.
function spaceStatus(s) {
  const known = ['active', 'inactive', 'pending', 'rejected'];
  if (typeof s.status === 'string' && known.includes(s.status)) return s.status;
  return typeof s.is_active === 'boolean' ? (s.is_active ? 'active' : 'inactive') : 'active';
}

// يعيد وثائق إثبات المساحة بشكل موحّد
function normalizeSpaceDocs(docs) {
  const items = Array.isArray(docs)
    ? docs
    : docs && typeof docs === 'object'
      ? Object.entries(docs).map(([id, d]) => ({ id, ...(d || {}) }))
      : [];
  return items
    .filter((d) => d && (d.name || d.file?.name))
    .map((d) => ({
      id: d.id ?? d.key ?? '',
      name: d.name || d.file?.name || 'مستند',
      size: Number(d.size ?? d.file?.size ?? 0),
      type: d.type || d.file?.type || 'application/octet-stream',
    }));
}

function coordOf(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100000) / 100000 : null;
}

function normTime(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!m) return '';
  let h = Number(m[1]);
  const min = m[2];
  if (!Number.isInteger(h) || h > 23 || Number(min) > 59) return '';
  const mer = m[3] ? m[3].toLowerCase() : '';
  if (mer === 'pm' && h < 12) h += 12;
  else if (mer === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function normPhone(v) {
  return String(v ?? '').trim();
}

export function mapSpace(s) {
  const img = imageUrl(s.image) || '';
  const gallery = Array.isArray(s.gallery)
    ? s.gallery.map((g) => imageUrl(g)).filter(Boolean)
    : (img ? [img] : []);
  const status = spaceStatus(s);
  return {
    id: s.space_id ?? s.id,
    title: s.title ?? '',
    description: s.description ?? '',
    location: s.location ?? '',
    lat: coordOf(s.lat ?? s.latitude ?? s.lat_f ?? s.latitude_f),
    lng: coordOf(s.lng ?? s.longitude ?? s.lng_f ?? s.longitude_f ?? s.lon ?? s.long),
    image: img,
    gallery,
    price_per_hour: Number(s.price_per_hour ?? s.price ?? 0),
    capacity: Number(s.capacity ?? 0),
    open_time: normTime(s.open_time ?? s.opening_time ?? s.opens_at ?? s.start_time),
    close_time: normTime(s.close_time ?? s.closing_time ?? s.closes_at ?? s.end_time),
    contact_phone: normPhone(s.contact_phone ?? s.contact_number ?? s.phone ?? s.mobile),
    amenities: normalizeAmenities(s),
    internet: s.internet ?? s.has_internet ?? s.wifi ?? null,
    power: s.power ?? s.has_power ?? s.electricity ?? null,
    status,
    is_active: status === 'active',
    docs: normalizeSpaceDocs(s.docs),
    rating: Math.round(Number(s.rating ?? 0) * 10) / 10,
    category: typeof s.category === 'string' ? s.category : '',
    area: String(s.area ?? s.neighborhood ?? s.district ?? ''),
    review_count: Number(s.review_count ?? s.reviews_count ?? s.ratings_count ?? 0),
    instant_booking: Boolean(s.instant_booking ?? s.instant ?? false),
    stats: s.stats
      ? {
          bookings: Number(s.stats.bookings ?? 0),
          revenue: Number(s.stats.revenue ?? 0),
          occupancy: Number(s.stats.occupancy ?? 0),
          totalBookings: Number(s.stats.totalBookings ?? 0),
        }
      : null,
  };
}

export function mapMyOffer(o) {
  return {
    id: o.offer_id ?? o.id,
    requestId: o.request_id ?? null,
    requestTitle: o.request_title ?? o.title ?? '',
    status: o.status || 'pending',
    price_per_hour: Number(o.price_per_hour ?? o.price ?? 0),
    currency: o.currency ?? 'ش.ج',
    duration_hours: Number(o.duration_hours ?? o.hours ?? 0),
    created_at: o.created_at ?? o.created ?? '',
  };
}

function hoursFromTimes(from, to) {
  const parse = (t) => {
    const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return null;
  const diff = (b - a) / 60;
  return diff > 0 ? diff : null;
}

export function mapOwnerBooking(b) {
  const timeFrom = b.time_from || b.start_time || '';
  const timeTo = b.time_to || b.end_time || '';
  const hours = Number(b.hours ?? b.duration_hours ?? 0) || hoursFromTimes(timeFrom, timeTo) || 0;
  return {
    id: b.booking_id ?? b.id,
    spaceId: b.space_id ?? b.spaceId ?? null,
    spaceName: b.space_name ?? b.title ?? '',
    image: imageUrl(b.image) || '',
    date: b.date || '',
    time: timeFrom && timeTo ? `${timeFrom} – ${timeTo}` : (timeFrom || timeTo || b.time || ''),
    timeFrom,
    timeTo,
    hours,
    price: Number(b.price || b.cost || 0),
    customer: b.customer ?? b.customer_name ?? '',
    status: b.status || 'pending',
  };
}

export function belongsToSpace(b, sp) {
  if (!sp) return true;
  if (b.spaceId != null && sp.id != null && String(b.spaceId) === String(sp.id)) return true;
  return Boolean(b.spaceName) && b.spaceName === sp.title;
}

// ----- API حقيقي -----
export async function fetchMarketRequests() {
  const res = await request('/api/special-requests/open', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'requests').map(mapRequest);
}

export async function submitOwnerProposal(requestId, payload) {
  const res = await request(`/api/special-requests/${requestId}/offers`, {
    method: 'POST',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: {
      space_id: payload.space_id,
      price_per_hour: payload.price_per_hour,
      duration_hours: payload.duration_hours,
      notes: payload.notes || '',
      currency: payload.currency || 'ش.ج',
    },
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return {
    message: body.message || 'تم إرسال عرضك، وسيصل صاحب الطلب للاختيار.',
    offer: body.offer ? mapOffer(body.offer) : null,
  };
}

export async function fetchOwnerOffers() {
  const res = await request('/api/owner/offers', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'offers').map(mapMyOffer);
}

export async function fetchOwnerSpaces() {
  const res = await request('/api/owner/spaces', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'spaces').map(mapSpace);
}

export async function createOwnerSpace(payload) {
  const res = await request('/api/owner/spaces', {
    method: 'POST',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: {
      title: payload.title,
      description: payload.description,
      location: payload.location,
      lat: coordOf(payload.lat),
      lng: coordOf(payload.lng),
      price_per_hour: payload.price_per_hour,
      capacity: payload.capacity,
      open_time: normTime(payload.open_time),
      close_time: normTime(payload.close_time),
      contact_phone: normPhone(payload.contact_phone),
      amenities: payload.amenities,
      internet: payload.internet,
      power: payload.power,
      image: payload.image,
      docs: Array.isArray(payload.docs)
        ? payload.docs.map((d) => ({ id: d.id, name: d.name, size: Number(d.size || 0), type: d.type || 'file' }))
        : [],
      status: 'pending',
    },
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return { message: body.message || 'تمت إضافة المساحة.', space: mapSpace(body.space ?? body) };
}

export async function toggleOwnerSpaceActive(spaceId, isActive) {
  const res = await request(`/api/owner/spaces/${spaceId}/active`, {
    method: 'PATCH',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: { is_active: isActive },
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return { message: body.message || 'تم تحديث حالة المساحة.', space: mapSpace(body.space ?? body) };
}

export async function updateOwnerSpace(spaceId, payload) {
  const res = await request(`/api/owner/spaces/${spaceId}`, {
    method: 'PUT',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: {
      title: payload.title,
      description: payload.description,
      location: payload.location,
      lat: coordOf(payload.lat),
      lng: coordOf(payload.lng),
      price_per_hour: payload.price_per_hour,
      capacity: payload.capacity,
      open_time: normTime(payload.open_time),
      close_time: normTime(payload.close_time),
      contact_phone: normPhone(payload.contact_phone),
      amenities: payload.amenities,
      internet: payload.internet,
      power: payload.power,
      image: payload.image,
      docs: Array.isArray(payload.docs)
        ? payload.docs.map((d) => ({ id: d.id, name: d.name, size: Number(d.size || 0), type: d.type || 'file' }))
        : undefined,
    },
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return { message: body.message || 'تم تحديث المساحة.', space: mapSpace(body.space ?? body) };
}

export async function deleteOwnerSpace(spaceId) {
  const res = await request(`/api/owner/spaces/${spaceId}`, {
    method: 'DELETE',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return { message: body.message || 'تم حذف المساحة.' };
}

export async function fetchOwnerBookings() {
  const res = await request('/api/owner/bookings', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'bookings').map(mapOwnerBooking);
}

export function mapOwnerReview(r) {
  return {
    id: r.review_id ?? r.id,
    spaceId: r.space_id ?? null,
    spaceName: r.space_name ?? '',
    spaceImage: imageUrl(r.space_image || r.image) || '',
    rating: Number(r.rating || 0),
    title: r.title ?? '',
    comment: r.comment ?? r.text ?? r.review ?? '',
    customer: r.customer_name ?? r.customer ?? '',
    customerAvatar: imageUrl(r.customer_avatar || r.avatar) || '',
    date: r.date || r.created_at || '',
    createdAt: r.created_at ?? '',
  };
}

export async function fetchOwnerReviews(spaceId) {
  const qs = spaceId ? `?space_id=${encodeURIComponent(spaceId)}` : '';
  const res = await request(`/api/owner/reviews${qs}`, {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'reviews').map(mapOwnerReview);
}

export async function updateOwnerBookingStatus(bookingId, status) {
  const res = await request(`/api/owner/bookings/${bookingId}/status`, {
    method: 'PATCH',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: { status },
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return {
    message: body.message || (status === 'confirmed' ? 'تم تأكيد الحجز.' : 'تم رفض طلب الحجز.'),
    booking: body.booking ? mapOwnerBooking(body.booking) : null,
  };
}

// ----- واجهات التطبيق (loaders: لا ترمي، تعيد {error,...})
export async function loadMarketWithFallback() {
  try {
    const requests = await fetchMarketRequests();
    return { error: null, requests };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل السوق المفتوح';
    return { error: message, requests: [] };
  }
}

export async function submitProposalWithFallback(requestId, payload) {
  const result = await submitOwnerProposal(requestId, payload);
  return { message: result.message, offer: result.offer, duplicate: false };
}

export async function loadOwnerOffersWithFallback() {
  try {
    const offers = await fetchOwnerOffers();
    return { error: null, offers };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل العروض';
    return { error: message, offers: [] };
  }
}

export async function loadSpacesWithFallback() {
  try {
    const spaces = await fetchOwnerSpaces();
    return { error: null, spaces };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل مساحات المالك';
    return { error: message, spaces: [] };
  }
}

export async function createSpaceWithFallback(payload) {
  const result = await createOwnerSpace(payload);
  return { message: result.message, space: result.space };
}

export async function toggleSpaceActiveWithFallback(spaceId, isActive) {
  const result = await toggleOwnerSpaceActive(spaceId, isActive);
  return { message: result.message, space: result.space };
}

export async function updateSpaceWithFallback(spaceId, payload) {
  const result = await updateOwnerSpace(spaceId, payload);
  return { message: result.message, space: result.space };
}

export async function deleteSpaceWithFallback(spaceId) {
  const result = await deleteOwnerSpace(spaceId);
  return { message: result.message, deleted: true };
}

export async function loadOwnerBookingsWithFallback() {
  try {
    const bookings = await fetchOwnerBookings();
    return { error: null, bookings };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل الحجوزات';
    return { error: message, bookings: [] };
  }
}

export async function setBookingStatusWithFallback(bookingId, status) {
  const result = await updateOwnerBookingStatus(bookingId, status);
  return { message: result.message };
}

export async function loadReviewsWithFallback(spaceId) {
  try {
    const reviews = await fetchOwnerReviews(spaceId);
    return { error: null, reviews };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل التقييمات';
    return { error: message, reviews: [] };
  }
}

// ----- وثائق المالك -----
const DOCS_KEY = 'masahati_owner_documents_v1';
const LEGACY_DOCS_KEY = 'masahati.owner-docs';
const LEGACY_SENT_KEY = 'masahati.owner-docs-sent';

export const DOC_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export function canAddSpace(doc) {
  return doc?.status === DOC_STATUS.APPROVED;
}

export function isDocsLocked(doc) {
  return doc?.status === DOC_STATUS.PENDING || doc?.status === DOC_STATUS.APPROVED;
}

function normalizeDocFiles(files) {
  const out = {};
  if (files && typeof files === 'object') {
    for (const id of ['assets', 'cert']) {
      const f = files[id];
      const src = f && (f.name || f.file?.name) ? f : null;
      if (src) {
        out[id] = {
          name: src.name || src.file.name,
          size: Number(src.size ?? src.file?.size ?? 0),
          type: src.type || src.file?.type || 'file',
        };
      }
    }
  }
  return out;
}

function normalizeDoc(raw) {
  const d = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
    ? raw.data
    : (raw && typeof raw === 'object' ? raw : {});
  return {
    status: Object.values(DOC_STATUS).includes(d.status) ? d.status : DOC_STATUS.NONE,
    files: normalizeDocFiles(d.files),
    note: d.note || d.review_note || d.admin_note || '',
    submittedAt: d.submitted_at || d.submittedAt || '',
    reviewedAt: d.reviewed_at || d.reviewedAt || '',
  };
}

function readLegacyDocs() {
  try {
    const rawFiles = localStorage.getItem(LEGACY_DOCS_KEY);
    const files = rawFiles ? JSON.parse(rawFiles) : {};
    const sent = localStorage.getItem(LEGACY_SENT_KEY) === '1';
    if (!rawFiles && !sent) return null;
    return normalizeDoc({
      status: sent ? DOC_STATUS.PENDING : DOC_STATUS.NONE,
      files,
    });
  } catch {
    return null;
  }
}

export function readOwnerDocuments() {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') return normalizeDoc(data);
    }
  } catch {
    /* التخزين غير متاح أو تالف */
  }
  return readLegacyDocs() || normalizeDoc(null);
}

export function writeOwnerDocuments(doc) {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(normalizeDoc(doc)));
    return true;
  } catch {
    return false;
  }
}

export function clearOwnerDocuments() {
  try {
    localStorage.removeItem(DOCS_KEY);
    localStorage.removeItem(LEGACY_DOCS_KEY);
    localStorage.removeItem(LEGACY_SENT_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

export async function fetchOwnerDocuments() {
  const res = await request('/api/owner/documents', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return normalizeDoc(res);
}

export async function submitOwnerDocuments(entries) {
  const fd = new FormData();
  for (const [id, entry] of Object.entries(entries || {})) {
    if (entry?.file) fd.append(id, entry.file);
  }
  const res = await request('/api/owner/documents', {
    method: 'POST',
    auth: true,
    isForm: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: fd,
  });
  return normalizeDoc(res);
}

export async function loadOwnerDocumentsWithFallback() {
  try {
    const doc = await fetchOwnerDocuments();
    writeOwnerDocuments(doc);
    return { error: null, doc };
  } catch (err) {
    const message = err?.message || 'تعذّر تحميل وثائق المالك';
    return { error: message, doc: readOwnerDocuments() };
  }
}

export async function submitOwnerDocumentsWithFallback(entries) {
  const local = readOwnerDocuments();
  if (isDocsLocked(local)) {
    return {
      locked: true,
      doc: local,
      message: local.status === DOC_STATUS.APPROVED
        ? 'وثائقك معتمدة بالفعل — يمكنك إضافة المساحات.'
        : 'وثائقك قيد المراجعة حالياً؛ لا يمكن تعديلها حتى قرار الإدارة.',
    };
  }
  const doc = await submitOwnerDocuments(entries);
  writeOwnerDocuments(doc);
  return { locked: false, doc, message: 'تم إرسال وثائقك للمراجعة.' };
}

// ----- تحميل لوحة المالك كاملة (بالتوازي) مع الكاش -----
let dashboardInFlight = null;

async function loadOwnerDashboardImpl() {
  const settled = await Promise.allSettled([
    fetchOwnerSpaces(),
    fetchOwnerOffers(),
    fetchMarketRequests(),
    fetchOwnerBookings(),
    request('/api/profile', { method: 'GET', auth: true, timeoutMs: REQ_TIMEOUT_MS }),
    fetchOwnerReviews(),
  ]);

  if (!settled.some((r) => r.status === 'fulfilled')) {
    return {
      error: 'تعذّر تحميل بيانات لوحة المالك',
      user: getUser() || { name: '' },
      stats: { spacesCount: 0, activeSpacesCount: 0, openMarket: 0, pendingOffers: 0, acceptedOffers: 0 },
      spaces: [],
      offers: [],
      market: [],
      bookings: [],
      reviews: [],
    };
  }

  const pick = (i, fallback) =>
    settled[i] && settled[i].status === 'fulfilled' ? settled[i].value : fallback;
  const spacesApi = pick(0, []);
  const offersApi = pick(1, []);
  const marketApi = pick(2, []);
  const bookingsApi = pick(3, []);
  const profileApi = pick(4, null);
  const reviewsApi = pick(5, []);

  const localUser = getUser() || {};
  const p = profileApi && typeof profileApi === 'object' ? profileApi : {};
  const name = p.name || localUser.name || '';
  const email = p.email || localUser.email || '';
  const phone = p.phone || localUser.phone || '';
  const photo = imageUrl(p.picture || p.photo || localUser.photo || localUser.picture) || '';

  const spaces = spacesApi;
  const offers = offersApi;
  const market = marketApi.filter((r) => isRequestOpen(r));

  const store = {
    spaces: spaces.map((s) => ({ ...s, id: s.id })),
    offers: offers.map((o) => ({ ...o, request_id: o.requestId, request_title: o.requestTitle, status: o.status })),
  };

  const openMarket = market.filter((r) => isRequestOpen(r)).length;
  const stats = {
    spacesCount: store.spaces.length,
    activeSpacesCount: store.spaces.filter((s) => s.is_active !== false).length,
    openMarket,
    pendingOffers: store.offers.filter((o) => o.status === 'pending').length,
    acceptedOffers: store.offers.filter((o) => o.status === 'accepted').length,
  };

  return {
    error: null,
    user: { name, email, phone, photo, role: 'owner' },
    stats,
    spaces,
    offers,
    market,
    bookings: bookingsApi,
    reviews: reviewsApi,
  };
}

export async function loadOwnerDashboardWithFallback(force = false) {
  if (!force && dashboardInFlight) return dashboardInFlight;
  dashboardInFlight = loadOwnerDashboardImpl().then((r) => {
    dashboardInFlight = null;
    return r;
  });
  return dashboardInFlight;
}
