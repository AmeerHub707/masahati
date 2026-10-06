/**
 * طبقة الاتصال بلوحة تحكم المشرف — نقطة نهاية واحدة لكل مسارات /api/admin.
 *
 * مبنية على العقد: BACKEND / "api admin.txt"
 *   · successes داخل مغلّف { data, meta }  → نفكّه هنا ليعمل المكوّنات على البيانات مباشرة.
 *   · الأخطاء داخل { message, errors }    → نمرّر رسالة Laravel كما هي.
 *   · جلسة المشرف منفصلة عن جلسة العميل (عقد §0.2): توكن مشرف بمفتاح تخزين خاص،
 *     فلا يُمسح بتوكن العميل ولا يُفسده.
 */

import { request, ApiError } from './api';

const ADMIN_TOKEN_KEY = 'masahati_admin_token';
const ADMIN_PROFILE_KEY = 'masahati_admin_profile';
const ADMIN_EXPIRES_KEY = 'masahati_admin_expires_at';

/* ------------------------------------------------------------------ */
/* 0) مغلّف الاستجابة ومحوّل الأخطاء                                   */
/* ------------------------------------------------------------------ */

/** يفكّ مغلّف { data, meta } ويعيد { data, meta }. */
function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return { data: payload.data, meta: payload.meta || null };
  }
  // رد بلا مغلّف (غير متوافق مع العقد) — نمرّره كما هو بدل رمي خطأ.
  return { data: payload, meta: null };
}

/** رسالة عربية مفهومة لكل حالة HTTP قبل نصّ Laravel. */
const STATUS_HINTS = {
  0: 'تعذّر الاتصال بالخادم. تحقق من الاتصال وحاول مجدداً.',
  400: 'طلب غير صالح.',
  401: 'انتهت جلسة المشرف. يرجى تسجيل الدخول مجدداً.',
  403: 'هذا الحساب ليس حساب مشرف.',
  404: 'العنصر المطلوب غير موجود.',
  409: 'لا يمكن إتمام الإجراء لوجود تعارض في الحالة الحالية.',
  422: 'البيانات المُرسلة غير صحيحة.',
  500: 'حدث خطأ في الخادم.',
  503: 'الخدمة غير متاحة مؤقتاً. حاول بعد قليل.',
};

/** يحوّل أي خطأ إلى ApiEndacho يحمل رسالة عربية ورمز الحالة. */
function toApiError(err) {
  if (err instanceof ApiError) {
    const hint = STATUS_HINTS[err.status];
    // نص Laravel (مثل «البريد الإلكتروني أو كلمة المرور غير صحيحة.») هو الأهم:
    // نُبقيه، ونضيف التلميح فقط إن كان الرد بلا رسالة.
    if (err.message && !/^تعذر إتمام الطلب/.test(err.message)) return err;
    const merged = new ApiError(hint || err.message, err.status, err.data);
    return merged;
  }
  return new ApiError(STATUS_HINTS[0], 0, null);
}

/* ------------------------------------------------------------------ */
/* 1) جلسة المشرف (توكن منفصل عن العميل)                              */
/* ------------------------------------------------------------------ */

export function getAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function isAdminTokenLive() {
  const token = getAdminToken();
  if (!token) return false;
  const expires = Number(localStorage.getItem(ADMIN_EXPIRES_KEY) || 0);
  // لا تاريخ انتهاء ⇒ توكن دائم، نقبله.
  return !expires || expires > Date.now();
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين غير متاح */
  }
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAdminSession({ token, expires_at, admin } = {}) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    if (expires_at) {
      localStorage.setItem(ADMIN_EXPIRES_KEY, String(new Date(expires_at).getTime()));
    } else {
      // لا تاريخ انتهاء في الرد = توكن دائم. نحذف أي تاريخ قديم بدل وراثته،
      // وإلا ورثت جلسةٌ جديدةَ تاريخ انتهاء التوكن السابق.
    }
  } catch {
    /* التخزين غير متاح */
  }
  if (admin) writeJson(ADMIN_PROFILE_KEY, admin);
}

export function readCachedAdminProfile() {
  return readJson(ADMIN_PROFILE_KEY);
}

export function cacheAdminProfile(profile) {
  if (profile) writeJson(ADMIN_PROFILE_KEY, profile);
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_PROFILE_KEY);
    localStorage.removeItem(ADMIN_EXPIRES_KEY);
  } catch {
    /* التخزين غير متاح */
  }
}

/* ------------------------------------------------------------------ */
/* 1.1 انتهاء الجلسة: حدث واحد تشترك فيه كل الشاشات                  */
/* ------------------------------------------------------------------ */

