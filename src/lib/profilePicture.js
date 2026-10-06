// وحدة صورة الملف الشخصي — المصدر الوحيد لكل منطق استخراج الرابط وعرضه.
//
// المشكلة التي أصلحناها: كان الاستخراج والكاش مبعثراً بين dashboard.js و
// DashboardPage.jsx و Settings.jsx بأسماء مفاتيح مختلفة، فتُفقد الصورة عند
// إعادة التحميل أو تُعرض نسخة قديمة من كاش المتصفح. هنا كل شيء في مكان واحد:
//   - استخراج الرابط من أي صيغة استجابة يعيدها الباك إند.
//   - بناء الرابط الكامل على مخدم الباك إند.
//   - تعطيل كاش المتصفح عبر معلمة استعلام (t=) عند رفع صورة جديدة.
//   - تخزين الرابط ونسخته في localStorage ليُقرأ من كل مكان (الشريط الجانبي،
//     نظرة عامة، الإعدادات) حتى لو فشل الاتصال لاحقاً.

import { imageUrl } from './api';

// كل المفاتيح التي قد يردّ بها الباك إند (Laravel/Cloudinary) لحقل صورة المستخدم.
export const PICTURE_KEYS = [
  'profile_picture_url',
  'profile_picture',
  'profile_image_url',
  'profile_image',
  'picture_url',
  'picture',
  'photo_url',
  'photo',
  'avatar_url',
  'avatar',
  'image_url',
  'image',
  'secure_url',
  'url',
  'path',
];

const PICTURE_URL_KEY = 'profile_picture_url';
const PICTURE_VERSION_KEY = 'profile_picture_version';

// نطاق التخزين: نطاق العميل (افتراضي) ونطاق المشرف منفصلان.
// السبب: لوحة المشرف ولوحة العميل تتشاركان المتصفح ونفس localStorage، فمفتاح
// واحد يجعل صورة المشرف تظهر كصورة صاحب جلسة عميل بعد رفعها.
const ADMIN_SCOPE = 'admin';

function storageKey(baseKey, scope) {
  return scope === ADMIN_SCOPE ? `${baseKey}_${ADMIN_SCOPE}` : baseKey;
}

// يتعرّف على كائن المستخدم داخل أي صيغة استجابة (مباشرة أو مغلّفة user/data).
function unwrapUser(obj) {
  if (!obj || typeof obj !== 'object') return null;
  let cur = obj;
  if (cur.user && typeof cur.user === 'object') cur = cur.user;
  if (cur.data && typeof cur.data === 'object') cur = cur.data;
  if (cur.user && typeof cur.user === 'object') cur = cur.user;
  return cur;
}

// يحوّل قيمة الحقل إلى رابط نصّي؛ يدعم النص المباشر أو كائن وسائط
// (مثل ردّ Cloudinary: { secure_url } / { url } / { path }).
function urlFromValue(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    for (const key of ['secure_url', 'url', 'path', 'profile_picture_url', 'picture', 'image']) {
      if (typeof val[key] === 'string' && val[key]) return val[key];
    }
  }
  return null;
}

// يستخرج مسار/رابط الصورة من أي صيغة استجابة يردّها الباك إند.
export function extractPicturePath(...sources) {
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const obj of [unwrapUser(src), src]) {
      if (!obj || typeof obj !== 'object') continue;
      for (const key of PICTURE_KEYS) {
        const found = urlFromValue(obj[key]);
        if (found) return found;
      }
    }
  }
  return null;
}

// الرابط المخزّن محلياً (يعيش بعد إعادة التحميل وفشل الاتصال).
export function getCachedPictureUrl(scope) {
  try {
    return localStorage.getItem(storageKey(PICTURE_URL_KEY, scope)) || null;
  } catch {
    return null;
  }
}

// يضيف/يستبدل معلمة t= لمنع كاش المتصفح من إعادة عرض الصورة القديمة.
function withVersion(url, ts) {
  const cleaned = url.replace(/([?&])t=\d+/, '$1');
  if (/[?&]$/.test(cleaned)) return `${cleaned}t=${ts}`;
  return `${cleaned}${cleaned.includes('?') ? '&' : '?'}t=${ts}`;
}

// يعيد الرابط الكامل مع إعادة ضمّ نسخة التحديث (t=) المخزّنة إن وُجدت، ويحدّث
// الكاش. الأصل للعرض العادي (تحميل الصفحة): يبقى على نفس نسخة آخر رفع.
export function resolvePictureUrl(rawPath, scope) {
  if (!rawPath) return null;
  const base = imageUrl(rawPath);
  if (!base) return null;
  let url = base;
  try {
    const version = localStorage.getItem(storageKey(PICTURE_VERSION_KEY, scope));
    if (version) url = withVersion(base, Number(version) || Date.now());
  } catch {
    /* storage not available */
  }
  try {
    localStorage.setItem(storageKey(PICTURE_URL_KEY, scope), url);
  } catch {
    /* storage not available */
  }
  return url;
}

