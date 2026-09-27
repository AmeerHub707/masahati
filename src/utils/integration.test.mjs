// اختبار تكاملي للطبقة الواقعية: api / authStore / dashboard
// تحت بيئة jsdom + mock fetch، عبر محمّل Vite SSR لتحويل import.meta.env.
// يُشغَّل عبر: node --experimental-vm-modules src/utils/integration.test.mjs
import { JSDOM, VirtualConsole } from 'jsdom';

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:5173',
  virtualConsole,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;
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
const authStore = await server.ssrLoadModule('/src/lib/authStore.js');
const dashboard = await server.ssrLoadModule('/src/lib/dashboard.js');
const requests = await server.ssrLoadModule('/src/lib/requests.js');
const notifications = await server.ssrLoadModule('/src/lib/notifications.js');
const passwordRules = await server.ssrLoadModule('/src/lib/passwordRules.js');

const TOKEN = 'tok-test-123';
const BASE = api.BASE_URL;

function resetStorage() {
  dom.window.localStorage.clear();
}

// ----- mock fetch ترجع استجابات مسجلة لكل مسار -----
function makeFetch(routes, onRequest) {
  return async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const path = String(url).startsWith(BASE) ? String(url).slice(BASE.length).split('?')[0] : String(url);
    const parsedQuery = String(url).split('?')[1] || '';
    let q = {};
    for (const part of parsedQuery.split('&')) {
      if (!part) continue;
      const [k, v] = part.split('=');
      q[k] = decodeURIComponent(v);
    }
    if (onRequest) onRequest({ url: String(url), method, path, query: q, opts });

    let store = routes[`${method} ${path}`];
    if (!store) store = routes[path];
    if (!store) {
      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'not found' }),
      };
    }
    const r = typeof store === 'function' ? store({ method, query: q }) : store;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
    };
  };
}

// ============================================================
// القسم 1: api.js
// ============================================================
console.log('\n===== 1) api.js: imageUrl / request =====');

report('1.1 imageUrl: absolute URL passthrough', api.imageUrl('https://x.com/a.jpg') === 'https://x.com/a.jpg');
report('1.2 imageUrl: data: passthrough', api.imageUrl('data:image/png;base64,AAA').startsWith('data:'));
report('1.3 imageUrl: relative joins BASE', api.imageUrl('/storage/p.jpg') === `${BASE}/storage/p.jpg`);
report('1.4 imageUrl: empty -> ""', api.imageUrl('') === '' && api.imageUrl(null) === '' && api.imageUrl(undefined) === '');

resetStorage();
api.setToken(TOKEN);

// مسار echo يلتقط الطلب ويعيده (قبل أي طلب فعلي)
let echoCap = null;
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  const path = String(url).replace(BASE, '').split('?')[0];
  echoCap = { method, path, headers: opts.headers || {}, body: opts.body };
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ path, method }),
  };
};
await api.request('/api/echo', { auth: true });
report('1.5 request sends Bearer when auth', echoCap?.headers?.Authorization === `Bearer ${TOKEN}`);

const echo = await api.request('/api/echo', { auth: true });
report('1.6 request GET auth sends Bearer header', !!echoCap?.headers?.Authorization && echoCap.headers.Authorization === `Bearer ${TOKEN}`);
report('1.7 request returns parsed JSON', echo && echo.path === '/api/echo' && echo.method === 'GET');

await api.request('/api/echo', { method: 'POST', body: { a: 1 }, auth: true });
report('1.8 POST sends JSON content-type + body', echoCap.method === 'POST' && echoCap.headers['Content-Type'] === 'application/json');

// FormData
const fd = new dom.window.FormData();
fd.append('profile_picture', new dom.window.Blob(['x']));
await api.request('/api/echo', { method: 'PATCH', isForm: true, body: fd, auth: true });
report('1.9 FormData is NOT json stringified', echoCap.headers['Content-Type'] !== 'application/json' && !(typeof echoCap.body === 'string'));

// خطأ 422 مع errors
globalThis.fetch = makeFetch({
  'GET /api/me': { status: 422, body: { message: 'خطأ تحقق', errors: { email: ['البريد مطلوب'] } } },
});
try {
  await api.request('/api/me', { auth: true });
  report('1.10 request throws on 422', false, 'throw', 'no throw');
} catch (e) {
  report('1.10 request throws on 422', e instanceof api.ApiError && e.status === 422);
  report('1.11 ApiError prefers top-level message', e.message === 'خطأ تحقق');
}

// استجابة HTML بدل JSON
globalThis.fetch = makeFetch({
  'GET /api/not-impl': { status: 200, body: '<!DOCTYPE html><html>Laravel</html>' },
});
try {
  await api.request('/api/not-impl');
  report('1.12 HTML response detected as error', false, 'throw', 'no throw');
} catch (e) {
  report('1.12 HTML response detected as error', /HTML/.test(e.message));
}

// مهلة قصيرة تعمل (AbortController)
const hangFetch = (url, opts = {}) =>
  new Promise((resolve, reject) => {
    const { signal } = opts;
    const t = setTimeout(() => {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    }, 30);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    }
  });
globalThis.fetch = hangFetch;
const t0 = Date.now();
try {
  await api.request('/api/slow', { timeoutMs: 50 });
  report('1.13 timeout aborts request', false, 'throw timeout', 'no throw');
} catch (e) {
  report('1.13 timeout aborts request', e instanceof api.ApiError && /مهلة/.test(e.message));
  report('1.14 timeout fires near limit (< 1s)', Date.now() - t0 < 1000, '<1000ms', `${Date.now() - t0}ms`);
}

// ============================================================
// القسم 2: authStore.js — التدفقات
// ============================================================
console.log('\n===== 2) authStore.js =====');

