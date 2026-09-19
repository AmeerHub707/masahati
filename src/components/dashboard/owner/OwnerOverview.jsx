import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AnimatedOrbs from '../../common/AnimatedOrbs';
import DashCountUp from '../DashCountUp';
import { Store, Send, Building2, Star, MapPin, Clock, BadgeCheck, Megaphone, Users, CalendarClock, CircleDollarSign, Wifi, Zap, Video, Snowflake, Mic, TrendingUp } from 'lucide-react';

const AMENITY_ICONS = {
  internet: Wifi,
  electricity: Zap,
  projector: Video,
  ac: Snowflake,
  microphone: Mic,
};

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(t.getTime())) return '';
  const diff = Math.max(0, Math.round((Date.now() - t.getTime()) / 3600000));
  if (diff < 1) return 'الآن';
  if (diff < 24) return `منذ ${diff} ساعة`;
  const days = Math.round(diff / 24);
  return days <= 30 ? `منذ ${days} يوم` : `منذ ${Math.round(days / 30)} شهر`;
}

function initialsOf(name) {
  return (name || 'م').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || 'م';
}

export default function OwnerOverview({ data }) {
  const user = data.user || {};
  const stats = data.stats || {};
  const [photoFailed, setPhotoFailed] = useState('');
  const [showSpaces, setShowSpaces] = useState(false);
  const [showMarket, setShowMarket] = useState(false);

  const statCards = [
    { icon: Building2, value: stats.spacesCount, label: 'مساحة مسجّلة' },
    { icon: Store, value: stats.openMarket, label: 'طلب مفتوح في السوق' },
    { icon: Send, value: stats.pendingOffers, label: 'عرض بانتظار الرد' },
    { icon: BadgeCheck, value: stats.acceptedOffers, label: 'عرض مقبول' },
  ];

  const spaces = (data.spaces || []).filter((s) => s.is_active !== false);
  const visibleSpaces = showSpaces ? spaces : spaces.slice(0, 3);
  const market = showMarket ? (data.market || []) : (data.market || []).slice(0, 3);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  }, []);

  return (
    <>
      <section className="odash__hero">
        <AnimatedOrbs />
        <div className="odash__hero-copy">
          {user.photo && user.photo !== photoFailed ? (
            <img
              className="odash__hero-avatar"
              src={user.photo}
              alt={user.name || ''}
              onError={() => setPhotoFailed(user.photo)}
            />
          ) : (
            user.name && <div className="odash__hero-avatar">{initialsOf(user.name)}</div>
          )}
          <h2>أهلاً <span className="odash__hero-name">{user.name || 'بك'}</span> بعودتك</h2>
          <p>
            تابع الطلبات المفتوحة في السوق، وقدّم عروضك، وأدر مساحاتك من مكان واحد.
          </p>
          <span className="odash__role-chip">
            <TrendingUp /> صاحب مساحة
          </span>
        </div>

        <div className="odash__hero-side">
          <div className="odash__hero-note">
            <span className="odash__hero-note-ico"><Megaphone /></span>
            <div>
              <h3>السوق في انتظارك</h3>
              <p>
                قدّم عرضاً على الطلبات المفتوحة التي تناسب مساحاتك.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="odash__stats">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div className="odash__stat" key={c.label}>
              <div className="ost-ico"><Icon /></div>
              <DashCountUp value={c.value} />
              <span>{c.label}</span>
            </div>
          );
        })}
      </section>

      <section className="odash__section">
        <div className="odash__section-head">
          <h2><Store /> طلبات مفتوحة في السوق</h2>
          {(data.market || []).length > 3 && (
            <button
              type="button"
              className="odash__show-all"
              onClick={() => setShowMarket((s) => !s)}
              aria-expanded={showMarket}
            >
              {showMarket ? 'عرض أقل' : 'عرض الكل'}
            </button>
          )}
        </div>

        {market.length > 0 ? (
          <div className="odash__list">
            {market.map((r) => (
              <div className="odash__req" key={r.id}>
                <div className="odash__req-ico"><Megaphone /></div>
                <div className="odash__req-body">
                  <h3>{r.title}</h3>
                  <div className="odash__req-meta">
                    <span><CalendarClock /> {r.schedule_label || 'مرة واحدة'}</span>
                    <span><Clock /> {r.preferred_time || 'وقت مرن'}</span>
                    <span><Users /> {fmtNumber(r.capacity)} شخص</span>
                    {r.area && <span><MapPin /> {r.area}</span>}
                  </div>
                  {r.budget > 0 && (
                    <span className="odash__req-budget"><CircleDollarSign /> حتى {fmtNumber(r.budget)} ش.ج</span>
                  )}
                  {r.amenities.length > 0 && (
                    <div className="odash__req-chips">
                      {r.amenities.slice(0, 4).map((a) => {
                        const Icon = AMENITY_ICONS[a];
                        return (
                          <span key={a}>
                            {Icon ? <Icon /> : null} {a}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="odash__req-side">
                  <span className="odash__req-time">{timeAgo(r.created_at)}</span>
                  <span className="odash__req-offers">{fmtNumber(r.offers_count)} عرض</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="odash__state">
            <div className="ost-svg"><Store /></div>
            <h3>لا توجد طلبات مفتوحة حالياً</h3>
            <p>عند نشر أحد الأعضاء طلباً خاصاً سيظهر هنا لتقدّم عرضك عليه.</p>
          </div>
        )}
      </section>

      <section className="odash__section">
        <div className="odash__section-head">
          <h2><Building2 /> مساحاتي النشطة</h2>
          {spaces.length > 3 && (
            <button
              type="button"
              className="odash__show-all"
              onClick={() => setShowSpaces((s) => !s)}
              aria-expanded={showSpaces}
            >
              {showSpaces ? 'عرض أقل' : 'عرض الكل'}
            </button>
          )}
        </div>

        {visibleSpaces.length > 0 ? (
          <div className="odash__list">
            {visibleSpaces.map((s) => (
              <div className="odash__space" key={s.id}>
                <img src={s.image || ''} alt={s.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <div className="odash__space-body">
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                  <div className="odash__space-meta">
                    {s.location && <span><MapPin /> {s.location}</span>}
                    {s.capacity > 0 && <span><Users /> {fmtNumber(s.capacity)} شخص</span>}
                    {s.rating > 0 && <span className="odash__space-rating"><Star /> {s.rating}</span>}
                  </div>
                </div>
                <div className="odash__space-side">
                  <b>{fmtNumber(s.price_per_hour)}</b>
                  <small>ش.ج / ساعة</small>
                  <span className="odash__space-active"><BadgeCheck /> نشطة</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="odash__state">
            <div className="ost-svg"><Building2 /></div>
            <h3>لا مساحات نشطة</h3>
            <p>أضف مساحتك الأولى لتظهر في التصفح ويصلتها الحجوزات.</p>
          </div>
        )}
      </section>

      <section className="odash__actions">
        <div className="odash__action">
          <div className="oa-ico"><Store /></div>
          <div>
            <h3>استكشف السوق</h3>
            <p>طلبات مفتوحة تنتظر عروضك</p>
          </div>
        </div>
        <Link className="odash__action" to="/spaces">
          <div className="oa-ico"><MapPin /></div>
          <div>
            <h3>معاينة المساحات</h3>
            <p>كما يراها الزوار والطلاب</p>
          </div>
        </Link>
      </section>
    </>
  );
}