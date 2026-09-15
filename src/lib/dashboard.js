// وحدة بيانات لوحة المستخدم — تتواصل مع الباك إند الحقيقي (Laravel).
//
// كل نقطة استدعاء هنا تقابل نقطة من /api.txt:
//   - GET api/dashboard/stats
//   - GET api/dashboard/upcoming-booking
//   - GET api/dashboard/bookings
//   - GET api/dashboard/favorites
//   - GET api/dashboard/spaces

import { request, imageUrl } from './api';
import { userDetails, getProfile, getUser } from './authStore';

// ----- أدوات مساعدة لفك غلاف الاستجابات (Laravel يغلّف أحياناً) -----

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
    for (const key of ['name', 'email', 'phone', 'role', 'picture', 'profile_picture_url', 'photo', 'avatar', 'image']) {
      if (!out[key] && src[key]) out[key] = src[key];
    }
  }
  return out;
}

// ----- محوّل بين حقول الباك إند وحقول الواجهة الحالية -----
function mapBookings(rows = []) {
  return rows.map((b) => ({
    id: b.booking_id ?? b.id,
    spaceName: b.space_name ?? b.title ?? '',
    image: imageUrl(b.image) || '',
    date: b.date || b.booking_date || '',
    time: b.time_from && b.time_to ? `${b.time_from} – ${b.time_to}` : (b.time || ''),
    hours: b.hours || 0,
    price: b.price || b.cost || 0,
    status: b.status || 'pending',
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

// جلب بيانات لوحة التحكم بالكامل (بالتوازي) ودمجها مع الملف الشخصي.
export async function fetchDashboard() {
  const [stats, bookings, favorites, detailsApi, profileApi] = await Promise.all([
    request('/api/dashboard/stats', { method: 'GET', auth: true }).catch(() => null),
    request('/api/dashboard/upcoming-booking', { method: 'GET', auth: true }).catch(() => null),
    request('/api/dashboard/favorites', { method: 'GET', auth: true }).catch(() => null),
    userDetails().catch(() => null),
    getProfile().catch(() => null),
  ]);

  // صيغة الإرجاع: في حال كانت الاستجابة كائناً يحوي قائمة، نفكّكها.
  // قد يعيد الباك إند كائناً واحداً (upcoming-booking) بدل قائمة — نحوّله لقائمة.
  const list = (res, key) => {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    if (res[key] && Array.isArray(res[key])) return res[key];
    if (res.data && Array.isArray(res.data)) return res.data;
    if (res.data?.[key] && Array.isArray(res.data[key])) return res.data[key];
    // كائن حجز/مساحة واحد مباشر (يحوي حقول بيانات وليس قائمة) => نغلّفه.
    const looksLikeItem = 'id' in res || 'booking_id' in res || 'space_id' in res || 'title' in res;
    return looksLikeItem ? [res] : [];
  };

  const s = stats || {};
  const localUser = getUser() || {};

  // المستخدم: نجمع من واجهتي بيانات (case: إحداهما قد لا تكون مطبَّقة) مع
  // المستخدم المخزّن محلياً من لحظة تسجيل الدخول على أن يكون الملاذ الأخير.
  const u = pickUser(unwrapUser(detailsApi), unwrapUser(profileApi), localUser);

  // الصورة: نفضّل رابط الصورة من أي مصدر، ونحوّله لرابط كامل إن كان نسبياً.
  const rawPhoto = pickPhoto(detailsApi, profileApi, localUser);
  const photo = rawPhoto ? imageUrl(rawPhoto) : null;

  // الدور: الباك إند قد يعيد space_owner بينما الواجهة تعرضه كـ owner.
  const rawRole = u.role || localUser.role || 'customer';
  const role = rawRole === 'space_owner' ? 'owner' : rawRole;

  return {
    user: {
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role,
      photo,
    },
    stats: {
      upcomingBookings: s.upcoming_bookings_count ?? s.total_bookings_count ?? 0,
      hoursThisMonth: s.total_hours ?? 0,
      savedFavorites: s.favorite_spaces_count ?? s.total_favorites ?? 0,
      hoursSpentThisMonth: s.booked_hours_this_month ?? 0,
    },
    bookings: mapBookings(list(bookings, 'bookings')),
    favorites: mapFavorites(list(favorites, 'favorites')),
    ads: [],
  };
}

// يبحث عن حقل الصورة في أي صيغة استجابة (مباشرة أو مغلّفة).
function pickPhoto(...sources) {
  for (const src of sources) {
    const u = unwrapUser(src);
    for (const key of ['picture', 'profile_picture_url', 'photo', 'avatar', 'image']) {
      if (u[key]) return u[key];
    }
  }
  return null;
}

// تصفّح المساحات (صفحات) — GET api/dashboard/spaces (paginate)
export async function fetchSpaces(page = 1) {
  const res = await request(`/api/dashboard/spaces?page=${page}`, { method: 'GET', auth: true });
  // Laravel paginator يعيد { data: [...] }، وقد تُغلَّف النتيجة أحياناً في res.data مرة أخرى.
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