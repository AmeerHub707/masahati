import { useState } from 'react';
import { TicketCheck, Scale, Check, RotateCcw, Search } from 'lucide-react';
import { bookings as initialBookings, disputes as initialDisputes, BOOKING_STATUS_LABELS, CURRENCY } from '../../lib/adminMock';
import { Card, SectionHeader, SearchInput, Badge, EmptyState } from './ui';

const BOOKING_TONE = {
  confirmed: 'green',
  completed: 'blue',
  disputed: 'red',
  cancelled: 'gray',
};

const DISPUTE_TONE = {
  open: 'amber',
  resolved: 'green',
  refunded: 'blue',
};

export default function AdminBookings() {
  const [tab, setTab] = useState('bookings');
  const [bookings, setBookings] = useState(initialBookings);
  const [disputes, setDisputes] = useState(initialDisputes);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredBookings = bookings.filter((b) => {
    const q = query.trim().toLowerCase();
    const matchQuery = !q || b.user.toLowerCase().includes(q) || b.space.toLowerCase().includes(q) || String(b.id).includes(q);
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchQuery && matchStatus;
  });

  const resolveDispute = (id) => setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d)));
  const refundDispute = (id) => {
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'refunded' } : d)));
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'completed' } : { ...b })));
  };

  return (
    <div className="space-y-4">
      {/* تبويب فرعي: الحجوزات / النزاعات */}
      <div className="flex w-fit items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setTab('bookings')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
            tab === 'bookings' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'text-gray-600 hover:bg-orange-50 hover:text-orange-500 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          <TicketCheck className="h-4 w-4" />
          الحجوزات
        </button>
        <button
          type="button"
          onClick={() => setTab('disputes')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
            tab === 'disputes' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'text-gray-600 hover:bg-orange-50 hover:text-orange-500 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          <Scale className="h-4 w-4" />
          النزاعات والشكاوى
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[0.65rem] font-extrabold text-red-600 dark:bg-red-500/15 dark:text-red-400">
            {disputes.filter((d) => d.status === 'open').length}
          </span>
        </button>
      </div>

      {tab === 'bookings' ? (
        <Card className="p-0! overflow-hidden">
          <div className="p-5">
            <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث برقم الحجز أو المستخدم…" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'confirmed', label: 'مؤكد' },
                { id: 'completed', label: 'مكتمل' },
                { id: 'disputed', label: 'متنازع عليه' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                    statusFilter === f.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-500 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {filteredBookings.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Search} title="لا توجد حجوزات مطابقة" description="عدّل الفلتر أو كلمة البحث لعرض سجل الحجوزات." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead>
                  <tr className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-400 dark:border-gray-700 dark:bg-gray-700/30 dark:text-gray-500">
                    <th className="px-5 py-3 text-start font-extrabold">#</th>
                    <th className="px-5 py-3 text-start font-extrabold">المستخدم</th>
                    <th className="px-5 py-3 text-start font-extrabold">المساحة</th>
                    <th className="px-5 py-3 text-start font-extrabold">الموعد</th>
                    <th className="px-5 py-3 text-start font-extrabold">المدة</th>
                    <th className="px-5 py-3 text-start font-extrabold">المبلغ</th>
                    <th className="px-5 py-3 text-start font-extrabold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="transition hover:bg-orange-50/40 dark:hover:bg-gray-700/30">
                      <td className="px-5 py-3 text-xs font-bold text-gray-400" dir="ltr">{b.id}</td>
                      <td className="px-5 py-3 text-xs font-bold text-zinc-800 dark:text-gray-200">{b.user}</td>
                      <td className="px-5 py-3 text-xs text-zinc-700 dark:text-gray-300">{b.space}</td>
                      <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                        <span dir="ltr">{b.date}</span> · <span dir="ltr">{b.time}</span>
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400">{b.hours} ساعات</td>
                      <td className="px-5 py-3 text-xs font-extrabold text-orange-500">{b.amount} {CURRENCY}</td>
                      <td className="px-5 py-3">
                        <Badge tone={BOOKING_TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status] || b.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-0! overflow-hidden">
          <div className="p-5">
            <SectionHeader icon={Scale} title="النزاعات والشكاوى المفتوحة" />
          </div>
          {disputes.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Scale} title="لا توجد نزاعات" description="كل الحجوزات تسير بسلاسة حالياً." />
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {disputes.map((d) => (
                <li key={d.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-orange-50/40 dark:hover:bg-gray-700/30 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="m-0 text-xs font-extrabold text-zinc-800 dark:text-gray-200">{d.user}</p>
                      <span className="text-xs text-gray-400" dir="ltr">حجز {d.bookingId}</span>
                      <Badge tone={DISPUTE_TONE[d.status]}>
                        {d.status === 'open' ? 'مفتوح' : d.status === 'refunded' ? 'تم الاسترداد' : 'تم الحل'}
                      </Badge>
                    </div>
                    <p className="m-0 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <strong className="text-zinc-700 dark:text-gray-300">{d.space}:</strong> {d.reason}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-2 md:ms-4">
                    <span className="text-sm font-extrabold text-orange-500">{d.amount} {CURRENCY}</span>
                    {d.status === 'open' && (
                      <>
                        <button
                          type="button"
                          onClick={() => resolveDispute(d.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-3.5 py-2 text-xs font-extrabold text-white transition hover:bg-green-600"
                        >
                          <Check className="h-4 w-4" /> حل النزاع
                        </button>
                        <button
                          type="button"
                          onClick={() => refundDispute(d.bookingId)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-extrabold text-white transition hover:bg-orange-600"
                        >
                          <RotateCcw className="h-4 w-4" /> استرداد المبلغ
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}