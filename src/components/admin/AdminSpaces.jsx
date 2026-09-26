import { useMemo, useState } from 'react';
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
  Eye,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react';
import { adminSpaces } from '../../data/adminMockData';
import {
  SectionCard,
  SectionHeading,
  StatusBadge,
  EmptyState,
  SmallAction,
  ActionMenu,
  Modal,
  Pill,
  Toast,
  Field,
  btnGhost,
  btnDanger,
} from './ui';
import { useToast } from './useToast';
import useSafeInput from '../../hooks/useSafeInput';
import { arCount, AR_FORMS } from '../../utils/format';

const statusMeta = {
  pending: { label: 'قيد المراجعة', tone: 'amber' },
  active: { label: 'مفعّلة', tone: 'green' },
  suspended: { label: 'موقوفة', tone: 'red' },
};

// قيمة بديلة آمنة — بيانات الـ API قد تحتوي حالة غير معرّفة.
const spaceStatus = (status) => statusMeta[status] || { label: 'غير محدّدة', tone: 'gray' };

const sortOptions = [
  { id: 'newest', label: 'الأحدث' },
  { id: 'rating', label: 'الأعلى تقييماً' },
  { id: 'price', label: 'السعر: الأقل أولاً' },
];

// شريط التبويب العلوي — اللون الدلالي يطابق لون شارة الحالة.
const tabs = [
  { id: 'all', label: 'كل المساحات', dot: '' },
  { id: 'pending', label: 'قيد المراجعة', dot: 'bg-amber-500' },
  { id: 'active', label: 'مفعّلة', dot: 'bg-emerald-500' },
  { id: 'suspended', label: 'موقوفة', dot: 'bg-red-500' },
];

