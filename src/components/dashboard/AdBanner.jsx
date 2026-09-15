import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';

export default function AdBanner({ ads, dismissed }) {
  const visible = ads.filter((a) => !dismissed.includes(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="dash__news" role="region" aria-label="إعلانات المساحات">
      <Marquee ads={visible} />
    </div>
  );
}

// حلقة أخبار قابلة للقياس وقت التشغيل: تضمن اتصالاً بلا فراغ بين نهاية
// المحتوى وبداية التكرار، تعمل في اتجاهي RTL و LTR على حد سواء.
function Marquee({ ads }) {
  const trackRef = useRef(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    let start = null;
    const speed = 30; // بكسل في الثانية

    const step = (ts) => {
      if (start === null) start = ts;
      // المسافة المطلوبة للقفز هي عرض مجموعة واحدة = نصف عرض المسار المكرّر.
      const half = Math.max(track.scrollWidth / 2, 1);
      const elapsed = ((ts - start) / 1000) * speed;
      const offset = elapsed % half;
      track.style.transform = `translateX(${-offset}px)`;
      raf = requestAnimationFrame(step);
    };

    const onResize = () => {
      // يُعيد تثبيت بداية المؤقّت بعد تغيّر العرض حتى لا يحدث قفزة في منتصف الدورة.
      start = null;
    };

    raf = requestAnimationFrame(step);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="dash__news-track" ref={trackRef}>
      {ads.map((ad) => (
        <AdPill ad={ad} key={ad.id} />
      ))}
      {ads.map((ad) => (
        <AdPill ad={ad} key={`${ad.id}-dup`} />
      ))}
    </div>
  );
}

// إعلان صغير داخل شريط الأخبار: يرتفع ثم يهبط أثناء السير.
function AdPill({ ad }) {
  return (
    <Link className="dash__news-item" to="/spaces">
      <span className="dash__news-tag"><Tag /> {ad.tag}</span>
      <span className="dash__news-title">{ad.title}</span>
      <span className="dash__news-space">— {ad.spaceName}</span>
    </Link>
  );
}
