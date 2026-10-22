// اختبار تدفّق «معاينة المساحة» في لوحة الأدمن — React + jsdom.
//
// يحمي ثلاث نقاط لا يراها بناءٌ ناجح:
//   1. بطاقة المساحة تفتح نافذة المعاينة فعلياً (لا زرّ ميت).
//   2. المستندات تُجلب من نقطة المستندات وتظهر كبطاقاتٍ قابلة للنقر، والقرار
//      يبقى متاحاً حين يصل الدليل.
//   3. نقر بطاقة المستند يفتح العارض الكامل فوق النافذة، وإغلاقه يعيدنا إلى
//      نافذة المساحة نفسها (لا إلى الشاشة) — وهذا جوهر «المراجعة قبل القرار».
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html lang="ar" dir="rtl"><body></body></html>', {
  url: 'http://localhost:5173',
  pretendToBeVisual: true,
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

// jsdom بلا مراقبي الأبعاد؛ المكوّنات تتجاوزهم إن غابوا، لكن نضع بديلاً
// صامتاً حتى لا يفشل أي استيرادٍ لاحق.
class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.ResizeObserver = StubObserver;
globalThis.IntersectionObserver = StubObserver;
dom.window.ResizeObserver = StubObserver;
dom.window.IntersectionObserver = StubObserver;
dom.window.matchMedia =
  dom.window.matchMedia ||
  (() => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }));

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

const api = await server.ssrLoadModule('/src/lib/adminApi.js');
const BASE = (await server.ssrLoadModule('/src/lib/api.js')).BASE_URL;

api.saveAdminSession({
  token: 'tok-admin-preview',
  admin: { name: 'أدمن الاختبار', role: 'admin' },
});

const SPACE = {
  id: 7,
  title: 'قاعة النور',
  location: 'رام الله',
  owner: 'سامر خليل',
  price_per_hour: 120,
  capacity: 40,
  status: 'pending',
  rating: 4.5,
  bookings_count: 3,
  image: 'https://res.cloudinary.com/demo/image/upload/spaces/cover.jpg',
};

const DOCS = [
  {
    id: 91,
    kind: 'proof',
    label: 'إثبات الملكية',
    name: 'عقد-الإيجار.jpg',
    url: 'https://res.cloudinary.com/demo/image/upload/documents/lease.jpg',
    uploaded_at: '2026-10-01 10:00:00',
    space_id: 7,
  },
  {
    id: 92,
    kind: 'proof',
    label: 'رخصة البلدية',
    name: 'license.pdf',
    url: 'https://res.cloudinary.com/demo/raw/upload/documents/license.pdf',
    uploaded_at: '2026-10-02 10:00:00',
    space_id: 7,
  },
];

const routes = {
  'GET /api/admin/spaces': { status: 200, body: { data: [SPACE], meta: { total: 1, last_page: 1 } } },
  'GET /api/admin/spaces/7': { status: 200, body: { data: SPACE } },
  'GET /api/admin/documents': {
    status: 200,
    body: { documents: DOCS, data: DOCS, meta: { total: DOCS.length, last_page: 1 } },
  },
};

globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  const path = String(url).replace(BASE, '').split('?')[0];
  const r = routes[`${method} ${path}`] || { status: 404, body: { message: 'not found' } };
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    text: async () => JSON.stringify(r.body),
  };
};

const { default: AdminSpaces } = await server.ssrLoadModule('/src/features/admin/Spaces.jsx');

const flush = () => new Promise((r) => setTimeout(r, 60));
const host = dom.window.document.createElement('div');
dom.window.document.body.appendChild(host);
const root = createRoot(host);
root.render(React.createElement(AdminSpaces));

async function waitFor(sel, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await flush();
    if (host.querySelector(sel)) return true;
  }
  return false;
}

async function waitForGone(sel, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await flush();
    if (!host.querySelector(sel)) return true;
  }
  return false;
}

const q = (sel) => host.querySelector(sel);
const qa = (sel) => Array.from(host.querySelectorAll(sel));
const click = (el) => el?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

console.log('\n===== Admin: فتح معاينة المساحة =====');
report('P1 spaces list renders the pending space', await waitFor('[data-space-card="7"]'), 'no [data-space-card="7"]');

click(q('[data-space-card="7"]'));
await flush();
report('P2 clicking the card opens the preview modal', !!q('.modal-box'), 'no modal');
report('P3 modal header carries the status badge', (q('.modal-box')?.textContent || '').includes('بانتظار التفعيل'), q('.modal-box')?.textContent?.slice(0, 80));

console.log('\n===== Admin: المستندات داخل المعاينة =====');
report('P4 documents arrive as clickable cards', await waitFor('[data-space-doc]'), 'no [data-space-doc]');
report('P5 every delivered document has a card', qa('[data-space-doc]').length === 2, `cards=${qa('[data-space-doc]').length}`);
report('P6 document cards keep their kind for tests/filters', qa('[data-space-doc]').every((el) => el.getAttribute('data-doc-kind') === 'property_deed'), qa('[data-space-doc]')[0]?.getAttribute('data-doc-kind'));
report('P7 decision buttons appear once evidence is in', !!q('[data-space-activate]') && !!q('[data-space-suspend]'), 'decision buttons missing');
report('P8 decisions are not reported as blocked while docs exist', !q('[data-space-decision-blocked]'), 'decision still blocked');
report(
  'P9 both open/close and edit actions live in the footer',
  !!q('.modal-box__foot') && q('.modal-box__foot').textContent.includes('تعديل البيانات'),
  '.modal-box__foot missing edit action'
);

console.log('\n===== Admin: العارض فوق نافذة المعاينة =====');
click(qa('[data-space-doc]')[0]);
await flush();
report('P10 clicking a document opens the full-screen viewer', !!q('[data-doc-viewer]'), 'no [data-doc-viewer]');
report('P11 viewer shows the image document inline', !!q('[data-doc-image]'), 'image viewer missing');
report('P12 the space preview stays mounted underneath', !!q('.modal-box') && !!q('[data-space-activate]'), 'modal unmounted behind viewer');
report('P13 viewer carries the document name', (q('[data-doc-viewer]')?.textContent || '').includes('عقد-الإيجار.jpg'), q('[data-doc-viewer]')?.textContent?.slice(0, 80));

click(q('[data-doc-close]'));
await flush();
report('P14 closing the viewer returns to the same space preview', await waitForGone('[data-doc-viewer]') && !!q('.modal-box') && !!q('[data-space-activate]'), 'back to the wrong screen');

// مستند ثانٍ من نفس النافذة: PDF داخل إطار.
click(qa('[data-space-doc]')[1]);
await flush();
report('P15 a second document opens its own viewer (PDF frame)', !!q('[data-doc-frame]'), 'no PDF frame');
report('P16 viewer can be navigated between the space documents', qa('.docv__thumb').length === 2, `thumbs=${qa('.docv__thumb').length}`);

dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
await flush();
report('P17 Escape closes only the viewer, not the preview modal', await waitForGone('[data-doc-viewer]') && !!q('.modal-box'), 'modal closed too');

const footerButtons = qa('.modal-box__foot button');
const closeBtn = footerButtons.find((b) => b.textContent.trim() === 'إغلاق');
click(closeBtn);
await flush();
report('P18 closing the preview returns to the list', await waitForGone('.modal-box'), 'modal still open');

root.unmount();
await server.close();

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (fail) {
  console.log('Failures:');
  failures.forEach((f) => console.log(` - ${f}`));
  process.exit(1);
}
