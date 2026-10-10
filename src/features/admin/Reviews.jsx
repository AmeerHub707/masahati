import { useCallback, useMemo, useState } from 'react';
import {
  MessageSquareQuote,
  EyeOff,
  Trash2,
  Flag,
  Eye,
  Star,
  Search,
  X,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  RefreshCw,
  UserX,
  Download,
} from 'lucide-react';
import {
  StatCard,
  SectionCard,
  SectionHeading,
  StatusBadge,
  EmptyState,  Modal,
  Toast,
  btnGhost,
  btnDanger,
  btnPrimary,
  Pill,
  SmallAction,
  Stars,
  Avatar,
} from './ui';
import { useToast } from './useToast';
import useAdminData from './useAdminData';
import { listReviews, updateReview, deleteReview, isAdminTokenLive } from '@/lib/adminApi';
import { adaptReview, adaptAll } from '@/lib/adminAdapters';
import { arCount, AR_FORMS, normalizeAr, formatArDate } from '@/utils/format';
import { downloadCsv } from '@/utils/csv';

// شريط التبويب العلوي — اللون الدلالي يطابق لون شارة الحالة داخل البطاقة.
const filters = [
  { id: 'all', label: 'كل المراجعات', dot: '' },
  { id: 'flagged', label: 'مبلّغ عنها', dot: 'bg-red-500' },
  { id: 'hidden', label: 'مخفية', dot: 'bg-gray-400' },
];

const sortOptions = [
  { id: 'newest', label: 'الأحدث أولاً' },
  { id: 'lowest', label: 'الأقل تقييماً أولاً' },
  { id: 'highest', label: 'الأعلى تقييماً أولاً' },
];

const DEFAULT_SORT = 'newest';
const PAGE_SIZE = 6;
// «مجهول» اسم pseudonymous محجوز في البيانات الوهمية؛ أي اسم يبدأ به يُعامل كمراجعة مجهولة.
const ANONYMOUS = 'مجهول';
// النص الأطول من هذا يُقصّ ويُعرض زر «اقرأ المزيد» — العتبة تقريبية فلا نقيس DOM.
const LONG_TEXT = 150;

// تاريخ المراجعة قد يصل من الـ API بصيغة «YYYY-MM-DD» أو «YYYY-MM-DD HH:mm»؛
// Date.parse يغطّي الاثنتين، و|| 0 يبقي الفرز مستقراً بدل NaN إن غاب التاريخ.
const timeOf = (value) => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isAnonymous = (name) => normalizeAr(name).startsWith(ANONYMOUS);

// نص المراجعة: مقصوص عند الطول مع زر توسيع، حتى لا تفكّ مراجعة طويلة شبكة البطاقات.
function ReviewText({ text }) {
  const [open, setOpen] = useState(false);
  const long = String(text || '').length > LONG_TEXT;
  return (
    <div className="mt-3 flex-1">
      <p className={`dash__soft ${long && !open ? 'line-clamp-4' : ''}`}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-1 text-xs font-extrabold"
          style={{ color: 'var(--accent)' }}
        >
          {open ? 'عرض أقل' : 'اقرأ المزيد'}
        </button>
      )}
    </div>
  );
}

