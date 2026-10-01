// وحدة طلبات خاصة (عرض تبنّي العكس — RFQ/مزاد عكسي).
// يتصل بالباك إند الحقيقي (Laravel) عبر نفس عميل api.js،
// ومع أي فشل (مسار غير مطبق أو انقطاع) ينتقل تلقائياً لوضع تجريبي
// يخزّن البيانات محلياً حتى لا تكسر التجربة.

import { request, imageUrl } from './api';

// مهلة الطلب: نحاكي الافتراضية في api.js. كانت 8 ثوانٍ فأسقطت كل الطلبات على
// مخدم Render أثناء الإقلاع البارد (30–60 ثانية)، وهو ما كان يفعّل الوضع
// التجريبي ويحفظ الطلبات محلياً بدل إرسالها للخادم.
const REQ_TIMEOUT_MS = 25000;

const DEMO_FLAG_KEY = 'masahati_special_requests_demo_v1';
const DEMO_DATA_KEY = 'masahati_special_requests_data_v1';
const SEEN_KEY = 'masahati_special_requests_seen_v1';

// سبب آخر فشل من الخادم، لعرضه للمستخدم بدل إخفاءه خلف «وضع تجريبي» غامض.
let lastServerError = '';

function setLastServerError(message) {
  lastServerError = message || '';
}

export function getLastSpecialRequestsError() {
  return lastServerError;
}

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