resetStorage();
globalThis.fetch = makeFetch({
  'POST /api/login': { status: 200, body: { token: TOKEN, user: { name: 'كرم', role: 'customer' } } },
});
const loginRes = await authStore.login('a@b.com', 'secret');
report('2.1 login stores token + user', authStore.isLoggedIn() && authStore.getUser()?.role === 'customer' && loginRes.token === TOKEN);

// login بلا role في الاستجابة: يُستعلم /api/profile لتحديد الدور (لا الرئيسية)
resetStorage();
globalThis.fetch = makeFetch({
  'POST /api/login': { status: 200, body: { token: TOKEN, data: { user: { name: 'كرم' } } } },
  'GET /api/profile': { status: 200, body: { data: { user: { role: 'space_owner', name: 'كرم' } } } },
});
const loginFallbackRes = await authStore.login('a@b.com', 'secret');
report('2.1b login role from /api/profile fallback', authStore.getUser()?.role === 'space_owner' && loginFallbackRes.user.role === 'space_owner');

globalThis.fetch = makeFetch({
  'POST /api/login': { status: 200, body: { user: {} } },
});
let loginThrew = false;
try {
  await authStore.login('a@b.com', 'x');
} catch (e) {
  loginThrew = e instanceof api.ApiError && /لا يوجد توكن/.test(e.message);
}
report('2.2 login without token throws', loginThrew);

// getProfile يُعيد JSON
globalThis.fetch = makeFetch({
  'GET /api/profile': { status: 200, body: { name: 'كرم', email: 'a@b.com', phone: '+970', picture: '/p.jpg' } },
});
const prof = await authStore.getProfile();
report('2.3 getProfile returns profile', prof && prof.name === 'كرم' && prof.phone === '+970');

// updateProfile — PATCH /api/customer/profile
let cap = null;
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  const path = String(url).replace(BASE, '');
  cap = { method, path, body: opts.body };
  return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
};
await authStore.updateProfile({ full_name: 'كرم جديد', phone: '+970123', email: 'a@b.com' });
report('2.4 updateProfile -> PATCH /api/customer/profile', cap.method === 'PATCH' && cap.path === '/api/customer/profile');
report('2.5 updateProfile sends full_name/phone/email JSON', cap.body.includes('"full_name":"كرم جديد"') && cap.body.includes('"email":"a@b.com"'));

// updateProfilePicture — يجب أن تكون PATCH
globalThis.fetch = async (url, opts = {}) => {
  const cap2 = {
    method: opts.method,
    isForm: typeof opts.body !== 'string' && opts.body && typeof opts.body.append === 'function' && opts.headers['Content-Type'] === undefined,
  };
  globalThis.__cap2 = cap2;
  return { ok: true, status: 200, text: async () => JSON.stringify({ profile_picture_url: '/pp.jpg' }) };
};
await authStore.updateProfilePicture(new dom.window.Blob(['img']));
report('2.6 updateProfilePicture -> PATCH', globalThis.__cap2?.method === 'PATCH');
report('2.7 updateProfilePicture sends FormData', globalThis.__cap2?.isForm === true);

// uploadPicture — POST /api/uploadPicture (رفع أولي لصورة الملف)
globalThis.fetch = async (url, opts = {}) => {
  const cap3 = {
    method: opts.method,
    path: String(url).replace(BASE, ''),
    isForm: typeof opts.body !== 'string' && opts.body && typeof opts.body.append === 'function' && opts.headers['Content-Type'] === undefined,
  };
  globalThis.__cap3 = cap3;
  return { ok: true, status: 200, text: async () => JSON.stringify({ profile_picture_url: '/new.jpg', msg: 'upload is succes' }) };
};
const upRes = await authStore.uploadPicture(new dom.window.Blob(['img']));
report('2.7b uploadPicture -> POST /api/uploadPicture', globalThis.__cap3?.method === 'POST' && globalThis.__cap3?.path === '/api/uploadPicture');
report('2.7c uploadPicture sends FormData', globalThis.__cap3?.isForm === true);
report('2.7d uploadPicture returns profile_picture_url + msg', upRes?.profile_picture_url === '/new.jpg' && upRes?.msg === 'upload is succes');

// logout يمسح الرمز حتى لو فشل الخادم
globalThis.fetch = makeFetch({
  'POST /api/logout': { status: 500, body: { message: 'x' } },
});
await authStore.logout();
report('2.8 logout clears token even on server error', !authStore.isLoggedIn());

// getHomePath
report('2.9 getHomePath customer -> /dashboard/customer', authStore.getHomePath('customer') === '/dashboard/customer');
report('2.10 getHomePath owner -> /dashboard/space-owner', authStore.getHomePath('space_owner') === '/dashboard/space-owner');
report('2.10b getHomePath owner alias -> /dashboard/space-owner', authStore.getHomePath('owner') === '/dashboard/space-owner');
report('2.11 getHomePath unknown -> home (no role mixing)', authStore.getHomePath('x') === '/');

// normalizeRole + extractUser: إصلاح التوجيه إلى الرئيسية بسبب دور غير قياسي أو مستخدم مغلّف.
report('2.12 normalizeRole variant "Space Owner" -> space_owner', authStore.normalizeRole('Space Owner') === 'space_owner');
report('2.12b normalizeRole "SpaceOwner" -> space_owner', authStore.normalizeRole('SpaceOwner') === 'space_owner');
report('2.13 normalizeRole "Customer"/blank -> customer/empty', authStore.normalizeRole('Customer') === 'customer' && authStore.normalizeRole('  ') === '');
report(
  '2.14 extractUser unwraps {data:{user}} shape',
  (authStore.extractUser({ token: 't', data: { user: { name: 'كرم', role: 'space_owner' } } }).role) === 'space_owner'
);
report(
  '2.15 extractUser unwraps {user} shape',
  authStore.extractUser({ user: { role: 'owner' }, token: 't' }).role === 'owner'
);
report('2.16 getHomePath normalized variant routes to owner panel', authStore.getHomePath('Space Owner') === '/dashboard/space-owner');

