import { Link } from 'react-router-dom';

const QUICK_LINKS = [
  { label: 'تصفح المساحات', to: '/spaces' },
  { label: 'تسجيل الدخول', to: '/login' },
  { label: 'إنشاء حساب', to: '/signup' },
];

const SOCIALS = [
  { label: 'إنستغرام', href: 'https://www.instagram.com/masahati_gaza', icon: 'instagram' },
  { label: 'ثريدز', href: 'https://www.threads.net/@masahati_gaza', icon: 'threads' },
  { label: 'لينكد إن', href: 'https://www.linkedin.com/in/masahati-%F0%9F%93%8D-gaza-31961b39b', icon: 'linkedin' },
];

const SOCIAL_VIEWBOX = { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': 'true' };

function SocialGlyph({ name }) {
  if (name === 'instagram') {
    return (
      <svg {...SOCIAL_VIEWBOX} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === 'linkedin') {
    return (
      <svg {...SOCIAL_VIEWBOX} fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
      </svg>
    );
  }
  return (
    <svg {...SOCIAL_VIEWBOX} fill="currentColor">
      <path d="M12.186 24h-.057c-3.477 0-6.005-1.212-7.763-3.714C3.032 18.34 2.216 15.145 2.19 11.78v-.05c.026-3.365.841-6.56 2.176-8.506C6.124 1.212 8.652 0 12.129 0h.115c2.501 0 4.578.718 6.187 2.15 1.732 1.573 2.685 3.866 2.845 6.872l-.009-.005-.025 5.7c.056 3.766.373 5.54.77 6.829-.198.074-.419.142-.662.198-.604.136-1.336.224-2.02.318-1.345.185-2.68.369-3.505.768-.826.4-1.807 1.203-1.807 2.702 0 .65.157 1.237.397 1.728-.449.156-.92.263-1.408.319l-.092.011zM9.62 3.384c-.386.255-1.047.366-1.397.366-.35 0-1.05-.111-1.398-.366-.35-.255-.543-.66-.543-1.148 0-.488.193-.893.543-1.149A2.62 2.62 0 0 1 8.223.388c.35 0 1.011.11 1.397.366.35.256.543.66.543 1.149 0 .488-.193.893-.543 1.149zm0 .332c.404.297.93.43 1.575.43.321 0 .505.226.505.531 0 .294-.182.54-.505.54-.645 0-1.171-.15-1.575-.43-.405-.28-.613-.67-.613-1.137 0-.456.208-.845.613-1.136zM15.757 6.235c2.875.029 5.205 1.812 5.532 4.818l.021 5.68c-.088.02-.175.036-.263.052-.603.114-1.127.213-1.64.322-3.203.676-4.299 1.581-4.45 2.137-.1.363.099.624.401.623.6 0 1.925-.712 2.585-1.065v1.002c-.819.42-2.024.96-3.07 1.02-2.412.14-4.509-1.782-4.509-4.43 0-2.688 2.188-4.653 5.047-4.673l.123.002zm.21 1.68c-1.992.02-3.788 1.221-3.788 2.868 0 .668.35 1.204.9 1.49l.004-.001.032-.008c.217-.055.867-.48 2.349-.906.36-.104.76-.211 1.18-.319-.22-2.397-1.718-3.113-2.677-3.124z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__bar">
          {/* الشعار + وصف مختصر */}
          <div className="footer__brand">
            <Link className="brand" to="/">
              <img src="/Logo.png" alt="مساحاتي" className="brand-logo" style={{ height: '1.7rem' }} />
            </Link>
            <span className="footer__tagline">مساحات عمل مشتركة في غزة</span>
          </div>

          {/* روابط سريعة على سطر واحد */}
          <ul className="footer__links">
            {QUICK_LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>

          {/* حساباتنا على وسائل التواصل + حقوق النشر */}
          <div className="footer__right">
            <ul className="footer__social">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="footer__social-link" title={s.label} aria-label={s.label}>
                    <SocialGlyph name={s.icon} />
                  </a>
                </li>
              ))}
            </ul>
            <div className="footer__meta">
              <span>© ٢٠٢٦ مساحاتي</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}