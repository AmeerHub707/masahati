// وحدة طلبات خاصة (عرض تبنّي العكس — RFQ/مزاد عكسي).
// يتصل بالباك إند الحقيقي (Laravel) عبر نفس عميل api.js.
// القراءات لا ترمي أبداً (تعود {error,...}) والإجراءات ترمي الأخطاء الحقيقية.

import { request, imageUrl } from './api';

// مهلة الطلب: نحاكي الافتراضية في api.js. كانت 8 ثوانٍ فأسقطت كل الطلبات على
// مخدم Render أثناء الإقلاع البارد (30–60 ثانية).
const REQ_TIMEOUT_MS = 25000;

const SEEN_KEY = 'masahati_special_requests_seen_v1';

// يحوّل أي خطأ إلى نص عربي مفهوم. ApiError يحمل الرسالة التي أعادها الباك إند.
export function describeRequestError(err) {
  if (!err) return 'تعذّر الاتصال بالخادم.';
  const status = err.status;
  if (status === 0) {
    return err.message || 'تعذّر الوصول إلى الخادم. تحقّق من اتصالك بالإنترنت.';
  }
  if (status === 401 || status === 403) {
    return 'انتهت جلستك أو ليس لديك صلاحية لهذا الإجراء. سجّل الدخول مجدداً.';
  }
  if (status === 404) {
    return 'المسار غير موجود على الخادم.';
  }
  return err.message || 'تعذّر إتمام العملية على الخادم.';
}

// ----- قوائم ثابتة للعربية -----
export const SPACE_TYPES = {
  whole: 'المكان كاملاً',
  room: 'قاعة / غرفة واحدة',
};

export const AMENITY_LABELS = {
  internet: 'إنترنت',
  electricity: 'كهرباء',
  projector: 'بروجيكتور',
  ac: 'تكييف',
  microphone: 'مايكروفون',
  whiteboard: 'سبورة',
};

export const SCHEDULE_LABELS = {
  once: 'مرة واحدة',
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
  yearly: 'سنوي',
};

export const REQUEST_STATUS_META = {
  open: { label: 'مفتوحة للعروض', cls: 'badge--pending' },
  accepted: { label: 'تم القبول', cls: 'badge--confirmed' },
  closed: { label: 'تم الإغلاق', cls: 'badge--muted' },
};

// ------------- أدوات تطبيع -------------
function mergeReqStatus(b) {
  const raw = b.status ?? (b.is_accepted ? 'accepted' : 'open');
  if (raw === 'closed') return 'closed';
  return raw === 'accepted' ? 'accepted' : 'open';
}

function normalizeAmenities(b) {
  const raw = Array.isArray(b.amenities) ? b.amenities : [];
  return raw
    .map((a) => {
      if (typeof a === 'string') return a;
      return a.key ?? a.name ?? '';
    })
    .filter(Boolean);
}

// السمة الأساسية لتكرار الجدول: قد تأتي ككائن { preset, count } أو نص جاهز.
export function scheduleLabel(s) {
  if (!s) return '';
  if (typeof s === 'string') return s;
  const base = SCHEDULE_LABELS[s.preset] || s.preset || '';
  const count = Number(s.count);
  if (!base) return count && count > 0 ? `× ${count}` : '';
  if (s.preset === 'once') return 'مرة واحدة';
  if (count && count > 1) return `${base} × ${count}`;
  return base;
}

export function scheduleLabelOf(req) {
  if (req?.schedule_label) return req.schedule_label;
  if (req?.schedule) return scheduleLabel(req.schedule);
  if (req?.schedule_preset || req?.schedule_count) {
    return scheduleLabel({
      preset: req.schedule_preset || 'once',
      count: Number(req.schedule_count) || 1,
    });
  }
  return '';
}

export function mapRequest(r) {
  const id = r.request_id ?? r.id;
  return {
    id,
    title: r.title ?? 'طلب خاص',
    notes: r.notes ?? r.description ?? r.details ?? '',
    space_type: r.space_type ?? 'whole',
    spaceTypeLabel: SPACE_TYPES[r.space_type] || SPACE_TYPES.whole,
    capacity: Number(r.capacity || 0),
    schedule: r.schedule ?? null,
    schedule_label: scheduleLabelOf(r) || scheduleLabel(r.schedule),
    preferred_time: r.preferred_time ?? '',
    area: r.area ?? r.location ?? '',
    amenities: normalizeAmenities(r),
    budget: Number(r.budget || r.max_budget || 0),
    status: mergeReqStatus(r),
    offers_count: Number(r.offers_count ?? 0),
    created_at: r.created_at ?? r.created ?? '',
    expires_at: r.expires_at ?? r.expires ?? '',
    is_accepted: mergeReqStatus(r) === 'accepted',
    is_closed: mergeReqStatus(r) === 'closed',
  };
}

