// اختبار تكاملي للطبقة الواقعية: api / authStore / dashboard
// تحت بيئة jsdom + mock fetch، عبر محمّل Vite SSR لتحويل import.meta.env.
// يُشغَّل عبر: node --experimental-vm-modules src/utils/integration.test.mjs
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
const authStore = await server.ssrLoadModule('/src/lib/authStore.js');
const dashboard = await server.ssrLoadModule('/src/lib/dashboard.js');

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

// logout يمسح الرمز حتى لو فشل الخادم
globalThis.fetch = makeFetch({
  'POST /api/logout': { status: 500, body: { message: 'x' } },
});
await authStore.logout();
report('2.8 logout clears token even on server error', !authStore.isLoggedIn());

// getHomePath
report('2.9 getHomePath customer -> /dashboard/customer', authStore.getHomePath('customer') === '/dashboard/customer');
report('2.10 getHomePath owner -> /dashboard/space-owner', authStore.getHomePath('space_owner') === '/dashboard/space-owner');
report('2.11 getHomePath unknown defaults to customer', authStore.getHomePath('x') === '/dashboard/customer');

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

await server.close();

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('\nFailed list:');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}