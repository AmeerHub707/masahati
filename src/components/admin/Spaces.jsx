import { useState } from 'react';
import { Building2, MapPin, Star, Users, Check, X, Search, Clock3 } from 'lucide-react';
import { spaces as initialSpaces, SPACE_STATUS_LABELS, CURRENCY } from '../../lib/adminMock';
import { Card, SearchInput, Badge, EmptyState } from './ui';

const STATUS_TONE = {
  active: 'green',
  suspended: 'red',
  pending: 'amber',
};

export default function AdminSpaces() {
  const [list, setList] = useState(initialSpaces);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = list.filter((s) => {
    const q = query.trim().toLowerCase();
    const matchQuery = !q || s.title.toLowerCase().includes(q) || s.owner.toLowerCase().includes(q) || s.location.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchQuery && matchStatus;
  });

  const setStatus = (id, status) => setList((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));

  return (
    <div className="space-y-4">
      <Card className="p-0! overflow-hidden">
        <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المساحة أو المالك…" />
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'كل المساحات' },
              { id: 'pending', label: 'قيد المراجعة' },
              { id: 'active', label: 'مفعّلة' },
              { id: 'suspended', label: 'موقوفة' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                  statusFilter === f.id
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="لا توجد مساحات مطابقة"
          description="لم نجد أي مساحة تطابق بحثك أو فلتر الحالة الحالي. جرّب ضبط المعايير."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
              }}
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
            >
              عرض كل المساحات
            </button>
          }
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="flex flex-col overflow-hidden p-0!">
              <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-orange-100 to-amber-50 dark:from-gray-700 dark:to-gray-800">
                <Building2 className="h-10 w-10 text-orange-400 dark:text-orange-500/60" />
                <span className="absolute top-3 left-3">
                  <Badge tone={STATUS_TONE[s.status]}>{SPACE_STATUS_LABELS[s.status]}</Badge>
                </span>
                {s.status === 'pending' && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[0.65rem] font-extrabold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    <Clock3 className="h-3 w-3" /> بانتظار مراجعتك
                  </span>
                )}
                {s.rating > 0 && (
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[0.68rem] font-extrabold text-amber-300 backdrop-blur-sm">
                    <Star className="h-3 w-3" /> {s.rating}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="m-0 text-base font-extrabold text-zinc-900 dark:text-gray-100">{s.title}</h3>
                <p className="m-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {s.owner} · <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {s.location}</span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 dark:bg-gray-700"><Users className="h-3.5 w-3.5" /> {s.capacity} مقعد</span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 dark:bg-gray-700">{s.bookings} حجز</span>
                  <span className="me-auto text-sm font-extrabold text-orange-500">{s.price} {CURRENCY}/ساعة</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 p-3 dark:border-gray-700">
                {s.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStatus(s.id, 'active')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-green-600"
                    >
                      <Check className="h-4 w-4" /> الموافقة
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(s.id, 'suspended')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-extrabold text-red-600 transition hover:bg-red-500 hover:text-white dark:border-red-900 dark:bg-red-500/10 dark:text-red-400"
                    >
                      <X className="h-4 w-4" /> الرفض
                    </button>
                  </>
                ) : s.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => setStatus(s.id, 'suspended')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-extrabold text-amber-700 transition hover:bg-amber-500 hover:text-white dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-400"
                  >
                    <X className="h-4 w-4" /> إيقاف
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatus(s.id, 'active')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-orange-600"
                  >
                    <Check className="h-4 w-4" /> إعادة التفعيل
                  </button>
                )}
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}