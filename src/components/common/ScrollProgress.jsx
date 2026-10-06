import { useEffect, useState } from 'react';

// اللوحة تمرّر المحتوى داخل .dash لا في النافذة، وحدث التمرير على عنصر داخلي
// لا يصعد إلى النافذة. فنقيس العنصر الذي تمرّر فعلاً (عبر طور الالتقاط الذي يمرّ
// بكل عنصر)، ونرجع إلى الصفحة نفسها إن كان التمرير خارجها.
function progressOf(el) {
  if (!el || el === window || el === document || el === document.body) {
    const doc = document.documentElement;
    const total = doc.scrollHeight - window.innerHeight;
    return total > 0 ? (window.scrollY / total) * 100 : 0;
  }
  const total = el.scrollHeight - el.clientHeight;
  return total > 0 ? (el.scrollTop / total) * 100 : 0;
}

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = (el) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setProgress(progressOf(el)));
    };

    // تمرير النافذة
    const onWindowScroll = () => measure(null);
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    // تمرير أي حاوية داخلية (لا يصعد الحدث، فيلتقطه الاستماع في طور الالتقاط)
    const onCaptureScroll = (e) => measure(e.target);
    window.addEventListener('scroll', onCaptureScroll, { passive: true, capture: true });
    window.addEventListener('resize', onWindowScroll);

    measure(null);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onWindowScroll);
      window.removeEventListener('scroll', onCaptureScroll, { capture: true });
      window.removeEventListener('resize', onWindowScroll);
    };
  }, []);

  return (
    <div className="scroll-progress" aria-hidden="true">
      <div
        className="scroll-progress__bar"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}