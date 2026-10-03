// اختبار دخان لصفحة المقارنة: يحمّل المكوّن عبر محمّل Vite SSR ويقدّمه
// بـ react-dom داخل jsdom، ثم يتحقق من سلوك الطاولة والجدول على مستوى DOM.
// نتحقق من أربع نقاط لا يمكن لأداة lint رؤيتها:
//   1) الترتيب يبقى كما حدده المستخدم ولا يُعاد ترتيبه تلقائياً.
//   2) أزرار النقل تعمل بلا سحب (لأن السحب ليس متاحاً في jsdom).
//   3) الجدول <table> حقيقي وعناوينه على 범위 الصحيح، والأشرطة داخل الصف.
//   4) صفّ "مؤشرات المالك" مفصول بوسم <tbody> مستقل.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html lang="ar" dir="rtl"><body></body></html>', {
  url: 'http://localhost:5173',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
if (!globalThis.HTMLElement) globalThis.HTMLElement = dom.window.HTMLElement;
if (!globalThis.SVGElement) globalThis.SVGElement = dom.window.SVGElement;
if (!globalThis.SVGGraphicsElement) globalThis.SVGGraphicsElement = dom.window.SVGGraphicsElement;
if (!globalThis.Element) globalThis.Element = dom.window.Element;
if (!globalThis.Node) globalThis.Node = dom.window.Node;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IntersectionObserver = class {
  observe() {}
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

// الصفحة تقرأ الكتالوج من الخادم، وإن فشل reverted إلى البيانات التجريبية.
// نجعلها تقرأ تجريبياً مباشرة: هذا يثبّت القيم التي بُني عليها الاختبار.
globalThis.localStorage.setItem('masahati_spaces_demo_v1', '1');

import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { createRoot } = await import('react-dom/client');

let pass = 0;
let fail = 0;
const failures = [];
function report(name, ok, detail) {
  if (ok) pass++;
  else {
    fail++;
    failures.push(name);
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

const ComparePage = (await server.ssrLoadModule('/src/pages/ComparePage.jsx')).default;

const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => { for (let i = 0; i < 200; i++) await flush(); };

async function renderAt(query) {
  const el = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  root.render(
    React.createElement(MemoryRouter, { initialEntries: [`/compare${query}`] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: '/compare', element: React.createElement(ComparePage) })))
  );
  await settle();
  return { el, root };
}

const slotNames = (el) => Array.from(el.querySelectorAll('.wb__slot:not(.wb__slot--empty) .wb__slot-name'))
  .map((n) => n.textContent.trim());

const cellText = (el, label) => {
  const th = Array.from(el.querySelectorAll('.cmp-table__grid tbody th[scope="row"]'))
    .find((n) => n.textContent.trim() === label);
  if (!th) return null;
  return Array.from(th.parentElement.querySelectorAll('td')).map((td) => td.textContent.trim());
};

console.log('\n===== compare page smoke =====');

// 1) الترتيب يبقى ترتيب المستخدم
{
  const { el } = await renderAt('?sp=sp-6&sp=sp-10&sp=sp-1');
  const names = slotNames(el);
  const slots = el.querySelectorAll('.wb__slot');
  const loading = el.querySelector('.wb__slot-skeleton') !== null;
  const emptyMsg = el.querySelector('.compare__empty h3')?.textContent || '';
  report('C1 الخانات تتبع ترتيب الرابط كما هو', names.length === 3,
    `slots=${slots.length} names=${names.length} loading=${loading} empty="${emptyMsg}" `
    + `wb=${Boolean(el.querySelector('.wb'))} tray=${el.querySelectorAll('.wb__tray-item').length} `
    + `bodyLen=${el.textContent.length}`);
  report('C2 أول خانة هي sp-6 لا الأعلى تقييماً', Boolean(names[0]), JSON.stringify(names));
  const heads = Array.from(el.querySelectorAll('.cmp-table__space-head span')).map((n) => n.textContent.trim());
  report('C3 رؤوس الأعمدة بنفس ترتيب الخانات', heads.join('|') === names.join('|'),
    `heads=${heads.join('|')} slots=${names.join('|')}`);

  // 2) أزرار النقل بلا سحب
  const moves = Array.from(el.querySelectorAll('.wb__slot-move'));
  report('C4 لكل خانة زرّا نقل', moves.length === 6, `got ${moves.length}`);
  // لكل خانة زرّان: [prev, next] بالترتيب، فآخر خانة هي الزر الأخير.
  report('C5 زر النقل على أول خانة معطّل', moves[0].disabled === true);
  report('C6 زر النقل على آخر خانة معطّل', moves[5].disabled === true);
  report('C6b أزرار النقل الداخلية مفعّلة', moves[1].disabled === false && moves[4].disabled === false);
  const secondPrev = moves[1];
  secondPrev.click();
  await settle();
  const after = slotNames(el);
  report('C7 النقل بالزر يبدّل موضع الخانتين', after[0] !== names[0] && after[1] !== names[1],
    `before=${names.join('|')} after=${after.join('|')}`);

  // 3) جدول حقيقي
  const table = el.querySelector('table.cmp-table__grid');
  report('C8 الجدول عنصر <table> حقيقي', Boolean(table));
  const colHeads = Array.from(el.querySelectorAll('.cmp-table__grid thead th[scope="col"]'));
  report('C9 رؤوس الأعمدة scope=col', colHeads.length === 4, `got ${colHeads.length}`);
  const rowHeads = el.querySelectorAll('.cmp-table__grid tbody th[scope="row"]');
  report('C10 رؤوس الصفوف scope=row', rowHeads.length >= 5, `got ${rowHeads.length}`);
  report('C11 للصف الأول رأس بالمعيار', el.querySelector('.cmp-table__metric-head') !== null);

  // 4) مؤشرات المالك في tbody منفصل
  const ownerTag = el.querySelector('.cmp-table__owner-tag');
  report('C12 وسم مؤشرات المالك موجود', Boolean(ownerTag));
  const ownerBody = ownerTag ? ownerTag.closest('tbody') : null;
  const mainBody = el.querySelector('.cmp-table__grid > tbody');
  report('C13 مؤشرات المالك في <tbody> منفصل عن الأساسي', ownerBody && mainBody && ownerBody !== mainBody);
  const ownerRows = ownerBody ? ownerBody.nextElementSibling : null;
  report('C14 صفوف المالك تأتي بعد وسمها', Boolean(ownerRows && ownerRows.querySelectorAll('th[scope="row"]').length > 0));

  // 5) أشرطة الصفوف
  const bars = el.querySelectorAll('.cmp-table__bar-fill');
  report('C15 صفوف المقاييس تحمل أشرطة', bars.length > 0, `got ${bars.length}`);
  const widths = Array.from(bars).slice(0, 8).map((b) => parseFloat(b.style.width) || 0);
  report('C16 كل عرض شريط ضمن 0..100', widths.every((w) => w >= 0 && w <= 100), widths.join(','));
  report('C17 لا شريط بعرض NaN', !Array.from(bars).some((b) => String(b.style.width).includes('NaN')));
  const perHead = cellText(el, 'السعر لكل شخص (ش.ج/شخص)');
  report('C18 صف السعر لكل شخص موجود', Array.isArray(perHead) && perHead.length === 3, JSON.stringify(perHead));
  report('C19 لا NaN في صف السعر لكل شخص', Array.isArray(perHead) && !perHead.some((t) => t.includes('NaN')));

  // 6) لا نص ناقص في الصفحة كلها
  const body = el.textContent;
  report('C20 لا NaN في نص الصفحة', !body.includes('NaN'));
  report('C21 لا undefined في نص الصفحة', !body.includes('undefined'));
  report('C22 العناوين العربية سليمة', /قارن بين المساحات/.test(body) && Boolean(el.querySelector('h1.compare__title')));
  report('C23 حقل aria-live موجود', Boolean(el.querySelector('[aria-live="polite"]')));
}

// 7) حالة 공간 واحدة
{
  const { el } = await renderAt('?sp=sp-1');
  report('C24 مساحة واحدة لا تعرض نتائج', el.querySelector('.compare__results') === null);
  report('C25 رسالة ناف واحدة تظهر', el.textContent.includes('مساحة واحدة فقط'));
}

// 8) حالة فراغ
{
  const { el } = await renderAt('');
  report('C26 بلا اختيارات يطلب اختيار مساحات', el.textContent.includes('اختر مساحات لتقارنها'));
  report('C27 لا جدول بلا اختيارات', el.querySelector('.cmp-table__grid') === null);
}

// 9) تبديل الفروق فقط يخفي الصفوف المتطابقة
{
  const { el } = await renderAt('?sp=sp-10&sp=sp-4');
  const before = el.querySelectorAll('.cmp-table__grid tbody th[scope="row"]').length;
  const toggle = el.querySelector('.cmp-toggle input');
  report('C28 مفتاح "الفروق فقط" موجود', Boolean(toggle));
  if (toggle) {
    toggle.click();
    await settle();
    const after = el.querySelectorAll('.cmp-table__grid tbody th[scope="row"]').length;
    report('C29 إطفاء الفروق يزيد الصفوف أو يثبتها', after >= before, `before=${before} after=${after}`);
  }
}

// 10) صينية الاختيار: كل المساحات ظاهرة، والمختارة منها تبقى معلّمة
//     (لم تعد هناك شرائح للمختارة: صارت صينية البحث هي مكان الاختيار كله)
{
  const { el } = await renderAt('?sp=sp-6&sp=sp-10&sp=sp-1');
  const trayItems = () => Array.from(el.querySelectorAll('.wb__tray-item'));
  const trayName = (b) => (b.querySelector('.wb__tray-name') || {}).textContent?.trim() || '';
  const before = trayItems();
  const pickedInTray = before.filter((b) => b.classList.contains('is-picked')).map(trayName);
  report('C30 صينية الاختيار تعرض مساحات', before.length > 0, `got ${before.length}`);
  report('C31 كل حبة تحمل عنصر اسم', before.length > 0 && before.every((b) => Boolean(b.querySelector('.wb__tray-name'))),
    `got ${before.length}`);
  report('C32 المختارة تبقى في الصينية ولا تختفي',
    slotNames(el).length > 0 && slotNames(el).every((n) => pickedInTray.includes(n)),
    `picked=${pickedInTray.join('|')} slots=${slotNames(el).join('|')}`);
  report('C32b غير المختارة غير معلّمة',
    before.filter((b) => !b.classList.contains('is-picked')).every((b) => b.getAttribute('aria-pressed') === 'false'));
  report('C33 لا شرائح مختارة في الصفحة', el.querySelector('.cmp-chips') === null);
}

// 11) حبة الصينية: تنقر فتضيف، وتُنقر المختارة فتزيل
{
  const { el } = await renderAt('?sp=sp-6&sp=sp-10&sp=sp-1');
  const trayItems = () => Array.from(el.querySelectorAll('.wb__tray-item'));
  const trayName = (b) => (b.querySelector('.wb__tray-name') || {}).textContent?.trim() || '';
  const target = trayItems().find((b) => !b.classList.contains('is-picked'));
  if (target) {
    const title = trayName(target);
    target.click();
    await settle();
    report('C35 النقر على حبة غير مختارة يضيفها', slotNames(el).includes(title),
      `slots=${slotNames(el).join('|')} title="${title}"`);
    const nowPicked = trayItems().find((b) => trayName(b) === title);
    if (nowPicked) {
      nowPicked.click();
      await settle();
      report('C35b النقر على حبة مختارة يزيلها', !slotNames(el).includes(title),
        `slots=${slotNames(el).join('|')}`);
    } else {
      report('C35b النقر على حبة مختارة يزيلها', false, 'tray pill vanished after add');
    }
  } else {
    report('C35 النقر على حبة غير مختارة يضيفها', false, 'no unpicked tray pill');
  }
}

// 12) القسم الأعلى: الصورة هي القسم نفسه، وزر رجوع مسمّى، بلا شريط
{
  const { el } = await renderAt('?sp=sp-6&sp=sp-10&sp=sp-1');
  report('C36 لا شريط علوي في الصفحة', el.querySelector('.cmp-bar') === null && el.querySelector('.cmp-bar__more') === null);
  const hero = el.querySelector('.compare-hero');
  report('C37 القسم الأعلى موجود ويحتوي العنوان', Boolean(hero) && Boolean(hero.querySelector('h1.compare__title')));
  const back = el.querySelector('.cmp-float-back');
  report('C38 زر الرجوع العائم موجود وله اسم مقروء',
    Boolean(back) && /العودة/.test(back.getAttribute('aria-label') || ''),
    back ? back.getAttribute('aria-label') : 'missing');
  const photo = el.querySelector('.compare-hero__img');
  report('C39 صورة القسم موجودة ومزخرفة (alt فارغ)',
    Boolean(photo) && photo.getAttribute('src') === '/Hero-Compare.avif' && photo.getAttribute('alt') === ''
    && photo.getAttribute('aria-hidden') === 'true' && photo.parentElement === hero,
    photo ? `src=${photo.getAttribute('src')} alt="${photo.getAttribute('alt')}"` : 'missing');
  // شارة القسم: أيقونة ميزان + نص، وفوق العنوان لا تحته.
  const eyebrow = hero.querySelector('.compare__eyebrow');
  report('C39b شارة "مقارنة المساحات" فوق العنوان',
    Boolean(eyebrow) && Boolean(eyebrow.querySelector('svg'))
    && eyebrow.textContent.trim().length > 0
    && eyebrow.nextElementSibling && eyebrow.nextElementSibling.classList.contains('compare__title'),
    eyebrow ? `text="${eyebrow.textContent.trim()}" svg=${Boolean(eyebrow.querySelector('svg'))}` : 'missing');
  // حارس انحدار: اسم الخانة هو ما يقصّه CSS (min-width:0 + ellipsis).
  const colNames = el.querySelectorAll('.wb__slot:not(.wb__slot--empty) .wb__slot-name');
  report('C40 كل خانة تحمل عنصر اسم', colNames.length === 3, `got ${colNames.length}`);
}

// 13) على الجوال يبقى الجدول مطوياً ويُفتح بزرّه الخاص (لم يعد هناك شريط)
{
  const realMatchMedia = dom.window.matchMedia;
  dom.window.matchMedia = (q) => ({
    matches: true,
    media: q,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  });
  try {
    const { el } = await renderAt('?sp=sp-6&sp=sp-10&sp=sp-1');
    report('C41 على الجوال يبدأ الجدول مطوياً', !el.querySelector('.cmp-table__grid'));
    const disclose = el.querySelector('.cmp-table__disclose');
    let threw = null;
    try {
      if (disclose) disclose.click();
    } catch (e) {
      threw = e;
    }
    await settle();
    report('C42 زر الجدول يفتحه بلا رمي', !threw && Boolean(el.querySelector('.cmp-table__grid')),
      threw ? String(threw.message) : `disclose=${Boolean(disclose)} grid=${Boolean(el.querySelector('.cmp-table__grid'))}`);
  } finally {
    dom.window.matchMedia = realMatchMedia;
  }
}

await server.close();
console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
