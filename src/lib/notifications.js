// وحدة إشعارات: تتصل بالباك إند الحقيقي عبر /api/notifications،
// ومع أي فشل تنتقل لوضع تجريبي يشتق الإشعارات من مخزن الطلبات المحلي
// (عرض جديد / قبول / رفض / إغلاق) حتى لا تكسر التجربة قبل نزول الواجهة.

import { request } from './api';
import { isSpecialRequestsDemo } from './requests';

const REQ_TIMEOUT_MS = 8000;

const DEMO_FLAG_KEY = 'masahati_notifications_demo_v1';
const READ_FLAG_KEY = 'masahati_notifications_read_v1';
const REQ_DATA_KEY = 'masahati_special_requests_data_v1';

export function isNotificationsDemo() {
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

function wasMarkedRead() {
  try {
    return localStorage.getItem(READ_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function markReadFlag() {
  try {
    localStorage.setItem(READ_FLAG_KEY, '1');
  } catch {
    /* التخزين غير متاح */
  }
}

function readRequestStore() {
  try {
    const raw = localStorage.getItem(REQ_DATA_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && Array.isArray(data.requests) ? data.requests : null;
  } catch {
    return null;
  }
}

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

// مفاتيح أيقونات نصية تُرسم بواسطة المكوّن المقابل في لوحة التحكم.
let seq = 100;
function mkNotif({ text, time, read, icon }) {
  seq += 1;
  return { id: seq, text, time, read, icon: icon || 'bell' };
}

function seedNotifications() {
  const allRead = wasMarkedRead();
  return [
    mkNotif({ text: 'تم تأكيد حجزك لمساحة "قاعة الاجتماعات"', time: 'منذ 5 دقائق', read: allRead, icon: 'check' }),
    mkNotif({ text: 'تنتهي صلاحية حجزك غداً', time: 'منذ 3 ساعات', read: true, icon: 'clock' }),
  ];
}

// ----- إشعارات تجريبية مشتقة من مخزن الطلبات -----
export function deriveLocalNotifications() {
  const reqs = readRequestStore() || [];
  const allRead = wasMarkedRead();
  const list = [];

  for (const r of reqs) {
    const title = `«${r.title || 'طلب خاص'}»`;

    if (r.status === 'open' && Number(r.offers_count || 0) > 0) {
      list.push(
        mkNotif({
          text: `عرض جديد على طلبك ${title}`,
          time: fmtTime(r.created_at),
          read: allRead,
          icon: 'offer',
        })
      );
    }
    const acceptedOffer = (r.offers || []).find((o) => o.status === 'accepted');
    if (acceptedOffer) {
      list.push(
        mkNotif({
          text: `تم قبول عرض «${acceptedOffer.space_name || 'المساحة'}» على طلبك ${title}`,
          time: fmtTime(acceptedOffer.created_at),
          read: allRead,
          icon: 'accepted',
        })
      );
    }
    const rejectedOffer = (r.offers || []).find((o) => o.status === 'rejected');
    if (rejectedOffer) {
      list.push(
        mkNotif({
          text: `تم رفض عرض «${rejectedOffer.space_name || 'المساحة'}» على طلبك ${title}`,
          time: fmtTime(rejectedOffer.created_at),
          read: allRead,
          icon: 'rejected',
        })
      );
    }
    if (r.status === 'accepted' || r.status === 'closed') {
      list.push(
        mkNotif({
          text: `أُغلق طلبك ${title} بعد القبول`,
          time: fmtTime(r.created_at),
          read: allRead,
          icon: 'close',
        })
      );
    }
  }

  return list.length ? list : seedNotifications();
}

function mapNotif(n) {
  return {
    id: n.id ?? n.notification_id,
    text: n.text ?? n.message ?? '',
    time: n.time ?? fmtTime(n.created_at),
    read: Boolean(n.read),
    icon: 'bell',
    created_at: n.created_at ?? '',
  };
}

function listOf(res) {
  if (Array.isArray(res)) return res;
  if (!res || typeof res !== 'object') return [];
  if (res.notifications && Array.isArray(res.notifications)) return res.notifications;
  if (res.data && Array.isArray(res.data)) return res.data;
  if (res.data?.notifications && Array.isArray(res.data.notifications)) return res.data.notifications;
  return [];
}

// ---- API حقيقي ----
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
    method: 'PATCH',
    auth: true,
    timeoutMs: REQ_TIMEOUT_MS,
  });
  return res?.message || 'تم تحديث الإشعارات.';
}

// ---- واجهة التطبيق (API → تجريبي) ----
// إن كان وضع الطلبات التجريبي مفعّلاً، الإشعارات تُشتق محلياً من المخزن
// مباشرة (أسرع وأكثر اتساقاً مع ما يراه المستخدم). وإلا نجرّب الخادم أولاً.
export async function loadNotificationsWithFallback(force = false) {
  if (isSpecialRequestsDemo() && !force) {
    return { demo: true, notifications: deriveLocalNotifications() };
  }
  try {
    const notifications = await fetchNotifications();
    setDemoFlag(false);
    return { demo: false, notifications };
  } catch {
    setDemoFlag(true);
    return { demo: true, notifications: deriveLocalNotifications() };
  }
}

export async function markAllNotificationsReadWithFallback() {
  markReadFlag();
  if (isNotificationsDemo()) {
    return { demo: true, message: 'تم تحديث الإشعارات (وضع تجريبي).' };
  }
  try {
    const message = await markNotificationsRead();
    setDemoFlag(false);
    return { demo: false, message };
  } catch {
    setDemoFlag(true);
    return { demo: true, message: 'تم تحديث الإشعارات (وضع تجريبي).' };
  }
}