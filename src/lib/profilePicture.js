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
export function getCachedPictureUrl() {
  try {
    return localStorage.getItem(PICTURE_URL_KEY) || null;
  } catch {
    return null;
  }
}

export function clearCachedPicture() {
  try {
    localStorage.removeItem(PICTURE_URL_KEY);
    localStorage.removeItem(PICTURE_VERSION_KEY);
  } catch {
    /* storage not available */
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
export function resolvePictureUrl(rawPath) {
  if (!rawPath) return null;
  const base = imageUrl(rawPath);
  if (!base) return null;
  let url = base;
  try {
    const version = localStorage.getItem(PICTURE_VERSION_KEY);
    if (version) url = withVersion(base, Number(version) || Date.now());
  } catch {
    /* storage not available */
  }
  try {
    localStorage.setItem(PICTURE_URL_KEY, url);
  } catch {
    /* storage not available */
  }
  return url;
}

// يركّب نسخة جديدة (t=Date.now()) ويحفظ الرابط والنسخة؛ الأصل بعد رفع صورة
// جديدة كي تظهر فوراً حتى لو تكرر المسار نفسه من الباك إند.
export function resolveNewPictureUrl(rawPath) {
  if (!rawPath) return null;
  const base = imageUrl(rawPath);
  if (!base) return null;
  const ts = Date.now();
  const url = withVersion(base, ts);
  try {
    localStorage.setItem(PICTURE_VERSION_KEY, String(ts));
    localStorage.setItem(PICTURE_URL_KEY, url);
  } catch {
    /* storage not available */
  }
  return url;
}