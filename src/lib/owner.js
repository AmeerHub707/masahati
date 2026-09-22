// وحدة لوحة صاحب المساحة — السوق المفتوح، العروض المقدمة، إدارة المساحات.
// تتصل بالباك إند الحقيقي (Laravel) عبر عميل api.js، ومع أي فشل تنتقل
// لوضع تجريبي محلي (نفس نمط الطلبات الخاصة) حتى لا تكسر التجربة.

import { request, imageUrl } from './api';
import { getUser } from './authStore';
import { mapRequest, mapOffer, listOf, isRequestOpen } from './requests';

const REQ_TIMEOUT_MS = 8000;

const DEMO_FLAG_KEY = 'masahati_owner_demo_v1';
const DEMO_DATA_KEY = 'masahati_owner_data_v1';
const CUSTOMER_REQ_DATA_KEY = 'masahati_special_requests_data_v1';
const CACHE_KEY = 'masahati_owner_cache';

// ----- وضع تجريبي -----
export function isOwnerDemo() {
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
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function writeDemoStore(payload) {
  try {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(payload));
    return true;
  } catch {
    /* التخزين غير متاح أو ممتلئ (صور كبيرة) */
    return false;
  }
}

// ----- كاش لوحة المالك (عرض فوري عند العودة) -----
export function readOwnerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function writeOwnerCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* التخزين غير متاح */
  }
}

export function clearOwnerCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
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

export function mapSpace(s) {
  const img = imageUrl(s.image) || '';
  const gallery = Array.isArray(s.gallery)
    ? s.gallery.map((g) => imageUrl(g)).filter(Boolean)
    : (img ? [img] : []);
  return {
    id: s.space_id ?? s.id,
    title: s.title ?? '',
    description: s.description ?? '',
    location: s.location ?? '',
    image: img,
    gallery,
    price_per_hour: Number(s.price_per_hour ?? s.price ?? 0),
    capacity: Number(s.capacity ?? 0),
    amenities: normalizeAmenities(s),
    internet: s.internet ?? s.has_internet ?? s.wifi ?? null,
    power: s.power ?? s.has_power ?? s.electricity ?? null,
    is_active: s.is_active ?? (s.status !== 'inactive'),
    rating: Math.round(Number(s.rating ?? 0) * 10) / 10,
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
    status: o.status || 'pending', // pending | accepted | rejected | closed
    price_per_hour: Number(o.price_per_hour ?? o.price ?? 0),
    currency: o.currency ?? 'ش.ج',
    duration_hours: Number(o.duration_hours ?? o.hours ?? 0),
    created_at: o.created_at ?? o.created ?? '',
  };
}

// يشتق عدد الساعات من وقت البداية/النهاية عند غياب حقل الساعات الصريح.
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

// يطابق الحجز مع المساحة: بالمعرّف أولاً ثم تجربة اسم المساحة، لأن بعض واجهات
// الباك إند ترسل space_id فقط أو space_name فقط (تُستخدم في كل تبويبات اللوحة).
export function belongsToSpace(b, sp) {
  if (!sp) return true;
  if (b.spaceId != null && sp.id != null && String(b.spaceId) === String(sp.id)) return true;
  return Boolean(b.spaceName) && b.spaceName === sp.title;
}

// ----- بذور الوضع التجريبي -----

// إحصاءات تجريبية لكل مساحة تُشتق من بذور الحجوزات نفسها، حتى تلتزم الأرقام
// مع بطاقات النظرة العامة (الأرباح، الحجوزات، الإشغال).
function buildSpaceDemoStats(title, capacity) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const isConfirmed = (b) => b.status === 'confirmed' || b.status === 'accepted' || b.status === 'completed';
  const scoped = seedOwnerBookings().filter((b) => b.space_name === title);
  const confirmed = scoped.filter(isConfirmed);
  const monthBookings = confirmed.filter((b) => String(b.date).slice(0, 7) === ym);
  const hours = monthBookings.reduce((s, b) => s + Number(b.hours || 0), 0);
  const revenue = monthBookings.reduce((s, b) => s + Number(b.price || 0), 0);
  const capacityHours = Number(capacity || 0) * 8 * daysInMonth;
  const occupancy = capacityHours > 0 ? Math.min(100, Math.round((hours / capacityHours) * 100)) : 0;
  return {
    bookings: monthBookings.length,
    revenue,
    occupancy,
    totalBookings: confirmed.length,
  };
}

