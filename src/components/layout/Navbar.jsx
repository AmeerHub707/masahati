import { Link, useNavigate } from 'react-router-dom';
import { isLoggedIn } from '../../lib/authStore';

export default function Navbar() {
  const navigate = useNavigate();
  const handleLogoClick = (e) => {
    e.preventDefault();
    navigate(isLoggedIn() ? '/dashboard' : '/');
  };
  return (
    <nav className="nav">
      <div className="wrap nav__inner">
        <Link className="brand" to={isLoggedIn() ? '/dashboard' : '/'} onClick={handleLogoClick} aria-label="Masahati">
          <img src="/masahati.jpeg" alt="مساحاتي" className="brand-logo" />
          <span className="brand-name">Masa<span>hati</span></span>
        </Link>

        <div className="nav__links">
          <a href="#features">لماذا مساحاتي</a>
          <a href="#how">كيف يعمل</a>
          <Link to="/spaces">تصفح المساحات</Link>
          <a href="#roles">لكلٍّ كما يناسبه</a>
          <a href="#about">من نحن</a>
        </div>

        <div className="nav__cta">
          <Link className="btn-ghost" to="/login">تسجيل الدخول</Link>
          <Link className="btn-primary" to="/signup">إنشاء حساب</Link>
        </div>
      </div>
    </nav>
  );
}
