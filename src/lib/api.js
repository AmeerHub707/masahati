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
 *
 * قاعدة التوكن: يُقرأ من التخزين **لحظة الإرسال** لا لحظة بناء الطلب. لو
 * قُرئ عند البناء لأمكن أن يُرسل طلب بتوكن منتهٍ أو ناقص: الحساب يُكتب في
 * التخزين بعد استدعاء الجلب مباشرة (تسجيل الدخول، استعادة جلسة)، فالقراءة
 * المبكرة تُرسل `Authorization` قديماً أو لا ترسله أصلاً فيرجع الخادم 401
 * على طلب لم يُخطئه المستخدم.
 *
 *   requireToken  — لا يُرسل شيء بلا توكن: يُرمى خطأ 401 محلياً. يمنع
 *                   «طلب بلا مصادقة» أصلاً بدل انتظار ردّ 401 وعرضه.
 *   tokenGetter (fn) — دالة تُقرأ لحظة الإرسال (المسار المشرف: الجلسة قد
 *                   تُحفظ أو تُمسح بين بناء الطلب والإرسال).
 *   scopedToken   — توكن جلسة معيّنة (المشرف) لا يُخلط بتوكن العميل أبداً.
 *                   بدونه كان طلب المشرف بلا توكنه يُرسَل بتوكن العميل، فيردّ
 *                   الخادم 403/401 عن جلسة أخرى لا علاقة لها بالخطأ الحقيقي.
 *
 * @param {string} path مسار يبدأ بـ /api
 * @param {object} options {
 *   method, body (object|FormData), auth (bool), isForm (bool), timeoutMs (number),
 *   token (string)       — توكن صريح إن كان معروفاً مسبقاً،
 *   tokenGetter (fn)     — يُرجع التوكن من التخزين لحظة الإرسال (الأدقّ)،
 *   requireToken (bool)  — يُرفض الإرسال بلا توكن (افتراضياً: نعم مع auth)،
 *   scopedToken (bool)   — لا ترجع إلى توكن العميل عند غياب `token`،
 *   raw (bool)           — يعيد النص كما هو بدل JSON (لتصدير CSV)،
 *   onUnauthorized (fn)  — يُستدعى عند 401 **بعد** التأكد أن توكناً أُرسل.
 * }
 */
export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = false,
    isForm = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    token = null,
    tokenGetter = null,
    requireToken = auth,
    scopedToken = false,
    raw = false,
    onUnauthorized = null,
  } = options;

  // يُقرأ هنا بالضبط: بعد استدعاء الدالة، وقبل fetch مباشرة.
  const bearer = (typeof tokenGetter === 'function' ? tokenGetter() : token)
    || (scopedToken ? null : getToken());

  if (auth && requireToken && !bearer) {
    // لا نُرسل طلباً لنمرض منه: لا جلسة ⇒ لا طلب. نمنع 401 المزعجة في البداية.
    throw new ApiError('انتهت الجلسة. يرجى تسجيل الدخول من جديد.', 401, null);
  }

  const headers = { Accept: 'application/json' };
  if (auth && bearer) headers['Authorization'] = `Bearer ${bearer}`;

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
    // 401 حقيقي فقط: على مسار محمي **مع توكن أُرسل فعلاً**.
    //
    // لماذا الشرط الثاني: طلب بلا توكن (نقطة عامة، أو `requireToken` لم يمنعها
    // نقطة مثل تسجيل الدخول) يرجع 401 أيضاً، فمسح الجلسة عندها يُخرج مستخدماً
    // كانت جلسته سليمة ويحوّله إلى صفحة الدخول بلا سبب. والـ 403 لا يمسّ الجلسة
    // إطلاقاً: الحساب موجود لكن ليس مشرفاً، والجلسة صحيحة.
    if (res.status === 401 && auth && bearer) {
      if (onUnauthorized) onUnauthorized();
      else {
        clearToken();
        clearUser();
      }
    }
    throw new ApiError(
      extractErrorMessage(data, `تعذر إتمام الطلب (${res.status}).`),
      res.status,
      data
    );
  }

  // تصدير CSV: الرد نصي (text/csv) لا JSON، فنعيده كما هو.
  if (raw) return text;

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
