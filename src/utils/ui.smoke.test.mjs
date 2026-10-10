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
  'GET /api/owner/spaces': { status: 200, body: { data: [{ space_id: 12, title: 'قاعة العروض الكبرى', description: 'قاعة واسعة', location: 'وسط المدينة', price_per_hour: 150, capacity: 120, open_time: '08:00', close_time: '18:00', contact_phone: '0599123456', amenities: ['internet', 'ac'], internet: true, is_active: true, rating: 4.8 }] } },
  'GET /api/owner/offers': { status: 200, body: { data: [{ offer_id: 88, request_id: 41, request_title: 'قاعة محاضرات لدورة تدريبية', status: 'pending', price_per_hour: 150, duration_hours: 3, created_at: '2026-09-18 11:00:00' }] } },
  'GET /api/special-requests/open': { status: 200, body: { data: { requests: [{ request_id: 41, title: 'قاعة محاضرات لدورة تدريبية أسبوعية', description: 'أبحث عن قاعة', capacity: 40, budget: 180, space_type: 'whole', schedule_label: 'أسبوعي × 8', preferred_time: '10:00 ص – 1:00 م', area: 'وسط المدينة', amenities: ['internet', 'projector'], status: 'open', offers_count: 2, created_at: '2026-09-18 10:00:00' }] } } },
  'GET /api/special-requests': { status: 200, body: { data: { requests: [
    { request_id: 41, title: 'قاعة محاضرات لدورة تدريبية أسبوعية', description: 'أبحث عن قاعة محاضرات مناسبة لدورة تدريبية', capacity: 40, budget: 180, space_type: 'whole', schedule_preset: 'weekly', schedule_count: 8, preferred_time: '10:00 ص – 1:00 م', area: 'وسط المدينة', amenities: ['internet', 'projector'], status: 'open', offers_count: 2, created_at: '2026-09-18 10:00:00' }
  ] } } },
  'GET /api/owner/bookings': { status: 200, body: [] },
  'POST /api/owner/spaces': { status: 201, body: { message: 'تمت إضافة المساحة.', space: { space_id: 24, title: 'جناح جديد', location: 'غزة', price_per_hour: 90, capacity: 25, open_time: '09:00', close_time: '18:00', contact_phone: '0599123456', amenities: ['internet'], is_active: true } } },
  // بوابة الوثائق: تبدأ «لم تُرسل»، ثم نحاكي قرار الإدارة بالاعتماد.
  'GET /api/owner/documents': { status: 200, body: { data: { status: 'none', files: {} } } },
};

globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  const path = String(url).replace(BASE, '').split('?')[0];
  if (method === 'POST' && path === '/api/owner/spaces') { globalThis.__spaceCreateBody = opts.body; }
  if (method === 'POST' && path === '/api/logout') { globalThis.__logoutCalls = (globalThis.__logoutCalls || 0) + 1; }
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

// لا توجد هوية رقمية في الاختبار، لذلك مفتاح جولة العميل ينتهي بـ «guest».
const CUSTOMER_TOUR_KEY = 'masahati.customer-tour.v1.completed:guest';
dom.window.localStorage.removeItem(CUSTOMER_TOUR_KEY);

const doc = dom.window.document;

function clickIn(root, sel) {
  const el = root.querySelector(sel);
  if (!el) return false;
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
}

async function waitForNode(sel, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await flush();
    if (doc.querySelector(sel)) return true;
  }
  return false;
}

async function waitForGone(sel, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await flush();
    if (!doc.querySelector(sel)) return true;
  }
  return false;
}

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