// هل تجاوز الطلب تاريخ انتهاء صلاحيته؟ يقرأ تجاهل الصيغ الشائعة (soft / حرفياً).
export function isRequestExpired(r) {
  const raw = r?.expires_at || r?.expired_at || '';
  if (!raw) return false;
  const t = new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(t.getTime())) return false;
  return t.getTime() < Date.now();
}

export function isRequestOpen(r) {
  return (r?.status === 'open' || r?.status === 'pending') && !isRequestExpired(r);
}

export function mapOffer(o) {
  return {
    id: o.offer_id ?? o.id,
    owner_name: o.owner_name ?? 'صاحب المساحة',
    owner_avatar: imageUrl(o.owner_avatar || o.avatar) || '',
    space_name: o.space_name ?? o.title ?? 'مساحة',
    space_image: imageUrl(o.space_image || o.image) || '',
    price_per_hour: Number(o.price_per_hour ?? o.price ?? 0),
    currency: o.currency ?? 'ش.ج',
    duration_hours: Number(o.duration_hours ?? o.hours ?? 0),
    location: o.location ?? '',
    notes: o.notes ?? o.message ?? '',
    rating: Number(o.rating ?? 0),
    status: o.status || (o.is_accepted ? 'accepted' : 'pending'),
    created_at: o.created_at ?? o.created ?? '',
  };
}

// يستخرج مصفوفة من أي صيغة لارافيل شائعة.
export function listOf(res, key) {
  if (Array.isArray(res)) return res;
  if (!res || typeof res !== 'object') return [];
  if (res[key] && Array.isArray(res[key])) return res[key];
  if (res.data && Array.isArray(res.data)) return res.data;
  if (res.data?.[key] && Array.isArray(res.data[key])) return res.data[key];
  return [];
}

export function unwrap(res) {
  if (res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data;
  return res || {};
}

// ------------- تتبّع الزيارات (شارة العروض الجديدة) -------------
// نحفظ اللحظة الزمنية التي فتح فيها المستخدم تفاصيل كل طلب، لنعرف
// عدد العروض الجديدة التي أُضيفت بعد آخر زيارة ونعرضها كشارة على البطاقة.
function readSeenMap() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw);
    return map && typeof map === 'object' ? map : {};
  } catch {
    return {};
  }
}

function writeSeenMap(map) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    /* التخزين غير متاح */
  }
}

// عدد العروض الجديدة على طلب (offers) منذ آخر زيارة.
// offer.created_at اختياري — نعتمد على عدد العروض المحفوظ مقابل آخر زيارة بحالة عدم توفر الوقت.
export function newOffersCountFor(reqOrDetail, offers) {
  const id = String(reqOrDetail?.id ?? '');
  if (!id) return 0;
  const map = readSeenMap();
  const last = map[id];
  if (!last) {
    // أول زيارة: كل العروض الحالية تُعدّ قديمة (لا شارة مثبّتة).
    return 0;
  }
  if (last.countAt) {
    const base = Number(last.countAt || 0);
    return Math.max(0, Number(offers?.length ?? reqOrDetail?.offers_count ?? 0) - base);
  }
  if (last.at) {
    const t = new Date(String(last.at).replace(' ', 'T')).getTime();
    if (Number.isNaN(t)) return 0;
    return (offers || []).filter((o) => new Date(String(o.created_at).replace(' ', 'T')).getTime() > t).length;
  }
  return 0;
}

// يسجّل زيارة الطلب ويرجع عدد العروض الجديدة (قبل التصفير).
export function markRequestSeen(id, offersCount = 0) {
  const key = String(id ?? '');
  if (!key) return;
  const map = readSeenMap();
  const prev = newOffersCountFor({ id: key, offers_count: offersCount }, []);
  map[key] = { at: new Date().toISOString(), countAt: Number(offersCount || 0) };
  writeSeenMap(map);
  return prev;
}

// ------------- نقط التطبيع للمصدر الحقيقي -------------
// إنشاء عروض مفترضة داخل كائن الطلب في المصدر الحقيقي (إن وجدت).
function mapRequestWithOffers(r, rawOffers) {
  const base = mapRequest(r);
  const offers = (Array.isArray(rawOffers) ? rawOffers : []).map(mapOffer);
  return { ...base, offers, offers_count: offers.length || base.offers_count };
}

// ------------- API حقيقي -------------
export async function fetchMyRequests() {
  const res = await request('/api/special-requests', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'requests').map((r) => mapRequest(r));
}

