import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AnimatedOrbs from '@/components/ui/AnimatedOrbs';
import DashCountUp from './DashCountUp';
import { useTranslation } from '@/hooks/useT';
import { CalendarCheck, Clock, Heart, Star, MapPin, BookOpen, LogIn, Timer, X } from 'lucide-react';

function initialsOf(name) {
  return (name || 'م').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || 'م';
}

export default function Overview({ data }) {
  const { t } = useTranslation('customer');
  const user = data.user || {};
  const stats = data.stats || {};
  // المساحات المُضافة خلال آخر ٣ أيام — تغذية بطاقة البطل بجوار الاسم.
  // المصدر fetchDashboard (newSpaces) — لا بيانات مُختلقة بعد اليوم.
  const newSpaces = Array.isArray(data.newSpaces) ? data.newSpaces : [];
  const [showAll, setShowAll] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [activeAd, setActiveAd] = useState(0);
  const [photoFailed, setPhotoFailed] = useState('');
  const statCards = [
    { icon: CalendarCheck, value: stats.upcomingBookings, label: t('overview.stats.upcoming') },
    { icon: Clock, value: stats.hoursThisMonth, label: t('overview.stats.hoursMonth') },
    { icon: Heart, value: stats.savedFavorites, label: t('overview.stats.favorites') },
    { icon: Timer, value: stats.hoursSpentThisMonth, label: t('overview.stats.hoursTotal') },
  ];

  const actions = [
    { to: '/spaces', icon: BookOpen, title: t('overview.actions.browseTitle'), desc: t('overview.actions.browseDesc') },
  ];

  const submitRating = () => {
    setRated(true);
  };

  const closeRating = () => {
    setRateOpen(false);
    setTimeout(() => {
      setRated(false);
      setRating(0);
    }, 250);
  };

  const allUpcoming = (data.upcoming || []).filter((b) => b.status !== 'cancelled');
  const upcoming = showAll ? allUpcoming : allUpcoming.slice(0, 2);

  useEffect(() => {
    if (newSpaces.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setActiveAd((i) => (i + 1) % newSpaces.length), 4000);
    return () => clearInterval(id);
  }, [newSpaces.length]);

  // فهرس آمن حتى لو تغيّرت القائمة بين دورتين (عداد قد يسبق الطول).
  const adIndex = newSpaces.length > 0 ? activeAd % newSpaces.length : 0;

  return (
    <>
      <section className="dash__hero">
        <AnimatedOrbs />
        <div className="dash__hero-copy">
          {user.photo && user.photo !== photoFailed ? (
            <img
              className="dash__hero-avatar"
              src={user.photo}
              alt={user.name || ''}
              onError={() => setPhotoFailed(user.photo)}
            />
          ) : (
            user.name && <div className="dash__hero-avatar">{initialsOf(user.name)}</div>
          )}
          <h2>
            {user.name
              ? t('overview.welcome', { name: user.name })
              : t('overview.welcomeGuest')}
          </h2>
          <p>
            {user.role === 'owner'
              ? t('overview.heroDescOwner')
              : t('overview.heroDescCustomer')}
          </p>
          <span className="dash__role-chip">
            {user.role === 'owner' ? <MapPin /> : <Star />}
            {user.role === 'owner' ? t('overview.roleOwner') : t('overview.roleCustomer')}
          </span>
        </div>

        {newSpaces.length > 0 && (
          <div className="dash__hero-ads" aria-label={t('overview.hero.region')}>
            <div className="dash__hero-ads-track">
              {newSpaces.map((space, i) => (
                <Link
                  key={space.id}
                  to={`/spaces/${space.id}`}
                  className={`dash__hero-ad-card${i === adIndex ? ' is-active' : ''}`}
                >
                  <div className="dash__hero-ad-badge">{t('overview.hero.newBadge')}</div>
                  <h3>{space.title || t('overview.hero.fallbackTitle')}</h3>
                  <p>{space.area || space.location || t('overview.hero.fallbackPlace')}</p>
                  <span className="dash__hero-ad-price">
                    {t('overview.hero.perHour', { price: space.price_per_hour })}
                  </span>
                </Link>
              ))}
            </div>
            <div className="dash__hero-ads-dots">
              {newSpaces.map((space, i) => (
                <button
                  key={space.id}
                  type="button"
                  className={`dash__hero-ads-dot${i === adIndex ? ' is-active' : ''}`}
                  onClick={() => setActiveAd(i)}
                  aria-label={t('overview.hero.adLabel', { n: i + 1 })}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="dash__stats" data-tour="customer-metrics">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div className="dash__stat" key={c.label}>
              <div className="st-ico"><Icon /></div>
              <DashCountUp value={c.value} />
              <span>{c.label}</span>
            </div>
          );
        })}
      </section>

      <section className="dash__actions" data-tour="customer-quick-action">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link className="dash__action" to={a.to} key={a.title}>
              <div className="a-ico"><Icon /></div>
              <div>
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
              </div>
            </Link>
          );
        })}

        <button type="button" className="dash__action dash__action--rate" onClick={() => setRateOpen(true)}>
          <div className="a-ico"><Star /></div>
          <div>
            <h3>{t('overview.actions.rateTitle')}</h3>
            <p>{t('overview.actions.rateDesc')}</p>
          </div>
        </button>
      </section>

      <section className="dash__section">
        <div className="dash__section-head">
          <h2><CalendarCheck /> {t('overview.bookings.title')}</h2>
          <button
            type="button"
            className="dash__show-all"
            onClick={() => setShowAll((s) => !s)}
            aria-expanded={showAll}
          >
            {showAll ? t('overview.bookings.showLess') : t('overview.bookings.showAll')}
          </button>
        </div>

        {upcoming.length > 0 ? (
          <div className="dash__list">
            {upcoming.map((b, i) => (
              <div className="dash__booking" key={b.id ?? `${b.spaceName || ''}-${b.date || ''}-${i}`}>
                <img src={b.image || ''} alt={b.spaceName || ''} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                <div className="bk-body">
                  <h3>{b.spaceName}</h3>
                  <div className="bk-meta">
                    <span><CalendarCheck /> {b.date}</span>
                    <span><Clock /> {b.time}</span>
                  </div>
                </div>
                <div className="bk-price">{b.price || 0} {t('overview.bookings.currency')}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash__state">
            <div className="st-svg"><LogIn /></div>
            <h3>{t('overview.bookings.emptyTitle')}</h3>
            <p>{t('overview.bookings.emptyDesc')}</p>
            <Link to="/spaces">{t('overview.bookings.bookNow')}</Link>
          </div>
        )}
      </section>

      {rateOpen && (
        <div className="modal-overlay dash-rate__overlay" onClick={closeRating}>
          <div className="modal-box dash-rate" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('overview.rate.aria')}>
            <button type="button" className="dash-rate__close" onClick={closeRating} aria-label={t('overview.rate.close')}>
              <X />
            </button>

            {!rated ? (
              <>
                <span className="dash-rate__ico"><Star /></span>
                <h3>{t('overview.rate.title')}</h3>
                <p>{t('overview.rate.desc')}</p>

                <div className="dash-rate__stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={n <= rating ? 'on' : ''}
                      onClick={() => setRating(n)}
                      aria-label={t('overview.rate.starN', { n })}
                    >
                      <Star />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={submitRating}
                  disabled={rating === 0}
                >
                  {t('overview.rate.submit')}
                </button>
              </>
            ) : (
              <>
                <span className="dash-rate__ico ok"><Star /></span>
                <h3>{t('overview.rate.thanks')}</h3>
                <p>{t('overview.rate.thanksDesc', { rating })}</p>
                <button type="button" className="btn-primary" onClick={closeRating}>
                  {t('overview.rate.ok')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
