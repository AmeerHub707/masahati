import { useEffect, useRef, useState } from 'react';

// عدّاد تصاعدي للأرقام عند ظهورها — نفس نمط الأرقام في صفحة الهبوط.
function parseStat(raw) {
  const m = String(raw).match(/^([\d.]+)(.*)$/);
  if (!m) return { num: null, suffix: String(raw) };
  return { num: parseFloat(m[1]), suffix: m[2] };
}

function formatNum(n, commas) {
  if (!commas || typeof n !== 'number') return String(n);
  return n.toLocaleString('en-US');
}

export default function DashCountUp({ value, duration = 1200, commas = false }) {
  const { num, suffix } = parseStat(value);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [display, setDisplay] = useState(() => {
    if (num == null) return value;
    if (reduce) return commas ? formatNum(num, true) + suffix : value;
    return (commas ? '0' : '0') + suffix;
  });
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || num == null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || started.current) return;
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          const cur = num % 1 === 0 ? Math.round(num * eased) : (num * eased).toFixed(1);
          setDisplay(formatNum(cur, commas) + suffix);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [num, suffix, value, duration, commas]);

  if (num == null) return <b>{value}</b>;
  return <b ref={ref}>{display}</b>;
}
