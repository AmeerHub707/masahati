// اختبار عرض (Smoke) للوحة تحكم المشرف — يركّب كل تبويبات المسارات فعلياً
// تحت React + jsdom ويتفاعل معها (نطاقات، فلاتر، قوائم، نماذج).
// يلتقط أيضاً تحذيرات/أخطاء React عبر console.error وconsole.warn.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:5173',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.Event = dom.window.Event;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.File = dom.window.File;
globalThis.Blob = dom.window.Blob;
// FileReader يقرأ الملف المرفوع محلياً (معاينة فورية + حفظ بلا خادم)،
// وهو متاح في jsdom لكنه لم يكن معرّفاً على globalThis أعلاه.
if (!globalThis.FileReader) globalThis.FileReader = dom.window.FileReader;
if (!globalThis.HTMLElement) globalThis.HTMLElement = dom.window.HTMLElement;
if (!globalThis.Element) globalThis.Element = dom.window.Element;
if (!globalThis.Node) globalThis.Node = dom.window.Node;
if (!globalThis.Image) globalThis.Image = dom.window.Image;
if (!globalThis.MouseEvent) globalThis.MouseEvent = dom.window.MouseEvent;
if (!globalThis.KeyboardEvent) globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe() { this.cb([], this); }
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
};
dom.window.IntersectionObserver = globalThis.IntersectionObserver;
dom.window.matchMedia = dom.window.matchMedia || (() => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return false; },
}));

// ملاحظة مهمة: استيراد React يجب أن يكون ديناميكياً (بعد تهيئة jsdom أعلاه).
// الاستيراد الثابت (static) يُقيَّم قبل تهيئة النافذة، فيُهيّئ react-dom بدون DOM
// ويستخدم مسار polyfill لأحداث input فلا تلتقط تغييرات حقول النص.
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom');

let pass = 0;
let fail = 0;
const failures = [];
function report(name, ok, detail) {
  if (ok) pass++;
  else {
    fail++;
    failures.push({ name });
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`   ${detail}`);
}

// التقاط أخطاء المتصفح/React لاكتشاف التحذيرات غير المرئية.
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /width\(0\) and height\(0\)/i, // recharts داخل jsdom (بدون أبعاد)
  /is not a valid attribute for/i,
];
const consoleErrors = [];
const realError = console.error.bind(console);
const realWarn = console.warn.bind(console);
console.error = (...args) => {
  const msg = args.map(String).join(' ');
  if (!IGNORED_CONSOLE.some((re) => re.test(msg))) consoleErrors.push(`error: ${msg}`);
  realError(...args);
};
console.warn = (...args) => {
  const msg = args.map(String).join(' ');
  if (!IGNORED_CONSOLE.some((re) => re.test(msg))) consoleErrors.push(`warn: ${msg}`);
  realWarn(...args);
};

const { createServer } = await import('vite');
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

/**
 * خادم وهمي بدل الشبكة.
 *
 * اللوحة لم تعد تحمل بيانات وهمية، فكل ما تعرضه يردّ من `/api/admin`. ليبقى
 * الاختبار مستقلاً عن خادم حقيقي (وسرعة.Render باردة، و401 متغيّر) نخدم ردود
 * من `adminMockServer.mjs` — وهو خادم بحالة داخلية يحفظ ما تغيّره الشاشة.
 *
 * نقطة لم تُعرف في الخادم ترجع 404 صريحاً: الصمت كان يخفي مسارات كُسرت.
 */
const fixtures = await import('./adminFixtures.mjs');
const { createFixtureServer } = await import('./adminMockServer.mjs');

let mockServer = createFixtureServer();
const fixtureCalls = [];

const fixtureFetch = async (input, init) => {
  fixtureCalls.push(String(input?.url || input));
  return mockServer.fetch(input, init);
};

/**
 * يعيد الخادم الوهمي إلى حالته الأولى.
 *
 * لماذا: خادم الاختبار يحفظ ما تغيّره الشاشة (حذف مراجعة، أرشفة إشعار،
 * تغيير حالة مساحة). بدون تصفير بين الأقسام becameعدّاد قسم تعتمد على حالة
 * قسم سبقه، فكانت اختبارات «عدد المساحات» و«صفوف التصدير» تفشل لأسباب
 * خارج موضوعها. التصفير يقع عند كل تركيب، أي بين الأقسام، لا بين الإجراءين
 * داخل القسم الواحد — فيبقى اختبار «احفظ ثم تحقّق» صحيحاً.
 */
function resetFixtures() {
  mockServer = createFixtureServer();
  globalThis.fetch = fixtureFetch;
}

globalThis.fetch = fixtureFetch;

const adminAuth = await server.ssrLoadModule('/src/lib/adminAuth.js');
const adminApi = await server.ssrLoadModule('/src/lib/adminApi.js');

// جلسة حيّة مباشرة (لا تسجيل دخول): ما نختبره هنا هو عرض ردود الخادم، أما
// مسار الدخول فيغطّيه adminApi.test.mjs.
adminApi.saveAdminSession({
  token: 'test-admin-token',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  admin: { id: 1, name: 'إدارة مساحاتي', email: 'masahati@outlook.com' },
});

report(
  'B1 the admin session is live once a token is stored',
  adminAuth.isAdminLoggedIn() === true && adminAuth.adminSessionMode() === 'live',
  `loggedIn=${adminAuth.isAdminLoggedIn()} mode=${adminAuth.adminSessionMode()}`
);
report('B2 a rejected login throws instead of opening a session', await (async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', errors: {} }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
  try {
    await adminAuth.adminLogin('masahati@outlook.com', 'wrong-password');
    return false;
  } catch (err) {
    return /البريد الإلكتروني أو كلمة المرور/.test(err?.message || '');
  } finally {
    // الخادم الوهمي يعود قبل أي شاشة تُركَّب: استبدالُه هنا كان سيجعل كل
    // الاختبارات التالية تفشل على 404 بصمت.
    globalThis.fetch = fixtureFetch;
  }
})());

const AdminDashboardPage = (await server.ssrLoadModule('/src/pages/AdminDashboardPage.jsx')).default;

function flush() {
  return new Promise((r) => setTimeout(r, 60));
}

/**
 * Waits for the page's first paint instead of relying on a fixed sleep.
 *
 * Why: mount() used to wait a flat 120ms. Under CPU contention the heavier
 * admin tabs had not finished rendering by then, so assertions read a
 * half-painted DOM and failed intermittently.
 *
 * The signal here is the appearance of the layout shell (.dash__side), which
 * commits in the same pass as the page itself. That is deliberately a
 * *structural* signal, not a text-stability one: waiting for the text to stop
 * changing also waits out the DashCountUp animations and stretched the suite
 * from 18s to 43s for no benefit.
 *
 * It only guarantees the shell, though. Nested routes (/admin/notifications)
 * paint their content after it, so those call sites pair this with waitFor.
 */
async function settle(el, { timeout = 4000, step = 25 } = {}) {
  const started = Date.now();
  for (;;) {
    if (el.querySelector('.dash__side') && el.textContent) return true;
    if (Date.now() - started >= timeout) return false;
    await new Promise((r) => setTimeout(r, step));
  }
}

/** ينتظر تحقّق شرطٍ ما (نصّ يظهر، عنصر يظهر) مع مهلة قصوى. */
async function waitFor(predicate, { timeout = 4000, step = 25 } = {}) {
  const started = Date.now();
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() - started >= timeout) return false;
    await new Promise((r) => setTimeout(r, step));
  }
}

let currentPath = null;
function LocationProbe() {
  currentPath = useLocation().pathname;
  return null;
}

async function mount(path) {
  resetFixtures();
  const el = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(el);
  currentPath = path;
  const root = createRoot(el);
  root.render(
    React.createElement(MemoryRouter, { initialEntries: [path] },
      React.createElement(LocationProbe),
      React.createElement(Routes, null,
        React.createElement(Route, { path: '/admin/*', element: React.createElement(AdminDashboardPage) })
      )
    )
  );
  await settle(el);
  // التبويبات تُحمَّل كسولاً (React.lazy)، فـ settle() فوق لا يكفي: ينتظر ظهور
  // .dash__side من AdminLayout فقط، وهي تُرسم قبل وصول حزمة التبويب.
  // flush() الأول يلتزم أول commit قبل الفحص — لولاه لكان DOM فارغاً فـ waitFor
  // يُرجع true فوراً على «لا بديل تحميل» قبل أن يُرسَم البديل أصلاً.
  await flush();
  await waitFor(() => !el.querySelector('[data-tab-loading]'));
  await flush();
  return {
    el,
    path: () => currentPath,
    text: () => el.textContent || '',
    find: (sel) => el.querySelector(sel),
    findAll: (sel) => Array.from(el.querySelectorAll(sel)),
    async click(el2) {
      el2.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await flush();
      await flush();
    },
    async change(el2) {
      el2.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      await flush();
      await flush();
    },
    // React يقرأ القيمة من حدث input، لذا نستخدم الواصف الأصلي للـ value.
    async type(el2, value) {
      const proto = el2 instanceof dom.window.HTMLTextAreaElement
        ? dom.window.HTMLTextAreaElement.prototype
        : dom.window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el2, value);
      el2.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      await flush();
      await flush();
    },
    async clickText(txt, sel = 'button, a, [role=button]') {
      const node = Array.from(el.querySelectorAll(sel))
        .reverse()
        .find((n) => (n.textContent || '').trim().includes(txt));
      if (!node) return false;
      await this.click(node);
      return true;
    },
    unmount() {
      try { root.unmount(); } catch { /* ignore */ }
      el.remove();
    },
  };
}

console.log('\n===== ADMIN: مسارات التبويبات =====');

for (const [path, marker] of [
  ['/admin', 'اتجاه الإيرادات'],
  ['/admin/users', 'إدارة المستخدمين والملاك'],
  ['/admin/spaces', 'إدارة المساحات'],
  ['/admin/bookings', 'سجل الحجوزات'],
  ['/admin/reviews', 'التقييمات والمراجعات'],
  ['/admin/financials', 'توزيع الإيرادات'],
  ['/admin/settings', 'البيانات الشخصية وكلمة المرور'],
  ['/admin/notifications', 'التنبيهات الواردة'],
  ['/admin/notifications/inbox', 'التنبيهات الواردة'],
  ['/admin/notifications/broadcast', 'إرسال إشعار جماعي'],
]) {
  const view = await mount(path);
  // المسارات المتشعّبة (مثل /admin/notifications) تُرسم هيكل التخطيط قبل محتوى
  // التبويب، فانتظار .dash__side وحده لا يكفي — ننتظر نصّ العلامة المطلوبة.
  await waitFor(() => !!view.find('.dash__side') && view.text().includes(marker));
  const ok = view.text().includes(marker) && !!view.find('.dash__side');
  report(`A1 route ${path} renders "${marker}"`, ok, view.text().slice(0, 100));
  view.unmount();
}

console.log('\n===== ADMIN: التقارير المالية =====');
{
  const v = await mount('/admin/financials');
  const before = v.text();
  report('A2 financials renders stat cards', before.includes('إجمالي الإيرادات') && before.includes('مستحقات الملاك'));

  const clicked = await v.clickText('نطاق مخصص');
  report('A3 custom range pill clickable', clicked);
  report(
    'A4 custom range still renders the report',
    v.text().includes('إجمالي الإيرادات') && v.text().includes('مستحقات الملاك'),
    `path=${v.path()} text=${v.text().slice(0, 80)}`
  );
  report('A5 custom range shows date inputs', !!v.find('#custom-from') && !!v.find('#custom-to'));
  // نطاق ناقص: يُقال صراحةً ولا تُعرض أرقام شهر وكأنها أرقام هذا النطاق.
  report('A6 an incomplete custom range is called out', v.text().includes('حدّد تاريخ البداية والنهاية'), v.text().slice(0, 200));
  report('A7 financial values are thousand-separated', /\d,\d{3}/.test(v.text()), v.text().match(/\d{4,}\s*ش\.ج/)?.[0] || 'no big number found');

  // التواريخ والأرقام المتوقَّعة تُشتقّ من بيانات الخادم نفسه (وليس من تاريخ
  // مكتوب في الاختبار): الشاشات تحسب نطاقاتها من «اليوم» الحقيقي، فالتثبيت
  // هنا كان يختبر أرقاماً لم يعد أحد يستخدمها.
  const T = fixtures.TODAY;
  const shift = (isoDate, n) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const MONTH_FROM = `${T.slice(0, 7)}-01`;
  const sum = (from, to) => fixtures.sumRange(from, to);
  const money = (n) => n.toLocaleString('en-US');

  // شهر اليوم كاملاً = أرقام زر «هذا الشهر» بالضبط (مجموع السلسلة اليومية)،
  // وهذا هو الدليل على أن النطاق المخصص صار يُحسب بدل السقوط إلى الشهر.
  await v.type(v.find('#custom-from'), MONTH_FROM);
  await v.type(v.find('#custom-to'), T);
  const monthTotals = sum(MONTH_FROM, T);
  report(
    'A7b a full-month custom range matches the month preset',
    v.text().includes(money(monthTotals.revenue)) && v.text().includes(money(monthTotals.commission)),
    v.text().match(/\d{2,3},\d{3}\s*ش\.ج/g)?.slice(0, 3).join(' / ') || v.text().slice(0, 200)
  );
  report('A7c the missing-range hint clears once both dates are set', !v.text().includes('حدّد تاريخ البداية والنهاية'));
  report('A7d no NaN/undefined leaks from the custom range', !/undefined|NaN/.test(v.text()), v.text().match(/.{0,40}(undefined|NaN).{0,40}/)?.[0] || '');

  // فترة أضيق: يجب أن تُحسب من السلسلة لا أن تُنسخ من النطاق الأوسع.
  // نافذة أمس أضيق نافذة صالحة في كل شهر، فهي أضمن من «12 يوماً من الشهر»
  // الذي ينهار في اليوم الأول أو الثاني من الشهر.
  const narrowFrom = shift(T, -1);
  await v.type(v.find('#custom-from'), narrowFrom);
  await v.type(v.find('#custom-to'), narrowFrom);
  const shortTotals = sum(narrowFrom, narrowFrom);
  report(
    'A7e a narrower custom range recomputes instead of falling back',
    v.text().includes(money(shortTotals.revenue)),
    `expected ${money(shortTotals.revenue)} present=${v.text().includes(money(shortTotals.revenue))}`
  );

  // خارج تغطية السلسلة اليومية يُقال ذلك صراحةً.
  await v.type(v.find('#custom-to'), '2099-12-31');
  report('A7f out-of-coverage custom range warns about the covered span', v.text().includes('تغطي'), v.text().slice(0, 240));

  await v.clickText('اليوم');
  const todayTotals = sum(T, T);
  report('A8 switching back to preset range works', v.text().includes(money(todayTotals.revenue)), `${money(todayTotals.revenue)} expected`);

  // ── النطاق المخصص + صافي ربح المنصة (توصية 2) ─────────────────────────
  // صافي ربح اليوم عمولته من رقم واحد، فيُخصم منه نصيب اليوم من المدفوعات
  // المعلّقة لا الرقم كاملاً، ويبقى رقمٌ مختلف عن الصفر قابلاً للتدقيق.
  const todayText = v.text();
  const todayNet = Number(todayText.match(/صافي ربح المنصة\s*([\d,]+|-[\d,]+)/)?.[1]?.replace(/,/g, ''));
  report(
    'A9 net profit is range-scoped, not zeroed by the full pending balance',
    Number.isFinite(todayNet) && todayNet > 0 && todayNet < todayTotals.commission,
    `todayNet=${todayNet} commission=${todayTotals.commission}`
  );

  // نفس المرجع داخل النطاق المخصص: نافذة أمس، والرقم فيها أصغر من عمولة
  // نطاق الشهر في كل شهر (ما عدا لو كان الشهر يوماً واحداً — ونتحقق).
  await v.clickText('نطاق مخصص');
  await v.type(v.find('#custom-from'), narrowFrom);
  await v.type(v.find('#custom-to'), narrowFrom);
  const customNet = Number(v.text().match(/صافي ربح المنصة\s*([\d,]+|-[\d,]+)/)?.[1]?.replace(/,/g, ''));
  report(
    'A10 custom-range net profit is computed from that range, not the month',
    Number.isFinite(customNet) && customNet > 0 && customNet < shortTotals.commission,
    `customNet=${customNet} rangeCommission=${shortTotals.commission}`
  );

  // ── اختصارات التاريخ (توصية 5) ───────────────────────────────────────
  // الشرط الجوهري: النطاق المختار يقع داخل تغطية البيانات، وإلا ظهرت أصفار
  // بلا سبب. نتحقق من القيمة المدخلة نفسها لا من شكل الصفحة.
  const presetValue = () => v.find('#custom-from')?.value || '';
  const presetToValue = () => v.find('#custom-to')?.value || '';

  await v.clickText('أمس');
  report(
    'A11 the yesterday preset fills a one-day range inside the data span',
    presetValue() === shift(T, -1) && presetToValue() === shift(T, -1),
    `from=${presetValue()} to=${presetToValue()} expected=${shift(T, -1)}`
  );
  report('A11b the yesterday preset reports a non-empty day', /\d{1,3},\d{3}/.test(v.text()), v.text().match(/\d{2,3},\d{3}\s*ش\.ج/g)?.slice(0, 3).join(' / ') || '');

  await v.clickText('آخر 7 أيام');
  report(
    'A12 the last-7-days preset fills a seven-day range ending today',
    presetValue() === shift(T, -6) && presetToValue() === T,
    `from=${presetValue()} to=${presetToValue()} expected=${shift(T, -6)}..${T}`
  );
  // سبعة أيام تقع بين اليوم الواحد والسنة كاملة: قيمة قريبة من الصفر تعني أن
  // النطاق احتُسب خطأً أو وقع خارج التغطية. نقارن بالسنة لا بالشهر، فشهر
  // اليوم الأول يوم واحد لا سبعة.
  const yearTotals = fixtures.YEAR_TOTALS;
  report('A12b the last-7-days preset beats a single day but stays under the year', (() => {
    const nums = (v.text().match(/[\d]{1,3},\d{3}\s*ش\.ج/g) || []).map((s) => Number(s.replace(/[^\d]/g, '')));
    return nums.some((n) => n > todayTotals.revenue) && nums.every((n) => n <= yearTotals.revenue);
  })(), v.text().match(/[\d]{1,3},\d{3}\s*ش\.ج/g)?.slice(0, 4).join(' / ') || '');

  await v.clickText('منذ بداية الشهر');
  report(
    'A13 the month-to-date preset equals the full current-month range',
    presetValue() === MONTH_FROM && presetToValue() === T,
    `from=${presetValue()} to=${presetToValue()} expected=${MONTH_FROM}..${T}`
  );
  report('A13b month-to-date reproduces the month revenue exactly', v.text().includes(money(monthTotals.revenue)), v.text().match(/[\d]{2,3},\d{3}\s*ش\.ج/g)?.slice(0, 3).join(' / ') || '');
  report('A13c no preset leaves a zeroed-out report', !/^0\s*ش\.ج/m.test(v.text()), v.text().match(/0\s*ش\.ج/g)?.join(' / ') || '');

  v.unmount();
}

