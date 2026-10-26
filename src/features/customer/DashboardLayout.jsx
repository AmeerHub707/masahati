import { useState, useRef, useEffect, useLayoutEffect, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Home, CalendarCheck, Heart, Settings, LogOut, MapPin, Menu, X, Bell, Check, Clock, FileText, Megaphone, ChevronLeft, ChevronRight, Lock, Sparkles, HelpCircle, Scale, RefreshCw } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getCachedPictureUrl } from '@/lib/profilePicture';
import { loadNotificationsWithFallback, markAllNotificationsReadWithFallback } from '@/lib/notifications';

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
  broadcast: Megaphone,
  admin: Megaphone,
  system: Megaphone,
};

// تزيين صفوف الخادم: أيقونة، ودمج حالة «مقروء» المحلية (لا يوجد في الباك إند
// مسار لتعليم إشعار واحد كمقروء، فبدون هذا الدمج يعود الإشعار غير مقروء بعد
// كل تحديث من الخادم).
function decorateNotifications(list, readIds) {
  return (Array.isArray(list) ? list : []).map((n, index) => ({
    ...n,
    renderKey: n.id ?? `notif-${index}`,
    icon: NOTIF_ICONS[n.icon] || Bell,
    read: Boolean(n.read) || (n.id !== null && n.id !== undefined && readIds.has(String(n.id))),
  }));
}

const READ_STORE_PREFIX = 'masahati_notif_read_';
const READ_STORE_LIMIT = 500;

function readStoreKey(user) {
  return `${READ_STORE_PREFIX}${user?.id ?? 'anon'}`;
}

function loadReadIds(user) {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(readStoreKey(user));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(user, ids) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(readStoreKey(user), JSON.stringify(Array.from(ids).slice(-READ_STORE_LIMIT)));
  } catch {
    /* التخزين المحلي قد يكون معطّلاً — العلامة تبقى في الجلسة فقط */
  }
}

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: Home },
  { id: 'bookings', label: 'حجوزاتي', icon: CalendarCheck },
  { id: 'favorites', label: 'المساحات المفضلة', icon: Heart },
  { id: 'requests', label: 'الطلبات الخاصة', icon: Megaphone },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

// رابط لا تبويب: «قارن المساحات» صفحة مستقلة داخل التطبيق، لذا تُفتح بمسار
// مستقل بدل تبديل محتوى اللوحة (والرجوع منها يعود إلى المساحة نفسها عبر السجل).
const EXTERNAL_LINKS = [
  { id: 'compare', label: 'قارن المساحات', to: '/compare', icon: Scale },
];

