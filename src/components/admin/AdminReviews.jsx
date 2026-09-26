import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { adminReviews } from '../../data/adminMockData';
import {
  StatCard,
  StatusBadge,
  EmptyState,
  Modal,
  Toast,
  btnGhost,
  btnDanger,
  Pill,
  SmallAction,
  Stars,
  Avatar,
} from './ui';
import { useToast } from './useToast';
import { arCount, AR_FORMS } from '../../utils/format';

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

// تاريخ المراجعة قد يصل من الـ API بصيغة «YYYY-MM-DD» أو «YYYY-MM-DD HH:mm»؛
// Date.parse يغطّي الاثنتين، و|| 0 يبقي الفرز مستقراً بدل NaN إن غاب التاريخ.
const timeOf = (value) => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalize = (value) => String(value || '').trim().toLowerCase();

export default function AdminReviews() {
  const [reviews, setReviews] = useState(adminReviews);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast, announce, dismiss } = useToast();

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
    const q = normalize(query);
    return sorted.filter((r) => {
      const matchFilter = filter === 'flagged' ? r.flagged && r.visible : filter === 'hidden' ? !r.visible : true;
      const matchQuery = !q || normalize(r.user).includes(q) || normalize(r.space).includes(q);
      return matchFilter && matchQuery;
    });
  }, [reviews, filter, query, sort]);

  const toggleHide = (id) => {
    // نقرأ الهدف قبل التحديث: الاستدعاء داخل setReviews استدعاء جانبي (side effect)
    // وكان يُنفَّذ مرتين في StrictMode فيُعلَن عن الإجراء مرتين.
    const target = reviews.find((r) => r.id === id);
    if (!target) return;
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)));
    announce(target.visible ? 'تم إخفاء المراجعة.' : 'تم إظهار المراجعة.');
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    announce('تم حذف المراجعة نهائياً.');
  };

  const resetFilters = () => {
    setQuery('');
    setFilter('all');
    setSort(DEFAULT_SORT);
  };

  const hasFilters = query.trim() !== '' || filter !== 'all' || sort !== DEFAULT_SORT;

  return (
    <div className="space-y-6">
      {/* بطاقات المؤشرات — بلا عنوان مكرّر، فالرأس يعرض اسم التبويب */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-review-stats>
        {stats.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

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
                onClick={() => setFilter(opt.id)}
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم المُقيِّم أو اسم المساحة…"
              aria-label="البحث في المراجعات"
              className="dash__input dash__input--icon"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
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
              onChange={(e) => setSort(e.target.value)}
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
        </div>
      </section>

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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filtered.map((r) => (
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
                    <Avatar name={r.user} />
                    <div>
                      <p className="font-extrabold" style={{ color: 'var(--text-strong)' }}>
                        {r.user}
                      </p>
                      <p className="txt-caption">{r.space}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Stars value={r.rating} size={15} />
                        {/* الرقم لازم إلى جانب النجوم: النجوم وحدها لا تُقرأ بلون فقط */}
                        <span className="txt-caption">{r.rating} من 5</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-start justify-end gap-1.5">
                    {r.flagged && r.visible && (
                      <StatusBadge tone="red" icon={Flag}>مبلّغ عنها</StatusBadge>
                    )}
                    {!r.visible && (
                      <StatusBadge tone="gray" icon={EyeOff}>مخفية</StatusBadge>
                    )}
                  </div>
                </div>

                <p className="dash__soft mt-3 flex-1">{r.text}</p>

                {/* التذييل الموحّد: التاريخ وأزرار الإجراء على سطر واحد داخل إطار واحد */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-3 dark:border-white/10">
                  <span className="txt-caption" dir="ltr">
                    {r.date}
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
            ))}
          </div>
        )}
      </div>

      {/* تأكيد الحذف — لا حذف بلا موافقة صريحة */}
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="حذف المراجعة نهائياً؟">
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
