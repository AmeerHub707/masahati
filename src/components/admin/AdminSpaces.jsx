import { useEffect, useState } from 'react';
import {
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Star,
  Users,
  MapPin,
  Ban,
  PlayCircle,
  Plus,
  X,
  ArrowUpDown,
  ChevronDown,
  LayoutGrid,
  LayoutList,
} from 'lucide-react';
import { adminSpaces } from '../../data/adminMockData';
import { SectionCard, SectionHeading, StatusBadge, EmptyState, SmallAction } from './ui';

const statusMeta = {
  pending: { label: 'قيد المراجعة', tone: 'amber' },
  active: { label: 'مفعّلة', tone: 'green' },
  suspended: { label: 'موقوفة', tone: 'red' },
};

const sortOptions = [
  { id: 'newest', label: 'الأحدث' },
  { id: 'rating', label: 'الأعلى تقييماً' },
  { id: 'price', label: 'السعر: الأقل أولاً' },
];

const statChips = [
  { id: 'all', label: 'كل المساحات', dot: '' },
  { id: 'pending', label: 'قيد المراجعة', dot: 'bg-amber-500' },
  { id: 'active', label: 'مفعّلة', dot: 'bg-emerald-500' },
  { id: 'suspended', label: 'موقوفة', dot: 'bg-red-500' },
];

function StatChip({ active, onClick, label, count, dot }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-extrabold transition-all duration-200 ${
        active
          ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
          : 'bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-600 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-400'
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : dot}`} />}
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-black leading-none ${
          active
            ? 'bg-white/20 text-white'
            : 'bg-black/5 text-gray-500 dark:bg-white/10 dark:text-gray-400'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function SpaceActions({ s, onApprove, onReject, onSuspend, onActivate, compact = false }) {
  const actionCls = compact ? '!min-h-9 !px-2.5 !text-[0.7rem]' : 'flex-1';
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-4 border-t pt-3'}`}
      style={compact ? {} : { borderColor: 'var(--border)' }}
    >
      {s.status === 'pending' && (
        <>
          <SmallAction tone="green" onClick={() => onApprove(s.id)} className={actionCls}>
            <CheckCircle2 />
            الموافقة
          </SmallAction>
          <SmallAction tone="red" onClick={() => onReject(s.id)} className={actionCls}>
            <XCircle />
            الرفض
          </SmallAction>
        </>
      )}
      {s.status === 'active' && (
        <SmallAction tone="amber" onClick={() => onSuspend(s.id)} className={actionCls}>
          <Ban />
          إيقاف المساحة
        </SmallAction>
      )}
      {s.status === 'suspended' && (
        <SmallAction tone="sky" onClick={() => onActivate(s.id)} className={actionCls}>
          <PlayCircle />
          إعادة التفعيل
        </SmallAction>
      )}
    </div>
  );
}

