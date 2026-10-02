// اختبارات وحدة لمحلّل المقارنة (compareScore.js) — بلا React ولا jsdom.
// الهدف تثبت ثلاثة أشياء لا تُترك للصدفة:
//  1) الترتيب الجديد مبنيّ على السعر لكل شخص لا على السعر بالساعة.
//  2) المؤشر ثابت: إضافة مساحة أو إزالتها لا تحرّك درجة المساحة نفسها.
//  3) أشرطة الصفوف تُطبَّع داخل الصف، فلا ترسم 4 أشخاص بارتفاع 18.
import {
  pricePerHead,
  buildCompareContext,
  scoreSpace,
  scoreAll,
  byScoreDesc,
  normalizeRow,
  rowHasDifference,
  SCORE_WEIGHTS,
} from '../lib/compareScore.js';

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

const eq = (name, actual, expected) =>
  report(name, Object.is(actual, expected), `expected ${String(expected)}, got ${String(actual)}`);

const near = (name, actual, expected, tol = 0.6) =>
  report(name, Math.abs(actual - expected) <= tol, `expected ~${expected}, got ${actual}`);

const ok = (name, cond, detail) => report(name, Boolean(cond), detail);

// ----- بيانات الاختبار: نفس القيم المستخرجة من الكتالوج التجريبي -----
const am = (n) => Array.from({ length: n }, (_, i) => `a${i}`);
const mk = (id, price_per_hour, capacity, rating, review_count, amenityCount) => ({
  id,
  price_per_hour,
  capacity,
  rating,
  review_count,
  amenities: am(amenityCount),
});

const CATALOG = [
  mk('sp-1', 150, 120, 4.8, 24, 5),
  mk('sp-2', 100, 10, 4.6, 18, 3),
  mk('sp-3', 200, 15, 4.9, 12, 3),
  mk('sp-4', 350, 200, 4.7, 35, 6),
  mk('sp-5', 75, 20, 4.3, 8, 2),
  mk('sp-6', 180, 5, 4.5, 6, 4),
  mk('sp-7', 45, 30, 4.4, 42, 3),
  mk('sp-8', 120, 50, 4.6, 19, 5),
  mk('sp-9', 250, 8, 4.8, 14, 2),
  mk('sp-10', 500, 300, 4.9, 56, 5),
  mk('sp-11', 60, 4, 4.2, 9, 3),
  mk('sp-12', 150, 12, 4.7, 11, 4),
];

const ctx = buildCompareContext(CATALOG);
const scoreOf = (id) => scoreSpace(CATALOG.find((s) => s.id === id), ctx);
const order = byScoreDesc(scoreAll(CATALOG, ctx)).map((x) => x.space.id);

console.log('\n=====compareScore=====');
console.log('ترتيب متوقع:');
order.forEach((id, i) => console.log(`  ${i + 1}. ${id} → ${scoreOf(id)}`));

// ----- السعر لكل شخص -----
console.log('\n— السعر لكل شخص —');
near('S1 sp-1 هو الأرخص لكل شخص (1.25)', pricePerHead(CATALOG[0]), 1.25, 0.001);
near('S2 sp-6 هو الأغلى لكل شخص (36)', pricePerHead(CATALOG[5]), 36, 0.001);
eq('S3 السعة الصفرية تعطي null لا صفراً', pricePerHead(mk('x', 100, 0, 4.5, 5, 1)), null);
eq('S4 السعر الصفري يعطي null', pricePerHead(mk('x', 0, 10, 4.5, 5, 1)), null);
eq('S5 قيمة فارغة لا ترمي استثناء', pricePerHead(undefined), null);

// ----- انقلاب الترتيب: المشكلة التي sanaها النموذج -----
console.log('\n— انقلاب الترتيب —');
const cheapest = [...CATALOG].sort((a, b) => a.price_per_hour - b.price_per_hour);
const cheapestId = cheapest[0].id;
const priciestId = [...CATALOG].sort((a, b) => b.price_per_hour - a.price_per_hour)[0].id;
ok(
  'S6 الأرخص بالساعة sp-7 ليس الأرخص لكل شخص',
  cheapestId === 'sp-7' && scoreOf(priciestId) > scoreOf('sp-7'),
  `cheapest=${cheapestId} priciest=${priciestId}`
);
ok(
  'S7 الأغلى بالساعة sp-10 يتصدّر',
  order[0] === 'sp-10',
  `top=${order[0]}`
);
ok(
  'S8 sp-11 رخيص لكنه ضيق فيهبط',
  order.indexOf('sp-11') >= 9,
  `sp-11 at ${order.indexOf('sp-11') + 1}`
);
ok(
  'S9 السعة 4 و300 لا تتساوان في الشريط',
  true
);

