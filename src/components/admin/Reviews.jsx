import { useState } from 'react';
import { Star, Eye, EyeOff, Trash2, MessageSquare } from 'lucide-react';
import { reviews as initialReviews } from '../../lib/adminMock';
import { Card, SectionHeader, Badge, Modal, PrimaryButton } from './ui';

function Stars({ value }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
    </span>
  );
}

export default function AdminReviews() {
  const [list, setList] = useState(initialReviews);
  const [toDelete, setToDelete] = useState(null);

  const toggleHidden = (id) => setList((prev) => prev.map((r) => (r.id === id ? { ...r, status: r.status === 'hidden' ? 'visible' : 'hidden' } : r)));

  const confirmDelete = () => {
    setList((prev) => prev.filter((r) => r.id !== toDelete.id));
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <Card className="p-0! overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <SectionHeader icon={MessageSquare} title="إشراف على التقييمات والمراجعات" />
        </div>

        {list.length === 0 ? (
          <div className="p-5 text-center text-sm text-gray-400">لا توجد مراجعات لعرضها.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {list.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-orange-50/40 dark:hover:bg-gray-700/30 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-extrabold text-orange-600 dark:bg-gray-700 dark:text-orange-400">{r.space}</span>
                    <span className="text-xs font-extrabold text-zinc-800 dark:text-gray-200">{r.user}</span>
                    <Stars value={r.rating} />
                    <span className="text-xs text-gray-400" dir="ltr">{r.date}</span>
                    {r.status === 'hidden' && <Badge tone="gray">مخفية</Badge>}
                  </div>
                  <p className={`m-0 mt-1.5 text-xs leading-6 ${r.status === 'hidden' ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300'}`}>
                    {r.comment}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2 md:ms-4">
                  <button
                    type="button"
                    onClick={() => toggleHidden(r.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                      r.status === 'hidden'
                        ? 'bg-green-100 text-green-700 hover:bg-green-500 hover:text-white dark:bg-green-500/15 dark:text-green-400'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white dark:bg-amber-500/10 dark:text-amber-400'
                    }`}
                  >
                    {r.status === 'hidden' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {r.status === 'hidden' ? 'إظهار' : 'إخفاء'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(r)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3.5 py-2 text-xs font-extrabold text-red-600 transition hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" /> حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="حذف المراجعة">
        {toDelete && (
          <div>
            <p className="m-0 text-sm leading-6 text-gray-500 dark:text-gray-400">
              سيتم حذف مراجعة <strong className="text-zinc-900 dark:text-gray-100">{toDelete.comment}</strong> نهائياً
              من تقييمات مساحة «{toDelete.space}». لا يمكن التراجع.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
              >
                إلغاء
              </button>
              <PrimaryButton onClick={confirmDelete} className="bg-red-500! shadow-red-500/25! hover:bg-red-600!">
                <Trash2 className="h-4 w-4" />
                نعم، احذف
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}