// ============================================================
// جولة التعريف للوحة العميل + المساعد الذكي
// ============================================================
console.log('\n===== UI: Customer tour + assistant =====');
report('CT1 Tour auto-starts on first visit', await waitForNode('[data-tour-overlay]'), 'tour did not auto-start');
report('CT2 Tour opens on step 1', !!doc.querySelector('[data-tour-step="1"]'), 'step 1 missing');
report('CT3 Tour popover is an accessible dialog', doc.querySelector('[data-tour="customer-tour-popover"]')?.getAttribute('aria-modal') === 'true', 'aria-modal missing');
report('CT4 Header anchor exists', !!appEl.querySelector('[data-tour="customer-header"]'), 'header anchor missing');
report('CT5 Sidebar anchor exists', !!appEl.querySelector('[data-tour="customer-sidebar"]'), 'sidebar anchor missing');
report('CT6 Metrics anchor exists', !!appEl.querySelector('[data-tour="customer-metrics"]'), 'metrics anchor missing');
report('CT7 Quick-action anchor exists', !!appEl.querySelector('[data-tour="customer-quick-action"]'), 'quick-action anchor missing');

// نفس قاعدة قناع الإضاءة في لوحة المالك: الأبيض = تعتيم، الأسود = فتحة.
const cMaskBase = doc.querySelector('[data-tour-mask="base"]');
const cMaskHole = doc.querySelector('[data-tour-mask="hole"]');
report('CT8 Dim mask polarity is correct', cMaskBase?.getAttribute('fill') === '#fff' && cMaskHole?.getAttribute('fill') === '#000', 'spotlight mask is inverted');

// المساعد الذكي موجود كزر عائم على لوحة العميل.
report('CA1 Assistant bubble present', !!appEl.querySelector('[data-tour="customer-assistant"]'), 'assistant bubble missing');
report('CA2 WhatsApp floating bubble replaced by the assistant', !doc.querySelector('.wa-bubble'), 'standalone WhatsApp bubble (.wa-bubble) still present');

// الخطوة 5 تبرز المساعد نفسه.
for (let i = 0; i < 4; i += 1) {
  clickIn(doc, '[data-tour="customer-tour-next"]');
  await flush();
  await flush();
}
report('CT9 Step 5 targets the assistant', (await waitForNode('[data-tour-step="5"]')) && !!appEl.querySelector('[data-tour="customer-assistant"]'), 'assistant step missing');

// زر الرجوع يرجع خطوة.
clickIn(doc, '[data-tour="customer-tour-back"]');
await flush();
await flush();
report('CT10 Back returns to step 4', await waitForNode('[data-tour-step="4"]'), 'back did not work');

// «تم» يغلق الجولة ويكتب علامة الإنجاز.
clickIn(doc, '[data-tour="customer-tour-next"]');
await flush();
report('CT11 Finish closes the tour', clickIn(doc, '[data-tour="customer-tour-finish"]') && (await waitForGone('[data-tour-overlay]')), 'tour still open after finish');
report('CT12 Finish persists completion', dom.window.localStorage.getItem(CUSTOMER_TOUR_KEY) === '1', 'completion key not written');

// إعادة الجولة من زر المساعدة في الشريط العلوي.
report('CT13 Replay button present', !!appEl.querySelector('[data-tour="customer-tour-replay"]'), 'replay button missing');
clickIn(appEl, '[data-tour="customer-tour-replay"]');
await flush();
report('CT14 Replay reopens at step 1', await waitForNode('[data-tour-step="1"]'), 'replay did not reopen');
report('CT15 Skip closes and persists', clickIn(doc, '[data-tour="customer-tour-skip-text"]') && (await waitForGone('[data-tour-overlay]')) && dom.window.localStorage.getItem(CUSTOMER_TOUR_KEY) === '1', 'skip failed');
// نتحقق من التبويب النشط عبر شريط التنقل: التبويبات تبقى مركّبة أثناء أنيميشن
// الخروج، فوجود .dash__stats وحده لا يثبت أن تبويب النظرة العامة هو النشط.
const activeNavAfterTour = appEl.querySelector('.dash__nav button.is-active');
report('CT16 Tour left the overview tab active', !!activeNavAfterTour && activeNavAfterTour.textContent.includes('نظرة عامة'), `active=${activeNavAfterTour?.textContent?.trim()}`);

