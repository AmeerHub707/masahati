// Interaction probe: does clicking move / remove actually mutate order in a REAL
// browser? Distinguishes an app race from a jsdom test-harness flake.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9224;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForJson(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('devtools endpoint never came up');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    const c = new CDP(ws);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) {
        const { resolve, reject } = c.pending.get(m.id);
        c.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
}

const userDir = mkdtempSync(join(tmpdir(), 'edge-move-'));
const vite = spawn('npx', ['vite', '--port', '5197', '--strictPort'], { cwd: process.cwd(), stdio: 'ignore', shell: true });
for (let i = 0; i < 160; i++) { try { const r = await fetch('http://localhost:5197/'); if (r.ok) break; } catch { /* not up yet */ } await sleep(250); }
console.log('vite up on 5197');

const child = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1440,900',
  'http://localhost:5197/shot.html?q=' + encodeURIComponent('?sp=sp-6&sp=sp-10&sp=sp-1'),
], { stdio: 'ignore' });

try {
  const list = await waitForJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = list.find((t) => t.type === 'page' && t.url.includes('shot.html')) || list.find((t) => t.type === 'page');
  const cdp = await CDP.attach(page.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  for (let i = 0; i < 80; i++) { if (await cdp.eval('window.__ready === true')) break; await sleep(250); }

  const order = `Array.from(document.querySelectorAll('.wb__slot:not(.wb__slot--empty) .wb__slot-name')).map(n=>n.textContent.trim())`;
  const urlIds = `Array.from(new URLSearchParams(location.search).getAll('sp'))`;

  console.log('\n=== move button (slot 2 -> position 1), 5 rounds ===');
  for (let i = 1; i <= 5; i++) {
    const before = await cdp.eval(order);
    const beforeIds = await cdp.eval(urlIds);
    // real trusted click through CDP Input, not el.click()
    const box = await cdp.eval(`(()=>{const b=document.querySelectorAll('.wb__slot-move')[1];const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,dis:b.disabled};})()`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await sleep(350);
    const after = await cdp.eval(order);
    const afterIds = await cdp.eval(urlIds);
    const changed = after[0] !== before[0];
    console.log(`round ${i}: disabled=${box.dis} changed=${changed}`);
    console.log(`   before: ${before.join(' | ')}`);
    console.log(`   after : ${after.join(' | ')}`);
    console.log(`   url   : [${beforeIds}] -> [${afterIds}]`);
  }

  console.log('\n=== chip remove, 3 rounds ===');
  for (let i = 1; i <= 3; i++) {
    const before = await cdp.eval(order);
    const box = await cdp.eval(`(()=>{const b=document.querySelector('.cmp-chip:not(.cmp-chip--add) .cmp-chip-x')||document.querySelector('.cmp-chip:not(.cmp-chip--add) button');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await sleep(350);
    const after = await cdp.eval(order);
    console.log(`round ${i}: ${before.length} -> ${after.length} slots`);
    if (after.length < before.length) break;
  }
} finally {
  child.kill();
  vite.kill();
}
console.log('\ndone');