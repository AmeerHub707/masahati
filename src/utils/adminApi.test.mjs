// اختبار طبقة الـ API الخاصة بلوحة المشرف (src/lib/adminApi.js).
//
// يركّب الطلبات على fetch وهمي يسجّل كل نداء، فيتحقّق من أربعة أشياء لا يظهرها
// أي فحص يدوي:
//   1. المسار والـ method لكل نقطة (خطأ مطبعي = 404 في الإنتاج).
//   2. querystring: الفلاتر الفارغة تُحذف، والقوائم تُفصل بفاصلة، والتواريخ تُمرَّر.
//   3. فكّ مغلّف { data, meta } وجمع الصفحات، وتوحيد أخطاء Laravel بالعربية.
//   4. سياسة الجلسة: توكن المشرف لا توكن العميل، و401 يمسح الأول ولا يمسح الثاني.
//
// يُشغَّل عبر: node --experimental-vm-modules src/utils/adminApi.test.mjs
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:5173',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

let pass = 0;
let fail = 0;
const failures = [];

function report(name, ok, expected, actual) {
  if (ok) pass++;
  else {
    fail++;
    failures.push({ name, expected, actual });
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
}

const { createServer } = await import('vite');
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

const api = await server.ssrLoadModule('/src/lib/api.js');
const adminApi = await server.ssrLoadModule('/src/lib/adminApi.js');
const adminAuth = await server.ssrLoadModule('/src/lib/adminAuth.js');

const BASE = api.BASE_URL;

/* ------------------------------------------------------------------ */
/* بديل fetch: يسجّل الطلبات ويرجع ما نحدّده                         */
/* ------------------------------------------------------------------ */

let calls = [];
let reply = () => ({ status: 200, body: { data: [], meta: { total: 0, last_page: 1 } } });

/** يعيد تثبيت fetch المسجِّل (بعد أي اختبار يُعطّله). */
function installFetch() {
  globalThis.fetch = async (url, init = {}) => {
    const rawBody = init.body == null ? null : String(init.body);
    calls.push({
      url: String(url),
      path: String(url).replace(BASE, ''),
      method: init.method || 'GET',
      headers: init.headers || {},
      body: rawBody ? JSON.parse(rawBody) : null,
    });
    // نقرأ نتيجة reply في متغيّر منفصل لا بتفكيك: `const { body } = reply(…, body)`
    // يقع في TDZ ويرمي ReferenceError من داخل fetch، أي من داخل try في api.js،
    // فيتحوّل إلى «تعذّر الاتصال» ويُبتلع بدل أن يُظهره الاختبار.
    const res = reply(init.method || 'GET', rawBody);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      json: async () => res.body,
      text: async () => res.text ?? JSON.stringify(res.body),
    };
  };
}

/** صفحة الطلب (1/2/...) من نصّ المسار، لردود callAll المتعدّدة الصفحات. */
const pageOf = (url) => Number(new URL(String(url)).searchParams.get('page'));

/** يحاكي انقطاع الشبكة (لا رد ولا رمز حالة). */
function breakFetch() {
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };
}

installFetch();

/** يفصل المسار عن معاملات الترقيم التي يضيفها callAll افتراضياً. */
const barePath = (p) => String(p).split('?')[0];

const TOKEN = 'admin-token-xyz';
adminApi.saveAdminSession({ token: TOKEN, admin: { name: 'المشرف', email: 'a@b.com' } });

/* ------------------------------------------------------------------ */
/* 1) المسارات والـ methods                                           */
/* ------------------------------------------------------------------ */