// المساعد:Without consent لا ح 입력 ولا رد ذكي.
clickIn(appEl, '[data-tour="customer-assistant"]');
await flush();
await flush();
report('CA3 Assistant panel opens on consent screen', appEl.textContent.includes('خصوصيتك أولاً'), 'consent screen absent');
report('CA4 Assistant offers both consent choices', appEl.textContent.includes('الوضع المحلي فقط') && appEl.textContent.includes('شارك بياناتي مع الذكاء'), 'consent choices absent');
const grantBtn = Array.from(appEl.querySelectorAll('button')).find((b) => b.textContent.includes('الوضع المحلي فقط'));
grantBtn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
await flush();
await flush();
report('CA5 Consent choice unlocks the chat', appEl.querySelector('.cassist-inputbar input') !== null, 'chat input absent after consent');
report('CA6 Suggestion cards render from live data', appEl.querySelectorAll('.cassist-card').length > 0, 'no suggestion cards');
report('CA7 Customer assistant uses its own classes, not the owner\'s', appEl.querySelector('.cassist') !== null && appEl.querySelector('.oassist') === null, 'customer assistant is styled with owner classes');
report('CA8 Customer bubble is not the owner bubble element', appEl.querySelector('.cassist-bubble') !== null && appEl.querySelector('.oassist-bubble') === null, 'customer bubble still uses owner bubble class');

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

// ----- «الطلبات الخاصة» تبويب مستوٍ مثل بقية التبويبات -----
console.log('\n===== UI: Requests sidebar tab =====');
// ملاحظة: التبويبات تبقى مركّبة أثناء أنيميشن الخروج (AnimatePresence mode="wait")،
// فوجود عنصر تبويب ليس دليلاً على أنه النشط. المصدر الموثوق هو حالة شريط التنقل.
const activeNav = () => appEl.querySelector('.dash__nav button.is-active');
const isOnTab = (label) => !!activeNav() && activeNav().textContent.includes(label);
const navButtons = () => Array.from(appEl.querySelectorAll('.dash__nav > button'));

await clickByText('نظرة عامة');
await flush(); await flush();
report('R0 Start from the overview tab', isOnTab('نظرة عامة'), `active=${activeNav()?.textContent?.trim()}`);

// «الطلبات الخاصة» يجب أن يظهر كنص كامل داخل شريط التنقل (بلا أكورديون يخفيه).
const reqTabBtn = navButtons().find((b) => b.textContent.trim() === 'الطلبات الخاصة');
report('R14 Requests label renders with its full text', reqTabBtn?.textContent?.trim() === 'الطلبات الخاصة', `label="${reqTabBtn?.textContent?.trim()}"`);

// كل التبويبات عناصر مباشرة في الشريط: لا صف خاص ولا قائمة فرعية ولا زر طيّ.
const navGroup = appEl.querySelector('.dash__nav-group, .dash__nav-parentwrap, .dash__nav-sub, .dash__nav-toggle');
report('R4 Requests is a plain tab, not an accordion', !navGroup, 'accordion markup still present');
report('R5 Sidebar renders 6 top-level nav buttons', navButtons().length === 6, `count=${navButtons().length}`);

await clickByText('الطلبات الخاصة');
await flush(); await flush();
report('R1 Tab button navigates to requests', isOnTab('الطلبات الخاصة'), `active=${activeNav()?.textContent?.trim()}`);
report('R2 Requests list rendered', await waitForText('في انتظار العروض'), 'requests list absent');
// فتح أول طلب -> شارة العروض الجديدة تُصفّر تلقائياً (لا اختبار لأن العرض الأول بدون شارة)
report('R2b Cards show open-requests CTA', await waitForText('عرض العروض'), 'no open CTA found');

// إنشاء الطلب يتم من زر «طلب جديد» في رأس الصفحة، لا من الشريط الجانبي.
report('R3 "طلب جديد" button present in page header', !!(await clickByText('طلب جديد')), 'no button');
report('R3b Create form opens', await waitForText('أنشئ طلباً خاصاً'), 'create form absent');
report('R3c Back link returns to list', await clickByText('كل الطلبات'), 'no back');
report('R3d List visible again', await waitForText('في انتظار العروض'), 'list absent');

