// تخزين المصادقة الحقيقي — يتواصل مع باك إند Laravel على Render.
// المصادقة عبر Bearer token (Sanctum) يُحفظ في localStorage.
// التوكن هو المرجع الوحيد لكون الجلسة نشطة؛ لا نعتمد على أي علم إضافي.

import { request, getToken, setToken, setUser, clearUser, getUser, ApiError, resetLocalUserData, consumeSessionExpired } from './api';
import { extractPicturePath } from './profilePicture';

// إعادة التصدير لتسهيل الاستيراد من صفحات المصادقة
export { request, ApiError, consumeSessionExpired };

// ----- حالة الجلسة: مبنية على وجود التوكن فقط -----
// إصلاح: كان الكود السابق يعتمد على SESSION_KEY بالإضافة إلى التوكن،
// ما يسمح بإظهار واجهة المسجّل بعد انتهاء صلاحية التوكن في السيرفر.
// الآن: التوكن هو المرجع الوحيد.
export function isLoggedIn() {
  return !!getToken();
}

// يقبل أي صيغة إجابة يعيدها الباك إند ويفكّك أعمق كائن مستخدم/بيانات:
//   { user: {...} } أو { data: {...} } أو { data: { user: {...} } } أو الكائن نفسه.
// مثل dashboard.unwrapUser تماماً، لأن /api/login قد يغلّف المستخدم بنفس الطريقة.
export function extractUser(res) {
  if (!res || typeof res !== 'object') return {};
  let cur = res;
  if (cur.user && typeof cur.user === 'object') cur = cur.user;
  if (cur.data && typeof cur.data === 'object') cur = cur.data;
  if (cur.user && typeof cur.user === 'object') cur = cur.user;
  return cur || {};
}

// تطبيع الدور الوارد من الباك إند إلى قيمتنا القياسية، حتى لو جاء بصيغة مختلفة
// (مسافات/كبيرة/صغيرة/اسم مستعار) حتى لا يقع المستخدم في الرئيسية بدل لوحته.
export function normalizeRole(role) {
  if (!role) return '';
  const s = String(role).trim().toLowerCase();
  if (s === 'space_owner' || s === 'space owner' || s === 'spaceowner' || s === 'owner') return 'space_owner';
  if (s === 'customer' || s === 'client') return 'customer';
  return s;
}

export async function login(email, password) {
  const data = await request('/api/login', {
    method: 'POST',
    body: { login: email, password },
  });
  if (data && data.token) {
    setToken(data.token);
    // إصلاح: استجابة /api/login قد تخلو من user مباشرة (مغلّفة في data أو data.user)،
    // وكذلك الدور قد يأتي بصيغة غير قياسية أو لا يأتي في استجابة الدخول إطلاقاً.
    // نستخرج المستخدم الحقيقي ونطبّع الدور، وإن غاب نستعلم /api/profile (مصدر الدور
    // في dashboard.js) حتى يُوجَّه المستخدم إلى لوحة تحكمه لا إلى الرئيسية.
    const user = extractUser(data);
    let role = normalizeRole(user.role);
    if (!role) {
      try {
        const profile = extractUser(await request('/api/profile', { method: 'GET', auth: true }));
        role = normalizeRole(profile.role);
        if (role) {
          user.role = role;
          for (const k of ['name', 'email', 'phone', 'picture', 'photo']) {
            if (typeof user[k] === 'undefined' && typeof profile[k] !== 'undefined') user[k] = profile[k];
          }
        }
      } catch {
        /* تجاهل فشل الملف: الدور أصلاً قد لا يقرره الباك إند */
      }
    }
    if (role && !user.role) user.role = role;
    setUser(Object.keys(user).length ? user : null);
    // نعيد المستخدم المستخرج ضمن data حتى تعمل navigate(getHomePath(data.user?.role)).
    return { ...data, user };
  }
  // إصلاح: كان الكود السابق يتجاهل غياب التوكن ويعود بنجاح صامت.
  // الآن: نرمي خطأ واضح إذا لم يُرجع السيرفر توكناً.
  throw new ApiError('استجابة الخادم غير متوقعة (لا يوجد توكن).', 500, data);
}

// ----- تسجيل عميل -----
export async function registerCustomer(payload) {
  return request('/api/register/customer', {
    method: 'POST',
    body: payload,
  });
}

// ----- تسجيل صاحب مساحة (يتضمن ملف الوثيقة) -----
export async function registerOwner(formData) {
  return request('/api/register/space-owner', {
    method: 'POST',
    body: formData,
    isForm: true,
  });
}

// ----- تسجيل الدخول عبر Google -----
// يرسل id_token (credential من Google Identity Services) إلى الباك إند،
// مع الدور الاختياري ('customer' | 'space_owner') عند التسجيل. الباك إند يتحقق
// من الرمز ويعيد Sanctum token يُحفظ مثل أي تسجيل دخول عادي.

