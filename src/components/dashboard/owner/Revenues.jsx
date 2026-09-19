import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Loader2, Sparkles, X, Repeat, CircleDollarSign, BadgeCheck,
  Building2, CalendarClock, Clock, FileText, TrendingUp,
} from 'lucide-react';
import { isOwnerDemo, loadOwnerDashboardWithFallback } from '../../../lib/owner';

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

function fmtMoney(n) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(n || 0);
}

function isConfirmed(status) {
  return status === 'confirmed' || status === 'accepted' || status === 'completed';
}

export default function Revenues({ data }) {
  const [bookings, setBookings] = useState(() => data?.bookings || []);
  const [offers, setOffers] = useState(() => data?.offers || []);
  const [demo, setDemo] = useState(() => isOwnerDemo());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadOwnerDashboardWithFallback(force);
      setBookings(result.bookings || []);
      setOffers(result.offers || []);
      setDemo(result.demo);
    } catch {
      /* لا نكسر العرض */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const confirmedBookings = bookings.filter((b) => isConfirmed(b.status));
  const bookingsRevenue = confirmedBookings.reduce((sum, b) => sum + Number(b.price || 0), 0);
  const upcomingBookings = bookings.filter((b) => b.status === 'pending' || b.status === 'future');
  const upcomingRevenue = upcomingBookings.reduce((sum, b) => sum + Number(b.price || 0), 0);

  const acceptedOffers = offers.filter((o) => o.status === 'accepted');
  const offersRevenue = acceptedOffers.reduce((sum, o) => sum + Number(o.price_per_hour || 0) * Number(o.duration_hours || 0), 0);

  const totalHours = confirmedBookings.reduce((sum, b) => sum + Number(b.hours || 0), 0);
  const avgPerHour = totalHours > 0 ? bookingsRevenue / totalHours : 0;

  const bySpace = {};
  confirmedBookings.forEach((b) => {
    const key = b.spaceName || 'أخرى';
    if (!bySpace[key]) bySpace[key] = { revenue: 0, count: 0 };
    bySpace[key].revenue += Number(b.price || 0);
    bySpace[key].count += 1;
  });

  const revenueCards = [
    { icon: CircleDollarSign, value: bookingsRevenue, label: 'إيرادات الحجوزات' },
    { icon: BadgeCheck, value: offersRevenue, label: 'عروض مقبولة (متوقع)' },
    { icon: TrendingUp, value: upcomingRevenue, label: 'حجوزات قادمة' },
    { icon: Clock, value: avgPerHour, label: 'متوسط ش.ج/ساعة' },
  ];

  const totalLine = bookingsRevenue + offersRevenue + upcomingRevenue;

  return (
    <section className="odash__revenues">
      {demo && !bannerDismissed && (
        <div className="odash__banner">
          <Sparkles />
          <p>
            <b>حساب توضيحي للإيرادات</b> — تُحتسب من بيانات لوحتك الحالية.
            لم تجرِّ أي حجز فعلي بعد، لذا ستظهر الأرقام حسب ما ورد من الباك إند.
          </p>
          <button type="button" onClick={() => setBannerDismissed(true)} aria-label="إغلاق" className="odash__banner-x">
            <X />
          </button>
        </div>
      )}

      <div className="odash__market-head">
        <div>
          <h2><Wallet /> الإيرادات</h2>
          <p>تلخيص مالي لحجوزات مساحاتك وعروضك في السوق.</p>
        </div>
        <button
          type="button"
          className="odash__market-refresh"
          onClick={() => load(true)}
          disabled={refreshing}
          aria-label="تحديث الإيرادات"
          title="تحديث الإيرادات"
        >
          <Repeat className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {loading && confirmedBookings.length === 0 ? (
        <div className="odash__state">
          <div className="ost-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ احتساب الإيرادات…</h3>
          <p>نلخّص حجوزاتك وعروضك الحالية.</p>
        </div>
      ) : (
        <>
          <div className="odash__total-band">
            <div className="odash__total-band-ico"><Wallet /></div>
            <div>
              <span>إجمالي الإيرادات المقدَّرة</span>
              <b>{fmtMoney(totalLine)} <small>ش.ج</small></b>
            </div>
          </div>

          <section className="odash__stats odash__stats--4">
            {revenueCards.map((c) => {
              const Icon = c.icon;
              return (
                <div className="odash__stat" key={c.label}>
                  <div className="ost-ico"><Icon /></div>
                  <b>{fmtNumber(Math.round(c.value))}</b>
                  <span>{c.label}</span>
                </div>
              );
            })}
          </section>

          <section className="odash__section">
            <div className="odash__section-head">
              <h2><Building2 /> الإيرادات حسب المساحة</h2>
            </div>
            {Object.keys(bySpace).length > 0 ? (
              <div className="odash__list">
                {Object.entries(bySpace)
                  .sort((a, b) => b[1].revenue - a[1].revenue)
                  .map(([name, info]) => (
                    <div className="odash__space" key={name}>
                      <div className="odash__space-ico"><Building2 /></div>
                      <div className="odash__space-body">
                        <h3>{name}</h3>
                        <p>{fmtNumber(info.count)} حجز مؤكَّد حتى الآن</p>
                      </div>
                      <div className="odash__space-side">
                        <b>{fmtMoney(info.revenue)}</b>
                        <small>ش.ج إجمالاً</small>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="odash__state">
                <div className="ost-svg"><CalendarClock /></div>
                <h3>لا حجوزات مؤكَّدة بعد</h3>
                <p>عند تأكيد أول حجز على مساحتك ستظهر إيراداتك هنا تلقائياً.</p>
              </div>
            )}
          </section>

          <section className="odash__section">
            <div className="odash__section-head">
              <h2><CalendarClock /> الحجوزات الأخيرة</h2>
            </div>
            {bookings.length > 0 ? (
              <div className="odash__list">
                {bookings.slice(0, 8).map((b) => (
                  <div className="odash__space" key={b.id}>
                    <img src={b.image || ''} alt={b.spaceName} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className="odash__space-body">
                      <h3>{b.spaceName}</h3>
                      <p>{b.customer ? `العميل: ${b.customer}` : ''}</p>
                      <div className="odash__space-meta">
                        <span><CalendarClock /> {b.date || '—'}</span>
                        {b.time && <span><Clock /> {b.time}</span>}
                        {b.hours > 0 && <span>{fmtNumber(b.hours)} ساعات</span>}
                      </div>
                    </div>
                    <div className="odash__space-side">
                      <b>{fmtMoney(b.price)}</b>
                      <small>ش.ج</small>
                      <span className={`odash__space-active${isConfirmed(b.status) ? '' : ' is-hollow'}`}>
                        {isConfirmed(b.status) ? 'مؤكَّد' : (b.status || 'قادم')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="odash__state">
                <div className="ost-svg"><FileText /></div>
                <h3>لا حجوزات بعد</h3>
                <p>ستظهر حجوزات مساحاتك هنا فور ورودها من الباك إند.</p>
              </div>
            )}
          </section>

          <section className="odash__section">
            <div className="odash__section-head">
              <h2><CircleDollarSign /> عروض المقبولة المتوقعة</h2>
            </div>
            {acceptedOffers.length > 0 ? (
              <div className="odash__list">
                {acceptedOffers.map((o) => {
                  const amount = Number(o.price_per_hour || 0) * Number(o.duration_hours || 0);
                  return (
                    <div className="odash__space" key={o.id}>
                      <div className="odash__space-ico"><BadgeCheck /></div>
                      <div className="odash__space-body">
                        <h3>{o.requestTitle || 'طلب خاص'}</h3>
                        <p>{fmtNumber(o.duration_hours)} ساعة × {fmtNumber(o.price_per_hour)} ش.ج/ساعة</p>
                      </div>
                      <div className="odash__space-side">
                        <b>{fmtMoney(amount)}</b>
                        <small>ش.ج متوقع</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="odash__state">
                <div className="ost-svg"><CircleDollarSign /></div>
                <h3>لا عروض مقبولة بعد</h3>
                <p>ما إن يقرّ الطالب أحد عروضك سيُضاف المبلغ المتوقع لهذه القائمة.</p>
              </div>
            )}
          </section>

          <p className="odash__revenues-note">
            * الأرقام تقديرية بناءً على بيانات لوحتك، وتحدُّث تلقائياً مع تأكيد الحجوزات.
          </p>
        </>
      )}
    </section>
  );
}