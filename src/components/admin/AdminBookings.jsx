import { useState } from 'react';
import {
  CalendarCheck,
  Scale,
  CheckCircle2,
  Undo2,
  CalendarDays,
  Clock,
  User,
  Building2,
} from 'lucide-react';
import { adminBookings, adminDisputes } from '../../data/adminMockData';
import { SectionCard, SectionHeading, StatusBadge, EmptyState, Pill, SmallAction } from './ui';

const bookingMeta = {
  confirmed: { label: 'مؤكد', tone: 'blue' },
  completed: { label: 'مكتمل', tone: 'green' },
  disputed: { label: 'متنازع عليه', tone: 'red' },
};

const disputeStatus = {
  open: { label: 'مفتوح', tone: 'amber' },
  resolved: { label: 'تم الحل', tone: 'green' },
  closed: { label: 'مغلق', tone: 'gray' },
};

export default function AdminBookings() {
  const [tab, setTab] = useState('bookings');
  const [disputes, setDisputes] = useState(adminDisputes);

  const resolveDispute = (id) =>
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d)));

  const refundDispute = (id) => setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'closed' } : d)));

  return (
    <div className="space-y-5">
      {/* تبديل بين الحجوزات والنزاعات */}
      <div className="flex flex-wrap gap-2">
        <Pill active={tab === 'bookings'} onClick={() => setTab('bookings')}>
          كل الحجوزات ({adminBookings.length})
        </Pill>
        <Pill active={tab === 'disputes'} onClick={() => setTab('disputes')}>
          النزاعات والشكاوى ({disputes.length})
        </Pill>
      </div>

      {tab === 'bookings' ? (
        <SectionCard>
          <SectionHeading
            icon={CalendarCheck}
            title="سجل الحجوزات"
            subtitle="جميع عمليات الحجز عبر المنصة"
          />
          <div className="overflow-x-auto">
            <table className="dash__table min-w-[48rem] text-sm">
              <thead>
                <tr>
                  <th>المرجع</th>
                  <th>المستأجر</th>
                  <th>المساحة</th>
                  <th>الموعد</th>
                  <th>المدة</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {adminBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="num" dir="ltr">{b.ref}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: 'var(--text-strong)' }}>
                        <User className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                        {b.user}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{b.space}</td>
                    <td>
                      <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-strong)' }}>
                        <CalendarDays className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                        {b.date}
                      </span>
                      <span className="txt-caption mt-1 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {b.time}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{b.hours} ساعات</td>
                    <td className="num">{b.amount} ش.ج</td>
                    <td>
                      <StatusBadge tone={bookingMeta[b.status].tone}>{bookingMeta[b.status].label}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <SectionHeading
            icon={Scale}
            title="النزاعات والشكاوى"
            subtitle="معالجة الخلافات بين المستخدمين والملاك"
          />
          {disputes.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="لا توجد نزاعات"
              description="تمت معالجة جميع النزاعات والشكاوى. لا يوجد شيء يستحق المتابعة حالياً."
            />
          ) : (
            <ul className="space-y-3">
              {disputes.map((d) => (
                <li
                  key={d.id}
                  className="dash__card dash__card--flush transition hover:border-orange-300 dark:hover:border-orange-500/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="st-ico st-ico--red">
                        <Scale />
                      </span>
                      <div>
                        <p className="font-bold" style={{ color: 'var(--text-strong)' }}>
                          {d.ref} <span className="txt-muted" dir="ltr">— {d.bookingRef}</span>
                        </p>
                        <p className="txt-muted mt-0.5 text-xs">
                          {d.user} · <Building2 className="inline h-3.5 w-3.5" /> {d.space} · مبلغ {d.amount} ش.ج
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone={disputeStatus[d.status].tone}>{disputeStatus[d.status].label}</StatusBadge>
                  </div>
                  <p className="dash__soft mt-3">{d.issue}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="txt-caption">فُتح: {d.opened}</span>
                    <div className="flex flex-wrap gap-2">
                      {d.status === 'open' && (
                        <>
                          <SmallAction tone="green" onClick={() => resolveDispute(d.id)}>
                            <CheckCircle2 />
                            حل النزاع
                          </SmallAction>
                          <SmallAction tone="red" onClick={() => refundDispute(d.id)}>
                            <Undo2 />
                            استرداد المبلغ
                          </SmallAction>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}