console.log('\n===== ADMIN: المعاملات مشتقّة من الحجوزات (توصية 1) =====');
{
  // الفحوص نفسها، لكن على بيانات الخادم الوهمي بدل جدول محلي: ما نتحقّق منه
  // هو صحّة الرد الذي تبني عليه الشاشة، لا اتّساق ملف وهمية.
  const bookings = fixtures.bookings;
  const spaces = fixtures.spaces;
  const transactions = fixtures.transactions;

  const ownerBySpace = new Map(spaces.map((sp) => [sp.name, sp.owner]));

  // كل حجز يجب أن يجد مالك مساحته. لو غاب اسم فالربط بالاسم انكسر، ويظهر
  // «غير محدّد» في الجدول — عطل صامت لا يظهر إلا في لقطة شاشة.
  const unmapped = bookings.filter((b) => !ownerBySpace.has(b.space));
  report('T1 every booking space resolves to a real owner', unmapped.length === 0, unmapped.map((b) => b.space).join(' | '));

  // «المالك» يجب أن يأتي من المساحة لا من صاحب الحجز.
  const leaked = transactions.filter((t) => t.user === t.owner && ownerBySpace.get(t.space) !== t.owner);
  report('T2 the owner column is never filled from the booking customer',
    leaked.length === 0,
    leaked.map((t) => `${t.ref}: ${t.owner}`).join(' | '));

  // المعاملة تُبنى من الحجز لا من مصفوفة ثانية: نفس المرجع ونفس التاريخ.
  const firstBooking = bookings[0];
  const firstTx = transactions.find((t) => t.ref === firstBooking.ref);
  report('T3 the transaction source is the bookings response itself, no parallel array',
    Boolean(firstTx) && firstTx.date === firstBooking.date && firstTx.user === firstBooking.user,
    `${firstTx?.ref} ${firstTx?.date} ${firstTx?.user}`);

  // ترتيب الأحدث أولاً، ثم تنازلياً بالرقم داخل اليوم نفسه.
  const sorted = [...bookings].sort((a, b) => (a.date === b.date ? b.id - a.id : (a.date < b.date ? 1 : -1)));
  report('T4 bookings sort newest-first, then by descending id within a day',
    sorted[0].date > sorted[1].date,
    sorted.slice(0, 3).map((b) => `${b.ref}@${b.date}`).join(' > '));

  // العمولة تُشتقّ من المبلغ لا تُكتب في جدول: 12% من 120 تُقرَّب 14، فصافي 106.
  const fee = Math.round(120 * fixtures.financialSummary.commission_rate);
  report('T5 commission and net payout derive from the amount', fee === 14 && 120 - fee === 106, `fee=${fee} net=${120 - fee}`);

  // أسماء عربية لا تُتلف في الربط.
  report('T6 Arabic names survive the owner join intact',
    ownerBySpace.get('استوديو الأناقة') === 'أحمد جودة' && ownerBySpace.get('مساحة المهندسين') === 'سامي حمدان',
    `${ownerBySpace.get('استوديو الأناقة')} / ${ownerBySpace.get('مساحة المهندسين')}`);
}

console.log('\n===== ADMIN: سلسلة الأيام المالية (أساس النطاق المخصص) =====');
{
  // الثوابت التي يجب أن يحفظها الخادم (§14.2): مجموع السلسلة اليومية يطابق
  // ملخّص الشهر، والنسبة تُشتقّ من المجموع لا من جمع الصفوف.
  const series = fixtures.dailySeries;
  const span = fixtures.dailyCoverage;
  const summary = fixtures.financialSummary;

  const inMonth = series.filter((d) => d.date >= fixtures.TODAY.slice(0, 7) + '-01' && d.date <= fixtures.TODAY);
  const revenue = inMonth.reduce((s, d) => s + d.revenue, 0);
  const bookingsCount = inMonth.reduce((s, d) => s + d.bookings, 0);
  const pending = inMonth.reduce((s, d) => s + d.pending, 0);

  report('D1 daily series sums exactly to the month revenue', revenue === summary.revenue, `${revenue} vs ${summary.revenue}`);
  report('D2 daily series sums exactly to the month bookings', bookingsCount === summary.bookings, `${bookingsCount} vs ${summary.bookings}`);
  report('D2b daily series sums exactly to the pending payouts', pending === summary.payouts_pending, `${pending} vs ${summary.payouts_pending}`);

  const commission = Math.round(revenue * summary.commission_rate);
  report(
    'D3 a summed full month reproduces the month commission and payouts',
    commission === summary.commission && revenue - commission === summary.payouts,
    `commission=${commission} payouts=${revenue - commission}`
  );

  // سلسلة كثيفة مرتّبة بلا فجوات: لو انقطعت التواريخ انكسر خطّ الرسم وبنى
  // النطاق على يوم غير موجود.
  const contiguous = series.every((d, i) => i === 0 || d.date > series[i - 1].date);
  const dayCount = Math.round((Date.parse(series.at(-1).date) - Date.parse(series[0].date)) / 86400000) + 1;
  report('D4 daily series is contiguous and sorted',
    contiguous && span.from === series[0].date && span.to === series.at(-1).date && dayCount === series.length,
    `${span.from}..${span.to} (${series.length} days, expected ${dayCount})`);

  // تغطية السلسلة تغطي شهر اليوم كاملاً، وإلا صار زر «هذا الشهر» صفراً.
  const coversToday = span.from <= `${fixtures.TODAY.slice(0, 7)}-01` && span.to >= fixtures.TODAY;
  report('D5 coverage spans the current month so the month preset is not empty', coversToday, `${span.from}..${span.to} today=${fixtures.TODAY}`);
}


console.log('\n===== ADMIN: تصدير التقرير (CSV / PDF) =====');
{
  // jsdom لا يطبع ولا ينفّذ تنزيل <a download>، فنستبدلهما لالتقاط الناتج
  // بدل تشغيل متصفح حقيقي. تُرقَّم هذه الحالات AF* تفادياً للتصادم مع A9..A35.
  const printCalls = [];
  const realPrint = dom.window.print;
  dom.window.print = () => printCalls.push(true);

  const downloads = [];
  const realAnchorClick = dom.window.HTMLAnchorElement.prototype.click;
  const realCreate = globalThis.URL.createObjectURL;
  const realRevoke = globalThis.URL.revokeObjectURL;
  let capturedBlob = null;
  globalThis.URL.createObjectURL = (b) => { capturedBlob = b; return 'blob:stub/1'; };
  globalThis.URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function stubbedDownload() {
    downloads.push(this.download);
  };

  // alert() الأصلي يعلّق المتصفح فنرصده، فنتحقّق فعلياً من إزالته.
  const alerts = [];
  const realAlert = dom.window.alert;
  dom.window.alert = (m) => { alerts.push(String(m)); };

  try {
    const v = await mount('/admin/financials');
    report('AF1 no native alert() anywhere on the page', alerts.length === 0, alerts.join(' | '));

    await v.clickText('تصدير التقرير');
    const items = v.findAll('[role=menu] [role=menuitem]');
    report('AF2 export menu offers exactly CSV + PDF', items.length === 2, `found ${items.length}: ${items.map((b) => b.textContent.trim()).join(' | ')}`);

    const csvItem = items.find((b) => b.textContent.includes('CSV'));
    if (csvItem) await v.click(csvItem);
    report('AF3 CSV export triggers a .csv download', downloads.length === 1 && downloads[0].endsWith('.csv'), `downloads=${JSON.stringify(downloads)}`);
    report('AF3b CSV export closes the dropdown', v.findAll('[role=menu]').length === 0, `menus=${v.findAll('[role=menu]').length}`);

    const csvText = capturedBlob ? await capturedBlob.text() : '';
    // blob.text() يزيل BOM حسب مواصفة UTF-8 decode، لذا نفحص البايتات الخام.
    const csvBytes = capturedBlob ? new Uint8Array(await capturedBlob.arrayBuffer()) : new Uint8Array();
    report('AF4 CSV starts with a UTF-8 BOM for Excel', csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf, `first3=${[...csvBytes.slice(0, 3)].map((b) => b.toString(16)).join(' ')}`);
    report('AF5 CSV keeps Arabic readable', csvText.includes('إجمالي الإيرادات') && csvText.includes('مساحة المهندسين'), csvText.slice(0, 120));
    report('AF6 CSV has no undefined/NaN', !/undefined|NaN/.test(csvText), csvText.match(/.{0,40}(undefined|NaN).{0,40}/)?.[0] || '');
    // النطاق الافتراضي هو الشهر: 241,500 إيراداً و28,980 عمولة.
    // الأرقام في الملف هي أرقام النطاق المعروض Moment: نشتقّها من بيانات
    // الخادم في الاختبار نفسه بدل تثبيتها هنا.
    const csvMonth = fixtures.sumRange(`${fixtures.TODAY.slice(0, 7)}-01`, fixtures.TODAY);
    report('AF7 CSV reports current range values',
      csvText.includes(csvMonth.revenue.toLocaleString('en-US')) && csvText.includes(csvMonth.commission.toLocaleString('en-US')),
      csvText.slice(0, 200));
    // عمود المستخدم مستقل عن المالك في الملف أيضاً، فيبقى الملف مطابقاً للجدول.
    report('AF7b CSV carries both the owner and the booking customer', csvText.includes('المستخدم') && csvText.includes('أحمد جودة') && csvText.includes('أحمد العمري'), csvText.slice(0, 200));
    report('AF8 CSV toast confirms the export', v.text().includes('تم تصدير التقرير كملف CSV'), v.text().slice(-120));

    await v.clickText('تصدير التقرير');
    const pdfItem = v.findAll('[role=menu] [role=menuitem]').find((b) => b.textContent.includes('PDF'));
    if (pdfItem) await v.click(pdfItem);
    report('AF9 PDF export calls window.print()', printCalls.length === 1, `printCalls=${printCalls.length}`);
    report('AF10 PDF export toasts instead of alerting', v.text().includes('حفظ كملف PDF') && alerts.length === 0, `alerts=${alerts.join(' | ')}`);

    await v.clickText('تصدير التقرير');
    const items2 = v.findAll('[role=menu] [role=menuitem]');
    const pdfLabel = items2.find((b) => b.textContent.includes('PDF'))?.textContent.trim();
    report('AF2b the print option is labelled طباعة / حفظ PDF', pdfLabel === 'طباعة / حفظ PDF', `label=${pdfLabel}`);
    await v.clickText('تصدير التقرير');

    const rowBtn = v.findAll('button[aria-label^="عرض تفاصيل المعاملة"]')[0];
    if (rowBtn) await v.click(rowBtn);
    const modal = v.find('.modal-overlay');
    const modalText = modal?.textContent || '';
    report('AF11 row action opens a details modal, not a toast', !!modal && !v.text().includes('قيد التطوير'), `modal=${!!modal} text=${v.text().slice(-140)}`);
    // النافذة تعرض أحدث معاملة كما رتّبها الخادم: الأحدث تاريخاً، وعند
    // التكرار ينزل الرقم الأكبر أولاً. نقارن بما يقوله الخادم لا برقم مثبّت
    // كان يتحوّل إلى كذبة كلما تغيّرت بيانات الاختبار.
    const newestTx = [...fixtures.transactions].sort(
      (a, b) => (a.date === b.date ? b.id - a.id : (a.date < b.date ? 1 : -1))
    )[0];
    report('AF11b the modal shows the newest booking: id, space, real owner, user, date, status',
      modalText.includes(newestTx.ref)
      && modalText.includes(newestTx.space)
      && modalText.includes(newestTx.owner)
      && modalText.includes(newestTx.user)
      // التاريخ يظهر بأرقام عربية (١ أكتوبر ٢٠٢٦) لا ISO: نقبل الصيغتين.
      && (/\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(modalText) || /[٠-٩]{4}/.test(modalText)),
      modalText.slice(0, 220));
    // «المالك» و«المستخدم» عمودان منفصلان: الأول مالك المساحة من adminSpaces،
    // والثاني صاحب الحجز من adminBookings. الخلط بينهما كان العطل الأصلي،
    // فالحارس هنا أن يظهر الاثنان معاً في النافذة.
    report('AF11e owner and booking customer are labelled separately',
      modalText.includes('المالك') && modalText.includes('المستخدم'),
      modalText.slice(0, 220));
    report('AF11c the modal shows total, 12% fee and net payout',
      modalText.includes('إجمالي المبلغ') && modalText.includes('عمولة المنصة (12%)') && modalText.includes('صافي مستحقات المالك'),
      modalText.slice(0, 240));
    report('AF11d the modal reuses the shared status badge', !!modal?.querySelector('.badge'), modal?.innerHTML?.slice(0, 160) || '');

    const receiptBtn = Array.from(modal?.querySelectorAll('button') || []).find((b) => b.textContent.includes('طباعة الإيصال'));
    report('AF12 the modal offers طباعة الإيصال', !!receiptBtn, `buttons=${Array.from(modal?.querySelectorAll('button') || []).map((b) => b.textContent.trim()).join(' | ')}`);
    if (receiptBtn) await v.click(receiptBtn);
    report('AF13 Print Receipt flags the body and calls window.print()',
      dom.window.document.body.classList.contains('is-receipt-print') && printCalls.length === 2,
      `body=${dom.window.document.body.className} printCalls=${printCalls.length}`);
    // كتلة الإيصال لا تُطبع إلا بها، فلا بد أن تكون موجودة في DOM الآن.
    report('AF13b the receipt block exists and sits outside the modal overlay', !!v.find('.fin-receipt') && !!v.find('.fin-receipt').closest('.modal-overlay') === false);

    // afterprint لا يصل إلى window إلا إذا كان الحدث فقاعاتيًّا.
    dom.window.dispatchEvent(new dom.window.Event('afterprint', { bubbles: true }));
    await flush();
    report('AF13c afterprint clears the receipt flag', !dom.window.document.body.classList.contains('is-receipt-print'), `body=${dom.window.document.body.className}`);

    // Escape يغلق النافذة (نفس سلوك Modal في ui.jsx).
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    report('AF14 Escape closes the transaction modal', !v.find('.modal-overlay'), `modal=${!!v.find('.modal-overlay')}`);

    v.unmount();
  } finally {
    dom.window.print = realPrint;
    dom.window.alert = realAlert;
    dom.window.HTMLAnchorElement.prototype.click = realAnchorClick;
    globalThis.URL.createObjectURL = realCreate;
    globalThis.URL.revokeObjectURL = realRevoke;
  }
}

