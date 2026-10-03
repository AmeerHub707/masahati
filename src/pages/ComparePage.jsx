import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, Reorder, useDragControls } from 'framer-motion';
import {
  Award, Building2, CalendarCheck2, Check, ChevronLeft, ChevronRight,
  Clock, Crown, Equal, Gauge, GripVertical, HandCoins, LayoutDashboard, Lightbulb,
  MapPin, MessageSquareQuote, Receipt, Scale, Search, Sparkles, Star, Ticket, TrendingUp,
  Trophy, Users, Wallet, X,
} from 'lucide-react';
import { loadAllSpacesWithFallback, SPACE_CATEGORIES } from '../lib/spaces';
import { AMENITY_LABELS } from '../lib/requests';
import ThemeToggle from '../components/common/ThemeToggle';
import { fmtNumber, fmtRating, fmtMoney } from '../lib/format';
import { getHomePath, getCurrentRole, isVisitor } from '../lib/authStore';
import {
  pricePerHead,
  buildCompareContext,
  scoreAll,
  normalizeRow,
} from '../lib/compareScore';

const MAX_PICK = 4;
const MIN_PICK = 2;

const catLabel = (id) => (SPACE_CATEGORIES.find((c) => c.id === id) || {}).label || '';
const amenityText = (list) =>
  (Array.isArray(list) ? list : []).map((a) => AMENITY_LABELS[a]).filter(Boolean).join('، ') || '—';
const hoursText = (s) => (s.open_time && s.close_time ? `${s.open_time} – ${s.close_time}` : s.open_time || '');
const toNum = (v) => (typeof v === 'number' ? v : Number(v));

// A tie used to hand the row to the leftmost column, so a winner sitting on the
// right lost every reason it had earned. `prefer` lets the winner keep its tie.
function bestIndexFor(row, values, prefer = -1) {
  if (!row.better) return -1;
  const pick = (candidates) => (candidates.includes(prefer) ? prefer : candidates[0] ?? -1);
  if (row.better === 'count') {
    // المصفوفة في الجدول والعدد في الرسوم: نقبل الشكلين
    const counts = values.map((v) => {
      const n = Array.isArray(v) ? v.length : toNum(v);
      return Number.isFinite(n) ? n : 0;
    });
    const hi = counts.length ? Math.max(...counts) : 0;
    if (hi <= 0) return -1;
    return pick(counts.map((c, i) => (c === hi ? i : -1)).filter((i) => i >= 0));
  }
  // null must stay absent, not become 0: two spaces with no data used to look
  // like two equal zeros, and one of them was then badged "الأفضل".
  const nums = values.map((v) => (v == null || v === '' ? NaN : toNum(v)));
  const finite = nums.filter(Number.isFinite);
  if (!finite.length) return -1;
  const target = row.better === 'min' ? Math.min(...finite) : Math.max(...finite);
  return pick(nums.map((v, i) => (Number.isFinite(v) && v === target ? i : -1)).filter((i) => i >= 0));
}

const ROW_GROUPS = [
  {
    id: 'cost',
    label: 'الكلفة',
    rows: [
      { id: 'perHead', label: 'السعر لكل شخص', pick: pricePerHead, num: (s) => {
        const v = pricePerHead(s);
        return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      }, fmt: fmtMoney, better: 'min', log: true, icon: Receipt },
      { id: 'price', label: 'السعر بالساعة', pick: (s) => Number(s.price_per_hour) || 0,
        num: (s) => Number(s.price_per_hour) || 0, fmt: fmtNumber, better: 'min', icon: Wallet },
    ],
  },
  {
    id: 'trust',
    label: 'الثقة',
    rows: [
      { id: 'rating', label: 'التقييم', pick: (s) => Math.max(0, Math.min(5, Number(s.rating) || 0)),
        num: (s) => Math.max(0, Math.min(5, Number(s.rating) || 0)), fmt: fmtRating, better: 'max', icon: Star },
      { id: 'reviews', label: 'عدد التقييمات', pick: (s) => Number(s.review_count) || 0,
        num: (s) => Number(s.review_count) || 0, fmt: fmtNumber, better: 'max', log: true, icon: MessageSquareQuote },
    ],
  },
  {
    id: 'fit',
    label: 'المساحة',
    rows: [
      { id: 'capacity', label: 'السعة القصوى', pick: (s) => Number(s.capacity) || 0,
        num: (s) => Number(s.capacity) || 0, fmt: fmtNumber, better: 'max', log: true, icon: Users },
      { id: 'amenities', label: 'المرافق', pick: (s) => (Array.isArray(s.amenities) ? s.amenities : []),
        num: (s) => (Array.isArray(s.amenities) ? s.amenities.length : 0), fmt: amenityText, better: 'count', icon: Sparkles },
    ],
  },
  {
    id: 'about',
    label: 'التفاصيل',
    rows: [
      { id: 'category', label: 'نوع المساحة', pick: (s) => catLabel(s.category) || '—', icon: Building2 },
      { id: 'area', label: 'المنطقة', pick: (s) => s.area || s.location || '—', icon: MapPin },
      { id: 'hours', label: 'أوقات العمل', pick: (s) => hoursText(s) || '—', icon: Clock },
      { id: 'instant', label: 'الحجز الفوري', pick: (s) => (s.instant_booking ? 'متاح' : 'غير متاح'), icon: CalendarCheck2 },
    ],
  },
];

