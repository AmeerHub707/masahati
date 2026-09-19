import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd(), 'src');
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(n)) files.push(p);
  }
})(ROOT);

const pats = [
  ['register-route', /role\s*[:=]\s*['"]([A-Za-z0-9_-]+)['"]/g],
  ['owner-string', /['"](space[_ -]?owner|owner)['"]/g],
  ['register-fetch', /register(Owner|Customer)\(/g],
];

const found = new Set();
for (const f of files) {
  const t = readFileSync(f, 'utf8');
  for (const [label, re] of pats) {
    for (const m of t.matchAll(re)) {
      const g = m[1];
      if (!g) continue;
      const base = f.split(/[\\/]/).pop();
      found.add(`${label.padEnd(14)} ${g.padEnd(14)} <- ${base}`);
    }
  }
}
for (const s of [...found].sort()) console.log(s);
