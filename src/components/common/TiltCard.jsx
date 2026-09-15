import { useRef, useState } from 'react';

export default function TiltCard({ children, className = '', glare = true }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({});
  const [glareStyle, setGlareStyle] = useState({});

  const onMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    setStyle({
      transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`,
      transition: 'transform 0.1s ease',
    });

    if (glare) {
      setGlareStyle({
        opacity: 0.15,
        background: `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.8), transparent 60%)`,
      });
    }
  };

  const onMouseLeave = () => {
    setStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)',
      transition: 'transform 0.5s ease',
    });
    if (glare) {
      setGlareStyle({ opacity: 0, transition: 'opacity 0.5s ease' });
    }
  };

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      style={style}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {glare && <div className="tilt-glare" style={glareStyle} />}
    </div>
  );
}
