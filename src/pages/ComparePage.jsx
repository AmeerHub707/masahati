import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, Reorder, useDragControls } from 'framer-motion';
import {
  Check, Star, Users, TrendingUp, Wallet, Crown, Trophy,
  Search, X, Building2, Sparkles, CalendarCheck2, Gauge, Award, Scale, AlertTriangle,
  GripVertical, ChevronRight, ChevronLeft, MessageSquareQuote, Receipt, HandCoins, Equal,
  Lightbulb, Clock, MapPin, Ticket, Plus,
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import { loadAllSpacesWithFallback, SPACE_CATEGORIES } from '../lib/spaces';
import { AMENITY_LABELS } from '../lib/requests';
import { fmtNumber, fmtRating, fmtMoney } from '../lib/format';
import { getHomePath, getCurrentRole } from '../lib/authStore';
import {
  pricePerHead,
  buildCompareContext,
  scoreAll,
  normalizeRow,
  rowHasDifference,
} from '../lib/compareScore';

const MAX_PICK = 4;
const MIN_PICK = 2;
const NARROW = '(max-width: 720px)';

const catLabel = (id) => (SPACE_CATEGORIES.find((c) => c.id === id) || {}).label || '';
const amenityText = (list) =>
  (Array.isArray(list) ? list : []).map((a) => AMENITY_LABELS[a]).filter(Boolean).join('، ') || '—';

// الرسوم والجدول لا يعتمد على نص البحث، فنتجنب إعادة رسمها مع كل ضغطة مفتاح
// بشرط أن تبقى هذه المراجع ثابتة الهوية: نرفعها إلى خارج المكوّن ونغلّف
// الرسوم بـ memo فتكتفت بالحالة Memoise بلا سبب حقيقي لإعادة الرسم.
const ICON_WALLET = <Wallet size={18} />;
const ICON_RECEIPT = <Receipt size={18} />;
const ICON_USERS = <Users size={18} />;
const ICON_QUOTE = <MessageSquareQuote size={18} />;
const pickPrice = (s) => s.price_per_hour;
const pickPerHead = (s) => pricePerHead(s);
const pickCapacity = (s) => s.capacity;
const pickReviews = (s) => s.review_count;

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const [allSpaces, setAllSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [demo, setDemo] = useState(false);
  const [diffsOnly, setDiffsOnly] = useState(true);
  const [announce, setAnnounce] = useState('');
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW).matches
  );
  const [tableOpen, setTableOpen] = useState(
    () => !(typeof window !== 'undefined' && window.matchMedia(NARROW).matches)
  );

  useEffect(() => {
    let alive = true;
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(NARROW);
    const onChange = (e) => {
      setIsNarrow(e.matches);
      setTableOpen(!e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // الترتيب يبقى ملك المستخدم: نقرأه كما هو من الرابط ولا نرتّب به.
  const selectedIds = useMemo(() => params.getAll('sp').slice(0, MAX_PICK), [params]);

  const selected = useMemo(() => {
    const map = new Map(allSpaces.map((s) => [String(s.id), s]));
    return selectedIds.map((id) => map.get(String(id))).filter(Boolean);
  }, [allSpaces, selectedIds]);

  // التطبيع على الكتالوج كاملاً، لا على المختارة، وإلا قفزت الدرجة عند كل إضافة.
  const ctx = useMemo(() => buildCompareContext(allSpaces), [allSpaces]);
  const scored = useMemo(() => scoreAll(selected, ctx), [selected, ctx]);
  const scoredSpaces = useMemo(() => scored.map((x) => x.space), [scored]);
  const winnerId = useMemo(() => scored.find((x) => x.isWinner)?.space.id, [scored]);
  const ready = scored.length >= MIN_PICK;
  const toggleTable = useCallback(() => setTableOpen((v) => !v), []);

  const membershipKey = useMemo(() => [...selectedIds].sort().join('|'), [selectedIds]);

  const selectable = useMemo(() => {
    const taken = new Set(selectedIds);
    const q = query.trim().toLowerCase();
    return allSpaces
      .filter((s) => !taken.has(String(s.id)))
      .filter((s) => !q || `${s.title} ${s.location} ${s.area} ${catLabel(s.category)}`.toLowerCase().includes(q));
  }, [allSpaces, selectedIds, query]);

  const writeIds = (ids) => setParams(ids.map((x) => ['sp', x]));
  const full = selectedIds.length >= MAX_PICK;

  const add = (id) => {
    if (full) return;
    writeIds([...selectedIds, String(id)]);
  };

  const remove = (id) => writeIds(selectedIds.filter((x) => x !== String(id)));

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    writeIds(next);
    setAnnounce(`انتقلت المساحة إلى العمود ${fmtNumber(target + 1)} من ${fmtNumber(next.length)}`);
  };

  const onReorder = (ids) => {
    writeIds(ids);
    setAnnounce(`أُعيد ترتيب المساحات: ${ids.map((id) => {
      const s = selected.find((x) => String(x.id) === String(id));
      return s ? s.title : id;
    }).join(' ثم ')}`);
  };

  const clearAll = () => { setParams([]); setQuery(''); };

  // شريحة "أضف مساحة أخرى" لا تفتح صينية مطوية (الصينية ظاهرة دائماً)،
  // فتجعل التركيز ينزل إلى بحث الاختيار حيث ترى الخيارات وتختار منها.
  // التركيز أولاً ليبقى مضموناً، ثم تمرير اختياري لا يسقط في بيئات بلا دعم.
  const searchRef = useRef(null);
  const focusTray = () => {
    const el = searchRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen font-['Cairo'] compare-page">
      {/* ---------- القسم الأعلى: الصورة هي القسم نفسه ----------
          الصورة تمتدّ بعرض الصفحة وتذوب حوافّها في لون الصفحة، فأصبحت جزءاً
          من القسم لا قصاصة عائمة. لونها الفاتح يحتمل نصاً داكناً، وهو ما
          تعطيه الخلفية الحلزية تحتها. */}
      <section className="compare-hero">
        <img
          className="compare-hero__img"
          src="/Modern-Building.jpg"
          alt=""
          aria-hidden="true"
          width="968"
          height="379"
          decoding="async"
          fetchPriority="high"
        />
        <div className="wrap wrap--wide compare-hero__inner">
          <BackButton
            className="cmp-float-back"
            fallback={getHomePath(getCurrentRole())}
            ariaLabel="العودة إلى صفحة المقارنة"
            label=""
          />
          <header className="compare__head">
            <h1 className="compare__title">قارن بين المساحات واختر الأنسب</h1>
            <p className="compare__subtitle">
        اختر من {fmtNumber(MIN_PICK)} إلى {fmtNumber(MAX_PICK)} مساحات، ورتّبها بالترتيب الذي يناسبك
        {demo && <em className="compare__demo-badge">وضع تجريبي</em>}
            </p>
          </header>
        </div>
      </section>

      <div className="wrap wrap--wide compare">
        <div className="sr-only" role="status" aria-live="polite">{announce}</div>

        {/* ---------- الأعلى: الاختيار (العدّاد، الشرائح، ثم بحث الإضافة) ---------- */}
        <section className="wb" aria-label="اختيار المساحات للمقارنة">
                <div className="wb__bar">
                  <h2 className="wb__bar-title"><Gauge size={18} /> مساحاتك على الطاولة</h2>
                  <div className="wb__bar-tools">
                    <div className="compare__counter">
                      <span className={`compare__counter-dot${ready ? ' is-ok' : ''}`} />
                      <b>{fmtNumber(selected.length)}</b> <small>/ {fmtNumber(MAX_PICK)}</small>
                    </div>
                    {selected.length > 0 && (
                      <button type="button" className="btn-ghost compare__clear" onClick={clearAll}>
                        <X size={15} /> مسح الكل
                      </button>
                    )}
                  </div>
                </div>

                {!loading && selected.length > 0 && (
                  <nav className="cmp-chips" aria-label="المساحات المختارة للمقارنة">
                    {selected.map((s) => (
                      <span className="cmp-chip" key={s.id}>
                        <span className="cmp-chip__name" title={s.title}>{s.title}</span>
                        <button
                          type="button"
                          className="cmp-chip__x"
                          onClick={() => remove(s.id)}
                          aria-label={`إزالة ${s.title} من المقارنة`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {!full && (
                      <button
                        type="button"
                        className="cmp-chip cmp-chip--add"
                        onClick={focusTray}
                      >
                        <Plus size={14} /> إضافة مساحة أخرى
                      </button>
                    )}
                  </nav>
                )}

                <div className="wb__tray">
                  <div className="compare__search">
                    <Search className="compare__search-icon" size={17} />
                    <input
                      ref={searchRef}
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
                  {!loading && (
                    <div className="wb__tray-list">
                      {selectable.length === 0 && (
                        <p className="wb__tray-empty">
                          {full ? 'اكتمل الحد الأقصى للمقارنة' : 'لا نتائج مطابقة للبحث'}
                        </p>
                      )}
                      {selectable.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="wb__tray-item"
                          onClick={() => add(s.id)}
                          disabled={full}
                        >
                          <Building2 size={15} />
                          <span className="wb__tray-name">{s.title}</span>
                          <span className="wb__tray-meta">{fmtNumber(s.price_per_hour)} ش.ج</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
        </section>

        {/* ---------- الوسط: طاولة المقارنة، أعمدة المساحات المختارة ---------- */}
        <section className="wb wb--cols" aria-label="أعمدة المساحات المختارة للمقارنة">
                {loading ? (
                  <div className="wb__slots is-loading">
                    {Array.from({ length: MIN_PICK }).map((_, i) => <span key={i} className="wb__slot-skeleton" />)}
                  </div>
                ) : (
                  <Reorder.Group
                    axis="x"
                    values={selectedIds}
                    onReorder={onReorder}
                    className="wb__slots"
                    as="ul"
                  >
                    {scored.map(({ space, score, isWinner }, i) => (
                      <Slot
                        key={space.id}
                        space={space}
                        score={score}
                        isWinner={isWinner}
                        index={i}
                        total={selectedIds.length}
                        onMove={move}
                        onRemove={remove}
                      />
                    ))}
                    {!full && (
                      <li className="wb__slot wb__slot--empty" aria-hidden="true">
                        <span className="wb__slot-drop" />
                        <span className="wb__slot-drop-text">أضف مساحة</span>
                      </li>
                    )}
                  </Reorder.Group>
                )}

                {!loading && selected.length === 0 && (
                  <div className="cmp-tip">
                    <Lightbulb size={18} />
                    <p>اختر مساحات من أنواع مختلفة أو مواقع مختلفة للحصول على مقارنة أكثر دقة وتفصيلاً.</p>
                  </div>
                )}
        </section>

        {/* ---------- الأسفل: كل الإحصاءات والرسوم وجدول المقارنة ---------- */}
        {ready && (
                <motion.div
                  key={membershipKey}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="compare__results"
                >
                  {/* الفائز أولاً: القرار أهم من التفاصيل */}
                  <div className="compare__recap">
                    <div className="compare__winner">
                      <Trophy size={22} />
                      <div>
                        <b>الأفضل إجمالاً</b>
                        <span>{scoredSpaces.find((s) => String(s.id) === String(winnerId))?.title}</span>
                      </div>
                    </div>
                    <Link className="btn-primary compare__cta" to={`/ads/${winnerId}`}>
                      <CalendarCheck2 size={18} /> احجز الآن
                    </Link>
                  </div>

                  <ul className="compare__legend" aria-label="مفتاح قراءة الألوان">
                    <li><span className="compare__legend-key compare__legend-key--win"><Crown size={12} /></span> البرتقالي = الأفضل إجمالاً</li>
                    <li><span className="compare__legend-key compare__legend-key--best"><Check size={12} /></span> الأخضر = الأفضل في هذا المعيار</li>
                    <li><span className="compare__legend-key compare__legend-key--other">—</span> الرمادي = الطرف الآخر</li>
                  </ul>

                  <div className="compare__charts">
                    <BarChart
                      title="السعر (ش.ج/ساعة)"
                      icon={ICON_WALLET}
                      spaces={scoredSpaces}
                      pick={pickPrice}
                      format={fmtNumber}
                      lowerIsBetter
                      bestWord="الأقل سعراً"
                      worstWord="الأعلى سعراً"
                    />
                    <RadialRatingChart spaces={scoredSpaces} />
                    <BarChart
                      title="السعر لكل شخص"
                      icon={ICON_RECEIPT}
                      spaces={scoredSpaces}
                      pick={pickPerHead}
                      format={fmtMoney}
                      log
                      lowerIsBetter
                      bestWord="الأوفر لكل شخص"
                      worstWord="الأعلى لكل شخص"
                      unit="ش.ج/شخص"
                    />
                    <BarChart
                      title="السعة القصوى"
                      icon={ICON_USERS}
                      spaces={scoredSpaces}
                      pick={pickCapacity}
                      format={fmtNumber}
                      log
                      lowerIsBetter={false}
                      bestWord="الأكبر سعة"
                      worstWord="الأقل سعة"
                    />
                    <BarChart
                      title="عدد التقييمات"
                      icon={ICON_QUOTE}
                      spaces={scoredSpaces}
                      pick={pickReviews}
                      format={fmtNumber}
                      log
                      lowerIsBetter={false}
                      bestWord="الأكثر ثقة"
                      worstWord="الأقل ثقة"
                    />
                    <OccupancyChart spaces={scoredSpaces} />
                  </div>

                  <CompareTable
                    spaces={scoredSpaces}
                    winnerId={winnerId}
                    diffsOnly={diffsOnly}
                    onDiffsChange={setDiffsOnly}
                    open={tableOpen}
                    onToggleOpen={toggleTable}
                    isNarrow={isNarrow}
                  />
                </motion.div>
        )}

        {selected.length === 0 && !loading && (
                <div className="compare__empty">
                  <div className="compare__empty-icon"><Scale size={44} /></div>
                  <h3>اختر مساحات لتقارنها</h3>
                  <p>أضف من {fmtNumber(MIN_PICK)} إلى {fmtNumber(MAX_PICK)} مساحات من الصينية أعلاه لتبدأ المقارنة.</p>
                </div>
        )}

        {selected.length === 1 && !loading && (
                <div className="compare__empty">
                  <div className="compare__empty-icon"><Sparkles size={44} /></div>
                  <h3>مساحة واحدة فقط… اختر غيرها</h3>
                  <p>المقارنة تحتاج مساحتين على الأقل. أضف واحدة أخرى من الصينية.</p>
                </div>
        )}
            </div>
    </div>
  );
}

// ----- خانة واحدة على الطاولة -----
function Slot({ space, score, isWinner, index, total, onMove, onRemove }) {
  const controls = useDragControls();
  // لا ساعة ولا شَرطة إن غاب وقتا العمل: « – » وحدها بصرياً بلا معنى.
  const hours = `${space.open_time || ''}${space.close_time ? ` – ${space.close_time}` : ''}`.trim();
  return (
    <Reorder.Item
      value={String(space.id)}
      dragListener={false}
      dragControls={controls}
      className={`wb__slot${isWinner ? ' is-winner' : ''}`}
    >
      {isWinner && <span className="wb__slot-crown"><Crown size={14} /></span>}
      <div className="wb__slot-media">
        {space.image ? (
          <img src={space.image} alt="" className="wb__slot-img" />
        ) : (
          <Building2 size={22} />
        )}
      </div>
      <div className="wb__slot-info">
        <h3 className="wb__slot-name" title={space.title}>{space.title}</h3>
        <div className="wb__slot-rate">
          <Star size={13} />
          {fmtRating(space.rating || 0)}
          <span className="wb__slot-reviews">({fmtNumber(space.review_count || 0)})</span>
        </div>
        <div className="wb__slot-price">
          <b>{fmtNumber(space.price_per_hour)}</b> <small>ش.ج/ساعة</small>
        </div>
        <div className="wb__slot-hours">
          {hours && (
            <>
        <Clock size={13} />
        {hours}
            </>
          )}
          {space.instant_booking ? (
            <span className="cmp-badge cmp-badge--ok">متاح</span>
          ) : (
            <span className="cmp-badge cmp-badge--off">غير متاح</span>
          )}
        </div>
      </div>
      <div className="wb__slot-score" title="مؤشر القيمة الإجمالي">
        <span className="wb__slot-score-track"><span style={{ width: `${score}%` }} /></span>
        <b>{fmtNumber(score)}</b>
      </div>
      <div className="wb__slot-tools">
        <button
          type="button"
          className="wb__slot-move"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          aria-label={`نقل ${space.title} إلى العمود السابق`}
        >
          <ChevronRight size={15} />
        </button>
        <button
          type="button"
          className="wb__slot-move"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          aria-label={`نقل ${space.title} إلى العمود التالي`}
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          className="wb__slot-grip"
          onPointerDown={(e) => controls.start(e)}
          aria-label={`اسحب لإعادة ترتيب ${space.title}`}
        >
          <GripVertical size={15} />
        </button>
        <button
          type="button"
          className="wb__slot-remove"
          onClick={() => onRemove(space.id)}
          aria-label={`إزالة ${space.title}`}
        >
          <X size={14} />
        </button>
      </div>
    </Reorder.Item>
  );
}

// ----- مخطط أعمدة موحّد، مطبَّع داخل الصف لا على المدى العام -----
const BarChart = memo(function BarChart({ title, icon, spaces, pick, format, log = false, lowerIsBetter = true, bestWord, worstWord, unit }) {
  const raw = spaces.map(pick);
  const present = raw.filter((v) => Number.isFinite(v));
  // المساحة التي لا تُحسب لها قيمة (سعة صفرية) تُوضع في الطرف الأسوأ صراحةً
  const sentinel = present.length
    ? (lowerIsBetter
      ? Math.max(...present) * 1000
      : Math.max(1, Math.min(...present) / 1000))
    : 0;
  const values = raw.map((v) => (Number.isFinite(v) ? v : sentinel));
  const pcts = normalizeRow(values, { log, lowerIsBetter });
  const best = present.length ? (lowerIsBetter ? Math.min(...present) : Math.max(...present)) : null;
  const worst = present.length ? (lowerIsBetter ? Math.max(...present) : Math.min(...present)) : null;
  const varied = best !== null && best !== worst;
  const bestIdx = varied ? raw.findIndex((v) => Number.isFinite(v) && v === best) : -1;

  return (
    <div className="compare__chart">
      <h3 className="compare__chart-title">{icon} {title}</h3>
      <div className="compare__bars">
        {spaces.map((s, i) => {
          const has = Number.isFinite(raw[i]);
          const isBest = i === bestIdx;
          const isWorst = varied && has && raw[i] === worst;
          return (
            <div key={s.id} className="compare__bar">
        <div className="compare__bar-track">
                <motion.span
                  className={`compare__bar-fill${isBest ? ' is-best' : ''}${isWorst ? ' is-worst' : ''}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${has ? Math.max(pcts[i] * 100, 1.5) : 0}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
        </div>
        <b className="compare__bar-value">{has ? format(raw[i]) : '—'}</b>
        <small className="compare__bar-label">{s.title}</small>
        {unit && <small className="compare__bar-unit">{unit}</small>}
        {isBest && <em className="compare__bar-badge">{bestWord}</em>}
        {isWorst && <em className="compare__bar-badge is-worst">{worstWord}</em>}
            </div>
          );
          })}
      </div>
    </div>
  );
});

const RadialRatingChart = memo(function RadialRatingChart({ spaces }) {
  const C = 2 * Math.PI * 52;
  return (
    <div className="compare__chart">
      <h3 className="compare__chart-title"><Star size={18} /> التقييم (من ٥)</h3>
      <div className="cmp-donuts">
        {spaces.map((s, i) => {
          const r = Math.max(0, Math.min(5, Number(s.rating) || 0));
          const offset = C * (1 - r / 5);
          return (
            <div key={s.id}>
        <div className="cmp-donut" role="img" aria-label={`${s.title}: التقييم ${fmtRating(r)} من ٥، ${fmtNumber(s.review_count || 0)} تقييم`}>
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="cmp-donut__track" r="52" cx="60" cy="60" stroke="var(--brand-050)" strokeWidth="10" />
                  <motion.circle
                    r="52" cx="60" cy="60" stroke="var(--brand-500)" strokeWidth="10" strokeDasharray={C}
                    initial={{ strokeDashoffset: C }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
                <span className="cmp-donut__val">{fmtRating(r)}</span>
        </div>
        <div className="cmp-donut__label">{s.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ----- أشرطة الإشغال الأفقية: المقياس 0-100 طبيعي، فلم يُمَسّ -----
const OccupancyChart = memo(function OccupancyChart({ spaces }) {
  const raw = spaces.map((s) => Math.max(0, Math.min(100, Number(s.stats?.occupancy) || 0)));
  const best = Math.max(...raw);
  const worst = Math.min(...raw);
  const varied = best !== worst;
  return (
    <div className="compare__chart">
      <h3 className="compare__chart-title"><TrendingUp size={18} /> معدل الإشغال</h3>
      <div className="compare__hrows">
        {spaces.map((s, i) => (
          <div
            key={s.id}
            className={`compare__hrow${varied && raw[i] === best ? ' is-best' : ''}${varied && raw[i] === worst ? ' is-worst' : ''}`}
          >
            <span className="compare__hrow-label">{s.title}</span>
            <span className="compare__hrow-track">
        <motion.span
                className="compare__hrow-fill"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(raw[i], 3)}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
            </span>
            <b className="compare__hrow-value">{fmtNumber(raw[i])}٪</b>
          </div>
        ))}
      </div>
    </div>
  );
});

const MAIN_ROWS = [
  { id: 'perHead', label: 'السعر لكل شخص (ش.ج/شخص)', pick: (s) => pricePerHead(s), fmt: (v) => fmtMoney(v), better: 'min', log: true, icon: Receipt },
  { id: 'price', label: 'السعر (ش.ج/ساعة)', pick: (s) => s.price_per_hour, fmt: fmtNumber, better: 'min', icon: Wallet },
  { id: 'rating', label: 'التقييم (من ٥)', pick: (s) => Math.max(0, Math.min(5, Number(s.rating) || 0)), fmt: (v) => fmtRating(v), better: 'max', icon: Star },
  { id: 'reviews', label: 'عدد التقييمات', pick: (s) => Number(s.review_count) || 0, fmt: fmtNumber, better: 'max', log: true, icon: MessageSquareQuote },
  { id: 'capacity', label: 'السعة القصوى', pick: (s) => s.capacity, fmt: fmtNumber, better: 'max', log: true, icon: Users },
  { id: 'amenities', label: 'المرافق', pick: (s) => (Array.isArray(s.amenities) ? s.amenities : []), fmt: amenityText, better: 'count', icon: Sparkles },
  { id: 'category', label: 'نوع المساحة', pick: (s) => catLabel(s.category) || '—', icon: Building2 },
  { id: 'area', label: 'المنطقة', pick: (s) => s.area || s.location || '—', icon: MapPin },
  { id: 'hours', label: 'أوقات العمل', pick: (s) => (s.open_time && s.close_time ? `${s.open_time} – ${s.close_time}` : '—'), icon: Clock },
  { id: 'instant', label: 'الحجز الفوري', pick: (s) => (s.instant_booking ? 'متاح' : 'غير متاح'), icon: CalendarCheck2 },
];

// مؤشرات المالك: أرقام تشغيلية خاصة بصاحب المساحة، لا معياراً للزبون.
const OWNER_ROWS = [
  { id: 'bookings', label: 'الحجوزات الشهرية', pick: (s) => Number(s.stats?.bookings) || 0, fmt: fmtNumber, better: 'max', log: true, icon: Ticket },
  { id: 'revenue', label: 'الإيراد (ش.ج/شهر)', pick: (s) => Number(s.stats?.revenue) || 0, fmt: (v) => fmtMoney(v), better: 'max', log: true, icon: HandCoins },
  { id: 'occupancy', label: 'معدل الإشغال (%)', pick: (s) => Math.max(0, Math.min(100, Number(s.stats?.occupancy) || 0)), fmt: (v) => `${fmtNumber(v)}%`, better: 'max', icon: TrendingUp },
];

// ----- جدول المقارنة: <table> حقيقي، وكل صف مطبَّع على مداه هو -----
const CompareTable = memo(function CompareTable({ spaces, winnerId, diffsOnly, onDiffsChange, open, onToggleOpen, isNarrow }) {
  const mainRows = diffsOnly ? MAIN_ROWS.filter((r) => rowHasDifference(spaces.map(r.pick))) : MAIN_ROWS;
  const ownerRows = diffsOnly ? OWNER_ROWS.filter((r) => rowHasDifference(spaces.map(r.pick))) : OWNER_ROWS;

  return (
    <section className="cmp-table" aria-label="جدول المقارنة الكامل">
      <div className="cmp-table__head">
        <h2 className="compare__section-title"><Gauge size={20} /> جدول المقارنة الكامل</h2>
        <div className="cmp-table__tools">
          <label className="cmp-toggle">
            <input
        type="checkbox"
        checked={diffsOnly}
        onChange={(e) => onDiffsChange(e.target.checked)}
            />
            <span className="cmp-toggle__track" aria-hidden="true"><span className="cmp-toggle__knob" /></span>
            <span className="cmp-toggle__text">الفروق فقط</span>
          </label>
          {(isNarrow || !open) && (
            <button type="button" className="btn-ghost cmp-table__disclose" onClick={onToggleOpen}>
        <Equal size={15} /> {open ? 'إخفاء الجدول' : 'عرض الجدول'}
            </button>
          )}
        </div>
      </div>

      {(!isNarrow || open) && (
        <div className="cmp-table__scroll">
          <table className="cmp-table__grid">
            <caption className="sr-only">
        مقارنة تفصيلية بين {spaces.length} مساحات. الصفوف مطبَّعة على مدى الصف نفسه.
            </caption>
            <thead>
        <tr>
                <th scope="col" className="cmp-table__metric-head">المعيار</th>
                {spaces.map((s) => (
                  <th
                    key={s.id}
                    scope="col"
                    className={`cmp-table__space-head${String(s.id) === String(winnerId) ? ' is-winner' : ''}`}
                  >
                    {String(s.id) === String(winnerId) && <Crown size={13} />}
                    <span title={s.title}>{s.title}</span>
                  </th>
                ))}
        </tr>
            </thead>
            <tbody>
        {mainRows.map((row) => (
                <Row key={row.id} row={row} spaces={spaces} />
        ))}
            </tbody>
            {ownerRows.length > 0 && (
        <>
                <tbody className="cmp-table__owner-head">
                  <tr>
                    <th scope="colgroup" colSpan={spaces.length + 1}>
                      <span className="cmp-table__owner-tag">
                        <HandCoins size={14} /> مؤشرات المالك
                        <em>أرقام تشغيلية خاصة بصاحب المساحة، لا تُستخدم في الترتيب</em>
                      </span>
                    </th>
                  </tr>
                </tbody>
                <tbody>
                  {ownerRows.map((row) => (
                    <Row key={row.id} row={row} spaces={spaces} />
                  ))}
                </tbody>
        </>
            )}
            <tfoot className="cmp-table__foot">
        <tr>
                <th scope="row" className="cmp-table__metric">
                  <span className="cmp-table__metric-label">
                    <span className="cmp-table__rowicon" aria-hidden="true"><Ticket size={14} /></span>
                    الإجراء
                  </span>
                </th>
                {spaces.map((s) => (
                  <td key={s.id}>
                    {s.instant_booking ? (
                      <Link className="cmp-book" to={`/ads/${s.id}`}>حجز فوري</Link>
                    ) : (
                      <span className="cmp-book is-off">غير متاح</span>
                    )}
                  </td>
                ))}
        </tr>
            </tfoot>
          </table>
        </div>
      )}
      {(!isNarrow || open) && mainRows.length === 0 && (
        <p className="cmp-table__none">لا فروق بين المساحات المختارة في أي معيار.</p>
      )}
    </section>
  );
});

const Row = memo(function Row({ row, spaces }) {
  const raw = spaces.map(row.pick);
  const present = raw.filter((v) => Number.isFinite(v));
  const sentinel = present.length
    ? (row.better === 'min' ? Math.max(...present) * 1000 : Math.max(1, Math.min(...present) / 1000))
    : 0;
  const values = raw.map((v) => (Number.isFinite(v) ? v : sentinel));
  const pcts = normalizeRow(values, { log: !!row.log, lowerIsBetter: row.better === 'min' });

  const sizeOf = (v) => (Array.isArray(v) ? v.length : v);
  let bestIdx = -1;
  if (row.better === 'min' && present.length) {
    bestIdx = raw.findIndex((v) => Number.isFinite(v) && v === Math.min(...present));
  } else if (row.better === 'max' && present.length) {
    bestIdx = raw.findIndex((v) => Number.isFinite(v) && v === Math.max(...present));
  } else if (row.better === 'count') {
    const counts = raw.map((v) => (Array.isArray(v) ? v.length : 0));
    const hi = Math.max(...counts);
    if (hi > 0) bestIdx = counts.indexOf(hi);
  }
  const bestSize = bestIdx >= 0 ? sizeOf(raw[bestIdx]) : null;
  const varied = bestIdx >= 0 && present.some((v) => sizeOf(v) !== bestSize);

  return (
    <tr>
      <th scope="row" className="cmp-table__metric">
        <span className="cmp-table__metric-label">
          {row.icon && (
            <span className="cmp-table__rowicon" aria-hidden="true">
        <row.icon size={14} />
            </span>
          )}
          {row.label}
        </span>
      </th>
      {spaces.map((s, i) => {
        const has = Number.isFinite(raw[i]);
        const isBest = i === bestIdx;
        const isWorst = varied && !isBest && sizeOf(raw[i]) !== bestSize;
        const showBar = bestIdx >= 0 && present.length > 1 && row.better !== undefined;
        return (
          <td
            key={s.id}
            className={`cmp-table__cell${isBest ? ' is-best' : ''}${isWorst ? ' is-worst' : ''}`}
          >
            <span className="cmp-table__val">
        {isBest && <Award size={13} className="cmp-table__award" />}
        {isWorst && <AlertTriangle size={13} className="cmp-table__warn" />}
        {row.fmt ? row.fmt(raw[i]) : String(raw[i])}
            </span>
            {showBar && (
        <span className="cmp-table__bar" aria-hidden="true">
                <span
                  className={`cmp-table__bar-fill${isBest ? ' is-best' : ''}${isWorst ? ' is-worst' : ''}`}
                  style={{ width: `${has ? Math.max(pcts[i] * 100, 2) : 0}%` }}
                />
        </span>
            )}
          </td>
        );
      })}
    </tr>
  );
});