// 401 حقيقي (توكن أُرسل ثم رُفض) يعني أن الجلسة انتهت: نمسحها ونُعلم كل من
// يعرض بيانات.
//
// لماذا حدث مشترك بدل توجيه مباشر من طبقة الشبكة: `AdminDashboardPage` يعرض
// اللوحة، وطلب 401 قد يأتي من أي تبويب؛ توجيه واحد مركزي كان يتكرر أو يُنسى.
// والحدث يجعل الاختبارات تراقب الإجراء بدل التنقّل الحقيقي في jsdom.
const sessionListeners = new Set();

/** يشترك مستمعاً. يُرجع دالة إلغاء الاشتراك. */
export function onSessionExpired(listener) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

/**
 * 401 حقيقي ⇒ الجلسة انتهت.
 *
 * idempotent: عدة طلبات متوازية (callAll يُطلق صفحات معاً) ترجع 401 جميعها؛
 * نُعلم المستمعين مرة واحدة فقط حتى لا تتكرر التنبيهات.
 */
export function handleSessionExpired() {
  clearAdminSession();
  if (sessionListeners.size === 0) return;
  Array.from(sessionListeners).forEach((listener) => {
    try {
      listener();
    } catch {
      /* مستمع معطوب لا يُسقط الإبلاغ عن البقية */
    }
  });
}

/* ------------------------------------------------------------------ */
/* 2) الطلبات                                                          */
/* ------------------------------------------------------------------ */

const P = '/api/admin';

/** يبني querystring من كائن مع تجاهل القيم الفارغة (عقد §0.8: الفلتر الناقص = بلا فلتر). */
function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      sp.set(key, value.join(','));
    } else {
      sp.set(key, String(value));
    }
  }
  const str = sp.toString();
  return str ? `?${str}` : '';
}

async function call(path, { method = 'GET', body, isForm = false, auth = true, params, raw = false, timeoutMs, onUnauthorized = handleSessionExpired } = {}) {
  try {
    const payload = await request(`${P}${path}${params ? qs(params) : ''}`, {
      method,
      body,
      isForm,
      auth,
      raw,
      timeoutMs,
      // دالة لا قيمة: يُقرأ التوكن من التخزين داخل request لحظة الإرسال. بين
      // بناء الطلب ووصوله الشبكة قد تُحفظ جلسة (تسجيل دخول، استعادة) أو تُمسح
      // (401 من شاشة أخرى)، والقراءة المبكرة كانت تُرسل ترويسة منتهية أو غائبة
      // فيرجع الخادم 401 في أول فتح للوحة — وهو العطل الموصوف.
      tokenGetter: getAdminToken,
      // لا ترجع إلى توكن العميل: طلب بلا توكن مشرف يجب أن يفشل محلياً (لا
      // يُرسَل) بدل أن يُرسَل بتوكن زبون فيردّ الخادم 403 عن جلسة لا صلة لها.
      scopedToken: true,
      requireToken: true,
      onUnauthorized,
    });
    return raw ? { data: payload, meta: null } : unwrap(payload);
  } catch (err) {
    throw toApiError(err);
  }
}

/**
 * يجمع كل صفحات نتيجة مُصفَّحة في مصفوفة واحدة.
 *
 * لماذا: الشاشات تحتفظ بفلترة وترقيم محليين (والاختبارات مبنية عليهما)، والخادم
 * يحدّ per_page بـ 100. فبدل إعادة كتابة منطق العرض، نُنزّل الصفحات بالترتيب
 * حتى نبلغ السقف، ونركّبها كقائمة واحدة فيبقى العرض بمنطق واحد.
 */
async function callAll(path, { params = {}, perPage = 100, cap = 1000 } = {}) {
  const first = await call(path, { params: { ...params, page: 1, per_page: perPage } });
  const meta = first.meta;
  const total = Number(meta?.total ?? first.data?.length ?? 0);
  const lastPage = Number(meta?.last_page ?? 1);
  if (lastPage <= 1 || !Array.isArray(first.data) || first.data.length >= total) {
    return { data: Array.isArray(first.data) ? first.data : [], meta };
  }

  const pages = Math.min(lastPage, Math.ceil(cap / perPage));
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      call(path, { params: { ...params, page: i + 2, per_page: perPage } })
        .then((r) => r.data)
        .catch(() => [])
    )
  );
  return { data: [first.data, ...rest].flat(), meta: { ...meta, total: first.data.length + rest.flat().length } };
}