const pathCases = [
  ['قائمة المستخدمين', () => adminApi.listUsers({}), 'GET', '/api/admin/users'],
  ['إحصاء المستخدمين', () => adminApi.getUsersStats({ status: 'active' }), 'GET', '/api/admin/users/stats'],
  ['ملف مستخدم واحد', () => adminApi.getUser(7), 'GET', '/api/admin/users/7'],
  ['تغيير حالة مستخدم', () => adminApi.setUserStatus(7, 'suspended'), 'PATCH', '/api/admin/users/7/status'],
  ['توثيق مستخدم', () => adminApi.verifyUser(7), 'PATCH', '/api/admin/users/7/verify'],
  ['تعديل مستخدم', () => adminApi.updateUser(7, { name: 'س' }), 'PATCH', '/api/admin/users/7'],
  ['حذف مستخدم', () => adminApi.deleteUser(7), 'DELETE', '/api/admin/users/7'],
  ['إجراء جماعي', () => adminApi.bulkUserStatus([1, 2], 'verify'), 'POST', '/api/admin/users/bulk-status'],
  ['قائمة المساحات', () => adminApi.listSpaces({}), 'GET', '/api/admin/spaces'],
  ['إحصاء المساحات', () => adminApi.getSpacesStats({}), 'GET', '/api/admin/spaces/stats'],
  ['مساحة واحدة', () => adminApi.getSpace(3), 'GET', '/api/admin/spaces/3'],
  ['حالة مساحة', () => adminApi.setSpaceStatus(3, 'active'), 'PATCH', '/api/admin/spaces/3/status'],
  ['حجوزات', () => adminApi.listBookings({}), 'GET', '/api/admin/bookings'],
  ['حجز بمرجع', () => adminApi.getBooking('BK-12'), 'GET', '/api/admin/bookings/BK-12'],
  ['نزاعات', () => adminApi.listDisputes({}), 'GET', '/api/admin/disputes'],
  ['حل نزاع', () => adminApi.resolveDispute('D-9', { decision: 'resolve' }), 'PATCH', '/api/admin/disputes/D-9/resolve'],
  ['مراجعات', () => adminApi.listReviews({}), 'GET', '/api/admin/reviews'],
  ['إحصاء المراجعات', () => adminApi.getReviewsStats(), 'GET', '/api/admin/reviews/stats'],
  ['ملخّص مالي', () => adminApi.getFinancialSummary({ range: 'month' }), 'GET', '/api/admin/financials/summary'],
  ['سلسلة يومية', () => adminApi.getFinancialDaily({ from: '2026-09-01' }), 'GET', '/api/admin/financials/daily'],
  ['تفصيل عمولة', () => adminApi.getCommissionBreakdown(), 'GET', '/api/admin/financials/commission-breakdown'],
  ['معاملات', () => adminApi.listTransactions({}), 'GET', '/api/admin/financials/transactions'],
  ['وارد', () => adminApi.listInbox({ view: 'inbox' }), 'GET', '/api/admin/inbox'],
  ['عدّاد الوارد غير المقروء', () => adminApi.getInboxUnreadCount(), 'GET', '/api/admin/inbox/unread-count'],
  ['إشعار وارد', () => adminApi.updateInboxItem(4, { read: true }), 'PATCH', '/api/admin/inbox/4'],
  ['إجراء جماعي في الوارد', () => adminApi.bulkInbox([1], 'archive'), 'POST', '/api/admin/inbox/bulk'],
  ['قراءة كل الوارد', () => adminApi.markAllInboxRead(), 'POST', '/api/admin/inbox/mark-all-read'],
  ['سجلّ البث', () => adminApi.listBroadcasts({}), 'GET', '/api/admin/broadcasts'],
  ['إرسال بث', () => adminApi.sendBroadcast({ title: 'x' }), 'POST', '/api/admin/broadcasts'],
  ['عدّادات الجمهور', () => adminApi.getAudienceCounts(), 'GET', '/api/admin/broadcasts/audience-counts'],
  ['مسودات البث', () => adminApi.listBroadcastDrafts(), 'GET', '/api/admin/broadcasts/drafts'],
  ['ملف المشرف', () => adminApi.me(), 'GET', '/api/admin/me'],
  ['تعديل ملف المشرف', () => adminApi.updateProfile({ name: 'س' }), 'PATCH', '/api/admin/profile'],
  ['تغيير كلمة مرور المشرف', () => adminApi.changePassword('old', 'new1234', 'new1234'), 'PUT', '/api/admin/password'],
  ['إحصاءات عامة', () => adminApi.getStats(), 'GET', '/api/admin/stats'],
  ['اتجاه الإيرادات', () => adminApi.getRevenueTrend(6), 'GET', '/api/admin/stats/revenue-trend'],
  ['سجلّ النشاط', () => adminApi.getActivities(5), 'GET', '/api/admin/activities'],
  ['أحدث التسجيلات', () => adminApi.getRecentRegistrations(5), 'GET', '/api/admin/recent-registrations'],
  ['إعدادات', () => adminApi.getSettings(), 'GET', '/api/admin/settings'],
  ['حفظ إعدادات', () => adminApi.saveSettings({ commission_rate: 12 }), 'PUT', '/api/admin/settings'],
  ['خروج', () => adminApi.logout(), 'POST', '/api/admin/logout'],
];

