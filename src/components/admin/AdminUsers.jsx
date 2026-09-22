import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  Clock,
  MoreVertical,
  Eye,
  Pencil,
  Ban,
  CheckCircle2,
  Trash2,
  Download,
  Filter,
  FilterX,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { adminUsers } from '../../data/adminMockData';
import {
  SectionCard,
  SectionHeading,
  StatusBadge,
  EmptyState,
  Modal,
  StatCard,
  btnGhost,
  btnDanger,
  btnPrimary,
  Pill,
  Avatar,
} from './ui';

const PAGE_SIZE = 10;

const TABS = [
  { id: 'all', label: 'كل الحسابات' },
  { id: 'freelancer', label: 'فريلانسرز' },
  { id: 'owner', label: 'ملاك المساحات' },
  { id: 'suspended', label: 'الموقوفون' },
];

const roleLabel = { freelancer: 'فريلانسر', owner: 'صاحب مساحة' };
const roleTone = { freelancer: 'violet', owner: 'orange' };

const statusMeta = {
  active: { tone: 'green', label: 'نشط', Icon: UserCheck },
  suspended: { tone: 'red', label: 'موقوف', Icon: UserX },
  review: { tone: 'amber', label: 'قيد المراجعة', Icon: Clock },
};

function sparkPoints(data) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  return data
    .map((d, i) => `${(i / (data.length - 1)) * 100},${14 - ((d - min) / range) * 10}`)
    .join(' ');
}