// ============================================================
// القسم 3: dashboard.js — الكاش ودوال التحويل والجلب
// ============================================================
console.log('\n===== 3) dashboard.js =====');

resetStorage();
// تأكد أن الكاش فارغ
report('3.1 readDashboardCache empty initially', dashboard.readDashboardCache() === null);

const sample = { user: { name: 'ت' }, stats: { upcomingBookings: 2 }, favorites: [] };
dashboard.writeDashboardCache(sample);
const readBack = dashboard.readDashboardCache();
report('3.2 cache round-trips', readBack && readBack.user.name === 'ت' && readBack.stats.upcomingBookings === 2);
report('3.3 cache object is a real decode (not string)', typeof readBack === 'object');

localStorage.setItem('masahati_dashboard_cache', '{corrupt');
report('3.4 corrupt cache -> null (no crash)', dashboard.readDashboardCache() === null);

dashboard.clearDashboardCache();
report('3.5 clearDashboardCache empties', dashboard.readDashboardCache() === null);

// fetchDashboard: الكل ينجح
resetStorage();
api.setToken(TOKEN);
api.setUser({ name: 'كرم محلي', role: 'customer' });
globalThis.fetch = makeFetch({
  'GET /api/dashboard/stats': { status: 200, body: { upcoming_bookings_count: 3, total_hours: 10, favorite_spaces_count: 2, booked_hours_this_month: 8 } },
  'GET /api/dashboard/upcoming-booking': { status: 200, body: { title: 'غرفة A', image: '/a.jpg', date: '2026-09-20', time: '10:00' } },
  'GET /api/dashboard/bookings': { status: 200, body: { data: [{ booking_id: 9, space_name: 'B', image: '/b.jpg', date: '2026-09-05', time_from: '9', time_to: '11', status: 'confirmed' }] } },
  'GET /api/dashboard/favorites': { status: 200, body: [{ space_id: 5, title: 'استوديو', image: '/s.jpg', rating: 4, location: 'رام الله', price: 50 }] },
  'GET /api/profile': { status: 200, body: { name: 'كرم API', email: 'e', phone: 'p', picture: '/profile.jpg' } },
});
const full = await dashboard.fetchDashboard();
report('3.6 stats mapped', full.stats.upcomingBookings === 3 && full.stats.hoursThisMonth === 10 && full.stats.savedFavorites === 2 && full.stats.hoursSpentThisMonth === 8);
report('3.7 upcoming mapped (single object -> list)', full.upcoming.length === 1 && full.upcoming[0].spaceName === 'غرفة A' && full.upcoming[0].time === '10:00');
report('3.8 bookings mapped with time range', full.bookings.length === 1 && full.bookings[0].spaceName === 'B' && full.bookings[0].time === '9 – 11' && full.bookings[0].status === 'confirmed');
report('3.9 favorites mapped', full.favorites.length === 1 && full.favorites[0].name === 'استوديو' && full.favorites[0].pricePerHour === 50);
report('3.10 profile wins over local user', full.user.name === 'كرم API' && full.user.role === 'customer');
report('3.11 photo joined to BASE', full.user.photo === `${BASE}/profile.jpg`);
report('3.12 fetch succeeded -> cache written', dashboard.readDashboardCache()?.stats?.upcomingBookings === 3);

// fetchDashboard: كل نقاط الطريق تفشل -> بنية فارغة آمنة
globalThis.fetch = makeFetch({
  'GET /api/dashboard/stats': { status: 500, body: { message: 'x' } },
  'GET /api/dashboard/upcoming-booking': { status: 500, body: { message: 'x' } },
  'GET /api/dashboard/bookings': { status: 500, body: { message: 'x' } },
  'GET /api/dashboard/favorites': { status: 500, body: { message: 'x' } },
  'GET /api/profile': { status: 500, body: { message: 'x' } },
});
const empty = await dashboard.fetchDashboard();
report('3.13 all-endpoints-fail returns safe defaults', empty.stats.upcomingBookings === 0 && empty.bookings.length === 0 && empty.favorites.length === 0 && empty.upcoming.length === 0 && Array.isArray(empty.ads));

// fetchDashboard: فشل profile فقط -> user من localStorage
resetStorage();
api.setToken(TOKEN);
api.setUser({ name: 'محلي', role: 'space_owner', photo: 'https://x.com/l.png' });
globalThis.fetch = makeFetch({
  'GET /api/dashboard/stats': { status: 200, body: { upcoming_bookings_count: 1 } },
  'GET /api/dashboard/upcoming-booking': { status: 200, body: {} },
  'GET /api/dashboard/bookings': { status: 200, body: [] },
  'GET /api/dashboard/favorites': { status: 200, body: [] },
  'GET /api/profile': { status: 500, body: { message: 'x' } },
});
const fallback = await dashboard.fetchDashboard();
report('3.14 failed profile falls back to local user', fallback.user.name === 'محلي');
report('3.15 space_owner -> role=owner', fallback.user.role === 'owner');
report('3.16 photo from local user kept', fallback.user.photo === 'https://x.com/l.png');

// toggleFavorite
globalThis.fetch = makeFetch({
  'POST /api/dashboard/favorites/toggle': () => ({ status: 200, body: { message: 'أُضيفت', is_favorited: true } }),
});
const tog = await dashboard.toggleFavorite(7);
report('3.17 toggleFavorite parses is_favorited', tog.isFavorited === true && tog.message === 'أُضيفت');

