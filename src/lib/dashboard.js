// وحدة بيانات لوحة المستخدم — تتواصل مع الباك إند الحقيقي (Laravel).
//
// كل نقطة استدعاء هنا تقابل نقطة من /api.txt:
//   - GET api/dashboard/stats
//   - GET api/dashboard/upcoming-booking
//   - GET api/dashboard/bookings
//   - GET api/dashboard/favorites
//   - GET api/dashboard/spaces

import { request } from './api';
import { getProfile } from './authStore';

// محوّل بين حقول الباك إند وحقول الواجهة الحالية
function mapBookings(rows = []) {
  return rows.map((b) => ({
    id: b.booking_id ?? b.id,
    spaceName: b.space_name ?? b.title ?? '',
    image: b.image || '',
    date: b.date || '',
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
    image: f.image || '',
    rating: f.rating ?? 0,
    location: f.location || '',
    pricePerHour: f.price ?? f.price_per_hour ?? 0,
    power: f.power ?? f.has_power ?? f.electricity ?? null,
    internet: f.internet ?? f.has_internet ?? f.wifi ?? null,
  }));
}

// جلب بيانات لوحة التحكم بالكامل (بالتوازي) ودمجها مع الملف الشخصي.
export async function fetchDashboard() {
  const [stats, bookings, favorites, profile] = await Promise.all([
    request('/api/dashboard/stats', { method: 'GET', auth: true }).catch(() => null),
    request('/api/dashboard/upcoming-booking', { method: 'GET', auth: true }).catch(() => null),
    request('/api/dashboard/favorites', { method: 'GET', auth: true }).catch(() => null),
    getProfile().catch(() => null),
  ]);

  // صيغة الإرجاع: في حال كانت الاستجابة كائناً يحوي قائمة، نفكّكها.
  const list = (res, key) => (Array.isArray(res) ? res : res?.[key] ?? []);

  const s = stats || {};
  const user = profile || {};

  return {
    user: {
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'customer',
      photo: user.picture || user.profile_picture_url || user.photo || null,
    },
    stats: {
      upcomingBookings: s.upcoming_bookings_count ?? 0,
      hoursThisMonth: s.total_hours ?? 0,
      savedFavorites: s.favorite_spaces_count ?? 0,
      hoursSpentThisMonth: s.booked_hours_this_month ?? 0,
    },
    bookings: mapBookings(list(bookings, 'bookings')),
    favorites: mapFavorites(list(favorites, 'favorites')),
    ads: [],
  };
}

// تصفّح المساحات (صفحات) — GET api/dashboard/spaces (paginate)
export async function fetchSpaces(page = 1) {
  const res = await request(`/api/dashboard/spaces?page=${page}`, { method: 'GET', auth: true });
  return {
    spaces: (res?.data || res?.spaces || []).map((sp) => ({
      id: sp.space_id ?? sp.id,
      title: sp.title ?? '',
      description: sp.description || '',
      location: sp.location || '',
      image: sp.image || '',
    })),
    current_page: res?.current_page ?? page,
    last_page: res?.last_page ?? 1,
    has_more: res?.has_more ?? false,
  };
}

// إلغاء حجز — ملاحظة: نقطة /api.txt لا تدرج نقطة إلغاء حجز، تُترك كـ placeholder.
export async function cancelBooking(bookingId) {
  await new Promise((r) => setTimeout(r, 250));
  return { ok: true, id: bookingId };
}

