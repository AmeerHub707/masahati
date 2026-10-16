import { Languages } from 'lucide-react';
import useLanguage from '@/hooks/useLanguage';

// وصف الزرّ بحسب اللغة الهدف (التي سيُبدَّل إليها) لا الحالية:
// في واجهة عربية يعرض «EN» ويطالب بالتبديل إلى الإنجليزية، والعكس صحيح.
const TARGET_META = {
  en: { title: 'التبديل إلى الإنجليزية', short: 'EN' },
  ar: { title: 'Switch to Arabic', short: 'ع' },
};

/**
 * مبدّل اللغة — يعرض اللغة المتاحة لا الحالية، ويأخذ نفس هيئة زرّ الثيم
 * (dash__theme-btn) مع عرض أوسع قليلاً ليتّسع لرمز اللغة.
 */
export default function LanguageToggle({ className = '' }) {
  const { lang, toggle } = useLanguage();
  const target = lang === 'en' ? 'ar' : 'en';
  const meta = TARGET_META[target];

  return (
    <button
      type="button"
      className={`dash__theme-btn lang-toggle${className ? ` ${className}` : ''}`}
      onClick={toggle}
      aria-label={meta.title}
      title={meta.title}
      lang={target}
    >
      <Languages aria-hidden="true" />
      <b className="lang-toggle__code" aria-hidden="true">{meta.short}</b>
    </button>
  );
}
