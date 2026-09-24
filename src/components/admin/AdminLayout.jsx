import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { getAdminProfile } from '../../lib/adminAuth';
import { ADMIN_TABS, ADMIN_NOTIF_TABS } from '../../data/adminTabs';
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

export default function AdminLayout({ active, notifSub = null, unreadCount = 0, onNavigate, onLogout, children }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // تفتح القائمة الفرعية تلقائياً عند فتح الصفحة على تبويب الإشعارات (رفش مباشر/إشارة).
  const [notifOpen, setNotifOpen] = useState(() => active === 'notifications');
  const [tips, setTips] = useState({ show: false, top: 0, left: 0 });
  const navigate = useNavigate();
  const { gregorian, hijri } = useDates();
  const profile = getAdminProfile();

  const close = () => setOpen(false);

  const activeLabel = ADMIN_TABS.find((t) => t.id === active)?.label || 'لوحة تحكم المشرف';

  const toggleGroup = () => {
    if (collapsed) {
      setCollapsed(false);
      return;
    }
    setNotifOpen((o) => !o);
  };

  const navigateTo = (id) => {
    onNavigate(id);
    close();
  };

  const goNotif = (path) => {
    navigate(path);
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
              if (tab.group) {
                const subActive = active === 'notifications' && notifSub;
                return (
                  <div key={tab.id} className={`dash__nav-group${notifOpen ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className={`dash__nav-group-btn${active === tab.id ? ' is-active' : ''}`}
                      onClick={toggleGroup}
                      aria-expanded={notifOpen}
                      aria-current={active === tab.id ? 'page' : undefined}
                      title={collapsed ? tab.label : undefined}
                    >
                      <Icon />
                      {!collapsed && <span>{tab.label}</span>}
                      {!collapsed && <ChevronDown className="dash__nav-chevron" />}
                    </button>
                    {!collapsed && notifOpen && (
                      <div className="dash__nav-sub" role="group" aria-label={tab.label}>
                        {ADMIN_NOTIF_TABS.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = subActive === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              className={isSubActive ? 'is-active' : ''}
                              onClick={() => goNotif(sub.path)}
                              aria-current={isSubActive ? 'page' : undefined}
                            >
                              <SubIcon />
                              <span>{sub.label}</span>
                              {sub.id === 'inbox' && unreadCount > 0 && (
                                <span className="dash__nav-badge" title={`${unreadCount} غير مقروء`}>
                                  {unreadCount}
                                </span>
                              )}
                            </button>
                          );
                        })}
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

          {/* أدوات التحكم في الشريط الجانبي */}
          <div className="mt-auto border-t border-gray-100/60 px-2 pb-2 pt-3 dark:border-[var(--border)]">
            <div className="flex items-center justify-between gap-2">
              <ThemeToggle />
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                {activeLabel}
              </span>
            </div>
          </div>
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
              aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </button>

            <div className="dash__title">
              <h1>{activeLabel}</h1>
              <p>{gregorian} · {hijri}</p>
            </div>
          </header>

          <main className="dash__content pt-6">{children}</main>
        </div>
      </div>
    </div>
  );
}