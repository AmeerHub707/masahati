import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MagneticButton from '../common/MagneticButton';
import { Mail, Phone, MapPin } from 'lucide-react';

const CONTACTS = [
  {
    icon: Mail,
    label: 'البريد الإلكتروني',
    value: 'masahati@outlook.com',
    href: 'mailto:masahati@outlook.com',
    dir: 'ltr',
  },
  {
    icon: Phone,
    label: 'اتصل بنا',
    value: '0567653009',
    href: 'tel:0567653009',
    dir: 'ltr',
  },
  {
    icon: MapPin,
    label: 'الموقع',
    value: 'غزة، فلسطين',
    href: null,
    dir: null,
  },
];

export default function CtaBand() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

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
            <span className="cta-card__badge">مستعد للبدء؟</span>
            <h2>جاهز لتجد مساحتك؟</h2>
            <p>انضم إلى الطلاب وأصحاب المساحات في غزة على المنصة المبنية للعمل الموثوق القابل للحجز.</p>

            <div className="cta-actions">
              <MagneticButton>
                <Link className="cta-btn cta-btn--primary" to="/signup">
                  <span>أنشئ حسابك</span>
                  <svg className="cta-btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 6l-6 6 6 6" />
                  </svg>
                </Link>
              </MagneticButton>
              <Link className="cta-btn cta-btn--ghost" to="/login">تسجيل الدخول</Link>
            </div>
          </div>

          {/* الجزء: وسائل التواصل */}
          <div className="cta-card__contact">
            <h3>تواصل معنا</h3>
            <p>لديك سؤال أو تريد مساحة؟ نحن هنا لمساعدتك.</p>
            <ul className="cta-contact__list">
              {CONTACTS.map((c) => {
                const Icon = c.icon;
                const inner = (
                  <>
                    <span className="cta-contact__icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span className="cta-contact__text">
                      <span className="cta-contact__label">{c.label}</span>
                      <span className="cta-contact__value" dir={c.dir ?? undefined}>{c.value}</span>
                    </span>
                  </>
                );
                return (
                  <li key={c.label}>
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
