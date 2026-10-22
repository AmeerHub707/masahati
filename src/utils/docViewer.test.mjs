// اختبار عارض المستندات (DocViewer) — jsdom حقيقي فوق React.
//
// لماذا اختبار تصيير لا اختبار وحدة فقط؟ لأن العارض كله سلوك: نقطة تبديل
// بين صورةٍ وإطار PDF وبطاقة بديلة، وأزرار تكبير تُغيَّر بها النسبة فعلاً،
// وقفل تمريرٍ يُرفع عند الإغلاق. وكل هذه أخطاءها لا تظهر في بناءٍ ناجح
// (المكوّن يُصرَّف، والشاشة تبقى فارغة).
//
// لا شبكة هنا: jsdom لا يحمّل الصور ولا الإطارات، ونتحكّم في `naturalWidth`
// وحدثي `load`/`error` يدوياً لنمثّل الحالات الثلاث.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:5173',
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.Event = dom.window.Event;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
dom.window.localStorage.setItem('masahati_lang', 'ar');

import React from 'react';

const { createRoot } = await import('react-dom/client');
const { createServer } = await import('vite');

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
  if (!ok && detail !== undefined) console.log(`   → ${detail}`);
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});
const { default: DocViewer } = await server.ssrLoadModule('/src/features/admin/DocViewer.jsx');

const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => {
  await flush();
  await flush();
  await flush();
};

const DOCS = {
  image: {
    kind: 'proof',
    label: 'إثبات الملكية',
    name: 'عقد-الإيجار.jpg',
    url: 'https://res.cloudinary.com/demo/image/upload/documents/lease.jpg',
    uploadedAt: '2026-10-01T10:00:00Z',
  },
  pdf: {
    kind: 'license',
    label: 'رخصة البلدية',
    name: 'license.pdf',
    url: 'https://res.cloudinary.com/demo/raw/upload/documents/license.pdf',
    uploadedAt: '2026-10-02T10:00:00Z',
  },
  office: {
    kind: 'deed',
    label: 'سند الملكية',
    name: 'deed.docx',
    url: 'https://res.cloudinary.com/demo/raw/upload/documents/deed.docx',
    uploadedAt: '2026-10-03T10:00:00Z',
  },
};

/**
 * يركّب العارض كما يُركّب في شاشة المساحات: مفتاحٌ على المستند الحالي،
 * فلا يرث المستند الجديد تكبيرَ سابقه.
 */
function mount(docs, { onClose = () => {} } = {}) {
  const host = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  function Harness() {
    const [index, setIndex] = React.useState(0);
    const doc = docs[index];
    return React.createElement(DocViewer, {
      key: `${index}:${doc?.url}`,
      docs,
      index,
      onIndexChange: setIndex,
      onClose,
    });
  }

  root.render(React.createElement(Harness));
  return { host, root, unmount: () => root.unmount() };
}

const q = (host, sel) => host.querySelector(sel);
const qa = (host, sel) => Array.from(host.querySelectorAll(sel));
const click = (el) => el?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

// ---------------------------------------------------------------- صورة
console.log('\n===== DocViewer: صورة =====');
let view = mount([DOCS.image]);
await settle();

report('D1 image doc renders the image itself', !!q(view.host, '[data-doc-image]'), 'no [data-doc-image]');
report(
  'D2 image viewer reports its type for tests/CSS',
  q(view.host, '[data-doc-viewer]')?.getAttribute('data-doc-viewer-type') === 'image',
  `type=${q(view.host, '[data-doc-viewer]')?.getAttribute('data-doc-viewer-type')}`
);
report(
  'D3 document name and label are shown in the top bar',
  view.host.textContent.includes('عقد-الإيجار.jpg') && view.host.textContent.includes('إثبات الملكية'),
  view.host.textContent.slice(0, 120)
);
report('D4 body scroll is locked while the viewer is open', dom.window.document.body.classList.contains('no-scroll'), 'no-scroll class absent');
report('D5 zoom starts at 100%', q(view.host, '[data-doc-zoom]')?.textContent.trim() === '100%', q(view.host, '[data-doc-zoom]')?.textContent);
report(
  'D6 zoom-out is available at 100% (fit is not the floor)',
  q(view.host, '[data-doc-zoom-out]')?.disabled === false,
  'zoom-out disabled at fit'
);

click(q(view.host, '[data-doc-zoom-out]'));
await settle();
report('D6b zoom-out below fit yields 75%', q(view.host, '[data-doc-zoom]')?.textContent.trim() === '75%', q(view.host, '[data-doc-zoom]')?.textContent);
click(q(view.host, '[data-doc-zoom-reset]'));
await settle();

click(q(view.host, '[data-doc-zoom-in]'));
await settle();
report('D7 zoom-in raises the readout to 125%', q(view.host, '[data-doc-zoom]')?.textContent.trim() === '125%', q(view.host, '[data-doc-zoom]')?.textContent);

click(q(view.host, '[data-doc-zoom-reset]'));
await settle();
report('D8 reset returns to 100%', q(view.host, '[data-doc-zoom]')?.textContent.trim() === '100%', q(view.host, '[data-doc-zoom]')?.textContent);
report('D9 reset is disabled while already at 100%', q(view.host, '[data-doc-zoom-reset]')?.disabled === true, 'reset enabled at 100%');

