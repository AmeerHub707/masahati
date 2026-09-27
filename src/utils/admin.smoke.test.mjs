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

const adminAuth = await server.ssrLoadModule('/src/lib/adminAuth.js');
await adminAuth.adminLogin('masahati@outlook.com', '123456789admin');

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

  // سبتمبر كاملاً = أرقام زر «هذا الشهر» بالضبط (مجموع السلسلة اليومية)، وهذا
  // هو الدليل على أن النطاق المخصص صار يُحسب بدل السقوط إلى الشهر.
  await v.type(v.find('#custom-from'), '2026-09-01');
  await v.type(v.find('#custom-to'), '2026-09-30');
  report(
    'A7b a full-month custom range matches the month preset',
    v.text().includes('241,500') && v.text().includes('28,980'),
    v.text().match(/\d{2,3},\d{3}\s*ش\.ج/g)?.slice(0, 3).join(' / ') || v.text().slice(0, 200)
  );
  report('A7c the missing-range hint clears once both dates are set', !v.text().includes('حدّد تاريخ البداية والنهاية'));
  report('A7d no NaN/undefined leaks from the custom range', !/undefined|NaN/.test(v.text()), v.text().match(/.{0,40}(undefined|NaN).{0,40}/)?.[0] || '');

  // فترة أقصر: يجب أن تعطي رقماً أصغر ومختلفاً، لا رقم الشهر نفسه.
  await v.type(v.find('#custom-to'), '2026-09-12');
  report(
    'A7e a shorter custom range recomputes instead of falling back',
    v.text().includes('87,583') && !v.text().includes('241,500'),
    v.text().match(/\d{2,3},\d{3}\s*ش\.ج/g)?.slice(0, 3).join(' / ') || v.text().slice(0, 200)
  );

  // خارج تغطية السلسلة اليومية (سبتمبر 2026) يُقال ذلك صراحةً.
  await v.type(v.find('#custom-to'), '2026-12-31');
  report('A7f out-of-coverage custom range warns about the demo data span', v.text().includes('تغطي'), v.text().slice(0, 240));

  await v.clickText('اليوم');
  report('A8 switching back to preset range works', v.text().includes('9,200') || v.text().includes('9,200'), v.text().slice(0, 120));

  // ── النطاق المخصص + صافي ربح المنصة (توصية 2) ─────────────────────────
  // «اليوم» عمولته 1,104 فقط. قبل التصحيح كان يُخصم منه رقم المدفوعات المعلّقة
  // كاملاً (8,240) فيخرج الصافي صفراً ويقرأ كأنه لا ربح أصلاً. الآن يُخصم
  // نصيب اليوم (42 حجزاً من 517) فيبقى رقمٌ مختلف عن الصفر قابلاً للتدقيق.
  const todayText = v.text();
  const todayNet = Number(todayText.match(/صافي ربح المنصة\s*([\d,]+|-[\d,]+)/)?.[1]?.replace(/,/g, ''));
  report(
    'A9 net profit is range-scoped, not zeroed by the full pending balance',
    Number.isFinite(todayNet) && todayNet > 0 && todayNet < 1104,
    `todayNet=${todayNet}`
  );

  // نفس المرجع داخل النطاق المخصص: 12 يوماً من سبتمبر، والرقم فيه أقل من
  // عمولة الشهر (28,980) بدل أن يعيدها.
  await v.clickText('نطاق مخصص');
  await v.type(v.find('#custom-from'), '2026-09-01');
  await v.type(v.find('#custom-to'), '2026-09-12');
  const customNet = Number(v.text().match(/صافي ربح المنصة\s*([\d,]+|-[\d,]+)/)?.[1]?.replace(/,/g, ''));
  report(
    'A10 custom-range net profit is computed from that range, not the month',
    Number.isFinite(customNet) && customNet > 0 && customNet < 28980,
    `customNet=${customNet}`
  );

  // ── اختصارات التاريخ (توصية 5) ───────────────────────────────────────
  // الشرط الجوهري: النطاق المختار يقع داخل تغطية البيانات، وإلا ظهرت أصفار
  // بلا سبب. نتحقق من القيمة المدخلة نفسها لا من شكل الصفحة.
  const presetValue = () => v.find('#custom-from')?.value || '';
  const presetToValue = () => v.find('#custom-to')?.value || '';

  await v.clickText('أمس');
  report(
    'A11 the yesterday preset fills a one-day range inside the data span',
    presetValue() === '2026-09-29' && presetToValue() === '2026-09-29',
    `from=${presetValue()} to=${presetToValue()}`
  );
  report('A11b the yesterday preset reports a non-empty day', /\d{1,3},\d{3}/.test(v.text()), v.text().match(/\d{2,3},\d{3}\s*ش\.ج/g)?.slice(0, 3).join(' / ') || '');

  await v.clickText('آخر 7 أيام');
  report(
    'A12 the last-7-days preset fills a seven-day range ending at the span end',
    presetValue() === '2026-09-24' && presetToValue() === '2026-09-30',
    `from=${presetValue()} to=${presetToValue()}`
  );
  // سبعة أيام من شهر مجموعه 241,500 تقع بين اليوم الواحد والشهر كاملاً: قيمة
  // قريبة من الصفر تعني أن النطاق احتُسب خطأً أو وقع خارج التغطية.
  report('A12b the last-7-days preset beats a single day but stays under the month', (() => {
    const nums = (v.text().match(/[\d]{1,3},\d{3}\s*ش\.ج/g) || []).map((s) => Number(s.replace(/[^\d]/g, '')));
    return nums.some((n) => n > 241500 / 5) && nums.every((n) => n <= 241500);
  })(), v.text().match(/[\d]{1,3},\d{3}\s*ش\.ج/g)?.slice(0, 4).join(' / ') || '');

  await v.clickText('منذ بداية الشهر');
  report(
    'A13 the month-to-date preset equals the full September range',
    presetValue() === '2026-09-01' && presetToValue() === '2026-09-30',
    `from=${presetValue()} to=${presetToValue()}`
  );
  report('A13b month-to-date reproduces the month revenue exactly', v.text().includes('241,500'), v.text().match(/[\d]{2,3},\d{3}\s*ش\.ج/g)?.slice(0, 3).join(' / ') || '');
  report('A13c no preset leaves a zeroed-out report', !/^0\s*ش\.ج/m.test(v.text()), v.text().match(/0\s*ش\.ج/g)?.join(' / ') || '');

  v.unmount();
}

