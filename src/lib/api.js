// عميل API مركزي للتواصل مع باك إند Laravel على Render.
// المصادقة عبر Bearer token (Sanctum opaque token، ليس JWT).
// ملاحظة: Laravel Sanctum + Bearer token لا يتطلب إرسال Origin في الطلب؛
// ولذلك لا نضع أي ترويسة Origin هنا (متروكة للمتصفح تلقائياً).

const BASE_URL = (
  import.meta.env.VITE_API_URL ||
  'https://back-end-kwba.onrender.com'
).replace(/\/$/, '');

// يحوّل مسار صورة نسبي (/storage/...) إلى رابط كامل على نفس مخدم الباك إند،
// لأن ملفات المستخدمين تُخزَّن هناك لا على مخدم الواجهة.
// صلاحيات الوصول: تصدير BASE_URL نفسه أيضاً إن احتاجت أجزاء أخرى إليه.
export { BASE_URL };

export function imageUrl(path) {
  if (!path || typeof path !== 'string') return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

const TOKEN_KEY = '***';
const USER_KEY = '***:user';

// مدة المهلة الافتراضية لكل طلب (مدة كافية لـ Render في cold start).
const DEFAULT_TIMEOUT_MS = 25000;

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* التخزين غير متاح */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

// ----- بيانات المستخدم الحالية (role وغيرها) تُحفظ مع التوكن -----
// توفر الدور فوراً بعد تسجيل الدخول دون طلب إضافي، وتستخدمه
// صفحات التحويل اللاحقة لاختيار لوحة التحكم المناسبة للدور.
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user && typeof user === 'object' ? user : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  try {
    if (!user) return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* التخزين غير متاح */
  }
}

export function clearUser() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

// مسح كل بيانات الجلسة على الجهاز: التوكن، بيانات المستخدم، وصورة الملف،
// وكاش لوحات التحكم (العميل والمالك)، ومخازن الوضع التجريبي للطلبات
// الخاصة والإشعارات. مستخدم جديد بعد حذف حساب قديم لن يرى صورة/بيانات
// الحساب السابق لأنها محفوظة تحت مفاتيح ثابتة غير مرتبطة بمعرّف المستخدم.
const RESET_KEYS = [
  'profile_picture_url',
  'profile_picture_version',
  'masahati_dashboard_cache',
  'masahati_owner_cache',
  'masahati_owner_demo_v1',
  'masahati_owner_data_v1',
  'masahati_owner_ads_demo_v1',
  'masahati_owner_ads_data_v1',
  'masahati_customer_ads_seen_v1',
  'masahati_reviews_demo_v1',
  'masahati_special_requests_demo_v1',
  'masahati_special_requests_data_v1',
  'masahati_special_requests_seen_v1',
  'masahati_notifications_demo_v1',
  'masahati_notifications_read_v1',
  'masahati_assistant_messages',
  'masahati_owner_documents_v1',
  'masahati.owner-docs',
  'masahati.owner-docs-sent',
];

export function resetLocalUserData() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    for (const key of RESET_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* التخزين غير متاح */
  }
}

export const SESSION_EXPIRED_KEY = 'masahati_session_expired';

export function consumeSessionExpired() {
  try {
    const raw = sessionStorage.getItem(SESSION_EXPIRED_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    return true;
  } catch {
    return false;
  }
}

let sessionExpiryRedirected = false;

function expireSession() {
  if (sessionExpiryRedirected) return;
  sessionExpiryRedirected = true;
  try {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
  } catch {
    /* التخزين غير متاح */
  }
  if (typeof window === 'undefined' || !window.location) return;
  const path = window.location.pathname;
  if (path === '/login' || path === '/signup') return;
  window.location.assign('/login?expired=true');
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// استخراج رسالة الخطأ الأولى من استجابة Laravel (message أو أول errors).
function extractErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (data.message && typeof data.message === 'string') return data.message;
  if (data.errors) {
    const firstKey = Object.keys(data.errors)[0];
    if (firstKey && Array.isArray(data.errors[firstKey])) {
      return data.errors[firstKey][0];
    }
  }
  return fallback;
}

/**
 * طلب أساسي.
 * @param {string} path مسار يبدأ بـ /api
 * @param {object} options { method, body (object|FormData), auth (bool), isForm (bool), timeoutMs (number) }
 */
export async function request(path, options = {}) {
  const { method = 'GET', body, auth = false, isForm = false, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const headers = { Accept: 'application/json' };
  const sentToken = auth ? getToken() : null;
  if (sentToken) headers['Authorization'] = `Bearer ${sentToken}`;

  let payload;
  if (isForm) {
    payload = body; // FormData (المتصفح يضيف content-type مع boundary)
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  // إصلاح: إضافة AbortController لتفادي الانتظار اللانهائي على Render free tier
  // (cold start قد يستغرق 30–60 ثانية).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err && err.name === 'AbortError') {
      throw new ApiError('انتهت مهلة الطلب. تحقق من الاتصال وحاول مجدداً.', 0, null);
    }
    throw new ApiError('تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.', 0, null);
  }
  clearTimeout(timer);

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    // 401 على طلب يحمل توكناً => نلغي الجلسة المحلية (زائر بلا توكن لا يُحال).
    if (res.status === 401 && sentToken) {
      clearToken();
      clearUser();
      expireSession();
    }
    throw new ApiError(
      extractErrorMessage(data, `تعذر إتمام الطلب (${res.status}).`),
      res.status,
      data
    );
  }

  // استجابة ناجحة لكنها HTML بدل JSON (مثال: الباك إند يعيد صفحة Laravel
  // الافتراضية بدلاً من تنفيذ المسار). نكشف ذلك لنظهر رسالة واضحة بدل فشل صامت.
  if (res.ok && text && data === null && /^\s*</.test(text)) {
    throw new ApiError(
      'استجابة الخادم غير متوقعة (صفحة HTML بدلاً من JSON). يبدو أن مسار الباك إند لم يُطبق بعد.',
      200,
      null
    );
  }

  return data;
}

export { ApiError };
