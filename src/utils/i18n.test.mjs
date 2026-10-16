// اختبار تكافؤ ملفات الترجمة (ar/en) — بلا React وبلا jsdom.
//
// السبب: الإعداد يستعمل returnEmptyString:false، فمفتاح ناقص في الإنجليزية
// لا يظهر كخطأ بل يسقط صامتاً على العربية. هذا الاختبار يحوّل ذلك الصمت إلى
// فشل واضح قبل الدمج، ويحرس أيضاً تطابق المتغيّرات ({{…}}) بين اللغتين لأن
// اختلافها يُنتج نصاً مشوّهاً في لغة دون الأخرى.
//
// ملاحظة: صيغ الجمع (zero/one/two/few/many/other) تختلف عدداً بين اللغات
// (العربية ستّ، الإنجليزية اثنتان) وهذا صحيح لا خطأ — لذلك نقارن «المفتاح
// الأساسي» بعد تجريد اللاحقة، ونجمع المتغيّرات عبر كل صيغه.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, '..', 'i18n', 'locales');

let pass = 0;
let fail = 0;
const failures = [];

function report(name, ok, detail) {
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push(detail ? `${name} — ${detail}` : name);
  }
}

const ok = (name, cond, detail) => report(name, Boolean(cond), detail);

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function namespaces(lang) {
  return readdirSync(join(localesDir, lang))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

// يبسّط الكائن إلى خريطة { "a.b.c": value } لتقارن الأوراق فقط.
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const PLURAL = /_(zero|one|two|few|many|other)$/;

// يجمع المفاتيح في مجموعات بحسب المفتاح الأساسي، مع كل صيغ الجمع المتوفّرة.
function groupByBase(flat) {
  const map = new Map();
  for (const [k, v] of Object.entries(flat)) {
    const m = k.match(PLURAL);
    const base = m ? k.slice(0, k.length - m[0].length) : k;
    if (!map.has(base)) map.set(base, { plural: false, forms: {} });
    const entry = map.get(base);
    if (m) entry.plural = true;
    entry.forms[m ? m[1] : ''] = v;
  }
  return map;
}

function placeholders(value) {
  const found = String(value).match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
  return found.map((p) => p.replace(/\s+/g, ''));
}

function unionPlaceholders(forms) {
  const set = new Set();
  for (const v of Object.values(forms)) for (const p of placeholders(v)) set.add(p);
  return [...set].sort();
}

const arNs = namespaces('ar');
const enNs = namespaces('en');

console.log('\n=====i18n locales=====');

// ----- تطابق أسماء مساحات الاسم بين اللغتين -----
ok(
  'L1 مساحات الاسم متطابقة بين ar و en',
  arNs.join(',') === enNs.join(','),
  `ar=[${arNs}] en=[${enNs}]`
);

let keyTotal = 0;

for (const ns of arNs) {
  let ar;
  let en;
  try {
    ar = groupByBase(flatten(readJson(join(localesDir, 'ar', `${ns}.json`))));
    en = groupByBase(flatten(readJson(join(localesDir, 'en', `${ns}.json`))));
  } catch (e) {
    report(`L2 ${ns} يُقرأ في اللغتين`, false, e.message);
    continue;
  }

  const arKeys = [...ar.keys()].sort();
  const enKeys = [...en.keys()].sort();
  keyTotal += arKeys.length;

  const missingInEn = arKeys.filter((k) => !en.has(k));
  const extraInEn = enKeys.filter((k) => !ar.has(k));

  ok(
    `L2 ${ns}: لا مفتاح ناقص في الإنجليزية`,
    missingInEn.length === 0,
    missingInEn.slice(0, 8).join(', ')
  );
  ok(
    `L3 ${ns}: لا مفتاح زائد في الإنجليزية`,
    extraInEn.length === 0,
    extraInEn.slice(0, 8).join(', ')
  );

  // ----- تطابق المتغيّرات ({{…}}) لكل مفتاح أساسي مشترك -----
  const mismatched = [];
  for (const key of arKeys) {
    if (!en.has(key)) continue;
    const a = unionPlaceholders(ar.get(key).forms).join('|');
    const b = unionPlaceholders(en.get(key).forms).join('|');
    if (a !== b) mismatched.push(`${key}: ar=[${a}] en=[${b}]`);
  }
  ok(
    `L4 ${ns}: المتغيّرات متطابقة بين اللغتين`,
    mismatched.length === 0,
    mismatched.slice(0, 5).join('  •  ')
  );

  // ----- المفتاح الجمعيّ يجب أن تكون له صيغة `other` على الأقل في كل لغة -----
  const badPlural = [];
  for (const [key, entry] of ar) {
    if (!entry.plural) continue;
    if (!('other' in entry.forms)) badPlural.push(`${key}(ar)`);
    const e = en.get(key);
    if (!e || !('other' in e.forms)) badPlural.push(`${key}(en)`);
  }
  ok(
    `L5 ${ns}: كل مفتاح جمعيّ يملك صيغة other`,
    badPlural.length === 0,
    badPlural.slice(0, 5).join(', ')
  );
}

// ----- لا نصوص إنجليزية فارغة (تُسقط على العربية بصمت) -----
const emptyEn = [];
for (const ns of enNs) {
  const en = flatten(readJson(join(localesDir, 'en', `${ns}.json`)));
  for (const [k, v] of Object.entries(en)) {
    if (typeof v === 'string' && v.trim() === '') emptyEn.push(`${ns}:${k}`);
  }
}
ok(
  'L6 لا قيم إنجليزية فارغة',
  emptyEn.length === 0,
  emptyEn.slice(0, 8).join(', ')
);

console.log(`\nإجمالي المفاتيح الأساسية العربية: ${keyTotal} عبر ${arNs.length} مساحة اسم`);
console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
