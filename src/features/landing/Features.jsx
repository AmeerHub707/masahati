import TiltCard from '@/components/ui/TiltCard';
import { useTranslation } from '@/hooks/useT';

// الأيقونات (SVG) بيانات، والنصوص مفاتيح ترجمة داخل مساحة الاسم `landing`.
const features = [
  { key: 'pricing', icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> },
  { key: 'speed', icon: <path d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01" /> },
  { key: 'power', icon: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /> },
];

export default function Features() {
  const { t } = useTranslation('landing');
  return (
    <section className="section" id="features">
      <div className="section__head">
        <span className="kicker">{t('features.kicker')}</span>
        <h2>{t('features.title')}</h2>
        <p>{t('features.lead')}</p>
      </div>

      <div className="wrap grid-3">
        {features.map((f) => (
          <TiltCard key={f.key}>
            <div className="feature glow-border glow-box">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
              </div>
              <h3>{t(`features.items.${f.key}.title`)}</h3>
              <p>{t(`features.items.${f.key}.desc`)}</p>
            </div>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
