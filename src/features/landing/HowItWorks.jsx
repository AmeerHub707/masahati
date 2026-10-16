import TiltCard from '@/components/ui/TiltCard';
import { useTranslation } from '@/hooks/useT';

// مفاتيح الخطوات فقط؛ النص يُحلّ عند التصيير عبر `how.items.<key>`.
const steps = ['explore', 'book', 'arrive'];

export default function HowItWorks() {
  const { t } = useTranslation('landing');
  return (
    <section className="section" id="how">
      <div className="section__head">
        <span className="kicker">{t('how.kicker')}</span>
        <h2>{t('how.title')}</h2>
        <p>{t('how.lead')}</p>
      </div>

      <div className="wrap steps">
        {steps.map((s) => (
          <TiltCard key={s}>
            <div className="step glow-border glow-box">
              <div className="num"></div>
              <h3>{t(`how.items.${s}.title`)}</h3>
              <p>{t(`how.items.${s}.desc`)}</p>
            </div>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