console.log('\n===== ADMIN: إدارة المستخدمين =====');
{
  const v = await mount('/admin/users');
  report('A9 users table renders rows', v.findAll('.dash__table tbody tr').length > 0);

  const menuBtn = v.find('.dash__menu-btn');
  await v.click(menuBtn);
  const menu = dom.window.document.querySelector('.dash__menu--fixed');
  report('A10 row action menu opens', !!menu, 'no portal menu');
  // أربعة إجراءات سريعة فقط (العُقد: «تعديل البيانات» نُقل إلى نافذة الملف لا القائمة).
  const menuItems = menu ? Array.from(menu.querySelectorAll('button')).map((b) => b.textContent.trim()) : [];
  report(
    'A11 row action menu has exactly the 4 quick actions',
    menuItems.length === 4
      && menuItems[0].includes('عرض الملف')
      && menuItems[1].includes('تغيير الحالة')
      && menuItems[2].includes('حظر المستخدم')
      && menuItems[3].includes('حذف'),
    `items=[${menuItems.join(' | ')}]`
  );
  report('A11a the row menu no longer offers تعديل البيانات', !menuItems.some((t) => t.includes('تعديل')), `items=[${menuItems.join(' | ')}]`);
  const inViewport = !!menu && (() => {
    const r = menu.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0;
  })();
  report('A12 row menu positioned inside viewport', inViewport);

  // قائمة تغيير الحالة الفرعية
  const statusBtn = menu ? Array.from(menu.querySelectorAll('button')).find((b) => b.textContent.includes('تغيير الحالة')) : null;
  if (statusBtn) await v.click(statusBtn);
  // The status submenu is portalled in from a layout effect after the click,
  // so querying it straight away failed intermittently under CPU load: not
  // because the button was missed, but because the node was not mounted yet.
  // Same class of problem mount() fixes at the top of this file - the cure is
  // waiting for the node to appear, not sleeping.
  await waitFor(() => !!dom.window.document.querySelector('#admin-user-status-menu'));
  const subMenu = dom.window.document.querySelector('#admin-user-status-menu');
  // القائمة تعرض كل مفاتيح statusMeta بالترتيب نفسه (STATUS_ORDER)، فنتأكد
  // من التسمية لا من العدد: عدد الحالات قرارٌ في المنتج، لا عددٌ يُجمَّد هنا.
  const EXPECTED_STATUS_LABELS = ['بانتظار التفعيل', 'نشط', 'موقوف'];
  const subMenuLabels = subMenu
    ? Array.from(subMenu.querySelectorAll('button')).map((b) => b.textContent.replace(/\s+/g, ' ').trim())
    : [];
  report(
    'A11b status submenu lists every status',
    !!subMenu
      && subMenuLabels.length === EXPECTED_STATUS_LABELS.length
      && EXPECTED_STATUS_LABELS.every((label) => subMenuLabels.some((got) => got.includes(label))),
    subMenu ? `found ${subMenuLabels.length}: ${subMenuLabels.join(' / ') || '(empty)'}` : 'no submenu',
  );
  // الحالة التي نجربّها: أيّها تختلف عن الحالة المعروضة الآن في الصفّ الأول.
  // والاختيار مقصود: «موقوف» يعيد ما يفعله A13 بعده مباشرة، و«بانتظار
  // التفعيل» يُخرج الصفّ من تبويب العرض فيبدو الفشل «اختفاء» لا «عدم تطبيق».
  // والشرط نفسه يرفض الحالة نفسها، لأن تغيير حالةٍ إلى حالتها لا يثبت شيئاً.
  const beforeCell = dom.window.document.querySelector('.dash__table tbody tr [data-user-status]');
  const beforeStatus = beforeCell?.getAttribute('data-user-status') || '';
  const beforeLabel = (beforeCell?.textContent || '').replace(/\s+/g, ' ').trim();
  const otherStatusBtn = subMenu
    ? Array.from(subMenu.querySelectorAll('button'))
      .find((b) => b.textContent.replace(/\s+/g, ' ').trim() !== beforeLabel)
    : null;
  if (otherStatusBtn) await v.click(otherStatusBtn);
  await flush();
  const afterStatus = dom.window.document
    .querySelector('.dash__table tbody tr [data-user-status]')?.getAttribute('data-user-status') || '';
  report('A11c status change applies',
    !!otherStatusBtn && !!afterStatus && afterStatus !== beforeStatus,
    `${beforeStatus || '(none)'} ← ${afterStatus || '(none)'}`);

  // إعادة فتح قائمة الصف بعد إغلاقها بإجراء تغيير الحالة
  await v.click(v.find('.dash__menu-btn'));

  const suspendBtn = dom.window.document.querySelector('.dash__menu--fixed button.is-danger-soft');
  if (suspendBtn) await v.click(suspendBtn);
  report('A13 suspend action applies without crash', v.findAll('.dash__table tbody tr').length > 0);

  const bulk = v.findAll('button').find((b) => b.textContent.includes('إجراءات جماعية'));
  report('A14 bulk action button disabled with empty selection', !!bulk && bulk.disabled === true);

  const firstCheck = v.findAll('.dash__check')[1];
  if (firstCheck) {
    firstCheck.checked = true;
    await v.click(firstCheck);
  }
  const bulkAfter = v.findAll('button').find((b) => b.textContent.includes('إجراءات جماعية'));
  report('A15 bulk action button enabled after selection', !!bulkAfter && bulkAfter.disabled === false);

  // حذف مستخدم عبر القائمة — يجب ألا يسبّب تحذير React (تحديث حالة داخل مُحدِّث حالة)
  await v.click(v.find('.dash__menu-btn'));
  const deleteMenuItems = Array.from(dom.window.document.querySelectorAll('.dash__menu--fixed button'));
  const delBtn = deleteMenuItems.find((b) => b.textContent.includes('حذف'));
  if (delBtn) await v.click(delBtn);
  const confirmDelete = v.findAll('button').find((b) => b.textContent.includes('نعم، احذف'));
  report('A16 delete confirmation modal opens', !!confirmDelete, `items=${deleteMenuItems.length} [${deleteMenuItems.map((b) => b.textContent.trim()).join(' | ')}]`);
  // الصفحة مقسّمة إلى صفحات، لذا نتحقق من اختفاء الاسم لا من عدد الصفوف
  const deletedName = (v.findAll('.dash__table tbody tr')[0]?.querySelector('p')?.textContent || '').trim();
  if (confirmDelete) await v.click(confirmDelete);
  await flush();
  report('A17 delete removes the row', !!deletedName && !v.text().includes(deletedName), `deleted=${deletedName}`);
  v.unmount();
}

// أدوات النوافذ: على مستوى الملف لا داخل الكتلة، لأن أكثر من اختبار يفتح
// نافذة الملف (اختبار التداخل، واختبار مستندات التحقق) ونسخُها في كل
// كتلة يعني نسختين تتفرّقان عند أول تعديل.
const overlays = () => Array.from(dom.window.document.querySelectorAll('.modal-overlay'));
const overlayByLabel = (re) => overlays().find((o) => re.test(o.getAttribute('aria-label') || ''));
// waitFor ترجع صح/خطأ لا العنصر، فننتظر ثم نلتقط العنصر من جديد: الالتقاط
// قبل الانتظار كان يعطي null، والنتيجة بعده تصير زائفة.
const waitOverlay = async (re) => ((await waitFor(() => !!overlayByLabel(re))) ? overlayByLabel(re) : null);