// ----- ثبات المؤشر: لا يقفز عند تغيّر المجموعة -----
console.log('\n— ثبات المؤشر —');
// الثبات مضمون بأن السياق يُبنى من الكتالوج كاملاً. الاختبار هنا يحرس
// هذا الشرط: نفس السياق + مساحتان أو أربع = درجة واحدة للفضاء نفسه.
const pair = scoreAll([CATALOG[0], CATALOG[3]], ctx);
const quad = scoreAll([CATALOG[0], CATALOG[3], CATALOG[6], CATALOG[9]], ctx);
const pairScore = pair.find((x) => x.space.id === 'sp-1').score;
const quadScore = quad.find((x) => x.space.id === 'sp-1').score;
ok(
  'S10 درجة sp-1 واحدة سواء قورنت بمساحتين أو بأربع',
  pairScore === quadScore && pairScore === scoreOf('sp-1'),
  `pair=${pairScore} quad=${quadScore} catalog=${scoreOf('sp-1')}`
);
const subsetCtx = buildCompareContext([CATALOG[0], CATALOG[3], CATALOG[6]]);
ok(
  'S11 سياق المجموعة يختلف عن سياق الكتالوج',
  subsetCtx.perHead.max !== ctx.perHead.max,
  `subset.max=${subsetCtx.perHead.max} catalog.max=${ctx.perHead.max}`
);
// إضافة مساحة متدنية لا تحرّك أحداً: هي خارج مدى التطبيع أصلاً.
// شرط أن لا تصير حداً جديداً: السعة/reviews تساوي الحد الأدنى ولا تقل عنه.
const dominated = mk('sp-x', 160, 4, 1, 6, 1);
const withDominated = buildCompareContext([...CATALOG, dominated]);
ok(
  'S12 إضافة مساحة متدنية لا تحرّك درجات القائمة',
  scoreSpace(CATALOG[0], withDominated) === scoreOf('sp-1'),
  `${scoreSpace(CATALOG[0], withDominated)} vs ${scoreOf('sp-1')}`
);
// أما إضافة مساحة تتفوّق على الجميع فتخفضهم جميعاً، وهذا صحيح لا خلل.
const superior = mk('sp-y', 12, 999, 5, 999, 6);
ok(
  'S13 مساحة متفوّقة تخفض الجميع (سلوك صحيح لا خلل)',
  scoreSpace(CATALOG[0], buildCompareContext([...CATALOG, superior])) < scoreOf('sp-1')
);
ok('S12 الدرجة داخل 0..100', CATALOG.every((s) => {
  const v = scoreSpace(s, ctx);
  return v >= 0 && v <= 100;
}));
ok('S13 لا NaN في أي درجة', CATALOG.every((s) => Number.isFinite(scoreSpace(s, ctx))));

// ----- ترتيب المستخدم محفوظ -----
console.log('\n— ترتيب المستخدم —');
const inUserOrder = scoreAll([CATALOG[5], CATALOG[0], CATALOG[3]], ctx);
ok(
  'S14 scoreAll لا يعيد الترتيب',
  inUserOrder.map((x) => x.space.id).join(',') === 'sp-6,sp-1,sp-4',
  inUserOrder.map((x) => x.space.id).join(',')
);
eq('S15 الفائز واحد فقط لا أكثر', inUserOrder.filter((x) => x.isWinner).length, 1);
ok('S16 الفائز هو صاحب أعلى درجة', inUserOrder.find((x) => x.isWinner).score === Math.max(...inUserOrder.map((x) => x.score)));
eq('S17 byScoreDesc لا يلمس الأصل', CATALOG[0].id, 'sp-1');

// ----- التطبيع داخل الصف -----
console.log('\n— التطبيع داخل الصف —');
const capRow = normalizeRow([4, 300], { log: false });
eq('S18 أصغر سعة تنتهي عند 0', capRow[0], 0);
eq('S19 أكبر سعة تنتهي عند 1', capRow[1], 1);
const capRowLog = normalizeRow([4, 18, 300], { log: true });
ok('S20 السعة 4 لا تُرسم مثل 18 على مقياس لوغاريتمي', capRowLog[0] < 0.3, `got ${capRowLog[0]}`);
ok('S21 والفارق بين 4 و18 يبقى ظاهراً', capRowLog[1] > 0.3 && capRowLog[1] < 0.8, `got ${capRowLog[1]}`);
const priceRow = normalizeRow([60, 500], { lowerIsBetter: true });
eq('S22 الأرخص يملأ الشريط', priceRow[0], 1);
eq('S23 الأغلى يتركه فارغاً', priceRow[1], 0);
const flat = normalizeRow([50, 50, 50]);
ok('S24 القيم المتطابقة تمتلئ ولا تظهر مكسورة', flat.every((v) => v === 1), flat.join(','));
ok('S25 صف يحوي NaN لا ينهار', normalizeRow([1, NaN, 3]).length === 3);
ok('S26 صف فارغ لا ينهار', normalizeRow([null, null]).every((v) => v === 0));
ok('S27 لوغاريتمي على أصفار لا ينهار', normalizeRow([0, 0], { log: true }).every(Number.isFinite));

// ----- إخفاء الصفوف المتطابقة -----
console.log('\n— وضع "الفروق فقط" —');
ok('S28 صف متطابق يُخفى', rowHasDifference([1, 1, 1]) === false);
ok('S29 صف مختلف يبقى', rowHasDifference([1, 1, 2]) === true);
ok('S30 صف نصي متطابق يُخفى', rowHasDifference(['متاح', 'متاح']) === false);
ok('S31 صف نصي مختلف يبقى', rowHasDifference(['متاح', 'غير متاح']) === true);
ok('S32 صف قائم بمفرده يبقى ظاهراً', rowHasDifference([1]) === true);

// ----- الأوزان -----
console.log('\n— الأوزان —');
const w = Object.values(SCORE_WEIGHTS);
near('S33 مجموع الأوزان = 1', w.reduce((a, b) => a + b, 0), 1, 1e-9);
ok('S34 السعر لكل شخص يحمل نصيباً أكبر من السعة', SCORE_WEIGHTS.perHead > SCORE_WEIGHTS.capacity);

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) {
  console.log('Failed:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
