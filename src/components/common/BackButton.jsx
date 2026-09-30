import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * زر الرجوع الموحّد لكل الصفحات (عدا صفحة الهبوط).
 *
 * السلوك: يعود.step للخلف في سجل المتصفح متى وُجد تاريخ داخل التطبيق،
 * وإلا — فتح الرابط مباشرةً في تبويب جديد مثلاً — ينتقل إلى `fallback`
 * حتى لا يقود الزر إلى صفحة ميتة أو يستمر في التراجع خارج التطبيق.
 *
 * الفهرس `idx` يكتبه react-router داخل history.state لكل خطوة تنقّل،
 * فصفره يعني: لا يوجد داخل التطبيق ما نرجع إليه.
 */
export default function BackButton({
  fallback = '/',
  label = 'رجوع',
  ariaLabel = 'العودة إلى الصفحة السابقة',
  className = '',
  ...rest
}) {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (e) => {
      e.preventDefault();
      const idx = typeof window !== 'undefined' ? window.history.state?.idx : undefined;
      if (typeof idx === 'number' && idx > 0) navigate(-1);
      else navigate(fallback, { replace: true });
    },
    [navigate, fallback]
  );

  return (
    <button type="button" className={className} onClick={handleClick} aria-label={ariaLabel} {...rest}>
      <ChevronRight size={18} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
