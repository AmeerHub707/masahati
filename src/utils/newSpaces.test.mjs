// اختبارات وحدة لمنطق «المساحات الجديدة» — نافذة ٣ أيام منذ إضافة المساحة.
// تعمل في Node مباشرةً بلا jsdom وبلا شبكة، لأن newSpaces.js وحدة نقية
// لا تستورد React ولا api.js (نفس مبدأ spaceFilters.test.mjs).
import {
  parseSpaceDate,
  isNewSpace,
  pickNewSpaces,
  NEW_SPACES_WINDOW_DAYS,
} from '../lib/newSpaces.js';

let pass = 0;
let fail = 0;
const failures = [];

function report(name, ok, detail) {
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push(name);
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok && detail !== undefined) console.log(`   → ${detail}`);
}

const eq = (name, actual, expected) =>
  report(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

// لحظة مرجعية ثابتة: ١٩ أكتوبر ٢٠٢٦ ظهراً بتوقيت غزة (+03:00).
const NOW = Date.parse('2026-10-19T12:00:00+03:00');
const DAY_MS = 24 * 60 * 60 * 1000;

// ----- parseSpaceDate -----
eq('P1 parses Laravel "YYYY-MM-DD HH:MM:SS" like its ISO twin',
  parseSpaceDate('2026-10-18 14:07:13'),
  Date.parse('2026-10-18T14:07:13'));
eq('P2 parses ISO 8601 with offset', parseSpaceDate('2026-10-18T14:07:13+03:00'), Date.parse('2026-10-18T14:07:13+03:00'));
eq('P3 empty string is null', parseSpaceDate(''), null);
eq('P4 null is null', parseSpaceDate(null), null);
eq('P5 garbage is null', parseSpaceDate('not-a-date'), null);
eq('P6 boolean is null (no fabricated dates)', parseSpaceDate(true), null);

// ----- isNewSpace -----
eq('N1 window constant is 3 days', NEW_SPACES_WINDOW_DAYS, 3);
eq('N2 created moments ago is new', isNewSpace({ created_at: '2026-10-19T11:00:00+03:00' }, NOW), true);
eq('N3 created 2 days ago is new', isNewSpace({ created_at: new Date(NOW - 2 * DAY_MS).toISOString() }, NOW), true);
report('N4 exactly 72h old is still new (inclusive boundary)',
  isNewSpace({ created_at: new Date(NOW - 3 * DAY_MS).toISOString() }, NOW) === true);
report('N5 one minute past 72h is no longer new',
  isNewSpace({ created_at: new Date(NOW - 3 * DAY_MS - 60_000).toISOString() }, NOW) === false);
eq('N6 missing date is never new', isNewSpace({}, NOW), false);
eq('N7 malformed date is never new', isNewSpace({ created_at: 'yesterday' }, NOW), false);
eq('N8 far-future date rejected (clock skew guard)',
  isNewSpace({ created_at: new Date(NOW + 2 * DAY_MS).toISOString() }, NOW), false);
eq('N9 future within 2h tolerance accepted',
  isNewSpace({ created_at: new Date(NOW + 60 * 60 * 1000).toISOString() }, NOW), true);

// ----- pickNewSpaces -----
const CATALOG = [
  { id: 1, created_at: new Date(NOW - 10 * DAY_MS).toISOString() }, // قديمة
  { id: 2, created_at: new Date(NOW - 1 * DAY_MS).toISOString() }, // جديدة
  { id: 3, created_at: 'بلا تاريخ' }, // تُستبعد
  { id: 4, created_at: new Date(NOW - 5 * DAY_MS).toISOString() }, // قديمة
  { id: 5, created_at: new Date(NOW - 30 * 60 * 1000).toISOString() }, // الأحدث
];
eq('S1 picks only spaces within the window',
  pickNewSpaces(CATALOG, { now: NOW }).map((s) => s.id), [5, 2]);
eq('S2 sorts newest first',
  pickNewSpaces(CATALOG, { now: NOW }).map((s) => s.id), [5, 2]);
eq('S3 respects the limit',
  pickNewSpaces(CATALOG, { now: NOW, limit: 1 }).map((s) => s.id), [5]);
eq('S4 non-array input is empty', pickNewSpaces(null, { now: NOW }), []);
eq('S5 empty catalog is empty', pickNewSpaces([], { now: NOW }), []);
// بيئة الاختبار الحقيقية: مساحة أُضيفت اليوم (١٨ أكتوبر ٢٠٢٦) تظهر،
// وأخرى من ١٦ أكتوبر تُستبعد إن تجاوزت ٧٢ ساعة.
eq('S6 real backend sample within window passes',
  pickNewSpaces([{ id: 4, created_at: '2026-10-18T14:07:13+03:00' }], { now: NOW }).map((s) => s.id), [4]);

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
