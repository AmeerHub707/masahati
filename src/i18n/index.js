import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import arCommon from './locales/ar/common.json';
import arNav from './locales/ar/nav.json';
import arLanding from './locales/ar/landing.json';
import arFooter from './locales/ar/footer.json';
import arApi from './locales/ar/api.json';
import arAuth from './locales/ar/auth.json';
import arDashboard from './locales/ar/dashboard.json';
import arCustomer from './locales/ar/customer.json';
import arOwner from './locales/ar/owner.json';
import arAdmin from './locales/ar/admin.json';
import arSpaces from './locales/ar/spaces.json';

import enCommon from './locales/en/common.json';
import enNav from './locales/en/nav.json';
import enLanding from './locales/en/landing.json';
import enFooter from './locales/en/footer.json';
import enApi from './locales/en/api.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enCustomer from './locales/en/customer.json';
import enOwner from './locales/en/owner.json';
import enAdmin from './locales/en/admin.json';
import enSpaces from './locales/en/spaces.json';

// مفتاح التخزين متوافق مع نمط masahati_* المستعمل في الثيم (useTheme.js).
export const LANG_KEY = 'masahati_lang';

export const SUPPORTED = ['ar', 'en'];
export const DEFAULT_LANG = 'ar';

// اللغات التي تُكتب من اليمين لليسار. أي لغة خارج القائمة تُعامَل LTR.
const RTL_LANGS = new Set(['ar']);

export const isRtlLang = (lang) => RTL_LANGS.has(String(lang || '').slice(0, 2));

/**
 * يطبّق الاتجاه واللغة على <html>. التبديل هنا يكفي لأن الورقة كلها
 * (index.css و Tailwind) مبنية على اتجاه المستند — لا حاجة لإعادة التصيير.
 */
export function applyDocumentLang(lang) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.setAttribute('lang', lang);
  el.setAttribute('dir', isRtlLang(lang) ? 'rtl' : 'ltr');
}

/**
 * الكشف الأولي: اختيار المحفوظ دائماً أولاً، ثم لغة المتصفح، ثم العربية.
 * العربية تبقى الافتراضية احتياطاً لكلّ لغة غير مدعومة.
 */
function detectInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {
    /* التخزين قد يكون محجوباً — نتجاهل وننتقل للغة المتصفح */
  }
  if (typeof navigator === 'undefined') return DEFAULT_LANG;
  const nav = String(navigator.language || '').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(nav) ? nav : DEFAULT_LANG;
}

const initialLang = detectInitialLang();

i18n.use(initReactI18next).init({
  resources: {
    ar: { common: arCommon, nav: arNav, landing: arLanding, footer: arFooter, api: arApi, auth: arAuth, dashboard: arDashboard, customer: arCustomer, owner: arOwner, admin: arAdmin, spaces: arSpaces },
    en: { common: enCommon, nav: enNav, landing: enLanding, footer: enFooter, api: enApi, auth: enAuth, dashboard: enDashboard, customer: enCustomer, owner: enOwner, admin: enAdmin, spaces: enSpaces },
  },
  lng: initialLang,
  fallbackLng: DEFAULT_LANG,
  ns: ['common', 'nav', 'landing', 'footer', 'api', 'auth', 'dashboard', 'customer', 'owner', 'admin', 'spaces'],
  defaultNS: 'common',
  // الموارد كلها مضمّنة في الحزمة، فلا داعي لتأجيل التهيئة إلى الطور التالي:
  // التهيئة المتزامنة تمنع وميض مفتاح ترجمة، وتمنع إعادة تصيير متأخّرة بعد
  // حدث `initialized` — وهي إعادة تصيير كانت تزاحم تأثيرات التنظيف في اللوحات.
  initImmediate: false,
  interpolation: { escapeValue: false },
  // قيمة فارغة في الترجمة الإنجليزية تعني «لم تُترجم بعد»، لا نصًّا فارغاً —
  // فنسقط على العربية بدل إفراغ الواجهة أثناء ترحيل بقية الشاشات.
  returnEmptyString: false,
});

// تهيئة اتجاه المستند قبل أول تصيير حتى لا يرتدّ التخطيط (FOUC).
applyDocumentLang(initialLang);

i18n.on('languageChanged', (lang) => {
  applyDocumentLang(lang);
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* التخزين محجوباً: التبديل يبقى فعّالاً في هذه الجلسة فقط */
  }
});

export default i18n;