function RowSpark({ data, tone = '#f97316' }) {
  return (
    <svg
      className="dash__spark"
      viewBox="0 0 100 16"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={sparkPoints(data)}
        fill="none"
        stroke={tone}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PresenceDot({ online }) {
  return (
    <span
      title={online ? 'متصل الآن' : 'غير متصل'}
      className={`dash__dot${online ? ' is-on' : ''}`}
    />
  );
}

function Checkbox({ checked, indeterminate = false, onChange, label }) {
  return (
    <input
      type="checkbox"
      className={`dash__check${indeterminate ? ' is-indeterminate' : ''}`}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      aria-label={label || 'تحديد'}
    />
  );
}

const CSV_HEADERS = ['الاسم', 'البريد', 'الهاتف', 'الدور', 'الحالة', 'التحقق', 'الحجوزات', 'الانضمام'];
const ROLE_AR = { freelancer: 'فريلانسر', owner: 'صاحب مساحة' };
const STATUS_AR = { active: 'نشط', suspended: 'موقوف', review: 'قيد المراجعة' };

export default function AdminUsers() {
  const [users, setUsers] = useState(adminUsers);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [advOpen, setAdvOpen] = useState(false);
  const [fVerif, setFVerif] = useState('all');
  const [fJoinedFrom, setFJoinedFrom] = useState('');
  const [fJoinedTo, setFJoinedTo] = useState('');
  const [fMinBookings, setFMinBookings] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [viewUser, setViewUser] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menu, setMenu] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (e.target && !e.target.closest('[data-row-menu]')) setMenu(null);
    };
    const onKey = (e) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const phoneQ = query.replace(/\s/g, '').toLowerCase();
    return users.filter((u) => {
      if (tab === 'freelancer' && u.role !== 'freelancer') return false;
      if (tab === 'owner' && u.role !== 'owner') return false;
      if (tab === 'suspended' && u.status !== 'suspended') return false;
      if (
        q &&
        !(
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.replace(/\s/g, '').toLowerCase().includes(phoneQ)
        )
      )
        return false;
      if (fVerif === 'verified' && !u.verified) return false;
      if (fVerif === 'pending' && u.verified) return false;
      if (fJoinedFrom !== '' && u.joined < fJoinedFrom) return false;
      if (fJoinedTo !== '' && u.joined > fJoinedTo) return false;
      if (fMinBookings !== '' && u.bookings < Number(fMinBookings)) return false;
      return true;
    });
  }, [users, tab, query, fVerif, fJoinedFrom, fJoinedTo, fMinBookings]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedUsers = users.filter((u) => selected.has(u.id));
  const allChecked = filtered.length > 0 && filtered.every((u) => selected.has(u.id));
  const someChecked = !allChecked && filtered.some((u) => selected.has(u.id));

  const counts = useMemo(() => {
    let total = 0,
      activeFreelancers = 0,
      owners = 0,
      pendingVerif = 0,
      suspended = 0;
    for (const u of users) {
      total += 1;
      if (u.role === 'owner') owners += 1;
      if (u.role === 'freelancer' && u.status === 'active') activeFreelancers += 1;
      if (!u.verified) pendingVerif += 1;
      if (u.status === 'suspended') suspended += 1;
    }
    return { total, activeFreelancers, owners, pendingVerif, suspended };
  }, [users]);

  const sparkTrace = (v) => [v * 0.7, v * 0.8, v * 0.75, v * 0.86, v * 0.94, v];

  const kpis = [
    { icon: Users, label: 'إجمالي الحسابات', value: counts.total, tone: 'orange', trend: 'up', hint: '+12% هذا الشهر', spark: sparkTrace(counts.total) },
    { icon: UserCheck, label: 'فريلانسرز نشطون', value: counts.activeFreelancers, tone: 'violet', trend: 'up', hint: '+8% هذا الشهر', spark: sparkTrace(counts.activeFreelancers) },
    { icon: Building2, label: 'ملاك المساحات', value: counts.owners, tone: 'blue', trend: 'up', hint: '+5% هذا الشهر', spark: sparkTrace(counts.owners) },
    { icon: ShieldCheck, label: 'بانتظار التحقق', value: counts.pendingVerif, tone: 'amber', trend: 'warn', hint: 'تحتاج مراجعة', spark: sparkTrace(counts.pendingVerif) },
  ];

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((u) => next.delete(u.id));
      else filtered.forEach((u) => next.add(u.id));
      return next;
    });
  };

  const setStatusMany = (ids, status) => {
    setUsers((prev) => prev.map((u) => (ids.has(u.id) ? { ...u, status } : u)));
    setSelected(new Set());
  };

  const toggleSuspend = (id) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'suspended' ? 'active' : 'suspended' } : u
      )
    );
  };

  const handleBulkApprove = () => {
    setUsers((prev) =>
      prev.map((u) => (selected.has(u.id) ? { ...u, status: 'active', verified: true } : u))
    );
    setSelected(new Set());
  };

  const handleBulkSuspend = () => setStatusMany(selected, 'suspended');

  const handleExportCsv = () => {
    const rows = selected.size > 0 ? selectedUsers : filtered;
    const lines = [CSV_HEADERS, ...rows.map((u) => [u.name, u.email, u.phone, ROLE_AR[u.role], STATUS_AR[u.status], u.verified ? 'موثق' : 'قيد المراجعة', u.bookings, u.joined])];
    const csv = '\uFEFF' + lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'masahati-users.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== deleteTarget);
      setSelected((s) => (next.length === prev.length ? s : new Set(next.map((u) => u.id).filter((id) => s.has(id)))));
      return next;
    });
    setDeleteTarget(null);
  };

  const openEdit = (u) => {
    setEditTarget(u);
    setDraft({ ...u });
    setMenu(null);
  };

  const saveEdit = () => {
    if (!draft || !editTarget) return;
    setUsers((prev) => prev.map((u) => (u.id === editTarget.id ? draft : u)));
    setEditTarget(null);
    setDraft(null);
  };

  const openRowMenu = (e, u) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, r.left - 168);
    setMenu({ id: u.id, top: r.bottom + 6, left });
  };

  const clearFilters = () => {
    setAdvOpen(false);
    setFVerif('all');
    setFJoinedFrom('');
    setFJoinedTo('');
    setFMinBookings('');
    setPage(1);
  };

  const hasAdvFilters = fVerif !== 'all' || fJoinedFrom || fJoinedTo || fMinBookings;

  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-5">
      {/* بطاقات المؤشرات */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c) => (
          <StatCard key={c.label} {...c} commas />
        ))}
      </div>

      <SectionCard>
        <SectionHeading
          icon={Users}
          title="إدارة المستخدمين والملاك"
          subtitle={`${counts.total} حساب · ${counts.activeFreelancers} فريلانسر نشط · ${counts.owners} مالك · ${counts.pendingVerif} بانتظار التحقق · ${counts.suspended} موقوف`}
        />

        {/* التبويبات + البحث */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Pill key={t.id} active={tab === t.id} onClick={() => { setTab(t.id); setPage(1); }}>
                {t.label}
              </Pill>
            ))}
          </div>
          <div className="relative lg:max-w-xs lg:flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="ابحث بالاسم أو البريد أو الهاتف…"
              className="dash__input dash__input--icon"
            />
          </div>
        </div>

        {/* شريط أدوات متقدم: فلاتر + إجراءات جماعية */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`dash__toolbtn${advOpen ? ' is-active' : ''}`}
            onClick={() => setAdvOpen((o) => !o)}
            aria-expanded={advOpen}
          >
            {advOpen ? <FilterX className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
            فلاتر متقدمة
            {hasAdvFilters && <span className="dash__toolbtn-count">{filteredActiveCount()}</span>}
          </button>

          <div className="relative" data-row-menu>
            <button
              type="button"
              className={`dash__toolbtn${bulkOpen ? ' is-active' : ''}`}
              onClick={() => setBulkOpen((o) => !o)}
              disabled={selected.size === 0}
              aria-expanded={bulkOpen}
            >
              <CheckCircle2 className="h-4 w-4" />
              إجراءات جماعية
              {selected.size > 0 && <span className="dash__toolbtn-count">{selected.size}</span>}
            </button>

            {bulkOpen && (
              <AnimatePresence>
                <motion.div
                  className="dash__menu dash__menu--inline"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                >
                <button type="button" onClick={() => { handleBulkApprove(); setBulkOpen(false); }}>
                  <UserCheck className="h-4 w-4" />
                  اعتماد المحددين
                </button>
                <button type="button" onClick={() => { handleBulkSuspend(); setBulkOpen(false); }}>
                  <Ban className="h-4 w-4" />
                  إيقاف المحددين
                </button>
                <button type="button" onClick={() => { handleExportCsv(); setBulkOpen(false); }}>
                  <Download className="h-4 w-4" />
                  تصدير CSV
                </button>
              </motion.div>
              </AnimatePresence>
            )}
          </div>

          {selected.size > 0 && (
            <span className="dash__selected-bar">
              تم تحديد <b>{selected.size}</b>
              <button type="button" onClick={() => setSelected(new Set())}>
                إلغاء التحديد
              </button>
            </span>
          )}

          {!advOpen && hasAdvFilters && (
            <span className="dash__selected-bar">{filtered.length} نتيجة متوافقة مع الفلاتر</span>
          )}
        </div>

        {/* لوحة الفلاتر المتقدمة */}
        <AnimatePresence initial={false}>
          {advOpen && (
            <motion.div
              className="dash__filter-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="dash__field-label">حالة التحقق</label>
                  <select className="dash__input" value={fVerif} onChange={(e) => { setFVerif(e.target.value); setPage(1); }}>
                    <option value="all">الكل</option>
                    <option value="verified">تم التحقق</option>
                    <option value="pending">قيد المراجعة</option>
                  </select>
                </div>
                <div>
                  <label className="dash__field-label">الانضمام من</label>
                  <input type="date" className="dash__input" value={fJoinedFrom} onChange={(e) => { setFJoinedFrom(e.target.value); setPage(1); }} />
                </div>
                <div>
                  <label className="dash__field-label">الانضمام حتى</label>
                  <input type="date" className="dash__input" value={fJoinedTo} onChange={(e) => { setFJoinedTo(e.target.value); setPage(1); }} />
                </div>
                <div>
                  <label className="dash__field-label">حد أدنى للحجوزات</label>
                  <input type="number" min="0" placeholder="مثال: 5" className="dash__input" value={fMinBookings} onChange={(e) => { setFMinBookings(e.target.value); setPage(1); }} />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" className="btn-ghost" onClick={clearFilters}>
                  <FilterX className="h-4 w-4" />
                  إعادة الضبط
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="لا توجد نتائج مطابقة"
            description="جرّب تعديل كلمة البحث أو تغيير الفلتر للعثور على الحسابات."
            actionLabel="إعادة الضبط"
            onAction={() => {
              setQuery('');
              setTab('all');
              clearFilters();
            }}
          />
        ) : (
          <div className="dash__table-wrap">
            <table className="dash__table min-w-[58rem] text-sm">
              <thead>
                <tr>
                  <th className="w-10">
                    <Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleSelectAll} label="تحديد الكل" />
                  </th>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>التحقق</th>
                  <th className="num">الحجوزات</th>
                  <th>آخر نشاط</th>
                  <th>الانضمام</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => {
                  const st = statusMeta[u.status] || statusMeta.active;
                  const StatusIcon = st.Icon;
                  const isSelected = selected.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      className={`dash__tr-select${isSelected ? ' is-selected' : ''}`}
                      onClick={() => setViewUser(u)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onChange={() => toggleSelect(u.id)} label={`تحديد ${u.name}`} />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <Avatar name={u.name} xs />
                            <PresenceDot online={u.online} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-bold" style={{ color: 'var(--text-strong)' }}>{u.name}</p>
                            <p className="txt-muted truncate text-xs" dir="ltr">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge tone={roleTone[u.role]}>{roleLabel[u.role]}</StatusBadge>
                      </td>
                      <td>
                        <StatusBadge tone={st.tone} icon={StatusIcon}>{st.label}</StatusBadge>
                      </td>
                      <td>
                        {u.verified ? (
                          <StatusBadge tone="blue" icon={ShieldCheck}>تم التحقق</StatusBadge>
                        ) : (
                          <StatusBadge tone="amber" icon={Clock}>قيد المراجعة</StatusBadge>
                        )}
                      </td>
                      <td>
                        <div className="flex items-end justify-end gap-2">
                          <span className="num">{u.bookings}</span>
                          {u.activity && u.activity.length > 1 ? (
                            <span className="dash__sparkbox"><RowSpark data={u.activity} /></span>
                          ) : null}
                        </div>
                      </td>
                      <td className="txt-muted text-xs">{u.lastActive}</td>
                      <td className="txt-muted text-xs" dir="ltr">{u.joined}</td>
                      <td data-row-menu className="dash__actions-cell">
                        <button
                          type="button"
                          className="dash__menu-btn"
                          aria-label={`إجراءات ${u.name}`}
                          onClick={(e) => openRowMenu(e, u)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* شريط الترقيم */}
        {filtered.length > 0 && (
          <div className="dash__pager">
            <span className="dash__pager-info">
              عرض {start}–{end} من <b>{filtered.length}</b> مستخدماً
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="dash__pager-btn"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 1}
                aria-label="الصفحة السابقة"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && arr[i - 1] !== p - 1) acc.push('gap');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === 'gap' ? (
                    <span key={`gap-${idx}`} className="dash__pager-gap">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`dash__pager-btn${safePage === p ? ' is-active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                type="button"
                className="dash__pager-btn"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= totalPages}
                aria-label="الصفحة التالية"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* قائمة إجراءات الصف */}
      <AnimatePresence>
        {menu &&
          createPortal(
            <motion.div
              className="dash__menu dash__menu--fixed"
              style={{ top: menu.top, left: menu.left }}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              <button type="button" onClick={() => { const t = users.find((u) => u.id === menu.id); setViewUser(t); setMenu(null); }}>
                <Eye className="h-4 w-4" />
                عرض الملف
              </button>
              <button type="button" onClick={() => openEdit(users.find((u) => u.id === menu.id))}>
                <Pencil className="h-4 w-4" />
                تعديل
              </button>
              <button type="button" onClick={() => { toggleSuspend(menu.id); setMenu(null); }}>
                {users.find((u) => u.id === menu.id)?.status === 'suspended' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    تفعيل الحساب
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    إيقاف الحساب
                  </>
                )}
              </button>
              <button type="button" className="is-danger" onClick={() => { setDeleteTarget(menu.id); setMenu(null); }}>
                <Trash2 className="h-4 w-4" />
                حذف
              </button>
            </motion.div>,
            document.body
          )}
      </AnimatePresence>

      {/* نافذة منزلقة لعرض الملف */}
      <AnimatePresence>
        {viewUser &&
          createPortal(
            <>
              <motion.div
                className="dash__scrim dash__drawer-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setViewUser(null)}
              />
              <motion.aside
                className="dash__drawer"
                role="dialog"
                aria-modal="true"
                aria-label={`ملف ${viewUser.name}`}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
              >
                <div className="dash__drawer-head">
                  <h3>ملف المستخدم</h3>
                  <button type="button" className="dash__iconbtn" onClick={() => setViewUser(null)} aria-label="إغلاق">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="dash__drawer-body">
                  <div className="flex flex-col items-center gap-3 py-2 text-center">
                    <div className="relative">
                      <span className="dash__avatar" style={{ width: '4.5rem', height: '4.5rem', fontSize: '1.4rem' }}>
                        {(viewUser.name || 'م').trim().slice(0, 2)}
                      </span>
                      <PresenceDot online={viewUser.online} />
                    </div>
                    <div>
                      <h2 className="m-0 text-xl font-extrabold" style={{ color: 'var(--text-strong)' }}>{viewUser.name}</h2>
                      <p className="m-0 text-xs" style={{ color: 'var(--text-muted)' }} dir="ltr">{viewUser.email} · {viewUser.phone}</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <StatusBadge tone={roleTone[viewUser.role]}>{roleLabel[viewUser.role]}</StatusBadge>
                      <StatusBadge tone={statusMeta[viewUser.status]?.tone}>
                        {statusMeta[viewUser.status]?.label}
                      </StatusBadge>
                      {viewUser.verified ? (
                        <StatusBadge tone="blue" icon={ShieldCheck}>تم التحقق</StatusBadge>
                      ) : (
                        <StatusBadge tone="amber" icon={Clock}>قيد المراجعة</StatusBadge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="dash__soft">
                      <dt className="txt-caption text-xs">تاريخ الانضمام</dt>
                      <dd className="mt-0.5 font-bold" style={{ color: 'var(--text-strong)' }}>{viewUser.joined}</dd>
                    </div>
                    <div className="dash__soft">
                      <dt className="txt-caption text-xs">آخر نشاط</dt>
                      <dd className="mt-0.5 font-bold" style={{ color: 'var(--text-strong)' }}>{viewUser.lastActive}</dd>
                    </div>
                    <div className="dash__soft col-span-2">
                      <dt className="mb-1 flex items-center gap-1.5 txt-caption text-xs">
                        <Activity className="h-3.5 w-3.5" />
                        نشاط الحجوزات
                      </dt>
                      <dd className="m-0">
                        <div className="flex items-end gap-3">
                          <svg className="h-10 w-24 flex-1" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden="true">
                            <polyline points={sparkPoints(viewUser.activity)} fill="none" stroke="#f97316" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="num text-lg">{viewUser.bookings} حجز</span>
                        </div>
                      </dd>
                    </div>
                  </div>
                </div>

                <div className="dash__drawer-foot">
                  <button type="button" className={btnGhost} onClick={() => setViewUser(null)}>
                    إغلاق
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => { setEditTarget(viewUser); setDraft({ ...viewUser }); }}>
                    <Pencil className="h-4 w-4" />
                    تعديل
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      toggleSuspend(viewUser.id);
                      setViewUser((v) => (v ? { ...v, status: v.status === 'suspended' ? 'active' : 'suspended' } : v));
                    }}
                  >
                    {viewUser.status === 'suspended' ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                    {viewUser.status === 'suspended' ? 'تفعيل الحساب' : 'إيقاف الحساب'}
                  </button>
                </div>
              </motion.aside>
            </>,
            document.body
          )}
      </AnimatePresence>

      {/* نافذة التعديل */}
      <Modal open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title={editTarget ? `تعديل حساب ${editTarget.name}` : 'تعديل الحساب'}>
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="dash__field-label">الاسم الكامل</label>
                <input className="dash__input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <label className="dash__field-label">البريد الإلكتروني</label>
                <input className="dash__input" dir="ltr" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div>
                <label className="dash__field-label">الهاتف</label>
                <input className="dash__input" dir="ltr" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div>
                <label className="dash__field-label">الدور</label>
                <select className="dash__input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                  <option value="freelancer">فريلانسر</option>
                  <option value="owner">صاحب مساحة</option>
                </select>
              </div>
              <div>
                <label className="dash__field-label">الحالة</label>
                <select className="dash__input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="active">نشط</option>
                  <option value="suspended">موقوف</option>
                  <option value="review">قيد المراجعة</option>
                </select>
              </div>
              <div>
                <label className="dash__field-label">التحقق من الهوية</label>
                <select className="dash__input" value={draft.verified ? 'verified' : 'pending'} onChange={(e) => setDraft({ ...draft, verified: e.target.value === 'verified' })}>
                  <option value="verified">تم التحقق</option>
                  <option value="pending">قيد المراجعة</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setEditTarget(null)}>
                إلغاء
              </button>
              <button type="button" className={btnPrimary} onClick={saveEdit}>
                حفظ التعديلات
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* تأكيد الحذف */}
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="حذف الحساب نهائياً؟">
        <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          سيتم حذف جميع بيانات المستخدم وحجوزاته نهائياً من المنصة، ولا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setDeleteTarget(null)}>
            إلغاء
          </button>
          <button type="button" onClick={handleDelete} className={btnDanger}>
            <Trash2 className="h-4 w-4" />
            نعم، احذف الحساب
          </button>
        </div>
      </Modal>
    </div>
  );

  function filteredActiveCount() {
    let n = 0;
    if (fVerif === 'verified' || fVerif === 'pending') n += 1;
    if (fJoinedFrom || fJoinedTo) n += 1;
    if (fMinBookings) n += 1;
    return n;
  }
}