// ============================================================
// القسم 4: requests.js — حالات الأمان السريعة + notifications.js
// ============================================================
console.log('\n===== 4) requests.js (special requests) + notifications.js =====');

// وضع تجريبي: فشل الخادم -> مخزن محلي + تعيين العلامة
resetStorage();
api.setToken(TOKEN);
globalThis.fetch = makeFetch({
  'GET /api/special-requests': { status: 404, body: { message: 'nf' } },
});
const listFallback = await requests.loadRequestsWithFallback();
report('4.1 fallback to demo list', listFallback.demo === true && listFallback.requests.length > 0);
report('4.2 demo list items mapped', listFallback.requests[0]?.id && listFallback.requests[0].status === 'open');

// إنشاء طلب في وضع تجريبي يُضاف محلياً ويُعاد تغذية القائمة
const createRes = await requests.createRequestWithFallback({
  title: 'طلب اختبار حوسبة',
  notes: 'وصف',
  space_type: 'room',
  capacity: 12,
  schedule: { preset: 'weekly', count: 4 },
  preferred_time: '9:00 م',
  area: 'غزة',
  amenities: ['internet'],
  budget: 90,
});
report('4.3 create in demo mode', createRes.demo === true && createRes.request.title === 'طلب اختبار حوسبة');
const listAfterCreate = await requests.loadRequestsWithFallback();
report('4.4 created request first in list', listAfterCreate.requests[0].title === 'طلب اختبار حوسبة');

// تفاصيل الطلب (نأخذ أول طلب)
const detail = await requests.loadRequestDetailWithFallback(listAfterCreate.requests[0].id);
report('4.5 detail loads with offers array', detail.demo === true && Array.isArray(detail.offers));

// رفض أحد العروض -> يظهر rejected بعد إعادة تحميل التفاصيل
const demoDetail = await requests.loadRequestDetailWithFallback('demo-1');
const rejectTarget = demoDetail.offers[0];
const rejectRes = await requests.rejectOfferWithFallback('demo-1', rejectTarget.id);
report('4.6 reject offer returns message', typeof rejectRes.message === 'string');
const afterReject = await requests.loadRequestDetailWithFallback('demo-1');
report('4.6b reject marked in stored detail', afterReject.offers.find((o) => o.id === rejectTarget.id)?.status === 'rejected');

// إغلاق الطلب -> closed + لا يُعد مفتوحاً
const closeRes = await requests.closeRequestWithFallback('demo-1');
report('4.7 close request status', closeRes.demo === true && closeRes.request.status === 'closed');
report('4.8 closed request not open', requests.isRequestOpen(closeRes.request) === false);

// انتهاء الصلاحية: expires_at في الماضي -> غير مفتوح
const expiredReq = { status: 'open', expires_at: '2020-01-01 00:00:00' };
report('4.9 expiry in past -> not open', requests.isRequestExpired(expiredReq) === true && requests.isRequestOpen(expiredReq) === false);
const futureReq = { status: 'open', expires_at: '2099-01-01 00:00:00' };
report('4.10 future expiry still open', requests.isRequestOpen(futureReq) === true);
report('4.11 no expiry default open', requests.isRequestOpen({ status: 'open' }) === true);

// شارة العروض الجديدة: قبل الزيارة صفر، بعد إضافة عرض > 0
resetStorage();
globalThis.fetch = makeFetch({
  'GET /api/special-requests': { status: 404, body: { message: 'nf' } },
});
await requests.loadRequestsWithFallback(true);
report('4.12 unseen request -> 0 new offers', requests.newOffersCountFor({ id: 'demo-1', offers_count: 3 }) === 0);
requests.markRequestSeen('demo-1', 3);
report('4.13 after visit with 3 -> 0 new', requests.newOffersCountFor({ id: 'demo-1', offers_count: 3 }) === 0);
report('4.14 after 5 offers -> 2 new', requests.newOffersCountFor({ id: 'demo-1', offers_count: 5 }) === 2);

// notifications.js: وضع تجريبي يشتق من مخزن الطلبات
const notifRes = await notifications.loadNotificationsWithFallback();
report('4.15 notifications fallback derived locally', notifRes.demo === true && Array.isArray(notifRes.notifications));
report('4.16 at least one notification present', notifRes.notifications.length > 0);
report('4.17 notifications carry text + read', typeof notifRes.notifications[0].text === 'string' && typeof notifRes.notifications[0].read === 'boolean');

// علامة قراءة الكل: لا تنفجر وتُحدّث العلامة المحلية عند التجريبي
const markRes = await notifications.markAllNotificationsReadWithFallback();
report('4.18 mark-all-read works in demo', (markRes.demo === true && typeof markRes.message === 'string'));
const notifAfterRead = notifications.deriveLocalNotifications();
report('4.19 derived notifications become read after flag', notifAfterRead.every((n) => n.read === true));

// ============================================================
// القسم 5: owner.js — لوحة صاحب المساحة (API → وضع تجريبي)
// ============================================================
console.log('\n===== 5) owner.js (space owner dashboard) =====');

const owner = await server.ssrLoadModule('/src/lib/owner.js');
const customerAssistant = await server.ssrLoadModule('/src/lib/customerAssistant.js');

report('5.1 mapSpace maps laravel fields', owner.mapSpace({ space_id: 12, title: 'قاعة A', price: 120, capacity: 40, amenities: ['internet', { key: 'ac' }], status: 'inactive', rating: 4.75 }).id === 12
  && owner.mapSpace({ space_id: 12, title: 'قاعة A', price: 120 }).price_per_hour === 120
  && owner.mapSpace({ space_id: 12, amenities: ['internet', { key: 'ac' }] }).amenities[1] === 'ac'
  && owner.mapSpace({ space_id: 12, status: 'inactive' }).is_active === false);

