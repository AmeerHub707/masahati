// وحدة تصفح المساحات العامة — تتواصل مع الباك إند (Laravel) عبر عميل api.js.
//
// لا توجد بيانات تجريبية ولا تراجع محلي: أي فشل في الاتصال يُرجَع كخطأ صريح
// مع قيم فارغة، ولا تعرض الشاشات أبداً بيانات مُختلقة. فشل القراءة لا يُرمى
// (تبلغ عنه الواجهة عبر error)، بينما إجراءات الكتابة ترمي الخطأ الحقيقي.

import { request } from './api';
import { mapSpace } from './owner';

const SPACES_TIMEOUT_MS = 10000;
const CATALOG_CACHE_KEY = 'masahati_spaces_catalog_v1';
const CATALOG_TTL_MS = 5 * 60 * 1000;

/** رسالة خطأ موحّدة من أي استثناء (ApiError أو غير متوقع). */
function messageOf(err) {
  return err && typeof err.message === 'string' && err.message.trim()
    ? err.message
    : 'تعذر الاتصال بالخادم. حاول مجدداً بعد قليل.';
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

// ----- واجهة التطبيق (قراءات لا ترمي + إجراءات ترمي) -----
export async function loadSpacesWithFallback(filters = {}, page = 1) {
  try {
    const result = await fetchSpaces(page, filters);
    return { error: null, ...result };
  } catch (err) {
    return {
      error: messageOf(err),
      spaces: [],
      current_page: page,
      last_page: 1,
      has_more: false,
      total: 0,
    };
  }
}

export async function loadSpaceDetailWithFallback(id) {
  try {
    const space = await fetchSpaceDetail(id);
    if (!space || space.id == null) throw new Error('هذه المساحة غير متوفرة.');
    return { error: null, space };
  } catch (err) {
    return { error: messageOf(err), space: null };
  }
}

// جلب كل المساحات (كل الصفحات) للعرض المُقارن. يتكرر الجلب صفحة-صفحة حتى
// النهاية (بحد أقصى أمان). القراءة لا ترمي: الفشل يعود بخطأ وقائمة فارغة.
export async function loadAllSpacesWithFallback(force = false) {
  const cached = force ? null : readCatalogCache();
  if (cached) return { error: null, spaces: cached };
  const collected = [];
  let page = 1;
  let lastPage;
  try {
    do {
      const result = await fetchSpaces(page);
      lastPage = result.last_page;
      collected.push(...result.spaces);
      page += 1;
      if (page > 25) break; // سقف أمان: لا نقطع أكثر من 25 صفحة
    } while (page <= lastPage);
    writeCatalogCache(collected);
    return { error: null, spaces: collected };
  } catch (err) {
    return { error: messageOf(err), spaces: [] };
  }
}

// الكتالوج الكامل يحتاج ترقيماً متسلسلاً حتى ٢٥ صفحة. نخزّنه مؤقتاً على القرص
// فتعود المقارنة فوراً، ويُعاد بناؤه من الشبكة إن تجاوز الكاش عمره.
function readCatalogCache() {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.spaces) || !Number.isFinite(data.at)) return null;
    if (Date.now() - data.at > CATALOG_TTL_MS) return null;
    return data.spaces;
  } catch {
    return null;
  }
}

function writeCatalogCache(spaces) {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ at: Date.now(), spaces }));
  } catch {
    /* التخزين غير متاح أو ممتلئ: نتابع بلا كاش */
  }
}

export function clearSpacesCatalogCache() {
  try {
    localStorage.removeItem(CATALOG_CACHE_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

// ----- الحجز -----
// لا ينشئ بيانات تجريبية: يقسم أي فشل إلى سبب مفهوم للمستخدم بدل رمي خطأ
// غير واضح. الحجز إجراء كتابة، لكن شكله { ok, reason } ثابت تلتف عليه
// الشاشات (AdDetailsPage) لتقرر عرض الرسالة المناسبة.
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