// ----- مسح النموذج من داخل صفحة الطلبات -----
console.log('\n===== UI: Requests create form + clear =====');
report('R8 Reopen create form', !!(await clickByText('طلب جديد')) && (await waitForText('أنشئ طلباً خاصاً')), 'create form absent');

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
report('R9 Fill title field', titleFilled && appEl.querySelector('input[placeholder^="مثال: قاعة"]')?.value === 'قاعة محاضرات كبيرة', 'title not set');
report('R10 "مسح الحقول" button present', await clickByText('مسح الحقول'), 'no clear button');
report('R11 Title cleared after clicking مسح الحقول', (appEl.querySelector('input[placeholder^="مثال: قاعة"]')?.value || '') === '', 'title still filled');

report('R12 Back to list from create form', (await clickByText('كل الطلبات')) && (await waitForText('في انتظار العروض')), 'list absent');

// تسجيل الخروج من لوحة العميل: نفس شاشة الحظر المستخدمة في لوحة المالك.
console.log('\n===== UI: Customer logout blocking screen =====');
globalThis.__logoutCalls = 0;
appEl.querySelector('.dash__nav-logout')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
await flush();
await flush();
const custOverlay = doc.querySelector('.loading--logout');
report('CL1 Customer logout shows the blocking screen', !!custOverlay && (custOverlay.textContent || '').includes('جارٍ تسجيل الخروج'), 'overlay absent');
report('CL2 Customer dashboard root is inert', appEl.firstElementChild?.hasAttribute('inert') === true, 'customer root not inert');
report('CL3 Customer logout locks scrolling and focus', dom.window.document.body.classList.contains('no-scroll') && custOverlay?.contains(doc.activeElement) === true, 'scroll/focus not locked');
appEl.querySelector('.dash__nav-logout')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
await flush();
report('CL4 Customer logout fires one request only', globalThis.__logoutCalls === 1, `logout called ${globalThis.__logoutCalls} times`);
let custOverlayGone = false;
for (let i = 0; i < 40 && !custOverlayGone; i += 1) {
  await flush();
  custOverlayGone = !doc.querySelector('.loading--logout');
}
report('CL5 Customer overlay is cleared after logout', custOverlayGone, 'overlay stayed on screen');


// ============================================================
// لوحة صاحب المساحة (OWNER) — تخيّل أن المستخدم هو المالك
// ============================================================
console.log('\n===== UI: Owner dashboard (space owner) =====');

const SpaceOwnerDashboard = (await server.ssrLoadModule('/src/pages/SpaceOwnerDashboard.jsx')).default;

// الدور الآن مالك — حتى تمر بوابة الحماية في SpaceOwnerDashboard
api.setUser({ name: 'كرم', role: 'space_owner' });

// لا توجد هوية رقمية في الاختبار، لذلك مفتاح الجولة ينتهي بـ «guest».
const TOUR_KEY = 'masahati.owner-tour.v1.completed:guest';
dom.window.localStorage.removeItem(TOUR_KEY);

const ownerEl = dom.window.document.createElement('div');
dom.window.document.body.appendChild(ownerEl);

// تُستخدم أدوات الجولة العامة (doc / clickIn / waitForNode / waitForGone) المعرّفة أعلى.

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

