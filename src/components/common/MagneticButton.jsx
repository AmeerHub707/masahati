import { useRef, useState } from 'react';

export default function MagneticButton({ children, className = '', strength = 0.3 }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({});

  const onMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setStyle({
      transform: `translate(${x * strength}px, ${y * strength}px)`,
      transition: 'transform 0.2s ease',
    });
  };

  const onMouseLeave = () => {
    setStyle({
      transform: 'translate(0px, 0px)',
      transition: 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
    });
  };

  return (
    <div
      ref={ref}
      className={`magnetic-btn ${className}`}
      style={style}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}
