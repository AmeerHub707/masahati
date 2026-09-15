import { useState, useEffect, useCallback, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import NavTab from './NavTab';
import MagneticButton from '../common/MagneticButton';
import { AppReadyContext } from '../../context/AppReadyContext';

const LINKS = [
  { label: 'تصفح المساحات', to: '/spaces' },
  { label: 'لماذا مساحاتي', href: '#features' },
  { label: 'كيف يعمل', href: '#how' },
  { label: 'لكلٍ كما يناسبه', href: '#roles' },
  { label: 'من نحن', href: '#about' },
];

const EASE_OUT = [0.22, 1, 0.36, 1];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const appReady = useContext(AppReadyContext);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 40);
  const [menuOpen, setMenuOpen] = useState(false);

  const logo = useAnimation();
  const glow = useAnimation();
  const shine = useAnimation();

  useEffect(() => {
    if (!appReady) return;
    let cancelled = false;
    let timer;

    const animate = async () => {
      if (cancelled) return;
      logo.stop(); glow.stop(); shine.stop();
      logo.set({ opacity: 0, clipPath: 'inset(0% 82% 0% 0%)', scale: 0.88, rotateY: -10, x: 4 });
      glow.set({ opacity: 0, scale: 0.5 });
      shine.set({ x: '520%' });
      await new Promise((r) => { setTimeout(r, 120); });
      if (cancelled) return;

      await Promise.all([
        logo.start({ opacity: 1, scale: 1, rotateY: 0, transition: { duration: 0.4, ease: EASE_OUT } }),
        glow.start({ opacity: 1, scale: 1.4, transition: { duration: 0.28, ease: 'easeOut' } }),
      ]);
      if (cancelled) return;

      await Promise.all([
        logo.start({ clipPath: 'inset(0% 0% 0% 0%)', x: 0, transition: { duration: 0.6, ease: EASE_OUT } }),
        glow.start({ opacity: 0.25, scale: 1, transition: { duration: 0.4 } }),
      ]);
      if (cancelled) return;

      await shine.start({ x: '-120%', transition: { duration: 0.5, ease: EASE_OUT } });
      if (cancelled) return;

      await logo.start({ scale: 1.03, transition: { duration: 0.1 } });
      await logo.start({ scale: 1, transition: { type: 'spring', stiffness: 400, damping: 14 } });
    };

    animate();
    timer = setInterval(animate, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [appReady, logo, glow, shine]);

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
          {reduced ? (
            <img src="/Logo.png" alt="Masahati" className="brand-logo" />
          ) : (
            <span className="brand__reveal">
              <motion.span className="brand__glow" initial={{ opacity: 0, scale: 0.5 }} animate={glow} />
              <motion.img
                src="/Logo.png"
                alt="Masahati"
                className="brand-logo"
                initial={{ opacity: 0, clipPath: 'inset(0% 82% 0% 0%)', scale: 0.88, rotateY: -10, x: 4 }}
                animate={logo}
                style={{ transformPerspective: 500 }}
              />
              <motion.span className="brand__shine" initial={{ x: '520%' }} animate={shine} />
            </span>
          )}
        </Link>

        {/* روابط النص — سطح المكتب فقط */}
        <nav className="nav__links" aria-label="روابط التنقل">
          {LINKS.map((l) => (
            <NavTab key={l.label} label={l.label} to={l.to} href={l.href} />
          ))}
        </nav>

        {/* الأزرار */}
        <div className="nav__cta">
          <Link className="cta-btn cta-btn--ghost" to="/login">تسجيل الدخول</Link>
          <MagneticButton>
            <Link className="cta-btn cta-btn--primary" to="/signup">إضافة حساب</Link>
          </MagneticButton>
        </div>

        {/* زر القائمة */}
        <button type="button" className="nav__burger" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          <span /><span /><span />
        </button>
      </div>

      {menuOpen && (
        <div className="nav__mobile">
          {LINKS.map((l) => (
            <NavTab key={l.label} label={l.label} to={l.to} href={l.href} onClick={closeMenu} />
          ))}
          <Link className="cta-btn cta-btn--ghost" to="/login" onClick={closeMenu}>تسجيل الدخول</Link>
          <MagneticButton>
            <Link className="cta-btn cta-btn--primary" to="/signup" onClick={closeMenu}>إضافة حساب</Link>
          </MagneticButton>
        </div>
      )}
    </nav>
  );
}
