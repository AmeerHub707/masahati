import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Menu, X, Bell, MapPin, Check, Clock, FileText } from 'lucide-react';
import { getAdminProfile } from '../../lib/adminAuth';
import { ADMIN_TABS } from '../../data/adminTabs';
import MagneticButton from '../common/MagneticButton';
import ThemeToggle from '../common/ThemeToggle';

function useDates() {
  const now = new Date();
  const gregorian = now.toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const hijri = (() => {
    try {
      return now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  })();
  return { gregorian, hijri };
}

const INITIAL_NOTIFS = [
  { id: 1, text: 'طلب مراجعة مساحة جديدة "ركن المبرمجين"', time: 'منذ 12 دقيقة', read: false, icon: FileText },
  { id: 2, text: 'فتح نزاع جديد #DIS-045 على "مكتب المبدعين"', time: 'منذ ساعتين', read: false, icon: Clock },
  { id: 3, text: 'تأكيد حجز جديد #BK-1022 من محمد دويدار', time: 'منذ ساعة', read: false, icon: Check },
  { id: 4, text: 'تحديث سياسة الاسترداد يُتاح للمستخدمين', time: 'أمس', read: true, icon: MapPin },
];

export default function AdminLayout({ active, onNavigate, onLogout, children }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [tips, setTips] = useState({ show: false, top: 0, left: 0 });
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const notifRef = useRef(null);
  const btnRef = useRef(null);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFS);
  const { gregorian, hijri } = useDates();
  const profile = getAdminProfile();

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

  const unread = notifications.filter((n) => !n.read).length;

  const navigateTo = (id) => {
    onNavigate(id);
    close();
  };

  const showCollapseTip = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTips({ show: true, top: r.top + r.height / 2 - 14, left: Math.max(8, r.left - 132) });
  };
  const hideCollapseTip = () => setTips((t) => (t.show ? { ...t, show: false } : t));

  const initials = (profile?.name || 'م').trim().slice(0, 2) || 'م';

  return (
    <div className="dash">
      <div className="dash__layout">
        {/* الشريط الجانبي — على اليمين في RTL */}
        <aside
          className={`dash__side${open ? ' open' : ''}${collapsed ? ' collapsed' : ''} ${collapsed ? 'w-16' : 'w-64'}`}
        >
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
                <img src="/Mlogo.jpeg" alt="مساحاتي" className="h-10 w-10 object-contain" draggable={false} />
              </div>
            ) : (
              <div className="flex w-full items-center gap-1 px-1">
                <span className="flex items-center gap-2">
                  <img src="/Logo.png" alt="مساحاتي" className="h-9 w-auto object-contain" />
                </span>
                <button
                  type="button"
                  className="dash__collapse-btn ms-auto inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 transition hover:bg-orange-500 hover:text-white"
                  onClick={() => setCollapsed((c) => !c)}
                  aria-label="طيّ الشريط الجانبي"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          <div className="dash__profile" style={collapsed ? { justifyContent: 'center', padding: '.6rem .25rem' } : {}}>
            <div className="dash__avatar">{initials}</div>
            {!collapsed && (
              <div>
                <h3>{profile?.name || 'مدير المنصة'}</h3>
                <p>مدير المنصة</p>
              </div>
            )}
          </div>

          <nav className="dash__nav" aria-label="قائمة لوحة المشرف">
            {ADMIN_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={active === tab.id ? 'is-active' : ''}
                  onClick={() => navigateTo(tab.id)}
                  aria-current={active === tab.id ? 'page' : undefined}
                  title={collapsed ? tab.label : undefined}
                >
                  <Icon />
                  {!collapsed && <span>{tab.label}</span>}
                </button>
              );
            })}

            <button
              type="button"
              className="dash__nav-logout"
              onClick={collapsed ? () => setCollapsed(false) : onLogout}
              title={collapsed ? 'تسجيل الخروج' : undefined}
            >
              <LogOut />
              {!collapsed && <span>تسجيل الخروج</span>}
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
              <h1>{ADMIN_TABS.find((t) => t.id === active)?.label || 'لوحة التحكم'}</h1>
              <p style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                <span>{gregorian}</span>
                {hijri && <span style={{ color: 'var(--accent)' }}>{`• ${hijri}`}</span>}
              </p>
            </div>

            <ThemeToggle />

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
                {unread > 0 && <span className="dash__notif-badge">{unread}</span>}
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
                            onClick={() =>
                              setNotifications((prev) =>
                                prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                              )
                            }
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

          <main className="dash__content">{children}</main>
        </div>
      </div>
    </div>
  );
}