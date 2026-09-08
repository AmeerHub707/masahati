import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <Link className="brand" to="/">
          <img src="/Logo.png" alt="مساحاتي" className="brand-logo" style={{ height: '1.9rem' }} />
        </Link>
        <span>© ٢٠٢٦ مساحاتي — مساحات عمل مشتركة عبر غزة.</span>
        <span>
          <Link to="/login">دخول</Link> · <Link to="/signup">تسجيل</Link>
        </span>
      </div>
    </footer>
  );
}
