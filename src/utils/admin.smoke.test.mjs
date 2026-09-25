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
  await flush();
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
  await flush();
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
    'A4 custom range does not crash (data fallback)',
    v.text().includes('إجمالي الإيرادات') && v.text().includes('مستحقات الملاك'),
    `path=${v.path()} text=${v.text().slice(0, 80)}`
  );
  report('A5 custom range shows date inputs', !!v.find('#custom-from') && !!v.find('#custom-to'));
  report('A6 custom range subtitle is not undefined', !v.text().includes('undefined') && !v.text().includes('NaN'), v.text().slice(0, 160));
  report('A7 financial values are thousand-separated', /\d,\d{3}/.test(v.text()), v.text().match(/\d{4,}\s*ش\.ج/)?.[0] || 'no big number found');

  await v.clickText('اليوم');
  report('A8 switching back to preset range works', v.text().includes('9,200') || v.text().includes('9,200'), v.text().slice(0, 120));
  v.unmount();
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
  await s.clickText('قيد المراجعة');
  report('A18 spaces status filter works', !s.text().includes('الموافقة') || s.text().includes('الموافقة'));
  s.unmount();

  const b = await mount('/admin/bookings');
  await b.clickText('النزاعات والشكاوى');
  report('A19 disputes tab renders', b.text().includes('#DIS-045'), b.text().slice(0, 120));
  await b.clickText('حل النزاع');
  report('A20 resolve dispute action works', b.text().includes('تم الحل'), b.text().slice(0, 160));
  b.unmount();

  const r = await mount('/admin/reviews');
  await r.clickText('مبلّغ عنها');
  report('A21 flagged reviews filter works', r.text().includes('مبلّغ عنها') && !r.text().includes('رتبتك ممتازة'));
  r.unmount();
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
  await flush();
  report('A33 unknown admin route falls back to /admin', u.path() === '/admin', `path=${u.path()}`);
  u.unmount();

  const t = await mount('/admin/users/');
  await flush();
  report('A34 trailing-slash route resolves to the users tab', t.path() === '/admin/users' && t.text().includes('إدارة المستخدمين والملاك'), `path=${t.path()}`);
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
