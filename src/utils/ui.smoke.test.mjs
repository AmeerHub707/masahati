// اختبار عرض (Smoke) لمكوّنات لوحة التحكم الفعلية تحت React + jsdom.
// يُحمّل المكوّنات عبر محمّل Vite SSR ثم يقدّمها بـ react-dom/client.
// كل الطلبات تُحوَّل لاستجابات مسجلة؛ لا حاجة لمخدم حقيقي.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:5173',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
if (!globalThis.HTMLElement) globalThis.HTMLElement = dom.window.HTMLElement;
if (!globalThis.Element) globalThis.Element = dom.window.Element;
if (!globalThis.Node) globalThis.Node = dom.window.Node;
if (!globalThis.Image) globalThis.Image = dom.window.Image;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
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

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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

const { createServer } = await import('vite');
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});
const api = await server.ssrLoadModule('/src/lib/api.js');
const BASE = api.BASE_URL;

api.setToken('tok-ui-test');
api.setUser({ name: 'كرم', role: 'customer' });

const routes = {
  'GET /api/dashboard/stats': { status: 200, body: { upcoming_bookings_count: 3, total_hours: 10, favorite_spaces_count: 2, booked_hours_this_month: 8 } },
  'GET /api/dashboard/upcoming-booking': { status: 200, body: { title: 'غرفة الاجتماعات', image: '/a.jpg', date: '2026-09-20', time: '10:00' } },
  'GET /api/dashboard/bookings': { status: 200, body: [] },
  'GET /api/dashboard/favorites': { status: 200, body: [{ space_id: 5, title: 'استوديو تصوير', image: '/s.jpg', rating: 4, location: 'رام الله', price: 50 }] },
  'GET /api/profile': { status: 200, body: { name: 'كرم', email: 'k@k.com', phone: '+970', picture: '/profile.jpg' } },
  'POST /api/dashboard/favorites/toggle': { status: 200, body: { message: 'أُزيلت', is_favorited: false } },
  'PATCH /api/customer/profile': { status: 200, body: { ok: true } },
  'PATCH /api/profile/picture': { status: 200, body: { profile_picture_url: '/new.jpg' } },
  'POST /api/uploadPicture': { status: 200, body: { profile_picture_url: '/new-upload.jpg', msg: 'upload is succes' } },
  'POST /api/logout': { status: 200, body: { message: 'ok' } },
};

globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  const path = String(url).replace(BASE, '').split('?')[0];
  const r = routes[`${method} ${path}`] || { status: 404, body: { message: 'nf' } };
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    text: async () => JSON.stringify(r.body),
  };
};

const DashboardPage = (await server.ssrLoadModule('/src/pages/DashboardPage.jsx')).default;

function flush() {
  return new Promise((r) => setTimeout(r, 80));
}

async function waitForText(snippet, timeout = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await flush();
    const content = appEl.querySelector('.dash__content')?.textContent || appEl.textContent;
    if (content.includes(snippet)) return true;
  }
  return false;
}

async function waitForLoaderGone(timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await flush();
    if (!appEl.querySelector('.loading')) return true;
  }
  return false;
}

const appEl = dom.window.document.createElement('div');
dom.window.document.body.appendChild(appEl);

// ----- المنطق -----
console.log('\n===== UI: DashboardPage mount + data flow =====');
const root = createRoot(appEl);
root.render(
  React.createElement(MemoryRouter, { initialEntries: ['/dashboard/customer'] },
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/dashboard/customer', element: React.createElement(DashboardPage) })
    )
  )
);
await waitForLoaderGone();
await flush();

report('U1 Dashboard mounts without crashing', !appEl.querySelector('.loading') && (appEl.querySelector('.dash__layout') || appEl.querySelector('.dash__side')), 'loader still visible / no layout');
const hasOverview = appEl.textContent.includes('حجوزات قادمة') || appEl.textContent.includes('تصفح المساحات') || appEl.textContent.includes('بياناتك');
report('U2 Overview section content rendered (stats/actions)', hasOverview, appEl.textContent.slice(0, 120));
report('U3 Profile name shown from API', appEl.querySelector('.dash__side')?.textContent.includes('كرم') || appEl.querySelector('.dash__top')?.textContent.includes('كرم') || appEl.textContent.includes('كرم'), appEl.textContent.slice(0, 80));

