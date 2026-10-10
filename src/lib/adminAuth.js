/**
 * مصادقة لوحة تحكم المشرف.
 *
 * القاعدة: الـ API هو المصدر الوحيد. لا بريد إلكتروني مبدئي، ولا كلمة مرور
 * افتراضية، ولا جلسة محلية وهمية. أي فشل في `/api/admin/login` يُعرض كما هو
 * (رسالة الخادم) ويُرمى خطأً — فيبقى «مسجّل الدخول» يعني دائماً «توكن مشرف
 * حقيقي في التخزين»، ولا تعرض اللوحة بيانات على جلسة غير موجودة.
 *
 *   adminLogin  → POST /api/admin/login. نجاح = توكن محفوظ (عبر adminApi).
 *                 أي رمز آخر (401/403/422/شبكة) = خطأ يُرمى للمستخدم.
 *
 *   قراءة الملف  → ذاكرة مؤقتة من آخر عملية ناجحة، حتى لا يصير كل تصيير طلباً.
 *                   forceRefresh = إعادة تحميل من الخادم.
 *
 * أيقونة الحالة (adminSessionMode) 'live' = جلسة حقيقية · 'none' = لا جلسة.
 */

import {
  login as apiLogin,
  logout as apiLogout,
  updateProfile as apiUpdateProfile,
  uploadProfilePicture as apiUploadProfilePicture,
  changePassword as apiChangePassword,
  isAdminTokenLive,
  cacheAdminProfile,
  readCachedAdminProfile,
} from './adminApi';
import {
  extractPicturePath,
  resolveNewPictureUrl,
} from './profilePicture';

// نطاق كاش صورة المشرف: منفصل عن نطاق العميل حتى لا تظهر صورة المشرف في
// لوحة زبون على المتصفح نفسه.
const ADMIN_PICTURE_SCOPE = 'admin';

// قيم عرض افتراضية فقط (اسم/نص)، بلا أي بيانات دخول. تُدمج تحت ما يعيده الخادم.
const ADMIN_PROFILE_DEFAULTS = {
  name: 'إدارة مساحاتي',
  whatsapp: '',
  role: 'admin',
};

// الرسالة الموحّدة عند محاولة إجراء إشرافي بلا جلسة حيّة.
const NO_SESSION = 'انتهت جلسة المشرف. يرجى تسجيل الدخول مجدداً.';

/** 'live' = جلسة حقيقية من الـ API · 'none' = لا جلسة. */
export function adminSessionMode() {
  return isAdminTokenLive() ? 'live' : 'none';
}

/** يُخبر الشاشات هل تقرأ من الخادم (جلسة حيّة) أم لا. */
export function isAdminApiLive() {
  return isAdminTokenLive();
}

export function isAdminLoggedIn() {
  return isAdminTokenLive();
}

/** الملف الشخصي المشرف — من ذاكرة آخر عملية، أو null بلا جلسة. */
export function getAdminProfile() {
  if (!isAdminTokenLive()) return null;
  const cached = readCachedAdminProfile() || {};
  return { ...ADMIN_PROFILE_DEFAULTS, ...cached, role: 'admin' };
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
 * تسجيل الدخول عبر الخادم فقط. يرجع الملف الشخصي، ويرمي خطأً برسالة عربية
 * عند الرفض أو تعذّر الاتصال. لا يوجد أي مسار محلي بديل.
 * @throws {Error} رسالة جاهزة للعرض على المستخدم
 */
export async function adminLogin(email, password) {
  const normalized = String(email || '').trim();
  const data = await apiLogin(normalized, String(password || ''));
  if (data?.admin) {
    cacheAdminProfile({ ...ADMIN_PROFILE_DEFAULTS, ...data.admin });
  }
  return refreshAdminProfile();
}

/** تحديث الملف الشخصي — يتطلب جلسة حيّة (عبر الـ API). */
export async function updateAdminProfile({ name, email, whatsapp } = {}) {
  if (!isAdminTokenLive()) throw new Error(NO_SESSION);
  const current = getAdminProfile() || ADMIN_PROFILE_DEFAULTS;
  const next = {
    ...current,
    name: String(name ?? current.name).trim() || current.name,
    email: String(email ?? current.email).trim() || current.email,
    whatsapp: String(whatsapp ?? current.whatsapp ?? '').trim(),
  };

  const saved = await apiUpdateProfile({ name: next.name, email: next.email, whatsapp: next.whatsapp });
  // نُعيد كتابة ما لم يُرِده الخادم (مثل واتساب) في الكاش: الخادم قد يردّ
  // بحقل ناقص، ولقطة الشريط الجانبي تُبنى من الكاش لا من هذا الردّ وحده.
  cacheAdminProfile({ ...ADMIN_PROFILE_DEFAULTS, ...next, ...saved });
  return refreshAdminProfile();
}

/**
 * رفع صورة الملف الشخصي للمشرف (multipart) — يتطلب جلسة حيّة.
 *
 * نبني رابطاً جديداً مضافاً إليه `t=` كي لا يبقى المتصفح يعرض الملف القديم
 * لو أعاد الخادم المسار نفسه.
 */
export async function uploadAdminProfilePicture(file) {
  if (!isAdminTokenLive()) throw new Error(NO_SESSION);
  const current = getAdminProfile() || ADMIN_PROFILE_DEFAULTS;
  const saved = await apiUploadProfilePicture(file);
  const rawPath = extractPicturePath(saved);
  const photo = rawPath
    ? resolveNewPictureUrl(rawPath, ADMIN_PICTURE_SCOPE)
    : current.photo || null;
  cacheAdminProfile({ ...ADMIN_PROFILE_DEFAULTS, ...current, ...saved, photo });
  return refreshAdminProfile();
}

/** تغيير كلمة مرور المشرف — يتطلب جلسة حيّة. */
export async function changeAdminPassword(current, next) {
  if (!isAdminTokenLive()) throw new Error(NO_SESSION);
  await apiChangePassword(current, next, next);
  return true;
}

/** تسجيل الخروج — يبطل التوكن على الخادم ويمسح الجلسة دائماً. */
export async function adminLogout() {
  await apiLogout();
  // اللقطة القديمة ما زالت تحكي «مسجّل الدخول» بعد المسح: نُسقطها وإلا رأى
  // أي مشاهد باقٍ الاسم والصورة القديمة بعد تسجيل الخروج.
  return refreshAdminProfile();
}
