// أدوات تنسيق الأرقام والنصوص العربية — تُستخدم في العدادات والإحصاءات.

/**
 * يختار فئة العدد المناسبة حسب قواعد العربية:
 * 0 ← صفر · 1 ← مفرد · 2 ← مثنى · 3–10 ← جمع قلة · 11–99 ← مفرد منصوب · 100+ ← مفرد.
 * ملاحظة: قاعدة المئة وما فوق تسبق قاعدة البواقي، فيبقى «205» مفرداً لا جمعاً.
 */
export function arCategory(n) {
  const num = Math.abs(Number(n) || 0);
  if (num === 0) return 'zero';
  if (num === 1) return 'one';
  if (num === 2) return 'two';
  if (num >= 100) return 'other';
  if (num <= 10) return 'few';
  return 'many';
}

/** يُرجع صيغة الاسم المناسبة للعدد المعطى. */
export function arPlural(n, forms) {
  const category = arCategory(n);
  return forms?.[category] || forms?.other || '';
}

// صيغ شائعة في لوحة التحكم: المفرد، المثنى، جمع القلة، المفرد المنصوب، المفرد المجرور.
export const AR_FORMS = {
  // مقعد / مقعدان / مقاعد / مقعداً / مقعد
  seat: { zero: 'مقعد', one: 'مقعد', two: 'مقعدان', few: 'مقاعد', many: 'مقعداً', other: 'مقعد' },
  // مساحة / مساحتان / مساحات / مساحةً / مساحة
  space: { zero: 'مساحة', one: 'مساحة', two: 'مساحتان', few: 'مساحات', many: 'مساحةً', other: 'مساحة' },
  // حجز / حجزان / حجوزات / حجزاً / حجز
  booking: { zero: 'حجز', one: 'حجز', two: 'حجزان', few: 'حجوزات', many: 'حجزاً', other: 'حجز' },
  // نتيجة / نتيجتان / نتائج / نتيجةً / نتيجة
  result: { zero: 'نتيجة', one: 'نتيجة', two: 'نتيجتان', few: 'نتائج', many: 'نتيجةً', other: 'نتيجة' },
  // مستخدم / مستخدمان / مستخدمين / مستخدماً / مستخدم
  user: { zero: 'مستخدم', one: 'مستخدم', two: 'مستخدمان', few: 'مستخدمين', many: 'مستخدماً', other: 'مستخدم' },
  // مراجعة / مراجعتان / مراجعات / مراجعةً / مراجعة
  review: { zero: 'مراجعة', one: 'مراجعة', two: 'مراجعتان', few: 'مراجعات', many: 'مراجعةً', other: 'مراجعة' },
  // مستند / مستندان / مستندات / مستنداً / مستند
  document: { zero: 'مستند', one: 'مستند', two: 'مستندان', few: 'مستندات', many: 'مستنداً', other: 'مستند' },
};

/** يبني نصاً كاملاً: «14 مقعداً» — مع تجميع الأرقام بالإنجليزية توافقاً مع باقي اللوحة. */
export function arCount(n, forms) {
  const num = Number(n) || 0;
  const digits = Math.abs(num) >= 1000 ? num.toLocaleString('en-US') : String(num);
  return `${digits} ${arPlural(num, forms)}`;
}

// التشكيل + علامات القرآن + التطويل: تُحذف كلها قبل المقارنة.
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/**
 * يوحّد النص العربي للمقارنة والبحث: الهمزات (أ إ آ ٱ ← ا)، والتاء المربوطة (ة ← ه)،
 * والألف المقصورة (ى ← ي)، والهمزة على الواو/الياء، مع حذف التشكيل والتطويل.
 * بدونه يفشل بحث «الأناقه» عن «الأناقة»، و«اسماء» عن «أسماء».
 */
export function normalizeAr(value) {
  return String(value ?? '')
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
}

/**
 * تاريخ عربي مقروء: «١٥ سبتمبر ٢٠٢٦».
 * نضيف T00:00:00 لتواريخ «YYYY-MM-DD» لأن new Date() يفسّرها UTC فيتأخر اليوم
 * يوماً كاملاً في المناطق الزمنية شرق غرينتش. تاريخ غير صالح يُعاد كما هو.
 */
export function formatArDate(value) {
  if (value == null || value === '') return '';
  const raw = String(value);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}