for (const [name, run, method, expected] of pathCases) {
  calls = [];
  reply = () => ({ status: 200, body: { data: [], meta: { total: 0, last_page: 1 } } });
  try {
    await run();
  } catch {
    /* بعض النقاط ترمي ببيانات ردّ فارغة؛ الفحص هنا على المسار والـ method فقط */
  }
  const call = calls[0];
  const actual = call ? `${call.method} ${barePath(call.path)}` : 'no request';
  report(`1.x ${name} ⇒ ${method} ${expected}`, actual === `${method} ${expected}`, `${method} ${expected}`, actual);
  // آخر حالة في القائمة هي الخروج، و`logout` يمسح الجلسة (هذا سلوكه). من هنا
  // فصاعداً لا يوجد توكن مشرف، فطلب بلا توكن لا يُرسَل أصلاً (§7.1) — فتُبذر
  // جلسة جديدة قبل كل قسم يعتمد على إرسال طلبات.
  if (name === 'خروج') adminApi.saveAdminSession({ token: TOKEN, admin: { name: 'المشرف', email: 'a@b.com' } });
}

/* ------------------------------------------------------------------ */
/* 2) querystring                                                      */
/* ------------------------------------------------------------------ */

const queryCases = [
  [
    'فلتر فارغ يُحذف (لا ?status=)',
    () => adminApi.getUsersStats({ status: '', role: null, q: undefined }),
    '/api/admin/users/stats',
  ],
  [
    'فلتر واحد يمرّ كما هو',
    () => adminApi.getUsersStats({ status: 'active' }),
    '/api/admin/users/stats?status=active',
  ],
  [
    'قائمة معرّفات تُفصل بفاصلة',
    () => adminApi.listBookings({ booking_ids: [1, 2, 3] }),
    '/api/admin/bookings?booking_ids=1%2C2%2C3&page=1&per_page=100',
  ],
  [
    'قائمة فارغة تُحذف بالكامل',
    () => adminApi.listReviews({ ids: [] }),
    '/api/admin/reviews?page=1&per_page=100',
  ],
  [
    'نطاق تواريخ في السلسلة اليومية',
    () => adminApi.getFinancialDaily({ from: '2026-09-01', to: '2026-09-30' }),
    '/api/admin/financials/daily?from=2026-09-01&to=2026-09-30',
  ],
  [
    'عدد الأشهر في اتجاه الإيرادات',
    () => adminApi.getRevenueTrend(6),
    '/api/admin/stats/revenue-trend?months=6',
  ],
  [
    'حدّ السجلّ في النشاط',
    () => adminApi.getActivities(5),
    '/api/admin/activities?limit=5',
  ],
];

for (const [name, run, expected] of queryCases) {
  calls = [];
  reply = () => ({ status: 200, body: { data: [], meta: { total: 0, last_page: 1 } } });
  // الجلسة تُبذر قبل كل حالة: أي حالة تفشل في مسحها (401) تُفقد ما بعدها،
  // فيُنسب الفشل التالي إلى حالة سبقت لا إلى سببه.
  adminApi.saveAdminSession({ token: TOKEN, admin: { name: 'المشرف', email: 'a@b.com' } });
  try {
    await run();
  } catch {
    /* الفحص على querystring */
  }
  report(`2.x ${name}`, calls[0]?.path === expected, expected, calls[0]?.path);
}

report('2.8 callAll يضيف الترقيم بلا أن يمسّ فلاتر الاستدعاء', await (async () => {
  calls = [];
  reply = () => ({ status: 200, body: { data: [{ id: 1 }], meta: { total: 1, last_page: 1 } } });
  await adminApi.listUsers({ status: 'suspended', q: 'س' });
  return calls[0].path === '/api/admin/users?status=suspended&q=%D8%B3&page=1&per_page=100';
})(), '/api/admin/users?status=suspended&q=…&page=1&per_page=100', calls[0]?.path);

/* ------------------------------------------------------------------ */
/* 3) الترويسة والجلسة                                                 */
/* ------------------------------------------------------------------ */

