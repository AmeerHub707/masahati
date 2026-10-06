export default function SectionDivider({ flip = false, className = '' }) {
  return (
    <div
      className={`section-divider ${flip ? 'section-divider-flip' : ''} ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ width: '100%', height: '60px', display: 'block' }}>
        <path
          d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z"
          className="divider-fill-1"
        />
        <path
          d="M0,35 C320,5 640,55 960,25 C1120,15 1280,40 1440,35 L1440,60 L0,60 Z"
          className="divider-fill-2"
        />
      </svg>
    </div>
  );
}