export default function DashboardLayout({
  active,
  onNavigate,
  onLogout,
  user,
  offersBadge,
  children,
  tourStep = 0,
  onStartTour,
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [failedSrc, setFailedSrc] = useState('');
  const [tips, setTips] = useState({ show: false, top: 0, left: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, maxHeight: null });
  const navigate = useNavigate();
  const [hiddenTop, setHiddenTop] = useState(false);
  const lastScrollY = useRef(0);

  // "الطلبات الخاصة" متاحة للطلاب فقط (تظهر المتاجر عروضاً عبر واجهة مالك).
  const displayTabs = TABS.filter((t) => t.id !== 'requests' || user?.role !== 'owner');

  // مصدر الصورة الحالي — إذا غيّره المستخدم برفع صورة جديدة يعاد عرضها تلقائياً
  // حتى لو كان المصدر السابق قد فشل في التحميل (بدل التعليق على الحروف الأولى).
  const photoSrc = user?.photo || getCachedPictureUrl() || '';

  // لا صفّ «جارٍ التحميل» داخل القائمة: كان يُحتسب إشعاراً غير مقروء فيظهر
  // شعار «1» على الجرس قبل وصول أي إشعار حقيقي.
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState('');
  // معرّفات عُلمت كمقروءة محلياً (لا يوجد مسار في الباك إند لإشعار واحد).
  // محفوظة في localStorage لكل مستخدم حتى لا تعود «غير مقروءة» بعد إعادة تحميل.
  const readIdsRef = useRef(null);
  if (readIdsRef.current === null) readIdsRef.current = loadReadIds(user);

  const loadNotifs = useCallback(async () => {
    setNotifLoading(true);
    setNotifError('');
    try {
      const result = await loadNotificationsWithFallback();
      setNotifications(decorateNotifications(result.notifications, readIdsRef.current));
      setNotifError(result.error ?? '');
    } catch {
      setNotifications([]);
      setNotifError('تعذّر تحميل الإشعارات.');
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await loadNotificationsWithFallback();
        if (cancelled) return;
        setNotifications(decorateNotifications(result.notifications, readIdsRef.current));
        setNotifError(result.error ?? '');
      } catch {
        if (cancelled) return;
        setNotifications([]);
        setNotifError('تعذّر تحميل الإشعارات.');
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const applyLocalMarkRead = () => {
    notifications.forEach((n) => {
      if (n.id !== null && n.id !== undefined) readIdsRef.current.add(String(n.id));
    });
    saveReadIds(user, readIdsRef.current);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // عند فتح جرس الإشعارات نُحدّث من الخادم بهدوء: البث الإداري لا يصل كدفعة
  // حيّة (لا WebSocket)، والقائمة كانت تُقرأ مرة واحدة عند تحميل اللوحة فقط،
  // فيرى العميل قائمة قديمة ولا يظهر إشعار أُرسل بعد فتح الصفحة.
  const refreshNotifs = useCallback(async () => {
    const result = await loadNotificationsWithFallback();
    setNotifications(decorateNotifications(result.notifications, readIdsRef.current));
    setNotifError(result.error ?? '');
  }, []);

  // تحديث دوري هادئ كل دقيقة (وعند العودة إلى التبويب) حتى يظهر البث الجديد
  // دون الحاجة إلى إغلاق اللوحة وفتحها من جديد.
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refreshNotifs();
    };
    const timer = window.setInterval(refreshIfVisible, 60_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [refreshNotifs]);

  const toggleNotifs = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) refreshNotifs();
  };

  const handleMarkAllRead = async () => {
    applyLocalMarkRead();
    try {
      await markAllNotificationsReadWithFallback();
    } catch {
      /* الفشل لا يمنع العلامة المحلية الموضعية */
    }
  };

  const handleMarkOneRead = (id) => {
    if (id !== null && id !== undefined) {
      readIdsRef.current.add(String(id));
      saveReadIds(user, readIdsRef.current);
    }
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  };

  // إن حمل الإشعار رابطاً (البث الإداري يقبل `link`) نفتحه: الداخلي عبر
  // الراوتر، والخارجي في تبويب جديد.
  const activateNotif = (n) => {
    handleMarkOneRead(n.id);
    const link = String(n.link || '').trim();
    if (!link) return;
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    if (link.startsWith('/')) {
      setNotifOpen(false);
      navigate(link);
    }
  };

  // لوحة الإشعارات تُرسم في portal على `document.body`، أي خارج `notifRef`.
  // فحص `notifRef` وحده كان يجعل أي نقرة داخل اللوحة (قراءة الكل، إعادة
  // المحاولة، إشعار) تُغلقها فوراً.
  useEffect(() => {
    const handleClickOutside = (e) => {
      const inButton = notifRef.current && notifRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inButton && !inPanel) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // إغلاق اللوحة بمفتاح Escape وإعادة التركيز إلى الجرس.
  useEffect(() => {
    if (!notifOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notifOpen]);

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

  // تثبيت اللوحة بجوار الجرس مع منع خروجها عن الشاشة: تُقلب فوق الزر عند
  // ضيق المساحة أسفله، ويُقصّ ارتفاعها بحيث تبقى القائمة قابلة للتمرير.
  useLayoutEffect(() => {
    if (!notifOpen || !btnRef.current) return undefined;
    const MARGIN = 8;
    const update = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const panel = panelRef.current;
      const width = panel?.offsetWidth || Math.min(352, window.innerWidth - MARGIN * 2);
      const height = panel?.offsetHeight || 0;
      let left = Math.min(r.left, window.innerWidth - width - MARGIN);
      left = Math.max(MARGIN, left);
      let top = r.bottom + 6;
      if (height && top + height > window.innerHeight - MARGIN) {
        const above = r.top - height - 6;
        top = above >= MARGIN ? above : Math.max(MARGIN, window.innerHeight - height - MARGIN);
      }
      const maxHeight = Math.max(160, window.innerHeight - top - MARGIN);
      setPanelPos((prev) =>
        prev.top === top && prev.left === left && prev.maxHeight === maxHeight
          ? prev
          : { top, left, maxHeight }
      );
    };
    update();
    const frame = requestAnimationFrame(update);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
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

  const unreadCount = notifications.reduce((sum, n) => sum + (n.read ? 0 : 1), 0);

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
              return (
                <Fragment key={tab.id}>
                  <button
                    type="button"
                    className={active === tab.id ? 'is-active' : ''}
                    onClick={() => handleNavClick(tab.id)}
                    aria-current={active === tab.id ? 'page' : undefined}
                    title={collapsed ? tab.label : undefined}
                  >
                    <Icon />
                    {!collapsed && <span className="dash__nav-label">{tab.label}</span>}
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

                  {/* روابط مستقلة (مقارنة المساحات) تُدرج في مكانها بين التبويبات */}
                  {tab.id === 'favorites' && EXTERNAL_LINKS.map((l) => {
                    const LinkIcon = l.icon;
                    return (
                      <Link
                        key={l.id}
                        to={l.to}
                        className="dash__nav-link"
                        onClick={close}
                        title={collapsed ? l.label : undefined}
                      >
                        <LinkIcon />
                        {!collapsed && <span className="dash__nav-label">{l.label}</span>}
                      </Link>
                    );
                  })}
                </Fragment>
              );
            })}

            <Link to="/spaces" className="dash__nav-link" onClick={close} title={collapsed ? 'تصفح المساحات' : undefined}>
              <MapPin />
              {!collapsed && <span className="dash__nav-label">تصفح المساحات</span>}
            </Link>

            <button type="button" data-tour="customer-tour-replay" onClick={() => { onStartTour(); close(); }} title={collapsed ? 'جولة تعريفية' : undefined}>
              <HelpCircle />
              {!collapsed && <span className="dash__nav-label">جولة تعريفية</span>}
            </button>

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

            <span className="dash__top-spacer" aria-hidden="true" />

            <ThemeToggle />

            <div className="dash__notif-wrap" ref={notifRef}>
              <button
                type="button"
                ref={btnRef}
                className={`dash__notif-btn${notifOpen ? ' is-open' : ''}`}
                onClick={toggleNotifs}
                aria-label={unreadCount ? `الإشعارات (${unreadCount} غير مقروءة)` : 'الإشعارات'}
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
              >
                <Bell />
                {unreadCount > 0 && (
                  <span className="dash__notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>

              {createPortal(
                notifOpen && (
                  <div
                    ref={panelRef}
                    className="dash__notif-panel"
                    id="dash-notif-panel"
                    role="dialog"
                    aria-label="الإشعارات"
                    style={{
                      position: 'fixed',
                      top: panelPos.top,
                      left: panelPos.left,
                      ...(panelPos.maxHeight ? { maxHeight: panelPos.maxHeight } : {}),
                    }}
                  >
                    <div className="dash__notif-header">
                      <h3>الإشعارات{unreadCount > 0 ? ` (${unreadCount})` : ''}</h3>
                      <div className="dash__notif-actions">
                        <button
                          type="button"
                          className="dash__notif-mark dash__notif-refresh"
                          onClick={refreshNotifs}
                          disabled={notifLoading}
                          aria-label="تحديث الإشعارات"
                          title="تحديث"
                        >
                          <RefreshCw />
                        </button>
                        <button
                          type="button"
                          className="dash__notif-mark"
                          onClick={handleMarkAllRead}
                          disabled={notifLoading || unreadCount === 0}
                        >
                          قراءة الكل
                        </button>
                      </div>
                    </div>
                    {notifError && notifications.length > 0 && (
                      <p className="dash__notif-inline-error">{notifError}</p>
                    )}
                    {notifLoading ? (
                      <p className="dash__notif-empty">جارٍ تحميل الإشعارات…</p>
                    ) : notifError && notifications.length === 0 ? (
                      <div className="dash__notif-empty">
                        <p>{notifError}</p>
                        <button type="button" className="btn-ghost dash__notif-retry" onClick={loadNotifs}>
                          إعادة المحاولة
                        </button>
                      </div>
                    ) : notifications.length === 0 ? (
                      <p className="dash__notif-empty">لا توجد إشعارات حالياً.</p>
                    ) : (
                      <ul className="dash__notif-list">
                        {notifications.map((n) => {
                          const Icon = n.icon;
                          const hasLink = Boolean(n.link);
                          return (
                            <li
                              key={n.renderKey}
                              className={`dash__notif-item${n.read ? '' : ' is-unread'}${hasLink ? ' is-link' : ''}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => activateNotif(n)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  activateNotif(n);
                                }
                              }}
                            >
                              <span className="dash__notif-icon">
                                <Icon />
                              </span>
                              <div className="dash__notif-body">
                                <p>
                                  {n.title && n.title !== n.text ? (
                                    <>
                                      <strong>{n.title}</strong>
                                      <br />
                                      {n.text}
                                    </>
                                  ) : (
                                    n.text
                                  )}
                                </p>
                                {n.time ? <span className="dash__notif-time">{n.time}</span> : null}
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
          </header>

          <main className="dash__content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
