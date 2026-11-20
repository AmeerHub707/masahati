// وحدة إشعارات: تتصل بالباك إند الحقيقي عبر /api/notifications.
// القراءات لا ترمي أبداً (تعود {error,...}) والإجراءات ترمي الأخطاء الحقيقية.

import { request } from './api';

const REQ_TIMEOUT_MS = 8000;

function fmtTime(iso) {
  if (!iso) return '';
  const t = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(t.getTime())) return '';
  const diff = Math.max(0, Math.round((Date.now() - t.getTime()) / 3600000));
  if (diff < 1) return 'الآن';
  if (diff < 24) return `منذ ${diff} ساعات`;
  const days = Math.round(diff / 24);
  return days <= 30 ? `منذ ${days} يوم` : `منذ ${Math.round(days / 30)} شهر`;
}

// حقول النص قد تصل string أو number، وقد تكون كائناً (مثل ترجمة). نحوّل
// النصّي فقط حتى لا يظهر «[object Object]» داخل الإشعار.
function asText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function firstText(...values) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return '';
}

// معرّفات الحجز/المساحة قد تكون رقمية أو نصية، وقد تصل داخل data أو مسطّحة.
function firstId(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const id = String(value).trim();
    if (id) return id;
  }
  return null;
}

function firstObject(...values) {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return null;
}

// حالة القراءة تصل boolean أو 0/1 أو "0"/"1"/"true"/"false". استخدام
// Boolean("false") يعطي true، وهو ما كان يجعل كل الإشعارات تبدو مقروءة.
function isReadFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }
  return false;
}

function mapNotif(n) {
  // البث الإداري يصل عادةً بحقلي `title` و`body`، بينما إشعارات الحجز تصل
  // بـ`message` أو `text`. الاقتصار على الأخيرين كان يعرض إشعاراً فارغاً
  // للعميل رغم وصوله، ويحوّل كل الصفوف إلى «غير مقروءة» إن كان الخادم يرسل
  // `is_read` بدل `read`.
  const item = n && typeof n === 'object' ? n : {};
  const data = firstObject(item.data, item.payload, item.meta);
  const title = firstText(item.title, item.subject, item.heading);
  const body = firstText(item.text, item.message, item.body, item.content, item.description);
  const created = item.created_at ?? item.sent_at ?? item.time ?? item.date ?? '';
  return {
    id: item.id ?? item.notification_id ?? item.uuid ?? null,
    title,
    text: body || title,
    time: asText(item.time) || fmtTime(created),
    read: isReadFlag(item.read ?? item.is_read ?? item.seen ?? item.read_at),
    icon: firstText(item.icon, item.type) || 'bell',
    // نحتفظ بنوع الحدث ومعرّفاته: واجهتا العميل والمالك تحتاجها للتوجيه
    // حين لا يرسل الباك إند حقل link جاهزاً.
    type: firstText(item.type, item.event, item.key),
    spaceId: firstId(data?.space_id, data?.spaceId, item.space_id, item.spaceId),
    bookingId: firstId(data?.booking_id, data?.bookingId, item.booking_id, item.bookingId),
    link: firstText(item.link, item.url, item.action_url, data?.link, data?.url),
    created_at: asText(created),
  };
}

// الاستجابة قد تكون مصفوفة، أو `{data:[...]}`, أو `{data:{notifications:[...]}}`,
// أو مغلّف صفحة (`{data:{data:[...]}}`). البحث المتكرر يغطّي كل هذه الأشكال
// بدل إظهار «لا توجد إشعارات» رغم وصولها.
const LIST_KEYS = ['notifications', 'data', 'items', 'results', 'rows', 'list'];

function listOf(res, depth = 0) {
  if (Array.isArray(res)) return res;
  if (!res || typeof res !== 'object' || depth > 4) return [];
  for (const key of LIST_KEYS) {
    const value = res[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = listOf(value, depth + 1);
      if (nested.length) return nested;
    }
  }
  return [];
}

export async function fetchNotifications() {
  const res = await request('/api/notifications', {
    method: 'GET',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return listOf(res).map(mapNotif);
}

export async function markNotificationsRead() {
  const res = await request('/api/notifications/read', {
    method: 'POST',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return res?.message || 'تم تحديث الإشعارات.';
}

// ----- واجهة التطبيق -----
export async function loadNotificationsWithFallback() {
  try {
    const notifications = await fetchNotifications();
    return { error: null, notifications };
  } catch (err) {
    return { error: err?.message || 'تعذّر تحميل الإشعارات', notifications: [] };
  }
}

export async function markAllNotificationsReadWithFallback() {
  try {
    const message = await markNotificationsRead();
    return { error: null, message };
  } catch (err) {
    throw err instanceof Error ? err : new Error(err?.message || 'تعذّر تحديث الإشعارات.');
  }
}

// يفسّر إشعار الحجز بغض النظر عن شكل الحمولة التي يرسلها الباك إند، حتى
// تتمكن كل واجهة من اختيار وجهتها (صفحة المساحة للعميل / الحجوزات للمالك).
export function notificationIntent(n) {
  const type = String(n?.type || '').toLowerCase();
  const text = `${String(n?.title || '')} ${String(n?.text || '')}`.toLowerCase();
  const source = type || text;
  const isBooking = /booking|booked|reservation|accept|reject|confirm|حجز|قبول|رفض/.test(source);
  const isSpace = /space|مساحة|غرفة|استوديو/.test(source) && !isBooking;
  return {
    link: String(n?.link || '').trim(),
    type,
    isBooking,
    isSpace,
    spaceId: n?.spaceId || null,
    bookingId: n?.bookingId || null,
  };
}