console.log('\n===== ADMIN: تداخل نافذة الملف مع نافذة التعديل =====');
{
  // العطل: نموذج التعديل يُفتح من زر القلم **داخل** نافذة الملف، فصارتا
  // مفتوحتين معاً على طبقتين مختلفتين، وتعلّت نافذةُ الملف نموذجَ التعديل
  // (141 فوق 100) — فلم يُرَ النموذج ولا قُبلت عليه نقرة، والنقرة تصيب حجاب
  // الملف فيُغلق الملف ويومض النموذج.
  //
  // الفحص على رقم الطبقة نفسه لا على وجود النافذتين: ترتيب DOM وترتيب
  // الالتحام هما بالضبط ما ينكسر هنا، فوجود العنصرين معاً لا يثبت أنهما
  // متراكبان فعلاً. ولما كان A45 يبحث عن زر التعديل في قائمة الصف —
  // وقد نُقل منها إلى نافذة الملف — لم يغطِّ هذا المسار أحد.
  const v = await mount('/admin/users');
  await waitFor(() => v.findAll('.dash__tr-select').length > 0);
  const baseOverflow = dom.window.document.body.style.overflow;

  const zOf = (el) => Number(el?.style?.zIndex || 0);
  const pressEscape = async () => {
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    await flush();
  };
  const openEditFromProfile = async (from) => {
    const pencil = from?.querySelector('button[aria-label="تعديل البيانات"]');
    if (pencil) await v.click(pencil);
    return waitOverlay(/^تعديل حساب /);
  };

  // نقر الصف يفتح نافذة الملف.
  await v.click(v.findAll('.dash__tr-select')[0]);
  const profile = await waitOverlay(/^ملف /);
  report('A47a نقر الصف يفتح نافذة الملف', !!profile, `overlays=${overlays().length}`);
  report('A47b نافذة الملف تمنع تمرير الصفحة خلفها', dom.window.document.body.style.overflow === 'hidden', `overflow="${dom.window.document.body.style.overflow}"`);

  // زر القلم داخلها يفتح نموذج التعديل فوقها لا خلفها.
  const edit = await openEditFromProfile(profile);
  report('A47c زر القلم داخل نافذة الملف يفتح نموذج التعديل', !!edit,
    `overlays=${overlays().map((o) => o.getAttribute('aria-label')).join(' | ')}`);
  report('A47d نموذج التعديل في طبقة أعلى من نافذة الملف', !!edit && !!profile && zOf(edit) > zOf(profile),
    `edit=${zOf(edit)} profile=${zOf(profile)}`);
  // طبقتان معتمتان فوق بعضهما تُعتِمان الصفحة مرتين، وحافتا بطاقة بيضاء
  // تبرزان حول النموذج، فنُخفي البطاقة السفلى ما دامت العليا مفتوحة.
  report('A47e البطاقة السفلى مخفية لا متقاطعة مع النموذج', !!profile && profile.style.visibility === 'hidden',
    `visibility="${profile?.style.visibility}"`);

  // النموذج صالح للاستعمال: يُكتب فيه ويُحفظ، فيظهر الاسم الجديد في الملف.
  const NEW_NAME = 'اسم محفوظ بعد التعديل';
  const nameInput = edit?.querySelector('input.dash__input');
  if (nameInput) await v.type(nameInput, NEW_NAME);
  const saveBtn = edit && Array.from(edit.querySelectorAll('button')).find((b) => b.textContent.includes('حفظ التعديلات'));
  if (saveBtn) await v.click(saveBtn);
  const afterSave = await waitOverlay(/^ملف /);
  report('A47f الحفظ يُغلق النموذج ويُبقي نافذة الملف مفتوحة',
    !!afterSave && !overlayByLabel(/^تعديل حساب /),
    `overlays=${overlays().map((o) => o.getAttribute('aria-label')).join(' | ')}`);
  report('A47g نافذة الملف تعرض الاسم المحفوظ لا القديم',
    !!afterSave && afterSave.textContent.includes(NEW_NAME),
    (afterSave?.textContent || '').slice(0, 60));
  report('A47h البطاقة تُكشف من جديد بعد الحفظ', !!afterSave && !afterSave.style.visibility,
    `visibility="${afterSave?.style.visibility}"`);

  // النقر على خلفية نموذج التعديل يبتلعه هو ويغلقه وحده. الخلفية تخصّ الطبقة
  // العليا، فمن حقّها أن تفعل ذلك لا أن تُغلق الملف تحتها — وقد صار ذلك
  // محض صدفة حين كانت الطبقتان متداخلتين.
  await openEditFromProfile(afterSave);
  const edit2 = overlayByLabel(/^تعديل حساب /);
  if (edit2) await v.click(edit2);
  report('A47l النقر على خلفية نموذج التعديل يُغلقه ويُبقي الملف',
    !!edit2 && !overlayByLabel(/^تعديل حساب /) && !!overlayByLabel(/^ملف /),
    `overlays=${overlays().map((o) => o.getAttribute('aria-label')).join(' | ')}`);

  // Escape يُغلق النافذة العليا وحدها. مستمعان على window في مرحلة واحدة
  // يلتقطان الحدث نفسه، فبلا حارسٍ في نافذة الملف أغلقت ضغطة واحدة الاثنتين.
  await openEditFromProfile(afterSave);
  await pressEscape();
  report('A47i Escape يُغلق نموذج التعديل وحده ويُبقي الملف',
    !overlayByLabel(/^تعديل حساب /) && !!overlayByLabel(/^ملف /),
    `overlays=${overlays().map((o) => o.getAttribute('aria-label')).join(' | ')}`);
  await pressEscape();
  // نافذة الملف تخرج بحركة (AnimatePresence)، فننتظر اختفاءها لا نقيسه فوراً.
  const closed = await waitFor(() => overlays().length === 0);
  report('A47j Escape التالي يُغلق نافذة الملف', closed, `overlays=${overlays().length}`);

  // وقفل التمرير يعود كما كان بعد الإغلاق، وإلا بقيت الصفحة ميّتة. الفحص
  // ينتظر الاستعادة لا يقرؤها فوراً: الإغلاق يمرّ في تصييرين (مسار النافذة
  // يُصفَّر ثم يتقدّم المسار)، والعينة الواحدة كانت تقرأ الحالة بينهما.
  const overflowBack = await waitFor(() => dom.window.document.body.style.overflow === baseOverflow);
  report('A47k تمرير الصفحة يعود إلى حالته السابقة بعد الإغلاق', overflowBack,
    `overflow="${dom.window.document.body.style.overflow}" expected="${baseOverflow}"`);

  v.unmount();
}
console.log('\n===== ADMIN: قسم مستندات التحقق في نافذة الملف =====');
{
  const v = await mount('/admin/users');
  await waitFor(() => v.findAll('.dash__table tbody tr').length > 0);

  // طابور التفعيل: الحسابات `pending` وحدها. الفحص على الجدول المعروض لا
  // على عدّاد الملخص، فالعدّاد مجموع كل الصفحات والجدول صفحة واحدة.
  await v.clickText('بانتظار التفعيل');
  await waitFor(() => v.findAll('.dash__table tbody tr').length > 0);
  const pendingRows = v.findAll('.dash__table tbody tr');
  report('B1 تبويب «بانتظار التفعيل» يعرض صفوفاً',
    pendingRows.length > 0, `rows=${pendingRows.length}`);

  // كل صف في الطابور مالك مساحة: الطابور لأصحاب المساحات وحدهم، وحساب
  // فريلانسر فيه يعني أن الفلتر تسرّب.
  const pendingBadges = pendingRows.map((r) => (r.querySelector('[data-role-badge]')?.textContent || '').trim());
  report('B2 الطابور يخصّ ملاك المساحات وحدهم',
    pendingBadges.length > 0 && pendingBadges.every((t) => t === 'مالك مساحة'),
    [...new Set(pendingBadges)].join(' | '));

  // نافذة الملف للحساب المعلّق تحتوي قسم المستندات.
  await v.click(v.findAll('.dash__tr-select')[0]);
  const profile = await waitOverlay(/^ملف /);
  const docs = profile?.querySelector('[data-owner-docs]');
  report('B3 نافذة الملف تعرض قسم مستندات التحقق',
    !!docs, docs ? `docs=${docs.getAttribute('data-owner-docs')}` : `no section in "${(profile?.textContent || '').slice(0, 60)}"`);

  // كل مستند رابطٌ يفتح تبويباً جديداً، و`rel` يحمي من رفع النافذة.
  const docLinks = docs ? Array.from(docs.querySelectorAll('a')) : [];
  report('B4 كل مستند رابطٌ قابل للفتح',
    docLinks.length > 0
    && docLinks.every((a) => (a.getAttribute('href') || '').length > 0 && a.getAttribute('target') === '_blank' && (a.getAttribute('rel') || '').includes('noopener')),
    docLinks.map((a) => a.getAttribute('href')).join(' | '));

  // الرابط النسبي من الخادم يُحوَّل إلى رابط كامل على مخدم الـ API، وإلا
  // فتحه الأدمن على أصل صفحة الواجهة.
  report('B5 روابط /storage تُحوَّل إلى روابط كاملة',
    docLinks.length > 0 && docLinks.every((a) => /^https?:\/\//.test(a.getAttribute('href') || '')),
    docLinks[0]?.getAttribute('href') || 'none');

  // التسمية عربية، لا المفتاح الإنجليزي الذي يرسله الخادم.
  const docLabels = docLinks.map((a) => (a.querySelector('.font-bold')?.textContent || '').trim());
  report('B6 تسميات المستندات عربية',
    docLabels.length > 0 && docLabels.every((t) => t === 'وثيقة الملكية' || t === 'السجل التجاري' || t === 'وثيقة الهوية' || t === 'مستند'),
    docLabels.join(' | '));

  // زرّا القرار معاً: الاعتماد والإيقاف. ناقصٌ واحد يعني طابوراً لا يُفرَّغ.
  report('B7 زرّ الاعتماد وزرّ الإيقاف موجودان',
    !!docs?.querySelector('[data-owner-approve]') && !!docs?.querySelector('[data-owner-suspend]'),
    docs ? `approve=${!!docs.querySelector('[data-owner-approve]')} suspend=${!!docs.querySelector('[data-owner-suspend]')}` : 'no section');

  // الاعتماد يفعّل الحساب، فيخرج من الطابور ويختفي القسم (لا قرار عليه).
  const name = (profile?.querySelector('.truncate')?.textContent || '').trim();
  // نرصد ما ينطلق من هذا النقر تحديداً: الاختبارات الأخرى تُترك سابقةً في
  // `fixtureCalls` فلا يجوز قراءتها دون قصّة.
  const beforeApproveCalls = fixtureCalls.length;
  await v.click(docs.querySelector('[data-owner-approve]'));
  await flush();
  await flush();
  const afterApprove = overlayByLabel(/^ملف /);
  report('B8 الاعتماد يُخفي القسم لأن الحساب لم يعد معلّقاً',
    !!afterApprove && !afterApprove.querySelector('[data-owner-docs]'),
    `section gone=${!afterApprove?.querySelector('[data-owner-docs]')}`);
  report('B9 الاعتماد يعرض الحالة الجديدة في النافذة',
    !!afterApprove && afterApprove.textContent.includes('نشط'),
    (afterApprove?.textContent || '').includes('نشط') ? 'نشط' : (afterApprove?.textContent || '').slice(0, 80));
  void name;

  // عقد A4.5 لا A4.4: الاعتماد يضع `verified` و`status` معاً. مسار الحالة
  // وحدها لا تمسّ التوثيق، فيبقى المعتمد محسوباً «بانتظار التحقق» في شريط
  // العدّادات — عطلٌ كان الخادم الوهمي يخفيه لأن مسار `/status` عنده يوثّق
  // معه، فلم يظهر إلا على الخادم الحقيقي.
  const approveCalls = fixtureCalls.slice(beforeApproveCalls);
  const verifyCalls = approveCalls.filter((u) => /\/api\/admin\/users\/[^/]+\/verify/.test(u));
  report('B9b الاعتماد يستدعي PATCH .../verify عقداً لا .../status وحدها',
    verifyCalls.length > 0,
    approveCalls.length ? approveCalls.join(' | ') : 'no network call');

  // إغلاق النافذة، ثم نتحقق أن الحساب المعتمد خرج من الطابور.
  const closeBtn = afterApprove?.querySelector('button[aria-label="إغلاق"]');
  if (closeBtn) await v.click(closeBtn);
  await flush();
  await flush();
  await waitFor(() => !overlayByLabel(/^ملف /));
  const leftQueue = v.findAll('.dash__table tbody tr').length;
  const expectedLeft = Math.max(0, pendingRows.length - 1);
  report('B10 الحساب المعتمد يخرج من الطابور',
    leftQueue === expectedLeft, `rows=${leftQueue} expected=${expectedLeft} (was ${pendingRows.length})`);

  // الإيقاف: يفتح تأكيداً أولاً. إيقافُ حسابٍ بنقرة واحدة قرارٌ لا يجوز أن
  // يكون في متناول الإهمال. ولا نكتب «رفض» هنا: الرفض قرارٌ ثالث لا وجود له
  // في مفردات الحساب، والإيقاف هو ما تفعله اللوحة فعلاً.
  await v.click(v.findAll('.dash__tr-select')[0]);
  const profile2 = await waitOverlay(/^ملف /);
  const suspendBtn = profile2?.querySelector('[data-owner-suspend]');
  if (suspendBtn) await v.click(suspendBtn);
  await flush();
  const confirm = await waitOverlay(/إيقاف الحساب/);
  report('B11 الإيقاف يطلب تأكيداً قبل التنفيذ',
    !!confirm, `overlays=${overlays().map((o) => o.getAttribute('aria-label')).join(' | ')}`);

  // الإلغاء لا يغيّر شيئاً: القسم ما زال ظاهراً والحساب ما زال معلّقاً.
  if (confirm) {
    const cancel = Array.from(confirm.querySelectorAll('button')).find((b) => b.textContent.includes('إلغاء'));
    if (cancel) await v.click(cancel);
  }
  await flush();
  await flush();
  const afterCancel = overlayByLabel(/^ملف /);
  report('B12 إلغاء الإيقاف يبقي الحساب معلّقاً',
    !!afterCancel && !!afterCancel.querySelector('[data-owner-docs]'),
    `section still there=${!!afterCancel?.querySelector('[data-owner-docs]')}`);

  // الإلغاء لا يغيّر شيئاً، وهذه أيضاً نصف ما نعد به: قسم المستندات ما زال
  // ظاهراً، أي أن الحساب لم يُوقَف.
  v.unmount();
}
console.log('\n===== ADMIN: الأدوار والتبويبات (تصنيفان: فريلانسر / مالك مساحة) =====');
{
  /** نصوص شارات الدور في الصفحة الحالية (لا شارات الحالة والتحقق). */
  const roleTextsOf = (page) =>
    page.findAll('.dash__table tbody tr [data-role-badge]').map((b) => b.textContent.trim());

  const v = await mount('/admin/users');
  await waitFor(() => v.findAll('.dash__table tbody tr').length > 0);

  // 1) التعريب والدمج: أربع قيم خام من الخادم ⟵ تسميتان معروضتان.
  //    الفحص على `[data-role-badge]` وحدها: الصف يحمل ثلاث شارات (دور، حالة،
  //    تحقق) وكلها نصّ عربي، فالبحث بالـ class وحده كان يفحص الثلاث معاً.
  const roleTexts = roleTextsOf(v);
  report('A41a role badges use only the two display labels',
    roleTexts.length > 0 && roleTexts.every((t) => ['فريلانسر', 'مالك مساحة', '—'].includes(t)),
    roleTexts.slice(0, 6).join(' | '));
  report('A41b space_owner renders as مالك مساحة (not the raw value)',
    v.text().includes('مالك مساحة') && !v.text().includes('space_owner'),
    `roles in fixtures: ${[...new Set(fixtures.users.map((u) => u.role))].join(',')}`);
  report('A41c customer is merged into فريلانسر, never shown as its own label',
    fixtures.users.some((u) => u.role === 'customer')
      && !roleTexts.includes('عميل')
      && roleTexts.includes('فريلانسر'),
    `labels seen: ${[...new Set(roleTexts)].join(' | ')}`);

  // 2) التبويبات. التوقّعات محسوبة من بيانات الاختبار نفسها فلا تثبت أرقاماً.
  const isOwner = (r) => r === 'owner' || r === 'space_owner';
  const isFreelancer = (r) => r === 'freelancer' || r === 'customer';
  const expectedOwners = fixtures.users.filter((u) => isOwner(u.role)).length;
  const expectedFreelancers = fixtures.users.filter((u) => isFreelancer(u.role)).length;

  const ownerTabBadges = await (async () => {
    await v.clickText('ملاك المساحات');
    await waitFor(() => v.findAll('.dash__table tbody tr').length > 0);
    return roleTextsOf(v);
  })();
  report('A42a تبويب ملاك المساحات يجمع owner وspace_owner معاً',
    ownerTabBadges.length > 0 && ownerTabBadges.every((t) => t === 'مالك مساحة'),
    [...new Set(ownerTabBadges)].join(' | '));
  report('A42b الملخص يذكر عدد الملاك بعدّ الإملاءين',
    v.text().includes(`${expectedOwners} مالك مساحة`),
    `summary owners=${expectedOwners}`);

  const freelancerBadges = await (async () => {
    await v.clickText('فريلانسرز');
    await waitFor(() => v.findAll('.dash__table tbody tr').length > 0);
    return roleTextsOf(v);
  })();
  report('A43a تبويب الفريلانسرز يعرض التصنيف الواحد',
    freelancerBadges.length > 0 && freelancerBadges.every((t) => t === 'فريلانسر'),
    [...new Set(freelancerBadges)].join(' | '));

  // الفريلانسرز يجمع الدورين: نقيس بعدد الصفوف في **كل الصفحات** عبر
  // شريط العدّاد في الملخص، فالجدول مقسّم 10 صفوف لكل صفحة.
  report('A43b تبويب الفريلانسرز يضمّ freelancer وcustomer معاً',
    v.text().includes(`${expectedFreelancers} فريلانسر`),
    `summary freelancers=${expectedFreelancers} (freelancer+customer)`);

  // 3) «كل الحسابات»: لا فلترة بالدور.
  await v.clickText('كل الحسابات');
  await waitFor(() => v.findAll('.dash__table tbody tr').length > 0);
  const allBadges = roleTextsOf(v);
  report('A44a تبويب كل الحسابات يعرض التصنيفين بلا استثناء',
    allBadges.includes('مالك مساحة') && allBadges.includes('فريلانسر'),
    [...new Set(allBadges)].join(' | '));

  // حساب قادم بـcustomer: يظهر في كل الحسابات وبتسمية «فريلانسر».
  // نبحث باسمه لأن الجدول مقسّم 10 صفوف لكل صفحة وهو خارج الصفحة الأولى.
  const merged = fixtures.users.find((u) => u.role === 'customer');
  const searchInput = v.find('input[type="search"]');
  if (searchInput) await v.type(searchInput, merged.name);
  await waitFor(() => v.findAll('.dash__table tbody tr [data-role-badge]').length > 0);
  report('A44c الحساب المخموج يظهر بتسمية فريلانسر',
    v.text().includes(merged.name) && roleTextsOf(v).includes('فريلانسر'),
    `searched=${merged.name} roles=${roleTextsOf(v).join(' | ')}`);
  if (searchInput) await v.type(searchInput, '');

  // 4) كلمة «عميل» غير موجودة في أي مكان من الصفحة.
  report('A44d الكلمة «عميل» اختفت من الصفحة بالكامل',
    !v.text().includes('عميل'),
    v.text().includes('عميل') ? 'found' : 'absent');

  // 5) الملخص: تصنيفان فقط.
  const summaryLine = (v.text().match(/[0-9٠-٩]+ حساب[^\n]*/) || [''])[0];
  report('A44b الملخص يذكر الملاك والفريلانسرز فقط',
    summaryLine.includes('مالك مساحة') && summaryLine.includes('فريلانسر') && !summaryLine.includes('عميل'),
    summaryLine.slice(0, 140));

  // 6) نموذج التعديل: التصنيفان فقط، والدور المخموج يُختار «فريلانسر».
  //
  // المسار تغيّر تحتَ هذا الفحص: زر التعديل نُقل من قائمة الصف إلى نافذة
  // الملف (انظر تعليق A47a)، فالمقاطعة القديمة لم تعد تجد «تعديل» في القائمة
  // أصلاً. والالتقاط كان بـ`v.find` المقيّد بجذر التصيير، والنافذة منفَّذة عبر
  // `createPortal` إلى `document.body` خارج الجذر — فتعود صفراً مهما طال
  // الانتظار، وكان غلافها `if (customerRow)` يبتلع فحصَين بصمت فلا يُعرف أنهما
  // لم يعملان. فنفتح الملف ثم القلم، ونلتقط النافذة من `document` كما تفعل
  // بقية فحوص النوافذ هنا، ونسقط الصمت: غياب النموذج يظهر فشلاً بنصّه.
  const editForm = await (async () => {
    if (searchInput) await v.type(searchInput, merged.name);
    await waitFor(() => v.findAll('.dash__table tbody tr [data-role-badge]').length > 0);
    const row = v.findAll('.dash__tr-select')[0];
    if (row) await v.click(row);
    const profile = await waitOverlay(/^ملف /);
    const pencil = profile && profile.querySelector('button[aria-label="تعديل البيانات"]');
    if (pencil) await v.click(pencil);
    return waitOverlay(/^تعديل حساب /);
  })();
  const openFormDetail = () =>
    `overlays=${overlays().map((o) => o.getAttribute('aria-label')).join(' | ')}`;

  const customerRow = editForm ? editForm.querySelector('select.dash__input') : null;
  const values = customerRow ? Array.from(customerRow.querySelectorAll('option')).map((o) => o.value) : [];
  report('A45 نموذج التعديل يعرض التصنيفين فقط',
    !!customerRow && values.filter(Boolean).sort().join(',') === 'freelancer,space_owner',
    customerRow ? values.join(' | ') : openFormDetail());
  report('A45b حساب customer يُختار له «فريلانسر» تلقائياً',
    !!customerRow && customerRow.value === 'freelancer',
    `value=${customerRow ? customerRow.value : openFormDetail()}`);

  // 7) قائمة الحالة في النموذج نفسه: ثلاث حالات لا رابعة، ولا «قيد المراجعة».
  //     الاختيار بقائمة فيها `pending` لا بالترتيب: قائمتا النموذج تختلفان
  //     ترتيباً عن `STATUS_ORDER` في الجدول، فالترتيب خاصّة بقراءة السطر لا
  //     بترتيب الحقول في النموذج.
  const statusRow = editForm
    ? Array.from(editForm.querySelectorAll('select.dash__input'))
      .find((s) => Array.from(s.options).some((o) => o.value === 'pending'))
    : null;
  const statusValues = statusRow ? Array.from(statusRow.options).map((o) => o.value).filter(Boolean) : [];
  const statusLabels = statusRow
    ? Array.from(statusRow.options).map((o) => (o.textContent || '').trim())
    : [];
  report('A45c قائمة الحالة ثلاث حالات بلا «قيد المراجعة»',
    statusValues.length === 3
      && statusValues.slice().sort().join(',') === 'active,pending,suspended'
      && !statusLabels.some((l) => l.includes('قيد المراجعة')),
    `values=${statusValues.join(',')} labels=${statusLabels.join(' | ') || openFormDetail()}`);
  v.unmount();
}

console.log('\n===== ADMIN: التحديث التلقائي لقائمة الحسابات =====');
{
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../components/admin/AdminUsers.jsx', import.meta.url),
    'utf8'
  );
  report('APa قائمة المستخدمين تطلب نبضة كل 30 ثانية',
    /USERS_POLL_MS\s*=\s*30000/.test(src) && /pollMs:\s*USERS_POLL_MS/.test(src),
    'USERS_POLL_MS = 30000 مع pollMs في الخطّاف');

  // الفحص السلوكي للنبضة على الخطّاف نفسه بمهلة قصيرة: لا ننتظر 30 ثانية
  // في اختبار، فنتأكد أن المؤقّت يُعاد جدولته بعد كل ردّ، وأن الطلبات لا
  // تتراكم، وأن النتيجة المعروضة تبقى أحدث ما وصل.
  const hookMod = await server.ssrLoadModule('/src/components/admin/useAdminData.js');
  const useAdminData = hookMod.default;

  let calls = 0;
  const rowsSeen = [];
  function Poller() {
    const { data, updatedLabel } = useAdminData(async () => {
      calls += 1;
      return { n: calls };
    }, [], { pollMs: 50 });
    rowsSeen.push({ n: data?.n ?? null, updated: updatedLabel });
    return React.createElement('div', { 'data-poll': data ? data.n : 'none' });
  }

  const el = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  adminApi.saveAdminSession({ token: 'poll-test-token' });
  root.render(React.createElement(Poller));
  await flush();
  const firstCount = calls;
  await new Promise((r) => setTimeout(r, 260));
  const afterCount = calls;

  // الفحص كان يسمّى A46c ويقارن `data-poll` بعدد الطلبات في لحظة واحدة،
  // فكان يفشل أحياناً لا لأن الخطّاف خاطئ بل لأن تصيير React معلّق: `calls`
  // يُزاد فور انتهاء الطلب، أما DOM فيتأخّر حتى يمرّ تحديث الحالة ويُرسم.
  // الفارق هنا سباقٌ زمني لا علاقة له بما نتحقّق منه. وسُمّي APc لا A46c
  // لأن كتلة «جمع العربية» تستعمل A46b..A46d، وتكرار الرقم يجعل قراءة الخلل
  // مبهمة: أيّهما سقط؟
  //
  // الصواب: نعيّن الشرط الذي نريده فعلاً على عدّة نبضات. القيمة المعروضة يجب
  //   1) ألا تتراجع — ردّ قديم لا يجوز أن يطغى على أحدث منه،
  //   2) ألا تتجاوز عدد الطلبات — لا تراكم ولا تكرار في الحالة،
  //   3) أن تتقدّم عن أوّل ردّ — أي أنها استُعملت فعلاً.
  // هذا كلٌّ قابل للقياس في أي لحظة، فينتهي التذبذب بدل إخفائه.
  const samples = [];
  for (let i = 0; i < 6; i += 1) {
    await flush();
    const node = el.querySelector('[data-poll]');
    samples.push({ rendered: node ? Number(node.getAttribute('data-poll')) : 0, calls });
  }

  report('APb النبضة تعيد الجلب دورياً بلا تدخّل',
    firstCount >= 1 && afterCount > firstCount,
    `first=${firstCount} after=${afterCount}`);

  const neverGoesBack = samples.every((s, i) => i === 0 || s.rendered >= samples[i - 1].rendered);
  report('APc القيمة المعروضة لا تتراجع (لا ردّ قديم يطغى على أحدث)',
    neverGoesBack,
    samples.map((s) => s.rendered).join(' → '));

  const noAccumulation = samples.every((s) => s.rendered <= s.calls);
  report('APd القيمة المعروضة لا تتجاوز عدد الطلبات (لا تراكم)',
    noAccumulation,
    samples.map((s) => `${s.rendered}/${s.calls}`).join(' '));

  const advanced = samples.at(-1)?.rendered > firstCount;
  report('APe القيمة المعروضة تتقدّم مع كل نبضة',
    advanced,
    `rendered=${samples.at(-1)?.rendered} first=${firstCount}`);

  report('APf ختم آخر تحديث يظهر بعد الجلب',
    typeof rowsSeen.at(-1)?.updated === 'string' && rowsSeen.at(-1).updated.length > 0,
    `label=${rowsSeen.at(-1)?.updated}`);

  // التنظيف: بلا مؤقّت باقٍ يشغّل الاختبار بعد نهايته.
  root.unmount();
  el.remove();
  const callsAfterUnmount = calls;
  await new Promise((r) => setTimeout(r, 150));
  report('APg التفكيك يوقف المؤقّت (لا نبضات بعد الخروج)',
    calls === callsAfterUnmount,
    `calls=${calls} vs ${callsAfterUnmount}`);
}

