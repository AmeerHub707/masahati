import { Heart, Star, Zap, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Favorites({ data }) {
  const favorites = data.favorites || [];

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
            <Link className="dash__fav" to="/spaces" key={f.id}>
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
              <div className="fv-foot">
                <span className="fv-price">{f.pricePerHour} <small>ش.ج / ساعة</small></span>
                <Heart style={{ width: '1.1rem', height: '1.1rem', color: 'var(--accent)' }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
