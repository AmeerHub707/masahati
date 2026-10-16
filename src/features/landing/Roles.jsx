import TiltCard from '@/components/ui/TiltCard';
import { useTranslation } from '@/hooks/useT';

const check = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// كل دور: مفتاح + أيقونة SVG. النص في `roles.items.<key>` (tag/title/i1..i3).
const roles = [
  {
    key: 'student',
    icon: (
      <>
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" />
      </>
    ),
  },
  {
    key: 'owner',
    icon: (
      <>
        <path d="M3 21h18M5 21V7l8-4 8 4v14" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
  },
  {
    key: 'trusted',
    icon: (
      <>
        <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
];

const ROLE_ITEMS = ['i1', 'i2', 'i3'];

export default function Roles() {
  const { t } = useTranslation('landing');
  return (
    <section className="section roles" id="roles">
      <div className="section__head">
        <span className="kicker">{t('roles.kicker')}</span>
        <h2>{t('roles.title')}</h2>
        <p>{t('roles.lead')}</p>
      </div>

      <div className="wrap grid-3">
        {roles.map((r) => (
          <TiltCard key={r.key}>
            <div className="role-card glow-border glow-box">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{r.icon}</svg>
              </div>
              <span className="tag">{t(`roles.items.${r.key}.tag`)}</span>
              <h3>{t(`roles.items.${r.key}.title`)}</h3>
              <ul>
                {ROLE_ITEMS.map((k) => (
                  <li key={k}>
                    {check}
                    {t(`roles.items.${r.key}.${k}`)}
                  </li>
                ))}
              </ul>
            </div>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
