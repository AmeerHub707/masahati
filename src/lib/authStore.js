// تخزين المصادقة الحقيقي — يتواصل مع باك إند Laravel على Render.
// المصادقة عبر Bearer token (Sanctum) يُحفظ في localStorage.
// التوكن هو المرجع الوحيد لكون الجلسة نشطة؛ لا نعتمد على أي علم إضافي.

import { request, getToken, setToken, clearToken, ApiError } from './api';

// إعادة التصدير لتسهيل الاستيراد من صفحات المصادقة
export { request, ApiError };

// ----- حالة الجلسة: مبنية على وجود التوكن فقط -----
// إصلاح: كان الكود السابق يعتمد على SESSION_KEY بالإضافة إلى التوكن،
// ما يسمح بإظهار واجهة المسجّل بعد انتهاء صلاحية التوكن في السيرفر.
// الآن: التوكن هو المرجع الوحيد.
export function isLoggedIn() {
  return !!getToken();
}

// ----- تسجيل الدخول -----
export async function login(email, password) {
  const data = await request('/api/login', {
    method: 'POST',
    body: { login: email, password },
  });
  if (data && data.token) {
    setToken(data.token);
    return data;
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

// ----- بيانات المستخدم الحالي (محمي) -----
export async function userDetails() {
  return request('/api/user-details', { method: 'GET', auth: true });
}

// ----- تسجيل الخروج -----
export async function logout() {
  try {
    await request('/api/logout', { method: 'POST', auth: true });
  } catch {
    /* نمسح التوكن محلياً على أي حال */
  } finally {
    clearToken();
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
