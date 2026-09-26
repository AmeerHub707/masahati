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
};

/** يبني نصاً كاملاً: «14 مقعداً» — مع تجميع الأرقام بالإنجليزية توافقاً مع باقي اللوحة. */
export function arCount(n, forms) {
  const num = Number(n) || 0;
  const digits = Math.abs(num) >= 1000 ? num.toLocaleString('en-US') : String(num);
  return `${digits} ${arPlural(num, forms)}`;
}