// يفكك حمولة id_token (JWT) محلياً لاستخراج بيانات المستخدم — خاصة صورة Google.
// التوقيع يتحقق منه الباك إند؛ نحتاج الحمولة فقط كاحتياط عند عدم إرجاع صورة من الباك إند.
function decodeGoogleIdToken(idToken) {
  try {
    const payload = String(idToken || '').split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(normalized)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function googleLogin(idToken, role) {
  const data = await request('/api/auth/google', {
    method: 'POST',
    body: role ? { id_token: idToken, role } : { id_token: idToken },
  });
  if (data && data.token) {
    setToken(data.token);
    // إصلاح: الباك إند قد لا يُرجع بيانات كاملة لمستخدمي Google في /api/auth/google
    // أو /api/profile (اسم/بريد/صورة فارغة). الـ id_token نفسه يحمل هذه البيانات في
    // claims موثوقة (name, email, picture) — نملأ الفراغ فقط ونترك قيم الباك إند
    // لها الأولوية حين تكون موجودة.
    const googlePayload = decodeGoogleIdToken(idToken) || {};
    const backendUser = extractUser(data);

    const hasBackendPicture = Boolean(extractPicturePath(backendUser));
    const merged = { ...backendUser };
    if (!hasBackendPicture && typeof googlePayload.picture === 'string' && googlePayload.picture) {
      merged.picture = googlePayload.picture;
    }
    if (!merged.name && (typeof googlePayload.name === 'string' && googlePayload.name)) {
      merged.name = googlePayload.name;
    }
    if (!merged.full_name && merged.name) {
      merged.full_name = merged.name;
    }
    if (!merged.email && typeof googlePayload.email === 'string' && googlePayload.email) {
      merged.email = googlePayload.email;
    }
    // نسخّن دور الباك إند بنفس طريقة تسجيل الدخول العادي.
    const role = normalizeRole(merged.role);
    if (role) merged.role = role;

    // نخزّن النسخة المدمجة فقط إذا أضفنا فعلاً قيمة لم تكن موجودة.
    const fallbackAdded = Object.keys(merged).some((k) => merged[k] && merged[k] !== backendUser[k]);
    setUser(fallbackAdded ? merged : backendUser);
    return { ...data, user: merged };
  }
  throw new ApiError('استجابة الخادم غير متوقعة (لا يوجد توكن).', 500, data);
}

// ----- بيانات المستخدم الحالي -----
export { getUser, setUser, clearUser };

// ----- تغيير كلمة المرور أثناء تسجيل الدخول (محمي) -----
export async function changePassword({ oldPassword, newPassword, newPassword_confirmation }) {
  const data = await request('/api/change-pass', {
    method: 'POST',
    auth: true,
    body: { oldPassword, newPassword, newPassword_confirmation },
  });
  const payload = data && data.data && typeof data.data === 'object' ? data.data : data;
  if (payload && payload.token) setToken(payload.token);
  return data;
}

// ----- الملف الشخصي: جلب البيانات الحالية (محمي) -----
export async function getProfile() {
  return request('/api/profile', { method: 'GET', auth: true });
}

// ----- تحديث الملف الشخصي (full_name, phone, email) (محمي، PATCH) -----
export async function updateProfile({ full_name, phone, email }) {
  return request('/api/customer/profile', {
    method: 'PATCH',
    auth: true,
    body: { full_name, phone, email },
  });
}

// ----- رفع صورة الملف الشخصي لأول مرة (محمي، POST) -----
// يعيد { profile_picture_url, msg } وفق /api.txt.
export async function uploadPicture(file) {
  const fd = new FormData();
  fd.append('profile_picture', file);
  return request('/api/uploadPicture', {
    method: 'POST',
    auth: true,
    isForm: true,
    body: fd,
  });
}

// ----- استبدال صورة الملف الشخصي الحالية بأخرى (محمي، PATCH) -----
export async function updateProfilePicture(file) {
  const fd = new FormData();
  fd.append('profile_picture', file);
  return request('/api/profile/picture', {
    method: 'PATCH',
    auth: true,
    isForm: true,
    body: fd,
  });
}

// ----- تسجيل الخروج -----
export async function logout() {
  try {
    await request('/api/logout', { method: 'POST', auth: true });
  } catch {
    /* نمسح التوكن محلياً على أي حال */
  } finally {
    // نمسح كل بيانات الجلسة على الجهاز (توكن + مستخدم + كاش/صورة/بيانات تجريبية)
    // حتى لا يتسرّب حسابٍ إلى حساب آخر عند التسجيل من جديد أو تبديل المستخدم.
    resetLocalUserData();
  }
}

// ----- حذف المستخدم (محمي) -----
export async function deleteUser() {
  return request('/api/delete-user', { method: 'DELETE', auth: true });
}

// ----- التحقق من وجود البريد (يُستخدم في نسيت كلمة المرور) -----
// إصلاح: كان الكود السابق يعامل أي 422 كـ"البريد غير مسجّل"،
// لكن Laravel يرجع 422 أيضاً لأخطاء صيغة البريد. نفرّق الآن:
//   - 4xx => نعتبره "غير مسجّل" بأمان.
//   - 5xx أو خطأ شبكة => نفترض مسجّلاً كي لا نمنع المستخدم.
export async function isEmailRegistered(email) {
  try {
    await request('/api/forgot-password', {
      method: 'POST',
      body: { email },
    });
    return true;
  } catch (err) {
    if (err && err.status >= 400 && err.status < 500) {
      return false;
    }
    return true;
  }
}

// ----- المسار بعد تسجيل الدخول/التسجيل -----
// يعتمد على دور المستخدم المُعاد من الباك إند (`user.role`) ويرسل كل دور
// إلى لوحة تحكمه الخاصة. لوحتا "العميل" و"صاحب المساحة" تستخدمان نفس
// الصفحة المؤقتة حالياً، وستنفصلان عند بنائهما تفصيلياً.
const DASHBOARD_PATHS = {
  space_owner: '/dashboard/space-owner',
  owner: '/dashboard/space-owner',
  customer: '/dashboard/customer',
};

export function getHomePath(role) {
  // نطبّع الدور أولاً (قد يأتي "space owner" أو "Owner" أو "SpaceOwner").
  const rawRole = normalizeRole(role) || normalizeRole(getUser()?.role);
  // شرط صارم: الدور الناقص/غير المعروف لا يُرسَل إلى أي لوحة تحكم كي لا يحدث
  // خلط بين لوحة العميل ولوحة صاحب المساحة — يُحوَّل للرئيسية بدلاً من ذلك.
  return DASHBOARD_PATHS[rawRole] || '/';
}

// ----- حالة الدور للواجهات العامة (زائر / عميل / صاحب مساحة) -----
// الزائر ليس دوراً في الباك إند، بل غياب توكن. نحتاج تمييزه صراحةً في الصفحات
// العامة (تفاصيل المساحة) لأن قانون الحجز يختلف بين الثلاثة:
//   زائر        -> لا يحجز، يُحوَّل لتسجيل الدخول.
//   عميل        -> يحجز.
//   صاحب مساحة  -> عرض فقط (مساحته هي، لا يحجز空間ها لنفسه).
export const ROLE_VISITOR = 'visitor';
export const ROLE_CUSTOMER = 'customer';
export const ROLE_SPACE_OWNER = 'space_owner';

/**
 * الدور الفعّال للمستخدم الحالي، مطبّعاً، مع إرجاع "visitor" عند غياب التوكن.
 * يعتمد على التوكن لا على وجود كائن المستخدم، حتى لا يُمنح الحجز لمستخدم
 * متبقٍ في localStorage بعد انتهاء جلسته.
 * @returns {'visitor'|'customer'|'space_owner'}
 */
export function getCurrentRole() {
  if (!isLoggedIn()) return ROLE_VISITOR;
  return normalizeRole(getUser()?.role) || ROLE_VISITOR;
}

/** الزائر غير المسجّل — لا يملك أي صلاحية حجز. */
export function isVisitor() {
  return getCurrentRole() === ROLE_VISITOR;
}

/** العميل وحده يحجز المساحات. صاحب المساحة يُعامل كـ owner ويُمنع من الحجز. */
export function canBook() {
  return getCurrentRole() === ROLE_CUSTOMER;
}

/**
 * هل صاحب المساحة الحالي هو مالك هذه المساحة؟
 * يُرجع false للزائر وللعميل، فلا يُسرَّب لبيانات المالك إلا لصاحبه.
 */
export function ownsSpace(space) {
  if (getCurrentRole() !== ROLE_SPACE_OWNER || !space) return false;
  const me = getUser() || {};
  const myId = me.id ?? me.user_id ?? me.space_id;
  const ownerId = space.owner_id ?? space.user_id ?? space.space_owner_id;
  if (myId != null && ownerId != null) {
    return String(myId) === String(ownerId);
  }
  // لا معرّفات: نقارن البريد/الاسم كحل احتياطي قبل تسريب الإحصاءات.
  const myEmail = String(me.email || '').trim().toLowerCase();
  const ownerEmail = String(space.owner_email || space.email || '').trim().toLowerCase();
  if (myEmail && ownerEmail) return myEmail === ownerEmail;
  return false;
}
