import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Store, Send, Building2, BadgeCheck, Clock, Loader2, Sparkles,
  X, Repeat, TrendingUp, CircleDollarSign, CalendarClock, Star, MapPin,
} from 'lucide-react';
import { isOwnerDemo, loadOwnerDashboardWithFallback } from '../../../lib/owner';

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

export default function Reports({ data }) {
  const [stats, setStats] = useState(() => data?.stats || {});
  const [spaces, setSpaces] = useState(() => data?.spaces || []);
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
      setStats(result.stats);
      setSpaces(result.spaces);
      setOffers(result.offers);
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

  const pending = offers.filter((o) => o.status === 'pending').length;
  const accepted = offers.filter((o) => o.status === 'accepted').length;
  const activeSpaces = spaces.filter((s) => s.is_active !== false);
  const offersTotal = offers.length;

  const summary = [
    { icon: Building2, value: stats.spacesCount || spaces.length, label: 'مساحة مسجّلة' },
    { icon: BadgeCheck, value: stats.activeSpacesCount ?? activeSpaces.length, label: 'مساحة نشطة' },
    { icon: Send, value: offersTotal, label: 'إجمالي العروض' },
    { icon: Clock, value: pending, label: 'عروض بانتظار الرد' },
    { icon: BadgeCheck, value: accepted, label: 'عروض مقبولة' },
    { icon: Store, value: stats.openMarket || 0, label: 'طلبات مفتوحة بالسوق' },
  ];

  const spaceRows = spaces.map((s) => {
    const spaceOffers = offers.filter((o) => o.space_id === s.id);
    const spaceAccepted = spaceOffers.filter((o) => o.status === 'accepted').length;
    const utilization = activeSpaces.length ? Math.round((activeSpaces.filter((x) => x.id === s.id).length / spaces.length) * 100) : 0;
    return {
      ...s,
      offersCount: spaceOffers.length,
      acceptedCount: spaceAccepted,
      utilization: s.is_active === false ? 0 : Math.max(utilization, 0),
    };
  });

  return (
    <section className="odash__reports">
      {demo && !bannerDismissed && (
        <div className="odash__banner">
          <Sparkles />
          <p>
            <b>لوحة تقارير توضيحية</b> — الأرقام أدناه تُحتسب من بيانات لوحتك الحالية.
            عند تفعيل واجهة الباك إند بشكل كامل ستُحدَّث تلقائياً من الخادم.
          </p>
          <button type="button" onClick={() => setBannerDismissed(true)} aria-label="إغلاق" className="odash__banner-x">
            <X />
          </button>
        </div>
      )}

      <div className="odash__market-head">
        <div>
          <h2><BarChart3 /> التقارير</h2>
          <p>نظرة تحليلية على أداء مساحاتك وعروضك في السوق.</p>
        </div>
        <button
          type="button"
          className="odash__market-refresh"
          onClick={() => load(true)}
          disabled={refreshing}
          aria-label="تحديث التقارير"
          title="تحديث التقارير"
        >
          <Repeat className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {loading && offers.length === 0 ? (
        <div className="odash__state">
          <div className="ost-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ تجهيز التقارير…</h3>
          <p>نحسب مؤشرات أدائك من أحدث بيانات لوحتك.</p>
        </div>
      ) : (
        <>
          <section className="odash__stats odash__stats--6">
            {summary.map((c) => {
              const Icon = c.icon;
              return (
                <div className="odash__stat" key={c.label}>
                  <div className="ost-ico"><Icon /></div>
                  <b>{fmtNumber(c.value)}</b>
                  <span>{c.label}</span>
                </div>
              );
            })}
          </section>

          <section className="odash__section">
            <div className="odash__section-head">
              <h2><Building2 /> أداء مساحاتي</h2>
            </div>
            {spaceRows.length > 0 ? (
              <div className="odash__list">
                {spaceRows.map((s) => (
                  <div className="odash__space" key={s.id}>
                    <img src={s.image || ''} alt={s.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className="odash__space-body">
                      <h3>{s.title}</h3>
                      <div className="odash__space-meta">
                        {s.location && <span><MapPin /> {s.location}</span>}
                        {s.rating > 0 && <span className="odash__space-rating"><Star /> {s.rating}</span>}
                        <span><Send /> {fmtNumber(s.offersCount)} عرض</span>
                        <span><BadgeCheck /> {fmtNumber(s.acceptedCount)} مقبول</span>
                      </div>
                      {s.is_active !== false && (
                        <div className="odash__util-bar" role="img" aria-label={`نسبة النشاط ${s.utilization}%`}>
                          <span className="odash__util-bar-fill" style={{ width: `${Math.min(100, s.utilization)}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="odash__space-side">
                      <b>{fmtNumber(s.price_per_hour)}</b>
                      <small>ش.ج / ساعة</small>
                      <span className={`odash__space-active${s.is_active === false ? ' is-off' : ''}`}>
                        {s.is_active === false ? 'متوقفة' : 'نشطة'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="odash__state">
                <div className="ost-svg"><Building2 /></div>
                <h3>لا توجد مساحات بعد</h3>
                <p>أضف مساحتك الأولى لتظهر لاحقاً ضمن تقارير الأداء.</p>
              </div>
            )}
          </section>

          <section className="odash__section">
            <div className="odash__section-head">
              <h2><TrendingUp /> ملخص العروض</h2>
            </div>
            {offersTotal > 0 ? (
              <div className="odash__actions">
                <div className="odash__action">
                  <div className="oa-ico"><Clock /></div>
                  <div>
                    <h3>{fmtNumber(pending)}</h3>
                    <p>عرض بانتظار الرد</p>
                  </div>
                </div>
                <div className="odash__action">
                  <div className="oa-ico"><BadgeCheck /></div>
                  <div>
                    <h3>{fmtNumber(accepted)}</h3>
                    <p>عرض مقبول</p>
                  </div>
                </div>
                <div className="odash__action">
                  <div className="oa-ico"><CircleDollarSign /></div>
                  <div>
                    <h3>{fmtNumber(offersTotal)}</h3>
                    <p>إجمالي العروض المقدمة</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="odash__state">
                <div className="ost-svg"><CalendarClock /></div>
                <h3>لا توجد عروض بعد</h3>
                <p>قدّم عرضك الأول على طلبات السوق المفتوحة لبدء تتبّع أدائك.</p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}