report('5.1b mapSpace maps pending review status', owner.mapSpace({ space_id: 13, status: 'pending' }).status === 'pending'
  && owner.mapSpace({ space_id: 13, status: 'pending' }).is_active === false
  && owner.mapSpace({ space_id: 14, status: 'active' }).is_active === true);

report('5.1c mapSpace normalizes proof docs', owner.mapSpace({ space_id: 13, docs: { proof: { name: 'deed.pdf', size: 2048 } } }).docs[0].id === 'proof'
  && owner.mapSpace({ space_id: 13, docs: { proof: { name: 'deed.pdf', size: 2048 } } }).docs[0].name === 'deed.pdf'
  && owner.mapSpace({ space_id: 13, docs: [{ id: 'extra', name: 'lic.pdf' }] }).docs[0].id === 'extra');

report('5.1d mapSpace maps lat/lng and sanitizes invalid coords', owner.mapSpace({ space_id: 13, latitude: 31.50113, longitude: 34.46675 }).lat === 31.50113
  && owner.mapSpace({ space_id: 13, latitude: 31.50113, longitude: 34.46675 }).lng === 34.46675
  && owner.mapSpace({ space_id: 13, lat: 31.5, lon: 34.4 }).lat === 31.5
  && owner.mapSpace({ space_id: 13, lat: 31.5, lon: 34.4 }).lng === 34.4
  && owner.mapSpace({ space_id: 13 }).lat === null
  && owner.mapSpace({ space_id: 13 }).lng === null);

// أوقات العمل ورقم التواصل: توحيد الصيغة (HH:MM / 24 ساعة) وقبول الأسماء
// البديلة التي قد ترسلها الواجهة، مع إفراغ القيم الفاسدة أو المفقودة.
report('5.1e mapSpace normalizes open/close time and contact phone', owner.mapSpace({ space_id: 15, open_time: '08:00:00', close_time: '6:30 PM' }).open_time === '08:00'
  && owner.mapSpace({ space_id: 15, open_time: '08:00:00', close_time: '6:30 PM' }).close_time === '18:30'
  && owner.mapSpace({ space_id: 15, opening_time: '09:00', closing_time: '12:00' }).open_time === '09:00'
  && owner.mapSpace({ space_id: 15, opens_at: '9:15', closes_at: '23:00' }).close_time === '23:00'
  && owner.mapSpace({ space_id: 15, open_time: '12:00 AM' }).open_time === '00:00'
  && owner.mapSpace({ space_id: 15, contact_phone: ' 0599123456 ' }).contact_phone === '0599123456'
  && owner.mapSpace({ space_id: 15, phone: '0599000000' }).contact_phone === '0599000000'
  && owner.mapSpace({ space_id: 15, open_time: '99:99' }).open_time === ''
  && owner.mapSpace({ space_id: 15, open_time: 'not-a-time' }).open_time === ''
  && owner.mapSpace({ space_id: 15 }).open_time === ''
  && owner.mapSpace({ space_id: 15 }).close_time === ''
  && owner.mapSpace({ space_id: 15 }).contact_phone === '');

report('5.2 mapMyOffer maps offer fields', owner.mapMyOffer({ offer_id: 88, request_title: 'طلب X', price_per_hour: 150, hours: 3, status: 'accepted' }).requestTitle === 'طلب X'
  && owner.mapMyOffer({ offer_id: 88, price_per_hour: 150, hours: 3 }).duration_hours === 3
  && owner.mapMyOffer({ offer_id: 88, status: 'accepted' }).status === 'accepted');

report('5.3 mapOwnerBooking maps booking fields', owner.mapOwnerBooking({ booking_id: 5, space_name: 'قاعة B', time_from: '10:00', time_to: '13:00', price: 450 }).time === '10:00 – 13:00'
  && owner.mapOwnerBooking({ booking_id: 5, space_name: 'قاعة B' }).spaceName === 'قاعة B');

// تحميل كامل للوحة: كل نقاط الطريق تعمل → demo=false + تعيين المستخدم
resetStorage();
api.setToken(TOKEN);
api.setUser({ name: 'مالك محلي', role: 'owner' });
globalThis.fetch = makeFetch({
  'GET /api/owner/spaces': { status: 200, body: { data: [{ space_id: 12, title: 'قاعة العروض', price_per_hour: 150, capacity: 120, amenities: ['internet', 'ac'], is_active: true }] } },
  'GET /api/owner/offers': { status: 200, body: { data: [{ offer_id: 88, request_id: 41, request_title: 'طلب قاعة', status: 'pending', price_per_hour: 140, duration_hours: 3, created_at: '2026-09-18 11:00:00' }] } },
  'GET /api/special-requests/open': { status: 200, body: { data: { requests: [{ request_id: 41, title: 'طلب السوق المفتوح', description: 'وصف', capacity: 40, budget: 180, status: 'open', offers_count: 2, created_at: '2026-09-18 10:00:00' }] } } },
  'GET /api/owner/bookings': { status: 200, body: [] },
  'GET /api/profile': { status: 200, body: { name: 'مالك API', email: 'm@m.com', phone: '+970', picture: '/owner.jpg' } },
});
const ownerDash = await owner.loadOwnerDashboardWithFallback();
report('5.4 full dashboard loads from API', ownerDash.demo === false);
report('5.5 dashboard user comes from profile', ownerDash.user.name === 'مالك API' && ownerDash.user.role === 'owner');
report('5.6 dashboard spaces mapped', ownerDash.spaces.length === 1 && ownerDash.spaces[0].title === 'قاعة العروض' && ownerDash.spaces[0].id === 12);
report('5.7 dashboard offers mapped', ownerDash.offers.length === 1 && ownerDash.offers[0].requestTitle === 'طلب قاعة' && ownerDash.offers[0].status === 'pending');
report('5.8 dashboard market filtered open', ownerDash.market.length === 1 && ownerDash.market[0].title === 'طلب السوق المفتوح');
report('5.9 dashboard stats built', ownerDash.stats.spacesCount === 1 && ownerDash.stats.activeSpacesCount === 1 && ownerDash.stats.pendingOffers === 1 && ownerDash.stats.openMarket === 1);
owner.writeOwnerCache({ data: ownerDash });
report('5.10 owner cache round-trips', owner.readOwnerCache()?.data?.stats?.spacesCount === 1);

