import { useRef, useState } from 'react';

// أعمدة الرسم البياني مع تسمية عائمة تتبع مؤشر الماوس بدل قيمة ثابتة فوق العمود.
// يبقى الرصيص داخل حدود الرسم أفقيّاً، ويظهر أعلى المؤشر مباشرة.
export default function ChartBars({
  points,
  max,
  dense = false,
  barClassName,
  xHidden,
  tip,
}) {
  const plotRef = useRef(null);
  const [pos, setPos] = useState(null); // { x, y, text }

  const handleMove = (e, p) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX = e.clientX - rect.left;
    const min = 70;
    const maxX = Math.max(min, rect.width - min);
    setPos({
      x: Math.min(Math.max(rawX, min), maxX),
      y: e.clientY - rect.top,
      text: tip(p),
    });
  };

  return (
    <div className="odash__chart-plot" ref={plotRef}>
      <div className="odash__chart-grid">
        {[1, 0.75, 0.5, 0.25, 0].map((f) => (
          <i key={f} style={{ top: `${(1 - f) * 100}%` }} />
        ))}
      </div>
      <div className={`odash__chart-bars${dense ? ' is-dense' : ''}`}>
        {points.map((p) => {
          const h = max > 0 ? Math.max(4, (p.value / max) * 100) : 4;
          return (
            <div
              className={`odash__chart-col${barClassName ? barClassName(p) : ''}`}
              key={p.key}
              onMouseMove={(e) => handleMove(e, p)}
              onMouseLeave={() => setPos(null)}
            >
              <div className="odash__chart-bar" style={{ height: `${h}%` }} />
              {xHidden && xHidden(p) ? (
                <span className="odash__chart-x is-hidden">{p.label}</span>
              ) : (
                <span className="odash__chart-x">{p.label}</span>
              )}
            </div>
          );
        })}
      </div>
      {pos && (
        <span className="odash__chart-tip" style={{ left: pos.x, top: pos.y - 10 }}>
          {pos.text}
        </span>
      )}
    </div>
  );
}