/** غلاف صورة المساحة: يعرض الصورة، وإن غابت أو فشل تحميلها نعرض بديلاً متدرّجاً. */
function SpaceCover({ src, alt }) {
  // نتتبع المسار الفاشل بدل حالة منطقية، فلا تتكرر محاولة تحميل رابط مكسور.
  const [failedSrc, setFailedSrc] = useState(null);

  if (!src || failedSrc === src) {
    return (
      <div className="dash__cover-fallback" aria-hidden="true">
        <Building2 />
      </div>
    );
  }
  return (
    <img
      className="dash__cover-img"
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}

export default function AdminSpaces() {
  const [spaces, setSpaces] = useState(adminSpaces);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('newest');
  const { toast, announce, dismiss } = useToast();
  const [preview, setPreview] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const counts = useMemo(() => {
    const next = { all: spaces.length, pending: 0, active: 0, suspended: 0 };
    spaces.forEach((s) => {
      if (next[s.status] !== undefined) next[s.status] += 1;
    });
    return next;
  }, [spaces]);

  const filtered = useMemo(() => {
    const sorted = [...spaces].sort((a, b) => {
      if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sort === 'price') return (Number(a.price) || 0) - (Number(b.price) || 0);
      return b.id - a.id;
    });
    const q = query.trim().toLowerCase();
    return sorted.filter((s) => {
      const matchStatus = filter === 'all' || s.status === filter;
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        s.owner.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [spaces, filter, query, sort]);

  const setStatus = (id, status) =>
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  // التعديل الجزئي: نحدّث الحقول المُرسَلة فقط ونُبقي الباقي (id, rating, bookings) كما هي.
  const patch = (id, changes) =>
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  const approve = (id) => setStatus(id, 'active');
  const reject = (id) => setStatus(id, 'suspended');
  const suspend = (id) => setStatus(id, 'suspended');
  const activate = (id) => setStatus(id, 'active');
  const remove = (id) => setSpaces((prev) => prev.filter((s) => s.id !== id));

  const openEdit = (s) => {
    setPreview(null);
    setEditTarget(s);
  };

  // يُستدعى من نموذج التعديل بعد التحقّق: يدمج التعديلات ثم يغلق النافذة.
  const saveEdit = (id, changes) => {
    patch(id, changes);
    setEditTarget(null);
    announce('تم تحديث بيانات المساحة بنجاح.');
  };

  const resetFilters = () => {
    setQuery('');
    setFilter('all');
    setSort('newest');
  };

  // إجراءات بطاقة/صف واحد: المعاينة، التعديل، ثم الحذف.
  const menuItems = (s) => [
    { id: 'preview', label: 'معاينة', icon: Eye, onSelect: () => setPreview(s) },
    { id: 'edit', label: 'تعديل', icon: Pencil, onSelect: () => openEdit(s) },
    { id: 'sep', label: 'فاصل', separator: true },
    {
      id: 'delete',
      label: 'حذف',
      icon: Trash2,
      tone: 'danger-soft',
      onSelect: () => setDeleteTarget(s),
    },
  ];

  return (
    <div className="space-y-6">
      {/* لوحة التحكم العلوية — بطاقة مستقلة */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-[var(--border)] dark:bg-[#1c1c22]">
        <SectionHeading
          icon={Building2}
          title="إدارة المساحات"
          subtitle={`${arCount(spaces.length, AR_FORMS.space)} مسجلة · ${counts.pending} بانتظار المراجعة`}
          action={
            <button
              type="button"
              className="btn-primary"
              onClick={() => announce('ميزة إضافة مساحة جديدة قيد التطوير — ستتوفر قريباً')}
            >
              <Plus className="h-4 w-4" />
              إضافة مساحة جديدة
            </button>
          }
        />

        {/* شريط التبويب العلوي — تصفية سريعة حسب الحالة */}
        <div className="mb-4 flex flex-wrap items-center gap-2" data-space-tabs>
          {tabs.map((t) => {
            const active = filter === t.id;
            return (
              <Pill
                key={t.id}
                active={active}
                aria-pressed={active}
                data-space-tab={t.id}
                onClick={() => setFilter(t.id)}
              >
                {t.dot && (
                  <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : t.dot}`} />
                )}
                {t.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black leading-none ${
                    active
                      ? 'bg-white/25 text-white'
                      : 'bg-black/5 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                  }`}
                >
                  {counts[t.id]}
                </span>
              </Pill>
            );
          })}
        </div>

        {/* شريط الأدوات الثانوي — البحث + الترتيب + تبديل العرض */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" data-space-toolbar>
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
              aria-label="البحث في المساحات"
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
                aria-pressed={view === 'grid'}
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
                aria-pressed={view === 'list'}
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
      </section>

      {/* حاوية المساحات — خلفية ناعمة */}
      <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-6 dark:border-[var(--border)] dark:bg-white/[0.03]">
        {filtered.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-extrabold text-slate-600 shadow-sm dark:bg-white/5 dark:text-gray-300">
              عرض {arCount(filtered.length, AR_FORMS.space)} ·{' '}
              {view === 'grid' ? 'عرض شبكي' : 'عرض جدولي'}
            </span>
            {(query || filter !== 'all' || sort !== 'newest') && (
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
              <article
                key={s.id}
                data-space-card={s.id}
                onClick={() => setPreview(s)}
                className="dash__card dash__card--cover group flex cursor-pointer flex-col transition-all duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg focus-within:border-orange-200 dark:hover:border-orange-500/40"
              >
                {/* الغلاف: الصورة + زر المعاينة + قائمة الإجراءات + شارة الحالة */}
                <div className="dash__cover">
                  <button
                    type="button"
                    className="dash__cover-open"
                    aria-label={`معاينة ${s.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreview(s);
                    }}
                  >
                    <SpaceCover src={s.image} alt={`غلاف ${s.name}`} />
                    <span className="dash__cover-veil">
                      <Eye className="h-4 w-4" />
                      معاينة
                    </span>
                  </button>
                  <ActionMenu
                    className="dash__cover-acts"
                    label={`إجراءات ${s.name}`}
                    menuId={`admin-space-actions-${s.id}`}
                    items={menuItems(s)}
                  />
                  <span className="dash__cover-badge">
                    <StatusBadge tone={spaceStatus(s.status).tone}>
                      {spaceStatus(s.status).label}
                    </StatusBadge>
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-extrabold" style={{ color: 'var(--text-strong)' }}>
                    {s.name}
                  </h3>
                  <p
                    className="mt-0.5 flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <MapPin className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    {s.neighborhood}
                  </p>

                  <div
                    className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      {arCount(s.capacity, AR_FORMS.seat)}
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
                    المالك: {s.owner} · {arCount(s.bookings, AR_FORMS.booking)}
                  </p>

                  <div onClick={(e) => e.stopPropagation()}>
                    <SpaceActions
                      s={s}
                      onApprove={approve}
                      onReject={reject}
                      onSuspend={suspend}
                      onActivate={activate}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="dash__card">
            <div className="dash__table-wrap">
              <table className="dash__table">
                <thead>
                  <tr>
                    {['المساحة', 'المالك', 'المقاعد', 'التقييم', 'السعر', 'الحالة', 'إجراءات'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} data-space-row={s.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="dash__cover-thumb">
                            <SpaceCover src={s.image} alt="" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-extrabold whitespace-nowrap">
                              {s.name}
                            </span>
                            <span className="txt-caption mt-0.5 flex items-center gap-1 whitespace-nowrap">
                              <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                              {s.neighborhood}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="txt-caption whitespace-nowrap">{s.owner}</td>
                      <td className="txt-caption whitespace-nowrap font-bold">
                        {arCount(s.capacity, AR_FORMS.seat)}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-bold">
                          <Star
                            className={`h-4 w-4 ${s.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                          />
                          {s.rating ? s.rating.toFixed(1) : '—'}
                        </span>
                      </td>
                      <td className="num whitespace-nowrap text-xs">{s.price} ش.ج/ساعة</td>
                      <td className="whitespace-nowrap">
                        <StatusBadge tone={spaceStatus(s.status).tone}>
                          {spaceStatus(s.status).label}
                        </StatusBadge>
                      </td>
                      <td>
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SpaceActions
                            s={s}
                            onApprove={approve}
                            onReject={reject}
                            onSuspend={suspend}
                            onActivate={activate}
                            compact
                          />
                          <ActionMenu
                            label={`إجراءات ${s.name}`}
                            menuId={`admin-space-actions-${s.id}`}
                            items={menuItems(s)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* معاينة المساحة */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview ? `معاينة: ${preview.name}` : 'معاينة المساحة'}
        wide
      >
        {preview && (
          <div className="space-y-4">
            <div className="dash__cover rounded-2xl">
              <SpaceCover src={preview.image} alt={`غلاف ${preview.name}`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniFact label="الحي" value={preview.neighborhood} />
              <MiniFact label="المالك" value={preview.owner} />
              <MiniFact label="السعر" value={`${preview.price} ش.ج/ساعة`} />
              <MiniFact label="السعة" value={arCount(preview.capacity, AR_FORMS.seat)} />
              <MiniFact
                label="التقييم"
                value={preview.rating ? `${preview.rating.toFixed(1)} من 5` : 'لا تقييمات'}
              />
              <MiniFact label="الحجوزات" value={arCount(preview.bookings, AR_FORMS.booking)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[.8rem] font-bold" style={{ color: 'var(--text-muted)' }}>
                الحالة:
              </span>
              <StatusBadge tone={spaceStatus(preview.status).tone}>
                {spaceStatus(preview.status).label}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setPreview(null)}>
                إغلاق
              </button>
              <button type="button" className="btn-primary" onClick={() => openEdit(preview)}>
                <Pencil className="h-4 w-4" />
                تعديل البيانات
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* تعديل بيانات المساحة */}
      {editTarget && (
        <SpaceEditModal
          key={editTarget.id}
          space={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={saveEdit}
        />
      )}

      {/* تأكيد الحذف */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="حذف المساحة نهائياً؟"
      >
        <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          سيتم حذف «{deleteTarget ? deleteTarget.name : ''}» وجميع حجوزاتها نهائياً من المنصة، ولا يمكن
          التراجع عن هذا الإجراء.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setDeleteTarget(null)}>
            إلغاء
          </button>
          <button
            type="button"
            className={btnDanger}
            onClick={() => {
              remove(deleteTarget.id);
              setDeleteTarget(null);
              announce('تم حذف المساحة نهائياً.');
            }}
          >
            <Trash2 className="h-4 w-4" />
            نعم، احذف المساحة
          </button>
        </div>
      </Modal>

      {/* إشعار مؤقت */}
      <Toast message={toast} onClose={dismiss} icon={Plus} />
    </div>
  );
}

// صف معلومة داخل نافذة المعاينة.
// LABELS عند .8rem لا عند .74rem: النص العربي الصغير كان يبدو منخفض التباين.
// الألوان نفسها (--text-muted / --text-strong) تمرّ أصلاً فوق معيار WCAG AA.
function MiniFact({ label, value }) {
  return (
    <div className="rounded-xl border border-black/15 bg-slate-50/60 p-3 dark:border-[var(--border)] dark:bg-white/[0.03]">
      <span
        className="block text-[.8rem] font-bold"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </span>
      <span className="mt-0.5 block text-[.95rem] font-extrabold" style={{ color: 'var(--text-strong)' }}>
        {value}
      </span>
    </div>
  );
}

// إجراءات تغيير الحالة — ألوان دلالية: أخضر للموافقة، أحمر للرفض/الإيقاف، أزرار لإعادة التفعيل.
// يوقّف انتشار النقرة حتى لا يفتح نقرةُ الزر معاينةَ البطاقة.
function SpaceActions({ s, onApprove, onReject, onSuspend, onActivate, compact = false }) {
  const actionCls = compact ? 'dash__btn-soft--compact' : 'flex-1';
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-4 border-t pt-3'}`}
      style={compact ? undefined : { borderColor: 'var(--border)' }}
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
        <SmallAction tone="red" onClick={() => onSuspend(s.id)} className={actionCls}>
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

// حدود التحقّق — رسالة واحدة عربية لكل حقل.
const LIMITS = {
  price: { min: 1, max: 100000 },
  capacity: { min: 1, max: 1000 },
};

/**
 * نافذة تعديل بيانات المساحة.
 *
 * حالتها المعزولة (draft) تُبذر من `space` عند التركيب — والمُركِّب يمرّر `key={space.id}`
 * فتُعاد البذرة عند فتح مساحة أخرى دون الحاجة لتأثير مزامنة.
 * الحقول النصّية تمرّ عبر useSafeInput فتعقّم أي HTML ملصوق وتحدّ الطول.
 * `id` و`rating` و`bookings` غير قابلة للتعديل (بيانات نظام) وتُعرض معطّلة.
 */
function SpaceEditModal({ space, onClose, onSave }) {
  const name = useSafeInput(space.name || '', { maxLength: 80 });
  const neighborhood = useSafeInput(space.neighborhood || '', { maxLength: 80 });
  const owner = useSafeInput(space.owner || '', { maxLength: 80 });
  const image = useSafeInput(space.image || '', { maxLength: 300 });

  const [price, setPrice] = useState(String(space.price ?? ''));
  const [capacity, setCapacity] = useState(String(space.capacity ?? ''));
  const [status, setStatus] = useState(space.status || 'active');
  const [errors, setErrors] = useState({});

  const submit = (e) => {
    e.preventDefault();
    const next = {};

    if (!name.value.trim()) next.name = 'اسم المساحة مطلوب.';
    if (!neighborhood.value.trim()) next.neighborhood = 'الحي مطلوب.';
    if (!owner.value.trim()) next.owner = 'اسم المالك مطلوب.';

    const p = Number(price);
    if (!price.trim() || !Number.isFinite(p) || p < LIMITS.price.min || p > LIMITS.price.max) {
      next.price = `السعر يجب أن يكون رقماً بين ${LIMITS.price.min} و ${LIMITS.price.max}.`;
    }

    const cap = Number(capacity);
    if (
      !capacity.trim() ||
      !Number.isInteger(cap) ||
      cap < LIMITS.capacity.min ||
      cap > LIMITS.capacity.max
    ) {
      next.capacity = `السعة يجب أن تكون عدداً صحيحاً بين ${LIMITS.capacity.min} و ${LIMITS.capacity.max}.`;
    }

    const img = image.value.trim();
    if (img && !/^(\/|https?:\/\/)/i.test(img)) {
      next.image = 'رابط الصورة يجب أن يبدأ بـ / أو https://';
    }

    setErrors(next);
    if (Object.keys(next).length) return;

    onSave(space.id, {
      name: name.value.trim(),
      neighborhood: neighborhood.value.trim(),
      owner: owner.value.trim(),
      price: p,
      capacity: cap,
      status,
      image: img,
    });
  };

  return (
    <Modal open onClose={onClose} title={`تعديل: ${space.name}`} wide>
      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="اسم المساحة" error={errors.name} htmlFor="sp-name">
            <input
              id="sp-name"
              type="text"
              dir="rtl"
              className="dash__input"
              value={name.value}
              onChange={name.onChange}
              placeholder="مثال: مساحة العمل الوسطى"
            />
          </Field>

          <Field label="الحي" error={errors.neighborhood} htmlFor="sp-neighborhood">
            <input
              id="sp-neighborhood"
              type="text"
              dir="rtl"
              className="dash__input"
              value={neighborhood.value}
              onChange={neighborhood.onChange}
              placeholder="مثال: غزة - الرمال"
            />
          </Field>

          <Field label="المالك" error={errors.owner} htmlFor="sp-owner">
            <input
              id="sp-owner"
              type="text"
              dir="rtl"
              className="dash__input"
              value={owner.value}
              onChange={owner.onChange}
              placeholder="اسم مالك المساحة"
            />
          </Field>

          <Field label="الحالة" htmlFor="sp-status">
            <select
              id="sp-status"
              className="dash__input cursor-pointer"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {Object.entries(statusMeta).map(([id, m]) => (
                <option key={id} value={id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="السعر (ش.ج/ساعة)" error={errors.price} htmlFor="sp-price">
            <input
              id="sp-price"
              type="number"
              dir="ltr"
              inputMode="numeric"
              min={LIMITS.price.min}
              max={LIMITS.price.max}
              className="dash__input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>

          <Field label="السعة (مقعد)" error={errors.capacity} htmlFor="sp-capacity">
            <input
              id="sp-capacity"
              type="number"
              dir="ltr"
              inputMode="numeric"
              min={LIMITS.capacity.min}
              max={LIMITS.capacity.max}
              className="dash__input"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="رابط صورة الغلاف" error={errors.image} htmlFor="sp-image">
              <input
                id="sp-image"
                type="text"
                dir="ltr"
                className="dash__input"
                value={image.value}
                onChange={image.onChange}
                placeholder="/images.jfif أو https://…"
              />
            </Field>
          </div>
        </div>

        {/* بيانات النظام: تُعرض للعلم فقط ولا تُعدَّل من هنا. */}
        <fieldset
          className="mt-1 rounded-xl border p-3"
          style={{ borderColor: 'var(--border)' }}
          disabled
        >
          <legend className="px-1 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
            بيانات النظام (غير قابلة للتعديل)
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ReadOnlyStat label="المعرّف" value={space.id} />
            <ReadOnlyStat
              label="التقييم"
              value={space.rating ? `${space.rating.toFixed(1)} من 5` : 'لا تقييمات'}
            />
            <ReadOnlyStat label="الحجوزات" value={arCount(space.bookings, AR_FORMS.booking)} />
          </div>
        </fieldset>

        {/* شريط الإجراءات ثابت أسفل النموذج فلا يختفي عند التمرير على الشاشات القصيرة. */}
        <div
          className="sticky bottom-0 -mx-1.75 mt-4 flex flex-wrap justify-end gap-2 border-t px-1.75 pt-3 bg-white dark:bg-[#1c1c22]"
          style={{ borderColor: 'var(--border)' }}
        >
          <button type="button" className={btnGhost} onClick={onClose}>
            إلغاء
          </button>
          <button type="submit" className="btn-primary">
            <Check className="h-4 w-4" />
            حفظ التعديلات
          </button>
        </div>
      </form>
    </Modal>
  );
}

// قيمة للقراءة فقط داخل حقل بيانات النظام
function ReadOnlyStat({ label, value }) {
  return (
    <div>
      <span className="block text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="mt-0.5 block text-sm font-extrabold" style={{ color: 'var(--text-strong)' }}>
        {value}
      </span>
    </div>
  );
}
