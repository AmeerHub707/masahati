import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  MapPin, Star, Users, Clock, Wifi, Zap, Check, Phone,
  Loader2, BadgeCheck, CircleDollarSign, TrendingUp,
  Lock, Info, CalendarPlus, CalendarX2, Building2, Send,
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import { loadSpaceDetailWithFallback, createBooking } from '../lib/spaces';
import { AMENITY_LABELS } from '../lib/requests';
import { fmtNumber, fmtRating, fmtMoney } from '../lib/format';
import {
  getCurrentRole, ownsSpace,
  ROLE_VISITOR, ROLE_SPACE_OWNER,
} from '../lib/authStore';

export default function AdDetailsPage() {
  const { id } = useParams();
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    loadSpaceDetailWithFallback(id)
      .then((result) => {
        if (!alive) return;
        setSpace(result.space);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="ad-details__loading">
        <Loader2 className="spin" size={48} />
        <p>جارٍ تحميل تفاصيل المساحة...</p>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="placeholder-page">
        <div className="wrap">
          <h1>المساحة غير موجودة</h1>
          <p>المساحة التي تبحث عنها غير متاحة حالياً.</p>
          <BackButton className="ad-details__back" fallback="/spaces" label="العودة للتصفح" />
          <Link className="btn-primary" to="/spaces">تصفح المساحات</Link>
        </div>
      </div>
    );
  }

  const isAvailable = space.is_active !== false && space.status === 'active';
  const role = getCurrentRole();
  const isOwner = ownsSpace(space);
  const amenities = space.amenities || [];

  return (
    <div className="ad-details">
      <div className="wrap">
        <BackButton className="ad-details__back" fallback="/spaces" label="العودة للتصفح" />

        <div className="ad-details__hero">
          <div className="ad-details__gallery">
            {space.image ? (
              <img src={space.image} alt={space.title} className="ad-details__img is-active" loading="eager" />
            ) : (
              <div className="ad-details__gallery-fallback">
                <Building2 size={64} aria-hidden="true" />
                <span>{space.title}</span>
              </div>
            )}
            <div className="ad-details__scrim" />
          </div>

          <div className="ad-details__info">
            <div className="ad-details__badges">
              <span className={`ad-details__status${isAvailable ? ' is-active' : ''}`}>
                <BadgeCheck /> {isAvailable ? 'متاحة للحجز' : 'غير متاحة'}
              </span>
              {space.instant_booking && (
                <span className="ad-details__instant"><Zap size={14} /> حجز فوري</span>
              )}
            </div>

            <h1>{space.title}</h1>

            {space.location && (
              <p className="ad-details__location">
                <MapPin size={18} /> {space.location}
                {space.area && ` — ${space.area}`}
              </p>
            )}

            {space.rating > 0 && (
              <div className="ad-details__rating">
                <Star size={18} />
                <span>{fmtRating(space.rating)}</span>
                {space.review_count > 0 && (
                  <small>({fmtNumber(space.review_count)} تقييم)</small>
                )}
              </div>
            )}

            <p className="ad-details__price">
              {fmtNumber(space.price_per_hour)} <small>ش.ج / ساعة</small>
            </p>

            {space.description && <p className="ad-details__desc">{space.description}</p>}

            <div className="ad-details__features">
              <h3>المرافق</h3>
              <div className="ad-details__amenities">
                {space.internet && (
                  <span className="ad-details__amenity"><Wifi size={16} /> إنترنت</span>
                )}
                {space.power && (
                  <span className="ad-details__amenity"><Zap size={16} /> كهرباء</span>
                )}
                {amenities.map((a) => AMENITY_LABELS[a] && (
                  <span key={a} className="ad-details__amenity">
                    <Check size={16} /> {AMENITY_LABELS[a]}
                  </span>
                ))}
              </div>
            </div>

            <div className="ad-details__meta">
              {space.capacity > 0 && (
                <div className="ad-details__meta-item">
                  <Users size={20} />
                  <div>
                    <b>{fmtNumber(space.capacity)}</b>
                    <small>سعة الأشخاص</small>
                  </div>
                </div>
              )}
              {space.open_time && space.close_time && (
                <div className="ad-details__meta-item">
                  <Clock size={20} />
                  <div>
                    <b>{space.open_time} – {space.close_time}</b>
                    <small>أوقات العمل</small>
                  </div>
                </div>
              )}
              {space.contact_phone && (
                <div className="ad-details__meta-item">
                  <Phone size={20} />
                  <div>
                    <b dir="ltr">{space.contact_phone}</b>
                    <small>رقم التواصل</small>
                  </div>
                </div>
              )}
            </div>

            {space.stats && isOwner && (
              <div className="ad-details__stats">
                <div className="ad-details__stat">
                  <CalendarX2 size={18} />
                  <b>{fmtNumber(space.stats.bookings)}</b>
                  <small>حجز هذا الشهر</small>
                </div>
                <div className="ad-details__stat">
                  <CircleDollarSign size={18} />
                  <b>{fmtNumber(space.stats.revenue)}</b>
                  <small>إيراد الشهر (ش.ج)</small>
                </div>
                <div className="ad-details__stat">
                  <TrendingUp size={18} />
                  <b>{fmtNumber(space.stats.occupancy)}٪</b>
                  <small>معدل الإشغال</small>
                </div>
              </div>
            )}

            <BookingPanel space={space} role={role} isOwner={isOwner} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingPanel({ space, role, isOwner }) {
  const navigate = useNavigate();
  const isAvailable = space.is_active !== false && space.status === 'active';

  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [hours, setHours] = useState(1);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const pricePerHour = Number(space.price_per_hour) || 0;
  const total = pricePerHour * Math.max(1, Number(hours) || 1);

  // الزائر لا يحجز إطلاقاً
  if (role === ROLE_VISITOR) {
    return (
      <div className="ad-details__book-state">
        <Lock size={22} aria-hidden="true" />
        <b className="ad-details__book-state-title">سجّل الدخول للحجز</b>
        <p>حجز المساحات متاح للعملاء المسجّلين فقط.</p>
        <div className="ad-details__cta">
          <Link
            className="btn-primary ad-details__book-btn"
            to={`/login?redirect=${encodeURIComponent(`/ads/${space.id}`)}`}
          >
            تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  // صاحب المساحة: عرض فقط، لا يحجز مساحته
  if (role === ROLE_SPACE_OWNER || isOwner) {
    return (
      <div className="ad-details__book-state">
        <Info size={22} aria-hidden="true" />
        <b className="ad-details__book-state-title">هذه مساحتك</b>
        <p>يمكنك إدارة الحجوزات وبيانات المساحة من لوحة التحكم.</p>
        <div className="ad-details__cta">
          <Link className="btn-ghost" to="/dashboard/space-owner">لوحة التحكم</Link>
        </div>
      </div>
    );
  }

  // العميل: نموذج حجز مربوط بواجهة برمجية تتراجع بأمان (لا نقطة حجز فعلية بعد)
  if (!isAvailable) {
    return (
      <div className="ad-details__book-state is-off">
        <CalendarX2 size={22} aria-hidden="true" />
        <b className="ad-details__book-state-title">غير متاحة للحجز حالياً</b>
        <p>يمكنك تصفح مساحات أخرى متاحة الآن.</p>
        <div className="ad-details__cta">
          <Link className="btn-ghost" to="/spaces">تصفح المساحات</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setMessage('');
    const res = await createBooking({
      spaceId: space.id,
      date,
      startTime: start,
      hours,
    });
    setSending(false);
    if (res && res.ok) {
      setMessage('ok');
    } else if (res && res.reason === 'unauthenticated') {
      navigate(`/login?redirect=${encodeURIComponent(`/ads/${space.id}`)}`, { replace: true });
    } else {
      setMessage('unavailable');
    }
  };

  return (
    <div className="ad-details__booking">
      <div className="ad-details__booking-head">
        <CalendarPlus size={18} aria-hidden="true" />
        <b>احجز هذه المساحة</b>
      </div>

      {message === 'ok' ? (
        <p className="ad-details__booking-note is-ok">تمّ إرسال طلب الحجز إلى صاحب المساحة. ستجد الحجز في لوحة التحكم.</p>
      ) : message === 'unavailable' ? (
        <p className="ad-details__booking-note">
          <strong>خدمة الحجز الفوري غير متاحة بعد.</strong>
          <span>هذه الواجهة مرتبطة بنقطة حجز ستُفعَّل قريباً — تابع بحثك أو أنشئ طلباً خاصاً من لوحة التحكم.</span>
        </p>
      ) : (
        <form className="ad-details__booking-form" onSubmit={handleSubmit}>
          <label className="ad-details__booking-field">
            <span>التاريخ</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="ad-details__booking-field">
            <span>من الساعة</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </label>
          <label className="ad-details__booking-field">
            <span>عدد الساعات</span>
            <input
              type="number"
              min="1"
              max="12"
              step="1"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              required
            />
          </label>

          <div className="ad-details__booking-total">
            <span>الإجمالي (كل الساعات)</span>
            <b>{fmtMoney(total)} <small>ش.ج</small></b>
          </div>

          <button
            type="submit"
            className="btn-primary ad-details__book-btn"
            disabled={sending}
          >
            {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            {sending ? 'جارٍ إرسال الطلب...' : 'تأكيد الحجز'}
          </button>
        </form>
      )}
    </div>
  );
}