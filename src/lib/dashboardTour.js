// تخزين «إتمام الجولة التعريفية» — مفهرس بنطاق اللوحة (owner-tour / customer-tour)
// حتى لا يمنع إتمام جولة واحدة ظهور الجولة في اللوحة الأخرى، ولكل مستخدم مفتاح مستقل.
//
// المفتاح: masahati.<namespace>.v1.completed:<userId>   (و userId الفارغ = 'guest')
//
// إن كان localStorage غير متاح (وضع التصفح الخاص، أو بيئة اختبار) نبقى في الذاكرة
// خلال الجلسة فقط، حتى لا تنهار اللوحة عند أول زيارة.

const TOUR_PREFIX = 'masahati';
const memory = new Set();

function normalizeId(userId) {
  const value = String(userId ?? '').trim();
  return value || 'guest';
}

// هوية الجولة: لا يعيد الباك إند معرّفاً رقمياً في تسجيل الدخول (يأتي {message,token,name})
// ولا في GET /api/profile (يأتي {name,phone,email,role,picture,proof_document})، لذا
// كان getUser()?.id دائماً فارغاً وتنطبق كل الجولات على دلو «guest» واحد مشترك:
// من يُتمّ الجولة مرة واحدة يُخفيها عن كل مستخدم جديد على نفس الجهاز (تُحمَّل مرة واحدة فقط).
// الآن نستعمل أول معرّف مستقر متاح (id ثم البريد ثم الهاتف ثم الاسم) ليكون المفتاح خاصاً بكل مستخدم.
export function resolveTourUserId(...sources) {
  const fields = ['id', 'user_id', 'email', 'phone', 'name'];
  for (const field of fields) {
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      const value = String(src[field] ?? '').trim();
      if (value) return value;
    }
  }
  return null;
}

function normalizeNamespace(namespace) {
  const value = String(namespace ?? '').trim();
  return value || 'tour';
}

export function dashboardTourKey(namespace, userId) {
  return `${TOUR_PREFIX}.${normalizeNamespace(namespace)}.v1.completed:${normalizeId(userId)}`;
}

export function hasCompletedDashboardTour(namespace, userId) {
  const key = dashboardTourKey(namespace, userId);
  if (memory.has(key)) return true;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markDashboardTourCompleted(namespace, userId) {
  const key = dashboardTourKey(namespace, userId);
  memory.add(key);
  try {
    localStorage.setItem(key, '1');
  } catch { /* التخزين غير متاح: نكتفي بالحالة داخل الجلسة */ }
}

export function clearDashboardTourCompleted(namespace, userId) {
  const key = dashboardTourKey(namespace, userId);
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch { /* لا حاجة للفشل هنا */ }
}
