import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AnimatedOrbs from '../common/AnimatedOrbs';
import DashCountUp from './DashCountUp';
import { CalendarCheck, Clock, Heart, Star, MapPin, BookOpen, LogIn, Timer, X } from 'lucide-react';

const dashAds = [
  { id: 1, title: 'مساحة عمل فاخرة', desc: 'بيئة احترافية مع جميع المرافق', badge: 'جديد', price: '25 ر.س/ساعة' },
  { id: 2, title: 'قاعة اجتماعات', desc: 'مجهزة بالكامل لاجتماعات العمل', badge: 'متوفر', price: '50 ر.س/ساعة' },
  { id: 5, title: 'استوديو تصوير', desc: 'مجهز للتصوير الفوتوغرافي والفيديو', badge: 'جديد', price: '60 ر.س/ساعة' },
];

export default function Overview({ data }) {
  const user = data.user || {};
  const stats = data.stats || {};
  const [showAll, setShowAll] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [activeAd, setActiveAd] = useState(0);
  const statCards = [
    { icon: CalendarCheck, value: stats.upcomingBookings, label: 'حجوزات قادمة' },
    { icon: Clock, value: stats.hoursThisMonth, label: 'ساعة محجوزة هذا الشهر' },
    { icon: Heart, value: stats.savedFavorites, label: 'مساحات محفوظة' },
    { icon: Timer, value: stats.hoursSpentThisMonth, label: "ساعة في المساحات هذا الشهر" },
  ];

  const actions = [
    { to: '/spaces', icon: BookOpen, title: 'تصفح المساحات', desc: 'قارن الأسعار والإنترنت والكهرباء' },
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

  const allUpcoming = (data.bookings || []).filter((b) => b.status !== 'cancelled');
  const upcoming = showAll ? allUpcoming : allUpcoming.slice(0, 2);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setActiveAd((i) => (i + 1) % dashAds.length), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <section className="dash__hero">
        <AnimatedOrbs />
        <div className="dash__hero-copy">
          <h2>أهلاً <span className="dash__hero-name">{user.name || 'بك'}</span> بعودتك</h2>
          <p>
            {user.role === 'owner'
              ? 'تتبّع حجوزات مساحتك وأدر توفّرها من هنا.'
              : 'من هنا تدير حجوزاتك ومفضّلاتك — احجز المقعد المناسب بسرعة وثقة.'}
          </p>
          <span className="dash__role-chip">
            {user.role === 'owner' ? <MapPin /> : <Star />}
            {user.role === 'owner' ? 'صاحب مساحة' : 'عضو موثّق'}
          </span>
        </div>

        <div className="dash__hero-ads">
          <div className="dash__hero-ads-track">
            {dashAds.map((ad, i) => (
              <Link
                key={ad.id}
                to={`/ads/${ad.id}`}
                className={`dash__hero-ad-card${i === activeAd ? ' is-active' : ''}`}
              >
                <div className="dash__hero-ad-badge">{ad.badge}</div>
                <h3>{ad.title}</h3>
                <p>{ad.desc}</p>
                <span className="dash__hero-ad-price">{ad.price}</span>
              </Link>
            ))}
          </div>
          <div className="dash__hero-ads-dots">
            {dashAds.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`dash__hero-ads-dot${i === activeAd ? ' is-active' : ''}`}
                onClick={() => setActiveAd(i)}
                aria-label={`إعلان ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="dash__stats">
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

      <section className="dash__actions">
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
            <h3>قيّم تجربتك الأخيرة</h3>
            <p>أخبرنا عن جودة المساحة والخدمات</p>
          </div>
        </button>
      </section>

      <section className="dash__section">
        <div className="dash__section-head">
          <h2><CalendarCheck /> حجوزاتك القادمة</h2>
          <button
            type="button"
            className="dash__show-all"
            onClick={() => setShowAll((s) => !s)}
            aria-expanded={showAll}
          >
            {showAll ? 'عرض أقل' : 'عرض الكل'}
          </button>
        </div>

        {upcoming.length > 0 ? (
          <div className="dash__list">
            {upcoming.map((b) => (
              <div className="dash__booking" key={b.id}>
                <img src={b.image || ''} alt={b.spaceName || ''} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                <div className="bk-body">
                  <h3>{b.spaceName}</h3>
                  <div className="bk-meta">
                    <span><CalendarCheck /> {b.date}</span>
                    <span><Clock /> {b.time}</span>
                  </div>
                </div>
                <div className="bk-price">{b.price || 0} ش.ج</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash__state">
            <div className="st-svg"><LogIn /></div>
            <h3>لا حجوزات قادمة</h3>
            <p>احجز مقعدك الأول وابدأ العمل بتركيز.</p>
            <Link to="/spaces">احجز الآن</Link>
          </div>
        )}
      </section>

      {rateOpen && (
        <div className="modal-overlay dash-rate__overlay" onClick={closeRating}>
          <div className="modal-box dash-rate" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="تقديم تقييم">
            <button type="button" className="dash-rate__close" onClick={closeRating} aria-label="إغلاق">
              <X />
            </button>

            {!rated ? (
              <>
                <span className="dash-rate__ico"><Star /></span>
                <h3>قيّم تجربتك الأخيرة</h3>
                <p>ما رأيك في المساحة والخدمة التي حجزتها؟</p>

                <div className="dash-rate__stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={n <= rating ? 'on' : ''}
                      onClick={() => setRating(n)}
                      aria-label={`${n} من 5`}
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
                  إرسال التقييم
                </button>
              </>
            ) : (
              <>
                <span className="dash-rate__ico ok"><Star /></span>
                <h3>شكراً لتقييمك!</h3>
                <p>سجّلنا تقييمك بـ {rating} من 5 نجوم.</p>
                <button type="button" className="btn-primary" onClick={closeRating}>
                  حسناً
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
