import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CountUp } from 'countup.js';
import { Lottie } from 'lottie-react';
import { useEffect, useRef } from 'react';
import AnimatedOrbs from '../common/AnimatedOrbs';
import MagneticButton from '../common/MagneticButton';
import buildingAnim from '../../assets/lottie/building.json';
import boltAnim from '../../assets/lottie/bolt.json';
import clockAnim from '../../assets/lottie/clock.json';
import starAnim from '../../assets/lottie/star.json';

const stats = [
  { value: 120, suffix: '+', label: 'مساحة موثّقة', anim: buildingAnim },
  { value: 24, suffix: '/7', label: 'فلتر الكهرباء', anim: boltAnim },
  { value: 5, suffix: ' min', label: 'لحجز مقعد', anim: clockAnim },
  { value: 4.8, suffix: '★', decimals: 1, label: 'تقييم الأعضاء', anim: starAnim },
];

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

      {/* إحصائيات تحت الهيرو — زجاجية مع حركات */}
      <div className="wrap">
        <motion.div
          className="stats"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: false, amount: 0.3 }}
        >
          {stats.map((stat) => (
            <motion.div className="stat" key={stat.label} variants={item}>
              <span className="stat__lottie" aria-hidden="true">
                <Lottie animationData={stat.anim} loop autoplay style={{ width: 44, height: 44 }} />
              </span>
              <StatNumber value={stat.value} suffix={stat.suffix} decimals={stat.decimals ?? 0} />
              <span>{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </>
  );
}