/**
 * أدوات معاينة مستندات المساحة في لوحة الأدمن.
 *
 * ما يرفعه مالك المساحة صورة (jpg/png/webp) أو PDF — النموذج في شاشة المالك
 * يقبل `accept="application/pdf,image/*"`. والمعاينة الجيدة تعني: صورة
 * تُعرض داخل الصفحة قابلةً للتكبير، وPDF يُعرض في إطار مدمج، ونوعٌ غير
 * معروف يُعرض تنزيلاً لا إطاراً فارغاً.
 *
 * **لماذا كشف النوع هنا لا في المكوّن؟** لأن الكشف خطأً يُظهر دليلاً
 * فارغاً: صورة تُقرأ PDFًاً تعطي إطاراً أبيض، وPDF تُقرأ صورةً تعطي أيقونة
 * مكسورة. فالنوع يجب أن يكون محسوباً مرةً واحدة ومُختبَراً، لا مُخمَّناً
 * داخل التصيير.
 *
 * **لماذا نقرأ الرابط والاسم معاً؟** لأن الخادم يرسل أحياناً رابطاً بلا
 * امتداد (`/storage/documents/8f3c…`) وفيه `name` هو الاسم الأصلي للملف.
 * فالاعتماد على أحدهما فقط يعني توقّع نوعٍ خاطئ لنصف المستندات.
 */

/** امتدادات الصور المعروضة داخل الصفحة. */
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|svg|heic|heif|ico|tiff?)$/i;
/** امتداد PDF — النوع الوحيد الذي يعرضه المتصفّح داخل إطار. */
const PDF_EXT = /\.pdf$/i;
/** مستندات أوفيس: لا يعرضها المتصفّح داخل إطار، فتُعرض تنزيلاً. */
const OFFICE_EXT = /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i;

/**
 * يزيل سلسلة الاستعلام والجزء من الرابط.
 *
 * الرابط الموقّع (‎?signature=…‎) أو رابط CDN يحمل معاملات بعد الامتداد،
 * فاختبار النمط على الرابط الخام يفشل على مستندٍ صورته سليمة تماماً.
 */
function stripQuery(url) {
  return String(url || '')
    .split('#')[0]
    .split('?')[0];
}

/**
 * نوع المستند لأغراض العرض.
 *
 * @param {string} url  رابط المستند كما أرسله الخادم (نسبيٌّ أو كامل).
 * @param {string} name اسم الملف الأصلي إن وُجد.
 * @returns {'image'|'pdf'|'office'|'unknown'}
 */
export function detectDocType(url, name = '') {
  const fromUrl = stripQuery(url);
  const fromName = stripQuery(name);

  if (IMAGE_EXT.test(fromUrl) || IMAGE_EXT.test(fromName)) return 'image';
  if (PDF_EXT.test(fromUrl) || PDF_EXT.test(fromName)) return 'pdf';
  if (OFFICE_EXT.test(fromUrl) || OFFICE_EXT.test(fromName)) return 'office';

  // مستودع الصور (Cloudinary): المسار يحمل نوع المورد لا الامتداد، والرابط
  // المنتهي بلا امتداد image مضمونُ أنه صورة.
  if (/\/image\/(upload|fetch|private|authenticated)\//i.test(fromUrl)) return 'image';

  return 'unknown';
}

/**
 * الاسم المعروض للمستند: الاسم الأصلي من الخادم، ثم آخر جزء في الرابط،
 * ثم نصٌّ بديل. لا نعرض رابطاً كاملاً كاسم: أطول من أن يُقرأ ويُقطع في
 * الشريط العلوي، ويكشف مسار الخادم بلا داعٍ.
 */
export function docFileName(doc) {
  const name = String(doc?.name || '').trim();
  if (name) return name;

  const url = stripQuery(doc?.url || '');
  const segment = url.split('/').filter(Boolean).pop();
  return segment || 'مستند';
}

/**
 * امتداد الملف للشارة (PDF / JPG / DOCX…). يُؤخذ من الاسم أولاً لأن الخادم
 * قد يرسل رابطاً موقّعاً بلا امتداد ظاهر.
 */
export function docExtension(doc) {
  const fromName = stripQuery(doc?.name || '');
  const fromUrl = stripQuery(doc?.url || '');
  const match = /\.([a-z0-9]{1,5})$/i.exec(fromName) || /\.([a-z0-9]{1,5})$/i.exec(fromUrl);
  return match ? match[1].toUpperCase() : '';
}

/**
 * هل يمكن عرض المستند داخل الصفحة؟
 *
 * `office` و`unknown` لا يُعرضان داخل إطار: المتصفّح لا يعرضهما، والنتيجة
 * إطارٌ أبيض يوهم الأدمن بأن المستند فارغ. فنُظهر بطاقة تنزيل صريحة.
 */
export function isInlineViewable(type) {
  return type === 'image' || type === 'pdf';
}
