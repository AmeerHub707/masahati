// ===== منطق ترتيب المساحات في صفحة المقارنة =====
// وحدة مستقلة بلا React ولا JSX، ليبقى قابلاً للاختبار مباشرة في Node.
// مبدآن يحكمان كل ما يلي:
//  1) التطبيع يتم على مستوى الكتالوج كله، لا على المساحات المختارة فقط،
//     وإلا تغيّر ترتيب المساحات وترتيب الأعمدة كلما أضاف المستخدم مساحة جديدة.
//  2) التوزيع اللوغاريتمي للمقاييس ذات الذيل الطويل (السعر لكل شخص والسعة)،
//     لأن النطاق فيها يبلغ 29 ضعفاً و75 ضعفاً على التوالي، فالتطبيع الخطي
//     يسحق كل المساحات عدا اثنتين فوق حدّ الـ 90٪ ولا يميّز بينها.

const EPS = 1e-9;

export const SCORE_WEIGHTS = {
  perHead: 0.3,
  rating: 0.3,
  reviews: 0.15,
  amenities: 0.15,
  capacity: 0.1,
};

/** السعر لكل شخص، أو null إذا تعذّر حسابه (سعر أو سعة صفرية). */
export function pricePerHead(space) {
  const price = Number(space?.price_per_hour) || 0;
  const capacity = Number(space?.capacity) || 0;
  if (price <= 0 || capacity <= 0) return null;
  return price / capacity;
}

/** مدى لوغاريتمي جاهز لإعادة الاستخدام. */
function logRange(values) {
  const vs = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!vs.length) return { min: 0, max: 0, lo: 0, span: 0, empty: true };
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const lo = Math.log(min);
  return { min, max, lo, span: Math.max(EPS, Math.log(max) - lo), empty: false };
}

/** تطبيع لوغاريتمي: الأكبر = 1. */
function logNorm(range, value) {
  if (!range || range.empty) return 0;
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(1, Math.max(0, (Math.log(v) - range.lo) / range.span));
}

/** تطبيع لوغاريتمي معكوس: الأصغر = 1. */
function logNormInv(range, value) {
  if (!range || range.empty) return 0;
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - (Math.log(v) - range.lo) / range.span));
}

/** يبني سياق التطبيع من الكتالوج كاملاً. */
export function buildCompareContext(spaces) {
  const list = (Array.isArray(spaces) ? spaces : []).filter(Boolean);
  const amenityCounts = list.map((s) => (Array.isArray(s?.amenities) ? s.amenities.length : 0));
  return {
    perHead: logRange(list.map(pricePerHead)),
    capacity: logRange(list.map((s) => Number(s?.capacity) || 0)),
    reviews: logRange(list.map((s) => Number(s?.review_count) || 0)),
    maxAmenities: Math.max(1, ...amenityCounts),
  };
}

/** مؤشر القيمة 0-100. لا يعتمد على مجموعة المقارنة إطلاقاً. */
export function scoreSpace(space, ctx) {
  const rating = Math.max(0, Math.min(5, Number(space?.rating) || 0));
  const amenities = Array.isArray(space?.amenities) ? space.amenities.length : 0;
  const score =
    SCORE_WEIGHTS.perHead * logNormInv(ctx?.perHead, pricePerHead(space)) +
    SCORE_WEIGHTS.rating * (rating / 5) +
    SCORE_WEIGHTS.reviews * logNorm(ctx?.reviews, Number(space?.review_count) || 0) +
    SCORE_WEIGHTS.amenities * (amenities / (ctx?.maxAmenities || 1)) +
    SCORE_WEIGHTS.capacity * logNorm(ctx?.capacity, Number(space?.capacity) || 0);
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}

/**
 * يقيّم كل المساحات مع الحفاظ على ترتيب المستخدم.
 * لا نعيد الترتيب عمداً: الترتيب يبقى ملكاً للمستخدم ويحفظ في الرابط،
 * حتى لا تقفز الأعمدة تحت يده كلما أضاف مساحة أو غيّر المجموعة.
 */
export function scoreAll(spaces, ctx) {
  const scored = (spaces || []).map((space) => ({ space, score: scoreSpace(space, ctx) }));
  if (!scored.length) return [];
  const top = Math.max(...scored.map((x) => x.score));
  let claimed = false;
  return scored.map((x) => {
    const isWinner = !claimed && x.score === top;
    if (isWinner) claimed = true;
    return { ...x, isWinner };
  });
}

/** ترتيب تنازلي منفصل، يُستخدم للوحة الترتيب فقط ولا يمسّ ترتيب العرض. */
export function byScoreDesc(scored) {
  return [...scored].sort((a, b) => b.score - a.score);
}

/**
 * يوزّع أرقام صف واحد على المدى 0..1 داخل الصف نفسه.
 * هذه هي الإصلاح الأساسي: التطبيع على مدى الصف يملأ كل صف بالكامل،
 * فلا تستطيع قاعة لأربعة أشخاص أن تُرسم بارتفاع قاعة لثمانية عشر.
 */
export function normalizeRow(values, { log = false, lowerIsBetter = false } = {}) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return values.map(() => 0);
  const source = log ? finite.filter((v) => v > 0) : finite;
  if (!source.length) return values.map(() => 0);
  const min = log ? Math.log(Math.min(...source)) : Math.min(...source);
  const max = log ? Math.log(Math.max(...source)) : Math.max(...source);
  if (max - min <= EPS) return values.map(() => 1);
  const span = max - min;
  return values.map((v) => {
    if (!Number.isFinite(v)) return 0;
    let t;
    if (log) {
      if (v <= 0) return lowerIsBetter ? 1 : 0;
      t = (Math.log(v) - min) / span;
    } else {
      t = (v - min) / span;
    }
    t = Math.min(1, Math.max(0, t));
    return lowerIsBetter ? 1 - t : t;
  });
}

/** يكشف القيم المتطابقة في الصف، ليُخفى الصف في وضع "الفروق فقط". */
export function rowHasDifference(values) {
  const finite = values.filter((v) => v != null && v !== '');
  if (finite.length < 2) return true;
  const first = String(typeof finite[0] === 'object' ? JSON.stringify(finite[0]) : finite[0]);
  return finite.some((v) => String(typeof v === 'object' ? JSON.stringify(v) : v) !== first);
}
