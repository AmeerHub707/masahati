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
  } catch {
    /* التخزين غير متاح */
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
  return {
    id: s.space_id ?? s.id,
    title: s.title ?? '',
    description: s.description ?? '',
    location: s.location ?? '',
    image: imageUrl(s.image) || '',
    price_per_hour: Number(s.price_per_hour ?? s.price ?? 0),
    capacity: Number(s.capacity ?? 0),
    amenities: normalizeAmenities(s),
    internet: s.internet ?? s.has_internet ?? s.wifi ?? null,
    power: s.power ?? s.has_power ?? s.electricity ?? null,
    is_active: s.is_active ?? (s.status !== 'inactive'),
    rating: Math.round(Number(s.rating ?? 0) * 10) / 10,
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

export function mapOwnerBooking(b) {
  return {
    id: b.booking_id ?? b.id,
    spaceName: b.space_name ?? b.title ?? '',
    image: imageUrl(b.image) || '',
    date: b.date || '',
    time: b.time_from && b.time_to ? `${b.time_from} – ${b.time_to}` : (b.time || ''),
    hours: Number(b.hours || 0),
    price: Number(b.price || b.cost || 0),
    customer: b.customer ?? b.customer_name ?? '',
    status: b.status || 'pending',
  };
}

// ----- بذور الوضع التجريبي -----
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
  const payload = { spaces: seedOwnerSpaces(), offers: seedOwnerOffers() };
  writeDemoStore(payload);
  return payload;
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

export async function fetchOwnerBookings() {
  const res = await request('/api/owner/bookings', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res, 'bookings').map(mapOwnerBooking);
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
  const applyLocal = () => {
    const store = demoStore();
    const space = {
      id: `os-${Date.now()}`,
      title: payload.title || 'مساحة جديدة',
      description: payload.description || '',
      location: payload.location || '',
      image: payload.image || '',
      price_per_hour: Number(payload.price_per_hour || 0),
      capacity: Number(payload.capacity || 0),
      amenities: payload.amenities || [],
      internet: payload.internet || false,
      power: payload.power || false,
      is_active: true,
      rating: 0,
    };
    store.spaces.unshift(space);
    writeDemoStore(store);
    return mapSpace(space);
  };

  if (isOwnerDemo()) {
    return { demo: true, message: 'تمت إضافة المساحة (وضع تجريبي).', space: applyLocal() };
  }
  try {
    const result = await createOwnerSpace(payload);
    setDemoFlag(false);
    return { demo: false, ...result };
  } catch {
    setDemoFlag(true);
    return { demo: true, message: 'تعذّر الوصول للخادم — أُضيفت المساحة محلياً للتجربة.', space: applyLocal() };
  }
}

export async function toggleSpaceActiveWithFallback(spaceId, isActive, space) {
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

// ----- تحميل لوحة المالك كاملة (بالتوازي) مع الكاش -----
export async function loadOwnerDashboardWithFallback(force = false) {
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
      bookings: [],
    };
  };

  if (isOwnerDemo() && !force) return runDemo();

  try {
    const [spacesApi, offersApi, marketApi, bookingsApi, profileApi] = await Promise.all([
      fetchOwnerSpaces(),
      fetchOwnerOffers(),
      fetchMarketRequests(),
      fetchOwnerBookings().catch(() => []),
      request('/api/profile', { method: 'GET', auth: true, timeoutMs: REQ_TIMEOUT_MS }).catch(() => null),
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
    };
  } catch {
    setDemoFlag(true);
    return runDemo();
  }
}