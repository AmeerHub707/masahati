/**
 * مصادقة لوحة تحكم المشرف.
 *
 * القاعدة: الـ API هو المصدر الحقيقي، والجلسة المحلية شبكةُ أمان لا بديل.
 *
 *   adminLogin  → يحاول /api/admin/login أولاً.
 *                 • 401/403/422 = خطأ حقيقي (بيانات خاطئة أو الحساب ليس مشرفاً)
 *                   يُعرض كما هو ولا يتراجع للجلسة المحلية — وإلا لأصبح رفض
 *                   الخادم بلا معنى وبلغى أي بريد وكلمة مرور افتراضية الدخول.
 *                 • فشل الشبكة (رمز 0) = الخادم غير متاح ⇒ جلسة محلية وهمية
 *                   حتى لا تُقفل اللوحة على مشرف لا يستطيع إصلاح الشبكة الآن.
 *
 *   قراءة الملف  → ذاكرة مؤقتة من /api/admin/me أو من localStorage، حتى لا
 *                   يصير كل تصيير طلباً. forceRefresh = إعادة تحميل من الخادم.
 *
 * أيقونة الحالة (adminSessionMode) تخبر الواجهة إن كانت البيانات حقيقية أم محلية،
 * فتعرض ذلك للمستخدم بدل أن تخلطه بأرقام تجريبية.
 */

import {
  login as apiLogin,
  logout as apiLogout,
  updateProfile as apiUpdateProfile,
  uploadProfilePicture as apiUploadProfilePicture,
  changePassword as apiChangePassword,
  isAdminTokenLive,
  clearAdminSession,
  cacheAdminProfile,
  readCachedAdminProfile,
} from './adminApi';
import {
  extractPicturePath,
  resolveNewPictureUrl,
  toStorableDataUrl,
} from './profilePicture';

// نطاق كاش صورة المشرف: منفصل عن نطاق العميل حتى لا تظهر صورة المشرف في
// لوحة زبون على المتصفح نفسه.
const ADMIN_PICTURE_SCOPE = 'admin';

const ADMIN_SESSION_KEY = 'masahati_admin_session';
const ADMIN_PASSWORD_KEY = 'masahati_admin_password';
const ADMIN_EMAIL = 'masahati@outlook.com';
const DEFAULT_PASSWORD = '123456789admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة

const LOCAL_FALLBACK = {
  name: 'إدارة مساحاتي',
  email: ADMIN_EMAIL,
  whatsapp: '',
  role: 'admin',
};

function readLocalSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.email && parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين قد يكون غير متاح */
  }
}

function localPassword() {
  try {
    return localStorage.getItem(ADMIN_PASSWORD_KEY) || DEFAULT_PASSWORD;
  } catch {
    return DEFAULT_PASSWORD;
  }
}

/** 'live' = جلسة حقيقية من الـ API · 'local' = جلسة محلية احتياطية. */
export function adminSessionMode() {
  return isAdminTokenLive() ? 'live' : 'local';
}

/** يُخبر الشاشات هل تقرأ من الخادم أم من البيانات التجريبية. */
export function isAdminApiLive() {
  return isAdminTokenLive();
}

export function isAdminLoggedIn() {
  return isAdminTokenLive() || Boolean(readLocalSession());
}

/** الملف الشخصي المشرف — من ذاكرة /me إن وُجد، وإلا المحلي، بلا أي طلب شبكة. */
export function getAdminProfile() {
  if (isAdminTokenLive()) {
    const cached = readCachedAdminProfile();
    if (cached && cached.email) return { ...LOCAL_FALLBACK, ...cached };
  }
  const session = readLocalSession();
  if (!session) return null;
  const cached = readCachedAdminProfile() || {};
  return {
    ...LOCAL_FALLBACK,
    ...cached,
    name: cached.name || session.name || LOCAL_FALLBACK.name,
    email: session.email || cached.email || LOCAL_FALLBACK.email,
    role: 'admin',
  };
}

/* ------------------------------------------------------------------ */
/* 0) حالة الملف الشخصي المشتركة                                       */
/* ------------------------------------------------------------------ */

