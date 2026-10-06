import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, Receipt, CircleDollarSign, CalendarCheck, Clock, Building2,
  X, Repeat, Sparkles, Printer,
  FileDown, MapPin, Gauge, BadgeCheck, ListChecks, TrendingUp, CalendarDays, BarChart3,
} from 'lucide-react';
import { isOwnerDemo, loadOwnerDashboardWithFallback, belongsToSpace } from '@/lib/owner';
import ChartBars from './ChartBars';
import SpacePicker from './SpacePicker';
import StatCardsSkeleton from './StatCardsSkeleton';

const numFmt = new Intl.NumberFormat('ar-EG');
const moneyFmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });
const dayFmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

function fmtNumber(n) {
  return numFmt.format(n || 0);
}

function fmtMoney(n) {
  return moneyFmt.format(Math.round(n || 0));
}

function isConfirmed(status) {
  return status === 'confirmed' || status === 'accepted' || status === 'completed';
}

function isCancelled(status) {
  return status === 'cancelled' || status === 'rejected' || status === 'closed';
}

const STATUS_LABELS = {
  confirmed: 'مؤكَّد',
  accepted: 'مقبول',
  pending: 'قيد الانتظار',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  rejected: 'مرفوض',
  closed: 'مغلق',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'غير معروف';
}

function localDayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthKey(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : '';
}

function fmtDayTitle(key) {
  const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return '';
  return dayFmt.format(d);
}

