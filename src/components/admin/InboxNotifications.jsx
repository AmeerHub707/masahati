import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, CheckCheck, Archive, Trash2, ArrowLeft, RotateCcw, Eye } from 'lucide-react';
import { inboxCategoryMeta } from '../../data/adminMockData';
import { SectionCard, SectionHeading, StatusBadge, EmptyState, Pill, Modal, btnGhost, btnDanger } from './ui';

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'unread', label: 'غير المقروء' },
  { id: 'dispute', label: 'النزاعات' },
  { id: 'space_request', label: 'طلبات المساحات' },
  { id: 'report', label: 'البلاغات' },
];

function Checkbox({ checked, indeterminate = false, onChange, label }) {
  return (
    <input
      type="checkbox"
      className="dash__check"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      aria-label={label || 'تحديد'}
    />
  );
}

export default function InboxNotifications({ inbox, setInbox }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('inbox'); // 'inbox' | 'archived'
  const [selected, setSelected] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const active = useMemo(() => inbox.filter((n) => (view === 'inbox' ? !n.archived : n.archived)), [inbox, view]);

  const filtered = useMemo(() => {
    const q = filter;
    return active.filter((n) => {
      if (q === 'unread') return !n.read;
      if (q === 'dispute' || q === 'space_request' || q === 'report') return n.category === q;
      return true;
    });
  }, [active, filter]);

  // عدّاد الوارد يستبعد المؤرشف حتى يطابق شارة الشريط الجانبي وما يراه المستخدم.
  const activeUnreadCount = useMemo(() => active.filter((n) => !n.read).length, [active]);
  const archivedCount = useMemo(() => inbox.filter((n) => n.archived).length, [inbox]);

  const allChecked = filtered.length > 0 && filtered.every((n) => selected.has(n.id));
  const someChecked = !allChecked && filtered.some((n) => selected.has(n.id));

  const markAllRead = () => {
    setInbox((prev) => prev.map((n) => (n.archived ? n : { ...n, read: true })));
    setSelected(new Set());
  };

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
      if (allChecked) filtered.forEach((n) => next.delete(n.id));
      else filtered.forEach((n) => next.add(n.id));
      return next;
    });
  };

  const toggleRead = (id) => {
    setInbox((prev) => prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)));
  };

  const archiveMany = (ids, archived = true) => {
    setInbox((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, archived } : n)));
    setSelected(new Set());
  };

  const deleteMany = () => {
    setInbox((prev) => prev.filter((n) => !selected.has(n.id)));
    setSelected(new Set());
    setConfirmDelete(false);
  };

  const openDetail = (n) => {
    const target = inboxCategoryMeta[n.category]?.path || '/admin';
    navigate(target);
  };

  return (
    <div className="space-y-5">
      <SectionCard>
        <SectionHeading
          icon={Inbox}
          title="التنبيهات الواردة"
          subtitle={`${active.length} إشعار · ${activeUnreadCount} غير مقروء`}
          action={
            <button type="button" className={btnGhost} onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" />
              تحديد الكل كمقروء
            </button>
          }
        />

        {/* حبوب التصفية + عرض الأرشيف */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Pill
                key={f.id}
                active={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                  setSelected(new Set());
                }}
              >
                {f.label}
                {f.id === 'unread' && activeUnreadCount > 0 && (
                  <span className="dash__nav-badge" style={{ position: 'static' }}>{activeUnreadCount}</span>
                )}
              </Pill>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {archivedCount > 0 && (
              <button
                type="button"
                className="dash__toolbtn"
                onClick={() => {
                  setView((v) => (v === 'archived' ? 'inbox' : 'archived'));
                  setSelected(new Set());
                }}
              >
                <Archive className="h-4 w-4" />
                {view === 'archived' ? 'العودة للوارد' : `الأرشيف (${archivedCount})`}
              </button>
            )}
            <span className="dash__selected-bar">
              عرض <b>{filtered.length}</b> من أصل {active.length}
            </span>
          </div>
        </div>

        {/* شريط الإجراءات الجماعية */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl px-1">
            <Checkbox
              checked={allChecked}
              indeterminate={someChecked}
              onChange={toggleSelectAll}
              label="تحديد الكل"
            />
            <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>تحديد الكل</span>
          </div>

          {selected.size > 0 && (
            <>
              <span className="dash__selected-bar">
                تم تحديد <b>{selected.size}</b>
                <button type="button" onClick={() => setSelected(new Set())}>
                  إلغاء التحديد
                </button>
              </span>
              <button
                type="button"
                className="dash__toolbtn"
                onClick={() => archiveMany(selected, view === 'archived' ? false : true)}
              >
                <Archive className="h-4 w-4" />
                {view === 'archived' ? 'استعادة المحدد' : 'أرشفة المحدد'}
              </button>
              <button
                type="button"
                className="dash__toolbtn"
                style={{ color: '#dc2626' }}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                حذف المحدد
              </button>
            </>
          )}
        </div>

        {/* القائمة */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={view === 'archived' ? Archive : Inbox}
            title={view === 'archived' ? 'لا توجد إشعارات في الأرشيف' : 'لا توجد إشعارات مطابقة'}
            description={
              view === 'archived'
                ? 'أرشيف البريد الوارد فارغ حتى الآن.'
                : 'جرّب تغيير الفلتر أو عد لاحقاً عند ورود إشعارات جديدة.'
            }
            actionLabel={view === 'archived' ? 'العودة للوارد' : undefined}
            onAction={() => {
              setView('inbox');
              setFilter('all');
            }}
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((n) => {
              const meta = inboxCategoryMeta[n.category] || inboxCategoryMeta.report;
              const isUnread = !n.read;
              return (
                <li
                  key={n.id}
                  className={`dash__notif-card${isUnread ? ' is-unread' : ''}${selected.has(n.id) ? ' is-selected' : ''}`}
                >
                  <Checkbox checked={selected.has(n.id)} onChange={() => toggleSelect(n.id)} label={`تحديد ${n.title}`} />

                  <div className="dash__notif-card-body">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                      {isUnread && <span className="dash__notif-card-unread" />}
                      <span className="txt-caption ms-auto">{n.time}</span>
                    </div>
                    <h4>{n.title}</h4>
                    <p>{n.body}</p>
                  </div>

                  <div className="dash__notif-card-actions">
                    {view === 'inbox' ? (
                      <button type="button" className="dash__notif-cta" onClick={() => openDetail(n)}>
                        <span>{meta.cta}</span>
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="dash__btn-soft is-sky"
                        onClick={() => archiveMany(new Set([n.id]), false)}
                      >
                        <RotateCcw className="h-4 w-4" />
                        استعادة
                      </button>
                    )}
                    <button
                      type="button"
                      className="dash__iconbtn"
                      title={isUnread ? 'تحديد كمقروء' : 'تحديد كغير مقروء'}
                      aria-label={isUnread ? 'تحديد كمقروء' : 'تحديد كغير مقروء'}
                      onClick={() => toggleRead(n.id)}
                    >
                      {isUnread ? <CheckCheck className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* تأكيد الحذف الجماعي */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="حذف الإشعارات المحددة؟">
        <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          سيتم حذف {selected.size} إشعار نهائياً من سجل البريد الوارد، ولا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>
            إلغاء
          </button>
          <button type="button" onClick={deleteMany} className={btnDanger}>
            <Trash2 className="h-4 w-4" />
            نعم، احذف المحدد
          </button>
        </div>
      </Modal>
    </div>
  );
}