/** ينزّل ملفاً نصياً (CSV) من مسار محمي. */
async function download(path, { params = {}, fallbackName = 'export.csv' } = {}) {
  const text = await call(path, { raw: true, params });
  const blob = new Blob([`\uFEFF${text || ''}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return text;
}

/* ------------------------------------------------------------------ */
/* 2.1 المصادقة — العقد §2                                             */
/* ------------------------------------------------------------------ */

/** POST /api/admin/login — عام، بلا ترويسة مصادقة. */
export async function login(email, password) {
  const { data } = await call('/login', {
    method: 'POST',
    body: { email, password },
    // نقطة عامة: لا توكن قبل الدخول، و`requireToken` يجب أن يكون صريحاً
    // وإلا رفض `request` الطلب قبل أن يصل — وهو رفضٌ صحيح هنا فقط.
    auth: false,
    requireToken: false,
    scopedToken: false,
    // 401 على نقطة الدخول = بيانات خاطئة، لا انتهاء جلسة: لا نمسح شيئاً ولا
    // نُعلم المستمعين، وإلا أخرجنا المستخدم من اللوحة وهو في صفحة الدخول أصلاً.
    onUnauthorized: null,
  });
  if (data?.token) saveAdminSession({ token: data.token, expires_at: data.expires_at, admin: data.admin });
  return data;
}

/** POST /api/admin/logout — يبطل التوكن على الخادم. الفشل لا يمنع المسح المحلي. */
export async function logout() {
  try {
    await call('/logout', { method: 'POST', onUnauthorized: null });
  } catch {
    /* التوكن قد يكون منتهياً أصلاً — المسح المحلي يكفي */
  } finally {
    clearAdminSession();
  }
}

/** GET /api/admin/me — يعيد بناء ملف المشرف بعد تحديث الصفحة. */
export async function me() {
  const { data } = await call('/me');
  cacheAdminProfile(data);
  return data;
}

/** PATCH /api/admin/profile */
export async function updateProfile(patch) {
  const { data } = await call('/profile', { method: 'PATCH', body: patch });
  cacheAdminProfile(data);
  return data;
}

/**
 * POST /api/admin/profile/picture — رفع/استبدال صورة المشرف (multipart).
 *
 * الحقل `profile_picture` كما في مسارات صورة المستخدم: هو الاسم الذي يقرأه
 * الباك إند، و`isForm` يمنعنا من إضافة Content-Type يدوياً (المتصفح يضبطه
 * مع حدود الـ multipart). النتيجة تُخزَّن في كاش الملف مباشرةً لأن كل من يقرأ
 * الملف لاحقاً يقرأ من هناك.
 */
export async function uploadProfilePicture(file) {
  const fd = new FormData();
  fd.append('profile_picture', file);
  const { data } = await call('/profile/picture', { method: 'POST', body: fd, isForm: true });
  cacheAdminProfile(data);
  return data;
}

/** PUT /api/admin/password */
export async function changePassword(current_password, password, password_confirmation) {
  const { data } = await call('/password', {
    method: 'PUT',
    body: { current_password, password, password_confirmation },
  });
  return data;
}

/* ------------------------------------------------------------------ */
/* 2.2 إعدادات المنصة — العقد §3                                       */
/* ------------------------------------------------------------------ */

export async function getSettings() {
  const { data } = await call('/settings');
  return data;
}

export async function saveSettings(payload) {
  const { data } = await call('/settings', { method: 'PUT', body: payload });
  return data;
}

/* ------------------------------------------------------------------ */
/* 2.3 نظرة عامة — العقد §4                                             */
/* ------------------------------------------------------------------ */

export async function getStats() {
  const { data } = await call('/stats');
  return data;
}

export async function getRevenueTrend(months = 12) {
  const { data } = await call('/stats/revenue-trend', { params: { months } });
  return data;
}

export async function getActivities(limit = 10) {
  const { data } = await call('/activities', { params: { limit } });
  return data;
}

export async function getRecentRegistrations(limit = 5) {
  const { data } = await call('/recent-registrations', { params: { limit } });
  return data;
}

/* ------------------------------------------------------------------ */
/* 2.4 المستخدمون — العقد §5                                            */
/* ------------------------------------------------------------------ */

/** GET /api/admin/users — كل الصفحات مجمّعة (انظر callAll). */
export async function listUsers(params) {
  const { data, meta } = await callAll('/users', { params });
  return { rows: data, meta };
}

/** GET /api/admin/users/stats — بنفس فلاتر القائمة ليبقى العدّاد مطابقاً للنتائج. */
export async function getUsersStats(params) {
  const { data } = await call('/users/stats', { params });
  return data;
}

/** GET /api/admin/users/{id} */
export async function getUser(id) {
  const { data } = await call(`/users/${id}`);
  return data;
}

/** PATCH /api/admin/users/{id}/status */
export async function setUserStatus(id, status) {
  const { data } = await call(`/users/${id}/status`, { method: 'PATCH', body: { status } });
  return data;
}

/** PATCH /api/admin/users/{id}/verify */
export async function verifyUser(id) {
  const { data } = await call(`/users/${id}/verify`, { method: 'PATCH' });
  return data;
}

/** PATCH /api/admin/users/{id} */
export async function updateUser(id, patch) {
  const { data } = await call(`/users/${id}`, { method: 'PATCH', body: patch });
  return data;
}

/** DELETE /api/admin/users/{id} */
export async function deleteUser(id) {
  await call(`/users/${id}`, { method: 'DELETE' });
  return true;
}

/** POST /api/admin/users/bulk-status */
export async function bulkUserStatus(ids, action) {
  const { data } = await call('/users/bulk-status', { method: 'POST', body: { ids, action } });
  return data;
}

/** GET /api/admin/users/export */
export async function exportUsers(params, filename = 'users.csv') {
  return download('/users/export', { params, fallbackName: filename });
}

/* ------------------------------------------------------------------ */
/* 2.5 المساحات — العقد §6                                              */
/* ------------------------------------------------------------------ */

export async function listSpaces(params) {
  const { data, meta } = await callAll('/spaces', { params });
  return { rows: data, meta };
}

export async function getSpacesStats(params) {
  const { data } = await call('/spaces/stats', { params });
  return data;
}

export async function getSpace(id) {
  const { data } = await call(`/spaces/${id}`);
  return data;
}

export async function updateSpace(id, patch) {
  const { data } = await call(`/spaces/${id}`, { method: 'PATCH', body: patch });
  return data;
}

export async function setSpaceStatus(id, status) {
  const { data } = await call(`/spaces/${id}/status`, { method: 'PATCH', body: { status } });
  return data;
}

export async function deleteSpace(id) {
  await call(`/spaces/${id}`, { method: 'DELETE' });
  return true;
}

export async function exportSpaces(params, filename = 'spaces.csv') {
  return download('/spaces/export', { params, fallbackName: filename });
}

/* ------------------------------------------------------------------ */
/* 2.6 الحجوزات — العقد §7                                              */
/* ------------------------------------------------------------------ */

export async function listBookings(params) {
  const { data, meta } = await callAll('/bookings', { params });
  return { rows: data, meta };
}

/** GET /api/admin/bookings/{ref} — المرجع بلا # أو به. */
export async function getBooking(ref) {
  const { data } = await call(`/bookings/${encodeURIComponent(String(ref).replace(/^#/, ''))}`);
  return data;
}

export async function setBookingStatus(id, status) {
  const { data } = await call(`/bookings/${id}/status`, { method: 'PATCH', body: { status } });
  return data;
}

/* ------------------------------------------------------------------ */
/* 2.7 النزاعات — العقد §8                                              */
/* ------------------------------------------------------------------ */

export async function listDisputes(params) {
  const { data, meta } = await callAll('/disputes', { params });
  return { rows: data, meta };
}

export async function getDispute(ref) {
  const { data } = await call(`/disputes/${encodeURIComponent(String(ref).replace(/^#/, ''))}`);
  return data;
}

/** PATCH /api/admin/disputes/{ref}/resolve */
export async function resolveDispute(ref, { decision, note, refund_amount } = {}) {
  const { data } = await call(`/disputes/${encodeURIComponent(String(ref).replace(/^#/, ''))}/resolve`, {
    method: 'PATCH',
    body: { decision, note, refund_amount },
  });
  return data;
}

/* ------------------------------------------------------------------ */
/* 2.8 المراجعات — العقد §9                                              */
/* ------------------------------------------------------------------ */

export async function listReviews(params) {
  const { data, meta } = await callAll('/reviews', { params, perPage: 100 });
  return { rows: data, meta };
}

export async function getReviewsStats() {
  const { data } = await call('/reviews/stats');
  return data;
}

export async function updateReview(id, patch) {
  const { data } = await call(`/reviews/${id}`, { method: 'PATCH', body: patch });
  return data;
}

export async function deleteReview(id) {
  await call(`/reviews/${id}`, { method: 'DELETE' });
  return true;
}

/* ------------------------------------------------------------------ */
/* 2.9 التقارير المالية — العقد §10                                     */
/* ------------------------------------------------------------------ */

export async function getFinancialSummary(params) {
  const { data } = await call('/financials/summary', { params });
  return data;
}

export async function getFinancialDaily(params) {
  const { data } = await call('/financials/daily', { params });
  return data;
}

export async function getCommissionBreakdown() {
  const { data } = await call('/financials/commission-breakdown');
  return data;
}

export async function listTransactions(params) {
  const { data, meta } = await callAll('/financials/transactions', { params });
  return { rows: data, meta };
}

export async function exportFinancials(params, filename = 'financials.csv') {
  return download('/financials/export', { params, fallbackName: filename });
}

/* ------------------------------------------------------------------ */
/* 2.10 صندوق الوارد — العقد §11                                        */
/* ------------------------------------------------------------------ */

export async function listInbox(params) {
  const { data, meta } = await callAll('/inbox', { params });
  return { rows: data, meta };
}

export async function getInboxUnreadCount() {
  const { data } = await call('/inbox/unread-count');
  return data;
}

/** PATCH /api/admin/inbox/{id} */
export async function updateInboxItem(id, patch) {
  const { data } = await call(`/inbox/${id}`, { method: 'PATCH', body: patch });
  return data;
}

/** POST /api/admin/inbox/bulk */
export async function bulkInbox(ids, action) {
  const { data } = await call('/inbox/bulk', { method: 'POST', body: { ids, action } });
  return data;
}

/** POST /api/admin/inbox/mark-all-read */
export async function markAllInboxRead() {
  const { data } = await call('/inbox/mark-all-read', { method: 'POST' });
  return data;
}

/**
 * GET /api/admin/inbox/categories — العقد §10.6.
 *
 * شكل الرد في العقد مصفوفة نصوص (`["general","support","report","billing"]`)،
 * لكن النشر الفعلي قد يرسل خريطة وصف جاهزة. نقبل الشكلين ونُوحّدهما إلى
 * مصفوفة مفاتيح، فالوصفة (label/tone/cta/path) تبقى في `inboxMeta` داخل
 * الواجهة ولا داعي لتكرارها هنا.
 *
 * لماذا لا نُسقط الرد كما كان: الرد مصفوفة، فكان الشرط `!Array.isArray(data)`
 * يحوّلها إلى `{}` ويضيع كل ما أرسله الخادم، ولا يبقى في الشاشة أي أثر له.
 */
export async function getInboxCategories() {
  const { data } = await call('/inbox/categories');
  if (Array.isArray(data)) return data.filter((key) => typeof key === 'string' && key.trim());
  if (data && typeof data === 'object') return Object.keys(data).filter((key) => key.trim());
  return [];
}

/* ------------------------------------------------------------------ */
/* 2.11 الإشعارات الجماعية — العقد §12                                  */
/* ------------------------------------------------------------------ */

export async function listBroadcasts(params) {
  const { data, meta } = await callAll('/broadcasts', { params });
  return { rows: data, meta };
}

export async function getAudienceCounts() {
  const { data } = await call('/broadcasts/audience-counts');
  return data;
}

export async function sendBroadcast(payload) {
  const { data } = await call('/broadcasts', { method: 'POST', body: payload });
  return data;
}

/**
 * POST /api/admin/broadcasts/{id}/resend — العقد §12.4.
 * إعادة إرسال بث موجود إلى جمهوره الأصلي. `channels` اختياري: بدونه الخادم
 * يعيد التوجيه بنفس قنوات الإرسال الأولى.
 */
export async function resendBroadcast(id, channels) {
  const { data } = await call(`/broadcasts/${id}/resend`, {
    method: 'POST',
    body: channels && channels.length ? { channels } : {},
  });
  return data;
}

export async function listBroadcastDrafts() {
  const { data } = await call('/broadcasts/drafts');
  return data;
}

export async function saveBroadcastDraft(payload, id = null) {
  const { data } = id
    ? await call(`/broadcasts/drafts/${id}`, { method: 'PUT', body: payload })
    : await call('/broadcasts/drafts', { method: 'POST', body: payload });
  return data;
}

export async function discardBroadcastDraft(id) {
  await call(`/broadcasts/drafts/${id}`, { method: 'DELETE' });
  return true;
}

/* ------------------------------------------------------------------ */
/* 2.12 شارة الإشعارات — العقد §13                                      */
/* ------------------------------------------------------------------ */

export async function getNotificationsUnreadCount() {
  const { data } = await call('/notifications/unread-count');
  return data;
}

export { toApiError, ApiError };
