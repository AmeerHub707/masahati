import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const stats = [
  { value: '120+', label: 'مساحة موثّقة' },
  { value: '24/7', label: 'فلتر الكهرباء' },
  { value: '5 min', label: 'لحجز مقعد' },
  { value: '4.8★', label: 'تقييم الأعضاء' },
];

// يحسب الرقم الأول في النص ويعيد باقي النص كـ لاحقة (مثل "120+", "5 min", "4.8★")
function parseStat(raw) {
  const m = String(raw).match(/^([\d.]+)(.*)$/);
  if (!m) return { num: null, suffix: String(raw) };
  return { num: parseFloat(m[1]), suffix: m[2] };
}

function CountUp({ value, duration = 1400 }) {
  const { num, suffix } = parseStat(value);
  const [display, setDisplay] = useState(() =>
    (num == null || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches))
      ? value
      : '0' + suffix
  );
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || num == null) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const cur = num % 1 === 0 ? Math.round(num * eased) : (num * eased).toFixed(1);
        setDisplay(cur + suffix);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) run(); });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [num, suffix, value, duration]);

  if (num == null) return <b>{value}</b>;
  return <b ref={ref}>{display}</b>;
}

export default function Hero() {
  return (
    <>
      <header className="hero">
        <span className="blob blob--orange" style={{ top: '-6rem', right: '-5rem' }}></span>
        <span className="blob blob--soft" style={{ bottom: '-3rem', left: '8rem' }}></span>

        <div className="wrap hero__inner">
          <div className="hero__copy">
            <span className="live-chip"><span className="live-dot"></span>متصل الآن في غزة — جاهز للحجز</span>
            <span className="eyebrow"><span className="dot"></span>أول منصة لمساحات العمل المشتركة في غزة</span>
            <h1>اعثر على <span className="hl">مساحتك — بكهرباء ونت ومقعد، بنقرة واحدة.</span></h1>
            <p className="lead">تجمع مساحاتي كل مساحات العمل المشتركة وقاعات الدراسة في مكان واحد. قارن الأسعار وسرعة الإنترنت وتوفّر الكهرباء، ثم احجز مقعدك مباشرةً — دون اتصال ولا رسالة.</p>
            <div className="hero__cta">
              <Link className="btn-primary" to="/signup">ابدأ الآن</Link>
            </div>
          </div>

          <div className="hero__aside">
            <div className="hero__photo">
              <img src="/Loginside.jpg" alt="مساحة عمل مشتركة مضيئة في غزة" />
              <span className="photo-sheen"></span>
            </div>
          </div>
        </div>
      </header>

      <div className="wrap">
        <div className="stats">
          {stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <CountUp value={stat.value} />
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
