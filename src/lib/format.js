// تنسيق الأرقام بالعربية — مصدر واحد لكل الصفحات.
// سبب استخراجه: صفحة تفاصيل المساحة كانت تعرض التقييم بالأرقام اللاتينية
// (4.6) بينما كل صفحة أخرى تعرضه بالأرقام العربية (٤٫٦)، لأن كل صفحة
// كانت تُعرّف منسّقها بنفسها.

const numFmt = new Intl.NumberFormat('ar-EG');

// نماذج الأرقام العربية لا تدعم الكسور افتراضياً — نمنحها منزلة عشرية واحدة
const numFmtDec = new Intl.NumberFormat('ar-EG', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** عدد صحيح بالأرقام العربية. */
export function fmtNumber(n) {
  return numFmt.format(n || 0);
}

/** تقييم بمنزلة عشرية واحدة وبنفس أرقام الموقع العربية. */
export function fmtRating(n) {
  return numFmtDec.format(Number(n) || 0);
}

/** مبلغ بخانتين عشريتين (مثل إجمالي الحجز). */
const numFmtMoney = new Intl.NumberFormat('ar-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtMoney(n) {
  return numFmtMoney.format(Number(n) || 0);
}
