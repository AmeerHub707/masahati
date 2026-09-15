import { useEffect, useRef, useState } from 'react';

const TOTAL_MS = 2000;
const EXIT_MS = 420;

export default function DashboardLoading({ done }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  const rafRef = useRef(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (done) {
      const ready = setTimeout(() => {
        setProgress(100);
        setLeaving(true);
      }, 0);
      const hide = setTimeout(() => setHidden(true), EXIT_MS);
      return () => {
        clearTimeout(ready);
        clearTimeout(hide);
      };
    }

    document.body.classList.add('no-scroll');
    startRef.current = performance.now();
    const tick = (now) => {
      const t = Math.min((now - startRef.current) / TOTAL_MS, 1);
      setProgress(Math.round(90 * t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.body.classList.remove('no-scroll');
    };
  }, [done]);

  if (hidden) return null;

  return (
    <div className={`loading${leaving ? ' loading--leaving' : ''}`} role="status" aria-live="polite">
      <div className="loading__bg" aria-hidden="true" />
      <div className="loading__glow" aria-hidden="true" />

      <div className="loading__content">
        <div className="loading__logo-card">
          <div className="loading__logo">
            <img src="/Mlogo.jpeg" alt="مساحاتي" />
            <span className="loading__scan" aria-hidden="true" />
          </div>
        </div>

        <p className="loading__brand">مساحاتي</p>
        <p className="loading__sub">جارٍ تجهيز لوحة التحكم…</p>

        <div
          className="loading__track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress}
          aria-label="جارٍ التحميل"
        >
          <div className="loading__bar" style={{ width: `${progress}%` }} />
        </div>

        <span className="loading__percent">{progress}%</span>
      </div>
    </div>
  );
}