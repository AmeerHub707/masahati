import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut } from 'lucide-react';
import { useDialogA11y } from '../../lib/dialogA11y';

// بعد هذه المدة نُعلم المستخدم أن العملية قد تتأخر، بدل صمت مربك.
const SLOW_AFTER_MS = 6000;

// محتوى الشاشة: يُركَّب فقط أثناء تسجيل الخروج، فتُصفَّر حالة «بطيء»
// تلقائياً مع كل عملية جديدة دون إعادة ضبط داخل effect.
function LogoutScreen() {
  const [slow, setSlow] = useState(false);
  // حصر التركيز: Tab يبقى داخل الشاشة، و Escape لا يلغيها (onClose فارغ).
  const overlayRef = useDialogA11y({ open: true, onClose: () => {} });

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={overlayRef}
      className="loading loading--logout"
      role="status"
      aria-live="polite"
      aria-busy="true"
      tabIndex={-1}
    >
      <div className="loading__bg" aria-hidden="true" />
      <div className="loading__glow" aria-hidden="true" />

      <div className="loading__content">
        <div className="loading__logo-card">
          <div className="loading__logo">
            <img src="/Mlogo.jpeg" alt="مساحاتي" />
            <span className="loading__scan" aria-hidden="true" />
          </div>
        </div>

        <p className="loading__brand">مساحاتي</p>
        <p className="loading__sub">
          {slow ? 'الاتصال بطيء — قد تستغرق العملية لحظات إضافية.' : 'جارٍ تسجيل الخروج…'}
        </p>

        {/* شريط غير محدّد: مدة الطلب غير معروفة، فلا نعرض نسبة متخيّلة. */}
        <div className="loading__track" role="progressbar" aria-label="جارٍ إنهاء الجلسة">
          <div className="loading__bar loading__bar--indeterminate" />
        </div>

        <p className="loading__note">
          <LogOut aria-hidden="true" />
          <span>نتطلع لرؤيتك مجددا ...! </span>
        </p>
      </div>
    </div>
  );
}

/**
 * شاشة تغطي الصفحة بالكامل أثناء تسجيل الخروج:
 *  - تمنع أي تفاعل خلفها: غطاء ثابت + منع التمرير + حصر التركيز داخلها
 *  - تُعرض عبر portal إلى body كي تبقى خارج الشجرة التي نضع عليها inert
 */
export default function LogoutOverlay({ open }) {
  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [open]);

  if (!open) return null;

  return createPortal(<LogoutScreen />, document.body);
}
