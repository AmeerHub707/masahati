import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export const LOADING_SEEN_KEY = 'masahati_loading_seen';
const TOTAL_DURATION_MS = 2300;
const EXIT_DURATION_MS = 420;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export default function LoadingScreen({ onDone }) {
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const finish = useCallback(() => {
    if (!doneRef.current) {
      doneRef.current = true;
      onDoneRef.current();
    }
  }, []);

  const [skip] = useState(() => {
    try {
      return sessionStorage.getItem(LOADING_SEEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  const reduced = prefersReducedMotion();
  const [progress, setProgress] = useState(reduced ? 100 : 0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (skip) return undefined;
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [skip]);

  useEffect(() => {
    if (skip) {
      finish();
      return undefined;
    }
    try {
      sessionStorage.setItem(LOADING_SEEN_KEY, '1');
    } catch (err) {
      console.debug('sessionStorage غير متاح:', err);
    }
    if (reduced) {
      const id = setTimeout(() => setLeaving(true), 900);
      return () => clearTimeout(id);
    }
    let raf;
    let exitTimer;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / TOTAL_DURATION_MS, 1);
      setProgress(Math.round(easeInOutCubic(t) * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        exitTimer = setTimeout(() => setLeaving(true), 70);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [skip, reduced, finish]);

  useEffect(() => {
    if (!leaving) return undefined;
    const id = setTimeout(finish, EXIT_DURATION_MS);
    return () => clearTimeout(id);
  }, [leaving, finish]);

  const handleSkip = useCallback(() => {
    try {
      sessionStorage.setItem(LOADING_SEEN_KEY, '1');
    } catch (err) {
      console.debug('sessionStorage غير متاح:', err);
    }
    setLeaving(true);
  }, []);

  if (skip) return null;

  return (
    <div className={`loading${leaving ? ' loading--leaving' : ''}`}>
      <div className="loading__bg" aria-hidden="true" />
      <div className="loading__glow" aria-hidden="true" />

      <div className="loading__content">
        <motion.div
          className="loading__logo-card"
          initial={reduced ? false : { opacity: 0, y: 26, scale: 0.82 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 17 }}
        >
          <div className="loading__logo">
            <img src="/Mlogo.jpeg" alt="مساحاتي" />
            <span className="loading__scan" aria-hidden="true" />
          </div>
        </motion.div>

        <motion.p
          className="loading__brand"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          مساحاتي
        </motion.p>

        <motion.p
          className="loading__sub"
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          منصة مساحات العمل المشتركة في غزة
        </motion.p>

        <motion.div
          className="loading__track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress}
          aria-label="جارٍ التحميل"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="loading__bar" style={{ width: `${progress}%` }} />
        </motion.div>

        <span className="loading__percent">{progress}%</span>
      </div>

      <button type="button" className="loading__skip" onClick={handleSkip}>
        تخطي
      </button>
    </div>
  );
}