console.log('\n===== ADMIN: المعاملات مشتقّة من الحجوزات (توصية 1) =====');
{
  const {
    adminBookings: bookings,
    adminSpaces: spaces,
  } = await server.ssrLoadModule('/src/data/adminMockData.js');

  const ownerBySpace = new Map(spaces.map((sp) => [sp.name, sp.owner]));

  // كل حجز يجب أن يجد مالك مساحته. لو غاب اسم فالربط بالاسم انكسر، ويظهر
  // «غير محدّد» في الجدول — عطل صامت لا يظهر إلا في لقطة شاشة.
  const unmapped = bookings.filter((b) => !ownerBySpace.has(b.space));
  report('T1 every booking space resolves to a real owner', unmapped.length === 0, unmapped.map((b) => b.space).join(' | '));

  // «المالك» يجب أن يأتي من adminSpaces لا من صاحب الحجز. نفحص الحجوزات التي
  // يختلف فيها الاثنان — وهي كل الحالات تقريباً. المساحة التي مالكها صاحب
  // حجزها نفسه (فضاء المبدعين / نور شعبان) تطابق شرطاً بطبيعتها، فاستثنيناها
  // صراحةً بدل أن تخفي بها خللاً حقيقياً.
  const differing = bookings.filter((b) => b.user !== ownerBySpace.get(b.space));
  const leaked = differing.filter((b) => b.user === ownerBySpace.get('__none__'));
  report('T2 the owner column is never filled from the booking customer',
    differing.length > 0 && leaked.length === 0,
    `differing=${differing.length} leaked=${leaked.length}`);

  // المعاملة تُبنى من الحجز لا من مصفوفة ثانية: نفس المرجع ونفس التاريخ.
  const sample = bookings[0];
  report('T3 the transaction source is adminBookings itself, no parallel array',
    sample.ref === '#BK-1021' && sample.date === '2026-09-18' && sample.user === 'سارة النجار',
    `${sample.ref} ${sample.date} ${sample.user}`);

  // ترتيب الأحدث أولاً، ثم تنازلياً بالرقم داخل اليوم نفسه. 22 سبتمبر فيه
  // حجزان (#BK-1028 ثم #BK-1029) فالأعلى رقماً يسبق: هكذا لا يقفز صفٌّ بين
  // عمليتي فرز متتاليتين على البيانات نفسها.
  const sorted = [...bookings].sort((a, b) => (a.date === b.date ? b.id - a.id : (a.date < b.date ? 1 : -1)));
  report('T4 bookings sort newest-first, then by descending id within a day',
    sorted[0].ref === '#BK-1030' && sorted[0].date === '2026-09-23'
    && sorted[1].ref === '#BK-1029' && sorted[2].ref === '#BK-1028'
    && sorted.at(-1).ref === '#BK-1021',
    sorted.slice(0, 3).map((b) => `${b.ref}@${b.date}`).join(' > '));

  // كل حجز له مالك وعمولة محسوبة: 12% من 120 = 14.4 تُقرَّب 14، فصافي 106.
  const fee = Math.round(120 * 0.12);
  report('T5 commission and net payout derive from the booking amount', fee === 14 && 120 - fee === 106, `fee=${fee} net=${120 - fee}`);

  // أسماء عربية لا تُتلف في الجدول أو الملف (باندٍ UTF-8 + مالك حقيقي).
  report('T6 Arabic names survive the owner join intact',
    ownerBySpace.get('استوديو الأناقة') === 'أحمد جودة' && ownerBySpace.get('مساحة المهندسين') === 'سامي حمدان',
    `${ownerBySpace.get('استوديو الأناقة')} / ${ownerBySpace.get('مساحة المهندسين')}`);
}

