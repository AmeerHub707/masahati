// عميل API مركزي للتواصل مع باك إند Laravel على Render.
// المصادقة عبر Bearer token (Sanctum opaque token، ليس JWT).
// ملاحظة: Laravel Sanctum + Bearer token لا يتطلب إرسال Origin في الطلب؛
// ولذلك لا نضع أي ترويسة Origin هنا (متروكة للمتصفح تلقائياً).

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const TOKEN_KEY = '***';

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
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

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
    // 401 على مسار محمي => نلغي الجلسة المحلية.
    if (res.status === 401 && auth) clearToken();
    throw new ApiError(
      extractErrorMessage(data, `تعذر إتمام الطلب (${res.status}).`),
      res.status,
      data
    );
  }

  return data;
}

export { ApiError };