// فشل كل نقاط الطريق → وضع تجريبي آمن
resetStorage();
api.setToken(TOKEN);
api.setUser({ name: 'مالك', role: 'owner' });
globalThis.fetch = makeFetch({
  'GET /api/owner/spaces': { status: 500, body: { message: 'x' } },
  'GET /api/owner/offers': { status: 500, body: { message: 'x' } },
  'GET /api/special-requests/open': { status: 500, body: { message: 'x' } },
  'GET /api/owner/bookings': { status: 500, body: { message: 'x' } },
  'GET /api/profile': { status: 500, body: { message: 'x' } },
});
const ownerDemo = await owner.loadOwnerDashboardWithFallback();
report('5.11 all-fail falls back to demo', ownerDemo.demo === true && Array.isArray(ownerDemo.spaces) && Array.isArray(ownerDemo.offers) && Array.isArray(ownerDemo.market));
report('5.12 demo flag set', owner.isOwnerDemo() === true);
report('5.13 demo seeds 3 spaces', ownerDemo.spaces.length === 3);
report('5.14 demo includes a stopped space', ownerDemo.spaces.some((s) => s.is_active === false));
report('5.15 demo offers include pending + accepted', ownerDemo.offers.some((o) => o.status === 'pending') && ownerDemo.offers.some((o) => o.status === 'accepted'));
report('5.16 demo stats consistent', ownerDemo.stats.spacesCount === 3 && ownerDemo.stats.activeSpacesCount === 2 && ownerDemo.stats.pendingOffers === 1 && ownerDemo.stats.acceptedOffers === 1);

// عروض السوق في الوضع التجريبي: تقديم عرض → يُضاف محلياً، والتكرار يمنع
const prop1 = await owner.submitProposalWithFallback('market-2', {
  space_id: 'os-1', price_per_hour: 130, duration_hours: 3, notes: '', currency: 'ش.ج', request_title: 'قاعة اختبار',
});
report('5.17 proposal in demo returns offer', prop1.demo === true && prop1.duplicate === false && prop1.offer && prop1.offer.status === 'pending');
const propDup = await owner.submitProposalWithFallback('market-2', {
  space_id: 'os-1', price_per_hour: 130, duration_hours: 3, notes: '', currency: 'ش.ج', request_title: 'قاعة اختبار',
});
report('5.18 duplicate proposal rejected', propDup.duplicate === true && /سبق/.test(propDup.message));
report('5.19 owner offers now include the new one', (await owner.loadOwnerOffersWithFallback()).offers.some((o) => o.requestTitle === 'قاعة اختبار'));

// إضافة مساحة في الوضع التجريبي — نشمل أوقات العمل ورقم التواصل المطلوبين
const newSpace = await owner.createSpaceWithFallback({ title: 'جناح جديد', location: 'غزة', latitude: 31.50113, longitude: 34.46675, price_per_hour: 90, capacity: 25, open_time: '09:00', close_time: '18:00', contact_phone: '0599123456', amenities: ['internet'], docs: [{ id: 'proof', name: 'deed.pdf', size: 2048, type: 'application/pdf' }] });
report('5.20 add space sends pending for admin review', newSpace.demo === true && newSpace.space.title === 'جناح جديد' && newSpace.space.status === 'pending' && newSpace.space.is_active === false);
report('5.20b proof docs attached to new space', newSpace.space.docs?.[0]?.id === 'proof' && newSpace.space.docs?.[0]?.name === 'deed.pdf');
report('5.20c new space keeps lat/lng coordinates', newSpace.space.lat === 31.50113 && newSpace.space.lng === 34.46675);
report('5.20d new space keeps hours and contact phone', newSpace.space.open_time === '09:00' && newSpace.space.close_time === '18:00' && newSpace.space.contact_phone === '0599123456');
const spacesAfterAdd = (await owner.loadSpacesWithFallback()).spaces;
report('5.21 new space first in list', spacesAfterAdd[0].title === 'جناح جديد' && spacesAfterAdd.length === 4);

// تبديل حالة مساحة → is_active تنقلب محلياً
const toggled = await owner.toggleSpaceActiveWithFallback('os-1', false, { id: 'os-1', is_active: true });
report('5.22 toggle space stopped', toggled.demo === true && toggled.space.is_active === false);
const spacesAfterToggle = (await owner.loadSpacesWithFallback()).spaces;
report('5.23 toggle persisted in store', spacesAfterToggle.find((s) => s.id === 'os-1')?.is_active === false);

// السوق التجريبي: يعيد طلبات مخزن العميل المفتوحة إن وُجدت
resetStorage();
api.setToken(TOKEN);
api.setUser({ name: 'مالك', role: 'owner' });
localStorage.setItem('masahati_special_requests_data_v1', JSON.stringify({ requests: [{ id: 'cust-1', title: 'طلب من العميل', status: 'open', offers_count: 0, created_at: '2026-09-18 10:00:00' }, { id: 'cust-2', title: 'طلب مغلق', status: 'accepted' }] }));
const marketFromCustomer = (await owner.loadMarketWithFallback(true)).requests;
report('5.24 market reuses customer demo requests', marketFromCustomer.some((r) => r.title === 'طلب من العميل') && !marketFromCustomer.some((r) => r.title === 'طلب مغلق'));

