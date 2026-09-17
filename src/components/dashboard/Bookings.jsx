import { CalendarCheck, Clock, Zap, Wifi, X, Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_META = {
  confirmed: { label: 'مؤكد', cls: 'badge--confirmed', Icon: Check },
  pending: { label: 'قيد التأكيد', cls: 'badge--pending', Icon: Clock },
  cancelled: { label: 'ملغى', cls: 'badge--cancelled', Icon: X },
};

export default function Bookings({ data, onCancel, cancellingId }) {
  const bookings = data.bookings || [];

  return (
    <section className="dash__section">
      <div className="dash__section-head">
        <h2><CalendarCheck /> كل الحجوزات</h2>
      </div>

      {bookings.length === 0 ? (
        <div className="dash__state">
          <div className="st-svg"><CalendarCheck /></div>
          <h3>لا توجد حجوزات بعد</h3>
          <p>ابدأ بتصفح المساحات المتاحة واحجز مقعدك الأول خلال دقائق.</p>
          <Link to="/spaces">تصفح المساحات</Link>
        </div>
      ) : (
        <div className="dash__list">
          {bookings.map((b, i) => {
            const meta = STATUS_META[b.status] || STATUS_META.pending;
            const Icon = meta.Icon;
            return (
              <div className="dash__booking" key={b.id ?? `${b.spaceName || ''}-${b.date || ''}-${i}`}>
                <img src={b.image || ''} alt={b.spaceName || ''} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                <div className="bk-body">
                  <h3>{b.spaceName || ''}</h3>
                  <div className="bk-meta">
                    <span><CalendarCheck /> {b.date || ''}</span>
                    <span><Clock /> {b.time || ''}</span>
                    <span><Clock /> {b.hours || 0} ساعات</span>
                    <span><Wifi /> إنترنت</span>
                    <span><Zap /> كهرباء</span>
                  </div>
                </div>
                <div className="bk-actions">
                  <span className={`badge ${meta.cls}`}>
                    <Icon /> {meta.label}
                  </span>
                  <div className="bk-price">{b.price || 0} ش.ج</div>
                  {b.status === 'confirmed' && (
                    <button
                      type="button"
                      className="dash__cancel"
                      onClick={() => onCancel(b.id)}
                      disabled={cancellingId === b.id}
                    >
                      <X />
                      {cancellingId === b.id ? '…' : 'إلغاء الحجز'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="dash__state" style={{ marginTop: '1rem', padding: '1.2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', justifyContent: 'center' }}>
          <Plus /> هل تريد حجز مساحة جديدة؟
        </h3>
        <Link to="/spaces">احجز الآن</Link>
      </div>
    </section>
  );
}
