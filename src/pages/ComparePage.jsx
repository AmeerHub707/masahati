import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Star, Users, TrendingUp, Wallet, Crown, Trophy,
  Search, X, Building2, Sparkles, CalendarCheck2, Gauge, Award, Scale, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { loadAllSpacesWithFallback, SPACE_CATEGORIES } from '../lib/spaces';
import { AMENITY_LABELS } from '../lib/requests';
import { fmtNumber, fmtRating } from '../lib/format';

const MAX_PICK = 4;
const MIN_PICK = 2;

const catLabel = (id) => (SPACE_CATEGORIES.find((c) => c.id === id) || {}).label || '';

// ----- مؤشر القيمة الإجمالي (0-100) ضمن المقارنة الحالية -----
function valueScore(s, ctx) {
  const price = s.price_per_hour || 0;
  const rating = s.rating || 0;
  const capacity = s.capacity || 0;
  const occupancy = s.stats?.occupancy ?? 0;
  const amenities = (s.amenities || []).length;
  const reviews = s.review_count || 0;
  const range = Math.max(1, ctx.maxPrice - ctx.minPrice);
  const priceInv = 1 - (price - ctx.minPrice) / range;
  const ratingNorm = rating / 5;
  const capacityNorm = ctx.maxCapacity > 0 ? capacity / ctx.maxCapacity : 0;
  const occupancyNorm = occupancy / 100;
  const amenityNorm = ctx.totalAmenities > 0 ? amenities / ctx.totalAmenities : 0;
  const reviewsNorm = ctx.maxReviews > 0 ? Math.min(1, reviews / ctx.maxReviews) : 0;
  const score =
    0.28 * ratingNorm +
    0.22 * priceInv +
    0.16 * capacityNorm +
    0.16 * occupancyNorm +
    0.1 * amenityNorm +
    0.08 * reviewsNorm;
  return Math.round(score * 100);
}