const OWNER_GROUP = {
  id: 'owner',
  label: 'مؤشرات المالك',
  note: 'أرقام تشغيلية خاصة بصاحب المساحة، لا تدخل في الترتيب',
  rows: [
    { id: 'bookings', label: 'الحجوزات الشهرية', pick: (s) => Number(s.stats?.bookings) || 0,
      num: (s) => Number(s.stats?.bookings) || 0, fmt: fmtNumber, better: 'max', log: true, icon: Ticket },
    { id: 'revenue', label: 'الإيراد الشهري', pick: (s) => Number(s.stats?.revenue) || 0,
      num: (s) => Number(s.stats?.revenue) || 0, fmt: fmtMoney, better: 'max', log: true, icon: HandCoins },
    { id: 'occupancy', label: 'معدل الإشغال', pick: (s) => Math.max(0, Math.min(100, Number(s.stats?.occupancy) || 0)),
      num: (s) => Math.max(0, Math.min(100, Number(s.stats?.occupancy) || 0)), fmt: (v) => `${fmtNumber(v)}٪`, better: 'max', icon: TrendingUp },
  ],
};

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const [allSpaces, setAllSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [demo, setDemo] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [tableOpen, setTableOpen] = useState(false);
  const toggleTable = useCallback(() => setTableOpen((v) => !v), []);
  const searchRef = useRef(null);

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

  // The URL is the source of truth, but it can be stale or hand-written:
// an unknown id used to survive into selectedIds while the board renders only
// what the catalog knows, so Reorder.Group got more values than it had children.
// Unknowns and duplicates are dropped as soon as the catalog is known.
const selectedIds = useMemo(() => {
  const raw = params.getAll('sp').slice(0, MAX_PICK).map(String);
  const unique = [...new Set(raw)];
  if (!allSpaces.length) return unique;
  const known = new Set(allSpaces.map((s) => String(s.id)));
  return unique.filter((id) => known.has(id));
}, [params, allSpaces]);

  const selected = useMemo(() => {
    const map = new Map(allSpaces.map((s) => [String(s.id), s]));
    return selectedIds.map((id) => map.get(String(id))).filter(Boolean);
  }, [allSpaces, selectedIds]);

  const ctx = useMemo(() => buildCompareContext(allSpaces), [allSpaces]);
  const scored = useMemo(() => scoreAll(selected, ctx), [selected, ctx]);
  const scoredSpaces = useMemo(() => scored.map((x) => x.space), [scored]);
  const scoresById = useMemo(
    () => new Map(scored.map((x) => [String(x.space.id), x.score])),
    [scored]
  );
  const winnerId = useMemo(() => scored.find((x) => x.isWinner)?.space.id, [scored]);
  const ready = scored.length >= MIN_PICK;
  const full = selectedIds.length >= MAX_PICK;
  const takenIds = useMemo(() => new Set(selectedIds), [selectedIds]);
  const membershipKey = useMemo(() => [...selectedIds].sort().join('|'), [selectedIds]);

  const trayList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSpaces.filter(
      (s) => !q || `${s.title} ${s.location} ${s.area} ${catLabel(s.category)}`.toLowerCase().includes(q)
    );
  }, [allSpaces, query]);

  const spread = useMemo(() => normalizeRow(scored.map((x) => x.score), {}), [scored]);

  const winnerReasons = useMemo(() => {
    const idx = scoredSpaces.findIndex((s) => String(s.id) === String(winnerId));
    if (idx < 0) return [];
    return ROW_GROUPS
      .flatMap((g) => g.rows)
      .filter((row) => row.better && bestIndexFor(row, scoredSpaces.map(row.pick), idx) === idx)
      .map((row) => row.label);
  }, [scoredSpaces, winnerId]);

  const saving = useMemo(() => {
    const prices = scoredSpaces.map((s) => Number(s.price_per_hour) || 0).filter((p) => p > 0);
    if (prices.length < 2) return 0;
    const win = Number(scoredSpaces.find((s) => String(s.id) === String(winnerId))?.price_per_hour) || 0;
    return Math.max(0, Math.max(...prices) - win);
  }, [scoredSpaces, winnerId]);

  // setParams with a flat list replaces the whole query string, so any other
