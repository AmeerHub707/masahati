import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost:5173' });
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
  matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  dispatchEvent() { return false; },
}));

import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
const { createRoot } = await import('react-dom/client');
const { createServer } = await import('vite');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const api = await server.ssrLoadModule('/src/lib/api.js');
const BASE = api.BASE_URL;

api.setToken('tok-ui-test');
api.setUser({ name: 'كرم', role: 'space_owner' });

const routes = {
  'GET /api/owner/spaces': { status: 200, body: { data: [{ space_id: 12, title: 'قاعة العروض الكبرى', description: 'قاعة واسعة', location: 'وسط المدينة', price_per_hour: 150, capacity: 120, amenities: ['internet', 'ac'], internet: true, is_active: true, rating: 4.8 }] } },
  'GET /api/owner/offers': { status: 200, body: { data: [] } },
  'GET /api/special-requests/open': { status: 200, body: { data: { requests: [] } } },
  'GET /api/owner/bookings': { status: 200, body: [] },
  'GET /api/profile': { status: 200, body: { name: 'كرم', email: 'k@k.com', phone: '+970' } },
};
globalThis.fetch = async (url, opts = {}) => {
  const method = (opts.method || 'GET').toUpperCase();
  const path = String(url).replace(BASE, '').split('?')[0];
  const r = routes[`${method} ${path}`] || { status: 404, body: { message: 'nf' } };
  return {
    ok: r.status < 400,
    status: r.status,
    async json() { return r.body; },
    async text() { return JSON.stringify(r.body); },
  };
};

const flush = () => new Promise((res) => setTimeout(res, 0));

const SpaceOwnerDashboard = (await server.ssrLoadModule('/src/pages/SpaceOwnerDashboard.jsx')).default;
const ownerEl = dom.window.document.createElement('div');
dom.window.document.body.appendChild(ownerEl);
const root = createRoot(ownerEl);
root.render(
  React.createElement(MemoryRouter, { initialEntries: ['/dashboard/space-owner'] },
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/dashboard/space-owner', element: React.createElement(SpaceOwnerDashboard) }),
    ),
  ),
);

async function waitFor(txt, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await flush();
    const content = ownerEl.querySelector('.odash__content')?.textContent || ownerEl.textContent;
    if (content.includes(txt)) return true;
  }
  return false;
}
async function clickBy(txt) {
  const nodes = Array.from(ownerEl.querySelectorAll('button, a, [role=button], li, span'));
  const el = nodes.find((n) => (n.textContent || '').trim() === txt || (n.textContent || '').includes(txt));
  if (!el) return console.log(`clickBy(${txt}) -> NOT FOUND`);
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await flush(); await flush();
  return console.log(`clickBy(${txt}) -> clicked (${el.tagName} .${el.className})`);
}

await waitFor('.odash__side');
console.log('--- mounted, active view:');
console.log('   has .odash__chart (overview):', !!ownerEl.querySelector('.odash__chart'));
await clickBy('المالية');
console.log('   financials stats:', await waitFor('إيرادات الفواتير'));
await clickBy('تقرير الأداء');
console.log('   chart exists:', !!ownerEl.querySelector('.fin__chart'));
console.log('   مقارنة الأداء:', await waitFor('مقارنة الأداء'));
console.log('   chart-x texts:', Array.from(ownerEl.querySelectorAll('.odash__chart-x')).map((n) => n.textContent));
console.log('   --- all nodes containing مساحاتي:');
for (const n of Array.from(ownerEl.querySelectorAll('button, a, [role=button], li, span, h1, h2, h3, p, div'))) {
  if ((n.textContent || '').trim().includes('مساحاتي')) {
    console.log(`     <${n.tagName} class="${String(n.className).slice(0,60)}" text="${(n.textContent||'').trim().slice(0,40)}">`);
  }
}
await clickBy('مساحاتي');
await flush(); await flush();
console.log('--- after clicking مساحاتي:');
console.log('   .odash__spaces-add:', !!ownerEl.querySelector('.odash__spaces-add'));
console.log('   .obk__space count:', ownerEl.querySelectorAll('.obk__space').length);
console.log('   .fin__chart still:', !!ownerEl.querySelector('.fin__chart'));
console.log('   has ملا spaces content .msp__search:', !!ownerEl.querySelector('.msp__search'));
process.exit(0);