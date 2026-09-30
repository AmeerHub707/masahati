// وحدة تصفح المساحات العامة — تتواصل مع الباك إند (Laravel) عبر عميل api.js.
// عند عدم توفر الواجهة (أو فشلها) تنتقل تلقائياً لوضع تجريبي محلي
// بنفس نمط owner.js و requests.js.

import { request } from './api';
import { mapSpace } from './owner';

const SPACES_TIMEOUT_MS = 10000;

const DEMO_FLAG_KEY = 'masahati_spaces_demo_v1';
const DEMO_DATA_KEY = 'masahati_spaces_data_v1';

// ----- وضع تجريبي -----
export function isSpacesDemo() {
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
    return data && Array.isArray(data.spaces) ? data : null;
  } catch {
    return null;
  }
}

function writeDemoStore(payload) {
  try {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

// ----- بذور الوضع التجريبي -----
function seedDemoSpaces() {
  return [
    {
      id: 'sp-1',
      title: 'قاعة العروض الكبرى',
      description: 'قاعة واسعة تتسع لـ 120 شخصاً بإضاءة طبيعية ومسرح صغير مجهز بالكامل.',
      location: 'وسط المدينة',
      lat: 31.5011,
      lng: 34.4667,
      image: '',
      gallery: [],
      price_per_hour: 150,
      capacity: 120,
      open_time: '08:00',
      close_time: '18:00',
      contact_phone: '0599123456',
      amenities: ['internet', 'electricity', 'projector', 'ac', 'microphone'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'hall',
      area: 'وسط المدينة',
      review_count: 24,
      instant_booking: true,
      rating: 4.8,
      stats: { bookings: 45, revenue: 6750, occupancy: 78, totalBookings: 120 },
    },
    {
      id: 'sp-2',
      title: 'غرفة الاجتماعات الذكية',
      description: 'غرفة اجتماعات بـ 10 مقاعد مع شاشة عرض 75 بوصة وكاميرا Zoom.',
      location: 'المنطقة الشرقية',
      lat: 31.5022,
      lng: 34.4688,
      image: '',
      gallery: [],
      price_per_hour: 100,
      capacity: 10,
      open_time: '09:00',
      close_time: '17:00',
      contact_phone: '0599765432',
      amenities: ['internet', 'projector', 'ac'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'room',
      area: 'المنطقة الشرقية',
      review_count: 18,
      instant_booking: true,
      rating: 4.6,
      stats: { bookings: 32, revenue: 3200, occupancy: 65, totalBookings: 89 },
    },
    {
      id: 'sp-3',
      title: 'استوديو المبدعين',
      description: 'استوديو إنتاج ملوّن حديث لتصوير المحتوى والعروض مع إضاءة احترافية.',
      location: 'حي السعادة',
      lat: 31.5088,
      lng: 34.4772,
      image: '',
      gallery: [],
      price_per_hour: 200,
      capacity: 15,
      open_time: '10:00',
      close_time: '22:00',
      contact_phone: '0599554433',
      amenities: ['internet', 'electricity', 'ac'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'studio',
      area: 'حي السعادة',
      review_count: 12,
      instant_booking: false,
      rating: 4.9,
      stats: { bookings: 28, revenue: 5600, occupancy: 82, totalBookings: 67 },
    },
    {
      id: 'sp-4',
      title: 'صالة المؤتمرات الكبرى',
      description: 'صالة كبيرة لإقامة المؤتمرات والفعاليات الكبرى تتسع لأكثر من 200 شخص.',
      location: 'شارع الجامعة',
      lat: 31.5100,
      lng: 34.4800,
      image: '',
      gallery: [],
      price_per_hour: 350,
      capacity: 200,
      open_time: '07:00',
      close_time: '23:00',
      contact_phone: '0599111222',
      amenities: ['internet', 'electricity', 'projector', 'ac', 'microphone', 'whiteboard'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'hall',
      area: 'شارع الجامعة',
      review_count: 35,
      instant_booking: false,
      rating: 4.7,
      stats: { bookings: 52, revenue: 18200, occupancy: 88, totalBookings: 145 },
    },
    {
      id: 'sp-5',
      title: 'ورشة العمل الإبداعية',
      description: 'مساحة عمل مناسبة للحرفيين والحرف اليدوية مع أدوات وتجهيزات خاصة.',
      location: 'حي الأمل',
      lat: 31.4950,
      lng: 34.4600,
      image: '',
      gallery: [],
      price_per_hour: 75,
      capacity: 20,
      open_time: '08:00',
      close_time: '20:00',
      contact_phone: '0599333444',
      amenities: ['electricity', 'ac'],
      internet: false,
      power: true,
      is_active: true,
      status: 'active',
      category: 'workshop',
      area: 'حي الأمل',
      review_count: 8,
      instant_booking: true,
      rating: 4.3,
      stats: { bookings: 15, revenue: 1125, occupancy: 45, totalBookings: 34 },
    },
    {
      id: 'sp-6',
      title: 'مكتب تنفيذي فاخر',
      description: 'مكتب فاخر للمسؤولين التنفيذيين مع إطلالة رائعة وديكور عصري.',
      location: 'برج الأعمال',
      lat: 31.5150,
      lng: 34.4900,
      image: '',
      gallery: [],
      price_per_hour: 180,
      capacity: 5,
      open_time: '09:00',
      close_time: '18:00',
      contact_phone: '0599555666',
      amenities: ['internet', 'electricity', 'ac', 'whiteboard'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'office',
      area: 'برج الأعمال',
      review_count: 6,
      instant_booking: true,
      rating: 4.5,
      stats: { bookings: 12, revenue: 2160, occupancy: 55, totalBookings: 28 },
    },
    {
      id: 'sp-7',
      title: 'مساحة عمل مشتركة',
      description: 'مساحة عمل مشتركة مناسبة للـ freelancers والمشاريع الناشئة.',
      location: 'وسط المدينة',
      lat: 31.5000,
      lng: 34.4650,
      image: '',
      gallery: [],
      price_per_hour: 45,
      capacity: 30,
      open_time: '08:00',
      close_time: '22:00',
      contact_phone: '0599777888',
      amenities: ['internet', 'electricity', 'ac'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'coworking',
      area: 'وسط المدينة',
      review_count: 42,
      instant_booking: true,
      rating: 4.4,
      stats: { bookings: 89, revenue: 4005, occupancy: 72, totalBookings: 210 },
    },
    {
      id: 'sp-8',
      title: 'قاعة التدريب الحديثة',
      description: 'قاعة مجهزة للدورات التدريبية مع شاشة عرض تفاعلية ومقاعد مريحة.',
      location: 'المنطقة الشرقية',
      lat: 31.5050,
      lng: 34.4750,
      image: '',
      gallery: [],
      price_per_hour: 120,
      capacity: 50,
      open_time: '08:00',
      close_time: '20:00',
      contact_phone: '0599999000',
      amenities: ['internet', 'electricity', 'projector', 'ac', 'microphone'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'training',
      area: 'المنطقة الشرقية',
      review_count: 19,
      instant_booking: false,
      rating: 4.6,
      stats: { bookings: 38, revenue: 4560, occupancy: 68, totalBookings: 95 },
    },
    {
      id: 'sp-9',
      title: 'استوديو التصوير الفوتوغرافي',
      description: 'استوديو مجهز للتصوير الفوتوغرافي مع خلفيات متعددة وإضاءة صناعية.',
      location: 'حي السعادة',
      lat: 31.5070,
      lng: 34.4720,
      image: '',
      gallery: [],
      price_per_hour: 250,
      capacity: 8,
      open_time: '10:00',
      close_time: '22:00',
      contact_phone: '0599111333',
      amenities: ['electricity', 'ac'],
      internet: false,
      power: true,
      is_active: true,
      status: 'active',
      category: 'studio',
      area: 'حي السعادة',
      review_count: 14,
      instant_booking: false,
      rating: 4.8,
      stats: { bookings: 22, revenue: 5500, occupancy: 75, totalBookings: 58 },
    },
    {
      id: 'sp-10',
      title: 'قاعة الأفراح والمناسبات',
      description: 'قاعة أنيقة لإقامة الأفراح والمناسبات مع ديكور فاخر وخدمة ضيافة.',
      location: 'شارع الجامعة',
      lat: 31.5120,
      lng: 34.4850,
      image: '',
      gallery: [],
      price_per_hour: 500,
      capacity: 300,
      open_time: '12:00',
      close_time: '02:00',
      contact_phone: '0599222444',
      amenities: ['internet', 'electricity', 'projector', 'ac', 'microphone'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'event',
      area: 'شارع الجامعة',
      review_count: 56,
      instant_booking: false,
      rating: 4.9,
      stats: { bookings: 68, revenue: 34000, occupancy: 92, totalBookings: 180 },
    },
    {
      id: 'sp-11',
      title: 'غرفة التركيز الهادئة',
      description: 'غرفة صغيرة هادئة مثالية للعمل المركّز والمقابلات الفردية.',
      location: 'برج الأعمال',
      lat: 31.5140,
      lng: 34.4880,
      image: '',
      gallery: [],
      price_per_hour: 60,
      capacity: 4,
      open_time: '09:00',
      close_time: '19:00',
      contact_phone: '0599333555',
      amenities: ['internet', 'electricity', 'ac'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'room',
      area: 'برج الأعمال',
      review_count: 9,
      instant_booking: true,
      rating: 4.2,
      stats: { bookings: 18, revenue: 1080, occupancy: 50, totalBookings: 42 },
    },
    {
      id: 'sp-12',
      title: 'مختبر الابتكار التقني',
      description: 'مختبر مجهز للتجارب التقنية والابتكار مع أجهزة حاسوب متقدمة.',
      location: 'المنطقة الشرقية',
      lat: 31.5030,
      lng: 34.4700,
      image: '',
      gallery: [],
      price_per_hour: 150,
      capacity: 12,
      open_time: '08:00',
      close_time: '20:00',
      contact_phone: '0599444666',
      amenities: ['internet', 'electricity', 'ac', 'whiteboard'],
      internet: true,
      power: true,
      is_active: true,
      status: 'active',
      category: 'lab',
      area: 'المنطقة الشرقية',
      review_count: 11,
      instant_booking: false,
      rating: 4.7,
      stats: { bookings: 25, revenue: 3750, occupancy: 70, totalBookings: 62 },
    },
  ];
}

function demoStore() {
  const existing = readDemoStore();
  if (existing) return existing;
  const payload = { spaces: seedDemoSpaces() };
  writeDemoStore(payload);
  return payload;
}

// ----- API حقيقي -----
export async function fetchSpaces(page = 1, filters = {}) {
  const params = new URLSearchParams({ page: String(page) });
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.min_price) params.set('min_price', String(filters.min_price));
  if (filters.max_price) params.set('max_price', String(filters.max_price));
  if (filters.amenities?.length) params.set('amenities', filters.amenities.join(','));
  if (filters.area) params.set('area', filters.area);
  if (filters.min_rating) params.set('min_rating', String(filters.min_rating));
  if (filters.sort) params.set('sort', filters.sort);

  const res = await request(`/api/spaces?${params.toString()}`, {
    method: 'GET',
    timeoutMs: SPACES_TIMEOUT_MS,
  });

  const rawItems = res?.data?.data || res?.data || res?.spaces || [];
  const items = Array.isArray(rawItems) ? rawItems : [];
  return {
    spaces: items.map(mapSpace),
    current_page: res?.current_page ?? res?.data?.current_page ?? page,
    last_page: res?.last_page ?? res?.data?.last_page ?? 1,
    has_more: res?.has_more ?? res?.data?.has_more ?? false,
    total: res?.total ?? res?.data?.total ?? items.length,
  };
}

export async function fetchSpaceDetail(id) {
  const res = await request(`/api/spaces/${id}`, {
    method: 'GET',
    timeoutMs: SPACES_TIMEOUT_MS,
  });
  const body = res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)
    ? res.data
    : res || {};
  return mapSpace(body.space ?? body);
}

// ----- واجهة التطبيق (API → تجريبي) -----
export async function loadSpacesWithFallback(filters = {}, page = 1, force = false) {
  if (isSpacesDemo() && !force) {
    const all = demoStore().spaces.map(mapSpace);
    const filtered = applyFilters(all, filters);
    const perPage = 9;
    const start = (page - 1) * perPage;
    const paged = filtered.slice(start, start + perPage);
    return {
      demo: true,
      spaces: paged,
      current_page: page,
      last_page: Math.max(1, Math.ceil(filtered.length / perPage)),
      has_more: start + perPage < filtered.length,
      total: filtered.length,
    };
  }
  try {
    const result = await fetchSpaces(page, filters);
    setDemoFlag(false);
    return { demo: false, ...result };
  } catch {
    setDemoFlag(true);
    const all = demoStore().spaces.map(mapSpace);
    const filtered = applyFilters(all, filters);
    const perPage = 9;
    const start = (page - 1) * perPage;
    const paged = filtered.slice(start, start + perPage);
    return {
      demo: true,
      spaces: paged,
      current_page: page,
      last_page: Math.max(1, Math.ceil(filtered.length / perPage)),
      has_more: start + perPage < filtered.length,
      total: filtered.length,
    };
  }
}

export async function loadSpaceDetailWithFallback(id, force = false) {
  // في الوضع التجريبي: أعد مساحة مطابقة فقط، أو undefined إذا لم توجد
  const findInDemo = () => {
    const all = demoStore().spaces.map(mapSpace);
    return all.find((s) => String(s.id) === String(id));
  };

  if (isSpacesDemo() && !force) {
    return { demo: true, space: findInDemo() };
  }
  try {
    const space = await fetchSpaceDetail(id);
    setDemoFlag(false);
    if (!space || space.id == null) throw new Error('not-found');
    return { demo: false, space };
  } catch {
    setDemoFlag(true);
    return { demo: true, space: findInDemo() };
  }
}

// جلب كل المساحات (كل الصفحات) للعرض المُقارن. في الوضع التجريبي تُرجع بذور
// كاملة فوراً؛ مع الباك إند يتكرر الجلب صفحة-صفحة حتى النهاية (بحد أقصى أمان).
export async function loadAllSpacesWithFallback(force = false) {
  if (isSpacesDemo() && !force) {
    return { demo: true, spaces: demoStore().spaces.map(mapSpace) };
  }
  const collected = [];
  let page = 1;
  let lastPage = 1;
  try {
    do {
      const result = await fetchSpaces(page);
      lastPage = result.last_page;
      collected.push(...result.spaces);
      page += 1;
      if (page > 25) break; // سقف أمان: لا نقطة سيرفر أكثر من 25 صفحة
    } while (page <= lastPage);
    setDemoFlag(false);
    return { demo: false, spaces: collected };
  } catch {
    setDemoFlag(true);
    return { demo: true, spaces: demoStore().spaces.map(mapSpace) };
  }
}

// ----- الحجز -----
// نقطة الحجز غير مفعّلة في الباك إند حالياً، فنستدعيها عبر request (auth: true)
// حتى لا نحتاج تمرير التوكن يدوياً. أي فشل (404/422/شبكة) يتحوّل إلى حالة
// "غير متاح" واضحة بدل رمي خطأ غير مفهوم للمستخدم.
const BOOKING_TIMEOUT_MS = 8000;

/**
 * محاولة إنشاء حجز. لا ترمي استثناءً إطلاقاً — ترجع دائماً
 * { ok: boolean, reason?: string, booking?: object }.
 * @param {{spaceId:number|string, date?:string, startTime?:string, endTime?:string, hours?:number}} payload
 */
export async function createBooking(payload) {
  try {
    const res = await request('/api/bookings', {
      method: 'POST',
      auth: true,
      body: {
        space_id: payload.spaceId,
        booking_date: payload.date || undefined,
        start_time: payload.startTime || undefined,
        end_time: payload.endTime || undefined,
        hours: payload.hours || undefined,
      },
      timeoutMs: BOOKING_TIMEOUT_MS,
    });
    const b = (res && typeof res === 'object' && (res.booking || res.data)) || res || null;
    if (b && b.id != null) return { ok: true, booking: b };
    // 200 بلا حجز: نحتاجه idempotent، نعتبرها نجاحاً مع رسالة.
    return { ok: true, booking: b };
  } catch (err) {
    const status = err && (err.status ?? err.statusCode);
    let reason = 'unavailable';
    if (status === 401) reason = 'unauthenticated';
    else if (status === 403) reason = 'forbidden';
    else if (status === 409) reason = 'conflict';
    else if (status === 422) reason = 'invalid';
    return { ok: false, reason, status: status ?? null };
  }
}

// ----- التصفية المحلية (للوضع التجريبي) -----
function applyFilters(spaces, filters) {
  let result = [...spaces];

  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter((s) => {
      const hay = `${s.title} ${s.description} ${s.location} ${s.area}`.toLowerCase();
      return hay.includes(q);
    });
  }

  if (filters.category) {
    result = result.filter((s) => s.category === filters.category);
  }

  if (filters.min_price != null && filters.min_price !== '') {
    const min = Number(filters.min_price);
    if (Number.isFinite(min)) result = result.filter((s) => s.price_per_hour >= min);
  }

  if (filters.max_price != null && filters.max_price !== '') {
    const max = Number(filters.max_price);
    if (Number.isFinite(max)) result = result.filter((s) => s.price_per_hour <= max);
  }

  if (filters.amenities?.length) {
    result = result.filter((s) => {
      const spaceAmenities = s.amenities || [];
      return filters.amenities.every((a) => spaceAmenities.includes(a));
    });
  }

  if (filters.area) {
    const areaQ = filters.area.trim().toLowerCase();
    result = result.filter((s) => {
      const loc = `${s.location} ${s.area}`.toLowerCase();
      return loc.includes(areaQ);
    });
  }

  if (filters.min_rating != null && filters.min_rating !== '') {
    const minR = Number(filters.min_rating);
    if (Number.isFinite(minR)) result = result.filter((s) => s.rating >= minR);
  }

  // الترتيب
  if (filters.sort) {
    switch (filters.sort) {
      case 'price_asc':
        result.sort((a, b) => a.price_per_hour - b.price_per_hour);
        break;
      case 'price_desc':
        result.sort((a, b) => b.price_per_hour - a.price_per_hour);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
        result.sort((a, b) => (b.stats?.bookings || 0) - (a.stats?.bookings || 0));
        break;
      default:
        break;
    }
  }

  return result;
}

// ----- ثوابت التصفية -----
export const SPACE_CATEGORIES = [
  { id: '', label: 'الكل' },
  { id: 'hall', label: 'قاعة' },
  { id: 'room', label: 'غرفة' },
  { id: 'studio', label: 'استوديو' },
  { id: 'office', label: 'مكتب' },
  { id: 'coworking', label: 'مساحة مشتركة' },
  { id: 'workshop', label: 'ورشة عمل' },
  { id: 'training', label: 'قاعة تدريب' },
  { id: 'event', label: 'مناسبات' },
  { id: 'lab', label: 'مختبر' },
];

export const SORT_OPTIONS = [
  { id: '', label: 'الأحدث' },
  { id: 'price_asc', label: 'الأقل سعراً' },
  { id: 'price_desc', label: 'الأعلى سعراً' },
  { id: 'rating', label: 'الأعلى تقييماً' },
  { id: 'popular', label: 'الأكثر حجزاً' },
];

export const RATING_FILTERS = [
  { id: '', label: 'الكل' },
  { id: '4', label: '4+ نجوم' },
  { id: '3', label: '3+ نجوم' },
  { id: '2', label: '2+ نجوم' },
];
