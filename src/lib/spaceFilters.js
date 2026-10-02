// منطق نطاق (domain) نقي لصفحة تصفّح المساحات: التصفية، الترتيب، الحسابات
// الجغرافية، شرائح الفلتر، اقتراحات تخفيف القيود، ورياضيات أوقات الحجز.
//
// لا يستورد React ولا api.js عمداً، حتى يمكن اختباره في Node مباشرةً
// (انظر src/utils/spaceFilters.test.mjs) دون jsdom أو محاكاة شبكة.

// نستورد بامتداد صريح (.js) ليعمل الملف مباشرةً في Node دون Vite، وهو ما
// يجعل اختباره في src/utils/spaceFilters.test.mjs ممكناً بلا jsdom.
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  DEFAULT_ORIGIN,
  PRICE_SLIDER,
  RATING_TIERS,
  SORT_OPTIONS,
} from './spaceTaxonomy.js';

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

// تحويل الأرقام إلى أرقام عربية-هندية مع فاصلة عشرية عربية (٤٫٥).
export function ar(value) {
  return String(value ?? '')
    .replace(/\d/g, (d) => AR_DIGITS[Number(d)])
    .replace(/\./g, '٫');
}

// ----- أدوات نصية/رقمية -----
function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toList(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (v === null || v === undefined || v === '') return [];
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

function toBool(v) {
  return v === true || v === '1' || v === 'true';
}

// يحوّل 'HH:MM' إلى دقائق منذ منتصف الليل، أو null عند الغياب/الفساد.
export function minutesOf(value) {
  const m = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatClock(minutes) {
  if (minutes === null || minutes === undefined) return '';
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ----- جغرافيا -----
const EARTH_RADIUS_KM = 6371;

// مسافة الدائرة العظمى بالكيلومترات بين نقطتين، أو null إن نقصت إحداثيات إحداهما.
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const lat1 = toNumber(a.lat);
  const lng1 = toNumber(a.lng);
  const lat2 = toNumber(b.lat);
  const lng2 = toNumber(b.lng);
  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ----- ساعات العمل -----
// نافذة يومية من open_time إلى close_time. ندعم النافذة العابرة لمنتصف الليل
// (close <= open). إن غاب الوقت نُعتبر المساحة مفتوحة عمداً، حتى لا يخفي فلتر
// «مفتوحة الآن» مساحات ناقصة البيانات بدل إخفائها خطأً.
export function isOpenNow(space, now = new Date()) {
  const open = minutesOf(space?.open_time);
  const close = minutesOf(space?.close_time);
  if (open === null || close === null) return true;
  const current = now.getHours() * 60 + now.getMinutes();
  if (close > open) return current >= open && current < close;
  return current >= open || current < close; // نافذة عابرة لمنتصف الليل
}

// ----- البحث النصي -----
function matchesQuery(space, q) {
  const needle = String(q ?? '').trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    space.title,
    space.description,
    space.location,
    space.area,
    space.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

// تنقية المساحة لفلتر واحد. كل شرط غير مطبَّق يجب ألا يستبعد أي عنصر.
function passes(space, f, distance) {
  if (f.q && !matchesQuery(space, f.q)) return false;

  if (f.category && space.category !== f.category) return false;

  const price = toNumber(space.price_per_hour) ?? 0;
  if (f.min !== null && price < f.min) return false;
  if (f.max !== null && price > f.max) return false;

  const capacity = toNumber(space.capacity) ?? 0;
  if (f.cap !== null && capacity < f.cap) return false;

  if (f.rating !== null && (toNumber(space.rating) ?? 0) < f.rating) return false;

  if (f.amenities.length) {
    const owned = new Set((space.amenities || []).map(String));
    // كل سمة مطلوبة يجب أن تتوفّر (AND لا OR) — sémانس المتوقّع.
    if (!f.amenities.every((key) => owned.has(key))) return false;
  }

  if (f.open && !isOpenNow(space, resolveNow(f))) return false;
  if (f.instant && !space.instant_booking) return false;

  if (f.radius !== null) {
    // مسافة غير معروفة (إحداثيات ناقصة) لا تُستبعد ضمن نطاق محدَّد.
    if (distance !== null && distance > f.radius) return false;
  }

  return true;
}

// يطبّق كل الفلاتر ويعيد distance_km على كل نتيجة (null إن لم يوجد مرجع جغرافي).
export function filterSpaces(spaces, filters = {}, origin = null) {
  const f = normalizeFilters({ ...filters, amenities: toList(filters.amenities) });
  const anchor = f.radius !== null ? origin || DEFAULT_ORIGIN : null;
  return (spaces || [])
    .filter(Boolean)
    .map((s) => ({ ...s, distance_km: anchor ? haversineKm(anchor, s) : null }))
    .filter((s) => passes(s, f, s.distance_km));
}

// المرجع الزمني لفلتر «مفتوحة الآن». يأتي من فلاتر الاختبارات (f.now) وإلا
// فساعة النظام الحالية. لا يُقرأ أبداً من عنوان URL.
function resolveNow(f) {
  return f && f.now instanceof Date ? f.now : new Date();
}

// ----- الترتيب -----
function popularity(space) {
  return toNumber(space.stats?.bookings) ?? toNumber(space.bookings_count) ?? 0;
}

// الترتيب لا يحتاج مرجعاً جغرافياً: المسافة محسوبة مسبقاً كـ distance_km
// في خطوة التصفية، والترتيب يقرأها فقط.
export function sortSpaces(spaces, sort = DEFAULT_SORT) {
  const list = [...(spaces || [])];
  const byPrice = (a, b) => (toNumber(a.price_per_hour) ?? 0) - (toNumber(b.price_per_hour) ?? 0);
  const byRating = (a, b) => (toNumber(b.rating) ?? 0) - (toNumber(a.rating) ?? 0);

  switch (sort) {
    case 'distance_asc':
      // المسافات الناقصة تُدفع إلى النهاية بدل أن تتصدّر.
      return list.sort((a, b) => {
        const da = a.distance_km ?? Number.POSITIVE_INFINITY;
        const db = b.distance_km ?? Number.POSITIVE_INFINITY;
        if (da === db) return byRating(a, b);
        return da - db;
      });
    case 'price_asc':
      return list.sort((a, b) => (byPrice(a, b) || byRating(a, b)));
    case 'price_desc':
      return list.sort((a, b) => -byPrice(a, b) || byRating(a, b));
    case 'capacity_desc':
      return list.sort((a, b) => (toNumber(b.capacity) ?? 0) - (toNumber(a.capacity) ?? 0) || byRating(a, b));
    case 'popularity_desc':
      return list.sort((a, b) => popularity(b) - popularity(a) || byRating(a, b));
    case 'rating_desc':
    default:
      return list.sort((a, b) => byRating(a, b) || byPrice(a, b));
  }
}

// خطوتا与应用 الكاملتان: تصفية ثم ترتيب.
export function applyFilters(spaces, filters = {}, origin = null) {
  return sortSpaces(filterSpaces(spaces, filters, origin), filters.sort || DEFAULT_SORT);
}

// ----- شرائح الفلتر النشطة -----
// كل شريحة تحمل قيمتها ("السعر: ٥٠ – ١٥٠") لا اسمها فقط، كي لا يضطر المستخدم
// لتذكّر ما اختاره. تُقرأ بصرياً دون فتح أي لوحة.
export function buildChips(filters = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters, amenities: toList(filters.amenities) };
  const chips = [];
  const add = (key, label) => chips.push({ key, label });

  if (f.q) add('q', `بحث: ${f.q}`);
  if (f.category) add('category', f.category);
  if (f.min !== null || f.max !== null) {
    const range =
      f.min !== null && f.max !== null
        ? `${ar(f.min)} – ${ar(f.max)}`
        : f.min !== null
          ? `${ar(f.min)} فأكثر`
          : `أقل من ${ar(f.max)}`;
    add('price', `السعر: ${range}`);
  }
  if (f.cap !== null) add('cap', `السعة: ${ar(f.cap)}+`);
  if (f.rating !== null) add('rating', `التقييم: ${ar(f.rating)}+`);
  if (f.radius !== null) add('radius', `ضمن ${ar(f.radius)} كم`);
  if (f.open) add('open', 'مفتوحة الآن');
  if (f.instant) add('instant', 'حجز فوري');
  for (const key of f.amenities) add(`amenity:${key}`, key);

  return chips;
}

export function countActiveFilters(filters = {}) {
  return buildChips(filters).length;
}

// ----- مدرّج التوزيع السعري -----
// يُبنى من المساحات المفلترة بكل شيء عدا السعر، حتى يوضّح للمستخدم أين تتركّز
// الأسعار قبل أن يختار نطاقاً (يمنع اختيار نطاق فارغ بالصدفة).
export function priceHistogram(spaces, filters = {}, origin = null, bounds = PRICE_SLIDER) {
  const neutral = filterSpaces(spaces, { ...filters, min: null, max: null }, origin);
  const prices = neutral
    .map((s) => toNumber(s.price_per_hour))
    .filter((p) => p !== null && p > 0);

  const lo = bounds.min;
  const hi = bounds.max;
  const size = (hi - lo) / bounds.buckets;
  const buckets = Array.from({ length: bounds.buckets }, (_, i) => ({
    start: Math.round(lo + size * i),
    end: Math.round(lo + size * (i + 1)),
    count: 0,
  }));

  for (const price of prices) {
    // الأسعار الأعلى من الحد الأعلى تُقصّ إلى آخر حزمة بدل هدرها.
    const index = Math.min(bounds.buckets - 1, Math.max(0, Math.floor((price - lo) / size)));
    buckets[index].count += 1;
  }

  const maxCount = buckets.reduce((max, b) => Math.max(max, b.count), 0);
  return { buckets, maxCount, total: prices.length, lo, hi };
}

// ----- اقتراحات تخفيف القيود عند انعدام النتائج -----
// بدل شاشة "لا نتائج" ميتة، نبيّن أي بُعد واحد تسبّب في التقليص، ونعرض زراً
// يزيله ويذكر عدد النتائج الناتج قبل الضغط.
export function suggestRelaxations(spaces, filters = {}, origin = null, limit = 3) {
  const base = { ...DEFAULT_FILTERS, ...filters, amenities: toList(filters.amenities) };
  const suggestions = [];

  const candidate = (id, label, patch) => {
    const next = { ...base, ...patch };
    const count = filterSpaces(spaces, next, origin).length;
    if (count > 0) suggestions.push({ id, label, patch, count });
  };

  if (base.max !== null) {
    // نرفع السقف إلى قيمة ذات معنى (×١٫٥ مقرّبة لأقرب ٥)، ونعرض أيضاً إلغاؤه كلياً.
    const raised = Math.ceil((base.max * 1.5) / 5) * 5;
    candidate('raise_max', `رفع الحد الأعلى للسعر إلى ${ar(raised)}`, { max: raised });
    candidate('clear_price', 'إزالة حد السعر', { min: null, max: null });
  }
  if (base.min !== null) {
    candidate('clear_price', 'إزالة حد السعر', { min: null, max: null });
  }
  if (base.cap !== null) {
    const halved = Math.floor(base.cap / 2);
    candidate('halve_cap', `تخفيض السعة إلى ${ar(halved)}+`, { cap: halved });
    candidate('clear_cap', 'إزالة حد السعة', { cap: null });
  }
  if (base.rating !== null) {
    const lower = Math.max(0, Math.round((base.rating - 0.5) * 2) / 2);
    candidate('lower_rating', `تخفيض التقييم إلى ${ar(lower)}+`, { rating: lower });
    candidate('clear_rating', 'إزالة حد التقييم', { rating: null });
  }
  if (base.amenities.length) {
    candidate('drop_amenities', 'إزالة كل السمات', { amenities: [] });
  }
  if (base.category) {
    candidate('clear_category', 'إزالة الفئة', { category: '' });
  }
  if (base.radius !== null) {
    const wider = Math.min(25, base.radius * 2);
    candidate('widen_radius', `توسيع النطاق إلى ${ar(wider)} كم`, { radius: wider });
  }
  if (base.open) candidate('drop_open', 'إزالة «مفتوحة الآن»', { open: false });
  if (base.instant) candidate('drop_instant', 'إزالة «حجز فوري»', { instant: false });
  if (base.q) candidate('clear_q', 'مسح البحث', { q: '' });

  // الأكثر نتائج أولاً، ثم الأقصر وصفاًً عند التساوي.
  return suggestions
    .sort((a, b) => b.count - a.count || a.label.length - b.label.length)
    .slice(0, limit);
}

// ----- رياضيات الحجز -----
// خانات زمنية بالساعة من open_time إلى close_time، بخطوة ١ ساعة.
export function hourSlots(space, stepHours = 1) {
  const open = minutesOf(space?.open_time);
  const close = minutesOf(space?.close_time);
  if (open === null || close === null) return [];
  const slots = [];
  // نافذة عابرة لمنتصف الليل: نمرّ عبر ٢٤ ساعة بدل التوقف عند close < open.
  const limit = close > open ? close : close + 1440;
  for (let t = open; t + stepHours * 60 <= limit; t += stepHours * 60) {
    slots.push(formatClock(t));
  }
  return slots;
}

// إجمالي الحجز = السعر بالساعة × عدد الساعات.
export function bookingTotal(space, hours) {
  const price = toNumber(space?.price_per_hour) ?? 0;
  const h = toNumber(hours) ?? 0;
  return Math.round(price * h);
}

// يتحقّق من صحّة الموعد: داخل ساعات العمل، بطول موجب، وغير ماضٍ.
export function validateBookingSlot(space, { date, timeFrom, hours, today = new Date() } = {}) {
  if (!space) return 'تعذّر العثور على المساحة.';
  if (!date) return 'اختر تاريخ الحجز.';
  if (!timeFrom) return 'اختر وقت البدء.';

  const start = minutesOf(timeFrom);
  if (start === null) return 'وقت البدء غير صالح.';

  const open = minutesOf(space.open_time);
  const close = minutesOf(space.close_time);
  const length = toNumber(hours) ?? 0;
  if (length <= 0) return 'مدة الحجز يجب أن تكون ساعة واحدة على الأقل.';
  if (open !== null && close !== null) {
    const limit = close > open ? close : close + 1440;
    if (start < open || start + length * 60 > limit) {
      return 'الموعد خارج ساعات عمل المساحة.';
    }
  }

  const day = String(date).slice(0, 10);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (day && day < todayKey) return 'التاريخ المحدد في الماضي.';

  return null;
}

// ----- الربط مع عنوان URL -----
// عنوان URL هو المصدر الوحيد للحالة، فيحصل المستخدم على رابط قابل للمشاركة
// ويعمل زر الرجوع/التقدّم بلا حالة إضافية متزامنة.
export function parseFilters(params) {
  const get = (k) => (params && typeof params.get === 'function' ? params.get(k) : null);
  const sort = get('sort');
  return {
    q: get('q') || '',
    sort: SORT_OPTIONS[sort] ? sort : DEFAULT_SORT,
    min: toNumber(get('min')),
    max: toNumber(get('max')),
    cap: toNumber(get('cap')),
    radius: toNumber(get('radius')),
    amenities: toList(get('amenities')),
    category: get('category') || '',
    rating: toNumber(get('rating')),
    open: toBool(get('open')),
    instant: toBool(get('instant')),
  };
}

// يبني معاملات نظيفة: القيم الافتراضية لا تُكتب أصلاً في الرابط.
export function filtersToQuery(filters = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters, amenities: toList(filters.amenities) };
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.sort && f.sort !== DEFAULT_SORT) params.set('sort', f.sort);
  if (f.min !== null) params.set('min', String(f.min));
  if (f.max !== null) params.set('max', String(f.max));
  if (f.cap !== null) params.set('cap', String(f.cap));
  if (f.radius !== null) params.set('radius', String(f.radius));
  if (f.amenities.length) params.set('amenities', f.amenities.join(','));
  if (f.category) params.set('category', f.category);
  if (f.rating !== null) params.set('rating', String(f.rating));
  if (f.open) params.set('open', '1');
  if (f.instant) params.set('instant', '1');
  return params;
}

// تقييم فلاتر متوافق: نفس البُعد لا يتعارض مع نفسه (min > max ⇒ يُلغى 둘هما).
export function normalizeFilters(filters = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters, amenities: toList(filters.amenities) };
  if (f.min !== null && f.max !== null && f.min > f.max) {
    f.min = null;
    f.max = null;
  }
  if (!SORT_OPTIONS[f.sort]) f.sort = DEFAULT_SORT;
  return f;
}

export { RATING_TIERS, DEFAULT_ORIGIN, PRICE_SLIDER };
