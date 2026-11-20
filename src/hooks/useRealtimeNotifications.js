// الاشتراك في إشعارات الحجز الفورية + نافذة جانبية مؤقتة لمدة ثانيتين.
// إن تعذّر البث (غياب الإعداد أو فشل تفويض القناة) ننتقل إلى استطلاع هادئ
// لقائمة /api/notifications — بدون أي إشعار أو حجز مُختلَق محلياً.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getUser, normalizeRole } from '@/lib/authStore';
import { loadNotificationsWithFallback, mapNotification, notificationIntent } from '@/lib/notifications';
import { isRealtimeConfigured, subscribeToNotifications } from '@/lib/realtime';
import { playChime, unlockChime } from '@/lib/chime';

const POLL_MS = 15_000;
const MAX_TOASTS = 3;
const TOAST_MS = 2_000;

export default function useRealtimeNotifications() {
  const [toasts, setToasts] = useState([]);
  const seenRef = useRef(new Set());
  const timersRef = useRef([]);
  const mountedAtRef = useRef(0);
  const { pathname } = useLocation();

  const dismiss = useCallback((key) => {
    setToasts((prev) => prev.filter((toast) => toast.key !== key));
  }, []);

  const emit = useCallback((raw) => {
    const item = mapNotification(raw);
    const key = String(item.id ?? item.bookingId ?? `${item.type}-${item.created_at}`);
    if (!key || seenRef.current.has(key)) return;

    // تجاهل الأحداث القديمة حتى لا تُعاد النوافذ بعد إعادة الاتصال أو التحديث.
    if (item.created_at) {
      const created = Date.parse(String(item.created_at).replace(' ', 'T'));
      if (Number.isFinite(created) && created < mountedAtRef.current - 60_000) return;
    }

    seenRef.current.add(key);
    if (!notificationIntent(item).isBooking) return;

    playChime();
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { ...item, key }]);
    const timer = window.setTimeout(() => {
      dismiss(key);
      timersRef.current = timersRef.current.filter((id) => id !== timer);
    }, TOAST_MS);
    timersRef.current.push(timer);
  }, [dismiss]);

  // إعادة تقييم المستخدم عند كل تغيير مسار (تسجيل دخول/خروج) دون اعتماد
  // على حالة جلسة تفاعلية منفصلة.
  useEffect(() => {
    const user = getUser();
    if (!user) return undefined;
    const role = normalizeRole(user.role);
    const userId = user.id;
    if (!userId || (role !== 'space_owner' && role !== 'owner' && role !== 'customer')) return undefined;

    mountedAtRef.current = Date.now();
    seenRef.current = new Set();
    const cleanupGesture = unlockChime();

    let disposed = false;
    let unsubscribe = () => {};
    let connected = false;
    let polling = false;
    let pollTimer = null;
    let safetyTimer = null;

    const startPolling = () => {
      if (disposed || polling || connected) return;
      polling = true;
      let initialized = false;
      const check = async () => {
        if (document.visibilityState !== 'visible') return;
        const result = await loadNotificationsWithFallback();
        if (result.error) return;
        const list = result.notifications || [];
        if (!initialized) {
          list.forEach((n) => { if (n.id != null) seenRef.current.add(String(n.id)); });
          initialized = true;
          return;
        }
        list.forEach((n) => {
          if (n.id != null && !seenRef.current.has(String(n.id))) emit(n);
        });
      };
      check();
      pollTimer = window.setInterval(check, POLL_MS);
    };

    if (isRealtimeConfigured()) {
      safetyTimer = window.setTimeout(startPolling, 5000);
      subscribeToNotifications({
        role,
        userId,
        onEvent: emit,
        onReady: () => {
          connected = true;
          if (safetyTimer) window.clearTimeout(safetyTimer);
          if (pollTimer) window.clearInterval(pollTimer);
        },
        onError: () => {
          connected = false;
          if (pollTimer) window.clearInterval(pollTimer);
          pollTimer = null;
          startPolling();
        },
      })
        .then((fn) => {
          if (disposed) fn();
          else unsubscribe = fn;
        })
        .catch(startPolling);
    } else {
      startPolling();
    }

    return () => {
      disposed = true;
      if (safetyTimer) window.clearTimeout(safetyTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      unsubscribe();
      cleanupGesture();
    };
  }, [pathname, emit]);

  return { toasts, dismiss };
}
