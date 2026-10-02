// Headless Edge driver over raw CDP (no puppeteer needed; Node 24 has fetch + WebSocket).
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
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
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        c.logs.push(msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        c.logs.push('EXC: ' + (msg.params.exceptionDetails.exception?.description
          || msg.params.exceptionDetails.text));
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
    const r = await this.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }
}

const userDir = mkdtempSync(join(tmpdir(), 'edge-cmp-'));

// Own the vite dev server from this process so it cannot die between steps.
const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], {
  cwd: process.cwd(), stdio: 'ignore', shell: true,
});
async function waitForServer(tries = 120) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch('http://localhost:5199/');
      if (r.ok) return;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('vite never came up on 5199');
}
await waitForServer();
console.log('vite up on 5199');

async function run(label, query, dark) {
  const child = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--hide-scrollbars',
    '--window-size=1440,1400',
    `http://localhost:5199/probe.html?q=${encodeURIComponent(query)}${dark ? '&dark=1' : ''}`,
  ], { stdio: 'ignore' });

  try {
    const list = await waitForJson(`http://127.0.0.1:${PORT}/json/list`);
    const page = list.find(t => t.type === 'page' && t.url.includes('probe.html'))
      || list.find(t => t.type === 'page');
    const cdp = await CDP.attach(page.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');

    // wait for the probe module to finish
    let done = null;
    for (let i = 0; i < 100; i++) {
      done = await cdp.eval('window.__done || null');
      if (done) break;
      await sleep(300);
    }
    if (!done) {
      console.log(`\n===== ${label} =====`);
      console.log('TIMED OUT waiting for window.__done');
      console.log(cdp.logs.join('\n'));
      return { bad: 1 };
    }
    console.log(`\n===== ${label} =====`);
    for (const l of done.log) console.log(l);
    return done;
  } finally {
    child.kill();
    await sleep(700);
  }
}

const results = [];
try {
  results.push(await run('DESKTOP 1440 light', '?sp=sp-6&sp=sp-10&sp=sp-1', false));
  results.push(await run('DESKTOP 1440 dark', '?sp=sp-6&sp=sp-10&sp=sp-1', true));
  results.push(await run('FOUR SLOTS (max)', '?sp=sp-6&sp=sp-10&sp=sp-1&sp=sp-2', false));
} finally {
  vite.kill();
}

console.log('\n===== SUMMARY =====');
let total = 0;
for (const r of results) total += r?.bad?.length ?? 1;
console.log(total === 0 ? 'ALL PROBES CLEAN' : `PROBLEMS FOUND: ${total}`);
process.exit(total === 0 ? 0 : 1);