// ----- وضع تجريبي -----
export function isSpecialRequestsDemo() {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function setDemoFlag(on) {
  try {
    if (on) localStorage.setItem(DEMO_FLAG_KEY, '1');
    else localStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

function readDemoStore() {
  try {
    const raw = localStorage.getItem(DEMO_DATA_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && Array.isArray(data.requests) ? data : null;
  } catch {
    return null;
  }
}

function writeDemoStore(payload) {
  try {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(payload));
  } catch {
    /* التخزين غير متاح */
  }
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

// ------------- بذرة الوضع التجريبي -------------
function seedDemoRequests() {
  const now = new Date();
  const daysAgo = (n) =>
    new Date(now.getTime() - n * 86400000).toISOString().slice(0, 16).replace('T', ' ');

  return [
    {
      id: 'demo-1',
      title: 'قاعة محاضرات لدورة تدريبية أسبوعية',
      notes:
        'أبحث عن قاعة تتسع لـ 40 متدرباً لمدة 3 ساعات كل يوم سبت، مع بروجيكتور وإنترنت قوي لتدريب عملي على الحاسوب.',
      space_type: 'whole',
      capacity: 40,
      schedule: { preset: 'weekly', count: 8 },
      schedule_label: 'أسبوعي × 8',
      preferred_time: '10:00 ص – 1:00 م',
      area: 'وسط المدينة',
      amenities: ['internet', 'electricity', 'projector', 'ac'],
      budget: 180,
      status: 'open',
      offers_count: 3,
      created_at: daysAgo(2),
      offers: [
        {
          id: 'demo-o1',
          owner_name: 'مركز النور للتدريب',
          space_name: 'قاعة العروض الكبرى',
          space_image: '',
          price_per_hour: 150,
          duration_hours: 3,
          location: 'وسط المدينة',
          notes: 'القاعة مجهزة بشاشة عرض 120 بوصة ومقاعد قابلة لإعادة الترتيب، ونت 100 ميجا.',
          rating: 4.8,
          status: 'pending',
          created_at: daysAgo(1),
        },
        {
          id: 'demo-o2',
          owner_name: 'بهو الأعمال',
          space_name: 'قاعة الريادة',
          space_image: '',
          price_per_hour: 175,
          duration_hours: 3,
          location: 'شارع الجامعة',
          notes: 'ضمّنّا التكييف والماء والقهوة ضمن السعر، مع مساعد تقني خلال المحاضرة.',
          rating: 4.5,
          status: 'pending',
          created_at: daysAgo(1),
        },
        {
          id: 'demo-o3',
          owner_name: 'منصة مساحات',
          space_name: 'استوديو المبدعين',
          space_image: '',
          price_per_hour: 200,
          duration_hours: 3,
          location: 'حي السعادة',
          notes: 'قاعة حديثة التسليم بعد الترميم، تضم 50 كرسياً مريحاً وإنترنت ألياف.',
          rating: 4.9,
          status: 'pending',
          created_at: daysAgo(1),
        },
      ],
    },
    {
      id: 'demo-2',
      title: 'لعقد اجتماع إدارة شهري متكرر',
      notes:
        'نحتاج غرفة اجتماعات لـ 10 أشخاص لمدة ساعتين في منتصف كل شهر، مع عرض تقديمي وإمكانية حضور عبر الإنترنت.',
      space_type: 'room',
      capacity: 10,
      schedule: { preset: 'monthly', count: 12 },
      schedule_label: 'شهري × 12',
      preferred_time: '4:00 م – 6:00 م',
      area: 'المنطقة الشرقية',
      amenities: ['internet', 'projector', 'microphone'],
      budget: 120,
      status: 'open',
      offers_count: 1,
      created_at: daysAgo(4),
      offers: [
        {
          id: 'demo-o4',
          owner_name: 'أبراج الشرق للمكاتب',
          space_name: 'غرفة الاجتماعات الذكية',
          space_image: '',
          price_per_hour: 100,
          duration_hours: 2,
          location: 'المنطقة الشرقية',
          notes: 'شاشة 75 بوصة + كاميرا Zoom + مايك معلق، منفعة لشهر كامل متوفرة.',
          rating: 4.6,
          status: 'pending',
          created_at: daysAgo(2),
        },
      ],
    },
    {
      id: 'demo-3',
      title: 'قاعة إلقاء محاضرات جامعية',
      notes:
        'محاضرة واحدة 90 دقيقة لـ 120 طالباً بمناسبة الأسبوع الثقافي، مع تكييف وسماعات.',
      space_type: 'whole',
      capacity: 120,
      schedule: { preset: 'once', count: 1 },
      schedule_label: 'مرة واحدة',
      preferred_time: '11:00 ص – 12:30 م',
      area: '',
      amenities: ['internet', 'ac', 'microphone'],
      budget: 400,
      status: 'accepted',
      offers_count: 2,
      created_at: daysAgo(6),
      offers: [
        {
          id: 'demo-o5',
          owner_name: 'قاعة الشموخ',
          space_name: 'المدرج الرئيسي',
          space_image: '',
          price_per_hour: 380,
          duration_hours: 2,
          location: 'وسط المدينة',
          notes: 'مدرج يصل لـ 160 مقعداً مع نظام صوت احترافي.',
          rating: 4.7,
          status: 'accepted',
          created_at: daysAgo(3),
        },
        {
          id: 'demo-o6',
          owner_name: 'مبنى الإبداع',
          space_name: 'قاعة الجمهور',
          space_image: '',
          price_per_hour: 350,
          duration_hours: 2,
          location: 'حي الأمل',
          notes: 'مقاعد مدرّجة جيدة وتكييف مركزي.',
          rating: 4.3,
          status: 'pending',
          created_at: daysAgo(3),
        },
      ],
    },
  ];
}

function demoStore() {
  const existing = readDemoStore();
  if (existing) return existing;
  const payload = { requests: seedDemoRequests() };
  writeDemoStore(payload);
  return payload;
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

// ------------- واجهة التطبيق (API → تجريبي) -------------
// تُحمّل قائمة الطلبات: تجربة الحقيقي أولاً، وعند أي فشل نتحول للتجريبي
// ونخزن العلامة حتى لا تتكرر المحاولة في كل إجراء ضمن الجلسة.
// المعامل force يتجاوز علامة التجريبي للحظات ليعيد محاولة الخادم
// (مفيد بعد نزول واجهة الباك إند أو عند زر "تحديث").
// القراءة: نجرب الخادم دائماً، وعند الفشل نعرض البيانات التجريبية فقط كحل
// أخير للعرض — مع تسجيل السبب. العلامة لم تعد تُقفل الجلسة كلها.
export async function loadRequestsWithFallback() {
  try {
    const requests = await fetchMyRequests();
    setDemoFlag(false);
    setLastServerError('');
    return { demo: false, requests };
  } catch (err) {
    setLastServerError(describeRequestError(err));
    if (!isSpecialRequestsDemo()) setDemoFlag(true);
    return { demo: true, requests: demoStore().requests.map(mapRequest) };
  }
}

export async function loadRequestDetailWithFallback(id) {
  try {
    const detail = await fetchRequestDetail(id);
    setDemoFlag(false);
    setLastServerError('');
    return { demo: false, ...detail };
  } catch (err) {
    setLastServerError(describeRequestError(err));
    if (!isSpecialRequestsDemo()) setDemoFlag(true);
    const all = demoStore().requests;
    const hit = all.find((r) => String(r.id) === String(id)) || all[0];
    const mapped = mapRequestWithOffers(hit, hit.offers);
    return { demo: true, ...mapped };
  }
}

// الإنشاء: يرسل للخادم دائماً ولا يحفظ محلياً أبداً. الحفظ المحلي كان يجعل
// الطلب يبدو ناجحاً ثم يختفي لأن قاعدة البيانات لا تحتويه.
export async function createRequestWithFallback(payload) {
  try {
    const { request: created } = await createSpecialRequest(payload);
    setDemoFlag(false);
    setLastServerError('');
    return { demo: false, request: created };
  } catch (err) {
    setLastServerError(describeRequestError(err));
    setDemoFlag(true);
    // نُعيد خطأً حقيقياً بدل "نجاح" وهمي، حتى لا يفقد المستخدم طلبه بصمت.
    throw err instanceof Error ? err : new Error(describeRequestError(err));
  }
}

// القبول: يرسل للخادم دائماً. لا قبول محلي — قبول وهمي ينشئ حجزاً غير موجود.
export async function acceptOfferWithFallback(requestId, offerId) {
  try {
    const result = await acceptRequestOffer(requestId, offerId);
    setDemoFlag(false);
    setLastServerError('');
    return { demo: false, ...result };
  } catch (err) {
    setLastServerError(describeRequestError(err));
    setDemoFlag(true);
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
    setDemoFlag(false);
    setLastServerError('');
    return { demo: false, ...result };
  } catch (err) {
    setLastServerError(describeRequestError(err));
    setDemoFlag(true);
    throw err instanceof Error ? err : new Error(describeRequestError(err));
  }
}

// الرفض: يرسل للخادم دائماً — رفض محلي يترك العرض مفتوحاً لدى المالك.
export async function rejectOfferWithFallback(requestId, offerId) {
  try {
    const result = await rejectRequestOffer(requestId, offerId);
    setDemoFlag(false);
    setLastServerError('');
    return { demo: false, ...result };
  } catch (err) {
    setLastServerError(describeRequestError(err));
    setDemoFlag(true);
    throw err instanceof Error ? err : new Error(describeRequestError(err));
  }
}