export default function AdminSpaces() {
  const [spaces, setSpaces] = useState(adminSpaces);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('newest');
  const [showToast, setShowToast] = useState(false);

  const counts = { all: spaces.length, pending: 0, active: 0, suspended: 0 };
  spaces.forEach((s) => {
    counts[s.status] += 1;
  });

  const sorted = [...spaces].sort((a, b) => {
    if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sort === 'price') return a.price - b.price;
    return b.id - a.id;
  });

  const filtered = sorted.filter((s) => {
    const matchStatus = filter === 'all' || s.status === filter;
    const q = query.trim().toLowerCase();
    const matchQuery =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.neighborhood.toLowerCase().includes(q) ||
      s.owner.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  useEffect(() => {
    if (!showToast) return undefined;
    const t = setTimeout(() => setShowToast(false), 2600);
    return () => clearTimeout(t);
  }, [showToast]);

  const approve = (id) => setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'active' } : s)));
  const reject = (id) => setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'suspended' } : s)));
  const suspend = (id) => setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'suspended' } : s)));
  const activate = (id) => setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'active' } : s)));

  const resetFilters = () => {
    setQuery('');
    setFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* لوحة التحكم العلوية — بطاقة مستقلة */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-[var(--border)] dark:bg-[#1c1c22]">
        <SectionHeading
          icon={Building2}
          title="إدارة المساحات"
          subtitle={`${spaces.length} مساحة مسجلة · ${counts.pending} بانتظار المراجعة`}
          action={
            <button type="button" className="btn-primary" onClick={() => setShowToast(true)}>
              <Plus className="h-4 w-4" />
              إضافة مساحة جديدة
            </button>
          }
        />

        {/* البحث والترتيب وتبديل العرض */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative md:max-w-sm md:flex-1">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن مساحة بالاسم أو الحي أو المالك…"
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

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-44">
              <ArrowUpDown
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="ترتيب المساحات"
                className="dash__input dash__input--icon cursor-pointer appearance-none pe-10"
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

            <div className="flex items-center overflow-hidden rounded-xl border border-black/15 dark:border-[var(--border)]">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-label="عرض شبكي"
                title="عرض شبكي"
                className={`inline-flex h-10 w-10 items-center justify-center transition ${
                  view === 'grid'
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-500 hover:bg-orange-50 hover:text-orange-500 dark:bg-transparent dark:text-gray-400 dark:hover:bg-orange-500/10 dark:hover:text-orange-400'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-label="عرض جدولي"
                title="عرض جدولي"
                className={`inline-flex h-10 w-10 items-center justify-center transition ${
                  view === 'list'
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-500 hover:bg-orange-50 hover:text-orange-500 dark:bg-transparent dark:text-gray-400 dark:hover:bg-orange-500/10 dark:hover:text-orange-400'
                }`}
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* شارات الإحصائيات — حبوب تصفية سريعة */}
        <div className="flex flex-wrap items-center gap-2">
          {statChips.map((c) => (
            <StatChip
              key={c.id}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
              label={c.label}
              count={counts[c.id]}
              dot={c.dot}
            />
          ))}
        </div>
      </section>

      {/* حاوية المساحات — خلفية ناعمة */}
      <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-6 dark:border-[var(--border)] dark:bg-white/[0.03]">
        {filtered.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-600 shadow-sm dark:bg-white/5 dark:text-gray-300">
              عرض {filtered.length} مساحة · {view === 'grid' ? 'عرض شبكي' : 'عرض جدولي'}
            </span>
            {(query || filter !== 'all') && (
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
        )}

        {filtered.length === 0 ? (
          <SectionCard>
            <EmptyState
              icon={Building2}
              title="لا توجد مساحات مطابقة"
              description="لم نعثر على مساحات تطابق البحث أو الفلتر الحالي. جرّب تغيير المعايير."
              actionLabel="إعادة الضبط"
              onAction={resetFilters}
            />
          </SectionCard>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="dash__card flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-md dark:hover:border-orange-500/40"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className="st-ico">
                    <Building2 />
                  </span>
                  <StatusBadge tone={statusMeta[s.status].tone}>{statusMeta[s.status].label}</StatusBadge>
                </div>

                <h3 className="text-base font-extrabold" style={{ color: 'var(--text-strong)' }}>
                  {s.name}
                </h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <MapPin className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  {s.neighborhood}
                </p>

                <div
                  className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    {s.capacity} مقعد
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star
                      className={`h-4 w-4 ${s.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                    />
                    {s.rating ? s.rating.toFixed(1) : 'لا تقييمات'}
                  </span>
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>
                    {s.price} ش.ج/ساعة
                  </span>
                </div>

                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  المالك: {s.owner} · {s.bookings} حجز
                </p>

                <SpaceActions
                  s={s}
                  onApprove={approve}
                  onReject={reject}
                  onSuspend={suspend}
                  onActivate={activate}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="dash__card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                  {['المساحة', 'المالك', 'المقاعد', 'التقييم', 'السعر', 'الحالة', 'إجراءات'].map((h) => (
                    <th key={h} className="whitespace-nowrap pb-3 pe-3 font-extrabold last:pe-0" style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b transition-all last:border-0 hover:bg-orange-50/50 dark:hover:bg-white/[0.03]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="py-3.5 pe-3">
                      <p className="whitespace-nowrap font-extrabold" style={{ color: 'var(--text-strong)' }}>
                        {s.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                        <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                        {s.neighborhood}
                      </p>
                    </td>
                    <td className="whitespace-nowrap py-3.5 pe-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {s.owner}
                    </td>
                    <td className="whitespace-nowrap py-3.5 pe-3 text-xs font-bold">{s.capacity} مقعد</td>
                    <td className="whitespace-nowrap py-3.5 pe-3">
                      <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--text-strong)' }}>
                        <Star
                          className={`h-4 w-4 ${s.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                        />
                        {s.rating ? s.rating.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3.5 pe-3 text-xs font-bold" style={{ color: 'var(--accent)' }}>
                      {s.price} ش.ج/ساعة
                    </td>
                    <td className="whitespace-nowrap py-3.5 pe-3">
                      <StatusBadge tone={statusMeta[s.status].tone}>{statusMeta[s.status].label}</StatusBadge>
                    </td>
                    <td className="py-3.5">
                      <SpaceActions
                        s={s}
                        onApprove={approve}
                        onReject={reject}
                        onSuspend={suspend}
                        onActivate={activate}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* إشعار مؤقت لزر الإضافة */}
      {showToast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold shadow-2xl dark:border-white/10 dark:bg-[#1c1c22] dark:text-gray-200"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
            <Plus className="h-4 w-4" />
          </span>
          ميزة إضافة مساحة جديدة قيد التطوير — ستتوفر قريباً
          <button
            type="button"
            onClick={() => setShowToast(false)}
            aria-label="إغلاق"
            className="ms-1 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}