console.log('\n===== ADMIN: المساحات والحجوزات والمراجعات =====');
{
  const s = await mount('/admin/spaces');
  // تبويب الحالة: التصفية يجب أن تُبقي المطابق فقط وتطابق العدد المعروض.
  // شارة الحالة في بطاقات المساحات (SpaceBadge) أصبحت فئات Tailwind فاتحة
  // (border-emerald-200 bg-emerald-50 …) بدل فئات badge--* القديمة، فتُفحص
  // الدلالة نفسها داخل حاوية الشارة (dash__cover-badge) — لا في أزرار
  // «إيقاف المساحة» الحمراء الناعمة التي تحمل border-red-200 أيضاً.
  await s.click(s.find('[data-space-tab="active"]'));
  const activeCards = s.findAll('[data-space-card]').length;
  const greenBadge = '[data-space-card] .dash__cover-badge .border-emerald-200';
  const redBadge = '[data-space-card] .dash__cover-badge .border-red-200';
  report(
    'A18 spaces status filter keeps only active rows',
    activeCards === 5 && s.findAll(greenBadge).length === 5 && s.findAll(redBadge).length === 0,
    `cards=${activeCards} green=${s.findAll(greenBadge).length} red=${s.findAll(redBadge).length}`
  );
  report(
    'A18b spaces filter shows the pluralized result count',
    s.text().includes('عرض 5 مساحات'),
    `summary=${(s.text().match(/عرض[^·]*/) || [''])[0].trim()}`
  );
  s.unmount();

  const b = await mount('/admin/bookings');
  await b.clickText('النزاعات والشكاوى');
  report('A19 disputes tab renders', b.text().includes('#DIS-045'), b.text().slice(0, 120));
  await b.clickText('حل النزاع');
  report('A20 resolve dispute action works', b.text().includes('تم الحل'), b.text().slice(0, 160));
  b.unmount();

  const r = await mount('/admin/reviews');
  // الصفحة تجلب البيانات داخل useEffect (حالة تحميل ثم ready)، فالدوم ليس جاهزاً
  // فور mount(). ننتظر أول بطاقة بدل الفحص على نصف DOM.
  await waitFor(() => r.findAll('[data-review-card]').length > 0);
  report('A21a0 the reviews page finishes loading without an error state',
    !r.find('[data-review-error]') && r.findAll('[data-review-card]').length > 0,
    `error=${!!r.find('[data-review-error]')} cards=${r.findAll('[data-review-card]').length}`);
  await r.clickText('مبلّغ عنها');
  report('A21 flagged reviews filter works', r.text().includes('مبلّغ عنها') && !r.text().includes('رتبتك ممتازة'));
  report('A21b the flagged pill keeps only the reported reviews', r.findAll('[data-review-card]').length === 3,
    `cards=${r.findAll('[data-review-card]').length}`);

  // بطاقات المؤشرات: نتحقق من التسميات لا من الأرقام، لأن عدّاد DashCountUp لا يبدأ
  // دون IntersectionObserver (المستعار هنا يستدعي المراقب بمصفوفة فارغة فلا يُبلّغ عن تقاطع).
  const statBox = r.find('[data-review-stats]');
  report('A21c three summary stat cards render above the list',
    !!statBox && statBox.children.length === 3
    && statBox.textContent.includes('متوسط التقييم')
    && statBox.textContent.includes('إجمالي المراجعات')
    && statBox.textContent.includes('البلاغات المعلّقة'),
    `cards=${statBox ? statBox.children.length : 0} text=${(statBox?.textContent || '').slice(0, 120)}`);

  // اسم التبويب معروض أصلاً في ترويسة اللوحة (h1)، فالعنوان h2 داخل الصفحة تكرارٌ بلا فائدة.
  await r.click(r.find('[data-review-tab="all"]'));
  report('A21d the page no longer repeats the tab title as a section heading',
    r.findAll('h2').every((h) => (h.textContent || '').trim() !== 'التقييمات والمراجعات'),
    `h2=${r.findAll('h2').map((h) => h.textContent.trim()).join(' | ')}`);

  const allCards = r.findAll('[data-review-card]');
  // ست بطاقات في الصفحة الواحدة (PAGE_SIZE=6) من أصل ثماني.
  report('A21e every rendered review gets a card with its text and two footer actions',
    allCards.length === 6
    && !!r.find('[data-review-card="1"] .dash__soft')
    && r.findAll('[data-review-card] .dash__btn-soft').length === 12,
    `cards=${allCards.length} actions=${r.findAll('[data-review-card] .dash__btn-soft').length}`);

  // الترقيم: شريط يظهر فقط عند وجود أكثر من صفحة، ويعلن المدى المرئي.
  const pager = r.find('[data-review-pager]');
  const pagerText = (pager?.textContent || '').replace(/\s+/g, ' ').trim();
  report('A21e2 the list paginates six reviews per page and reports the range',
    !!pager && pagerText.includes('1') && pagerText.includes('6') && pagerText.includes('8'),
    `pager=${pagerText}`);

  const pageTwo = r.find('button[aria-label="الصفحة 2"]');
  if (pageTwo) await r.click(pageTwo);
  const pageTwoIds = r.findAll('[data-review-card]').map((c) => c.getAttribute('data-review-card'));
  report('A21e3 page two shows the remaining two reviews',
    pageTwoIds.length === 2 && pageTwoIds.includes('7') && pageTwoIds.includes('8'),
    `ids=${pageTwoIds.join(',')}`);

  const pageOne = r.find('button[aria-label="الصفحة 1"]');
  if (pageOne) await r.click(pageOne);
  report('A21e4 returning to page one restores the first six',
    r.findAll('[data-review-card]').length === 6,
    `cards=${r.findAll('[data-review-card]').length}`);

  // شارات الحالة في الزاوية العلوية اليسرى من رأس البطاقة (ابنها الأول)، لا في أسفلها.
  // على الصفحة الأولى (المُعرّفات 1–6) شارتان حمراوان (3، 5) + شارة مجهولة واحدة (3).
  const headerBadges = r.findAll('[data-review-card] > div:first-child .badge');
  report('A21f status badges sit in the card header and the reported one is red',
    headerBadges.length === 3
    && r.findAll('[data-review-card] .badge--cancelled').length === 2
    && !!r.find('[data-review-card="3"] .badge--cancelled'),
    `badges=${headerBadges.length} red=${r.findAll('[data-review-card] .badge--cancelled').length}`);

  // المراجعة المجهولة تُوسم صراحةً بدل ترك الاسم المجهول يوهم بأنه اسم حقيقي.
  const anonCard = r.find('[data-review-card="3"]');
  report('A21f2 an anonymous review is badged and labelled as a guest',
    !!anonCard.querySelector('[data-review-anonymous]')
    && (anonCard.textContent || '').includes('زائر غير مسجّل')
    && (anonCard.textContent || '').includes('مجهولة'),
    (anonCard?.textContent || '').slice(0, 90));

  // التاريخ بصيغة عربية مقروءة بدل ISO: «١٥ سبتمبر ٢٠٢٦».
  // التاريخ يُعرض منسَّقاً بالعربية لا كما ورد ISO من الخادم. نقارن بالترميز
  // العربي للتاريخ نفسه الذي أعادته بيانات الاختبار، لا بتاريخ مثبّت.
  const cardDate = (r.find('[data-review-card="1"] [data-review-date]')?.textContent || '').trim();
  const reviewDateArabic = new Date(`${fixtures.reviews[0].date}T00:00:00`)
    .toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  report('A21f3 the card date is formatted in Arabic, not raw ISO',
    cardDate === reviewDateArabic && cardDate !== fixtures.reviews[0].date,
    `date=${cardDate} expected=${reviewDateArabic}`);

  // النجوم مع الرقم المجاور: التقييم لا يُقرأ بلون وحده.
  report('A21g the stars are paired with the numeric rating',
    !!r.find('[data-review-card="1"] .fill-amber-400') && (r.find('[data-review-card="1"]').textContent || '').includes('5 من 5'),
    (r.find('[data-review-card="1"]')?.textContent || '').slice(0, 80));

  // البحث باسم المُقيِّم ثم باسم المساحة
  const search = r.find('input[type=search]');
  await r.type(search, 'ريم');
  report('A21h search filters by reviewer name', r.findAll('[data-review-card]').length === 1,
    `cards=${r.findAll('[data-review-card]').length}`);
  await r.type(search, 'استوديو الأناقة');
  report('A21i search filters by space name', r.findAll('[data-review-card]').length === 2,
    `cards=${r.findAll('[data-review-card]').length}`);
  await r.click(r.find('button[aria-label="مسح البحث"]'));
  report('A21j clearing the search restores every card', r.findAll('[data-review-card]').length === 6
    && (r.text().includes('عرض 8 مراجعات')),
    `cards=${r.findAll('[data-review-card]').length}`);

  // تطبيع البحث العربي: «الاناقه» بلا همزة ولا تاء مربوطة يجب أن تطابق «الأناقة».
  // قبل normalizeAr كانت هذه العبارة تُرجع صفر نتيجة.
  await r.type(search, 'الاناقه');
  report('A21j2 search ignores hamza and ta-marbuta differences',
    r.findAll('[data-review-card]').length === 2,
    `cards=${r.findAll('[data-review-card]').map((c) => c.getAttribute('data-review-card')).join(',')}`);
  await r.click(r.find('button[aria-label="مسح البحث"]'));

  // لوحة توزيع النجوم ومتوسط كل مساحة — والنقر على مساحة يصفّي القائمة بها.
  const breakdown = r.find('[data-review-breakdown]');
  const bdText = (breakdown?.textContent || '').replace(/\s+/g, ' ');
  report('A21j3 the rating breakdown lists stars and per-space averages',
    !!breakdown && bdText.includes('توزيع التقييمات') && bdText.includes('متوسط كل مساحة')
    && breakdown.querySelectorAll('button[aria-pressed]').length >= 7,
    `text=${bdText.slice(0, 110)}`);

  const spaceBtn = breakdown
    ? Array.from(breakdown.querySelectorAll('button[aria-pressed]')).find((b) => b.textContent.includes('فضاء المبدعين'))
    : null;
  if (spaceBtn) await r.click(spaceBtn);
  report('A21j4 clicking a space average filters the list to that space',
    r.findAll('[data-review-card]').length === 1
    && !!r.find('[data-review-card="5"]')
    && (r.find('input[type=search]')?.value || '').includes('فضاء المبدعين'),
    `cards=${r.findAll('[data-review-card]').map((c) => c.getAttribute('data-review-card')).join(',')} q=${r.find('input[type=search]')?.value}`);
  await r.clickText('إعادة الضبط');
  report('A21j5 the reset action clears the space filter and the page',
    r.findAll('[data-review-card]').length === 6 && (r.find('input[type=search]')?.value || '') === '',
    `cards=${r.findAll('[data-review-card]').length}`);

  // الترتيب: <select> محكوم، فنضبط القيمة بالمُحدِّد الأصلي كما يفعل type() مع input.
  const sortSelect = r.find('select[aria-label="ترتيب المراجعات"]');
  report('A21k the sort dropdown offers the three documented options',
    !!sortSelect && sortSelect.querySelectorAll('option').length === 3,
    `options=${sortSelect ? sortSelect.querySelectorAll('option').length : 0}`);

  const setSort = async (value) => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set;
    setter.call(sortSelect, value);
    await r.change(sortSelect);
  };
  const order = () => r.findAll('[data-review-card]').map((c) => c.getAttribute('data-review-card'));

  await setSort('lowest');
  report('A21l sorting by lowest rating puts the 1★ review first', order()[0] === '3', `order=${order().join(',')}`);
  await setSort('highest');
  report('A21m sorting by highest rating puts a 5★ review first', order()[0] === '1', `order=${order().join(',')}`);
  await setSort('newest');
  report('A21n newest-first is the default order', order()[0] === '1', `order=${order().join(',')}`);

  // الحذف لا ينفَّذ قبل الموافقة الصريحة
  const delBtn = r.findAll('[data-review-card] .dash__btn-soft').find((b) => b.textContent.includes('حذف'));
  if (delBtn) await r.click(delBtn);
  const delModal = r.find('.modal-overlay');
  const delText = delModal?.textContent || '';
  report('A21o deleting asks for confirmation first and names the review',
    !!delModal && delText.includes('حذف المراجعة نهائياً؟') && delText.includes('محمد دويدار') && delText.includes('استوديو الأناقة'),
    `modal=${!!delModal} text=${delText.slice(0, 160)}`);

  const cancelBtn = delModal ? Array.from(delModal.querySelectorAll('button')).find((b) => b.textContent.includes('إلغاء')) : null;
  if (cancelBtn) await r.click(cancelBtn);
  report('A21p cancelling keeps the review', !r.find('.modal-overlay') && r.findAll('[data-review-card]').length === 6
    && r.text().includes('عرض 8 مراجعات'),
    `modal=${!!r.find('.modal-overlay')} cards=${r.findAll('[data-review-card]').length}`);

  // الإخفاء: شارة «مخفية» + إشعار عائم
  const hideBtn = r.findAll('[data-review-card] .dash__btn-soft').find((b) => b.textContent.includes('إخفاء'));
  if (hideBtn) await r.click(hideBtn);
  report('A21q hiding a review toasts and badges it as hidden',
    r.text().includes('تم إخفاء المراجعة.') && !!r.find('[data-review-card="1"] .badge--gray'),
    `toast=${r.text().includes('تم إخفاء المراجعة.')} gray=${r.findAll('.badge--gray').length}`);

  const delBtn2 = r.findAll('[data-review-card] .dash__btn-soft').find((b) => b.textContent.includes('حذف'));
  if (delBtn2) await r.click(delBtn2);
  const confirmBtn = r.findAll('button').find((b) => b.textContent.includes('نعم، احذف المراجعة'));
  if (confirmBtn) await r.click(confirmBtn);
  await flush();
  report('A21r confirming removes the review and toasts',
    r.findAll('[data-review-card]').length === 6
    && r.text().includes('تم حذف المراجعة نهائياً.')
    && r.text().includes('عرض 7 مراجعات'),
    `cards=${r.findAll('[data-review-card]').length} text=${r.text().slice(-90)}`);

  // ترويسة اللوحة: لا تكرار لعلامة العصر، و«م» للميليادي و«هـ» للهجري
  const headerDate = (r.find('.dash__title p')?.textContent || '').replace(/\s+/g, ' ').trim();
  report('A21s the header date labels the Gregorian era م and the Hijri era هـ',
    / م · /.test(headerDate) && / هـ$/.test(headerDate), `header=${headerDate}`);
  report('A21t no era marker is duplicated in the header date', !/هـ هـ|م م/.test(headerDate), `header=${headerDate}`);

  r.unmount();
}

