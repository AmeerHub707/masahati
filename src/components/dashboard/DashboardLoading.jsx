import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useT';
import useScrollLock from '@/hooks/useScrollLock';

const TOTAL_MS = 2000;
const EXIT_MS = 420;

export default function DashboardLoading({ done, onHidden }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  const rafRef = useRef(null);
  const startRef = useRef(0);

  // القفل بعدّاد مراجع، ويُفعَّل ما دام التحميل جارياً فقط: عند `done` نُطلقه
  // فوراً ويبقى إلى أن يخرج آخر مالك (طبقة الخروج مثلاً). كان رفعه في التنظيف
  // يُنازع طبقة الخروج على الصنف نفسه — وهو أصل العطل المتقطّع في OL11.
  useScrollLock(!done, 'dashboard-loading');

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

    startRef.current = performance.now();
    const tick = (now) => {
      const t = Math.min((now - startRef.current) / TOTAL_MS, 1);
      setProgress(Math.round(90 * t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [done]);

  // إشعار واحد عند زوال شاشة التحميل، لبدء الجولة خلفها لا فوقها.
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!hidden || notifiedRef.current) return;
    notifiedRef.current = true;
    onHidden?.();
  }, [hidden, onHidden]);

  if (hidden) return null;

  return (
    <div className={`loading${leaving ? ' loading--leaving' : ''}`} role="status" aria-live="polite">
      <div className="loading__bg" aria-hidden="true" />
      <div className="loading__glow" aria-hidden="true" />

      <div className="loading__content">
        <div className="loading__logo-card">
          <div className="loading__logo">
            <img src="/Mlogo.jpeg" alt={t('common:appName')} />
            <span className="loading__scan" aria-hidden="true" />
          </div>
        </div>

        <p className="loading__brand">{t('common:appName')}</p>
        <p className="loading__sub">{t('dashboard:loadingPreparing')}</p>

        <div
          className="loading__track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress}
          aria-label={t('common:loading')}
        >
          <div className="loading__bar" style={{ width: `${progress}%` }} />
        </div>

        <span className="loading__percent">{progress}%</span>
      </div>
    </div>
  );
}