function seedOwnerSpaces() {
  return [
    {
      id: 'os-1',
      title: 'قاعة العروض الكبرى',
      description: 'قاعة واسعة تتسع لـ 120 شخصاً بإضاءة طبيعية ومسرح صغير.',
      location: 'وسط المدينة',
      image: '',
      price_per_hour: 150,
      capacity: 120,
      amenities: ['internet', 'electricity', 'projector', 'ac', 'microphone'],
      internet: true,
      power: true,
      is_active: true,
      rating: 4.8,
      stats: buildSpaceDemoStats('قاعة العروض الكبرى', 120),
    },
    {
      id: 'os-2',
      title: 'غرفة الاجتماعات الذكية',
      description: 'غرفة اجتماعات بـ 10 مقاعد مع شاشة عرض وكاميرا Zoom.',
      location: 'المنطقة الشرقية',
      image: '',
      price_per_hour: 100,
      capacity: 10,
      amenities: ['internet', 'projector', 'ac'],
      internet: true,
      power: true,
      is_active: true,
      rating: 4.6,
      stats: buildSpaceDemoStats('غرفة الاجتماعات الذكية', 10),
    },
    {
      id: 'os-3',
      title: 'استوديو المبدعين',
      description: 'استوديو إنتاج ملوّن حديث لتصوير المحتوى والعروض.',
      location: 'حي السعادة',
      image: '',
      price_per_hour: 200,
      capacity: 15,
      amenities: ['internet', 'electricity', 'ac'],
      internet: true,
      power: true,
      is_active: false,
      rating: 4.9,
      stats: buildSpaceDemoStats('استوديو المبدعين', 15),
    },
  ];
}

function seedOwnerOffers() {
  const daysAgo = (n) =>
    new Date(Date.now() - n * 86400000).toISOString().slice(0, 16).replace('T', ' ');
  return [
    {
      id: 'oo-1',
      request_id: 'market-1',
      request_title: 'قاعة محاضرات لدورة تدريبية أسبوعية',
      status: 'pending',
      price_per_hour: 150,
      currency: 'ش.ج',
      duration_hours: 3,
      created_at: daysAgo(1),
    },
    {
      id: 'oo-2',
      request_id: 'market-0',
      request_title: 'مساحة عمل يومية لـ 6 أشهر',
      status: 'accepted',
      price_per_hour: 45,
      currency: 'ش.ج',
      duration_hours: 8,
      created_at: daysAgo(6),
    },
  ];
}