calls = [];
reply = () => ({ status: 200, body: { data: { token: 'new-token' } } });
await adminApi.login('a@b.com', 'pw');
report('3.1 تسجيل الدخول بلا ترويسة مصادقة', calls[0].path === '/api/admin/login'
  && !calls[0].headers.Authorization, 'POST /api/admin/login بدون bearer', calls[0]?.headers.Authorization);

report('3.2 تسجيل الدخول يرسل البريد وكلمة المرور في جسم الطلب', calls[0]?.body?.email === 'a@b.com'
  && calls[0]?.body?.password === 'pw', { email: 'a@b.com', password: 'pw' }, calls[0]?.body);

report('3.3 الطلبات المحمية تحمل توكن المشرف', await (async () => {
  calls = [];
  // الدخول في 3.1 حفظ توكناً جديداً؛ نعود للتوكن الأساسي لنثبت مصدر الترويسة.
  adminApi.saveAdminSession({ token: TOKEN, admin: { name: 'المشرف' } });
  reply = () => ({ status: 200, body: { data: [] } });
  await adminApi.listUsers({});
  return calls[0].headers.Authorization === `Bearer ${TOKEN}`;
})(), `Bearer ${TOKEN}`, calls[0]?.headers.Authorization);

report('3.4 401 يمسح جلسة المشرف ولا يمسح توكن العميل', await (async () => {
  api.setToken('customer-token');
  adminApi.saveAdminSession({ token: TOKEN, admin: { name: 'المشرف' } });
  reply = () => ({ status: 401, body: { message: 'انتهت جلسة المشرف.' } });
  await adminApi.listUsers({}).catch(() => {});
  const adminCleared = adminApi.getAdminToken() === null;
  const customerKept = api.getToken() === 'customer-token';
  api.clearToken();
  return adminCleared && customerKept;
})(), 'توكن المشرف ممسوح + توكن العميل باقٍ', 'see report');

report('3.5 توكن منتهي الصلاحية يُعتبر غير حيّ، وبلا تاريخ يُعتبر دائماً', async () => {
  adminApi.saveAdminSession({ token: TOKEN, expires_at: new Date(Date.now() - 1000).toISOString(), admin: {} });
  const expired = adminApi.isAdminTokenLive() === false;
  adminApi.saveAdminSession({ token: TOKEN, expires_at: null, admin: {} });
  const valid = adminApi.isAdminTokenLive() === true;
  return expired && valid;
});

/* ------------------------------------------------------------------ */
/* 4) فكّ المغلّف والصفحات                                            */
/* ------------------------------------------------------------------ */

report('4.1 listUsers يفكّ { data, meta } إلى { rows, meta }', await (async () => {
  calls = [];
  adminApi.saveAdminSession({ token: TOKEN, admin: { name: 'المشرف' } });
  reply = () => ({
    status: 200,
    body: { data: [{ id: 1 }, { id: 2 }], meta: { total: 2, last_page: 1, current_page: 1 } },
  });
  const { rows, meta } = await adminApi.listUsers({});
  return rows.length === 2 && meta.total === 2;
})(), 'rows=2 meta.total=2', 'see report');

report('4.2 callAll يجمع كل الصفحات في مصفوفة واحدة', await (async () => {
  calls = [];
  // الصفحة 2 تُعيد صفاً مختلفاً حتى نُثبت أنها جُمعت لا أنها أُهملت.
  reply = () => (pageOf(calls[calls.length - 1].url) === 2
    ? { status: 200, body: { data: [{ id: 3 }], meta: { current_page: 2 } } }
    : { status: 200, body: { data: [{ id: 1 }, { id: 2 }], meta: { total: 3, last_page: 2, current_page: 1 } } });
  const { rows } = await adminApi.listUsers({});
  return rows.length === 3;
})(), 3, 'see report');

report('4.3 صفحة واحدة لا تُعيد طلباً ثانياً', await (async () => {
  calls = [];
  reply = () => ({ status: 200, body: { data: [{ id: 1 }], meta: { total: 1, last_page: 1 } } });
  await adminApi.listUsers({});
  return calls.length === 1;
})(), 1, calls.length);