// param (?from, ?cat, ...) was silently dropped on the first selection change.
const writeIds = useCallback(
  (ids) => {
    const rest = [];
    params.forEach((value, key) => {
      if (key !== 'sp') rest.push([key, value]);
    });
    setParams([...rest, ...ids.map((x) => ['sp', String(x)])]);
  },
  [params, setParams]
);

  const add = (id) => {
    if (full) return;
    const space = allSpaces.find((s) => String(s.id) === String(id));
    writeIds([...selectedIds, String(id)]);
    setAnnounce(`أُضيفت ${space?.title || 'المساحة'} إلى المقارنة`);
  };

  const remove = (id) => {
    const space = allSpaces.find((s) => String(s.id) === String(id));
    writeIds(selectedIds.filter((x) => x !== String(id)));
    setAnnounce(`أُزيلت ${space?.title || 'المساحة'} من المقارنة`);
  };

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
    setAnnounce('أُعيد ترتيب المساحات');
  };

  const clearAll = () => {
    setParams([]);
    setQuery('');
    setAnnounce('أُفرغت المقارنة');
  };

  const focusSearch = () => {
    if (searchRef.current) searchRef.current.focus();
  };

  const winnerSpace = scoredSpaces.find((s) => String(s.id) === String(winnerId));

  return (
    <div className="cmp-page">
      {/* القسم الأول: الشعار يميناً بلا خلفية، والشارة يساراً، ثم خط فاصل خفيف */}
      <section className="cmp-topbar">
        <div className="wrap wrap--wide cmp-topbar__inner">
          <span className="cmp-topbar__logo">
            <img src="/Mlogo.png" alt="مساحاتي" width="542" height="460" decoding="async" />
          </span>

          <div className="cmp-topbar__end">
            <p className="cmp-topbar__pill">
              <Scale size={14} strokeWidth={2.5} aria-hidden="true" />
              مقارنة المساحات
            </p>

            <ThemeToggle />

            <Link
              className="cmp-back"
              to={getHomePath(getCurrentRole())}
              aria-label={isVisitor() ? 'العودة إلى الصفحة الرئيسية' : 'العودة إلى لوحة التحكم'}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* القسم الثاني: العنوان مستقل، وعمود الإحصائيات على يساره من خلفية الصفحة */}
      <section className="cmp-hero">
        <img
          className="cmp-hero__chart"
          src="/Stat-Chart.png"
          alt=""
          aria-hidden="true"
          width="512"
          height="512"
          decoding="async"
        />

        <div className="wrap wrap--wide cmp-hero__inner">
          <div className="cmp-hero__mid">
            <h1 className="cmp-title">قارن بين المساحات واختر الأنسب</h1>
            <p className="cmp-sub">
              اختر من {fmtNumber(MIN_PICK)} إلى {fmtNumber(MAX_PICK)} مساحات، ورتّبها بالترتيب الذي يناسبك
              {demo && <em className="cmp-badge-demo">وضع تجريبي</em>}
            </p>
          </div>
        </div>
      </section>

      <main className="wrap wrap--wide cmp-main">
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>

        <section className="cmp-picker" aria-label="اختيار المساحات للمقارنة">
          <div className="cmp-picker__bar">
            <div className="cmp-search">
              <Search className="cmp-search__icon" size={17} aria-hidden="true" />
              <input
                ref={searchRef}
                className="cmp-search__input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بالاسم، المنطقة، أو النوع..."
                aria-label="البحث في المساحات للمقارنة"
              />
              {query && (
                <button
                  type="button"
                  className="cmp-search__clear"
                  onClick={() => setQuery('')}
                  aria-label="مسح البحث"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="cmp-picker__tools">
              <span className="cmp-counter" title={ready ? `العدد جاهز (${selected.length}/${MAX_PICK})` : `اختر من ${MIN_PICK} إلى ${MAX_PICK} مساحات`}
                    role="status" aria-live="polite">
                <span className={`cmp-counter__dot${ready ? ' is-ok' : ''}`} />
                <b>{fmtNumber(selected.length)}</b>
                <small>/ {fmtNumber(MAX_PICK)}</small>
              </span>
              {selected.length > 0 && (
                <button type="button" className="btn-ghost cmp-clear" onClick={clearAll}>
                  <X size={15} aria-hidden="true" /> مسح الكل
                </button>
              )}
            </div>
          </div>

          {!loading && (
            <div className="cmp-pills" role="group" aria-label="كل المساحات المتاحة للمقارنة">
              {full && <p className="cmp-pills__note">اكتمل الحد الأقصى للمقارنة</p>}
              {!full && trayList.length === 0 && (
                <p className="cmp-pills__note">لا نتائج مطابقة للبحث</p>
              )}
{trayList.map((s) => {
                const picked = takenIds.has(String(s.id));
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`cmp-pill${picked ? ' is-on' : ''}`}
                    onClick={() => (picked ? remove(s.id) : add(s.id))}
                    disabled={!picked && full}
                    aria-pressed={picked}
                  >
                    <span className="cmp-pill__icon" aria-hidden="true">
                      {picked ? <Check size={14} /> : <Building2 size={14} />}
                    </span>
                    <span className="cmp-pill__name">{s.title}</span>
                    <span className="cmp-pill__meta">{fmtNumber(s.price_per_hour)} ش.ج</span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="cmp-hint">
            <Lightbulb size={16} aria-hidden="true" />
            اختر مساحات من أنواع أو مناطق مختلفة، فالمقارنة أدقّ كلما اختلفت.
          </p>
        </section>

        <section className="cmp-board" aria-label="المساحات المختارة للمقارنة">
          {loading ? (
            <div className="cmp-board__list">
              {Array.from({ length: MIN_PICK }).map((_, i) => (
                <div key={i} className="cmp-skel" aria-hidden="true" />
              ))}
            </div>
          ) : selected.length === 0 ? (
            <div className="cmp-empty">
              <span className="cmp-empty__icon" aria-hidden="true"><Scale size={40} /></span>
              <h3 className="cmp-empty__title">اختر مساحات لتقارنها</h3>
              <p className="cmp-empty__text">
                أضف من {fmtNumber(MIN_PICK)} إلى {fmtNumber(MAX_PICK)} مساحات من القائمة أعلاه لتبدأ المقارنة.
              </p>
              <button type="button" className="btn-primary" onClick={focusSearch}>
                <Search size={17} aria-hidden="true" /> ابدأ البحث
              </button>
            </div>
          ) : (
            <Reorder.Group
              axis="x"
              values={selectedIds}
              onReorder={onReorder}
              className="cmp-board__list"
              as="ul"
            >
              {scored.map(({ space, isWinner }, i) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  score={scoresById.get(String(space.id)) ?? 0}
                  isWinner={isWinner}
                  index={i}
                  total={selectedIds.length}
                  onMove={move}
                  onRemove={remove}
                />
              ))}
            {!full && (
              <li className="cmp-card cmp-card--add">
                <button type="button" onClick={focusSearch}>
                  <Search size={20} aria-hidden="true" />
                  <span>أضف مساحة</span>
                </button>
              </li>
            )}
          </Reorder.Group>
          )}

          {!loading && selected.length === 1 && (
            <div className="cmp-empty cmp-empty--slim">
              <span className="cmp-empty__icon" aria-hidden="true"><Sparkles size={34} /></span>
              <h3 className="cmp-empty__title">مساحة واحدة فقط… اختر غيرها</h3>
              <p className="cmp-empty__text">المقارنة تحتاج مساحتين على الأقل. أضف واحدة أخرى من القائمة.</p>
            </div>
          )}
        </section>

        {ready && (
          <motion.div
            key={membershipKey}
            className="cmp-stack"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Verdict
              spaces={scoredSpaces}
              winnerId={winnerId}
              winnerSpace={winnerSpace}
              scores={scored.map((x) => x.score)}
              spread={spread}
              reasons={winnerReasons}
              saving={saving}
            />

            <CompareViews
              spaces={scoredSpaces}
              winnerId={winnerId}
            />

            <Matrix
              spaces={scoredSpaces}
              winnerId={winnerId}
              open={tableOpen}
              onToggleOpen={toggleTable}
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}

function SpaceCard({ space, score, isWinner, index, total, onMove, onRemove }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={String(space.id)}
      dragListener={false}
      dragControls={controls}
      className={`cmp-card${isWinner ? ' is-winner' : ''}`}
    >
      {isWinner && (
        <span className="cmp-card__crown" title="الأفضل إجمالاً">
          <Crown size={13} aria-hidden="true" />
        </span>
      )}

      <div className="cmp-card__media">
        {space.image ? (
          <img className="cmp-card__img" src={space.image} alt="" loading="lazy" />
        ) : (
          <Building2 size={24} aria-hidden="true" />
        )}
        <span className="cmp-card__rank">#{fmtNumber(index + 1)}</span>
      </div>

      <div className="cmp-card__body">
        <h3 className="cmp-card__name" title={space.title}>{space.title}</h3>

        <p className="cmp-card__price">
          <b>{fmtNumber(space.price_per_hour)}</b>
          <span>ش.ج/ساعة</span>
        </p>

        <div className="cmp-card__bar" title="مؤشر القيمة الإجمالي">
          <span className="cmp-card__bar-fill" style={{ width: `${Math.max(0, Math.min(100, Number(score) || 0))}%` }} />
        </div>

        <p className="cmp-card__meta">
          {[catLabel(space.category), space.area || space.location].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>

      <div className="cmp-card__score" title="مؤشر القيمة الإجمالي">
        <ScoreRing score={score} />
      </div>

      <div className="cmp-card__tools">
        <button
          type="button"
          className="cmp-card__btn"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          aria-label={`نقل ${space.title} إلى العمود السابق`}
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="cmp-card__btn"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          aria-label={`نقل ${space.title} إلى العمود التالي`}
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="cmp-card__btn"
          onPointerDown={(e) => controls.start(e)}
          aria-label={`اسحب لإعادة ترتيب ${space.title}`}
        >
          <GripVertical size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="cmp-card__btn is-danger"
          onClick={() => onRemove(space.id)}
          aria-label={`إزالة ${space.title}`}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </Reorder.Item>
  );
}

const ScoreRing = memo(function ScoreRing({ score, size = 62 }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <span className="cmp-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <circle className="cmp-ring__track" cx="32" cy="32" r={r} strokeWidth="7" fill="none" />
        <motion.circle
          className="cmp-ring__fill"
          cx="32"
          cy="32"
          r={r}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <b className="cmp-ring__val">{fmtNumber(pct)}</b>
    </span>
  );
});

const Verdict = memo(function Verdict({ spaces, winnerId, winnerSpace, scores, spread, reasons, saving }) {
  return (
    <section className="cmp-verdict" aria-label="الخلاصة وأفضل اختيار">
      <div className="cmp-verdict__main">
        <p className="cmp-verdict__kicker">
          <Trophy size={15} aria-hidden="true" /> الأفضل إجمالاً
        </p>
        <h2 className="cmp-verdict__name">{winnerSpace?.title}</h2>
        <ul className="cmp-verdict__why">
          {reasons.length > 0 ? (
            reasons.slice(0, 4).map((label) => (
              <li key={label}>
                <Check size={14} aria-hidden="true" /> الأفضل في {label}
              </li>
            ))
          ) : (
            <li><Check size={14} aria-hidden="true" /> الأعلى في مؤشر القيمة الإجمالي</li>
          )}
          {reasons.length > 4 && (
            <li><Check size={14} aria-hidden="true" /> … و+{reasons.length - 4} أكثر</li>
          )}
          {saving > 0 && (
            <li><Wallet size={14} aria-hidden="true" /> أوفر بـ {fmtMoney(saving)} ش.ج/ساعة من الأغلى</li>
          )}
        </ul>
      </div>

      <div className="cmp-verdict__side">
        <div className="cmp-spread" aria-label="مؤشر القيمة لكل مساحة">
          {spaces.map((s, i) => {
            const best = String(s.id) === String(winnerId);
            return (
              <div key={s.id} className={`cmp-spread__row${best ? ' is-best' : ''}`}>
                <span className="cmp-spread__name" title={s.title}>{s.title}</span>
                <span className="cmp-spread__track" aria-hidden="true">
                  <motion.span
                    className="cmp-spread__fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max((spread[i] || 0) * 100, 3)}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
                <Link to={`/ads/${s.id}`} className="cmp-spread__book" aria-label={`احجز ${s.title}`}>احجز</Link>
                <b className="cmp-spread__val">{fmtNumber(scores[i])}</b>
              </div>
            );
          })}
        </div>
        <Link className="btn-primary cmp-verdict__cta" to={`/ads/${winnerId}`}>
          <CalendarCheck2 size={18} aria-hidden="true" /> احجز {winnerSpace?.title}
        </Link>
      </div>
    </section>
  );
});
const MIN_TAG = 'الأقل أفضل';
const MAX_TAG = 'الأكثر أفضل';
const SECTION_LABELS = ['السعر والتقييم', 'السعة والمرافق'];

// Only four metrics carry the comparison, in priority order.
const VIZ_METRIC_IDS = ['capacity', 'price', 'amenities', 'rating'];

const EASE = [0.22, 1, 0.36, 1];
const pctOf = (p) => `${Math.max(0, Math.min(1, Number(p) || 0)) * 100}%`;
function useVizGroups(spaces) {
  return useMemo(
    () => {
      const all = [...ROW_GROUPS, OWNER_GROUP];
      const picked = [];
      VIZ_METRIC_IDS.forEach((id) => {
        const src = all.find((g) => g.rows.some((r) => r.id === id));
        const row = src && src.rows.find((r) => r.id === id);
        if (!row) return;
        let group = picked.find((p) => p.id === src.id);
        if (!group) {
          group = { id: src.id, label: src.label, note: src.note, rows: [] };
          picked.push(group);
        }
        group.rows.push(row);
      });

      return picked
        .map((group) => ({
          ...group,
          rows: group.rows.map((row) => {
            const values = spaces.map((s) => {
              const v = row.num(s);
              return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
            });
            const nums = values.map((v) => (Number.isFinite(v) ? v : 0));
            return {
              ...row,
              fmt: row.fmt || fmtNumber,
              // plain number for chart labels: never a dash
              numText: (v) => (Number.isFinite(v) ? fmtNumber(v) : '0'),
              values,
              nums,
              pcts: normalizeRow(nums, { log: !!row.log, lowerIsBetter: row.better === 'min' }),
              bestIdx: bestIndexFor(row, nums),
            };
          }),
        }))
        .filter((g) => g.rows.length > 0);
    },
    [spaces]
  );
}

const CompareViews = memo(function CompareViews({ spaces, winnerId }) {
  const groups = useVizGroups(spaces);

  return (
    <section className="cmp-views" aria-label="عروض المقارنة">
      <div className="cmp-views__bar">
        <h2 className="cmp-section-title">
          <LayoutDashboard size={18} aria-hidden="true" /> عرض المقارنات
        </h2>
      </div>

      <QuadPanel spaces={spaces} winnerId={winnerId} groups={groups} />
    </section>
  );
});
// Two rows, two squares each: a pill column and a donut column.
// Row 1: price per hour | feedbacks.  Row 2: capacity | services.
const QUAD_LAYOUT = [
  [{ id: 'price', type: 'vbars' }, { id: 'rating', type: 'donut' }],
  [{ id: 'capacity', type: 'pills' }, { id: 'amenities', type: 'axis' }],
];

const QuadPanel = memo(function QuadPanel({ spaces, winnerId, groups }) {
  const byId = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => g.rows.forEach((r) => map.set(r.id, { ...r, groupLabel: g.label })));
    return map;
  }, [groups]);

  return (
    <div className="cmp-quad">
      {QUAD_LAYOUT.map((rowCells, ri) => (
        <section key={ri} className="cmp-quad__row" aria-label={SECTION_LABELS[ri]}>
          {rowCells.map((cell) => {
            const r = byId.get(cell.id);
            if (!r) return null;
            return (
              <article key={cell.id} className={`cmp-qcard cmp-qcard--${cell.type}`}>
                <header className="cmp-qcard__head">
                  {r.icon && <r.icon size={15} aria-hidden="true" />}
                  <b>{r.label}</b>
                  <span className="cmp-qcard__tag">
                    {r.better === 'min' ? MIN_TAG : MAX_TAG}
                  </span>
                </header>

                {cell.type === 'pills' && (
                  <div className="cmp-qpills">
                    {spaces.map((s, i) => {
                      const best = i === r.bestIdx;
                      return (
                        <div
                          key={s.id}
                          className={`cmp-qpill${best ? ' is-best' : ''}${String(s.id) === String(winnerId) ? ' is-win' : ''}`}
                          title={s.title}
                        >
                          <span
                            className="cmp-qpill__fill"
                            style={{ width: pctOf(r.pcts[i]) }}
                            aria-hidden="true"
                          />
                          <span className="cmp-qpill__name">{s.title}</span>
                          <b className="cmp-qpill__val">{r.numText(r.values[i])}</b>
                        </div>
                      );
                    })}
                  </div>
                )}

                {cell.type === 'vbars' && (
                  <>
                    <div className="cmp-qvcols">
                      {spaces.map((s, i) => {
                        const best = i === r.bestIdx;
                        return (
                          <div
                            key={s.id}
                            className={`cmp-qvcol${best ? ' is-best' : ''}${String(s.id) === String(winnerId) ? ' is-win' : ''}`}
                          >
                            <span className="cmp-qvcol__val">{r.numText(r.values[i])}</span>
                            <span className="cmp-qvcol__track">
                              <motion.span
                                className="cmp-qvcol__fill"
                                initial={{ height: 0 }}
                                animate={{ height: pctOf(r.pcts[i]) }}
                                transition={{ duration: 0.55, ease: EASE }}
                              />
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="cmp-qnames">
                      {spaces.map((s, i) => (
                        <span
                          key={s.id}
                          className={`cmp-qname${i === r.bestIdx ? ' is-best' : ''}${String(s.id) === String(winnerId) ? ' is-win' : ''}`}
                          title={s.title}
                        >
                          {s.title}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {cell.type === 'axis' && (
                  <AxisChart spaces={spaces} row={r} winnerId={winnerId} />
                )}

                {cell.type === 'donut' && (
                  <div className="cmp-qcard__set">
                    {spaces.map((s, i) => (
                      <div
                        key={s.id}
                        className={`cmp-dunit${r.bestIdx === i ? ' is-best' : ''}${String(s.id) === String(winnerId) ? ' is-win' : ''}`}
                      >
                        <span className="cmp-dunit__name" title={s.title}>{s.title}</span>
                        <Donut pct={r.pcts[i]} best={r.bestIdx === i} label={s.title}>
                          {r.numText(r.values[i])}
                        </Donut>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
});
// A round axis: the top gridline always sits on a friendly number, and the
// middle gridline is exactly half of it, so the scale reads true.
const niceStep = (v) => (v <= 5 ? 1 : v <= 10 ? 2 : v <= 25 ? 5 : v <= 50 ? 10 : 20);

// The mid gridline is pinned at 50% of the field, so the top has to stay even:
// an odd top prints a fraction (1.5, 2.5) on a line that is not there.
// Odd maxima are the common case, not the exception — amenity counts are small.
function axisScale(values) {
  const nums = values.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));
  const max = Math.max(0, ...nums);
  if (max <= 0) return { top: 2, ticks: [2, 1, 0] };
  const step = niceStep(max);
  let top = Math.max(step, Math.ceil(max / step) * step);
  if (top % 2 !== 0) top += step;
  return { top, ticks: [top, top / 2, 0] };
}

// Services as a real X/Y chart: value row, plotted field, then the space names.
const AxisChart = memo(function AxisChart({ spaces, row, winnerId }) {
  const values = row.nums;
  const { top, ticks } = axisScale(values);

  return (
    <div className="cmp-axis" style={{ '--cmp-cols': spaces.length }}>
      <div className="cmp-axis__r">
        <span className="cmp-axis__pad" aria-hidden="true" />
        {spaces.map((s, i) => (
          <b
            key={s.id}
            className={`cmp-axis__val${row.bestIdx === i ? ' is-best' : ''}`}
          >
            {row.numText(values[i])}
          </b>
        ))}
      </div>

      <div className="cmp-axis__r">
        <span className="cmp-axis__y" aria-hidden="true">
          {ticks.map((tv, ti) => (
            <span key={ti} className={`cmp-axis__ytick is-${ti}`}>{row.numText(tv)}</span>
          ))}
        </span>

        <span className="cmp-axis__field">
          <span className="cmp-axis__line is-top" />
          <span className="cmp-axis__line is-mid" />
          <span className="cmp-axis__line is-base" />
          <span className="cmp-axis__cols">
            {spaces.map((s, i) => {
              const best = i === row.bestIdx;
              const v = Number.isFinite(values[i]) ? Math.max(0, values[i]) : 0;
              return (
                <span
                  key={s.id}
                  className={`cmp-axis__col${best ? ' is-best' : ''}${String(s.id) === String(winnerId) ? ' is-win' : ''}`}
                >
                  <motion.span
                    className={`cmp-axis__bar${v <= 0 ? ' is-zero' : ''}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${(v / top) * 100}%` }}
                    transition={{ duration: 0.55, ease: EASE }}
                  />
                </span>
              );
            })}
          </span>
        </span>
      </div>

      <div className="cmp-axis__r">
        <span className="cmp-axis__pad" aria-hidden="true" />
        {spaces.map((s) => (
          <span key={s.id} className="cmp-axis__name" title={s.title}>{s.title}</span>
        ))}
      </div>
    </div>
  );
});
const Donut = memo(function Donut({ pct, best, label, children }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const on = Math.max(0.02, Math.min(1, Number(pct) || 0));
  return (
    <span className={`cmp-donut${best ? ' is-best' : ''}`} title={label}>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r={R} className="cmp-donut__track" />
        <circle
          cx="32" cy="32" r={R} className="cmp-donut__fill"
          style={{ strokeDasharray: `${on * C} ${C}` }}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="cmp-donut__mid">{children}</span>
    </span>
  );
});
// The full metric table: every metric, owner indicators and the booking row.
// Collapsed by default on every screen size; the summary above stays visible.
const Matrix = memo(function Matrix({ spaces, winnerId, open, onToggleOpen }) {
  const visible = { groups: ROW_GROUPS, owner: OWNER_GROUP.rows };

  return (
    <section className="cmp-matrix" aria-label="جدول المقارنة الكامل">
      <div className="cmp-matrix__head">
        <h2 className="cmp-section-title">
          <Gauge size={18} aria-hidden="true" /> جدول المقارنة الكامل
        </h2>
        <div className="cmp-matrix__tools">
          <button type="button" className="btn-ghost cmp-matrix__disclose" onClick={onToggleOpen}
            aria-expanded={open}
          >
            <Equal size={15} aria-hidden="true" /> {open ? 'إخفاء الجدول' : 'عرض الجدول'}
          </button>
        </div>
      </div>

      {open && (
        <div className="cmp-matrix__scroll">
          <table className="cmp-matrix__grid">
            <caption className="sr-only">
              مقارنة تفصيلية بين {fmtNumber(spaces.length)} مساحات. كل صف مطبَّع على مدى الصف نفسه، والأخضر هو الأفضل في ذلك المعيار.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="cmp-matrix__metric-head">المعيار</th>
                {spaces.map((s) => (
                  <th
                    key={s.id}
                    scope="col"
                    className={`cmp-matrix__space${String(s.id) === String(winnerId) ? ' is-winner' : ''}`}
                  >
                    {String(s.id) === String(winnerId) && <Crown size={13} aria-hidden="true" />}
                    <span title={s.title}>{s.title}</span>
                  </th>
                ))}
              </tr>
            </thead>

            {visible.groups.map((group) => (
              <tbody key={group.id}>
                <tr className="cmp-matrix__grouprow">
                  <th scope="colgroup" colSpan={spaces.length + 1}>{group.label}</th>
                </tr>
                {group.rows.map((row) => (
                  <MetricRow key={row.id} row={row} spaces={spaces} winnerId={winnerId} />
                ))}
              </tbody>
            ))}

            {visible.owner.length > 0 && (
              <>
                <tbody className="cmp-matrix__grouprow cmp-matrix__grouprow--owner">
                  <tr>
                    <th scope="colgroup" colSpan={spaces.length + 1}>
                      <span className="cmp-matrix__ownertag">
                        <HandCoins size={14} aria-hidden="true" /> {OWNER_GROUP.label}
                        <em>{OWNER_GROUP.note}</em>
                      </span>
                    </th>
                  </tr>
                </tbody>
                <tbody>
                  {visible.owner.map((row) => (
<MetricRow key={row.id} row={row} spaces={spaces} winnerId={winnerId} />
                  ))}
                </tbody>
              </>
            )}

            <tfoot>
              <tr>
                <th scope="row" className="cmp-matrix__metric">
                  <span className="cmp-matrix__label">
                    <span className="cmp-matrix__rowicon" aria-hidden="true"><Ticket size={14} /></span>
                    الإجراء
                  </span>
                </th>
                {spaces.map((s) => (
                  <td
                    key={s.id}
                    className={`cmp-matrix__cell${String(s.id) === String(winnerId) ? ' is-winner' : ''}`}
                  >
                    {s.instant_booking ? (
                      <Link className="cmp-matrix__book" to={`/ads/${s.id}`}>حجز فوري</Link>
                    ) : (
                      <span className="cmp-matrix__book is-off">غير متاح</span>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
});

const MetricRow = memo(function MetricRow({ row, spaces, winnerId }) {
  const values = spaces.map(row.pick);
  const bestIdx = bestIndexFor(row, values);

  const sizeOf = (v) => (Array.isArray(v) ? v.length : v);
  const bestSize = bestIdx >= 0 ? sizeOf(values[bestIdx]) : null;
  const numeric = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).length > 1;
  const varied = bestIdx >= 0 && numeric && values.some((v) => sizeOf(v) !== bestSize);

  const barPcts = useMemo(() => {
    if (bestIdx < 0 || !numeric) return null;
    return normalizeRow(values.map(toNum), { log: !!row.log, lowerIsBetter: row.better === 'min' });
  }, [values, bestIdx, numeric, row.log, row.better]);

  return (
    <tr>
      <th scope="row" className="cmp-matrix__metric">
        <span className="cmp-matrix__label">
          {row.icon && (
            <span className="cmp-matrix__rowicon" aria-hidden="true"><row.icon size={14} /></span>
          )}
          {row.label}
        </span>
      </th>
      {spaces.map((s, i) => {
        const isBest = i === bestIdx;
        const isLow = varied && !isBest && sizeOf(values[i]) !== bestSize;
        const isWinner = winnerId != null && String(s.id) === String(winnerId);
        return (
          <td
            key={s.id}
            className={`cmp-matrix__cell${isBest ? ' is-best' : ''}${isLow ? ' is-low' : ''}${isWinner ? ' is-winner' : ''}`}
          >
            <span className="cmp-matrix__val">
              {isBest && <Award size={13} className="cmp-matrix__award" aria-label="الأفضل في هذا المعيار" />}
              {values[i] == null
                ? '—'
                : row.fmt
                  ? row.fmt(values[i])
                  : String(values[i])}
            </span>
            {barPcts && (
              <span className="cmp-matrix__bar" aria-hidden="true">
                <span
                  className={`cmp-matrix__barfill${isBest ? ' is-best' : ''}${isLow ? ' is-low' : ''}`}
                  style={{ width: `${Math.max(barPcts[i] * 100, 2)}%` }}
                />
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
});
