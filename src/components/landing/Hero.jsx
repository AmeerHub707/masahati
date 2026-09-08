import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CountUp } from 'countup.js';
import { useEffect, useRef } from 'react';
import AnimatedOrbs from '../common/AnimatedOrbs';
import MagneticButton from '../common/MagneticButton';

const stats = [
  { value: 120, suffix: '+', label: 'مساحة موثّقة', icon: 'building' },
  { value: 24, suffix: '/7', label: 'فلتر الكهرباء', icon: 'bolt' },
  { value: 5, suffix: ' min', label: 'لحجز مقعد', icon: 'clock' },
  { value: 4.8, suffix: '★', decimals: 1, label: 'تقييم الأعضاء', icon: 'star' },
];

function StatIcon({ name }) {
  if (name === 'building') {
    return (
      <svg className="stat-icon icon-building" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4.4" y="3.4" width="15.2" height="17.2" rx="2" stroke="#fff" strokeWidth="2.1" />
        <rect x="9" y="8" width="6" height="8.4" rx="1.3" fill="#fff" className="icon-building__win" />
        <rect x="9" y="18.2" width="6" height="2.4" rx="1.2" fill="#fff" />
      </svg>
    );
  }
  if (name === 'bolt') {
    return (
      <svg className="stat-icon icon-bolt" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" fill="#fff" />
      </svg>
    );
  }
  if (name === 'clock') {
    return (
      <svg className="stat-icon icon-clock" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2" stroke="#fff" strokeWidth="2.1" />
        <circle cx="12" cy="12" r="1.1" fill="#fff" />
        <g className="icon-clock__hand">
          <rect x="11.35" y="5.2" width="1.3" height="8.6" rx="0.65" fill="#fff" />
        </g>
      </svg>
    );
  }
  if (name === 'star') {
    return (
      <svg className="stat-icon icon-star" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2.4l2.7 5.9 6.5.9-4.7 4.6 1.1 6.4-5.6-3-5.6 3 1.1-6.4L2.8 9.2l6.5-.9L12 2.4z" fill="#fff" />
      </svg>
    );
  }
  return null;
}

function StatNumber({ value, suffix, decimals = 0 }) {
  const elRef = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = value.toFixed(decimals);
      return undefined;
    }
    const counter = new CountUp(el, value, {
      duration: 1.6,
      decimalPlaces: decimals,
      useEasing: true,
      separator: '',
    });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          counter.start();
        }
      }),
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, suffix, decimals]);

  return (
    <b>
      <span ref={elRef}>0</span>
      <span className="stat__suffix">{suffix}</span>
    </b>
  );
}

function StatCard({ stat }) {
  const ref = useRef(null);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <motion.div
      className="stat"
      ref={ref}
      variants={item}
      onMouseMove={handleMove}
      onMouseLeave={() => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty('--mx', '50%');
        el.style.setProperty('--my', '50%');
      }}
    >
      <span className="stat__lottie" aria-hidden="true">
        <StatIcon name={stat.icon} />
      </span>
      <StatNumber value={stat.value} suffix={stat.suffix} decimals={stat.decimals ?? 0} />
      <span>{stat.label}</span>
    </motion.div>
  );
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.14, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 42, scale: 0.92 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 120, damping: 15 },
  },
};

export default function Hero() {
  return (
    <>
      <header className="hero">
        {/* خلفية الفيديو المتحرك */}
        <div className="hero__bg" aria-hidden="true">
          <video
            className="gallery__video"
            src="/video/FinalResult.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
          />
          <AnimatedOrbs />
          <span className="hero__scrim"></span>
        </div>

        <div className="wrap hero__inner">
          <div className="hero__copy">
            <h1>اعثر على <span className="hl">مساحتك — بكهرباء ونت ومقعد، بنقرة واحدة.</span></h1>
            <p className="lead">تجمع مساحاتي كل مساحات العمل المشتركة وقاعات الدراسة في مكان واحد. قارن الأسعار وسرعة الإنترنت وتوفّر الكهرباء، ثم احجز مقعدك مباشرةً — دون اتصال ولا رسالة.</p>
            <div className="hero__cta">
              <MagneticButton>
                <Link className="btn-primary" to="/signup">ابدأ الآن</Link>
              </MagneticButton>
            </div>
          </div>
        </div>
      </header>

      {/* شريط المؤشرات — تحت الهيرو */}
      <div className="wrap">
        <motion.div
          className="stats"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, amount: 0.3 }}
        >
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </motion.div>
      </div>
    </>
  );
}