// يركّب نسخة جديدة (t=Date.now()) ويحفظ الرابط والنسخة؛ الأصل بعد رفع صورة
// جديدة كي تظهر فوراً حتى لو تكرر المسار نفسه من الباك إند.
export function resolveNewPictureUrl(rawPath, scope) {
  if (!rawPath) return null;
  const base = imageUrl(rawPath);
  if (!base) return null;
  const ts = Date.now();
  const url = withVersion(base, ts);
  try {
    localStorage.setItem(storageKey(PICTURE_VERSION_KEY, scope), String(ts));
    localStorage.setItem(storageKey(PICTURE_URL_KEY, scope), url);
  } catch {
    /* storage not available */
  }
  return url;
}

/* ------------------------------------------------------------------ */
/* 3) اختيار الملف: تحقّق، معاينة فورية، وتحويل للتخزين المحلي          */
/* ------------------------------------------------------------------ */

// حدّ الرفع: 5 ميغابايت، موافقةً لحدّ لوحات العميل. ما فوقه خطأ ظاهر
// للمستخدم قبل إرسال أي بايت للخادم.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// فوق هذا الحجم لا نحفظ الصورة كـ data URL: حصة localStorage كلها ~5
// ميغابايت، فصورة كبيرة تكتب كل الحصة بصمت وتُفشل بقية التخزين.
const MAX_INLINE_BYTES = 512 * 1024;

// مقاس الصورة الرمزية: 256 بكسل أكثر من كافٍ لصورة دائرية، والتصغير يجعل
// التخزين المحلي ممكناً بلا اقتراب من حدّ الحصة.
const SHRINK_MAX_DIM = 256;
const SHRINK_QUALITY = 0.82;

/**
 * يتحقّق من الملف قبل أي رفع. يعيد رسالة عربية جاهزة للعرض، أو `null` إن
 * كان الملف صالحاً. فصل «ما الصالح» عن «ماذا نفعل به» يجعل نفس القواعد
 * قابلة لإعادة الاستخدام في كل شاشة رفع.
 */
export function validateImageFile(file) {
  if (!file) return 'لم يتم اختيار أي ملف.';
  if (!file.type || !/^image\//i.test(file.type)) {
    return 'يرجى اختيار ملف صورة (PNG، JPG، WEBP، GIF …).';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'حجم الصورة كبير جداً. الرجاء اختيار صورة أصغر من 5 ميجابايت.';
  }
  return null;
}

/** يقرأ الملف كـ data URL — البديل حين لا تتوفّر معاينة بـ object URL. */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذّرت قراءة الصورة.'));
    reader.readAsDataURL(file);
  });
}

/**
 * معاينة فورية قبل أن يُرجع الخادم رابطاً.
 *
 * `createObjectURL` أخفّ من base64 بكثير، لكنه غير متاح في كل بيئة تنفيذ
 * (jsdom في الاختبارات) وقد يرفض Blob آتياً من نافذة أخرى. لذلك النتيجة
 * المعادة تحمل `revoke` دائماً: قراءة مباشرة إن تعذّر object URL.
 */
export async function createPreviewUrl(file) {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      const url = URL.createObjectURL(file);
      return {
        url,
        revoke: () => {
          try {
            if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
          } catch {
            /* nothing to release */
          }
        },
      };
    } catch {
      /* بيئة بلا دعم للـ Blob: نتابع بالقراءة المباشرة */
    }
  }
  return { url: await readFileAsDataUrl(file), revoke: () => {} };
}

/**
 * هل في البيئة لوحة رسم يمكن التصغير بها؟
 *
 * لا نستدعي `getContext` للفحص: فهو غير مُنفَّذ في jsdom (بيئة اختباراتنا)
 * ويكتب خطأً على الـ console، فيفشل اختبار «بلا أخطاء React/console» بسبب
 * استدعاء عارض لا عيب حقيقي. وجود `OffscreenCanvas` فحصٌ صامت وآمن.
 */
function canShrink() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false;
  if (typeof globalThis.OffscreenCanvas !== 'function') return false;
  try {
    return Boolean(document.createElement('canvas').getContext('2d'));
  } catch {
    return false;
  }
}

/** يرسم الصورة داخل canvas بأبعد حدّ أقصى ويعيد data URL مضغوطاً، أو null. */
function shrinkImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return resolve(null);
        const scale = Math.min(1, SHRINK_MAX_DIM / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', SHRINK_QUALITY));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * يحوّل الملف إلى صورة قابلة للتخزين في localStorage (وضع المشرف المحلي بلا
 * خادم حيّ): يصغّرها أولاً، ويقبل الأصل فقط إن كانت صغيرة أو تعذّر التصغير.
 * @throws {Error} رسالة عربية إن كانت أكبر من أن تُحفظ بأمان
 */
export async function toStorableDataUrl(file) {
  const raw = await readFileAsDataUrl(file);
  if (canShrink()) {
    const shrunk = await shrinkImage(raw);
    if (shrunk) return shrunk;
  }
  if (file.size <= MAX_INLINE_BYTES) return raw;
  throw new Error(
    'متصفحك لا يدعم تصغير الصورة وحجمها أكبر من أن تُحفظ محلياً. جرّب صورة أصغر، أو سجّل الدخول عند تشغيل الخادم.'
  );
}