// توزيع النجوم + متوسط كل مساحة. النقر على مساحة يضعها في البحث فتُصفّى القائمة فوراً.
function RatingBreakdown({ reviews, onPickSpace, activeSpace }) {
  const buckets = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    reviews.forEach((r) => {
      const value = Math.round(Number(r.rating));
      if (value >= 1 && value <= 5) {
        counts[value] += 1;
        total += 1;
      }
    });
    const rows = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts[star],
      percent: total ? Math.round((counts[star] / total) * 100) : 0,
    }));
    const bySpace = new Map();
    reviews.forEach((r) => {
      const name = String(r.space || '').trim();
      if (!name) return;
      const entry = bySpace.get(name) || { name, sum: 0, count: 0, hidden: 0 };
      entry.sum += Number(r.rating) || 0;
      entry.count += 1;
      if (!r.visible) entry.hidden += 1;
      bySpace.set(name, entry);
    });
    const spaces = [...bySpace.values()]
      .map((s) => ({ ...s, average: s.count ? s.sum / s.count : 0 }))
      .sort((a, b) => b.average - a.average || b.count - a.count);
    return { rows, total, spaces };
  }, [reviews]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-review-breakdown>
      <SectionCard>
        <SectionHeading
          icon={Star}
          title="توزيع التقييمات"
          subtitle={`${arCount(buckets.total, AR_FORMS.review)} — محسوبة على كل المراجعات لا على نتائج التصفية`}
        />
        {buckets.total === 0 ? (
          <p className="txt-caption">لا توجد تقييمات بعد.</p>
        ) : (
          <ul className="space-y-2">
            {buckets.rows.map((row) => (
              <li key={row.star} className="flex items-center gap-2.5">
                <span className="flex w-12 shrink-0 items-center gap-1 text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
                  {row.star}
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${row.percent}%` }}
                    role="img"
                    aria-label={`${row.star} نجوم: ${row.count} مراجعة (${row.percent}%)`}
                  />
                </span>
                <span className="w-16 shrink-0 text-end text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                  {row.count} · {row.percent}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard>
        <SectionHeading
          icon={MessageSquareQuote}
          title="متوسط كل مساحة"
          subtitle="النقر على مساحة يصفّي القائمة بها"
        />
        {buckets.spaces.length === 0 ? (
          <p className="txt-caption">لا توجد مساحات مُقيَّمة بعد.</p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto pe-1">
            {buckets.spaces.map((s) => {
              const active = activeSpace === s.name;
              return (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => onPickSpace(active ? '' : s.name)}
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start transition ${
                      active
                        ? 'bg-orange-50 ring-1 ring-orange-300 dark:bg-orange-500/10 dark:ring-orange-500/30'
                        : 'hover:bg-black/[.03] dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold" style={{ color: 'var(--text-strong)' }}>
                        {s.name}
                      </span>
                      <span className="txt-caption">
                        {arCount(s.count, AR_FORMS.review)}
                        {s.hidden ? ` · ${s.hidden} مخفية` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Stars value={Math.round(s.average)} size={13} />
                      <b className="text-sm" style={{ color: 'var(--accent)' }}>
                        {s.average.toFixed(1)}
                      </b>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// هيكل تحميل بنفس ارتفاع البطاقات — يمنع قفزة الصفحة عند جلب البيانات.
function ReviewsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="dash__card dash__card--flush flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="dash__avatar animate-pulse bg-black/10 dark:bg-white/10" />
            <span className="flex-1 space-y-2">
              <span className="dash__tab-loading-bar block w-2/5" />
              <span className="dash__tab-loading-bar is-short block w-3/5" />
            </span>
          </div>
          <span className="dash__tab-loading-bar block w-full" />
          <span className="dash__tab-loading-bar block w-4/5" />
        </div>
      ))}
    </div>
  );
}

// مكان فارغ للحالة الأولى: لا مراجعات ⇒ لا متوسط ولا توزيع.
const NO_ROWS = [];

export default function AdminReviews() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast, announce, dismiss } = useToast();

  // جلب البيانات — العقد §9.1. القائمة كاملة (لا صفحة واحدة) لأن الصفحة تحسب
  // منها المتوسّط وتوزيع النجوم، ورقم صفحة واحدة يعطي متوسطاً كاذباً.
  //
  // المحوّل يرقّي أسماء العقد (`customer`/`author` ← `user`، `comment` ← `text`)
  // ويقرأ غياب `visible` على أنه ظاهر لا مخفي.
  const fetchReviews = useCallback(async () => {
    const { rows } = await listReviews({});
    return adaptAll(rows, adaptReview);
  }, []);

  const {
    data: reviewsRaw,
    setData: setReviews,
    loading,
    error: loadError,
    reload,
  } = useAdminData(fetchReviews);

  // القائمة فارغة (لا تحمل أرقاماً) حتى يصل أول ردّ، والمتوسّط والتوزيع
  // يُحسبان على ما وصل فعلاً. بانتظار الردّ يعرض الملف هيكل تحميل صريحاً.
  const reviews = reviewsRaw ?? NO_ROWS;

  const counts = useMemo(() => {
    const next = { all: reviews.length, flagged: 0, hidden: 0 };
    reviews.forEach((r) => {
      if (r.flagged && r.visible) next.flagged += 1;
      if (!r.visible) next.hidden += 1;
    });
    return next;
  }, [reviews]);

  // ملخّص أعلى الصفحة: المتوسط يُحسب على كل المراجعات بما فيها المخفية، لأن إخفاء
  // مراجعة لا يغيّر تقييمها. القيمة الفارغة تُعرض «—» بدل 0.0 المضلِّل.
  const summary = useMemo(() => {
    const rated = reviews.filter((r) => Number(r.rating) > 0);
    const total = rated.reduce((sum, r) => sum + Number(r.rating), 0);
    return {
      average: rated.length ? (total / rated.length).toFixed(1) : '—',
      total: reviews.length,
      reported: counts.flagged,
    };
  }, [reviews, counts.flagged]);

  const stats = [
    { icon: Star, label: 'متوسط التقييم', value: summary.average, hint: 'من 5', tone: 'amber', trend: 'none' },
    { icon: MessageSquareQuote, label: 'إجمالي المراجعات', value: summary.total, hint: 'ضمن المنصة', tone: 'blue', trend: 'none', commas: true },
    { icon: Flag, label: 'البلاغات المعلّقة', value: summary.reported, hint: 'تحتاج مراجعة', tone: 'red', trend: 'warn' },
  ];

  const filtered = useMemo(() => {
    const sorted = [...reviews].sort((a, b) => {
      if (sort === 'lowest') return Number(a.rating) - Number(b.rating) || timeOf(b.date) - timeOf(a.date);
      if (sort === 'highest') return Number(b.rating) - Number(a.rating) || timeOf(b.date) - timeOf(a.date);
      return timeOf(b.date) - timeOf(a.date);
    });
    // normalizeAr على الطرفين معاً: «الأناقه» تطابق «الأناقة» و«اسماء» تطابق «أسماء».
    const q = normalizeAr(query);
    return sorted.filter((r) => {
      const matchFilter = filter === 'flagged' ? r.flagged && r.visible : filter === 'hidden' ? !r.visible : true;
      const matchQuery = !q || normalizeAr(r.user).includes(q) || normalizeAr(r.space).includes(q);
      return matchFilter && matchQuery;
    });
  }, [reviews, filter, query, sort]);

  // الترقيم: أي تغيير في البحث/الفلتر/الترتيب يعيد الصفحة للأولى داخل معالجات
  // الأحداث (resetPage) لا في useEffect، وإلا ظهرت قائمة فارغة لأن الصفحة صارت
  // خارج المدى بعد تصفية النتائج.
  const resetPage = () => setPage(1);

  const changeQuery = (value) => {
    setQuery(value);
    resetPage();
  };
  const changeFilter = (value) => {
    setFilter(value);
    resetPage();
  };
  const changeSort = (value) => {
    setSort(value);
    resetPage();
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  // العقد §9.3: الإخفاء/الإظهار. الرسالة تتبع الحالة الناتجة، والخادم يعيدها
  // أيضاً فنثبتنا على الحالة المحلية فلا نحتاج trusting نص الخادم.
  const toggleHide = (id) => {
    // نقرأ الهدف قبل التحديث: الاستدعاء داخل setReviews استدعاء جانبي (side effect)
    // وكان يُنفَّذ مرتين في StrictMode فيُعلَن عن الإجراء مرتين.
    const target = reviews.find((r) => r.id === id);
    if (!target) return;
    const visible = !target.visible;
    setReviews((prev) => (Array.isArray(prev) ? prev.map((r) => (r.id === id ? { ...r, visible } : r)) : prev));
    announce(visible ? 'تم إظهار المراجعة.' : 'تم إخفاء المراجعة.');
    if (isAdminTokenLive()) {
      updateReview(id, { visible }).catch((err) => {
        setReviews((prev) => (Array.isArray(prev) ? prev.map((r) => (r.id === id ? { ...r, visible: target.visible } : r)) : prev));
        announce(err?.message || 'تعذّر تنفيذ الإجراء على الخادم.');
      });
    }
  };

  // العقد §9.4.
  const handleDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setReviews((prev) => (Array.isArray(prev) ? prev.filter((r) => r.id !== id) : prev));
    setDeleteTarget(null);
    announce('تم حذف المراجعة نهائياً.');
    if (isAdminTokenLive()) {
      deleteReview(id).catch((err) => announce(err?.message || 'تعذّر حذف المراجعة من الخادم.'));
    }
  };

  // يصدّر النتائج المعروضة (لا كامل القاعدة) بــ BOM عربي كما في utils/csv.js.
  const handleExport = () => {
    const rows = [
      ['المُقيِّم', 'المساحة', 'التقييم', 'التاريخ', 'الحالة', 'نص المراجعة'],
      ...filtered.map((r) => [
        r.user || '',
        r.space || '',
        r.rating ?? '',
        r.date || '',
        !r.visible ? 'مخفية' : r.flagged ? 'مبلّغ عنها' : 'ظاهرة',
        String(r.text || '').replace(/\s+/g, ' ').trim(),
      ]),
    ];
    downloadCsv(`reviews-${new Date().toISOString().slice(0, 10)}`, rows);
    announce(`تم تصدير ${arCount(filtered.length, AR_FORMS.review)} كملف CSV.`);
  };

  const pickSpace = (space) => {
    setQuery(space);
    resetPage();
  };

  const resetFilters = () => {
    setQuery('');
    setFilter('all');
    setSort(DEFAULT_SORT);
    resetPage();
  };

  const hasFilters = query.trim() !== '' || filter !== 'all' || sort !== DEFAULT_SORT;

  return (
    <div className="space-y-6">
      {/* بطاقات المؤشرات — بلا عنوان مكرّر، فالرأس يعرض اسم التبويب.
          أثناء التحميل نعرض هيكلاً بدل أصفار: صفر المُعدِّد يبدو رقماً حقيقياً كاذباً. */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-review-stats>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="dash__card dash__card--flush space-y-3">
              <span className="dash__tab-loading-bar block w-1/3" />
              <span className="dash__tab-loading-bar is-short block w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-review-stats>
          {stats.map((c) => (
            <StatCard key={c.label} {...c} />
          ))}
        </div>
      )}

      {/* لوحة التحكم العلوية — بطاقة مستقلة. لا عنوان h2 هنا: اسم التبويب معروض أصلاً
          في ترويسة اللوحة (h1)، وتكرارُه هنا كان عنواناً مكرراً بلا فائدة. */}
      <section
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-[var(--border)] dark:bg-[#1c1c22]"
        aria-label="أدوات التصفية والترتيب"
      >
        <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {arCount(counts.all, AR_FORMS.review)} · {counts.flagged} بلاغ معلّق · متوسط التقييم{' '}
          {summary.average} من 5
        </p>

        {/* شريط التبويب العلوي — تصفية سريعة حسب الحالة */}
        <div className="mb-4 flex flex-wrap items-center gap-2" data-review-tabs>
          {filters.map((opt) => {
            const active = filter === opt.id;
            return (
              <Pill
                key={opt.id}
                active={active}
                aria-pressed={active}
                data-review-tab={opt.id}
                onClick={() => changeFilter(opt.id)}
              >
                {opt.dot && <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : opt.dot}`} />}
                {opt.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black leading-none ${
                    active ? 'bg-white/25 text-white' : 'bg-black/5 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                  }`}
                >
                  {counts[opt.id]}
                </span>
              </Pill>
            );
          })}
        </div>

        {/* شريط الأدوات — البحث + الترتيب */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" data-review-toolbar>
          <div className="relative md:max-w-sm md:flex-1">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              placeholder="ابحث باسم المُقيِّم أو اسم المساحة…"
              aria-label="البحث في المراجعات"
              className="dash__input dash__input--icon"
            />
            {query && (
              <button
                type="button"
                onClick={() => changeQuery('')}
                aria-label="مسح البحث"
                className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="relative min-w-52">
            <ArrowUpDown
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value)}
              aria-label="ترتيب المراجعات"
              className="dash__input dash__input--icon w-full cursor-pointer appearance-none pe-10"
            >
              {sortOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>

          {/* التصدير يسلّم الصفوف المعروضة فقط (بعد التصفية) — بتلك الطريقة يبقى
              الملف مطابقاً لما يراه المدير على الشاشة. */}
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || filtered.length === 0}
            className={`${btnPrimary} shrink-0 disabled:cursor-not-allowed disabled:opacity-50`}
            data-review-export
          >
            <Download className="h-4 w-4" />
            تصدير CSV
          </button>
        </div>
      </section>

      {loading ? (
        <ReviewsSkeleton />
      ) : loadError ? (
        /* حالة الخطأ: نُظهرها بدل قائمة فارغة صامتة، ومعها سبب الخطأ وزر إعادة المحاولة. */
        <div
          className="flex flex-col items-center gap-3 rounded-3xl border border-red-100 bg-red-50/60 p-10 text-center dark:border-red-500/25 dark:bg-red-500/5"
          role="alert"
          data-review-error
        >
          <AlertTriangle className="h-8 w-8" style={{ color: 'var(--accent)' }} />
          <p className="text-base font-extrabold" style={{ color: 'var(--text-strong)' }}>
            تعذّر تحميل المراجعات
          </p>
          <p className="max-w-md text-sm" style={{ color: 'var(--text-muted)' }}>
            {loadError}
          </p>
          <button type="button" className={btnPrimary} onClick={reload}>
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <>
          {/* توزيع النجوم ومتوسط كل مساحة — قبل القائمة لأنها تصفّيها بالنقر */}
          <RatingBreakdown reviews={reviews} onPickSpace={pickSpace} activeSpace={query.trim()} />

          {/* حاوية المراجعات — خلفية ناعمة */}
          <div
            className="rounded-3xl border border-slate-100 bg-slate-50/80 p-6 dark:border-[var(--border)] dark:bg-white/[0.03]"
            aria-label="قائمة المراجعات"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span
                className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-600 shadow-sm dark:bg-white/5 dark:text-gray-300"
                aria-live="polite"
              >
                عرض {arCount(filtered.length, AR_FORMS.review)}
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-sm font-bold"
                  style={{ color: 'var(--accent)' }}
                >
                  <X className="h-3.5 w-3.5" />
                  إعادة الضبط
                </button>
              )}
            </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            title="لا توجد مراجعات هنا"
            description="لا توجد مراجعات مطابقة للبحث أو الفلتر الحالي."
            actionLabel="عرض الكل"
            onAction={resetFilters}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {paged.map((r) => {
                const anonymous = isAnonymous(r.user);
                return (
                  <article
                    key={r.id}
                    data-review-card={r.id}
                    className={`dash__card dash__card--flush flex flex-col transition ${
                      r.visible ? '' : 'border-dashed opacity-70'
                    }`}
                  >
                    {/* الرأس: بيانات المُقيِّم والتقييم يميناً، وشارات الحالة في الزاوية العلوية اليسرى دائماً */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {/* المراجعة المجهولة لا تُنسب إلى شخص، فصورة رمزية بأيقونة
                            أوضح من أحرف اسم مستعار. */}
                        {anonymous ? (
                          <span className="dash__avatar" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            <UserX className="h-4 w-4" />
                          </span>
                        ) : (
                          <Avatar name={r.user} />
                        )}
                        <div>
                          <p className="font-extrabold" style={{ color: 'var(--text-strong)' }}>
                            {r.user}
                          </p>
                          {anonymous ? (
                            <p className="txt-caption" data-review-anonymous>
                              زائر غير مسجّل · {r.space}
                            </p>
                          ) : (
                            <p className="txt-caption">{r.space}</p>
                          )}
                          <div className="mt-1 flex items-center gap-1.5">
                            <Stars value={r.rating} size={15} />
                            {/* الرقم لازم إلى جانب النجوم: النجوم وحدها لا تُقرأ بلون فقط */}
                            <span className="txt-caption">{r.rating} من 5</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-start justify-end gap-1.5">
                        {anonymous && (
                          <StatusBadge tone="gray" icon={UserX}>مجهولة</StatusBadge>
                        )}
                        {r.flagged && r.visible && (
                          <StatusBadge tone="red" icon={Flag}>مبلّغ عنها</StatusBadge>
                        )}
                        {!r.visible && (
                          <StatusBadge tone="gray" icon={EyeOff}>مخفية</StatusBadge>
                        )}
                      </div>
                    </div>

                    <ReviewText text={r.text} />

                    {/* التذييل الموحّد: التاريخ وأزرار الإجراء على سطر واحد داخل إطار واحد */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-3 dark:border-white/10">
                      {/* dir=ltr داخل نص عربي: التواريخ العربية تُكتب من اليمين لليسار،
                          و«١٥ سبتمبر ٢٠٢٦» بلا dir=ltr ينقلب ترتيب أجزائه. */}
                      <span className="txt-caption" dir="rtl" data-review-date>
                        {formatArDate(r.date)}
                      </span>
                      <div className="flex gap-2">
                        <SmallAction tone={r.visible ? 'amber' : 'sky'} onClick={() => toggleHide(r.id)}>
                          {r.visible ? <EyeOff /> : <Eye />}
                          {r.visible ? 'إخفاء' : 'إظهار'}
                        </SmallAction>
                        <SmallAction tone="red" onClick={() => setDeleteTarget(r)}>
                          <Trash2 />
                          حذف
                        </SmallAction>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* الترقيم — يظهر فقط عند وجود أكثر من صفحة */}
            {totalPages > 1 && (
              <div className="dash__pager" data-review-pager>
                <span className="dash__pager-info">
                  عرض <b>{start}</b>–<b>{end}</b> من <b>{filtered.length}</b>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage(safePage - 1)}
                    disabled={safePage <= 1}
                    aria-label="الصفحة السابقة"
                    className="dash__pager-btn"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .map((p, i, arr) => (
                      <span key={p} className="flex items-center gap-1.5">
                        {i > 0 && arr[i - 1] !== p - 1 && <span className="dash__pager-gap">…</span>}
                        <button
                          type="button"
                          onClick={() => setPage(p)}
                          aria-current={safePage === p ? 'page' : undefined}
                          aria-label={`الصفحة ${p}`}
                          className={`dash__pager-btn${safePage === p ? ' is-active' : ''}`}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  <button
                    type="button"
                    onClick={() => setPage(safePage + 1)}
                    disabled={safePage >= totalPages}
                    aria-label="الصفحة التالية"
                    className="dash__pager-btn"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
          </div>
        </>
      )}

      {/* تأكيد الحذف — لا حذف بلا موافقة صريحة */}      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="حذف المراجعة نهائياً؟">
        <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {deleteTarget && (
            <>
              سيتم حذف مراجعة «{deleteTarget.user}» عن «{deleteTarget.space}» نهائياً، ولن يتمكن
              المستخدمون من مشاهدتها أو استعادتها.
            </>
          )}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setDeleteTarget(null)}>
            إلغاء
          </button>
          <button type="button" onClick={handleDelete} className={btnDanger}>
            <Trash2 className="h-4 w-4" />
            نعم، احذف المراجعة
          </button>
        </div>
      </Modal>

      <Toast message={toast} onClose={dismiss} />
    </div>
  );
}
