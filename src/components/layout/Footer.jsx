import { Link } from 'react-router-dom';

const QUICK_LINKS = [
  { label: 'تصفح المساحات', to: '/spaces' },
  { label: 'تسجيل الدخول', to: '/login' },
  { label: 'إنشاء حساب', to: '/signup' },
];

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

          {/* حقوق النشر */}
          <div className="footer__meta">
            <span>© ٢٠٢٦ مساحاتي</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
