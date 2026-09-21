import { useState } from 'react';
import { MessageSquareQuote, EyeOff, Trash2, Flag, Eye } from 'lucide-react';
import { adminReviews } from '../../data/adminMockData';
import {
  SectionCard,
  SectionHeading,
  StatusBadge,
  EmptyState,
  Modal,
  btnGhost,
  btnDanger,
  Pill,
  SmallAction,
  Stars,
  Avatar,
} from './ui';

const filters = [
  { id: 'all', label: 'كل المراجعات' },
  { id: 'flagged', label: 'مبلّغ عنها' },
  { id: 'hidden', label: 'مخفية' },
];

export default function AdminReviews() {
  const [reviews, setReviews] = useState(adminReviews);
  const [filter, setFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = reviews.filter((r) => {
    if (filter === 'flagged') return r.flagged;
    if (filter === 'hidden') return !r.visible;
    return true;
  });

  const toggleHide = (id) =>
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)));

  const handleDelete = () => {
    if (!deleteTarget) return;
    setReviews((prev) => prev.filter((r) => r.id !== deleteTarget));
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <SectionCard>
        <SectionHeading
          icon={MessageSquareQuote}
          title="التقييمات والمراجعات"
          subtitle="مراجعة تقييمات المساحات والتحكم بالمحتوى غير المناسب"
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {filters.map((opt) => (
            <Pill key={opt.id} active={filter === opt.id} onClick={() => setFilter(opt.id)}>
              {opt.label}
            </Pill>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            title="لا توجد مراجعات هنا"
            description="لا توجد مراجعات ضمن هذا الفلتر حالياً."
            actionLabel="عرض الكل"
            onAction={() => setFilter('all')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filtered.map((r) => (
              <div
                key={r.id}
                className={`dash__card dash__card--flush flex flex-col transition ${
                  r.visible ? '' : 'border-dashed opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.user} />
                    <div>
                      <p className="font-extrabold" style={{ color: 'var(--text-strong)' }}>{r.user}</p>
                      <p className="txt-caption">{r.space}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Stars value={r.rating} />
                    <div className="flex gap-1.5">
                      {r.flagged && r.visible && (
                        <StatusBadge tone="red" icon={Flag}>مبلّغ عنها</StatusBadge>
                      )}
                      {!r.visible && (
                        <StatusBadge tone="gray" icon={EyeOff}>مخفية</StatusBadge>
                      )}
                    </div>
                  </div>
                </div>

                <p className="dash__soft mt-3 flex-1">{r.text}</p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="txt-caption">{r.date}</span>
                  <div className="flex gap-2">
                    <SmallAction tone={r.visible ? 'amber' : 'sky'} onClick={() => toggleHide(r.id)}>
                      {r.visible ? <EyeOff /> : <Eye />}
                      {r.visible ? 'إخفاء' : 'إظهار'}
                    </SmallAction>
                    <SmallAction tone="red" onClick={() => setDeleteTarget(r.id)}>
                      <Trash2 />
                      حذف
                    </SmallAction>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="حذف المراجعة نهائياً؟">
        <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          سيتم إزالة هذه المراجعة نهائياً، ولن يتمكن المستخدمون من مشاهدتها أو استعادتها.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setDeleteTarget(null)}>
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className={btnDanger}
          >
            <Trash2 className="h-4 w-4" />
            نعم، احذف المراجعة
          </button>
        </div>
      </Modal>
    </div>
  );
}