// حجوزات تجريبية تُنشأ حول تاريخ اليوم: شهر حالي بإيراد أعلى، وشهر سابق أقل،
// حتى تظهر بطاقات النظرة العامة (الأرباح، الحجوزات، الإشغال) بأرقام واقعية.
function seedOwnerBookings() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const dateStr = (yy, mm, dd) => `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const daysIn = (yy, mm) => new Date(yy, mm, 0).getDate();
  const clampDay = (yy, mm, dd) => dateStr(yy, mm, Math.max(1, Math.min(dd, daysIn(yy, mm))));
  const spaces = [
    { name: 'قاعة العروض الكبرى', rate: 150 },
    { name: 'غرفة الاجتماعات الذكية', rate: 100 },
    { name: 'استوديو المبدعين', rate: 200 },
  ];
  const customers = ['أحمد خالد', 'سارة مراد', 'ليان قاسم', 'محمود عوض', 'نور الحاج'];

  const list = [];
  let id = 5000;

  const push = (date, hours, status, i) => {
    const space = spaces[i % spaces.length];
    list.push({
      booking_id: id++,
      space_name: space.name,
      image: '',
      date,
      time_from: '09:00:00',
      time_to: `${9 + hours}:00:00`,
      hours,
      price: space.rate * hours,
      customer_name: customers[i % customers.length],
      status,
    });
  };

  // اليوم والبارحة دائماً بالدالة حتى تظهر بطاقة الإشغال بأرقام حية.
  const today = now.getDate();
  const yesterday = today - 1;

  let i = 0;
  for (const [dayOffset, hours, status, cnt] of [
    [today, 4, 'confirmed', 2],
    [yesterday, 3, 'confirmed', 1],
  ]) {
    for (let k = 0; k < cnt; k++) push(clampDay(y, m, dayOffset), hours, status, i++);
  }

  for (let d = 2; d <= 8; d++) push(clampDay(y, m, Math.min(today + d, daysIn(y, m))), 2 + (d % 3), 'confirmed', i++);
  for (let c = 0; c < 9; c++) push(clampDay(prevY, prevM, 3 + c * 2), 3 + (c % 3), c % 6 === 0 ? 'pending' : 'confirmed', i++);
  for (let p = 0; p < 4; p++) push(clampDay(y, m, Math.max(1, today - 4 - p)), 2, 'pending', i++);

  return list;
}

// سوق تجريبي: يحاول أولاً قراءة طلبات مخزن العميل المفتوحة (إن وُجد)،
// حتى يرى المالك الطلبات التي أنشأها العميل فعلاً في نفس الجلسة التجريبية.
function seedMarketRequests() {
  try {
    const raw = localStorage.getItem(CUSTOMER_REQ_DATA_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const open = (Array.isArray(data?.requests) ? data.requests : [])
        .filter((r) => r.status === 'open')
        .slice(0, 6);
      if (open.length) return open;
    }
  } catch {
    /* تجاهل */
  }

  const now = new Date();
  const daysAgo = (n) =>
    new Date(now.getTime() - n * 86400000).toISOString().slice(0, 16).replace('T', ' ');
  return [
    {
      id: 'market-1',
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
      created_at: daysAgo(1),
    },
    {
      id: 'market-2',
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
      created_at: daysAgo(2),
    },
    {
      id: 'market-3',
      title: 'مساحة عمل مشتركة لفرق صغيرة',
      notes:
        'نرغب بمساحة عمل لـ 6 أشخاص من الأحد للخميس طوال اليوم، مع إنترنت سريع وتكييف.',
      space_type: 'room',
      capacity: 6,
      schedule: { preset: 'weekly', count: 20 },
      schedule_label: 'أسبوعي × 20',
      preferred_time: '8:00 ص – 8:00 م',
      area: '',
      amenities: ['internet', 'ac'],
      budget: 60,
      status: 'open',
      offers_count: 0,
      created_at: daysAgo(3),
    },
  ];
}

function demoStore() {
  const existing = readDemoStore();
  if (existing) return existing;
  const payload = { spaces: seedOwnerSpaces(), offers: seedOwnerOffers(), bookingOverrides: {} };
  writeDemoStore(payload);
  return payload;
}

// يطبّق حالات الحجز المحفوظة محلياً (تأكيد/رفض) على بذور الحجوزات التجريبية،
// حتى تبقى قرارات المالك ثابتة داخل نفس اليوم بدل إعادة توليدها من جديد.
function applyBookingOverrides(list) {
  const store = readDemoStore();
  if (!store) return list;
  const overrides = store.bookingOverrides;
  if (!overrides || typeof overrides !== 'object') return list;
  return list.map((b) => (overrides[String(b.id)] ? { ...b, status: overrides[String(b.id)] } : b));
}

// ----- إحصائيات -----
function buildStats(store, market) {
  const openMarket = market.filter((r) => isRequestOpen(r)).length;
  return {
    spacesCount: store.spaces.length,
    activeSpacesCount: store.spaces.filter((s) => s.is_active !== false).length,
    openMarket,
    pendingOffers: store.offers.filter((o) => o.status === 'pending').length,
    acceptedOffers: store.offers.filter((o) => o.status === 'accepted').length,
  };
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
      price_per_hour: payload.price_per_hour,
      capacity: payload.capacity,
      amenities: payload.amenities,
      internet: payload.internet,
      power: payload.power,
      image: payload.image,
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
  const body = res && typeof res === 'object' && res.data && typeof res === 'object' && !Array.isArray(res.data)
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
      price_per_hour: payload.price_per_hour,
      capacity: payload.capacity,
      amenities: payload.amenities,
      internet: payload.internet,
      power: payload.power,
      image: payload.image,
    },
  });
  const body = res && typeof res === 'object' && res.data && typeof res === 'object' && !Array.isArray(res.data)
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
  const body = res && typeof res === 'object' && res.data && typeof res === 'object' && !Array.isArray(res.data)
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

// ----- التقييمات (Reviews) -----
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

function seedOwnerReviews() {
  const now = new Date();
  const daysAgo = (n) =>
    new Date(now.getTime() - n * 86400000).toISOString().slice(0, 16).replace('T', ' ');
  return [
    {
      review_id: 'rev-1',
      space_id: 'os-1',
      space_name: 'قاعة العروض الكبرى',
      space_image: '',
      customer_name: 'سارة مراد',
      customer_avatar: '',
      rating: 5,
      title: 'قاعة مميزة بكل المقاييس',
      comment:
        'استخدمنا القاعة لورشة عمل ثلاثة أيام، كانت الإضاءة الطبيعية والإنترنت السريع مميزان. فريق المنسقين تعاون رائع.',
      date: daysAgo(2),
      created_at: daysAgo(2),
    },
    {
      review_id: 'rev-2',
      space_id: 'os-1',
      space_name: 'قاعة العروض الكبرى',
      space_image: '',
      customer_name: 'أحمد خالد',
      customer_avatar: '',
      rating: 4,
      title: '',
      comment:
        'قاعة واسعة ومريحة، نقص القليل من التكييف في الصيف لكن الباقي ممتاز. سنعود بلا شك.',
      date: daysAgo(5),
      created_at: daysAgo(5),
    },
    {
      review_id: 'rev-3',
      space_id: 'os-2',
      space_name: 'غرفة الاجتماعات الذكية',
      space_image: '',
      customer_name: 'محمود عوض',
      customer_avatar: '',
      rating: 5,
      title: 'مثالية للاجتماعات',
      comment:
        'الشاشة الكبيرة والكاميرا Zoom عملت بدون أي مشاكل، والموظف الذي رافقنا كان متعاوناً جداً. ننصح بهذه الغرفة.',
      date: daysAgo(4),
      created_at: daysAgo(4),
    },
    {
      review_id: 'rev-4',
      space_id: 'os-3',
      space_name: 'استوديو المبدعين',
      space_image: '',
      customer_name: 'نور الحاج',
      customer_avatar: '',
      rating: 3,
      title: '',
      comment:
        'الاستوديو أنيق لكن الأسعار مرتفعة شوية مقارنة بالمنافسين. مملكن تكون خيار جيد للمنتجات النوعية.',
      date: daysAgo(8),
      created_at: daysAgo(8),
    },
    {
      review_id: 'rev-5',
      space_id: 'os-2',
      space_name: 'غرفة الاجتماعات الذكية',
      space_image: '',
      customer_name: 'ليان قاسم',
      customer_avatar: '',
      rating: 5,
      title: 'تجربة مميزة',
      comment: 'كل شيء كان تمام، من التوصيل للبرمجيات. شكراً لكم.',
      date: daysAgo(12),
      created_at: daysAgo(12),
    },
  ];
}

// ----- واجهة التطبيق (API -> تجريبي) -----
export async function loadReviewsWithFallback(spaceId, force = false) {
  if (isOwnerDemo() && !force) {
    const all = seedOwnerReviews().map(mapOwnerReview);
    return { demo: true, reviews: spaceId ? all.filter((r) => String(r.spaceId) === String(spaceId)) : all };
  }
  try {
    const reviews = await fetchOwnerReviews(spaceId);
    setDemoFlag(false);
    return { demo: false, reviews };
  } catch {
    setDemoFlag(true);
    const all = seedOwnerReviews().map(mapOwnerReview);
    return { demo: true, reviews: spaceId ? all.filter((r) => String(r.spaceId) === String(spaceId)) : all };
  }
}

// يؤكّد أو يرفض حجزاً على مساحة المالك. الواجهة غير مفعّلة بعد في الباك إند،
// لذا تعتمد على نمط «جرّب API ثم الوضع التجريبي» الموجود في باقي الوحدة.
export async function updateOwnerBookingStatus(bookingId, status) {
  const res = await request(`/api/owner/bookings/${bookingId}/status`, {
    method: 'PATCH',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
    body: { status },
  });
  const body = res && typeof res === 'object' && res.data && typeof res === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return {
    message: body.message || (status === 'confirmed' ? 'تم تأكيد الحجز.' : 'تم رفض طلب الحجز.'),
    booking: body.booking ? mapOwnerBooking(body.booking) : null,
  };
}

// ----- واجهات التطبيق (API → تجريبي) -----
export async function loadMarketWithFallback(force = false) {
  if (isOwnerDemo() && !force) {
    return { demo: true, requests: seedMarketRequests().map(mapRequest) };
  }
  try {
    const requests = await fetchMarketRequests();
    setDemoFlag(false);
    return { demo: false, requests };
  } catch {
    setDemoFlag(true);
    return { demo: true, requests: seedMarketRequests().map(mapRequest) };
  }
}

export async function submitProposalWithFallback(requestId, payload) {
  const mapSubmitted = (store) => {
    const reqId = String(requestId);
    const existing = store.offers.find((o) => String(o.request_id) === reqId && o.status === 'pending');
    if (existing) return { message: 'سبق أن قدّمت عرضاً لهذا الطلب.', offer: existing, duplicate: true };

    const offer = {
      id: `oo-${Date.now()}`,
      request_id: requestId,
      request_title: payload.request_title || '',
      status: 'pending',
      price_per_hour: Number(payload.price_per_hour || 0),
      currency: payload.currency || 'ش.ج',
      duration_hours: Number(payload.duration_hours || 0),
      created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    store.offers.unshift(offer);
    writeDemoStore(store);
    return { message: 'تم إرسال عرضك، وسيصل صاحب الطلب للاختيار.', offer, duplicate: false };
  };

  if (isOwnerDemo()) {
    return { demo: true, ...mapSubmitted(demoStore()) };
  }
  try {
    const result = await submitOwnerProposal(requestId, payload);
    setDemoFlag(false);
    return { demo: false, message: result.message, offer: result.offer, duplicate: false };
  } catch {
    setDemoFlag(true);
    return { demo: true, ...mapSubmitted(demoStore()) };
  }
}

export async function loadOwnerOffersWithFallback(force = false) {
  if (isOwnerDemo() && !force) {
    return { demo: true, offers: demoStore().offers.map(mapMyOffer) };
  }
  try {
    const offers = await fetchOwnerOffers();
    setDemoFlag(false);
    return { demo: false, offers };
  } catch {
    setDemoFlag(true);
    return { demo: true, offers: demoStore().offers.map(mapMyOffer) };
  }
}

export async function loadSpacesWithFallback(force = false) {
  if (isOwnerDemo() && !force) {
    return { demo: true, spaces: demoStore().spaces.map(mapSpace) };
  }
  try {
    const spaces = await fetchOwnerSpaces();
    setDemoFlag(false);
    return { demo: false, spaces };
  } catch {
    setDemoFlag(true);
    return { demo: true, spaces: demoStore().spaces.map(mapSpace) };
  }
}

export async function createSpaceWithFallback(payload) {
  invalidateDashboardMemo();
  const applyLocal = () => {
    const store = demoStore();
    const space = {
      id: `os-${Date.now()}`,
      title: payload.title || 'مساحة جديدة',
      description: payload.description || '',
      location: payload.location || '',
      image: payload.image || '',
      gallery: Array.isArray(payload.gallery) ? payload.gallery : (payload.image ? [payload.image] : []),
      price_per_hour: Number(payload.price_per_hour || 0),
      capacity: Number(payload.capacity || 0),
      amenities: payload.amenities || [],
      internet: payload.internet || false,
      power: payload.power || false,
      is_active: true,
      rating: 0,
    };
    store.spaces.unshift(space);
    const saved = writeDemoStore(store);
    return { space: mapSpace(space), saved };
  };

  if (isOwnerDemo()) {
    const { space, saved } = applyLocal();
    return {
      demo: true,
      message: saved ? 'تمت إضافة المساحة (وضع تجريبي).' : 'التخزين المحلي ممتلئ — المساحة لن تُحفظ بعد إعادة التحميل. قلّل عدد صور المساحة أو حجمها.',
      space,
    };
  }
  try {
    const result = await createOwnerSpace(payload);
    setDemoFlag(false);
    return { demo: false, ...result };
  } catch {
    setDemoFlag(true);
    const { space, saved } = applyLocal();
    return {
      demo: true,
      message: saved ? 'تعذّر الوصول للخادم — أُضيفت المساحة محلياً للتجربة.' : 'تعذّر الوصول للخادم والتخزين المحلي ممتلئ — قلّل صور المساحة وأعد المحاولة.',
      space,
    };
  }
}

export async function toggleSpaceActiveWithFallback(spaceId, isActive, space) {
  invalidateDashboardMemo();
  const applyLocal = () => {
    const store = demoStore();
    const hit = store.spaces.find((s) => String(s.id) === String(spaceId));
    if (hit) hit.is_active = isActive;
    writeDemoStore(store);
    return mapSpace(space ? { ...space, is_active: isActive } : { id: spaceId, is_active: isActive });
  };

  if (isOwnerDemo()) {
    return { demo: true, message: 'تم تحديث حالة المساحة.', space: applyLocal() };
  }
  try {
    const result = await toggleOwnerSpaceActive(spaceId, isActive);
    setDemoFlag(false);
    return { demo: false, ...result };
  } catch {
    setDemoFlag(true);
    return { demo: true, message: 'تم تحديث حالة المساحة (وضع تجريبي).', space: applyLocal() };
  }
}

export async function updateSpaceWithFallback(spaceId, payload) {
  invalidateDashboardMemo();
  const applyLocal = () => {
    const store = demoStore();
    const idx = store.spaces.findIndex((s) => String(s.id) === String(spaceId));
    if (idx === -1) throw new Error('المساحة غير موجودة');
    const prev = store.spaces[idx];
    const merged = { ...prev };
    if (typeof payload.title === 'string' && payload.title.trim() !== '') merged.title = payload.title.trim();
    if (typeof payload.description === 'string') merged.description = payload.description;
    if (typeof payload.location === 'string' && payload.location.trim() !== '') merged.location = payload.location.trim();
    if (payload.price_per_hour !== undefined && payload.price_per_hour !== '') merged.price_per_hour = Number(payload.price_per_hour);
    if (payload.capacity !== undefined && payload.capacity !== '') merged.capacity = Number(payload.capacity);
    if (Array.isArray(payload.amenities)) merged.amenities = payload.amenities;
    if (payload.internet !== undefined) merged.internet = payload.internet;
    if (payload.power !== undefined) merged.power = payload.power;
    if (payload.image !== undefined) merged.image = payload.image;
    if (Array.isArray(payload.gallery)) merged.gallery = payload.gallery;
    store.spaces[idx] = merged;
    const saved = writeDemoStore(store);
    return { space: mapSpace(merged), saved };
  };

  if (isOwnerDemo()) {
    const { space, saved } = applyLocal();
    return {
      demo: true,
      message: saved ? 'تم تحديث المساحة.' : 'التخزين المحلي ممتلئ — التعديل سيختفي بعد إعادة التحميل. قلّل صور المساحة.',
      space,
    };
  }
  try {
    const result = await updateOwnerSpace(spaceId, payload);
    setDemoFlag(false);
    return { demo: false, ...result };
  } catch {
    setDemoFlag(true);
    const { space, saved } = applyLocal();
    return {
      demo: true,
      message: saved ? 'تعذّر الوصول للخادم — حُدّثت المساحة محلياً.' : 'تعذّر الوصول للخادم والتخزين المحلي ممتلئ — قلّل صور المساحة.',
      space,
    };
  }
}

export async function deleteSpaceWithFallback(spaceId) {
  invalidateDashboardMemo();
  const applyLocal = () => {
    const store = demoStore();
    const before = store.spaces.length;
    store.spaces = store.spaces.filter((s) => String(s.id) !== String(spaceId));
    writeDemoStore(store);
    return store.spaces.length !== before;
  };

  if (isOwnerDemo()) {
    return { demo: true, message: 'تم حذف المساحة.', deleted: applyLocal() };
  }
  try {
    const result = await deleteOwnerSpace(spaceId);
    setDemoFlag(false);
    return { demo: false, message: result.message, deleted: true };
  } catch {
    setDemoFlag(true);
    applyLocal();
    return { demo: true, message: 'تعذّر الوصول للخادم — حُذفت المساحة محلياً.', deleted: true };
  }
}

export async function loadOwnerBookingsWithFallback(force = false) {
  if (isOwnerDemo() && !force) {
    return { demo: true, bookings: [] };
  }
  try {
    const bookings = await fetchOwnerBookings();
    setDemoFlag(false);
    return { demo: false, bookings };
  } catch {
    setDemoFlag(true);
    return { demo: true, bookings: [] };
  }
}

export async function setBookingStatusWithFallback(bookingId, status) {
  invalidateDashboardMemo();
  if (isOwnerDemo()) {
    const store = demoStore();
    store.bookingOverrides = store.bookingOverrides || {};
    store.bookingOverrides[String(bookingId)] = status;
    writeDemoStore(store);
    const seed = seedOwnerBookings().find((b) => String(b.booking_id) === String(bookingId));
    return {
      demo: true,
      message: status === 'confirmed' ? 'تم تأكيد الحجز (وضع تجريبي).' : 'تم رفض طلب الحجز (وضع تجريبي).',
      booking: seed ? mapOwnerBooking({ ...seed, status }) : null,
    };
  }
  try {
    const result = await updateOwnerBookingStatus(bookingId, status);
    setDemoFlag(false);
    return { demo: false, message: result.message };
  } catch {
    setDemoFlag(true);
    const store = demoStore();
    store.bookingOverrides = store.bookingOverrides || {};
    store.bookingOverrides[String(bookingId)] = status;
    writeDemoStore(store);
    return { demo: true, message: 'تعذّر الوصول للخادم — حُدِّث الحجز محلياً للتجربة.' };
  }
}

// ----- تحميل لوحة المالك كاملة (بالتوازي) مع الكاش -----
// تجنّب التكرار عند فتح الصفحة: أي طلبين متوازيين (اللوحة + تبويب) يشاركان نفس الوعد.
let dashboardInFlight = null;

function invalidateDashboardMemo() {
  dashboardInFlight = null;
}

async function loadOwnerDashboardImpl() {
  const runDemo = () => {
    const store = demoStore();
    const market = seedMarketRequests().map(mapRequest);
    return {
      demo: true,
      user: getUser() || { name: '' },
      stats: buildStats(store, market),
      spaces: store.spaces.map(mapSpace),
      offers: store.offers.map(mapMyOffer),
      market,
      bookings: applyBookingOverrides(seedOwnerBookings().map(mapOwnerBooking)),
      reviews: seedOwnerReviews().map(mapOwnerReview),
    };
  };

  if (isOwnerDemo()) return runDemo();

  try {
    const [spacesApi, offersApi, marketApi, bookingsApi, profileApi, reviewsApi] = await Promise.all([
      fetchOwnerSpaces(),
      fetchOwnerOffers(),
      fetchMarketRequests(),
      fetchOwnerBookings().catch(() => []),
      request('/api/profile', { method: 'GET', auth: true, timeoutMs: REQ_TIMEOUT_MS }).catch(() => null),
      fetchOwnerReviews().catch(() => []),
    ]);

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

    setDemoFlag(false);
    return {
      demo: false,
      user: { name, email, phone, photo, role: 'owner' },
      stats: buildStats(store, market),
      spaces,
      offers,
      market,
      bookings: bookingsApi,
      reviews: reviewsApi,
    };
  } catch {
    setDemoFlag(true);
    return runDemo();
  }
}

export async function loadOwnerDashboardWithFallback(force = false) {
  if (!force && dashboardInFlight) return dashboardInFlight;
  dashboardInFlight = loadOwnerDashboardImpl().then((r) => {
    dashboardInFlight = null;
    return r;
  });
  return dashboardInFlight;
}