function startClock(b) {
  const m = String(b.timeFrom || b.time || '').match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

const VIEWS = [
  { id: 'invoices', label: 'الفواتير', icon: Receipt },
  { id: 'bookings', label: 'كل الحجوزات', icon: ListChecks },
  { id: 'report', label: 'تقرير الأداء', icon: TrendingUp },
];

const REPORT_METRICS = [
  { id: 'revenue', label: 'الإيرادات', type: 'money' },
  { id: 'bookings', label: 'الحجوزات', type: 'count' },
  { id: 'hours', label: 'الساعات', type: 'count' },
  { id: 'occupancy', label: 'الإشغال', type: 'percent' },
];

function metricValue(row, metric) {
  if (metric === 'bookings') return row.confirmed;
  if (metric === 'hours') return row.hours;
  if (metric === 'occupancy') return row.occupancy;
  return row.revenue;
}

function metricFormat(metric, v) {
  if (metric.type === 'money') return fmtMoney(v);
  if (metric.type === 'percent') return `${fmtNumber(Math.round(v || 0))}٪`;
  return fmtNumber(v);
}

function metricTotalLabel(metric) {
  if (metric.id === 'bookings') return 'إجمالي الحجوزات';
  if (metric.id === 'hours') return 'إجمالي الساعات';
  if (metric.id === 'occupancy') return 'متوسط الإشغال';
  return 'إجمالي الإيرادات';
}

function niceMax(v) {
  const m = Math.max(Number(v) || 0, 1);
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const d = m / p;
  const step = d <= 1 ? 1 : d <= 2 ? 2 : d <= 2.5 ? 2.5 : d <= 5 ? 5 : 10;
  return step * p;
}

export default function Financials({ data }) {
  const [bookings, setBookings] = useState(() => data?.bookings || []);
  const [spaces, setSpaces] = useState(() => data?.spaces || []);
  const [offers, setOffers] = useState(() => data?.offers || []);
  const [demo, setDemo] = useState(() => isOwnerDemo());
  const [loading, setLoading] = useState(() => !Array.isArray(data?.bookings));
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [view, setView] = useState('invoices');
  const [reportMetric, setReportMetric] = useState('revenue');
  const [spaceId, setSpaceId] = useState(''); // '' = كل المساحات
  const [printDoc, setPrintDoc] = useState(null); // { type:'invoice', id } | { type:'invoices' } | { type:'report' }
  const mountedRef = useRef(true);
  const printTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearTimeout(printTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!printDoc) return undefined;
    const afterPrint = () => setPrintDoc(null);
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, [printDoc]);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadOwnerDashboardWithFallback(force);
      if (!mountedRef.current) return;
      setBookings(result.bookings || []);
      setSpaces(result.spaces || []);
      setOffers(result.offers || []);
      setDemo(result.demo);
    } catch {
      /* لا نكسر العرض */
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // التبويب يعتمد على بيانات اللوحة الأم (لا يعيد تحميل اللوحة كاملة)،
  // ويُحدَّث من زر الإنعاش الذي يستدعي load(true).
  useEffect(() => {
    if (Array.isArray(data?.bookings)) return undefined;
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load, data?.bookings]);

  const selectedSpace = spaces.find((s) => String(s.id) === String(spaceId)) || null;

  const scopedBookings = selectedSpace
    ? bookings.filter((b) => belongsToSpace(b, selectedSpace))
    : bookings;

  const invoices = useMemo(() => {
    return scopedBookings
      .filter((b) => isConfirmed(b.status))
      .slice()
      .sort((a, z) => String(z.date || '').localeCompare(String(a.date || '')))
      .map((b) => ({
        ...b,
        number: `INV-${String(b.id).padStart(5, '0')}`,
      }));
  }, [scopedBookings]);

  const visibleBookings = useMemo(() => {
    return scopedBookings
      .slice()
      .sort((a, z) => String(z.date || '').localeCompare(String(a.date || '')));
  }, [scopedBookings]);

  const totalRevenue = invoices.reduce((s, b) => s + Number(b.price || 0), 0);
  const totalHours = invoices.reduce((s, b) => s + Number(b.hours || 0), 0);
  const avgPerHour = totalHours > 0 ? totalRevenue / totalHours : 0;
  const acceptedOffers = offers.filter((o) => o.status === 'accepted').length;

  // تقرير الأداء: كل مؤشرات المساحة تُشتق من الحجوزات نفسها (الالتزام مع باقي اللوحة).
  const perfRows = useMemo(() => {
    const now = new Date();
    const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const daysElapsed = now.getDate() || 1;
    return spaces
      .map((sp) => {
        const scoped = bookings.filter((b) => belongsToSpace(b, sp));
        const conf = scoped.filter((b) => isConfirmed(b.status));
        const hours = conf.reduce((s, b) => s + Number(b.hours || 0), 0);
        const revenue = conf.reduce((s, b) => s + Number(b.price || 0), 0);
        const monthlyHours = conf
          .filter((b) => monthKey(b.date) === curYM)
          .reduce((s, b) => s + Number(b.hours || 0), 0);
        const dailyCap = Number(sp.capacity || 0) * 8;
        const occupancy = dailyCap > 0
          ? Math.min(100, Math.round((monthlyHours / (dailyCap * daysElapsed)) * 100))
          : Number(sp.stats?.occupancy || 0);
        return {
          id: sp.id,
          title: sp.title,
          location: sp.location || '',
          capacity: sp.capacity || 0,
          active: sp.is_active !== false,
          confirmed: conf.length,
          hours,
          revenue,
          avg: hours > 0 ? revenue / hours : Number(sp.price_per_hour || 0),
          occupancy,
        };
      })
      .sort((a, z) => z.revenue - a.revenue);
  }, [spaces, bookings]);

  const reportChart = useMemo(() => {
    const active = REPORT_METRICS.find((m) => m.id === reportMetric) || REPORT_METRICS[0];
    if (perfRows.length === 0) return { active, points: [], max: 0, total: 0, top: null };
    const points = perfRows.map((row) => ({
      id: row.id,
      label: row.title,
      value: metricValue(row, active.id),
      display: metricFormat(active, metricValue(row, active.id)),
    }));
    const max = niceMax(Math.max(...points.map((p) => p.value), 0));
    const total = points.reduce((s, p) => s + Number(p.value || 0), 0);
    const top = points.slice().sort((a, z) => z.value - a.value)[0] || null;
    return { active, points, max, total, top };
  }, [perfRows, reportMetric]);

  const selectedReport = perfRows.find((r) => String(r.id) === String(spaceId)) || null;
  const selectedConfirmed = selectedSpace
    ? invoices
    : [];

  const statCards = [
    {
      icon: Wallet,
      value: fmtMoney(totalRevenue),
      unit: 'ش.ج',
      label: 'إيرادات الفواتير',
      accent: 'orange',
    },
    {
      icon: Receipt,
      value: fmtNumber(invoices.length),
      label: 'عدد الفواتير',
      accent: 'blue',
    },
    {
      icon: Clock,
      value: fmtNumber(totalHours),
      unit: 'ساعة',
      label: 'ساعات محجوزة',
      accent: 'green',
    },
    {
      icon: CircleDollarSign,
      value: fmtMoney(avgPerHour),
      unit: 'ش.ج',
      label: 'متوسط / ساعة',
      accent: 'violet',
    },
  ];

  const doPrint = (doc) => {
    setPrintDoc(doc);
    clearTimeout(printTimerRef.current);
    printTimerRef.current = setTimeout(() => {
      window.print();
      // بعض المتصفحات لا تُطلق afterprint عند إلغاء نافذة الطباعة،
      // فنُفرغ الغطاء فور إغلاق الحوار حتى لا يعلق العرض.
      if (mountedRef.current) setPrintDoc(null);
    }, 200);
  };

  const invoiceToPrint = printDoc?.type === 'invoice'
    ? invoices.find((b) => String(b.id) === String(printDoc.id))
    : null;

  const printHeadTitle =
    printDoc?.type === 'invoice' ? 'فاتورة'
      : printDoc?.type === 'invoices' ? 'قائمة الفواتير'
        : printDoc?.type === 'report' ? 'تقرير الأداء'
          : '';

  const printFilterLabel = printDoc
    ? selectedSpace ? selectedSpace.title : 'كل المساحات'
    : '';

  return (
    <section className="fin">
      {demo && !bannerDismissed && (
        <div className="odash__banner" role="status">
          <Sparkles />
          <p>
            <b>وضع تجريبي</b> — تُشتق الفواتير والتقارير من بيانات لوحتك الحالية.
            عند تفعيل واجهة الباك إند ستُحدَّث تلقائياً من السجل الحقيقي.
          </p>
          <button type="button" onClick={() => setBannerDismissed(true)} aria-label="إغلاق" className="odash__banner-x">
            <X />
          </button>
        </div>
      )}

      <div className="obk__hero">
        <div className="obk__hero-main">
          <h2><Wallet /> المالية</h2>
          <p>فواتيرك وكل الحجوزات وتقرير الأداء لكل مساحة، مع إمكانية التصدير PDF.</p>
          <div className="obk__hero-meta">
            <span className="obk__hero-chip"><Receipt /> {fmtNumber(invoices.length)} فاتورة</span>
            <span className="obk__hero-chip"><CircleDollarSign /> {fmtMoney(totalRevenue)} ش.ج</span>
            <span className="obk__hero-chip"><Building2 /> {fmtNumber(spaces.length)} مساحة</span>
            <span className="obk__hero-chip"><TrendingUp /> {fmtNumber(acceptedOffers)} عرض مقبول</span>
          </div>
        </div>
        <div className="obk__hero-side">
          <SpacePicker
            spaces={spaces}
            spaceId={spaceId}
            onPick={setSpaceId}
            label={(sel) => (sel ? 'تُعرض المالية لـ ' : 'تُعرض المالية لكل المساحات')}
          />
          <button
            type="button"
            className="odash__market-refresh obk__hero-refresh"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="تحديث المالية"
            title="تحديث المالية"
          >
            <Repeat className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading && bookings.length === 0 ? (
        <StatCardsSkeleton cols={4} />
      ) : (
        <>
          <section className="odash__stats odash__stats--4">
            {statCards.map((c) => {
              const Icon = c.icon;
              return (
                <div className={`odash__stat odash__stat--${c.accent}`} key={c.label}>
                  <div className="ost-ico"><Icon /></div>
                  <b>{c.value}{c.unit ? <small className="odash__stat-unit">{c.unit}</small> : null}</b>
                  <span>{c.label}</span>
                </div>
              );
            })}
          </section>

          <div className="filterbar" role="group" aria-label="أقسام المالية">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const on = view === v.id;
              return (
                <button
                  type="button"
                  key={v.id}
                  className={on ? 'is-active' : ''}
                  onClick={() => setView(v.id)}
                  aria-pressed={on}
                >
                  {on && (
                    <motion.span
                      layoutId="filterbar-financials"
                      className="filterbar-pill"
                      transition={{ type: 'spring', stiffness: 480, damping: 38, mass: 0.9 }}
                    />
                  )}
                  <Icon />
                  <span className="filterbar-label">{v.label}</span>
                  {v.id === 'invoices' && invoices.length > 0 && (
                    <b className="filterbar-count">{fmtNumber(invoices.length)}</b>
                  )}
                </button>
              );
            })}
          </div>

          {view === 'invoices' && (
            <section className="odash__section">
              <div className="odash__section-head">
                <h2><Receipt /> الفواتير</h2>
                {invoices.length > 0 && (
                  <div className="fin__head-actions">
                    <button type="button" className="fin__export" onClick={() => doPrint({ type: 'invoices' })}>
                      <FileDown /> تصدير الكل PDF
                    </button>
                  </div>
                )}
              </div>

              {invoices.length === 0 ? (
                <div className="odash__state">
                  <div className="ost-svg"><Receipt /></div>
                  <h3>لا توجد فواتير</h3>
                  <p>{selectedSpace ? 'لا توجد حجوزات مؤكَّدة لهذه المساحة بعد.' : 'لا توجد حجوزات مؤكَّدة بعد.'}</p>
                </div>
              ) : (
                <div className="obk__rows">
                  {invoices.map((inv) => (
                    <div className="obk__row is-confirmed" key={inv.id}>
                      <span className="obk__row-line" />
                      <span className="obk__row-main">
                        <b>{inv.number}</b>
                        <small className="obk__row-date"><CalendarDays /> {fmtDayTitle(inv.date)}</small>
                        <small><CalendarCheck /> {inv.spaceName || 'مساحة غير محددة'} · {startClock(inv) || '—'}</small>
                      </span>
                      <span className="obk__row-side">
                        <span className="obk__status is-ok"><BadgeCheck /> مدفوعة</span>
                        <span className="fin__amount">{fmtMoney(inv.price)} <small>ش.ج</small></span>
                        <button
                          type="button"
                          className="fin__pdf"
                          onClick={() => doPrint({ type: 'invoice', id: inv.id })}
                          aria-label={`تصدير ${inv.number} PDF`}
                        >
                          <Printer /> PDF
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {view === 'bookings' && (
            <section className="odash__section">
              <div className="odash__section-head">
                <h2><ListChecks /> كل الحجوزات</h2>
              </div>

              {visibleBookings.length === 0 ? (
                <div className="odash__state">
                  <div className="ost-svg"><ListChecks /></div>
                  <h3>لا توجد حجوزات</h3>
                  <p>{selectedSpace ? 'لا توجد حجوزات لهذه المساحة حتى الآن.' : 'لا توجد حجوزات بعد.'}</p>
                </div>
              ) : (
                <div className="obk__rows">
                  {visibleBookings.map((b) => (
                    <div className={`obk__row is-${b.status || 'pending'}`} key={b.id}>
                      <span className="obk__row-time">{startClock(b) || '—'}</span>
                      <span className="obk__row-line" />
                      <span className="obk__row-main">
                        <b>{b.customer || 'عميل'}</b>
                        <small className="obk__row-date"><CalendarDays /> {fmtDayTitle(b.date)}</small>
                        <small><CalendarCheck /> {b.spaceName || 'مساحة غير محددة'}</small>
                      </span>
                      <span className="obk__row-side">
                        <span className={`obk__status is-${isCancelled(b.status) ? 'off' : (isConfirmed(b.status) ? 'ok' : 'pending')}`}>
                          {statusLabel(b.status)}
                        </span>
                        <span className="fin__amount is-sm">{fmtMoney(b.price)} <small>ش.ج</small></span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {view === 'report' && (
            <section className="odash__section">
              <div className="odash__section-head">
                <h2><TrendingUp /> تقرير الأداء</h2>
                {perfRows.length > 0 && (
                  <div className="fin__head-actions">
                    <button type="button" className="fin__export" onClick={() => doPrint({ type: 'report' })}>
                      <FileDown /> تصدير PDF
                    </button>
                  </div>
                )}
              </div>

              {selectedSpace && selectedReport ? (
                <>
                  <section className="odash__stats odash__stats--4">
                    <div className="odash__stat odash__stat--orange">
                      <div className="ost-ico"><Wallet /></div>
                      <b>{fmtMoney(selectedReport.revenue)}<small className="odash__stat-unit">ش.ج</small></b>
                      <span>الإيرادات</span>
                    </div>
                    <div className="odash__stat odash__stat--blue">
                      <div className="ost-ico"><BadgeCheck /></div>
                      <b>{fmtNumber(selectedReport.confirmed)}</b>
                      <span>حجوزات مؤكَّدة</span>
                    </div>
                    <div className="odash__stat odash__stat--green">
                      <div className="ost-ico"><Clock /></div>
                      <b>{fmtNumber(selectedReport.hours)}<small className="odash__stat-unit">ساعة</small></b>
                      <span>ساعات محجوزة</span>
                    </div>
                    <div className="odash__stat odash__stat--violet">
                      <div className="ost-ico"><Gauge /></div>
                      <b>{fmtNumber(selectedReport.occupancy)}<small className="odash__stat-unit">٪</small></b>
                      <span>الإشغال</span>
                    </div>
                  </section>

                  <div className="obk__space obk__space--single">
                    <div className="obk__space-head">
                      <div className="obk__space-ico"><Building2 /></div>
                      <div className="obk__space-title">
                        <h3>{selectedReport.title}</h3>
                        <p><MapPin /> {selectedReport.location || 'بدون موقع'}</p>
                      </div>
                      <span className={`obk__space-status${selectedReport.active ? '' : ' is-off'}`}>
                        {selectedReport.active ? 'نشطة' : 'متوقفة'}
                      </span>
                    </div>
                    <div className="obk__space-occ">
                      <div className="obk__space-occ-label">
                        <span><Gauge /> الإشغال</span>
                        <b>{fmtNumber(selectedReport.occupancy)}٪</b>
                      </div>
                      <div className="fin__occ"><i style={{ width: `${Math.min(100, selectedReport.occupancy)}%` }} /></div>
                    </div>
                  </div>

                  <div className="fin__recent-head">
                    <h3><Receipt /> آخر الحجوزات المفوترة</h3>
                  </div>
                  {selectedConfirmed.length === 0 ? (
                    <div className="odash__state">
                      <div className="ost-svg"><Receipt /></div>
                      <h3>لا توجد فواتير بعد</h3>
                      <p>تظهر هنا الحجوزات المؤكَّدة لهذه المساحة.</p>
                    </div>
                  ) : (
                    <div className="obk__rows">
                      {selectedConfirmed.slice(0, 8).map((inv) => (
                        <div className="obk__row is-confirmed" key={inv.id}>
                          <span className="obk__row-line" />
                          <span className="obk__row-main">
                            <b>{inv.number}</b>
                            <small className="obk__row-date"><CalendarDays /> {fmtDayTitle(inv.date)}</small>
                            <small><CalendarCheck /> {inv.spaceName || ''} · {startClock(inv) || '—'}</small>
                          </span>
                          <span className="obk__row-side">
                            <span className="obk__status is-ok"><BadgeCheck /> مدفوعة</span>
                            <span className="fin__amount">{fmtMoney(inv.price)} <small>ش.ج</small></span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="fin__recent-head fin__chart-head">
                    <h3><BarChart3 /> مقارنة الأداء</h3>
                  </div>

                  <div className="odash__chart fin__chart">
                    <div className="filterbar filterbar--sm">
                      {REPORT_METRICS.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          className={reportMetric === m.id ? 'is-active' : ''}
                          onClick={() => setReportMetric(m.id)}
                          aria-pressed={reportMetric === m.id}
                        >
                          {reportMetric === m.id && (
                            <motion.span
                              layoutId="filterbar-fin-metrics"
                              className="filterbar-pill"
                              transition={{ type: 'spring', stiffness: 480, damping: 38, mass: 0.9 }}
                            />
                          )}
                          <span className="filterbar-label">{m.label}</span>
                        </button>
                      ))}
                    </div>

                    {reportChart.points.length > 0 ? (
                      <>
                        <div className="odash__chart-body">
                          <div className="odash__chart-y">
                            {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                              <span key={f} style={{ top: `${(1 - f) * 100}%` }}>
                                {metricFormat(reportChart.active, reportChart.max * f)}
                              </span>
                            ))}
                          </div>
                          <ChartBars
                            points={reportChart.points.map((p) => ({
                              ...p,
                              key: p.id,
                              isTop: reportChart.top && reportChart.top.id === p.id,
                            }))}
                            max={reportChart.max}
                            barClassName={(p) => (p.isTop ? ' is-top' : '')}
                            tip={(p) => `${p.label} — ${p.display}`}
                          />
                        </div>

                        <div className="odash__chart-foot">
                          <div>
                            <small>{metricTotalLabel(reportChart.active)}</small>
                            <b>
                              {metricFormat(reportChart.active, reportChart.total)}
                              {reportChart.active.type === 'money' ? <span>ش.ج</span> : null}
                            </b>
                          </div>
                          {reportChart.top && (
                            <span className="odash__chart-growth is-up">
                              <TrendingUp /> أعلى مساحة: {reportChart.top.label}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="odash__state">
                        <div className="ost-svg"><BarChart3 /></div>
                        <h3>لا توجد بيانات للمقارنة</h3>
                        <p>أضف مساحات أو حجوزات مؤكَّدة لعرض المخطط.</p>
                      </div>
                    )}
                  </div>

                  <div className="fin__report-grid obk__spaces">
                    {perfRows.map((row) => (
                    <div className={`obk__space${row.active ? '' : ' is-off'}`} key={row.id}>
                      <div className="obk__space-head">
                        <div className="obk__space-ico"><Building2 /></div>
                        <div className="obk__space-title">
                          <h3>{row.title}</h3>
                          <p><MapPin /> {row.location || 'بدون موقع'}</p>
                        </div>
                        <span className={`obk__space-status${row.active ? '' : ' is-off'}`}>
                          {row.active ? 'نشطة' : 'متوقفة'}
                        </span>
                      </div>
                      <div className="obk__space-stats">
                        <div><b>{fmtNumber(row.confirmed)}</b><span>حجوزات مؤكَّدة</span></div>
                        <div><b>{fmtNumber(row.hours)}</b><span>ساعات</span></div>
                        <div><b>{fmtMoney(row.revenue)}</b><span>الإيرادات</span></div>
                        <div><b>{fmtMoney(row.avg)}</b><span>متوسط/ساعة</span></div>
                      </div>
                      <div className="obk__space-occ">
                        <div className="obk__space-occ-label">
                          <span><Gauge /> الإشغال</span>
                          <b>{fmtNumber(row.occupancy)}٪</b>
                        </div>
                        <div className="fin__occ"><i style={{ width: `${Math.min(100, row.occupancy)}%` }} /></div>
                      </div>
                    </div>
                  ))}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}

      {printDoc && (
        <div className="fin__print" id="fin-print">
          <div className="fin__print-head">
            <div className="fin__print-brand">
              <b>مساحاتي</b>
              <small>منصة تأجير المساحات والغرف</small>
            </div>
            <div className="fin__print-title">
              <b>{printHeadTitle}</b>
              <small>{printFilterLabel}</small>
            </div>
          </div>

          <div className="fin__print-meta">
            <span>صادر عن: {data?.user?.name || 'صاحب مساحة'}</span>
            <span>تاريخ الإصدار: {fmtDayTitle(localDayKey(new Date()))}</span>
          </div>

          {printDoc.type === 'invoice' && invoiceToPrint && (
            <>
              <div className="fin__print-box">
                <div className="fin__print-grid">
                  <div><b>رقم الفاتورة</b><span>{invoiceToPrint.number}</span></div>
                  <div><b>التاريخ</b><span>{fmtDayTitle(invoiceToPrint.date)}</span></div>
                  <div><b>العميل</b><span>{invoiceToPrint.customer || 'عميل'}</span></div>
                  <div><b>المساحة</b><span>{invoiceToPrint.spaceName || 'مساحة غير محددة'}</span></div>
                  <div><b>الوقت</b><span>{startClock(invoiceToPrint) || '—'}</span></div>
                  <div><b>المدة</b><span>{fmtNumber(invoiceToPrint.hours)} ساعة</span></div>
                </div>
              </div>
              <table className="fin__print-table">
                <thead>
                  <tr><th>البيان</th><th>المدة</th><th>السعر</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>حجز {invoiceToPrint.spaceName || 'مساحة'} — {fmtDayTitle(invoiceToPrint.date)}</td>
                    <td>{fmtNumber(invoiceToPrint.hours)} ساعة</td>
                    <td>{fmtMoney(invoiceToPrint.price)} ش.ج</td>
                  </tr>
                </tbody>
              </table>
              <div className="fin__print-total">
                <span>الإجمالي</span>
                <b>{fmtMoney(invoiceToPrint.price)} ش.ج — مدفوعة</b>
              </div>
            </>
          )}

          {printDoc.type === 'invoices' && (
            <>
              <table className="fin__print-table">
                <thead>
                  <tr>
                    <th>رقم</th><th>التاريخ</th><th>العميل</th><th>المساحة</th><th>الساعات</th><th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.number}</td>
                      <td>{fmtDayTitle(inv.date)}</td>
                      <td>{inv.customer || 'عميل'}</td>
                      <td>{inv.spaceName || '—'}</td>
                      <td>{fmtNumber(inv.hours)}</td>
                      <td>{fmtMoney(inv.price)} ش.ج</td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr><td colSpan="6">لا توجد فواتير.</td></tr>
                  )}
                </tbody>
              </table>
              <div className="fin__print-total">
                <span>إجمالي الفواتير ({fmtNumber(invoices.length)})</span>
                <b>{fmtMoney(totalRevenue)} ش.ج</b>
              </div>
            </>
          )}

          {printDoc.type === 'report' && (
            <table className="fin__print-table">
              <thead>
                <tr>
                  <th>المساحة</th><th>حجوزات مؤكَّدة</th><th>ساعات</th><th>الإيرادات</th><th>متوسط/ساعة</th><th>الإشغال</th>
                </tr>
              </thead>
              <tbody>
                {perfRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{fmtNumber(row.confirmed)}</td>
                    <td>{fmtNumber(row.hours)}</td>
                    <td>{fmtMoney(row.revenue)} ش.ج</td>
                    <td>{fmtMoney(row.avg)} ش.ج</td>
                    <td>{fmtNumber(row.occupancy)}٪</td>
                  </tr>
                ))}
                {perfRows.length === 0 && (
                  <tr><td colSpan="6">لا توجد بيانات.</td></tr>
                )}
              </tbody>
            </table>
          )}

          <div className="fin__print-foot">
            مساحاتي — وثيقة صادرة عن لوحة المالك. للأغراض التوضيحية ومتطلبات العرض.
          </div>
        </div>
      )}
    </section>
  );
}