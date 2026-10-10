import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MapPin, Users, ArrowLeft, Loader2, Building2 } from 'lucide-react';
import { loadSpacesWithFallback } from '@/lib/spaces';

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 120, damping: 14 },
  },
};

const numFmt = new Intl.NumberFormat('ar-EG');

function TopSpaceCard({ space, rank }) {
  return (
    <motion.div variants={item}>
      <Link to={`/ads/${space.id}`} className="top-spaces__card">
        <div className="top-spaces__rank">{rank}</div>
        <div className="top-spaces__media">
          {space.image ? (
            <img src={space.image} alt={space.title} loading="lazy" />
          ) : (
            <div className="top-spaces__media-fallback">
              <Building2 size={32} />
            </div>
          )}
          <div className="top-spaces__rating">
            <Star size={14} />
            <span>{space.rating}</span>
          </div>
        </div>
        <div className="top-spaces__body">
          <h3>{space.title}</h3>
          {space.location && (
            <p className="top-spaces__loc">
              <MapPin size={14} />
              {space.location}
            </p>
          )}
          <div className="top-spaces__meta">
            {space.capacity > 0 && (
              <span>
                <Users size={13} />
                {numFmt.format(space.capacity)}
              </span>
            )}
            <span className="top-spaces__price">
              {numFmt.format(space.price_per_hour)} ش.ج/ساعة
            </span>
          </div>
        </div>
        <div className="top-spaces__arrow">
          <ArrowLeft size={18} />
        </div>
      </Link>
    </motion.div>
  );
}

export default function TopSpaces() {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    loadSpacesWithFallback({ sort: 'rating' }, 1)
      .then((result) => {
        if (!alive) return;
        const sorted = [...result.spaces]
          .filter((s) => s.rating > 0)
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 3);
        setSpaces(sorted);
        setError(result.error ?? '');
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  return (
    <section className="top-spaces">
      <div className="wrap">
        <div className="top-spaces__head">
          <div>
            <span className="top-spaces__eyebrow">الأعلى تقييماً</span>
            <h2>أفضل 3 مساحات هذا الشهر</h2>
            <p>مساحات حصلت على أعلى تقييمات من المستخدمين — جودة مضمونة وتجربة مثالية.</p>
          </div>
          <Link to="/spaces" className="top-spaces__all">
            عرض الكل
            <ArrowLeft size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="top-spaces__loading">
            <Loader2 className="spin" size={32} />
          </div>
        ) : spaces.length === 0 ? (
          <div className="top-spaces__empty">
            <p>{error || 'لا توجد مساحات متاحة حالياً.'}</p>
          </div>
        ) : (
          <motion.div
            className="top-spaces__grid"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            {spaces.map((space, i) => (
              <TopSpaceCard key={space.id} space={space} rank={i + 1} />
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
