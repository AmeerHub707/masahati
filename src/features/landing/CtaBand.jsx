import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useT';
import MagneticButton from '@/components/ui/MagneticButton';
import { Mail, Phone, MapPin } from 'lucide-react';

// البريد والهاتف بيانات تُعرض دائماً LTR (dir='ltr')، والموقع نص مترجم.
const CONTACTS = [
  {
    icon: Mail,
    labelKey: 'cta.contacts.email',
    value: 'masahati@outlook.com',
    href: 'mailto:masahati@outlook.com',
    dir: 'ltr',
  },
  {
    icon: Phone,
    labelKey: 'cta.contacts.call',
    value: '0567653009',
    href: 'tel:0567653009',
    dir: 'ltr',
  },
  {
    icon: MapPin,
    labelKey: 'cta.contacts.location',
    valueKey: 'cta.locationValue',
    href: null,
    dir: null,
  },
];

export default function CtaBand() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const { t } = useTranslation('landing');

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setInView(e.isIntersecting)),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="cta-glass">
      {/* صورة خلفية */}
      <div className="cta-glass__photo" aria-hidden="true" />

      <div className="wrap">
        {/* بطاقة واحدة تحتوي على الدعوة للإجراء + وسائل التواصل */}
        <div className={`cta-card${inView ? ' is-in' : ''}`}>
          {/* الجزء: الدعوة للإجراء */}
          <div className="cta-card__main">
            <h2>{t('cta.title')}</h2>
            <p>{t('cta.lead')}</p>

            <div className="cta-actions">
              <MagneticButton>
                <Link className="cta-btn cta-btn--primary" to="/signup">
                  <span>{t('cta.createAccount')}</span>
                  <svg className="cta-btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 6l-6 6 6 6" />
                  </svg>
                </Link>
              </MagneticButton>
              <Link className="cta-btn cta-btn--ghost" to="/login">{t('nav:login')}</Link>
            </div>
          </div>

          {/* الجزء: وسائل التواصل */}
          <div className="cta-card__contact">
            <h3>{t('cta.contactTitle')}</h3>
            <p>{t('cta.contactLead')}</p>
            <ul className="cta-contact__list">
              {CONTACTS.map((c) => {
                const Icon = c.icon;
                const inner = (
                  <>
                    <span className="cta-contact__icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span className="cta-contact__text">
                      <span className="cta-contact__label">{t(c.labelKey)}</span>
                      <span className="cta-contact__value" dir={c.dir ?? undefined}>{c.valueKey ? t(c.valueKey) : c.value}</span>
                    </span>
                  </>
                );
                return (
                  <li key={c.labelKey}>
                    {c.href ? (
                      <a href={c.href} className="cta-contact__row">{inner}</a>
                    ) : (
                      <div className="cta-contact__row">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
