// Screenshot probe: renders the real compare page headlessly and captures PNGs
// at several widths, light and dark, plus the numeric geometry of the hero.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9223;
const OUT = 'C:\\Users\\Karam\\AppData\\Local\\Temp\\opencode';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForJson(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('devtools endpoint never came up: ' + url);
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.logs = []; }
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
      } else if (m.method === 'Runtime.exceptionThrown') {
        c.logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
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

const userDir = mkdtempSync(join(tmpdir(), 'edge-shot-'));
const vite = spawn('npx', ['vite', '--port', '5198', '--strictPort'], {
  cwd: process.cwd(), stdio: 'ignore', shell: true,
});
async function waitForServer(tries = 160) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch('http://localhost:5198/'); if (r.ok) return; } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('vite never came up on 5198');
}
await waitForServer();
console.log('vite up on 5198');

const QUERY = '?sp=sp-6&sp=sp-10&sp=sp-1';

async function shot(label, width, height, dark) {
  const child = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    `--window-size=${width},${height}`,
    `http://localhost:5198/shot.html?q=${encodeURIComponent(QUERY)}${dark ? '&dark=1' : ''}`,
  ], { stdio: 'ignore' });

  try {
    const list = await waitForJson(`http://127.0.0.1:${PORT}/json/list`);
    const page = list.find((t) => t.type === 'page' && t.url.includes('shot.html')) || list.find((t) => t.type === 'page');
    const cdp = await CDP.attach(page.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    // Override BEFORE any load work, then reload, so media queries and
    // clamp()/vw units are computed against the real target width.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width < 768,
    });
    await cdp.send('Page.reload', {});

    let ready = false;
    for (let i = 0; i < 120; i++) {
      ready = await cdp.eval('window.__ready === true');
      if (ready) break;
      await sleep(250);
    }
    if (!ready) {
      console.log(`\n===== ${label} =====\nTIMED OUT`);
      console.log(cdp.logs.join('\n'));
      return;
    }
    // Let fonts settle so the Arabic text is not mid-swap in the capture.
    await cdp.eval('document.fonts.ready.then(()=>true)');
    await sleep(600);

    const geo = await cdp.eval('window.__geo');
    const png = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const file = join(OUT, label.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png');
    writeFileSync(file, Buffer.from(png.data, 'base64'));

    console.log(`\n===== ${label} (${width}x${height}) =====`);
    console.log(JSON.stringify(geo, null, 2));
    console.log('shots -> ' + file);
    if (cdp.logs.length) console.log('CONSOLE EXCEPTIONS:\n' + cdp.logs.join('\n'));
  } finally {
    child.kill();
    await sleep(800);
  }
}

try {
  await shot('hero-desktop-light', 1440, 900, false);
  await shot('hero-desktop-dark', 1440, 900, true);
  await shot('hero-mobile-light', 390, 844, false);
  await shot('hero-tablet-light', 900, 700, false);
} finally {
  vite.kill();
}
console.log('\ndone');