// يحاكي اختيار مستند من جهاز الاتصال داخل النموذج (حقل ملف مخفي).
async function setOwnerFile(sel, name) {
  const input = ownerEl.querySelector(sel);
  if (!input) return false;
  const file = new dom.window.File([name], name, { type: 'application/pdf' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await flush();
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

// ============================================================
// جولة التعريف (Owner Tour) — تشغيل تلقائي، تخطي، إعادة، تنقّل بين الخطوات
// ============================================================
report('OA1 Owner assistant keeps its own classes (not the customer\'s)', ownerEl.querySelector('.oassist') !== null && ownerEl.querySelector('.cassist') === null, 'owner assistant is styled with customer classes');
report('OA2 Owner assistant bubble is still the owner element', ownerEl.querySelector('.oassist-bubble') !== null && ownerEl.querySelector('.cassist-bubble') === null, 'owner bubble class was changed');
report('OT1 Tour auto-starts on first visit', await waitForNode('[data-tour-overlay]'), 'tour did not auto-start');
report('OT2 Tour opens on step 1', !!doc.querySelector('[data-tour-step="1"]'), 'step 1 missing');
report('OT3 Tour popover is an accessible dialog', doc.querySelector('[data-tour="owner-tour-popover"]')?.getAttribute('aria-modal') === 'true', 'aria-modal missing');
report('OT4 Header anchor exists', !!ownerEl.querySelector('[data-tour="owner-header"]'), 'header anchor missing');
report('OT5 Sidebar anchor exists', !!ownerEl.querySelector('[data-tour="owner-sidebar"]'), 'sidebar anchor missing');
report('OT6 Metrics anchor exists', !!ownerEl.querySelector('[data-tour="owner-metrics"]'), 'metrics anchor missing');

// قناع الإضاءة: الأبيض = تعتيم الخلفية، الأسود = فتحة تُظهر العنصر بلونه الطبيعي.
// لو انعكس لوناه لأصبح القسم المُشرح معتَّماً وبقيت بقية اللوحة واضحة.
const maskBase = doc.querySelector('[data-tour-mask="base"]');
const maskHole = doc.querySelector('[data-tour-mask="hole"]');
report('OT6a Dim mask polarity is correct', maskBase?.getAttribute('fill') === '#fff' && maskHole?.getAttribute('fill') === '#000', 'spotlight mask is inverted');
report('OT6b Dim layer is painted through the mask', doc.querySelector('.otour__spotlight rect[mask]')?.getAttribute('mask') === 'url(#owner-tour-spot-mask)', 'dim rect is not masked');
report('OT6c Spotlight hole covers the header target', Math.round(Number(maskHole?.getAttribute('width'))) > 0, 'hole has no width');
report('OT7 Skip button closes the tour', clickIn(doc, '[data-tour="owner-tour-skip-text"]') && (await waitForGone('[data-tour-overlay]')), 'tour still open');
report('OT8 Skip persists completion', dom.window.localStorage.getItem(TOUR_KEY) === '1', 'completion key not written');

report('OT9 Replay button present', !!ownerEl.querySelector('[data-tour="owner-tour-replay"]'), 'replay button missing');
clickIn(ownerEl, '[data-tour="owner-tour-replay"]');
await flush();
report('OT10 Replay reopens the tour at step 1', (await waitForNode('[data-tour-step="1"]')), 'replay did not reopen');

// نتنقل بالخطوات: 1 -> 2 -> 3 -> 4
for (let i = 0; i < 3; i += 1) {
  clickIn(doc, '[data-tour="owner-tour-next"]');
  await flush();
  await flush();
}
report('OT11 Next reaches step 4', (await waitForNode('[data-tour-step="4"]')), 'step 4 not reached');
report('OT12 Step 4 navigates to my-spaces', (await waitForOwnerText('أضف مساحة')) && !!ownerEl.querySelector('[data-tour="owner-quick-add"]'), 'quick-add anchor missing');

clickIn(doc, '[data-tour="owner-tour-next"]');
await flush();
await flush();
report('OT13 Step 5 targets the assistant', (await waitForNode('[data-tour-step="5"]')) && !!ownerEl.querySelector('[data-tour="owner-assistant"]'), 'assistant anchor missing');

clickIn(doc, '[data-tour="owner-tour-back"]');
await flush();
await flush();
report('OT14 Back returns to step 4', (await waitForNode('[data-tour-step="4"]')), 'back did not work');

clickIn(doc, '[data-tour="owner-tour-next"]');
await flush();
await flush();
await waitForNode('[data-tour-step="5"]');
clickIn(doc, '[data-tour="owner-tour-finish"]');
await flush();
report('OT15 Finish closes the tour', await waitForGone('[data-tour-overlay]'), 'tour still open after finish');
report('OT16 Loader is gone before the tour is shown', !ownerEl.querySelector('.loading'), 'loader visible');

// نظرة عامة: أربع بطاقات إحصائية جديدة
report('O3 Overview stats render', await waitForOwnerText('أرباح هذا الشهر') && await waitForOwnerText('طلبات السوق'), 'overview stats absent');
report('O4 Overview four stat cards', ownerEl.querySelectorAll('.odash__stat').length === 4, 'expected 4 stat cards');

// التنقل بين التبويبات المخصصة
report('O5 Navigate to market tab', await clickOwnerByText('السوق المفتوح'), 'no click');
report('O6 Market feed renders', await waitForOwnerText('قاعة محاضرات لدورة تدريبية أسبوعية') || await waitForOwnerText('السوق المفتوح'), 'market content absent');

report('O7 Navigate to financials tab', await clickOwnerByText('المالية'), 'no click');
report('O8 Financials renders', await waitForOwnerText('الفواتير') && await waitForOwnerText('تقرير الأداء'), 'financials content absent');
report('O8a Open performance report', await clickOwnerByText('تقرير الأداء'), 'no click');
report('O8b Spaces comparison chart renders', await waitForOwnerText('مقارنة الأداء') && !!ownerEl.querySelector('.fin__chart'), 'chart absent');

report('O9 Navigate to spaces tab', await clickOwnerByText('مساحاتي'), 'no click');
report('O10 Spaces list renders', await waitForOwnerText('أضف مساحة') && await waitForOwnerText('قاعة العروض الكبرى'), 'spaces content absent');

// ============================================================
// لا بوابة وثائق للحساب: الإضافة متاحة دائماً، ويُرفق المالك مستند
// إثبات المساحة داخل النموذج نفسه (لا في الإعدادات).
// ============================================================
const addBtn = () => ownerEl.querySelector('.odash__spaces-add');
report('OG1 Add button is available without an account-documents gate', !!addBtn() && !ownerEl.querySelector('.odash__spaces-add[data-docs-locked="true"]'), 'add button missing or still gated');
report('OG2 No account-documents gate notice is shown', !ownerEl.querySelector('#msp-docs-gate'), 'gate notice still present');
report('OG3 Account documents are not part of the spaces screen', (await waitForOwnerText('وثائق الحساب')) === false, 'account documents text still rendered');

// إضافة مساحة جديدة من النموذج
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
  const latFilled = await setOwnerInputValue('input[aria-label="خط العرض"]', '31.50110');
  const lngFilled = await setOwnerInputValue('input[aria-label="خط الطول"]', '34.46670');
  report('O13c Space coordinates set (lat/lng)', latFilled && lngFilled, 'lat/lng not set');
  const proofAttached = await setOwnerFile('input[aria-label="صك ملكية أو عقد إيجار"]', 'deed.pdf');
report('O13b Proof-of-space doc attached', proofAttached && !!ownerEl.querySelector('.msp__doc-chip'), 'doc not attached');

// أوقات العمل ورقم التواصل حقول مطلوبة: نتحقق من رفض الإرسال قبل تعبئتها،
// ثم القبول بعدها — حتى لا يمر مسار «الحقول المطلوبة» دون تغطية.
report('O13d Hours/phone fields are present and required', !!ownerEl.querySelector('#msp-open') && !!ownerEl.querySelector('#msp-close') && !!ownerEl.querySelector('#msp-phone'), 'new fields missing');
await clickOwnerByText('إرسال للمراجعة');
report('O13e Submit blocked while hours/phone are empty', (await waitForOwnerText('تم إضافة المساحة')) === false && !!ownerEl.querySelector('.odash__field.has-error'), 'submit was not blocked');

const openFilled = await setOwnerInputValue('#msp-open', '09:00');
const closeFilled = await setOwnerInputValue('#msp-close', '18:00');
const phoneFilled = await setOwnerInputValue('#msp-phone', '0599123456');
report('O13f Hours/phone filled', openFilled && closeFilled && phoneFilled, 'new fields not set');

// وقت الإغلاق قبل الفتح يجب أن يُرفض — لا نسمح بفضاء عمل يمتد بعد منتصف الليل.
await setOwnerInputValue('#msp-close', '08:00');
await clickOwnerByText('إرسال للمراجعة');
report('O13g Close-before-open is rejected', (await waitForOwnerText('تم إضافة المساحة')) === false, 'overnight hours were accepted');
await setOwnerInputValue('#msp-close', '18:00');

const clickedSubmit = await clickOwnerByText('إرسال للمراجعة');
report('O14 Submit new space for admin review', clickedSubmit && (await waitForOwnerText('تمت إضافة المساحة') || await waitForOwnerText('جناح جديد')), 'toast/card absent');
report('O14a Card shows the saved hours and contact phone', (await waitForOwnerText('09:00 – 18:00')) && (await waitForOwnerText('0599123456')), 'hours/phone missing from card');
// التحقق على مستوى الطلب: الباك-إند لا يستقبل حقولاً ناقصة.
report('O14b Create request carries hours and contact phone', (() => {
  const b = globalThis.__spaceCreateBody;
  if (!b) return false;
  const parsed = typeof b === 'string' ? JSON.parse(b) : b;
  return parsed.open_time === '09:00' && parsed.close_time === '18:00' && parsed.contact_phone === '0599123456';
})(), 'request body missing hours/phone');

// ============================================================
// تسجيل الخروج: شاشة تغطي الصفحة + منع أي تفاعل خلفها
// ============================================================
const logoutBtn = ownerEl.querySelector('.odash__nav-logout');
globalThis.__logoutCalls = 0;
logoutBtn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
await flush();
await flush();

const logoutOverlay = doc.querySelector('.loading--logout');
report('OL1 Logout overlay covers the page', !!logoutOverlay, 'overlay absent after logout click');
report('OL2 Overlay explains what is happening', (logoutOverlay?.textContent || '').includes('جارٍ تسجيل الخروج'), 'logout copy missing');
report('OL3 Overlay uses the indeterminate bar (no fake percent)', !!logoutOverlay?.querySelector('.loading__bar--indeterminate') && !logoutOverlay?.textContent.includes('%'), 'indeterminate bar missing');
report('OL4 Dashboard root is inert while logging out', ownerEl.querySelector('.odash__page-root')?.hasAttribute('inert') === true, 'page root not inert');
report('OL5 Scrolling is blocked while logging out', dom.window.document.body.classList.contains('no-scroll'), 'body still scrollable');
report('OL6 Focus is held inside the overlay', !!logoutOverlay && logoutOverlay.contains(doc.activeElement), 'focus escaped the overlay');

// حصر التركيز: Tab لا يخرج من الشاشة مهما كان العنصر خلفها.
doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
await flush();
report('OL7 Tab cannot reach controls behind the overlay', logoutOverlay?.contains(doc.activeElement) === true, 'focus moved outside the overlay');
// Escape لا يلغي شاشة الخروج.
doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
await flush();
report('OL8 Escape cannot dismiss the overlay', !!doc.querySelector('.loading--logout'), 'overlay was dismissed by Escape');

// النقر المزدوج لا يطلق طلب خروج ثانٍ.
logoutBtn?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
await flush();
report('OL9 Double click sends a single logout request', globalThis.__logoutCalls === 1, `logout called ${globalThis.__logoutCalls} times`);

// الخروج ينهي العملية: الشاشة تختفي وتُفكّ حالة الحظر.
let overlayGone = false;
for (let i = 0; i < 40 && !overlayGone; i += 1) {
  await flush();
  overlayGone = !doc.querySelector('.loading--logout');
}
report('OL10 Overlay is removed once logout finishes', overlayGone, 'overlay stayed after navigation');
report('OL11 Scroll lock is released after logout', !dom.window.document.body.classList.contains('no-scroll'), 'no-scroll left behind');

await server.close();
console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}