// bookmarks: loadOwnerBookings في الوضع التجريبي → قائمة فارغة آمنة
resetStorage();
api.setToken(TOKEN);
api.setUser({ name: 'مالك', role: 'owner' });
const bookingsDemo = await owner.loadOwnerBookingsWithFallback();
report('5.25 bookings demo returns empty array', bookingsDemo.demo === true && Array.isArray(bookingsDemo.bookings) && bookingsDemo.bookings.length === 0);

// isOwnerDemo / clearOwnerCache
owner.clearOwnerCache();
report('5.26 clearOwnerCache empties cache', owner.readOwnerCache() === null);

// وثائق المالك: رفع مرة واحدة ثم قفل حتى قرار الإدارة
owner.clearOwnerDocuments();
const docsNone = owner.readOwnerDocuments();
report('5.27 docs start as none', docsNone.status === 'none' && owner.canAddSpace(docsNone) === false);

const docSubmit = await owner.submitOwnerDocumentsWithFallback({
  assets: { name: 'deed.pdf', size: 2048, type: 'application/pdf' },
  cert: { name: 'cert.png', size: 1024, type: 'image/png' },
});
report('5.28 docs submit -> pending', docSubmit.doc.status === 'pending' && docSubmit.locked === false && owner.isDocsLocked(docSubmit.doc) === true);

const docDup = await owner.submitOwnerDocumentsWithFallback({ assets: { name: 'x.pdf', size: 1, type: 'application/pdf' } });
report('5.29 one-time lock blocks resubmit', docDup.locked === true && owner.readOwnerDocuments().files.assets.name === 'deed.pdf');

owner.writeOwnerDocuments({ ...owner.readOwnerDocuments(), status: 'approved' });
report('5.30 canAddSpace only when approved', owner.canAddSpace(owner.readOwnerDocuments()) === true && owner.isDocsLocked(owner.readOwnerDocuments()) === true);

owner.writeOwnerDocuments({ ...owner.readOwnerDocuments(), status: 'rejected' });
report('5.31 rejected unlocks resubmit', owner.isDocsLocked(owner.readOwnerDocuments()) === false);

owner.clearOwnerDocuments();
report('5.32 clearOwnerDocuments empties', owner.readOwnerDocuments().status === 'none' && owner.readOwnerDocuments().files.assets === undefined);

// ============================================================
// القسم 6: passwordRules + انتهاء صلاحية الجلسة
// ============================================================
console.log('\n===== 6) passwordRules + session expiry =====');

const prCheck = (p) => passwordRules.getPasswordChecks(p);

report('6.1 PASSWORD_MIN_LENGTH is 8', passwordRules.PASSWORD_MIN_LENGTH === 8);
report(
  '6.2 messages are non-empty strings',
  typeof passwordRules.PASSWORD_LENGTH_MESSAGE === 'string' &&
    passwordRules.PASSWORD_LENGTH_MESSAGE.length > 0 &&
    typeof passwordRules.PASSWORD_FORMAT_MESSAGE === 'string' &&
    passwordRules.PASSWORD_FORMAT_MESSAGE.length > 0
);
report(
  '6.3 format message documents the exact backend set',
  passwordRules.PASSWORD_FORMAT_MESSAGE.includes('@$!%*?&')
);

// تطابق حرفي مع سلوك الباك المقيس حيّاً: هذه العيّنات قُبلت/رُفضت فعلياً.
const backendAccepted = ['Abcdef12@', 'Abcdef12!', 'Abcdef1@', 'Abcdefg1@', 'Abcdef12!@#'];
const backendRejected = ['123', 'Abcdef12#', 'Abcdef12-', 'Abcdef12 ', 'abcdef1@', 'ABCDEF1@'];
report(
  '6.4 backend-accepted passwords all valid',
  backendAccepted.every((p) => prCheck(p).isValid === true),
  backendAccepted,
  backendAccepted.filter((p) => !prCheck(p).isValid)
);
report(
  '6.5 backend-rejected passwords all invalid',
  backendRejected.every((p) => prCheck(p).isValid === false),
  backendRejected,
  backendRejected.filter((p) => prCheck(p).isValid)
);

report('6.6 length rule (7 rejected, 8 accepted)', prCheck('Ab1@').hasMinLength === false && prCheck('Abcde1@').hasMinLength === false && prCheck('Abcdef1@').hasMinLength === true);
report('6.7 uppercase rule', prCheck('abcdef1@').hasUpperCase === false && prCheck('Abcdef1@').hasUpperCase === true);
report('6.8 lowercase rule', prCheck('ABCDEF1@').hasLowerCase === false && prCheck('Abcdef1@').hasLowerCase === true);
report('6.9 digit rule', prCheck('Abcdefg@').hasNumber === false && prCheck('Abcdef1@').hasNumber === true);
report(
  '6.10 special rule is literally [@$!%*?&]',
  prCheck('Abcdef12#').hasSpecialChar === false &&
    prCheck('Abcdef12-').hasSpecialChar === false &&
    prCheck('Abcdef12 ').hasSpecialChar === false &&
    '@$!%*?&'.split('').every((ch) => prCheck(`Abcdef12${ch}`).hasSpecialChar === true)
);

report('6.11 checkPassword returns "" when valid', passwordRules.checkPassword('Abcdef1@') === '');

const ruleLabels = Object.fromEntries(passwordRules.PASSWORD_RULES.map((r) => [r.id, r.label]));
const weakMsg = passwordRules.checkPassword('123');
report(
  '6.12 checkPassword names only the failed rules',
  weakMsg.includes(ruleLabels.hasMinLength) &&
    weakMsg.includes(ruleLabels.hasUpperCase) &&
    weakMsg.includes(ruleLabels.hasLowerCase) &&
    weakMsg.includes(ruleLabels.hasSpecialChar) &&
    !weakMsg.includes(ruleLabels.hasNumber),
  '123 fails length/upper/lower/special but already has a digit',
  weakMsg
);