function buildContext(spaces) {
  const prices = spaces.map((s) => s.price_per_hour || 0);
  const allAmenityKeys = new Set();
  spaces.forEach((s) => (s.amenities || []).forEach((a) => allAmenityKeys.add(a)));
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    maxCapacity: Math.max(...spaces.map((s) => s.capacity || 0)),
    maxReviews: Math.max(...spaces.map((s) => s.review_count || 0)),
    maxOccupancy: Math.max(...spaces.map((s) => s.stats?.occupancy ?? 0)),
    minOccupancy: Math.min(...spaces.map((s) => s.stats?.occupancy ?? 0)),
    totalAmenities: allAmenityKeys.size,
  };
}

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const [allSpaces, setAllSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadAllSpacesWithFallback()
      .then((res) => {
        if (!alive) return;
        setAllSpaces(res.spaces || []);
        setDemo(res.demo);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const selectedIds = useMemo(() => params.getAll('sp'), [params]);

  const selectable = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSpaces;
    return allSpaces.filter((s) =>
      `${s.title} ${s.location} ${s.area} ${catLabel(s.category)}`.toLowerCase().includes(q)
    );
  }, [allSpaces, query]);

  const selected = useMemo(() => {
    const map = new Map(allSpaces.map((s) => [String(s.id), s]));
    return selectedIds.map((id) => map.get(String(id))).filter(Boolean);
  }, [allSpaces, selectedIds]);

  const ctx = useMemo(() => (selected.length >= MIN_PICK ? buildContext(selected) : null), [selected]);
  const ranked = useMemo(() => {
    if (!ctx) return [];
    return selected
      .map((s) => ({ space: s, score: valueScore(s, ctx) }))
      .sort((a, b) => b.score - a.score);
  }, [selected, ctx]);

  const toggle = (id) => {
    const has = selectedIds.includes(String(id));
    if (has) {
      setParams(selectedIds.filter((x) => x !== String(id)).map((x) => ['sp', x]));
    } else if (selectedIds.length < MAX_PICK) {
      setParams([...selectedIds, String(id)].map((x) => ['sp', x]));
    }
  };

  const clearAll = () => setParams([]);

  return (
    <div className="min-h-screen font-['Cairo'] compare-page">
      <div className="wrap wrap--wide compare">
        <Link to="/spaces" className="ad-details__back">
          <ChevronRight size={18} />
          العودة للتصفح
        </Link>
        <header className="compare__head">
          <span className="compare__eyebrow">مقارنة المساحات</span>
          <h1 className="compare__title">قارن بين المساحات واختر الأنسب</h1>
          <p className="compare__subtitle">
            اختر من {fmtNumber(2)} إلى {fmtNumber(MAX_PICK)} مساحات لعرض المخططات والإحصاءات جنباً إلى جنب
            {demo && <em className="compare__demo-badge">وضع تجريبي</em>}
          </p>
        </header>

        {/* أداة الاختيار */}
        <section className="compare__picker" aria-label="اختيار المساحات للمقارنة">
          <div className="compare__picker-top">
            <div className="compare__search">
              <Search className="compare__search-icon" size={17} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بالاسم، المنطقة، أو النوع..."
                aria-label="البحث في المساحات"
              />
              {query && (
                <button type="button" className="compare__search-clear" onClick={() => setQuery('')} aria-label="مسح البحث">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="compare__counter">
              <span className={`compare__counter-dot${selected.length >= MIN_PICK ? ' is-ok' : ''}`} />
              <b>{fmtNumber(selected.length)}</b> <small>/ {fmtNumber(MAX_PICK)}</small>
            </div>
            {selected.length > 0 && (
              <button type="button" className="btn-ghost compare__clear" onClick={clearAll}>
                <X size={15} /> مسح الكل
              </button>
            )}
          </div>

          {loading ? (
            <div className="compare__chips is-loading">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="compare__chip-skeleton" />
              ))}
            </div>
          ) : (
            <div className="compare__chips">
              {selectable.map((s) => {
                const isOn = selectedIds.includes(String(s.id));
                const locked = isOn ? false : selectedIds.length >= MAX_PICK;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`compare__chip${isOn ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
                    onClick={() => toggle(s.id)}
                    aria-pressed={isOn}
                    disabled={locked}
                    title={s.title}
                  >
                    <span className="compare__chip-check">{isOn && <Check size={13} />}</span>
                    <span className="compare__chip-icon"><Building2 size={16} /></span>
                    <span className="compare__chip-name">{s.title}</span>
                    <span className="compare__chip-meta">{fmtNumber(s.price_per_hour)} ش.ج | {catLabel(s.category)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selected.length === 0 && !loading && (
          <div className="compare__empty">
            <div className="compare__empty-icon"><Scale size={44} /></div>
            <h3>اختر مساحات لتقارنها</h3>
            <p>اختر مساحتين على الأقل من القائمة أعلاه لعرض مقارنة تفاعلية بالمخططات.</p>
          </div>
        )}

        {selected.length === 1 && !loading && (
          <div className="compare__empty">
            <div className="compare__empty-icon"><Sparkles size={44} /></div>
            <h3>مساحة واحدة فقط… اختر غيرها</h3>
            <p>المقارنة تحتاج إلى مساحتين على الأقل. أضف مساحة أخرى من القائمة.</p>
          </div>
        )}

        {ctx && ranked.length >= MIN_PICK && (
          <AnimatePresence>
            <motion.div
              key={selectedIds.join('|')}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="compare__results"
            >
              {/* البطاقات العلوية لكل مساحة */}
              <div className="compare__overview">
                {ranked.map(({ space, score }, i) => (
                  <CompareCard
                    key={space.id}
                    space={space}
                    score={score}
                    rank={i + 1}
                    isTop={i === 0}
                    onRemove={() => toggle(space.id)}
                  />
                ))}
              </div>

              {/* المخططات */}
              <div className="compare__charts">
                <PriceChart spaces={ranked.map((r) => r.space)} ctx={ctx} />
                <RatingGauges spaces={ranked.map((r) => r.space)} />
                <OccupancyChart spaces={ranked.map((r) => r.space)} ctx={ctx} />
                <CapacityChart spaces={ranked.map((r) => r.space)} ctx={ctx} />
              </div>

              {/* جدول المقارنة التفصيلي */}
              <div className="compare__table-wrap">
                <h2 className="compare__section-title">
                  <Gauge size={20} /> جدول المقارنة الكامل
                </h2>
                <div className="compare__table" role="table" aria-label="مقارنة المساحات"
                  style={{ '--cmp-cols': ranked.length }}>
                  <div className="compare__row is-head" role="row">
                    <span className="compare__metric" role="columnheader">المعيار</span>
                    {ranked.map(({ space }) => (
                      <span key={space.id} className="compare__cell is-head-cell" role="columnheader">
                        {space.title}
                      </span>
                    ))}
                  </div>

                  <MetricRow label="السعر (ش.ج / ساعة)" values={ranked.map((r) => r.space)} pick={(s) => s.price_per_hour} format={fmtNumber} best="min" />
                  <MetricRow label="السعة (أشخاص)" values={ranked.map((r) => r.space)} pick={(s) => s.capacity} format={fmtNumber} best="max" />
                  <MetricRow label="التقييم" values={ranked.map((r) => r.space)} pick={(s) => s.rating} format={fmtRating} best="max" suffix="★" />
                  <MetricRow label="عدد التقييمات" values={ranked.map((r) => r.space)} pick={(s) => s.review_count} format={fmtNumber} best="max" />
                  <MetricRow label="حجوزات الشهر" values={ranked.map((r) => r.space)} pick={(s) => s.stats?.bookings ?? 0} format={fmtNumber} best="max" />
                  <MetricRow label="الإيراد الشهري (ش.ج)" values={ranked.map((r) => r.space)} pick={(s) => s.stats?.revenue ?? 0} format={fmtNumber} best="max" />
                  <MetricRow label="معدل الإشغال" values={ranked.map((r) => r.space)} pick={(s) => s.stats?.occupancy ?? 0} format={(v) => `${fmtNumber(v)}٪`} best="max" />
                  <MetricRow label="أوقات العمل" values={ranked.map((r) => r.space)} pick={(s) => `${s.open_time || '—'} – ${s.close_time || '—'}`} format={(v) => v} best={null} />
                  <MetricRow label="المنطقة" values={ranked.map((r) => r.space)} pick={(s) => s.area || s.location || '—'} format={(v) => v} best={null} />
                  <MetricRow label="النوع" values={ranked.map((r) => r.space)} pick={(s) => catLabel(s.category) || '—'} format={(v) => v} best={null} />
                  <MetricRow label="المرافق" values={ranked.map((r) => r.space)} pick={(s) => s.amenities || []} format={(arr) => arr.map((a) => AMENITY_LABELS[a]).filter(Boolean).join('، ') || '—'} best="more" />
                  <MetricRow label="حجز فوري" values={ranked.map((r) => r.space)} pick={(s) => s.instant_booking} format={(v) => (v ? 'متاح' : 'غير متاح')} best={null} />
                </div>
              </div>

              {/* خلاصة */}
              <div className="compare__recap">
                <div className="compare__winner">
                  <Trophy size={22} />
                  <div>
                    <b>الأفضل إجمالاً</b>
                    <span>{ranked[0].space.title}</span>
                  </div>
                </div>
                <Link className="btn-primary compare__cta" to={`/ads/${ranked[0].space.id}`}>
                  <CalendarCheck2 size={18} /> احجز {ranked[0].space.title.split(' ')[0]}
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ----- بطاقة علوية لكل مساحة -----
function CompareCard({ space, score, rank, isTop, onRemove }) {
  return (
    <div className={`compare__card${isTop ? ' is-top' : ''}`}>
      {isTop && <span className="compare__card-crown"><Crown size={16} /></span>}
      <div className="compare__card-head">
        <div className="compare__card-rank">#{fmtNumber(rank)}</div>
        <div className="compare__card-icon"><Building2 size={26} /></div>
        <button type="button" className="compare__card-remove" onClick={onRemove} aria-label={`إزالة ${space.title}`}>
          <X size={15} />
        </button>
      </div>
      <h3 className="compare__card-title">{space.title}</h3>
      <div className="compare__card-rating">
        <Star size={15} /> {fmtRating(space.rating)}
        {space.review_count > 0 && <small>({fmtNumber(space.review_count)})</small>}
      </div>
      <div className="compare__card-price">
        <b>{fmtNumber(space.price_per_hour)}</b> <small>ش.ج / ساعة</small>
      </div>
      <div className="compare__card-score">
        <span style={{ width: `${score}%` }} />
        <em>{fmtNumber(score)}</em>
      </div>
      <div className="compare__card-tags">
        {space.capacity > 0 && <span><Users size={13} /> {fmtNumber(space.capacity)}</span>}
        {space.instant_booking && <span className="is-flash"><Sparkles size={13} /> فوري</span>}
      </div>
    </div>
  );
}

// ----- مخطط أعمدة السعر -----
function PriceChart({ spaces, ctx }) {
  const peak = ctx.maxPrice || 1;
  const varied = ctx.minPrice !== ctx.maxPrice;
  return (
    <div className="compare__chart">
      <h3 className="compare__chart-title"><Wallet size={18} /> مقارنة السعر</h3>
      <div className="compare__bars">
        {spaces.map((s) => {
          const h = Math.max(6, ((s.price_per_hour || 0) / peak) * 100);
          const isLow = varied && s.price_per_hour === ctx.minPrice;
          const isHigh = varied && s.price_per_hour === ctx.maxPrice;
          return (
            <div key={s.id} className="compare__bar">
              <div className="compare__bar-track">
                <motion.span
                  className={`compare__bar-fill${isLow ? ' is-best' : ''}${isHigh ? ' is-worst' : ''}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <b className="compare__bar-value">{fmtNumber(s.price_per_hour)}</b>
              <small className="compare__bar-label">{s.title}</small>
              {isLow && <em className="compare__bar-badge">الأقل سعراً</em>}
              {isHigh && <em className="compare__bar-badge is-worst">الأعلى سعراً</em>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- نصف دائرة التقييم لكل مساحة (SVG) -----
function RatingGauges({ spaces }) {
  const ratings = spaces.map((s) => Math.max(0, Math.min(5, s.rating || 0)));
  const top = Math.max(...ratings);
  const low = Math.min(...ratings);
  const varied = top !== low;
  return (
    <div className="compare__chart">
      <h3 className="compare__chart-title"><Star size={18} /> التقييم (من ٥)</h3>
      <div className="compare__gauges">
        {spaces.map((s, i) => {
          const r = ratings[i];
          const frac = r / 5;
          const C = 2 * Math.PI * 42;
          const isBest = varied && r === top;
          const isWorst = varied && r === low;
          return (
            <div
              key={s.id}
              className={`compare__gauge${isBest ? ' is-best' : ''}${isWorst ? ' is-worst' : ''}`}
            >
              <svg viewBox="0 0 100 100" className="compare__gauge-svg" aria-hidden="true">
                <circle className="compare__gauge-track" cx="50" cy="50" r="42" />
                <motion.circle
                  className="compare__gauge-fill"
                  cx="50"
                  cy="50"
                  r="42"
                  strokeDasharray={C}
                  initial={{ strokeDashoffset: C }}
                  animate={{ strokeDashoffset: C * (1 - frac) }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <div className="compare__gauge-center">
                <b>{fmtRating(r)}</b>
                <small>من ٥</small>
              </div>
              <span className="compare__gauge-name">{s.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- أشرطة الإشغال الأفقية -----
function OccupancyChart({ spaces, ctx }) {
  const varied = ctx.maxOccupancy !== ctx.minOccupancy;
  return (
    <div className="compare__chart">
      <h3 className="compare__chart-title"><TrendingUp size={18} /> معدل الإشغال</h3>
      <div className="compare__hrows">
        {spaces.map((s) => {
          const occ = Math.max(0, Math.min(100, s.stats?.occupancy ?? 0));
          const isBest = varied && occ === ctx.maxOccupancy;
          const isWorst = varied && occ === ctx.minOccupancy;
          return (
            <div key={s.id} className="compare__hrow">
              <span className="compare__hrow-label">{s.title}</span>
              <span className="compare__hrow-track">
                <motion.span
                  className={`compare__hrow-fill${isBest ? ' is-best' : ''}${isWorst ? ' is-worst' : ''}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${occ}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <b className="compare__hrow-value">{fmtNumber(occ)}٪</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- مقارنة السعة -----
function CapacityChart({ spaces, ctx }) {
  const peak = ctx.maxCapacity || 1;
  const capacities = spaces.map((s) => s.capacity || 0);
  const low = Math.min(...capacities);
  const varied = low !== ctx.maxCapacity;
  return (
    <div className="compare__chart">
      <h3 className="compare__chart-title"><Users size={18} /> السعة القصوى</h3>
      <div className="compare__bars">
        {spaces.map((s) => {
          const cap = s.capacity || 0;
          const h = Math.max(6, (cap / peak) * 100);
          const isMax = varied && cap === ctx.maxCapacity;
          const isMin = varied && cap === low;
          return (
            <div key={s.id} className="compare__bar">
              <div className="compare__bar-track">
                <motion.span
                  className={`compare__bar-fill compare__bar-fill--accent${isMax ? ' is-best' : ''}${isMin ? ' is-worst' : ''}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <b className="compare__bar-value">{fmtNumber(cap)}</b>
              <small className="compare__bar-label">{s.title}</small>
              {isMax && <em className="compare__bar-badge">الأكبر سعة</em>}
              {isMin && <em className="compare__bar-badge is-worst">الأقل سعة</em>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- صف في جدول المقارنة مع إبراز الأفضل (أخضر) والأسوأ (برتقالي) -----
function MetricRow({ label, values, pick, format, best }) {
  const mapped = values.map((s) => pick(s));
  const sizeOf = (v) => (Array.isArray(v) ? v.length : v);
  let bestIdx = -1;
  let worstIdx = -1;
  if (best === 'min') {
    bestIdx = mapped.reduce((bi, v, i) => (v < mapped[bi] ? i : bi), 0);
    worstIdx = mapped.reduce((wi, v, i) => (v > mapped[wi] ? i : wi), 0);
  } else if (best === 'max') {
    bestIdx = mapped.reduce((bi, v, i) => (v > mapped[bi] ? i : bi), 0);
    worstIdx = mapped.reduce((wi, v, i) => (v < mapped[wi] ? i : wi), 0);
  } else if (best === 'more') {
    bestIdx = mapped.reduce((bi, v, i) => (v.length > mapped[bi]?.length ? i : bi), 0);
    worstIdx = mapped.reduce((wi, v, i) => (v.length < mapped[wi]?.length ? i : wi), 0);
  }
  // لا نضع علامة "أسوأ" إن كانت كل القيم متساوية (وإلا صار أفضل وأسوأ في آن واحد)
  const showWorst = best && worstIdx >= 0 && worstIdx !== bestIdx
    && sizeOf(mapped[worstIdx]) !== sizeOf(mapped[bestIdx]);

  return (
    <div className="compare__row" role="row">
      <span className="compare__metric">{label}</span>
      {mapped.map((v, i) => {
        const isBest = Boolean(best) && i === bestIdx;
        const isWorst = showWorst && i === worstIdx;
        return (
          <span
            key={i}
            className={`compare__cell${isBest ? ' is-best' : ''}${isWorst ? ' is-worst' : ''}`}
            role="cell"
          >
            {isBest && <Award size={13} className="compare__cell-award" />}
            {isWorst && <AlertTriangle size={13} className="compare__cell-warn" />}
            {format(v)}
          </span>
        );
      })}
    </div>
  );
}