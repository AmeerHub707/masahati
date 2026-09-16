// وحدة بيانات لوحة المستخدم — تتواصل مع الباك إند الحقيقي (Laravel).
//
// كل نقطة استدعاء هنا تقابل نقطة من /api.txt:
//   - GET api/profile
//   - GET api/dashboard/stats
//   - GET api/dashboard/upcoming-booking
//   - GET api/dashboard/bookings
//   - GET api/dashboard/favorites
//   - POST api/dashboard/favorites/toggle
//   - GET api/dashboard/spaces

import { request, imageUrl } from './api';
import { getUser } from './authStore';

// مؤقت لبيانات لوحة التحكم: كان 8s يقطع الطلبات أثناء cold start (قياس فعلي:
// profile ~8.4s و stats ~11.1s بالتوازي بعد توقف Render). 15s يوازن بين
// فشل سريع وعدم قطع استجابات بطيئة فعلية. (المهلة العمومية في api.js هي 25s.)
const DASH_TIMEOUT_MS = 15000;
const DASH_CACHE_KEY = 'masahati_dashboard_cache';

// ----- ذاكرة تخزين لوحة التحكم -----
// تُستخدم لعرض البيانات فوراً عند الرجوع للوحة (بدل إعادة تحميل كل شيء)
// مع تحديث الخلفية عند توفر استجابة جديدة.
export function readDashboardCache() {
  try {
    const raw = localStorage.getItem(DASH_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function clearDashboardCache() {
  try {
    localStorage.removeItem(DASH_CACHE_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

export function writeDashboardCache(payload) {
  try {
    localStorage.setItem(DASH_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* التخزين غير متاح */
  }
}

// يقبل أي صيغة: { user: {...} } أو { data: {...} } أو { data: { user: {...} } }
// أو الكائن نفسه، ويعيد أعمق كائن مستخدم/بيانات.
function unwrapUser(res) {
  if (!res || typeof res !== 'object') return {};
  let cur = res;
  if (cur.user && typeof cur.user === 'object') cur = cur.user;
  if (cur.data && typeof cur.data === 'object') cur = cur.data;
  if (cur.user && typeof cur.user === 'object') cur = cur.user;
  return cur || {};
}

// دمج مصدرين بحيث يُفضَّل غير الفارغ من الأول ثم الثاني.
function pickUser(...sources) {
  const out = {};
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of ['name', 'email', 'phone', 'role', 'picture', 'photo']) {
      if (!out[key] && src[key]) out[key] = src[key];
    }
  }
  return out;
}

// ----- محوّل الحجوزات -----
// يدعم كلا الشكلين:
//   - upcoming: { title, image, date, time }
//   - history:  { booking_id, space_name, image, date, time_from, time_to, status }
function mapBookings(rows = []) {
  return rows.map((b) => ({
    id: b.booking_id ?? b.id,
    spaceName: b.space_name ?? b.title ?? '',
    image: imageUrl(b.image) || '',
    date: b.date || '',
    time: b.time_from && b.time_to ? `${b.time_from} – ${b.time_to}` : (b.time || ''),
    hours: b.hours || 0,
    price: b.price || b.cost || 0,
    status: b.status || (b.time_from ? 'confirmed' : 'pending'),
  }));
}

function mapFavorites(rows = []) {
  return rows.map((f) => ({
    id: f.space_id ?? f.id,
    name: f.title ?? f.name ?? '',
    image: imageUrl(f.image) || '',
    rating: f.rating ?? 0,
    location: f.location || '',
    pricePerHour: f.price ?? f.price_per_hour ?? 0,
    power: f.power ?? f.has_power ?? f.electricity ?? null,
    internet: f.internet ?? f.has_internet ?? f.wifi ?? null,
  }));
}

// يفكّك قائمة من استجابة قد تكون { key: [...] } أو { data: [...] } أو مصفوفة مباشرة،
// أو كائناً واحداً (upcoming-booking) نحوّله لقائمة من عنصر واحد.
function listOf(res, key) {
  if (Array.isArray(res)) return res;
  if (!res || typeof res !== 'object') return [];
  if (res[key] && Array.isArray(res[key])) return res[key];
  if (res.data && Array.isArray(res.data)) return res.data;
  if (res.data?.[key] && Array.isArray(res.data[key])) return res.data[key];
  const looksLikeItem = 'id' in res || 'booking_id' in res || 'space_id' in res || 'title' in res;
  return looksLikeItem ? [res] : [];
}

// جلب بيانات لوحة التحكم بالكامل (بالتوازي) ودمجها مع الملف الشخصي.
export async function fetchDashboard() {
  const [stats, upcomingApi, historyApi, favoritesApi, profileApi] = await Promise.all([
    request('/api/dashboard/stats', { method: 'GET', auth: true, timeoutMs: DASH_TIMEOUT_MS }).catch(() => null),
    request('/api/dashboard/upcoming-booking', { method: 'GET', auth: true, timeoutMs: DASH_TIMEOUT_MS }).catch(() => null),
    request('/api/dashboard/bookings', { method: 'GET', auth: true, timeoutMs: DASH_TIMEOUT_MS }).catch(() => null),
    request('/api/dashboard/favorites', { method: 'GET', auth: true, timeoutMs: DASH_TIMEOUT_MS }).catch(() => null),
    request('/api/profile', { method: 'GET', auth: true, timeoutMs: DASH_TIMEOUT_MS }).catch(() => null),
  ]);

  const s = stats || {};
  const localUser = getUser() || {};

  // المستخدم: /api/profile (name, phone, email, picture) هو المصدر الأساسي،
  // مع المستخدم المخزّن محلياً من لحظة تسجيل الدخول كملاذ أخير (يحمل role).
  const u = pickUser(unwrapUser(profileApi), localUser);

  // الصورة من أي مصدر حتى لو لم تُطبَّق واجهة profile بعد.
  const rawPhoto = pickPhoto(profileApi, localUser) || localStorage.getItem('profile_picture_url');
  const photo = rawPhoto ? imageUrl(rawPhoto) : null;

  const rawRole = u.role || localUser.role || 'customer';
  const role = rawRole === 'space_owner' ? 'owner' : rawRole;

  const result = {
    user: {
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role,
      photo,
    },
    stats: {
      upcomingBookings: s.upcoming_bookings_count ?? 0,
      hoursThisMonth: s.total_hours ?? 0,
      savedFavorites: s.favorite_spaces_count ?? 0,
      hoursSpentThisMonth: s.booked_hours_this_month ?? 0,
    },
    upcoming: mapBookings(listOf(upcomingApi, 'bookings')),
    bookings: mapBookings(listOf(historyApi, 'bookings')),
    favorites: mapFavorites(listOf(favoritesApi, 'favorites')),
    ads: [],
  };

  // حفظ نسخة للعرض الفوري عند الرجوع للوحة (تُحدَّث في الخلفية لاحقاً).
  writeDashboardCache(result);
  return result;
}

// كل المفاتيح التي قد يُرجعها الباك إند لحقل صورة المستخدم.
const PHOTO_KEYS = ['profile_picture_url', 'profile_picture', 'picture', 'photo', 'photo_url', 'avatar', 'image', 'url'];

// يبحث عن حقل الصورة في أي صيغة استجابة (مباشرة أو مغلّفة أو في الجذر).
function pickPhoto(...sources) {
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    const candidates = [unwrapUser(src), src];
    for (const obj of candidates) {
      if (!obj || typeof obj !== 'object') continue;
      for (const key of PHOTO_KEYS) {
        if (obj[key]) return obj[key];
      }
    }
  }
  return null;
}

// تبديل المساحة في المفضّلة — POST api/dashboard/favorites/toggle { space_id }
// يعيد { message, is_favorited }.
export async function toggleFavorite(spaceId) {
  const res = await request('/api/dashboard/favorites/toggle', {
    method: 'POST',
    auth: true,
    body: { space_id: spaceId },
  });
  const isFavorited = typeof res?.is_favorited === 'boolean'
    ? res.is_favorited
    : typeof res?.data?.is_favorited === 'boolean' ? res.data.is_favorited : null;
  return { message: res?.message || '', isFavorited };
}

// تصفّح المساحات (صفحات) — GET api/dashboard/spaces (paginate)
export async function fetchSpaces(page = 1) {
  const res = await request(`/api/dashboard/spaces?page=${page}`, { method: 'GET', auth: true });
  // Laravel paginator يعيد { data: [...] } وقد تُغلَّف النتيجة أحياناً في res.data مرة أخرى.
  const rawItems = res?.data?.data || res?.data || res?.spaces || [];
  const items = Array.isArray(rawItems) ? rawItems : [];
  return {
    spaces: items.map((sp) => ({
      id: sp.space_id ?? sp.id,
      title: sp.title ?? '',
      description: sp.description || '',
      location: sp.location || '',
      image: imageUrl(sp.image) || '',
    })),
    current_page: res?.current_page ?? res?.data?.current_page ?? page,
    last_page: res?.last_page ?? res?.data?.last_page ?? 1,
    has_more: res?.has_more ?? res?.data?.has_more ?? false,
  };
}

// إلغاء حجز — ملاحظة: نقطة /api.txt لا تدرج نقطة إلغاء حجز، تُترك كـ placeholder.
export async function cancelBooking(bookingId) {
  await new Promise((r) => setTimeout(r, 250));
  return { ok: true, id: bookingId };
}