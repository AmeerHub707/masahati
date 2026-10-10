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