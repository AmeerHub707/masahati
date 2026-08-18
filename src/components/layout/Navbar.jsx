import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 40);
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const handleLogoClick = (e) => {
    e.preventDefault();
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  return (
    <nav className={`nav${scrolled ? ' nav--scrolled' : ''}`}>
      <div className="nav__progress" style={{ transform: `scaleX(${progress / 100})` }} aria-hidden="true" />
      <div className="wrap nav__inner">
        <Link className="brand" to="/" onClick={handleLogoClick} aria-label="Masahati">
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
          <button
            type="button"
            className="nav__burger"
            aria-label="القائمة"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="nav__mobile">
          <a href="#features" onClick={closeMenu}>لماذا مساحاتي</a>
          <a href="#how" onClick={closeMenu}>كيف يعمل</a>
          <Link to="/spaces" onClick={closeMenu}>تصفح المساحات</Link>
          <a href="#roles" onClick={closeMenu}>لكلٍّ كما يناسبه</a>
          <a href="#about" onClick={closeMenu}>من نحن</a>
          <Link className="btn-ghost" to="/login" onClick={closeMenu}>تسجيل الدخول</Link>
          <Link className="btn-primary" to="/signup" onClick={closeMenu}>إنشاء حساب</Link>
        </div>
      )}
    </nav>
  );
}