console.log('\n===== ADMIN: تصدير المراجعات (CSV) =====');
{
  // نفس حيلة كتلة التقرير المالي: jsdom لا ينفّذ تنزيل <a download> فنستبدله
  // ونلتقط Blob لفحص محتواه. الحالات تُرقَّم AV* تفادياً للتصادم.
  const downloads = [];
  const realAnchorClick = dom.window.HTMLAnchorElement.prototype.click;
  const realCreate = globalThis.URL.createObjectURL;
  const realRevoke = globalThis.URL.revokeObjectURL;
  let capturedBlob = null;
  globalThis.URL.createObjectURL = (b) => { capturedBlob = b; return 'blob:stub/reviews'; };
  globalThis.URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function stubbedDownload() {
    downloads.push(this.download);
  };

  // `v` تُعلن خارج `try` لأن `finally` هي من يُغلق الجذر: تركُه مفتوحاً
  // يترك تخطيط لوحة الأدمن في الذاكرة، ومعه مؤقّت تحديث الوارد (30 ثانية)
  // مرجوحاً لا ينتهي، فتبقى عملية Node معلّقة بعد أن ينتهي كل ما في الملف.
  let v;
  try {
    v = await mount('/admin/reviews');
    await waitFor(() => v.findAll('[data-review-card]').length > 0);

    const exportBtn = v.find('[data-review-export]');
    report('AV1 the reviews toolbar offers a CSV export button',
      !!exportBtn && (exportBtn.textContent || '').includes('CSV') && !exportBtn.disabled,
      `btn=${!!exportBtn} text=${(exportBtn?.textContent || '').trim()}`);

    if (exportBtn) await v.click(exportBtn);
    report('AV2 exporting triggers a dated .csv download',
      downloads.length === 1 && /^reviews-\d{4}-\d{2}-\d{2}\.csv$/.test(downloads[0] || ''),
      `downloads=${JSON.stringify(downloads)}`);

    const csv = capturedBlob ? await capturedBlob.text() : '';
    const bytes = capturedBlob ? new Uint8Array(await capturedBlob.arrayBuffer()) : new Uint8Array();
    report('AV3 the reviews CSV starts with a UTF-8 BOM for Excel',
      bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
      `first3=${[...bytes.slice(0, 3)].map((b) => b.toString(16)).join(' ')}`);
    report('AV4 the reviews CSV carries Arabic names, ratings and statuses',
      csv.includes('المُقيِّم') && csv.includes('استوديو الأناقة') && csv.includes('مبلّغ عنها') && csv.includes('5'),
      csv.slice(0, 140));
    report('AV5 the reviews CSV has one row per review and no blank cells',
      csv.trim().split('\r\n').length === 9 && !/""/.test(csv.split('\r\n').slice(1).join('\r\n')),
      `rows=${csv.trim().split('\r\n').length}`);
    report('AV6 the export toast confirms the row count',
      v.text().includes('تم تصدير 8 مراجعات كملف CSV.'), v.text().slice(-120));

    // التصدير يلتزم بما تعرضه الشاشة: بعد التصفية على «مبلّغ عنها» ينزل 3 صفوف فقط.
    capturedBlob = null;
    await v.clickText('مبلّغ عنها');
    const exportBtn2 = v.find('[data-review-export]');
    if (exportBtn2) await v.click(exportBtn2);
    const filteredCsv = capturedBlob ? await capturedBlob.text() : '';
    report('AV7 the export respects the active filter',
      filteredCsv.trim().split('\r\n').length === 4,
      `rows=${filteredCsv.trim().split('\r\n').length}`);
  } finally {
    if (v) v.unmount();
    dom.window.HTMLAnchorElement.prototype.click = realAnchorClick;
    globalThis.URL.createObjectURL = realCreate;
    globalThis.URL.revokeObjectURL = realRevoke;
  }
}

console.log('\n===== ADMIN: المساحات — التخطيط والصور والقائمة =====');
{
  const s = await mount('/admin/spaces');

  // شريط التبويب العلوي مبني على Pill المشترك مع عدّاد لكل حالة
  const tabBar = s.find('[data-space-tabs]');
  const tabBtns = tabBar ? Array.from(tabBar.querySelectorAll('button')) : [];
  report(
    'A36 spaces uses the shared Pill tab bar with counts',
    tabBtns.length === 4 && tabBtns.every((b) => b.hasAttribute('aria-pressed')) && tabBtns[0].textContent.includes('10'),
    `tabs=${tabBtns.length} first=${tabBtns[0]?.textContent.trim()}`
  );
  report('A36b spaces has a secondary toolbar below the tabs', !!s.find('[data-space-toolbar]') && !!s.find('input[type=search]'));

  // صور الغلاف: أصل محلي لكل بطاقة
  const covers = s.findAll('[data-space-card] .dash__cover-img');
  report(
    'A37 every space card renders a local cover image',
    covers.length === 10 && covers.every((img) => (img.getAttribute('src') || '').startsWith('/')),
    `covers=${covers.length} srcs=${covers.slice(0, 2).map((i) => i.getAttribute('src')).join(',')}`
  );

  // فشل تحميل الصورة يُظهر البديل المتدرّج بدل صورة مكسورة
  covers[0]?.dispatchEvent(new dom.window.Event('error'));
  await flush();
  report(
    'A38 a broken cover falls back to the gradient placeholder',
    s.findAll('[data-space-card] .dash__cover-fallback').length === 1,
    `fallbacks=${s.findAll('[data-space-card] .dash__cover-fallback').length}`
  );
  report(
    'A38b the broken cover is not retried in a loop',
    s.findAll('[data-space-card] .dash__cover-img').length === 9,
    `imgs=${s.findAll('[data-space-card] .dash__cover-img').length}`
  );

  // قائمة «⋮»: تفتح، وتحتوي معاينة/تعديل/حذف، ولا تُفعّل معاينة البطاقة (stopPropagation)
  const firstCard = s.find('[data-space-card]');
  const firstName = (firstCard?.querySelector('h3')?.textContent || '').trim();
  await s.click(s.find('.dash__cover-acts .dash__menu-btn'));
  const menu = dom.window.document.querySelector('.dash__menu--fixed');
  const menuItems = menu ? Array.from(menu.querySelectorAll('[role="menuitem"]')) : [];
  report('A39 space action menu opens without opening the preview', !!menu && !s.find('.modal-overlay'));
  report(
    'A40 space action menu has Preview/Edit/Delete plus a separator',
    menuItems.length === 3 &&
      menuItems[0].textContent.includes('معاينة') &&
      menuItems[1].textContent.includes('تعديل') &&
      menuItems[2].textContent.includes('حذف') &&
      menu?.querySelectorAll('[role="separator"]').length === 1,
    menu ? `items=[${menuItems.map((b) => b.textContent.trim()).join(' | ')}]` : 'no menu'
  );
  const inViewport = !!menu && (() => {
    const r = menu.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0;
  })();
  report('A41 space action menu is positioned inside the viewport', inViewport);

  // المعاينة تفتح نافذة التفاصيل
  await s.click(menuItems[0]);
  const previewModal = s.find('.modal-overlay');
  report(
    'A42 Preview opens the space detail modal',
    !!previewModal && (previewModal.getAttribute('aria-label') || '').includes(firstName),
    `label=${previewModal?.getAttribute('aria-label')} expected=${firstName}`
  );
  if (previewModal) await s.click(previewModal);

  // الهروب يغلق القائمة — ننتظر انتهاء حركة الخروج قبل التحقق من اختفائها
  await s.click(s.find('.dash__cover-acts .dash__menu-btn'));
  report('A43 space action menu opens again', !!dom.window.document.querySelector('.dash__menu--fixed'));
  dom.window.document.body.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  await new Promise((r) => setTimeout(r, 300));
  report('A43b Escape closes the space action menu', !dom.window.document.querySelector('.dash__menu--fixed'));

  // الحذف: تأكيد ثم اختفاء البطاقة وتحديث العدّاد
  await s.click(s.find('.dash__cover-acts .dash__menu-btn'));
  const delBtn = Array.from(dom.window.document.querySelectorAll('.dash__menu--fixed [role="menuitem"]')).find((b) =>
    b.textContent.includes('حذف')
  );
  if (delBtn) await s.click(delBtn);
  const confirmBtn = s.findAll('button').find((b) => b.textContent.includes('نعم، احذف المساحة'));
  report('A44 space delete asks for confirmation', !!confirmBtn);
  if (confirmBtn) await s.click(confirmBtn);
  const allTab = s.find('[data-space-tab="all"]');
  report(
    'A44b deleting a space removes the card and updates the tab count',
    s.findAll('[data-space-card]').length === 9 && allTab.textContent.includes('9'),
    `cards=${s.findAll('[data-space-card]').length} allTab=${allTab.textContent.trim()}`
  );
  report('A44c delete confirms with a status message', s.text().includes('تم حذف المساحة'));

  // تبديل العرض الجدولي يعتمد جدول النظام المشترك (الزر أيقوني فقط، فنحدّده بالـ aria-label)
  await s.click(s.find('button[aria-label="عرض جدولي"]'));
  report(
    'A45 switching to list view renders the shared dash__table',
    !!s.find('.dash__table') && s.findAll('[data-space-row]').length === 9 && s.findAll('[data-space-card]').length === 0,
    `rows=${s.findAll('[data-space-row]').length}`
  );
  report('A45b list view shows a cover thumbnail per row', s.findAll('.dash__cover-thumb').length === 9);
  s.unmount();
}

