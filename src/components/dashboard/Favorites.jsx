import { Heart, Star, Zap, Wifi, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Favorites({ data, onToggleFavorite }) {
  const favorites = data.favorites || [];
  const togglingId = data.togglingId || null;

  const handleToggle = async (e, id, name) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleFavorite) await onToggleFavorite(id, name);
  };

  return (
    <section className="dash__section">
      <div className="dash__section-head">
        <h2><Heart /> المساحات المفضّلة</h2>
      </div>

      {favorites.length === 0 ? (
        <div className="dash__state">
          <div className="st-svg"><Heart /></div>
          <h3>لا مفضّلات بعد</h3>
          <p>أضف المساحات التي تعجبك إلى المفضّلة لتعود إليها بسرعة لاحقاً.</p>
          <Link to="/spaces">تصفح المساحات</Link>
        </div>
      ) : (
        <div className="dash__favs">
          {favorites.map((f) => (
            <div className="dash__fav" key={f.id}>
              <Link className="dash__fav-main" to="/spaces">
                <div className="fv-img">
                  <img src={f.image} alt={f.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  <span className="fv-rating"><Star /> {f.rating}</span>
                </div>
                <div className="fv-body">
                  <h3>{f.name}</h3>
                  <div className="fv-tags">
                    <span><Zap /> كهرباء {f.power == null ? '—' : (f.power ? 'متوفرة' : 'غير متوفرة')}</span>
                    <span><Wifi /> {f.internet == null ? '—' : (f.internet ? 'إنترنت متاح' : 'لا إنترنت')}</span>
                  </div>
                </div>
              </Link>
              <div className="fv-foot">
                <span className="fv-price">{f.pricePerHour} <small>ش.ج / ساعة</small></span>
                <button
                  type="button"
                  className="dash__fav-toggle"
                  onClick={(e) => handleToggle(e, f.id, f.name)}
                  disabled={togglingId === f.id}
                  aria-label={`إزالة ${f.name || 'المساحة'} من المفضّلة`}
                  title="إزالة من المفضّلة"
                >
                  {togglingId === f.id ? (
                    <Loader2 className="spin" style={{ width: '1.1rem', height: '1.1rem' }} />
                  ) : (
                    <Heart style={{ width: '1.1rem', height: '1.1rem', color: 'var(--accent)' }} fill="currentColor" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}