/**
 * حالة واحدة يقرأ منها كل تبويبات اللوحة (صورة الشريط الجانبي أساساً).
 *
 * لماذا لا نكتفي بـ `getAdminProfile()`: هي قراءة من التخزين تعيد كائناً
 * جديداً كل نداء، فمن يعرضها أثناء التصيير يُعيد التصيير بلا نهاية (تبدّل
 * المرجع)، ومن يقرأها في معالج حدث لا يُعيد التصيير أصلاً — فتبقى صورة
 * الشريط الجانبي على الصورة القديمة بعد رفع صورة جديدة من الإعدادات.
 *
 * الحل: لقطة واحدة بتعرّف ثابت تتغيّر فقط عند `refreshAdminProfile()`، مع
 * اشتراك للمشاهدين. تُقرأ عبر `useSyncExternalStore` في `AdminLayout` و
 * `AdminSettings`، فيتحدّث الشريط الجانبي في كل صفحة بلا رفع حالة يدوي.
 */
let profileSnapshot = null;
const profileListeners = new Set();

/** يشترك في تغيّر الملف الشخصي ويعيد دالة إلغاء الاشتراك. */
export function subscribeAdminProfile(listener) {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
}

/**
 * لقطة الملف الشخصي بتعرّف ثابت بين التغيّرات — شرط `useSyncExternalStore`
 * (تعرّف جديد كل نداء = تصيير لا ينتهي).
 */
export function getAdminProfileSnapshot() {
  if (!profileSnapshot) profileSnapshot = getAdminProfile();
  return profileSnapshot;
}

/**
 * يسقط اللقطة ويعلم كل المشتركين. تُستدعى بعد كل تغيير حقيقي في الملف
 * (دخول، حفظ، رفع صورة، خروج) لا بعد كل قراءة.
 */
export function refreshAdminProfile() {
  profileSnapshot = getAdminProfile();
  for (const listener of profileListeners) {
    try {
      listener();
    } catch {
      /* مشاهد أخفق: لا يُسقط إشعار الباقين */
    }
  }
  return profileSnapshot;
}

/**
 * تسجيل الدخول. يرجع الملف الشخصي، ويرمي خطأً برسالة عربية عند الرفض.
 * @throws {Error} رسالة جاهزة للعرض على المستخدم
 */
export async function adminLogin(email, password) {
  const normalized = String(email || '').trim();

  try {
    const data = await apiLogin(normalized, String(password || ''));
    if (data?.admin) {
      cacheAdminProfile({ ...LOCAL_FALLBACK, ...data.admin });
    }
    return refreshAdminProfile();
  } catch (err) {
    // رفض حقيقي من الخادم: نُظهر الرسالة ولا نتراجع.
    if (err?.status !== 0) {
      throw new Error(err?.message || 'تعذّر تسجيل الدخول.', { cause: err });
    }

    // الخادم غير متاح — شبكة أمان محلية حتى لا تُقفل اللوحة.
    if (normalized.toLowerCase() !== ADMIN_EMAIL || String(password || '') !== localPassword()) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.', { cause: err });
    }
    const session = {
      email: ADMIN_EMAIL,
      name: LOCAL_FALLBACK.name,
      role: 'admin',
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    writeLocal(ADMIN_SESSION_KEY, session);
    clearAdminSession();
    return refreshAdminProfile();
  }
}

/**
 * هل هذه البيانات المُدخلة هي بيانات المشرف المحلية المحفوظة؟
 *
 * يُستخدم لعرض «متابعة في وضع تجريبي» عند رفض الخادم: الرفض يبقى رفضاً
 * حقيقياً (لا تراجُع صامت)، لكن المشرف الذي لم يُبذَر حسابه بعد في الباك
 * يحتاج طريقاً صريحاً ومقصوداً للدخول بدل أن تُقفل عليه اللوحة بالكامل.
 */
export function isLocalAdminCredentials(email, password) {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL
    && String(password || '') === localPassword();
}

/**
 * جلسة محلية صريحة (بضغط المستخدم على زر، لا تلقائياً).
 * تُبذر الجلسة وتمسح أي توكن API قديم حتى لا تختلط بيانات حقيقية بأرقام تجريبية.
 */