// الحدّ الأدنى: أربع نقرات تصغير من 100% تصل إلى 25% وتتوقف.
click(q(view.host, '[data-doc-zoom-in]'));
await settle();
for (let i = 0; i < 5; i++) click(q(view.host, '[data-doc-zoom-out]'));
await settle();
report('D10 zoom never drops below 25%', q(view.host, '[data-doc-zoom]')?.textContent.trim() === '25%', q(view.host, '[data-doc-zoom]')?.textContent);
report('D11 zoom-out button is disabled at the floor', q(view.host, '[data-doc-zoom-out]')?.disabled === true, 'not disabled at 25%');

// صورة مكسورة: لا مربّع فارغ، بل بطاقة صريحة بالطريق البديل.
const img = q(view.host, '[data-doc-image]');
img.dispatchEvent(new dom.window.Event('error'));
await settle();
report('D12 broken image falls back to an explicit card', !!q(view.host, '[data-doc-fallback]'), 'no fallback after error');
report(
  'D13 fallback keeps open/download escape hatches',
  qa(view.host, '[data-doc-fallback] a').length === 2,
  `links=${qa(view.host, '[data-doc-fallback] a').length}`
);

let closed = 0;
view.unmount();
await settle();
report('D14 unmount releases the scroll lock', !dom.window.document.body.classList.contains('no-scroll'), 'no-scroll left behind');

// ---------------------------------------------------------------- PDF
console.log('\n===== DocViewer: PDF =====');
view = mount([DOCS.pdf], { onClose: () => { closed++; } });
await settle();

report('D15 PDF doc renders an embedded frame, not an image', !!q(view.host, '[data-doc-frame]') && !q(view.host, '[data-doc-image]'), 'frame/image mismatch');
report(
  'D16 embedded frame points at the document URL',
  q(view.host, '[data-doc-frame]')?.getAttribute('src')?.endsWith('/license.pdf'),
  q(view.host, '[data-doc-frame]')?.getAttribute('src')
);
report('D17 zoom controls are hidden for PDF (browser handles it)', !q(view.host, '[data-doc-zoom-in]'), 'zoom buttons shown for PDF');

dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
await settle();
report('D18 Escape closes the viewer', closed === 1, `onClose called ${closed} times`);

view.unmount();
await settle();

// ---------------------------------------------------------------- Office
console.log('\n===== DocViewer: Word/Excel =====');
view = mount([DOCS.office]);
await settle();

report('D19 office doc explains it cannot be previewed inline', !!q(view.host, '[data-doc-fallback]'), 'no fallback');
report(
  'D20 office fallback offers open + download',
  qa(view.host, '[data-doc-fallback] a').length === 2,
  `links=${qa(view.host, '[data-doc-fallback] a').length}`
);
report(
  'D21 download link carries the file name',
  q(view.host, '[data-doc-download]')?.getAttribute('download') === 'deed.docx',
  q(view.host, '[data-doc-download]')?.getAttribute('download')
);

view.unmount();
await settle();

// ------------------------------------------------- النقل بين المستندات
console.log('\n===== DocViewer: التنقل =====');
view = mount([DOCS.image, DOCS.pdf, DOCS.office]);
await settle();

report('D22 multiple docs render a navigation strip', qa(view.host, '.docv__thumb').length === 3, `thumbs=${qa(view.host, '.docv__thumb').length}`);
report('D23 counter shows position within the set', view.host.textContent.includes('1/3'), view.host.textContent.slice(0, 140));
report('D24 first thumbnail is the active tab', q(view.host, '.docv__thumb')?.getAttribute('aria-selected') === 'true', 'first thumb not selected');

click(qa(view.host, '.docv__thumb')[1]);
await settle();
report('D25 clicking a thumbnail switches to that document', !!q(view.host, '[data-doc-frame]') && view.host.textContent.includes('2/3'), view.host.textContent.slice(0, 140));
report(
  'D26 switching documents resets zoom instead of inheriting it',
  q(view.host, '[data-doc-zoom]') == null,
  'zoom readout survived a PDF switch'
);

click(qa(view.host, '.docv__thumb')[0]);
await settle();
click(q(view.host, '[data-doc-zoom-in]'));
await settle();
click(qa(view.host, '.docv__thumb')[2]);
await settle();
click(qa(view.host, '.docv__thumb')[0]);
await settle();
report(
  'D27 returning to the image shows 100%, not the previous 125%',
  q(view.host, '[data-doc-zoom]')?.textContent.trim() === '100%',
  q(view.host, '[data-doc-zoom]')?.textContent
);

view.unmount();
await settle();

// --------------------------------------------------- شريط أدوات الحالة
console.log('\n===== DocViewer: أدوات الوثيقة =====');
view = mount([DOCS.image]);
await settle();

report(
  'D28 open-in-new-tab and download are always available',
  !!q(view.host, '[data-doc-open]') && !!q(view.host, '[data-doc-download]'),
  'missing escape hatches'
);
report(
  'D29 open-in-new-tab targets the document securely',
  q(view.host, '[data-doc-open]')?.getAttribute('rel')?.includes('noopener') === true,
  q(view.host, '[data-doc-open]')?.getAttribute('rel')
);
report('D30 viewer is a labelled modal dialog', q(view.host, '[data-doc-viewer]')?.getAttribute('aria-modal') === 'true' && !!q(view.host, '[data-doc-viewer]')?.getAttribute('aria-label'), 'dialog semantics missing');
report('D31 close button is present for pointer users', !!q(view.host, '[data-doc-close]'), 'close button missing');

view.unmount();
await settle();

await server.close();

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (fail) {
  console.log('Failures:');
  failures.forEach((f) => console.log(` - ${f}`));
  process.exit(1);
}
