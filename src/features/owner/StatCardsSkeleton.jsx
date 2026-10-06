export default function StatCardsSkeleton({ cols = 4 }) {
  return (
    <section className={`odash__stats odash__stats--${cols}`} aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <div className="odash__stat-skel" key={i}>
          <div className="odash__stat-skel-ico odash__skel" />
          <div className="odash__stat-skel-info">
            <div className="odash__skel odash__skel--title" />
            <div className="odash__skel odash__skel--sub" />
          </div>
        </div>
      ))}
    </section>
  );
}