async function clickByText(txt) {
  const nodes = Array.from(appEl.querySelectorAll('button, a, [role=tab], li, span'));
  const el = nodes.find((n) => n.textContent.trim() === txt || n.textContent.trim().includes(txt));
  if (!el) return false;
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await flush();
  await flush();
  return true;
}

// الانتقال للأقسام
report('U4 Navigate to bookings section', await clickByText('حجوزاتي'), 'no click');
report('U5 Bookings section rendered', await waitForText('حجز') || await waitForText('قادمة') || await waitForText('ماضية') || await waitForText('سجل الحجوزات') || await waitForText('لا توجد حجوزات'), 'section content absent');

report('U6 Navigate to favorites section (click)', await clickByText('المساحات المفضلة'), 'no click');
report('U7 Favorites shows saved space', await waitForText('استوديو تصوير'), 'favorites data absent');

report('U8 Navigate to settings section (click)', await clickByText('الإعدادات'), 'no click');
report('U9 Settings form renders', await waitForText('كلمة المرور') || !!appEl.querySelector('[id="set-name"]'), 'settings form absent');

// ----- قسم الطلبات الخاصة (وضع تجريبي) -----
console.log('\n===== UI: Requests tab (demo) =====');
report('R1 Navigate to requests tab', await clickByText('طلباتي الخاصة'), 'no click');
report('R2 Requests list rendered', await waitForText('في انتظار العروض'), 'requests list absent');

// فتح أول طلب -> شارة العروض الجديدة تُصفّر تلقائياً (لا اختبار لأن العرض الأول بدون شارة)
const openReqCard = await waitForText('عرض العروض');
report('R3 Cards show open-requests CTA', openReqCard, 'no open CTA found');

// زر طلب جديد موجود
report('R4 "طلب جديد" button present', !!(await clickByText('طلب جديد')), 'no button');
report('R5 Create form opens', await waitForText('أنشئ طلباً خاصاً'), 'create form absent');
report('R6 Back link returns to list', await clickByText('كل الطلبات'), 'no back');
report('R7 List visible again', await waitForText('في انتظار العروض'), 'list absent');

// ----- أكورديون "الطلبات الخاصة" في الشريط الجانبي + مسح النموذج -----
console.log('\n===== UI: Requests accordion + clear form =====');
report('R8 Expand sidebar requests accordion', (await clickByText('طلباتي الخاصة')) && !!appEl.querySelector('.dash__nav-sub'), 'no submenu');
const subLabels = Array.from(appEl.querySelectorAll('.dash__nav-sub')).map((s) => s.textContent);
report('R9 Submenu lists طلباتي + إنشاء طلب', subLabels.some((t) => t.includes('طلباتي') && t.includes('إنشاء طلب')), JSON.stringify(subLabels));

async function clickSubmenu(itemText) {
  const btn = Array.from(appEl.querySelectorAll('.dash__nav-sub button')).find((b) => b.textContent.includes(itemText));
  if (!btn) return false;
  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await flush();
  await flush();
  return true;
}

report('R10 Open create form via submenu item', (await clickSubmenu('إنشاء طلب')) && (await waitForText('أنشئ طلباً خاصاً')), 'create form absent');

async function setInputValue(sel, value) {
  const el = appEl.querySelector(sel);
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await flush();
  return true;
}

const titleFilled = setInputValue('input[placeholder^="مثال: قاعة"]', 'قاعة محاضرات كبيرة');
report('R11 Fill title field', titleFilled && appEl.querySelector('input[placeholder^="مثال: قاعة"]')?.value === 'قاعة محاضرات كبيرة', 'title not set');
report('R12 "مسح الحقول" button present', await clickByText('مسح الحقول'), 'no clear button');
report('R13 Title cleared after clicking مسح الحقول', (appEl.querySelector('input[placeholder^="مثال: قاعة"]')?.value || '') === '', 'title still filled');

report('R14 Back to list via submenu "طلباتي"', (await clickSubmenu('طلباتي')) && (await waitForText('في انتظار العروض')), 'list absent');
await server.close();
console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}