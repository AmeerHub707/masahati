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
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// مهم: يجب تحميل react-dom/client بعد تجهيز نوافذ jsdom حتى يعتمد React وضع
// isInputEventSupported الحقيقي (استيراد ثابت يُرفَع أعلاه ولا يرى window).
const { createRoot } = await import('react-dom/client');

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
  'GET /api/owner/spaces': { status: 200, body: { data: [{ space_id: 12, title: 'قاعة العروض الكبرى', description: 'قاعة واسعة', location: 'وسط المدينة', price_per_hour: 150, capacity: 120, amenities: ['internet', 'ac'], internet: true, is_active: true, rating: 4.8 }] } },
  'GET /api/owner/offers': { status: 200, body: { data: [{ offer_id: 88, request_id: 41, request_title: 'قاعة محاضرات لدورة تدريبية', status: 'pending', price_per_hour: 150, duration_hours: 3, created_at: '2026-09-18 11:00:00' }] } },
  'GET /api/special-requests/open': { status: 200, body: { data: { requests: [{ request_id: 41, title: 'قاعة محاضرات لدورة تدريبية أسبوعية', description: 'أبحث عن قاعة', capacity: 40, budget: 180, space_type: 'whole', schedule_label: 'أسبوعي × 8', preferred_time: '10:00 ص – 1:00 م', area: 'وسط المدينة', amenities: ['internet', 'projector'], status: 'open', offers_count: 2, created_at: '2026-09-18 10:00:00' }] } } },
  'GET /api/owner/bookings': { status: 200, body: [] },
  'POST /api/owner/spaces': { status: 201, body: { message: 'تمت إضافة المساحة.', space: { space_id: 24, title: 'جناح جديد', location: 'غزة', price_per_hour: 90, capacity: 25, amenities: ['internet'], is_active: true } } },
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

const CustomerDashboard = (await server.ssrLoadModule('/src/pages/CustomerDashboard.jsx')).default;

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
console.log('\n===== UI: CustomerDashboard mount + data flow =====');
const root = createRoot(appEl);
root.render(
  React.createElement(MemoryRouter, { initialEntries: ['/dashboard/customer'] },
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/dashboard/customer', element: React.createElement(CustomerDashboard) })
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

// ============================================================
// لوحة صاحب المساحة (OWNER) — تخيّل أن المستخدم هو المالك
// ============================================================
console.log('\n===== UI: Owner dashboard (space owner) =====');

const SpaceOwnerDashboard = (await server.ssrLoadModule('/src/pages/SpaceOwnerDashboard.jsx')).default;

// الدور الآن مالك — حتى تمر بوابة الحماية في SpaceOwnerDashboard
api.setUser({ name: 'كرم', role: 'space_owner' });

const ownerEl = dom.window.document.createElement('div');
dom.window.document.body.appendChild(ownerEl);

async function waitForOwnerText(snippet, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await flush();
    const content = ownerEl.querySelector('.odash__content')?.textContent || ownerEl.textContent;
    if (content.includes(snippet)) return true;
  }
  return false;
}

async function clickOwnerByText(txt) {
  const nodes = Array.from(ownerEl.querySelectorAll('button, a, [role=button], li, span'));
  const el = nodes.find((n) => (n.textContent || '').trim() === txt || (n.textContent || '').includes(txt));
  if (!el) return false;
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await flush();
  await flush();
  return true;
}

async function setOwnerInputValue(sel, value) {
  const el = ownerEl.querySelector(sel);
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await flush();
  return true;
}

const ownerRoot = createRoot(ownerEl);
ownerRoot.render(
  React.createElement(MemoryRouter, { initialEntries: ['/dashboard/space-owner'] },
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/dashboard/space-owner', element: React.createElement(SpaceOwnerDashboard) })
    )
  )
);

// انتظر زوال الشاشة التحميلية وظهور بنية اللوحة المخصصة
async function waitForOwnerLoaderGone(timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await flush();
    if (!ownerEl.querySelector('.loading') && ownerEl.querySelector('.odash__side')) return true;
  }
  return false;
}

report('O1 Owner dashboard mounts with side nav', await waitForOwnerLoaderGone(), 'loader still visible');
report('O2 Owner side profile shows المدير name', ownerEl.querySelector('.odash__profile')?.textContent.includes('كرم'), 'owner profile name absent');

// نظرة عامة: إحصاءات السوق والمساحات
report('O3 Overview stats render', await waitForOwnerText('طلب مفتوح في السوق') && await waitForOwnerText('مساحة مسجّلة'), 'overview stats absent');
report('O4 Overview hero greeting', !!ownerEl.querySelector('.odash__hero') && ownerEl.textContent.includes('صاحب مساحة'), 'hero absent');

// التنقل بين التبويبات المخصصة
report('O5 Navigate to market tab', await clickOwnerByText('السوق المفتوح'), 'no click');
report('O6 Market feed renders', await waitForOwnerText('قاعة محاضرات لدورة تدريبية أسبوعية') || await waitForOwnerText('السوق المفتوح'), 'market content absent');

report('O7 Navigate to offers tab', await clickOwnerByText('عروضي'), 'no click');
report('O8 Offers list renders', await waitForOwnerText('بانتظار الرد') && await waitForOwnerText('قاعة محاضرات'), 'offers content absent');

report('O9 Navigate to spaces tab', await clickOwnerByText('مساحاتي'), 'no click');
report('O10 Spaces list renders', await waitForOwnerText('قاعة العروض الكبرى'), 'spaces content absent');

// إضافة مساحة جدبدة من النموذج
report('O11 Add-space button present', !!ownerEl.querySelector('.odash__spaces-add'), 'no button');
ownerEl.querySelector('.odash__spaces-add')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
await flush();
await flush();
report('O12 Add-space modal opens', await waitForOwnerText('أضف مساحة جديدة'), 'modal absent');
const ownerTitleFilled = await setOwnerInputValue('input[placeholder^="مثال: قاعة"]', 'جناح جديد');
report('O13 Fill space title', ownerTitleFilled && ownerEl.querySelector('input[placeholder^="مثال: قاعة"]')?.value === 'جناح جديد', 'title not set');
await setOwnerInputValue('input[placeholder^="مثال: وسط المدينة"]', 'غزة');
await setOwnerInputValue('input[placeholder^="مثال: 120"]', '90');
await setOwnerInputValue('input[placeholder^="مثال: 30"]', '25');
const clickedSubmit = await clickOwnerByText('إضافة المساحة');
report('O14 Submit new space', clickedSubmit && (await waitForOwnerText('تمت إضافة المساحة') || await waitForOwnerText('جناح جديد')), 'toast/card absent');

await server.close();
console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}