import { useCallback, useState } from 'react';
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
import { SectionCard, SectionHeading, StatusBadge, EmptyState, Pill, SmallAction, DataSourceBanner, Toast, DataGate } from './ui';
import { useToast } from './useToast';
import useAdminData from './useAdminData';
import { listBookings, listDisputes, resolveDispute as apiResolveDispute, isAdminTokenLive } from '@/lib/adminApi';
import { adaptBooking, adaptDispute, adaptAll } from '@/lib/adminAdapters';

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

// قيم بديلة آمنة — بيانات الـ API قد تحتوي حالة غير معرّفة.
const bookingStatus = (status) => bookingMeta[status] || { label: 'غير محدّدة', tone: 'gray' };
const disputeStatusMeta = (status) => disputeStatus[status] || { label: 'غير محدّدة', tone: 'gray' };

// مكان فارغ للحالة الأولى: لا صفوف ⇒ لا أرقام، أما «لم يرد بعد» فانتظار صريح.
const NO_ROWS = [];

export default function AdminBookings() {
  const [tab, setTab] = useState('bookings');
  const { toast, announce, dismiss } = useToast();

  // العقد §7.1 و§8.1: الحجوزات والنزاعات مصدران مستقلّان، فنجلبهما معاً حتى
  // يكون التبويب الآخر جاهزاً فور نقره لا بعد رحلة شبكة.
  //
  // المحوّلات (adminAdapters) ترقّي أسماء حقول العقد إلى أسماء الجدول:
  // `customer` ← `user`، `price` ← `amount`، `time_from`+`time_to` ← `time`،
  // و`reason` ← `issue`. بدونها كانت أعمدة «المستأجر» و«المبلغ» و«الموعد»
  // فارغة على خادم حقيقي.
  const fetchBookings = useCallback(async () => {
    const { rows } = await listBookings({ sort: 'newest' });
    return adaptAll(rows, adaptBooking);
  }, []);

  const fetchDisputes = useCallback(async () => {
    const { rows } = await listDisputes({ status: 'open' });
    return adaptAll(rows, adaptDispute);
  }, []);

  const {
    data: bookingsRaw,
    loading: loadingBookings,
    error: errorBookings,
    live,
    reload: reloadBookings,
  } = useAdminData(fetchBookings);

  const {
    data: disputesRaw,
    setData: setDisputes,
    loading: loadingDisputes,
    error: errorDisputes,
    reload: reloadDisputes,
  } = useAdminData(fetchDisputes);

  // القائمتان فارغتان (لا تحملان أرقاماً) حتى يصل أول ردّ، والعدّاد يعرض
  // «—» لا صفراً، ويظهر الانتظار كحالة صريحة لا كسجلّ فارغ.
  const bookings = bookingsRaw ?? NO_ROWS;
  const disputes = disputesRaw ?? NO_ROWS;
  const awaitingBookings = bookingsRaw === null;
  const awaitingDisputes = disputesRaw === null;

  // التحديث المتفائل قد يقع قبل أول ردّ، فتكون القيمة null؛ نطبّعها.
  const patchDisputes = (fn) => setDisputes((prev) => fn(Array.isArray(prev) ? prev : []));

  // العقد §8.3: قرار واحد ينقل الحالة على الخادم (resolved / closed).
  // التحديث المحلي فوري، والإرسال يتبعه — ويُعاد الحالة عند الفشل بدل ترك
  // النزاع «محسوماً» على الشاشة بينما الخادم لم يتغيّر.
  const decide = (dispute, decision, nextStatus, message) => {
    const ref = dispute.ref;
    patchDisputes((prev) => prev.map((d) => (d.ref === ref ? { ...d, status: nextStatus } : d)));
    announce(message);
    if (!isAdminTokenLive()) return;
    // العقد: refund_amount مطلوب عند decision=refund، والحد الأعلى هو مبلغ الحجز.
    const body = decision === 'refund' ? { decision, refund_amount: dispute.amount } : { decision };
    apiResolveDispute(ref, body).catch((err) => {
      patchDisputes((prev) => prev.map((d) => (d.ref === ref ? { ...d, status: 'open' } : d)));
      announce(err?.message || 'تعذّر تنفيذ القرار على الخادم.');
    });
  };

  const resolveDispute = (d) => decide(d, 'resolve', 'resolved', 'تم حل النزاع.');
  const refundDispute = (d) => decide(d, 'refund', 'closed', 'تم إغلاق النزاع مع استرداد المبلغ.');

  // العدّاد لا يعرض عدداً لم يرد بعد من الخادم.

  return (
    <div className="space-y-5">
      <DataSourceBanner
        live={live}
        loading={tab === 'bookings' ? loadingBookings : loadingDisputes}
        error={tab === 'bookings' ? errorBookings : errorDisputes}
        onRetry={tab === 'bookings' ? reloadBookings : reloadDisputes}
      />

      {/* تبديل بين الحجوزات والنزاعات */}
      <div className="flex flex-wrap gap-2">
        <Pill active={tab === 'bookings'} onClick={() => setTab('bookings')}>
          كل الحجوزات ({awaitingBookings ? '—' : bookings.length})
        </Pill>
        <Pill active={tab === 'disputes'} onClick={() => setTab('disputes')}>
          النزاعات والشكاوى ({awaitingDisputes ? '—' : disputes.length})
        </Pill>
      </div>

      {tab === 'bookings' ? (
        awaitingBookings ? (
          <DataGate live={live} loading={loadingBookings} error={errorBookings} onRetry={reloadBookings} rows={4} errorTitle="تعذّر جلب الحجوزات" />
        ) : (
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
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="txt-muted py-6 text-center text-sm">
                      لا توجد حجوزات مسجّلة.
                    </td>
                  </tr>
                )}
                {bookings.map((b) => (
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
                      <StatusBadge tone={bookingStatus(b.status).tone}>{bookingStatus(b.status).label}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        )
      ) : awaitingDisputes ? (
        <DataGate live={live} loading={loadingDisputes} error={errorDisputes} onRetry={reloadDisputes} rows={4} errorTitle="تعذّر جلب النزاعات" />
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
                    <StatusBadge tone={disputeStatusMeta(d.status).tone}>{disputeStatusMeta(d.status).label}</StatusBadge>
                  </div>
                  <p className="dash__soft mt-3">{d.issue}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="txt-caption">فُتح: {d.opened}</span>
                    <div className="flex flex-wrap gap-2">
                      {d.status === 'open' && (
                        <>
                          <SmallAction tone="green" onClick={() => resolveDispute(d)}>
                            <CheckCircle2 />
                            حل النزاع
                          </SmallAction>
                          <SmallAction tone="red" onClick={() => refundDispute(d)}>
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

      <Toast message={toast} onClose={dismiss} />
    </div>
  );
}