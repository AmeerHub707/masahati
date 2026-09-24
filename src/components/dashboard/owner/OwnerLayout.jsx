import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Store, Building2, Settings, LogOut, MapPin, Menu, X, Bell, Check, Clock, FileText, Megaphone, ChevronLeft, ChevronRight, Lock, Sparkles, Plus, Home, CalendarCheck, Receipt, Star } from 'lucide-react';
import MagneticButton from '../../common/MagneticButton';
import ThemeToggle from '../../common/ThemeToggle';
import { getCachedPictureUrl } from '../../../lib/profilePicture';
import { loadNotificationsWithFallback, markAllNotificationsReadWithFallback } from '../../../lib/notifications';

const NOTIF_ICONS = {
  bell: Bell,
  check: Check,
  clock: Clock,
  offer: Megaphone,
  accepted: Check,
  rejected: X,
  close: Lock,
  file: FileText,
  map: MapPin,
  spark: Sparkles,
};

// قائمة مخصصة لصاحب المساحة: نظرة عامة، مساحاتي، الحجوزات، المالية، السوق المفتوح، الإعلانات، التقييمات، الإعدادات.
const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: Home },
  { id: 'my-spaces', label: 'مساحاتي', icon: Building2 },
  { id: 'bookings', label: 'الحجوزات', icon: CalendarCheck },
  { id: 'financials', label: 'المالية', icon: Receipt },
  { id: 'market', label: 'السوق المفتوح', icon: Store },
  { id: 'ads', label: 'إعلاناتي', icon: Megaphone },
  { id: 'reviews', label: 'التقييمات', icon: Star },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

