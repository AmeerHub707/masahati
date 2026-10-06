import { useEffect, useRef, useState } from 'react';

/**
 * Reveal — يُظهر محتواه عند التمرير إليه (Scroll-Trigger / Reveal on Scroll).
 * يستخدم IntersectionObserver ويتوافق مع تفضيل تقليل الحركة (prefers-reduced-motion).
 *
 * الخصائص:
 *  - as:    عنصر الغلاف (افتراضياً 'div')
 *  - delay: تأخير الظهور بالملي ثانية
 *  - y:     مقدار الإزاحة الرأسية الأولية بالبكسل (افتراضياً 28)
 *  - once:  هل يظهر مرة واحدة فقط (افتراضياً true)
 */
export default function Reveal({
  as: Tag = 'div',
  delay = 0,
  y = 28,
  once = false,
  className = '',
  children,
  ...rest
}) {
  const ref = useRef(null);
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setShown(false);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [once, reduceMotion]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? 'reveal--in' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms`, '--reveal-y': `${y}px` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
