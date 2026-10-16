import { useCallback } from 'react';
import { useTranslation } from '@/hooks/useT';
import { isRtlLang, SUPPORTED, DEFAULT_LANG } from '@/i18n';

/**
 * خطّاف اللغة الموحّد — يقرأ من i18next ويحفظ الاختيار عبر languageChanged.
 *
 * الاستعمال: const { t, lang, isRtl, toggle, setLang } = useLanguage();
 * `t` ترجمة (بمساحة الاسم عند الحاجة: t('nav:login'))، و`isRtl` توجيه
 * المكوّنات التي تبني اتجاهها يدوياً (الرسوم البيانية، الجولات…).
 */
export default function useLanguage() {
  const { t, i18n } = useTranslation();

  const lang = SUPPORTED.includes(String(i18n.language).slice(0, 2))
    ? String(i18n.language).slice(0, 2)
    : DEFAULT_LANG;

  const setLang = useCallback((code) => {
    if (SUPPORTED.includes(code)) i18n.changeLanguage(code);
  }, [i18n]);

  const toggle = useCallback(() => {
    i18n.changeLanguage(lang === 'ar' ? 'en' : 'ar');
  }, [i18n, lang]);

  return { t, lang, isRtl: isRtlLang(lang), setLang, toggle, i18n };
}