report(
  '6.13 getPasswordStrength bounded 0..4',
  passwordRules.getPasswordStrength('') === 0 &&
    passwordRules.getPasswordStrength('Abcdef1@') >= 3 &&
    passwordRules.getPasswordStrength('Abcdef12!@#') === 4
);
report('6.14 strengthLabels covers 0..4', Array.isArray(passwordRules.strengthLabels) && passwordRules.strengthLabels.length === 5);
report(
  '6.15 non-string input is safe',
  passwordRules.getPasswordChecks(null).isValid === false &&
    passwordRules.checkPassword(undefined).length > 0 &&
    passwordRules.getPasswordStrength(null) === 0
);

dom.window.sessionStorage.setItem(api.SESSION_EXPIRED_KEY, '1');
report(
  '6.16 consumeSessionExpired is one-shot',
  api.consumeSessionExpired() === true && api.consumeSessionExpired() === false
);

// 401 بلا توكن = زائر غير مسجّل: لا تُرفع علامة انتهاء ولا يُمسح مستخدم محلي.
resetStorage();
dom.window.sessionStorage.clear();
api.setUser({ name: 'زائر', role: 'customer' });
globalThis.fetch = async () => ({
  ok: false,
  status: 401,
  text: async () => JSON.stringify({ message: 'Unauthenticated.' }),
});
let anonErr = null;
try {
  await api.request('/api/dashboard', { auth: true });
} catch (e) {
  anonErr = e;
}
report(
  '6.17 anonymous 401 does not raise session expiry',
  anonErr instanceof api.ApiError && anonErr.status === 401 && api.consumeSessionExpired() === false
);
report('6.18 anonymous 401 keeps local user', api.getUser() !== null);

// 401 مع توكن = انتهاء جلسة حقيقي: مسح كامل + علامة للصفحة.
resetStorage();
dom.window.sessionStorage.clear();
api.setToken('tok-expired-999');
api.setUser({ name: 'سعيد', role: 'space_owner' });
try {
  await api.request('/api/dashboard', { auth: true });
} catch {
  /* متوقع */
}
report('6.19 401 with token clears the session', api.getToken() === null && api.getUser() === null);
report('6.20 401 with token flags expiry for the login page', api.consumeSessionExpired() === true);

// ----- نطاق مساعد العميل: علاقة فقط، بلا إنشاء مساحات أو حجوزات -----
console.log('\n===== Customer assistant scope (relationship only) =====');
const cReply = customerAssistant.localCustomerReply;
const CTX = {
  upcomingCount: 2,
  activeBookingsCount: 2,
  cancelledBookings: 1,
  nextBookingDate: '2026-10-02',
  nextBookingName: 'قاعة الأمل',
  favoritesCount: 3,
  openRequests: 1,
  hoursThisMonth: 6,
  hoursSpentThisMonth: 9,
  totalSpent: 250,
};
report('CS1 Answers upcoming bookings', cReply('ما هي حجوزاتي القادمة؟', CTX).includes('2 حجز قادم'), cReply('ما هي حجوزاتي القادمة؟', CTX));
report('CS2 Answers favourites', cReply('ما مساحاتي المفضلة؟', CTX).includes('3 مساحة'), cReply('ما مساحاتي المفضلة؟', CTX));
report('CS3 Answers custom requests', cReply('ما حالة طلباتي؟', CTX).includes('1 طلب خاص'), cReply('ما حالة طلباتي؟', CTX));
report('CS4 Answers activity summary', cReply('اعرض ملخص نشاطي', CTX).includes('250'), cReply('اعرض ملخص نشاطي', CTX));
report('CS5 Reports cancelled bookings', cReply('حجوزاتي الملغاة', CTX).includes('1 حجز ملغى'), cReply('حجوزاتي الملغاة', CTX));

const outOfScope = cReply('كيف أحجز مساحة؟', CTX);
report('CS6 Refuses to create a booking and gives no booking steps', !outOfScope.includes('تؤكد الحجز') && outOfScope.includes('تصفح المساحات'), outOfScope);
report('CS7 Refuses to recommend a space', cReply('اقترح لي أفضل مساحة', CTX).includes('تصفح المساحات'), cReply('اقترح لي أفضل مساحة', CTX));
report('CS8 Refuses to create a space', cReply('أضف مساحة جديدة', CTX).includes('تصفح المساحات'), cReply('أضف مساحة جديدة', CTX));
const fallbackReply = cReply('طائرتي متأخرة', CTX);
report('CS9 Fallback points to relationship topics only', !fallbackReply.includes('أحجز مساحة') && fallbackReply.includes('حجوزاتك'), fallbackReply);
report('CS10 Zero-state stays calm', cReply('ما هي حجوزاتي القادمة؟', { upcomingCount: 0 }).includes('ليس لديك حجز قادم'), cReply('ما هي حجوزاتي القادمة؟', { upcomingCount: 0 }));

const builtCtx = customerAssistant.buildCustomerContext({
  bookings: [{ status: 'confirmed', price: 100 }, { status: 'cancelled', price: 50 }],
  upcoming: [{ date: '2026-11-01', spaceName: 'ق', price: 100 }],
  favorites: [{}, {}],
  requests: [{ status: 'open' }],
  stats: { hoursThisMonth: 4 },
});
report('CS11 Context counts only real relationship data', builtCtx.activeBookingsCount === 2 && builtCtx.cancelledBookings === 1 && builtCtx.favoritesCount === 2 && builtCtx.openRequests === 1, JSON.stringify(builtCtx));

await server.close();

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('\nFailed list:');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}