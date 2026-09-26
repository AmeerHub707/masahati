import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Home, CalendarCheck, Heart, Settings, LogOut, MapPin, Menu, X, Bell, Check, Clock, FileText, Megaphone, ChevronLeft, ChevronRight, ChevronDown, Lock, Sparkles, Plus, List, HelpCircle } from 'lucide-react';
import MagneticButton from '../common/MagneticButton';
import ThemeToggle from '../common/ThemeToggle';
import { getCachedPictureUrl } from '../../lib/profilePicture';
import { loadNotificationsWithFallback, markAllNotificationsReadWithFallback } from '../../lib/notifications';

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

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: Home },
  { id: 'bookings', label: 'حجوزاتي', icon: CalendarCheck },
  { id: 'favorites', label: 'المساحات المفضلة', icon: Heart },
  { id: 'requests', label: 'طلباتي الخاصة', icon: Megaphone },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

export default function DashboardLayout({
  active,
  onNavigate,
  onLogout,
  user,
  offersBadge,
  children,
  requestsView,
  onRequestsViewChange,
  tourStep = 0,
  onStartTour,
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [reqOpen, setReqOpen] = useState(true);
  const [failedSrc, setFailedSrc] = useState('');
  const [tips, setTips] = useState({ show: false, top: 0, left: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const btnRef = useRef(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [hiddenTop, setHiddenTop] = useState(false);
  const lastScrollY = useRef(0);

  // "الطلبات الخاصة" متاحة للطلاب فقط (تظهر المتاجر عروضاً عبر واجهة مالك).
  const displayTabs = TABS.filter((t) => t.id !== 'requests' || user?.role !== 'owner');

  // مصدر الصورة الحالي — إذا غيّره المستخدم برفع صورة جديدة يعاد عرضها تلقائياً
  // حتى لو كان المصدر السابق قد فشل في التحميل (بدل التعليق على الحروف الأولى).
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

  // تنسيق الواجهة مع خطوة الجولة: الشريط الجانبي يُفتح في خطوة التبويبات ويُغلق بعدها،
  // ولوحة الإشعارات تُغلق، ويُعاد الشريط العلوي إلى أعلى الصفحة عند خطوة الترحيب.
  // التنفيذ على الإطار التالي حتى يبدأ المسح في الجولة بعد استقرار التغيير.
  useEffect(() => {
    if (!tourStep) return undefined;
    const frame = requestAnimationFrame(() => {
      setNotifOpen(false);
      if (tourStep === 1) {
        setHiddenTop(false);
        setOpen(false);
        setCollapsed(false);
        window.scrollTo({ top: 0, behavior: 'auto' });
        return;
      }
      if (tourStep === 2) {
        setCollapsed(false);
        setOpen(true);
        return;
      }
      setOpen(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [tourStep]);

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
        <aside className={`dash__side${open ? ' open' : ''}${collapsed ? ' collapsed' : ''} ${collapsed ? 'w-16' : 'w-64'}`} data-tour="customer-sidebar">
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
            {(photoSrc && photoSrc !== failedSrc) ? (
              <img className="dash__avatar" src={photoSrc} alt={user?.name || ''} onError={() => setFailedSrc(photoSrc)} />
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
            {displayTabs.map((tab) => {
              const Icon = tab.icon;
              if (tab.id === 'requests') {
                return (
                  <div className="dash__nav-group" key={tab.id}>
                    <button
                      type="button"
                      className={`dash__nav-parent${active === tab.id ? ' is-active' : ''}`}
                      onClick={() => { setReqOpen((o) => !o); handleNavClick(tab.id); }}
                      aria-current={active === tab.id ? 'page' : undefined}
                      aria-expanded={reqOpen}
                      title={collapsed ? tab.label : undefined}
                    >
                      <Icon />
                      {!collapsed && <span>{tab.label}</span>}
                      {!collapsed && (
                        <ChevronDown className={`dash__nav-caret${reqOpen ? ' is-open' : ''}`} aria-hidden="true" />
                      )}
                      {offersBadge > 0 && (
                        collapsed ? (
                          <span className="dash__nav-dot" aria-label={`لديك ${offersBadge} عروض جديدة`} />
                        ) : (
                          <span className="dash__nav-badge" aria-label={`لديك ${offersBadge} عروض جديدة`}>
                            {offersBadge}
                          </span>
                        )
                      )}
                    </button>
                    {reqOpen && !collapsed && (
                      <div className="dash__nav-sub">
                        <button
                          type="button"
                          className={requestsView === 'list' ? 'is-active' : ''}
                          onClick={() => {
                            if (onRequestsViewChange) onRequestsViewChange('list');
                            handleNavClick(tab.id);
                          }}
                          aria-current={active === tab.id && requestsView === 'list' ? 'page' : undefined}
                        >
                          <List />
                          <span>طلباتي</span>
                        </button>
                        <button
                          type="button"
                          className={requestsView === 'create' ? 'is-active' : ''}
                          onClick={() => {
                            if (onRequestsViewChange) onRequestsViewChange('create');
                            handleNavClick(tab.id);
                          }}
                          aria-current={active === tab.id && requestsView === 'create' ? 'page' : undefined}
                        >
                          <Plus />
                          <span>إنشاء طلب</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
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
                  {tab.id === 'requests' && offersBadge > 0 && (
                    collapsed ? (
                      <span className="dash__nav-dot" aria-label={`لديك ${offersBadge} عروض جديدة`} />
                    ) : (
                      <span className="dash__nav-badge" aria-label={`لديك ${offersBadge} عروض جديدة`}>
                        {offersBadge}
                      </span>
                    )
                  )}
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
          <header className={`dash__top${hiddenTop ? ' is-hidden' : ''}`} data-tour="customer-header">
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
              <h1>{displayTabs.find((t) => t.id === active)?.label || 'لوحة التحكم'}</h1>
              <p>{today}</p>
            </div>

            <button
              type="button"
              className="dash__tour-btn"
              onClick={onStartTour}
              aria-label="عرض جولة تعريفية للوحة التحكم"
              title="جولة تعريفية"
              data-tour="customer-tour-replay"
            >
              <HelpCircle />
            </button>

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
                        onClick={handleMarkAllRead}
                        disabled={notifLoading || notifications.length === 0}
                      >
                        قراءة الكل
                      </button>
                    </div>
                    {notifLoading ? (
                      <p className="dash__notif-empty">جارٍ تحميل الإشعارات…</p>
                    ) : notifications.length === 0 ? (
                      <p className="dash__notif-empty">لا توجد إشعارات حالياً.</p>
                    ) : (
                      <ul className="dash__notif-list">
                        {notifications.map((n) => {
                          const Icon = n.icon;
                          return (
                            <li
                              key={n.id}
                              className={`dash__notif-item${n.read ? '' : ' is-unread'}`}
                              onClick={() => handleMarkOneRead(n.id)}
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
                    )}
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