console.log('\n===== ADMIN: المساحات — النصوص والألوان =====');
{
  const s = await mount('/admin/spaces');

  // تصريف الأعداد: 24 و14 داخل نطاق 11–99 فتكون منصوبة، و10 جمع قلة
  report(
    'A46 Arabic pluralization is applied to capacities',
    s.text().includes('24 مقعداً') && s.text().includes('14 مقعداً') && s.text().includes('8 مقاعد'),
    `sample=${(s.text().match(/\d+ مقعد\S*/g) || []).slice(0, 3).join(' | ')}`
  );
  report('A46b Arabic pluralization is applied to the space count', s.text().includes('عرض 10 مساحات') && s.text().includes('10 مساحات مسجلة'));
  report(
    'A46c no bare singular follows a multi-digit number',
    !/\b(11|12|14|16|20|24|30|40) مقعد(?!ا|ان)/.test(s.text()),
    (s.text().match(/\d+ مقعد\S*/g) || []).join(' | ')
  );
  report('A46d bookings past 100 stay singular', s.text().includes('312 حجز') && s.text().includes('88 حجزاً'));

  // ألوان دلالية: الإيقاف أحمر (كان كهرمانياً)، والموافقة أخضر، وإعادة التفعيل أزرق
  const suspendBtns = s.findAll('button').filter((b) => b.textContent.includes('إيقاف المساحة'));
  report(
    'A47 suspend action uses the red semantic tone',
    suspendBtns.length === 5 &&
      suspendBtns.every((b) => b.className.includes('is-red') && !b.className.includes('is-amber')),
    `found=${suspendBtns.length} class=${suspendBtns[0]?.className}`
  );
  const approveBtns = s.findAll('button').filter((b) => b.textContent.includes('الموافقة'));
  report(
    'A48 approve action uses the orange semantic tone',
    approveBtns.length === 3 && (approveBtns.every((b) => b.className.includes('bg-orange-500') || b.className.includes('hover:bg-orange-600') || b.className.includes('text-white'))),
    `found=${approveBtns.length}`
  );
  const rejectBtns = s.findAll('button').filter((b) => b.textContent.includes('الرفض'));
  report(
    'A49 reject action uses the red semantic tone',
    rejectBtns.length === 3 && rejectBtns.every((b) => b.className.includes('is-red')),
    `found=${rejectBtns.length}`
  );

  // إعادة التفعيل أزرق — نفتح قائمة صف موقوف للتحقق من الزر
  const suspendedTab = s.find('[data-space-tab="suspended"]');
  await s.click(suspendedTab);
  const activateBtns = s.findAll('button').filter((b) => b.textContent.includes('إعادة التفعيل'));
  report(
    'A50 reactivate action uses the blue/sky semantic tone',
    activateBtns.length === 2 && activateBtns.every((b) => b.className.includes('is-sky')),
    `found=${activateBtns.length}`
  );
  s.unmount();
}

console.log('\n===== ADMIN: المساحات — نموذج التعديل =====');
{
  const s = await mount('/admin/spaces');

  // نفتح قائمة «⋮» على أول بطاقة (الأحدث أولاً = id 10) ثم نختار «تعديل».
  const firstCard = s.find('[data-space-card]');
  const cardId = firstCard?.getAttribute('data-space-card');
  const origName = (firstCard?.querySelector('h3')?.textContent || '').trim();
  const origHood = (firstCard?.querySelector('p')?.textContent || '').trim();

  await s.click(s.find('.dash__cover-acts .dash__menu-btn'));
  const editItem = Array.from(
    dom.window.document.querySelectorAll('.dash__menu--fixed [role="menuitem"]')
  ).find((b) => b.textContent.includes('تعديل'));
  if (editItem) await s.click(editItem);

  const modal = s.find('.modal-box');
  const form = s.find('.modal-box form');
  report(
    'A51 Edit opens a form modal instead of a placeholder toast',
    !!modal && !!form && (modal.getAttribute('aria-label') || s.find('.modal-box h3')?.textContent || '').includes(origName) && !s.text().includes('قيد التطوير'),
    `modal=${!!modal} form=${!!form}`
  );

  // كل الحقول القابلة للتعديل موجودة ومبذورة من بيانات المساحة الحالية.
  const val = (id) => s.find(`#${id}`)?.value;
  report(
    'A52 the edit form exposes every editable field pre-filled',
    ['sp-name', 'sp-neighborhood', 'sp-owner', 'sp-price', 'sp-capacity', 'sp-status', 'sp-image']
      .every((id) => !!s.find(`#${id}`)) &&
      val('sp-name') === origName &&
      val('sp-neighborhood') === origHood &&
      val('sp-status') === 'pending',
    `name=${val('sp-name')} hood=${val('sp-neighborhood')} status=${val('sp-status')}`
  );
  report(
    'A53 system data (id/rating/bookings) is shown but not editable',
    s.text().includes('بيانات النظام') &&
      !!s.find('fieldset[disabled]') &&
      s.find('#sp-name')?.getAttribute('disabled') === null,
    `fieldset=${!!s.find('fieldset[disabled]')}`
  );

  // حفظ تعديل فعلي: الاسم + السعر + السعة.
  await s.type(s.find('#sp-name'), 'مساحة معدّلة');
  await s.type(s.find('#sp-price'), '99');
  await s.type(s.find('#sp-capacity'), '18');
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  const editedCard = s.find(`[data-space-card="${cardId}"]`);
  report(
    'A54 saving the form updates the card name, price and capacity',
    !s.find('.modal-box') &&
      (editedCard?.querySelector('h3')?.textContent || '').trim() === 'مساحة معدّلة' &&
      editedCard?.textContent.includes('99 ش.ج/ساعة') &&
      editedCard?.textContent.includes('18 مقعداً'),
    `modalOpen=${!!s.find('.modal-box')} text=${(editedCard?.textContent || '').slice(0, 90)}`
  );
  report(
    'A55 a successful save announces confirmation',
    s.text().includes('تم تحديث بيانات المساحة بنجاح'),
    s.text().slice(-90)
  );
  // حقل السعة الجديد يمرّ بتصريف «18 مقعداً» لا «18 مقعد».
  report('A56 the new capacity is pluralized correctly', s.text().includes('18 مقعداً') && !s.text().includes('18 مقعد '), '');

  // بحث بالاسم الجديد للتأكد من إعادة احتساب الفلترة.
  await s.type(s.find('input[type=search]'), 'مساحة معدّلة');
  report(
    'A57 the search index reflects the edited name',
    s.findAll('[data-space-card]').length === 1 &&
      s.find('[data-space-card]')?.textContent.includes('مساحة معدّلة'),
    `cards=${s.findAll('[data-space-card]').length}`
  );
  s.unmount();
}

console.log('\n===== ADMIN: المساحات — التحقّق من نموذج التعديل =====');
{
  const s = await mount('/admin/spaces');
  const firstCard = s.find('[data-space-card]');
  const origName = (firstCard?.querySelector('h3')?.textContent || '').trim();
  const origPrice = s.find('[data-space-card]')?.textContent.match(/(\d+) ش\.ج/)?.[1];

  // نافذة التعديل تُفتح أيضاً من زر «تعديل البيانات» داخل نافذة المعاينة.
  await s.click(firstCard);
  const previewModal = s.find('.modal-box');
  const editFromPreview = s.findAll('button').find((b) => b.textContent.includes('تعديل البيانات'));
  report(
    'A58 Preview offers an edit button that opens the form',
    !!previewModal && !!editFromPreview && !s.text().includes('طلب تعديل'),
    `preview=${!!previewModal} editBtn=${!!editFromPreview}`
  );
  if (editFromPreview) await s.click(editFromPreview);
  const editTitle = (s.find('.modal-box h3')?.textContent || '').trim();
  report(
    'A59 the preview edit button swaps Preview for the edit form',
    !!s.find('#sp-name') && editTitle.startsWith('تعديل:'),
    `title=${editTitle} form=${!!s.find('#sp-name')}`
  );

  const form = s.find('.modal-box form');
  const submitForm = async () => {
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
  };
  const hasErr = (frag) => s.find('.modal-box')?.textContent.includes(frag) || false;

  // سعر تحت الحد الأدنى
  await s.type(s.find('#sp-price'), '0');
  await submitForm();
  report(
    'A60 an out-of-range price blocks the save and shows an error',
    hasErr('السعر يجب أن يكون رقماً') && !!s.find('#sp-name'),
    `stillOpen=${!!s.find('#sp-name')}`
  );

  // سعة غير صحيحة (كسور)
  await s.type(s.find('#sp-price'), '40');
  await s.type(s.find('#sp-capacity'), '2.5');
  await submitForm();
  report('A61 a non-integer capacity blocks the save', hasErr('السعة يجب أن تكون عدداً صحيحاً'), '');

  // اسم فارغ
  await s.type(s.find('#sp-capacity'), '12');
  await s.type(s.find('#sp-name'), '');
  await submitForm();
  report('A62 an empty name blocks the save', hasErr('اسم المساحة مطلوب'), '');

  // رابط صورة غير صالح
  await s.type(s.find('#sp-name'), origName);
  await s.type(s.find('#sp-image'), 'javascript:alert(1)');
  await submitForm();
  report('A63 a non-http image path is rejected', hasErr('رابط الصورة يجب أن يبدأ'), '');
  report(
    'A64 no failed save mutated the card',
    (s.find('[data-space-card] h3')?.textContent || '').trim() === origName &&
      s.find('[data-space-card]')?.textContent.includes(`${origPrice} ش.ج`),
    `name=${(s.find('[data-space-card] h3')?.textContent || '').trim()}`
  );

  // الإلغاء يتجاهل المسودّة بالكامل.
  await s.type(s.find('#sp-name'), 'لن يُحفظ');
  const cancel = s.findAll('.modal-box button').find((b) => b.textContent.includes('إلغاء'));
  if (cancel) await s.click(cancel);
  report(
    'A65 cancel discards the draft without touching the card',
    !s.find('.modal-box') && (s.find('[data-space-card] h3')?.textContent || '').trim() === origName,
    `modalOpen=${!!s.find('.modal-box')}`
  );

  // Escape يغلق نافذة التعديل (إضافةٌ لـ Modal في ui.jsx).
  await s.click(s.find('.dash__cover-acts .dash__menu-btn'));
  const editItem = Array.from(
    dom.window.document.querySelectorAll('.dash__menu--fixed [role="menuitem"]')
  ).find((b) => b.textContent.includes('تعديل'));
  if (editItem) await s.click(editItem);
  const openBefore = !!s.find('#sp-name');
  dom.window.document.body.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  await new Promise((r) => setTimeout(r, 120));
  report('A66 Escape closes the edit modal', openBefore && !s.find('#sp-name'), `openBefore=${openBefore}`);

  s.unmount();
}

console.log('\n===== ADMIN: نافذة المعاينة — وضوح النصوص =====');
{
  // الألوان نفسها (--text-muted / --text-strong) تجتاز معيار WCAG AA في الوضعين،
  // فالمشكلة كانت في حجم الخطّ وحدود البطاقات لا في اللون.
  const s = await mount('/admin/spaces');
  await s.click(s.find('[data-space-card]'));
  const fact = s.find('.modal-box .grid > div');
  const label = fact?.querySelector('span');
  const fontSize = label ? dom.window.getComputedStyle(label).fontSize : '';
  report(
    'A67 preview fact labels are no longer the .74rem caption size',
    !!fact && parseFloat(fontSize) >= 12.5,
    `fontSize=${fontSize}`
  );
  s.unmount();
}

console.log('\n===== ADMIN: مستندات المساحة وقرار التفعيل =====');
{
  const s = await mount('/admin/spaces');

  // التبويب والعدّاد وشارة البطاقة الثلاثة تُقرأ «بانتظار التفعيل»، ولا يبقى
  // أثر للصيغة القديمة في أي موضع من الشاشة.
  const pendTab = s.find('[data-space-tab="pending"]');
  const pendCount = Number(((pendTab && pendTab.textContent.match(/\d+/)) || [0])[0]);
  report(
    'ASD1 the pending tab reads بانتظار التفعيل',
    !!pendTab && pendTab.textContent.includes('بانتظار التفعيل'),
    pendTab ? pendTab.textContent.replace(/\s+/g, ' ').trim() : 'no tab'
  );
  report(
    'ASD2 no قيد المراجعة survives anywhere on the screen',
    !s.text().includes('قيد المراجعة'),
    s.text().includes('قيد المراجعة') ? 'old label still rendered' : 'clean'
  );
  report('ASD3 header subtitle counts the queue as بانتظار التفعيل',
    s.text().includes('بانتظار التفعيل'), `pending=${pendCount}`);

  // إنشاء المساحات لصاحبها لا للأدمن: الزر معدوم لا معطَّل، فالمعطَّل يبقى
  // في العرض يَعِد بعملٍ لا يُنجز.
  const hasAddBtn = s.findAll('button').some((b) => b.textContent.includes('إضافة مساحة جديدة'));
  report('ASD4 the admin cannot start a space of their own', !hasAddBtn,
    `addBtn=${hasAddBtn}`);

  const closePreview = async () => {
    const btn = Array.from(s.el.querySelectorAll('button')).find((b) => b.textContent.trim() === 'إغلاق');
    if (btn) await s.click(btn);
  };

  // المساحة 3 بانتظار التفعيل، ومستنداتها مصفوفة على شكلها.
  await s.click(s.find('[data-space-card="3"]'));
  const docsSec = s.find('[data-space-docs]');
  report('ASD5 a pending space shows a مستندات المساحة section',
    s.text().includes('مستندات المساحة') && !!docsSec,
    docsSec ? `docs=${docsSec.getAttribute('data-space-docs')}` : 'section missing');

  const docLinks = s.findAll('[data-space-doc]');
  report('ASD6 both documents open in a new tab at an absolute url',
    docLinks.length === 2
      && docLinks.every((a) => /^https?:\/\//.test(a.getAttribute('href') || '')
        && a.getAttribute('target') === '_blank'
        && (a.getAttribute('rel') || '').includes('noopener')),
    `links=${docLinks.length} href=${docLinks[0] ? docLinks[0].getAttribute('href') : 'none'}`);

  // التسمية في العنصر الحاوي لا في الرابط نفسه، فالبحث عنها داخل الرابط
  // يُرجع فراغاً ويُدين قسماً سليماً بجرمٍ لم يرتكبه. فنعود إلى العنصر
  // الحاوي (li) ثم إلى وسم العنوان بداخله.
  const docTitles = docLinks.map((a) => {
    const li = a.closest('li');
    const title = li && li.querySelector('.font-bold');
    return (title || { textContent: '' }).textContent.trim();
  });
  report('ASD7 document titles are Arabic, not raw server keys',
    docTitles.length === 2
      && docTitles.every((t) => t === 'وثيقة الملكية' || t === 'السجل التجاري'),
    docTitles.join(' | '));

  report('ASD8 activate and reject/suspend sit with the documents they decide on',
    !!s.find('[data-space-activate]') && !!s.find('[data-space-suspend]'),
    `activate=${!!s.find('[data-space-activate]')} suspend=${!!s.find('[data-space-suspend]')}`);
  await closePreview();

  // المساحة 10 بلا مستندات: قسمٌ فارغ صادق بدل رابطين مخترَعين.
  await s.click(s.find('[data-space-card="10"]'));
  const emptyNote = s.find('[data-space-docs-empty]');
  report('ASD9 a space with no documents says so and invents no links',
    !!emptyNote && s.findAll('[data-space-doc]').length === 0,
    emptyNote ? emptyNote.textContent.slice(0, 56) : 'section missing');
  await closePreview();

  // المساحة النشطة أُسّرت: لا قسم مستندات ولا قرارَ عليها.
  await s.click(s.find('[data-space-card="1"]'));
  report('ASD10 an already-active space carries neither documents nor a decision',
    !s.find('[data-space-activate]') && !s.text().includes('مستندات المساحة'),
    `section=${s.text().includes('مستندات المساحة')} btn=${!!s.find('[data-space-activate]')}`);
  await closePreview();

  // التفعيل فوري بلا إعادة تحميل: الشارة تتبدّل في النافذة المفتوحة، والقسم
  // يرحل مع القرار، وعدّاد الطابور ينقص خلفها في الشريط نفسه.
  await s.click(s.find('[data-space-card="3"]'));
  const beforeCount = Number(((s.find('[data-space-tab="pending"]') || { textContent: '' })
    .textContent.match(/\d+/) || [0])[0]);
  await s.click(s.find('[data-space-activate]'));
  const modal = s.find('.modal-box');
  report('ASD11 activation flips the badge in the open modal without a reload',
    !!modal && modal.textContent.includes('مفعّلة'),
    modal ? `hasActiveLabel=${modal.textContent.includes('مفعّلة')}` : 'no modal');
  report('ASD12 the decision section leaves with the decision',
    !s.find('[data-space-activate]') && !s.find('[data-space-docs]'),
    `btn=${!!s.find('[data-space-activate]')} section=${!!s.find('[data-space-docs]')}`);
  const afterCount = Number(((s.find('[data-space-tab="pending"]') || { textContent: '' })
    .textContent.match(/\d+/) || [0])[0]);
  report('ASD13 the pending queue shrinks by one in the tab bar',
    afterCount === beforeCount - 1, `${beforeCount} -> ${afterCount}`);
  report('ASD14 activation announces itself to the admin',
    s.text().includes('تم تفعيل المساحة'), 'toast');

  s.unmount();
}