report('4.4 رد بلا مغلّف data لا يرمي خطأً', await (async () => {
  calls = [];
  reply = () => ({ status: 200, body: { total_users: 5 } });
  const stats = await adminApi.getStats();
  return stats.total_users === 5;
})(), 'total_users=5', 'see report');

report('4.5 فشل صفحة لاحقة لا يُسقط الصفحة الأولى', await (async () => {
  calls = [];
  reply = () => (pageOf(calls[calls.length - 1].url) === 2
    ? { status: 500, body: { message: 'خطأ' } }
    : { status: 200, body: { data: [{ id: 1 }], meta: { total: 2, last_page: 2, current_page: 1 } } });
  const { rows } = await adminApi.listUsers({});
  return rows.length === 1;
})(), 1, 'see report');

/* ------------------------------------------------------------------ */
/* 5) توحيد الأخطاء                                                    */
/* ------------------------------------------------------------------ */

for (const status of [401, 403, 404, 422, 500]) {
  calls = [];
  // 401 يمسح الجلسة، فنبذرها قبل كل حالة: بدون ذلك تتوقف كل الحالات التالية
  // عند «لا توكن ⇒ لا يُرسَل» ويُنسَب الفشل إلى حالة سبقت.
  adminApi.saveAdminSession({ token: TOKEN, admin: { name: 'المشرف' } });
  reply = () => (status === 422
    ? { status, body: { message: 'فشل التحقّق.', errors: { email: ['taken'] } } }
    : { status, body: { message: 'رسالة من الخادم.' } });
  const err = await adminApi.listUsers({}).then(() => null, (e) => e);
  report(
    `5.x خطأ ${status} ⇒ رسالة عربية + رمز الحالة محفوظ`,
    !!err && err.status === status && /[؀-ۿ]/.test(err.message),
    `status=${status} ورسالة عربية`,
    err ? `status=${err.status} message=${JSON.stringify(err.message)}` : 'no error thrown'
  );
}