export default function OwnerLayout({
  active,
  onNavigate,
  onLogout,
  user,
  children,
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [failedSrc, setFailedSrc] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const btnRef = useRef(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [hiddenTop, setHiddenTop] = useState(false);
  const lastScrollY = useRef(0);

  const photoSrc = user?.photo || getCachedPictureUrl() || '';

  const [notifications, setNotifications] = useState([
    { id: 0, text: 'جارٍ تحميل الإشعارات…', time: '', read: false, icon: Clock },
  ]);
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await loadNotificationsWithFallback();
        if (cancelled) return;
        setNotifications(result.notifications.map((n) => ({ ...n, icon: NOTIF_ICONS[n.icon] || Bell })));
      } catch {
        if (cancelled) return;
        setNotifications([]);
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const applyLocalMarkRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const handleMarkAllRead = async () => {
    applyLocalMarkRead();
    try {
      await markAllNotificationsReadWithFallback();
    } catch {
      /* الوضع التجريبي يكتفي بالعلامة المحلية */
    }
  };

  const handleMarkOneRead = (id) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  };

  // يغلق لوحة الإشعارات بزر Escape ويعيد التركيز لزر الجرس.
  useEffect(() => {
    if (!notifOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setNotifOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [notifOpen]);

  // إغلاق لوحة الإشعارات بالنقر خارجها.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // يخفي الشريط العلوي عند التمرير للأسفل ويُعيده عند التمرير للأعلى.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dirDown = y > lastScrollY.current;
        const pastTop = y > 64;
        setHiddenTop(dirDown && pastTop);
        lastScrollY.current = Math.max(0, y);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!notifOpen || !btnRef.current) return;
    const update = () => {
      const r = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 6, left: r.left });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [notifOpen]);

  const close = () => setOpen(false);

  const initials =
    (user?.name || 'م')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('') || 'م';

  const handleNavClick = (id) => {
    onNavigate(id);
    close();
  };

  const today = new Date().toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="odash">
      <div className="odash__layout">
        {/* الشريط الجانبي */}
        <aside className={`odash__side${open ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
          <div className="odash__side-header">
            {collapsed ? (
              <div className="odash__side-marks">
                <button
                  type="button"
                  className="odash__collapse-btn"
                  onClick={() => setCollapsed((c) => !c)}
                  aria-label="فتح الشريط الجانبي"
                >
                  <ChevronLeft />
                </button>
                <img src="/Mlogo.jpeg" alt="مساحاتي" className="odash__side-mark" draggable={false} />
              </div>
            ) : (
              <div className="odash__side-headline">
                <span className="odash__side-logo">
                  <img src="/Logo.png" alt="مساحاتي" />
                </span>
                <button
                  type="button"
                  className="odash__collapse-btn is-auto"
                  onClick={() => setCollapsed((c) => !c)}
                  aria-label="طيّ الشريط الجانبي"
                >
                  <ChevronRight />
                </button>
              </div>
            )}
          </div>

          <div className="odash__profile" style={collapsed ? { justifyContent: 'center', padding: '.6rem .25rem' } : {}}>
            {(photoSrc && photoSrc !== failedSrc) ? (
              <img className="odash__avatar" src={photoSrc} alt={user?.name || ''} onError={() => setFailedSrc(photoSrc)} />
            ) : (
              <div className="odash__avatar">{initials}</div>
            )}
            {!collapsed && (
              <div>
                <h3>{user?.name || 'المستخدم'}</h3>
                <p>صاحب مساحة</p>
              </div>
            )}
          </div>

          <nav className="odash__nav" aria-label="قائمة لوحة المالك">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={active === tab.id ? 'is-active' : ''}
                  onClick={() => handleNavClick(tab.id)}
                  aria-current={active === tab.id ? 'page' : undefined}
                  title={collapsed ? tab.label : undefined}
                >
                  <Icon />
                  {!collapsed && <span>{tab.label}</span>}
                </button>
              );
            })}

            <button type="button" className="odash__nav-logout" onClick={collapsed ? () => setCollapsed(false) : onLogout} title={collapsed ? 'سجّل الخروج' : undefined}>
              <LogOut />
              {!collapsed && <span>سجّل الخروج</span>}
            </button>
          </nav>
        </aside>

        {/* الستارة الخلفية للجوال */}
        <div className={`odash__scrim${open ? ' show' : ''}`} onClick={close} aria-hidden="true" />

        {/* الشريط الرئيسي */}
        <div className="odash__main">
          <header className={`odash__top${hiddenTop ? ' is-hidden' : ''}`}>
            <button
              type="button"
              className="odash__burger"
              onClick={() => setOpen((o) => !o)}
              aria-label="فتح القائمة"
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </button>

            <div className="odash__title">
              <h1>{active === 'spaces' ? 'أضف مساحة' : (TABS.find((t) => t.id === active)?.label || 'لوحة المالك')}</h1>
              <p>{today}</p>
            </div>

            <ThemeToggle />

            <div className="odash__notif-wrap" ref={notifRef}>
              <button
                type="button"
                ref={btnRef}
                className={`odash__notif-btn${notifOpen ? ' is-open' : ''}`}
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="الإشعارات"
                aria-expanded={notifOpen}
                aria-controls="odash-notif-panel"
              >
                <Bell />
                {notifications.some((n) => !n.read) && (
                  <span className="odash__notif-badge">
                    {notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>

              {createPortal(
                notifOpen && (
                  <div className="odash__notif-panel" id="odash-notif-panel" role="dialog" aria-label="الإشعارات" style={{ position: 'fixed', top: panelPos.top, left: panelPos.left }}>
                    <div className="odash__notif-header">
                      <h3>الإشعارات</h3>
                      <button
                        type="button"
                        className="odash__notif-mark"
                        onClick={handleMarkAllRead}
                        disabled={notifLoading || notifications.length === 0}
                      >
                        قراءة الكل
                      </button>
                    </div>
                    {notifLoading ? (
                      <p className="odash__notif-empty">جارٍ تحميل الإشعارات…</p>
                    ) : notifications.length === 0 ? (
                      <p className="odash__notif-empty">لا توجد إشعارات حالياً.</p>
                    ) : (
                      <ul className="odash__notif-list">
                        {notifications.map((n) => {
                          const Icon = n.icon;
                          return (
                            <li
                              key={n.id}
                              role="button"
                              tabIndex={0}
                              className={`odash__notif-item${n.read ? '' : ' is-unread'}`}
                              onClick={() => handleMarkOneRead(n.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleMarkOneRead(n.id);
                                }
                              }}
                            >
                              <span className="odash__notif-icon">
                                <Icon />
                              </span>
                              <div className="odash__notif-body">
                                <p>{n.text}</p>
                                <span className="odash__notif-time">{n.time}</span>
                              </div>
                              {!n.read && <span className="odash__notif-dot" />}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ),
                document.body
              )}
            </div>

            <MagneticButton>
              <button
                type="button"
                className="odash__cta"
                onClick={() => handleNavClick('spaces')}
              >
                <Plus />
                <span>أضف مساحة</span>
              </button>
            </MagneticButton>
          </header>

          <main className={`odash__content${active === 'market' ? ' odash__content--market' : ''}`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}