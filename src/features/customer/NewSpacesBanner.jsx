import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, ChevronLeft, ChevronRight, MapPin, Sparkles, Star } from 'lucide-react';

// بانر البطل «مساحات جديدة»: بطاقات أفقية بتمرير انزلاقي تُظهر المساحات
// المُضافة خلال آخر ٣ أيام (نافذة newSpaces.js)، وتختفي تلقائياً بعدها.
// البيانات تأتي من /api/spaces?page=1 عبر fetchDashboard — بلا بيانات مُختلقة:
// فهر فارغ يُخفي البانر كاملاً كما يفعل AdBanner.

function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export default function NewSpacesBanner({ spaces }) {
  const stripRef = useRef(null);
  const list = Array.isArray(spaces) ? spaces : [];

  if (list.length === 0) return null;

  // الاتجاه منطقي افتراضياً (RTL): المتجه الموجب يزاح نحو «التالي»،
  // فيقابله إزاحة سالبة على المسار عند RTL.
  const scrollStrip = (sign) => {
    const el = stripRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({
      left: (rtl ? -sign : sign) * el.clientWidth * 0.8,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  return (
    <motion.section
      className="dash__new"
      role="region"
      aria-label="مساحات جديدة أُضيفت مؤخراً"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="dash__new-head">
        <h2 className="dash__new-title">
          <Sparkles /> مساحات جديدة
        </h2>
        <p className="dash__new-sub">أُضيفت خلال آخر ٣ أيام — تُحدَّث تلقائياً</p>
        <div className="dash__new-nav">
          <button type="button" className="dash__new-navbtn" aria-label="السابق" onClick={() => scrollStrip(-1)}>
            <ChevronRight />
          </button>
          <button type="button" className="dash__new-navbtn" aria-label="التالي" onClick={() => scrollStrip(1)}>
            <ChevronLeft />
          </button>
        </div>
      </div>
      <div className="dash__new-strip" ref={stripRef}>
        {list.map((space) => (
          <SpaceCard key={space.id} space={space} />
        ))}
      </div>
    </motion.section>
  );
}

// بطاقة مساحة واحدة — الصورة الزخرفية بجانب نص مكافئ، وعند غياب الصورة
// أو فشل تحميلها يحلّ أيقونة مكانها بتدرّج متوافق مع هوية اللوحة.
function SpaceCard({ space }) {
  const [imgOk, setImgOk] = useState(true);
  const hasImage = Boolean(space.image) && imgOk;
  const place = space.area || space.location || '';

  return (
    <Link className="dash__new-card" to={`/spaces/${space.id}`}>
      <span className="dash__new-media">
        {hasImage ? (
          <img src={space.image} alt="" loading="lazy" onError={() => setImgOk(false)} />
        ) : (
          <span className="dash__new-fallback" aria-hidden="true">
            <Building2 />
          </span>
        )}
        <span className="dash__new-badge">
          <Sparkles /> جديد
        </span>
      </span>
      <span className="dash__new-body">
        <span className="dash__new-name" title={space.title}>
          {space.title || 'مساحة عمل'}
        </span>
        <span className="dash__new-meta">
          {place && (
            <span className="dash__new-place">
              <MapPin /> {place}
            </span>
          )}
          {space.rating > 0 && (
            <span className="dash__new-rating">
              <Star /> {space.rating}
            </span>
          )}
        </span>
        <span className="dash__new-price">
          {space.price_per_hour} <small>ش.ج / ساعة</small>
        </span>
      </span>
    </Link>
  );
}