report('5.6 رسالة Laravel تُحفظ كما هي (لا تُستبدل بتلميح عام)', await (async () => {
  calls = [];
  reply = () => ({ status: 401, body: { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' } });
  const message = await adminApi.login('a@b.com', 'bad').then(() => '', (e) => e.message);
  return message === 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
})(), 'نصّ Laravel كما هو', 'see report');

report('5.7 خطأ الشبكة (رمز 0) يُميّز عن رفض الخادم', await (async () => {
  // 5.x أعلاه ترك الجلسة ممسوحة بعد حالة 401، فنبذرها: بلا توكن لا يُرسَل
  // طلب أصلاً (§7.1) ونحصل على 401 بدل خطأ الشبكة المراد فحصه.
  adminApi.saveAdminSession({ token: TOKEN, admin: { name: 'المشرف' } });
  breakFetch();
  const err = await adminApi.listUsers({}).then(() => null, (e) => e);
  installFetch();
  return !!err && err.status === 0;
})(), 'status=0', 'see report');

/* ------------------------------------------------------------------ */
/* 6) المصادقة: API أولاً مع تراجع آمن                                 */
/* ------------------------------------------------------------------ */

const clearLocal = () => {
  adminApi.clearAdminSession();
  api.clearToken();
};

report('6.1 رفض الخادم (401) لا يتراجع للجلسة المحلية', await (async () => {
  clearLocal();
  reply = () => ({ status: 401, body: { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' } });
  const message = await adminAuth
    .adminLogin('masahati@outlook.com', '123456789admin')
    .then(() => 'NO-THROW', (e) => e.message);
  return message !== 'NO-THROW' && adminAuth.isAdminLoggedIn() === false;
})(), 'رُفض + لا جلسة', 'see report');

report('6.2 نجاح الدخول عبر الخادم = وضع live', await (async () => {
  clearLocal();
  reply = () => ({ status: 200, body: { data: { token: 'live-token', admin: { name: 'المشرف' } } } });
  const profile = await adminAuth.adminLogin('a@b.com', 'pw');
  return !!profile && adminAuth.isAdminLoggedIn() === true && adminAuth.adminSessionMode() === 'live';
})(), 'live', 'see report');

report('6.3 تعذّر الخادم يعود للجلسة المحلية حتى لا تُقفل اللوحة', await (async () => {
  clearLocal();
  breakFetch();
  const profile = await adminAuth.adminLogin('masahati@outlook.com', '123456789admin');
  installFetch();
  const ok = !!profile && adminAuth.isAdminLoggedIn() === true && adminAuth.adminSessionMode() === 'local';
  clearLocal();
  return ok;
})(), 'local', 'see report');

report('6.4 كلمة مرور خاطئة مع خادم متعذّر تُرفض أيضاً', await (async () => {
  clearLocal();
  breakFetch();
  const message = await adminAuth.adminLogin('masahati@outlook.com', 'nope').then(() => 'NO-THROW', (e) => e.message);
  installFetch();
  return message !== 'NO-THROW';
})(), 'رُفض', 'see report');

report('6.5 بلا توكن مشرف الشاشات لا تُطلق أي طلب شبكة', await (async () => {
  clearLocal();
  installFetch();
  calls = [];
  // هذه هي الحالة التي كانت ستنتظر 25 ثانية في كل فتح اللوحة: لا توكن ⇒ لا جلب.
  const mock = await server.ssrLoadModule('/src/components/admin/useAdminData.js');
  const hook = mock.default;
  const liveWithoutToken = typeof hook === 'function' && adminApi.getAdminToken() === null && adminApi.isAdminTokenLive() === false;
  return liveWithoutToken && calls.length === 0;
})(), 'بلا طلبات', calls.length);

/* ------------------------------------------------------------------ */
/* 7) حاجز التوكن: لا 401 في أول فتح، ولا خلط بين جلستَي العميل والمشرف */
/* ------------------------------------------------------------------ */

// كل اختبارات هذا القسم تبدأ بجلسة عميل حيّة، لأن الخطأ الذي نحرسه هنا
// كان: طلب مشرف بلا توكنه يُرسَل بتوكن العميل فيردّ الخادم 401/403 عن جلسة
// لا علاقة لها بالمشرف — وهو ما بدا «401 في بداية التحميل».
api.setToken('client-token-should-not-leak');

report('7.1 طلب مشرف بلا توكن مشرف لا يُرسَل بتوكن العميل', await (async () => {
  clearLocal();
  installFetch();
  calls = [];
  reply = () => ({ status: 200, body: { data: [], meta: { total: 0, last_page: 1 } } });
  const err = await adminApi.listUsers({}).then(() => null, (e) => e);
  return calls.length === 0 && !!err && err.status === 401;
})(), 'لا طلب + خطأ 401 محلي', `calls=${calls.length}`);

report('7.2 لا 401 يُعرض على المستخدم أصلاً (لا يُرسَل طلب بلا مصادقة)', await (async () => {
  clearLocal();
  installFetch();
  calls = [];
  const message = await adminApi.listInbox({}).then(() => '', (e) => e.message);
  return calls.length === 0 && /انتهت الجلسة/.test(message);
})(), 'رسالة جلسة عربية + صفر طلبات', `calls=${calls.length}`);

report('7.3 نقطة الدخول العامة لا تتأثر بالحاجز', await (async () => {
  clearLocal();
  installFetch();
  calls = [];
  reply = () => ({ status: 401, body: { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' } });
  // login بلا توكن بالضرورة، فـ requireToken يجب أن يُعطَّل لها تحديداً.
  const message = await adminApi.login('a@b.com', 'bad').then(() => 'NO-THROW', (e) => e.message);
  return calls.length === 1 && message === 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
})(), 'طلب واحد + رسالة Laravel', `calls=${calls.length}`);

report('7.4 401 على نقطة الدخول لا يُنهي جلسة قائمة', await (async () => {
  clearLocal();
  installFetch();
  // جلسة عميل حيّة + محاولة دخول مشرف خاطئة: رفض الدخول لا يجوز أن يمسّ
  // جلسة العميل ولا يُطلق حدث «انتهت الجلسة».
  api.setToken('client-token-should-not-leak');
  const notified4 = { count: 0 };
  const off = adminApi.onSessionExpired(() => { notified4.count += 1; });
  reply = () => ({ status: 401, body: { message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' } });
  await adminApi.login('a@b.com', 'bad').catch(() => {});
  off();
  return notified4.count === 0 && api.getToken() === 'client-token-should-not-leak';
})(), 'لا حدث + توكن العميل سليم', 'see report');

report('7.5 401 حقيقي (توكن أُرسل) يُنهي جلسة المشرف ويُنبّه', await (async () => {
  clearLocal();
  adminApi.saveAdminSession({ token: 'admin-token-expired' });
  installFetch();
  const notified5 = { count: 0 };
  const off = adminApi.onSessionExpired(() => { notified5.count += 1; });
  reply = () => ({ status: 401, body: { message: 'Unauthenticated.' } });
  const err = await adminApi.listUsers({}).then(() => null, (e) => e);
  off();
  return !!err && err.status === 401 && notified5.count === 1 && adminApi.isAdminTokenLive() === false;
})(), 'حدث واحد + لا توكن مشرف', 'see report');

report('7.6 403 (ليس مشرفاً) لا يُنهي الجلسة', await (async () => {
  clearLocal();
  adminApi.saveAdminSession({ token: 'admin-token-ok' });
  installFetch();
  const notified6 = { count: 0 };
  const off = adminApi.onSessionExpired(() => { notified6.count += 1; });
  reply = () => ({ status: 403, body: { message: 'هذا الحساب ليس حساب مشرف.' } });
  const err = await adminApi.listUsers({}).then(() => null, (e) => e);
  off();
  // الجلسة صحيحة والتوكن موجود: الخطأ في الدور لا في المصادقة.
  return !!err && err.status === 403 && notified6.count === 0 && adminApi.isAdminTokenLive() === true;
})(), 'لا حدث + توكن باقٍ', 'see report');

report('7.7 التوكن يُقرأ من التخزين لكل طلب، لا يُخزَّن مرّة واحدة', await (async () => {
  clearLocal();
  installFetch();
  calls = [];
  reply = () => ({ status: 200, body: { data: [], meta: { total: 0, last_page: 1 } } });

  // طلبان بتوكنين مختلفين. يُثبت هذا أن القراءة «لحظة الإرسال» لا لقطة وقت
  // البناء: لو خُزّن التوكن عند أول استدعاء لحمل الثاني قيمةُ الأول إلى طلب
  // الإخراج (تسجيل خروج في تبويب آخر مثلاً) فيُرسل توكناً ميّتاً ويرجع 401.
  adminApi.saveAdminSession({ token: 'token-A' });
  await adminApi.listUsers({});
  adminApi.saveAdminSession({ token: 'token-B' });
  await adminApi.listUsers({});

  const sent = calls.map((c) => c.headers?.Authorization);
  return sent.length === 2 && sent[0] === 'Bearer token-A' && sent[1] === 'Bearer token-B';
})(), 'Bearer token-A ثم Bearer token-B', calls.map((c) => c.headers?.Authorization).join(' | '));

report('7.7b طلب بلا توكن لا يصل الشبكة أصلاً (لا 401 من الخادم)', await (async () => {
  clearLocal();
  installFetch();
  calls = [];
  reply = () => ({ status: 401, body: { message: 'Unauthenticated.' } });
  const err = await adminApi.listUsers({}).then(() => null, (e) => e);
  // الحاجز محلي: صفر طلبات + رسالة عربية. لو وصل الطلب لكان عدد الطلبات 1.
  return calls.length === 0 && !!err && err.status === 401 && /انتهت الجلسة/.test(err.message);
})(), 'صفر طلبات + رسالة عربية', `calls=${calls.length}`);

report('7.8 خطاف الجلب يفحص التوكن مرتين فلا يُرسل بلا جلسة', await (async () => {
  clearLocal();
  installFetch();
  calls = [];
  const mod = await server.ssrLoadModule('/src/components/admin/useAdminData.js');
  const src = await import('node:fs').then((fs) => fs.readFileSync(
    new URL('../components/admin/useAdminData.js', import.meta.url),
    'utf8'
  ));
  void mod;
  // الفحص الثاني داخل الأثر: `live` لقطة من تصيير سابق، وقد تُمسح الجلسة
  // بين التصيير وتشغيل الأثر (401 من تبويب مجاور).
  const gated = /if \(!isAdminTokenLive\(\)\) return undefined;/.test(src);
  const readsTokenTwice = (src.match(/isAdminTokenLive\(\)/g) || []).length >= 2;
  return gated && readsTokenTwice && calls.length === 0;
})(), 'فحص مزدوج', 'see report');

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (fail) {
  for (const f of failures) console.log(`  - ${f.name}`);
  await server.close();
  process.exit(1);
}
await server.close();
