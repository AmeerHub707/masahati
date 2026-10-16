import TiltCard from '@/components/ui/TiltCard';
import { useTranslation } from '@/hooks/useT';

// الأيقونات بيانات، والنصوص في `about.items.<key>`.
const cards = [
  { key: 'mission', icon: <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z" /> },
  { key: 'community', icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /> },
  { key: 'values', icon: <path d="M3 12h4l3 8 4-16 3 8h4" /> },
];

export default function About() {
  const { t } = useTranslation('landing');
  return (
    <section className="section" id="about">
      <div className="section__head">
        <span className="kicker">{t('about.kicker')}</span>
        <h2>{t('about.title')}</h2>
        <p>{t('about.lead')}</p>
      </div>

      <div className="wrap grid-3">
        {cards.map((c) => (
          <TiltCard key={c.key}>
            <div className="feature glow-border glow-box">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
              </div>
              <h3>{t(`about.items.${c.key}.title`)}</h3>
              <p>{t(`about.items.${c.key}.desc`)}</p>
            </div>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