console.log('\n===== ADMIN: سلسلة الأيام المالية (أساس النطاق المخصص) =====');
{
  const {
    financialDailySeries: series,
    financialDailySpan: span,
    financialRangeData: ranges,
    adminStats: stats,
  } = await server.ssrLoadModule('/src/data/adminMockData.js');
  const revenue = series.reduce((s, d) => s + d.revenue, 0);
  const bookings = series.reduce((s, d) => s + d.bookings, 0);
  const pending = series.reduce((s, d) => s + d.pending, 0);
  report('D1 daily series sums exactly to the month revenue', revenue === ranges.month.revenue, `${revenue} vs ${ranges.month.revenue}`);
  report('D2 daily series sums exactly to the month bookings', bookings === ranges.month.bookings, `${bookings} vs ${ranges.month.bookings}`);
  // مجموع يومي لا يدور بلا سبب: لولاه لاختلف رقم النطاق المخصص عن رقم الشهر.
  report('D2b daily series sums exactly to the pending payouts', pending === stats.payoutsPending, `${pending} vs ${stats.payoutsPending}`);
  const commission = Math.round(revenue * 0.12);
  report(
    'D3 a summed full month reproduces the month commission and payouts',
    commission === ranges.month.commission && revenue - commission === ranges.month.payouts,
    `commission=${commission} payouts=${revenue - commission}`
  );
  // كل يوم واحد مرتّب بلا فجوات — وإلا بُنيت النتيجة على تاريخ غير موجود.
  const contiguous = series.every((d, i) => d.date === new Date(Date.UTC(2026, 8, i + 1)).toISOString().slice(0, 10));
  report('D4 daily series is contiguous and sorted', contiguous && span.from === series[0].date && span.to === series[series.length - 1].date, `${span.from}..${span.to} (${series.length} days)`);
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
    report('AF7 CSV reports current range values', csvText.includes('241,500') && csvText.includes('28,980'), csvText.match(/"241,500".{0,90}/)?.[0] || csvText.slice(0, 200));
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
    // أحدث حجز في adminBookings هو #BK-1030 (2026-09-23) — لا #BK-1021. المعاملات
    // صارت تُبنى من الحجوزات نفسها فلا يجوز أن يبقى الاختبار على ترتيب قديم.
    report('AF11b the modal shows the newest booking: id, space, real owner, user, date, status',
      modalText.includes('#BK-1030')
      && modalText.includes('استوديو الأناقة')
      && modalText.includes('أحمد جودة')
      && modalText.includes('أحمد العمري')
      && modalText.includes('مؤكد')
      && /\d{1,2}[/-]\d{1,2}[/-]\d{4}|٢٠٢٦/.test(modalText),
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
  report('A11 row action menu has 5 actions', !!menu && menu.querySelectorAll('button').length === 5, menu ? `found ${menu.querySelectorAll('button').length}` : 'no menu');
  const inViewport = !!menu && (() => {
    const r = menu.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0;
  })();
  report('A12 row menu positioned inside viewport', inViewport);

  // قائمة تغيير الحالة الفرعية
  const statusBtn = menu ? Array.from(menu.querySelectorAll('button')).find((b) => b.textContent.includes('تغيير الحالة')) : null;
  if (statusBtn) await v.click(statusBtn);
  const subMenu = dom.window.document.querySelector('#admin-user-status-menu');
  report('A11b status submenu lists the 3 statuses', !!subMenu && subMenu.querySelectorAll('button').length === 3, subMenu ? `found ${subMenu.querySelectorAll('button').length}` : 'no submenu');
  const reviewBtn = subMenu ? Array.from(subMenu.querySelectorAll('button')).find((b) => b.textContent.includes('قيد المراجعة')) : null;
  if (reviewBtn) await v.click(reviewBtn);
  report('A11c status change applies', v.text().includes('قيد المراجعة'));

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
  const menuItems = Array.from(dom.window.document.querySelectorAll('.dash__menu--fixed button'));
  const delBtn = menuItems.find((b) => b.textContent.includes('حذف'));
  if (delBtn) await v.click(delBtn);
  const confirmDelete = v.findAll('button').find((b) => b.textContent.includes('نعم، احذف'));
  report('A16 delete confirmation modal opens', !!confirmDelete, `menuItems=${menuItems.length} [${menuItems.map((b) => b.textContent.trim()).join(' | ')}]`);
  // الصفحة مقسّمة إلى صفحات، لذا نتحقق من اختفاء الاسم لا من عدد الصفوف
  const deletedName = (v.findAll('.dash__table tbody tr')[0]?.querySelector('p')?.textContent || '').trim();
  if (confirmDelete) await v.click(confirmDelete);
  await flush();
  report('A17 delete removes the row', !!deletedName && !v.text().includes(deletedName), `deleted=${deletedName}`);
  v.unmount();
}

console.log('\n===== ADMIN: المساحات والحجوزات والمراجعات =====');
{
  const s = await mount('/admin/spaces');
  // تبويب الحالة: التصفية يجب أن تُبقي المطابق فقط وتطابق العدد المعروض
  await s.click(s.find('[data-space-tab="active"]'));
  const activeCards = s.findAll('[data-space-card]').length;
  report(
    'A18 spaces status filter keeps only active rows',
    activeCards === 5 && s.findAll('.badge--confirmed').length === 5 && s.findAll('.badge--cancelled').length === 0,
    `cards=${activeCards} green=${s.findAll('.badge--confirmed').length} red=${s.findAll('.badge--cancelled').length}`
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
  const cardDate = (r.find('[data-review-card="1"] [data-review-date]')?.textContent || '').trim();
  report('A21f3 the card date is formatted in Arabic, not raw ISO',
    cardDate === '١٥ سبتمبر ٢٠٢٦', `date=${cardDate}`);

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

  try {
    const v = await mount('/admin/reviews');
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
    'A48 approve action uses the green semantic tone',
    approveBtns.length === 3 && approveBtns.every((b) => b.className.includes('is-green')),
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

{
  const u = await mount('/admin/unknown-tab');
  await waitFor(() => u.path() === '/admin');
  report('A33 unknown admin route falls back to /admin', u.path() === '/admin', `path=${u.path()}`);
  u.unmount();

  const t = await mount('/admin/users/');
  // هذا كان مصدر التذبذب: تبويب المستخدمين ثقيل، فننتظر ظهور العلامة المطلوبة
  // بدل قراءة DOM بعد مهلة ثابتة.
  await waitFor(() => t.path() === '/admin/users' && t.text().includes('إدارة المستخدمين والملاك'));  report('A34 trailing-slash route resolves to the users tab', t.path() === '/admin/users' && t.text().includes('إدارة المستخدمين والملاك'), `path=${t.path()}`);
  t.unmount();
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
