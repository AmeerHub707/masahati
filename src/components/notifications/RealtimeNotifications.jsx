import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import useRealtimeNotifications from '@/hooks/useRealtimeNotifications';
import { notificationIntent } from '@/lib/notifications';
import { getUser, normalizeRole } from '@/lib/authStore';

// نافذة جانبية واحدة لكل المستخدمين، تظهر فوق أي صفحة. التوجيه يستخدم نفس
// دالة notificationIntent المستعملة في لوحة الإشعارات — لا منطق مزدوج.
export default function RealtimeNotifications() {
  const { toasts, dismiss } = useRealtimeNotifications();
  const navigate = useNavigate();
  const { t } = useTranslation('notifications');

  const openToast = (item) => {
    const intent = notificationIntent(item);
    const role = normalizeRole(getUser()?.role);
    const isOwner = role === 'space_owner' || role === 'owner';
    const safeLink = intent.link.startsWith('/') && !intent.link.startsWith('//') ? intent.link : '';

    if (isOwner) {
      if (safeLink && safeLink.includes('/dashboard/space-owner')) navigate(safeLink);
      // لوحة المالك تستخدم حالة داخلية للتبويبات؛ نخبرها عبر حدث مخصص.
      window.dispatchEvent(new CustomEvent('masahati:owner-tab', { detail: 'bookings' }));
    } else if (safeLink) {
      navigate(safeLink);
    } else if (intent.spaceId) {
      navigate(`/ads/${encodeURIComponent(intent.spaceId)}`);
    }
    dismiss(item.key);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="rt-toast-stack" role="region" aria-label={t('region')} aria-live="polite">
      {toasts.map((item) => (
        <button
          key={item.key}
          type="button"
          className="rt-toast"
          onClick={() => openToast(item)}
          title={t('open')}
        >
          <span className="rt-toast__icon"><Bell size={18} /></span>
          <span className="rt-toast__body">
            <strong>{item.title || t('newBooking')}</strong>
            <span>{item.text}</span>
          </span>
          <span className="rt-toast__timer" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