console.log('\n===== ADMIN: الإشعارات =====');
{
  const n = await mount('/admin/notifications/inbox');
  const badgeBefore = n.find('.dash__nav-badge');
  const badgeValue = Number(badgeBefore?.textContent || 0);
  const unreadText = n.text().includes(`${badgeValue} غير مقروء`);
  report('A22 sidebar unread badge matches inbox subtitle', unreadText, `badge=${badgeValue}`);

  const checkboxes = n.findAll('.dash__check');
  const archiveBtnExists = n.findAll('button').some((b) => b.textContent.includes('أرشفة المحدد'));
  report('A23 bulk bar hidden before selection', !archiveBtnExists);

  const cb = checkboxes[1];
  if (cb) {
    cb.checked = true;
    await n.click(cb);
  }
  const archBtn = n.findAll('button').find((b) => b.textContent.includes('أرشفة المحدد'));
  report('A24 archive selected button appears', !!archBtn);
  if (archBtn) await n.click(archBtn);
  const badgeAfter = Number(n.find('.dash__nav-badge')?.textContent || 0);
  report('A25 archived unread items drop out of the badge', badgeAfter < badgeValue, `before=${badgeValue} after=${badgeAfter}`);
  n.unmount();
}

{
  // بريد الوارد: إشعار «رفع مستند ملكية» لا يفتح صفحة الفئة بل **ملف صاحب
  // المستند** (البند 3 من جولة setting.txt). الفحص ثلاثيٌّ متعمَّد: المسار
  // وحده لا يثبت أنه فتح الملف، والمحتوى وحده لا يثبت أنه جاء بالنقر،
  // والبادج وحده لا يثبت أن الملف هو المطلوب. نقرأ الثلاثة.
  const n = await mount('/admin/notifications/inbox');
  const ownerCard = n.findAll('.dash__notif-card')
    .find((c) => (c.textContent || '').includes('رنا شاهين'));
  const cta = ownerCard && ownerCard.querySelector('.dash__notif-cta');
  report('AI1 إشعار رفع مستند المالك يحمل زر فتح مباشر',
    !!cta, `cards=${n.findAll('.dash__notif-card').length} card=${!!ownerCard}`);

  if (cta) await n.click(cta);
  report('AI2 زرّه يقود إلى ملف صاحب المستند لا إلى قائمة المستخدمين',
    n.path() === '/admin/users/33', `path=${n.path()}`);

  // نافذة الملف بوابة على document.body خارج جذر التصيير، فنبحث في المستند
  // كله — وكما في A36 نقرأ المحتوى لا وجود النافذة فقط.
  await waitFor(() => !!dom.window.document.querySelector('.dash__modal'));
  const modal = dom.window.document.querySelector('.dash__modal');
  const modalText = (modal?.textContent || '').replace(/\s+/g, ' ');
  report('AI3 الملف المفتوح هو ملف رنا شاهين وهي بانتظار التفعيل',
    !!modal && modalText.includes('رنا شاهين') && modalText.includes('بانتظار التفعيل'),
    `modal=${!!modal} text=${modalText.slice(0, 140)}`);
  n.unmount();
}

{
  const b = await mount('/admin/notifications/broadcast');
  const sel = b.find('#notif-template');
  report('A26 broadcast template select present', !!sel);
  if (sel) {
    sel.value = 'maintenance';
    await b.change(sel);
  }
  const titleVal = b.find('#notif-title')?.value || '';
  report('A27 applying a template fills title/body', titleVal.includes('صيانة') && (b.find('#notif-body')?.value || '').length > 0, `title=${titleVal}`);

  const linkInput = b.find('#notif-link');
  if (linkInput) await b.type(linkInput, 'javascript:alert(1)');
  // نُرسل النموذج مباشرةً: المتصفح/jsdom يمنع الإرسال التلقائي لقيمة URL غير صالحة نحوياً
  const form = linkInput?.closest('form');
  if (form) {
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();
  }
  const hasErr = b.text().includes('رابط الإشعار غير صالح');
  report('A28 unsafe notification link is rejected', hasErr, `value=${linkInput?.value}`);
  b.unmount();
}

console.log('\n===== ADMIN: الإعدادات والتوجيه =====');
{
  const s = await mount('/admin/settings');
  const nameInput = s.find('#adm-name');
  report('A29 settings form renders', !!nameInput && !!s.find('#adm-commission'));
  const rate = s.find('#adm-commission')?.value;
  report('A30 commission default matches platform rate (12)', String(rate) === '12', `value=${rate}`);

  if (nameInput) await s.type(nameInput, 'مدير مساحاتي');
  const save = s.findAll('button').find((b) => b.textContent.includes('حفظ الملف الشخصي'));
  if (save) await s.click(save);
  const saved = s.text().includes('تم حفظ الملف الشخصي');
  report('A31 profile save shows success', saved, s.text().slice(0, 120));
  const persisted = adminAuth.getAdminProfile()?.name === 'مدير مساحاتي';
  report('A32 saved profile is actually persisted', persisted, `input=${nameInput?.value} stored=${adminAuth.getAdminProfile()?.name}`);
  s.unmount();
}

console.log('\n===== ADMIN: صورة الملف الشخصي (رفع + مزامنة الشريط الجانبي) =====');
{
  // محاكاة اختيار ملف: input.files للقراءة فقط في المواصفات، فنعرّفه كقيمة
  // خاصة على العنصر نفسه ثم نطلق حدث change الذي تلتقطه React.
  const pickFile = async (page, file) => {
    const input = page.find('input[type="file"]');
    if (!input) return false;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await page.change(input);
    return true;
  };
  const pngFile = () =>
    new dom.window.File([Buffer.from('89504e470d0a1a0a', 'hex')], 'avatar.png', { type: 'image/png' });

  const s = await mount('/admin/settings');
  const photoBtn = s.find('.dash__photo-btn');
  const fileInput = s.find('input[type="file"]');
  report(
    'A41 the avatar is a button next to a file input that accepts images',
    photoBtn?.tagName === 'BUTTON'
      && Boolean(fileInput)
      && fileInput.getAttribute('accept') === 'image/*'
      && fileInput.hasAttribute('hidden'),
    `btn=${photoBtn?.tagName} accept=${fileInput?.getAttribute('accept')} hidden=${fileInput?.hidden}`
  );
  report(
    'A42 the hover overlay announces the change-picture action',
    (photoBtn?.querySelector('.dash__photo-overlay')?.textContent || '').includes('تغيير الصورة')
      && Boolean(photoBtn.querySelector('.dash__photo-overlay svg')),
    photoBtn?.querySelector('.dash__photo-overlay')?.textContent || 'no overlay'
  );

  // قبل الرفع: الحروف الأولى، لا صورة.
  const initialsAvatar = s.find('.dash__profile .dash__avatar');
  report(
    'A43 with no picture the sidebar falls back to initials',
    initialsAvatar?.tagName === 'DIV' && (initialsAvatar.textContent || '').trim().length > 0,
    `${initialsAvatar?.tagName}:${initialsAvatar?.textContent}`
  );

  const picked = await pickFile(s, pngFile());
  await waitFor(() => Boolean(s.find('.dash__profile img.dash__avatar')));
  const sidebarImg = s.find('.dash__profile img.dash__avatar');
  const heroImg = s.find('.dash__photo-btn img.dash__photo');
  report('A44 picking a file uploads it and shows it in the sidebar', picked && Boolean(sidebarImg),
    sidebarImg?.getAttribute('src') || 'no sidebar image');
  report('A45 the settings avatar and the sidebar show the same picture',
    Boolean(heroImg) && heroImg.getAttribute('src') === sidebarImg?.getAttribute('src'),
    `hero=${heroImg?.getAttribute('src')} side=${sidebarImg?.getAttribute('src')}`);
  report('A46 a successful upload is confirmed to the user',
    s.text().includes('تم تحديث صورة الملف الشخصي'), s.text().slice(0, 120));
  report('A47 the uploaded picture survives a reload (persisted in the profile)',
    adminAuth.getAdminProfile()?.photo === sidebarImg?.getAttribute('src'),
    `stored=${adminAuth.getAdminProfile()?.photo}`);
  s.unmount();

  // الرفع يبقى محفوظاً بعد إعادة تحميل الصفحة: نركّب الصفحة من جديد بلا رفع.
  const again = await mount('/admin/settings');
  const restored = again.find('.dash__profile img.dash__avatar');
  report('A48 the picture is still there after remounting the dashboard',
    Boolean(restored) && restored.getAttribute('src')?.includes('/storage/admin/'),
    restored?.getAttribute('src') || 'no image');
  again.unmount();

  // المزامنة عبر صفحة أخرى: الشريط الجانبي مربوط باللقطة المشتركة، لا بحالة
  // شاشة الإعدادات — فنرفع من الإعدادات ثم ننتقل لصفحة أخرى ونجد الصورة.
  const s2 = await mount('/admin/settings');
  await pickFile(s2, pngFile());
  await waitFor(() => Boolean(s2.find('.dash__profile img.dash__avatar')));
  const uploaded = s2.find('.dash__profile img.dash__avatar')?.getAttribute('src');
  s2.unmount();
  const other = await mount('/admin/users');
  const otherImg = other.find('.dash__profile img.dash__avatar');
  report('A49 the sidebar picture is shared with every other admin page',
    Boolean(otherImg) && otherImg.getAttribute('src') === uploaded,
    `other=${otherImg?.getAttribute('src')} uploaded=${uploaded}`);
  other.unmount();

  // ملف غير صورة: رفض قبل أي رفع، والرسالة صريحة. الصورة هنا موجودة أصلاً
  // (من الرفعات السابقة في هذا الملف)، فنقارن مرجعها قبل وبعد المحاولة.
  const s3 = await mount('/admin/settings');
  const avatarBefore = s3.find('.dash__profile .dash__avatar')?.getAttribute('src') || '';
  await pickFile(s3, new dom.window.File([Buffer.from('nope')], 'notes.pdf', { type: 'application/pdf' }));
  const avatarAfter = s3.find('.dash__profile .dash__avatar')?.getAttribute('src') || '';
  report('A50 a non-image file is rejected with a clear message',
    s3.text().includes('يرجى اختيار ملف صورة'), s3.text().slice(0, 160));
  report('A51 a rejected file leaves the previous avatar untouched',
    Boolean(avatarBefore) && avatarAfter === avatarBefore,
    `before=${avatarBefore} after=${avatarAfter}`);
  s3.unmount();
}

{
  const u = await mount('/admin/unknown-tab');
  await waitFor(() => u.path() === '/admin');
  report('A33 unknown admin route falls back to /admin', u.path() === '/admin', `path=${u.path()}`);
  u.unmount();

  const t = await mount('/admin/users/');
  // هذا كان مصدر التذبذب: تبويب المستخدمين ثقيل، فننتظر ظهور العلامة المطلوبة
  // بدل قراءة DOM بعد مهلة ثابتة.
  await waitFor(() => t.path() === '/admin/users' && t.text().includes('إدارة المستخدمين والملاك'));
  report('A34 trailing-slash route resolves to the users tab', t.path() === '/admin/users' && t.text().includes('إدارة المستخدمين والملاك'), `path=${t.path()}`);
  t.unmount();
}

console.log('\n===== ADMIN: الرابط المباشر لملف المستخدم =====');
{
  // الرابط المباشر كان يعمل بالنقر داخل التطبيق فقط، ويسقط عند الفتح الأول
  // (لصق الرابط أو تحديث الصفحة) لأن المسار مُعرَّف كـ splat فلا يمرّر
  // المعرّف إلى useParams. الاختبار يفتح المسار مباشرةً بلا نقر.
  const firstUser = fixtures.users[0];
  const direct = await mount(`/admin/users/${firstUser.id}`);
  // نافذة الملف تُركَّب في بوابة على document.body خارج جذر React، فنبحث عنها
  // في المستند كله لا داخل الحاوية.
  await waitFor(() => !!dom.window.document.querySelector('.dash__modal'));
  const modalEl = dom.window.document.querySelector('.dash__modal');
  const modalText = (modalEl?.textContent || '').replace(/\s+/g, ' ');
  report(
    'A36 a pasted /admin/users/:id link opens the profile modal on first load',
    !!modalEl && modalText.includes(firstUser.name) && modalText.includes(firstUser.email),
    `modal=${!!modalEl} text=${modalText.slice(0, 120)}`
  );
  // لا أزرار سفلية: الإغلاق من X العلوي فقط.
  const footButtons = dom.window.document.querySelectorAll('.dash__modal footer button');
  report('A37 the profile modal has no footer action buttons', footButtons.length === 0, `found ${footButtons.length}`);
  direct.unmount();
}

console.log('\n===== ADMIN: لا بيانات وهمية في التطبيق =====');
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dataFile = path.join(process.cwd(), 'src', 'data', 'adminMockData.js');
  report('A38 the mock-data module is gone from the app', !fs.existsSync(dataFile), dataFile);

  // جلسة محلية بلا توكن: تفتح اللوحة بلا أي طلب شبكة، فلا يصل رقم من أي مكان.
  const savedToken = dom.window.localStorage.getItem('masahati_admin_token');
  dom.window.localStorage.removeItem('masahati_admin_token');
  dom.window.localStorage.setItem('masahati_admin_session', JSON.stringify({
    email: 'masahati@outlook.com',
    name: 'إدارة مساحاتي',
    role: 'admin',
    expiresAt: Date.now() + 3600000,
  }));

  const off = await mount('/admin/users');
  await waitFor(() => !!off.find('[data-api-status="offline-state"]'));
  const offlineState = ((off.find('[data-api-status="offline-state"]') || {}).textContent || '').trim();
  report(
    'A39 without a server session the users screen says so instead of loading forever',
    offlineState.includes('لا توجد جلسة خادم'),
    offlineState.slice(0, 120)
  );
  const bigNumbers = (off.text().match(/[0-9٠-٩]{1,3}(,[0-9٠-٩]{3})+/g) || []);
  report('A40 and it renders no thousand-separated numbers at all', bigNumbers.length === 0, bigNumbers.slice(0, 5).join(' | '));
  off.unmount();

  dom.window.localStorage.removeItem('masahati_admin_session');
  if (savedToken) dom.window.localStorage.setItem('masahati_admin_token', savedToken);
}

console.log('\n===== ADMIN: أخطاء وحدة التحكم =====');
report('A35 no React/console errors during admin flows', consoleErrors.length === 0, consoleErrors.slice(0, 6).join('\n   '));

await server.close();
console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}