export async function createSpecialRequest(payload) {
  const res = await request('/api/special-requests', {
    method: 'POST',
    auth: true,
    body: {
      title: payload.title,
      description: payload.notes,
      space_type: payload.space_type,
      capacity: payload.capacity,
      schedule_preset: payload.schedule.preset,
      schedule_count: payload.schedule.count,
      preferred_time: payload.preferred_time,
      area: payload.area,
      amenities: payload.amenities,
      budget: payload.budget,
    },
    timeoutMs: REQ_TIMEOUT_MS,
  });
  const body = unwrap(res);
  return { request: mapRequest(body.request ?? body) };
}

export async function fetchRequestDetail(id) {
  const res = await request(`/api/special-requests/${id}`, {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  const body = unwrap(res);
  const raw = body.request ?? body;
  const offers = listOf(body.offers ? body : raw, 'offers');
  return mapRequestWithOffers(raw, offers);
}

export async function acceptRequestOffer(requestId, offerId) {
  const res = await request(`/api/special-requests/${requestId}/offers/${offerId}/accept`, {
    method: 'POST',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  const body = unwrap(res);
  // الحجز قد يأتي مباشرة أو تحت booking/order.
  const bookingRaw = body.booking ?? body.order ?? body.reservation;
  return {
    message: body.message || 'تم قبول العرض ونقل الحجز إلى حجوزاتك.',
    booking: bookingRaw
      ? {
          id: bookingRaw.booking_id ?? bookingRaw.id,
          spaceName: bookingRaw.space_name ?? body.space_name ?? '',
          image: imageUrl(bookingRaw.image) || '',
          date: bookingRaw.date ?? body.date ?? '',
          time: bookingRaw.time ?? body.time ?? '',
          hours: Number(bookingRaw.hours || 0),
          price: Number(bookingRaw.price ?? body.price ?? 0),
          status: bookingRaw.status || 'pending',
        }
      : null,
    request: mapRequest(body.request ?? body),
  };
}

// ------------- واجهة التطبيق -------------
// القراءات لا ترمي أبداً: عند الفشل تعود {error, <قائمة فارغة>}. الإجراءات
// ترمي الخطأ الحقيقي حتى لا يفقد المستخدم طلبه بصمت.
export async function loadRequestsWithFallback() {
  try {
    const requests = await fetchMyRequests();
    return { error: null, requests };
  } catch (err) {
    return { error: describeRequestError(err), requests: [] };
  }
}

export async function loadRequestDetailWithFallback(id) {
  try {
    const detail = await fetchRequestDetail(id);
    return { error: null, ...detail };
  } catch (err) {
    return { error: describeRequestError(err) };
  }
}

export async function createRequestWithFallback(payload) {
  try {
    const { request: created } = await createSpecialRequest(payload);
    return { error: null, request: created };
  } catch (err) {
    throw err instanceof Error ? err : new Error(describeRequestError(err));
  }
}

export async function acceptOfferWithFallback(requestId, offerId) {
  try {
    const result = await acceptRequestOffer(requestId, offerId);
    return { error: null, ...result };
  } catch (err) {
    throw err instanceof Error ? err : new Error(describeRequestError(err));
  }
}

export async function rejectRequestOffer(requestId, offerId) {
  const res = await request(`/api/special-requests/${requestId}/offers/${offerId}/reject`, {
    method: 'POST',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  const body = unwrap(res);
  return {
    message: body.message || 'تم رفض العرض.',
    request: mapRequest(body.request ?? body),
  };
}

// إغلاق طلب مفتوح يدوياً: يتوقف عن الظهور لمالكي المساحات وتتوقف العروض.
export async function closeSpecialRequest(requestId) {
  const res = await request(`/api/special-requests/${requestId}/close`, {
    method: 'POST',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  const body = unwrap(res);
  return {
    message: body.message || 'تم إغلاق الطلب.',
    request: mapRequest(body.request ?? body),
  };
}

// الإغلاق: يرسل للخادم دائماً — الإغلاق محلياً كان يترك الطلب مفتوحاً فعلياً.
export async function closeRequestWithFallback(requestId) {
  try {
    const result = await closeSpecialRequest(requestId);
    return { error: null, ...result };
  } catch (err) {
    throw err instanceof Error ? err : new Error(describeRequestError(err));
  }
}

// الرفض: يرسل للخادم دائماً — رفض محلي يترك العرض مفتوحاً لدى المالك.
export async function rejectOfferWithFallback(requestId, offerId) {
  try {
    const result = await rejectRequestOffer(requestId, offerId);
    return { error: null, ...result };
  } catch (err) {
    throw err instanceof Error ? err : new Error(describeRequestError(err));
  }
}
