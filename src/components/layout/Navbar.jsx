import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import NavTab from './NavTab';
import MagneticButton from '../common/MagneticButton';

const LINKS = [
  { label: 'تصفح المساحات', to: '/spaces' },
  { label: 'لماذا مساحاتي', href: '#features'  },
  { label: 'كيف يعمل', href: '#how'},
  { label: 'لكلٍ كما يناسبه', href: '#roles'  },
  { label: 'من نحن', href: '#about'},
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 40);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleLogoClick = (e) => {
    e.preventDefault();
    if (location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate('/');
  };

  return (
    <nav className={`nav${scrolled ? ' nav--scrolled' : ''}`}>
      <div className="wrap nav__inner">
        {/* الشعار — يمين في RTL */}
        <Link className="brand" to="/" onClick={handleLogoClick} aria-label="Masahati">
          <img src="/masahati.jpeg" alt="Masahati" className="brand-logo" />
          <span className="brand-name">Masa<span>hati</span></span>
        </Link>

        {/* روابط النص — سطح المكتب فقط (صف واحد، داخل حاوية زجاجية) */}
        <nav className="nav__links" aria-label="روابط التنقل">
          {LINKS.map((l) => (
            <NavTab key={l.label} label={l.label} to={l.to} href={l.href} />
          ))}
        </nav>

        {/* الأزرار (تسجيل الدخول + إضافة حساب) */}
        <div className="nav__cta">
          <Link className="btn-ghost" to="/login">تسجيل الدخول</Link>
          <MagneticButton>
            <Link className="btn-primary" to="/signup">إضافة حساب</Link>
          </MagneticButton>
        </div>

        {/* زر القائمة — منفصل في الزاوية (يسار/يمين حسب الاتجاه) */}
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

      {/* القائمة المنسدلة للجوال */}
      {menuOpen && (
        <div className="nav__mobile">
          {LINKS.map((l) => (
            <NavTab key={l.label} label={l.label} to={l.to} href={l.href} onClick={closeMenu} />
          ))}
          <Link className="btn-ghost" to="/login" onClick={closeMenu}>تسجيل الدخول</Link>
          <MagneticButton>
            <Link className="btn-primary" to="/signup" onClick={closeMenu}>إضافة حساب</Link>
          </MagneticButton>
        </div>
      )}
    </nav>
  );
}