export function startLocalAdminSession() {
  writeLocal(ADMIN_SESSION_KEY, {
    email: ADMIN_EMAIL,
    name: LOCAL_FALLBACK.name,
    role: 'admin',
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  clearAdminSession();
  return refreshAdminProfile();
}

/** تحديث الملف الشخصي — عبر الـ API إن كانت جلسة حيّة، وإلا محلياً. */
export async function updateAdminProfile({ name, email, whatsapp } = {}) {
  const current = getAdminProfile() || LOCAL_FALLBACK;
  const next = {
    ...current,
    name: String(name ?? current.name).trim() || current.name,
    email: String(email ?? current.email).trim() || current.email,
    whatsapp: String(whatsapp ?? current.whatsapp ?? '').trim(),
  };

  if (isAdminTokenLive()) {
    const saved = await apiUpdateProfile({ name: next.name, email: next.email, whatsapp: next.whatsapp });
    // نُعيد كتابة ما لم يُرِده الخادم (مثل واتساب) في الكاش: الخادم قد يردّ
    // بحقل ناقص، ولقطة الشريط الجانبي تُبنى من الكاش لا من هذا الردّ وحده،
    // فحقل ناقص فيها يعني حقلاً ناقصاً في كل صفحة.
    cacheAdminProfile({ ...LOCAL_FALLBACK, ...next, ...saved });
    return refreshAdminProfile();
  }

  cacheAdminProfile(next);
  const session = readLocalSession();
  if (session) writeLocal(ADMIN_SESSION_KEY, { ...session, name: next.name });
  return refreshAdminProfile();
}

/**
 * رفع صورة الملف الشخصي للمشرف.
 *
 * الباك إند هو المرجع: مع جلسة حيّة نرفع الملف (multipart) ونبني رابطاً
 * جديداً مضافاً إليه `t=` كي لا يبقى المتصفح يعرض الملف القديم لو أعاد
 * الخادم المسار نفسه. بلا خادم (وضع المشرف المحلي) نحفظ الصورة محلياً
 * كـ data URL مصغّرة، فتبقى بعد إعادة التحميل بدل أن تختفي مع الصفحة.
 *
 * أي نجاح أو فشل ينتهي بـ refreshAdminProfile: الشريط الجانبي في كل
 * التبويبات يقرأ اللقطة نفسها، فيتغيّر بمجرّد رفع الصورة من الإعدادات.
 */
export async function uploadAdminProfilePicture(file) {
  const current = getAdminProfile() || LOCAL_FALLBACK;

  if (isAdminTokenLive()) {
    const saved = await apiUploadProfilePicture(file);
    const rawPath = extractPicturePath(saved);
    const photo = rawPath
      ? resolveNewPictureUrl(rawPath, ADMIN_PICTURE_SCOPE)
      : current.photo || null;
    cacheAdminProfile({ ...LOCAL_FALLBACK, ...current, ...saved, photo });
    return refreshAdminProfile();
  }

  const photo = await toStorableDataUrl(file);
  cacheAdminProfile({ ...LOCAL_FALLBACK, ...current, photo });
  return refreshAdminProfile();
}

/** تغيير كلمة مرور المشرف. */
export async function changeAdminPassword(current, next) {
  if (isAdminTokenLive()) {
    await apiChangePassword(current, next, next);
    return true;
  }
  if (String(current || '') !== localPassword()) {
    throw new Error('كلمة المرور الحالية غير صحيحة.');
  }
  if (String(next || '').length < 8) {
    throw new Error('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
  }
  try {
    localStorage.setItem(ADMIN_PASSWORD_KEY, String(next));
  } catch {
    /* التخزين قد يكون غير متاح */
  }
  return true;
}

/** تسجيل الخروج — يبطل التوكن على الخادم عند وجوده، ويمسح الجلسة المحلية دائماً. */
export async function adminLogout() {
  if (isAdminTokenLive()) {
    await apiLogout();
  } else {
    clearAdminSession();
  }
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    /* ignore */
  }
  // اللقطة القديمة ما زالت تحكي «مسجّل الدخول» بعد المسح: نُسقطها وإلا رأى
  // أي مشاهد باقٍ الاسم والصورة القديمة بعد تسجيل الخروج.
  return refreshAdminProfile();
}
