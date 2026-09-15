import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Home, CalendarCheck, Heart, Settings, LogOut, MapPin, Menu, X, Bell, Check, Clock, FileText, Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import MagneticButton from '../../components/common/MagneticButton';

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: Home },
  { id: 'bookings', label: 'حجوزاتي', icon: CalendarCheck },
  { id: 'favorites', label: 'المساحات المفضلة', icon: Heart },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

export default function DashboardLayout({
  active,
  onNavigate,
  onLogout,
  user,
  children,
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tips, setTips] = useState({ show: false, top: 0, left: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const btnRef = useRef(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('masahati_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [notifications, setNotifications] = useState([
    { id: 1, text: 'تم تأكيد حجزك لمساحة "قاعة الاجتماعات"', time: 'منذ 5 دقائق', read: false, icon: Check },
    { id: 2, text: 'طلب حجز جديد على مساحتك "المكتب الرئيسي"', time: 'منذ ساعة', read: false, icon: FileText },
    { id: 3, text: 'تنتهي صلاحية حجزك غداً', time: 'منذ 3 ساعات', read: true, icon: Clock },
    { id: 4, text: 'تم إضافة مساحة جديدة في منطقتك', time: 'أمس', read: true, icon: MapPin },
  ]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('masahati_theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const showCollapseTip = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTips({ show: true, top: r.top + r.height / 2 - 14, left: Math.max(8, r.left - 132) });
  };
  const hideCollapseTip = () => setTips((t) => (t.show ? { ...t, show: false } : t));

  const initials =
    (user?.name || 'م')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('') || 'م';

  const navigateTo = (id) => {
    onNavigate(id);
    close();
  };

  const handleNavClick = (id) => {
    navigateTo(id);
  };

  const today = new Date().toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="dash">
      <div className="dash__layout">
        {/* الشريط الجانبي */}
        <aside className={`dash__side${open ? ' open' : ''}${collapsed ? ' collapsed' : ''} ${collapsed ? 'w-16' : 'w-64'}`}>
          <div className="dash__side-header">
            {collapsed ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  className="dash__collapse-btn relative inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 transition hover:bg-orange-500 hover:text-white"
                  onClick={() => setCollapsed((c) => !c)}
                  onMouseEnter={showCollapseTip}
                  onMouseLeave={hideCollapseTip}
                  onFocus={showCollapseTip}
                  onBlur={hideCollapseTip}
                  aria-label="فتح الشريط الجانبي"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <img src="/Mlogo.png" alt="مساحاتي" className="h-10 w-10 object-contain" draggable={false} />
              </div>
            ) : (
              <div className="flex w-full items-center gap-1 px-1">
                <span className="flex items-center gap-2">
                  <img src="/Logo.png" alt="مساحاتي" className="h-9 w-auto object-contain" />
                  <span className="brand-name text-xl font-extrabold" style={{ color: 'var(--accent)' }}></span>
                </span>
                <button
                  type="button"
                  className="dash__collapse-btn mx-auto inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 transition hover:bg-orange-500 hover:text-white"
                  onClick={() => setCollapsed((c) => !c)}
                  aria-label="طيّ الشريط الجانبي"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          <div className="dash__profile" style={collapsed ? { justifyContent: 'center', padding: '.6rem .25rem' } : {}}>
            {user?.photo || localStorage.getItem('profile_picture_url') ? (
              <img className="dash__avatar" src={user?.photo || localStorage.getItem('profile_picture_url')} alt={user?.name || ''} />
            ) : (
              <div className="dash__avatar">{initials}</div>
            )}
            {!collapsed && (
              <div>
                <h3>{user?.name || 'المستخدم'}</h3>
                <p>{user?.role === 'owner' ? 'صاحب مساحة' : 'طالب'}</p>
              </div>
            )}
          </div>

          <nav className="dash__nav" aria-label="قائمة لوحة التحكم">
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

            <button type="button" className="dash__nav-logout" onClick={collapsed ? () => setCollapsed(false) : onLogout} title={collapsed ? 'سجّل الخروج' : undefined}>
              <LogOut />
              {!collapsed && <span>سجّل الخروج</span>}
            </button>
          </nav>
        </aside>

        {/* تلميح فتح الشريط الجانبي (عبر بوابة لتجاوز قصّ المحتوى) */}
        {collapsed &&
          createPortal(
            tips.show && (
              <span
                className="pointer-events-none fixed whitespace-nowrap rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white shadow-lg"
                style={{ top: tips.top, left: tips.left }}
                role="tooltip"
              >
                فتح الشريط الجانبي
              </span>
            ),
            document.body
          )}

        {/* الستارة الخلفية للجوال */}
        <div className={`dash__scrim${open ? ' show' : ''}`} onClick={close} aria-hidden="true" />

        {/* الشريط الرئيسي */}
        <div className="dash__main">
          <header className="dash__top">
            <button
              type="button"
              className="dash__burger"
              onClick={() => setOpen((o) => !o)}
              aria-label="فتح القائمة"
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </button>

            <div className="dash__title">
              <h1>{TABS.find((t) => t.id === active)?.label || 'لوحة التحكم'}</h1>
              <p>{today}</p>
            </div>

            <button
              type="button"
              className="dash__theme-btn"
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
            >
              {dark ? <Sun /> : <Moon />}
            </button>

            <div className="dash__notif-wrap" ref={notifRef}>
              <button
                type="button"
                ref={btnRef}
                className={`dash__notif-btn${notifOpen ? ' is-open' : ''}`}
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="الإشعارات"
                aria-expanded={notifOpen}
              >
                <Bell />
                {notifications.some((n) => !n.read) && (
                  <span className="dash__notif-badge">
                    {notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>

              {createPortal(
                notifOpen && (
                  <div className="dash__notif-panel" style={{ position: 'fixed', top: panelPos.top, left: panelPos.left }}>
                    <div className="dash__notif-header">
                      <h3>الإشعارات</h3>
                      <button
                        type="button"
                        className="dash__notif-mark"
                        onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                      >
                        قراءة الكل
                      </button>
                    </div>
                    <ul className="dash__notif-list">
                      {notifications.map((n) => {
                        const Icon = n.icon;
                        return (
                          <li
                            key={n.id}
                            className={`dash__notif-item${n.read ? '' : ' is-unread'}`}
                            onClick={() => {
                              setNotifications((prev) =>
                                prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                              );
                            }}
                          >
                            <span className="dash__notif-icon">
                              <Icon />
                            </span>
                            <div className="dash__notif-body">
                              <p>{n.text}</p>
                              <span className="dash__notif-time">{n.time}</span>
                            </div>
                            {!n.read && <span className="dash__notif-dot" />}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ),
                document.body
              )}
            </div>

            <MagneticButton>
              <Link className="dash__logout-top" to="/spaces">
                <MapPin />
                <span>تصفح المساحات</span>
              </Link>
            </MagneticButton>
          </header>

          <main className="dash__content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
