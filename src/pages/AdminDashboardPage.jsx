import { Component, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import AdminLayout from '../components/admin/AdminLayout';
import AdminOverview from '../components/admin/AdminOverview';
import AdminUsers from '../components/admin/AdminUsers';
import AdminSpaces from '../components/admin/AdminSpaces';
import AdminBookings from '../components/admin/AdminBookings';
import AdminReviews from '../components/admin/AdminReviews';
import AdminFinancials from '../components/admin/AdminFinancials';
import InboxNotifications from '../components/admin/InboxNotifications';
import BroadcastNotifications from '../components/admin/BroadcastNotifications';
import AdminSettings from '../components/admin/AdminSettings';
import DashboardLoading from '../components/dashboard/DashboardLoading';
import ScrollProgress from '../components/common/ScrollProgress';
import { isAdminLoggedIn, adminLogout } from '../lib/adminAuth';
import { ADMIN_TABS } from '../data/adminTabs';
import { adminInbox } from '../data/adminMockData';

const TAB_COMPONENTS = {
  overview: AdminOverview,
  users: AdminUsers,
  spaces: AdminSpaces,
  bookings: AdminBookings,
  reviews: AdminReviews,
  financials: AdminFinancials,
  settings: AdminSettings,
};

// خريطة المسار → معرف التبويب (المستخدمة لاستنتاج التبويب النشط من URL).
const PATH_TO_TAB = Object.fromEntries(ADMIN_TABS.map((t) => [t.path, t.id]));
const NOTIF_PATH_TO_SUB = {
  '/admin/notifications/inbox': 'inbox',
  '/admin/notifications/broadcast': 'broadcast',
};
const DEFAULT_PATH = '/admin';
const DEFAULT_NOTIF_PATH = '/admin/notifications/inbox';

// يلتقط أخطاء العرض داخل تبويب واحد بدل تصفير اللوحة كاملة.
class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="dash__card p-6 text-center" role="alert">
        <span className="st-ico st-ico--red mx-auto">
          <AlertTriangle />
        </span>
        <h2 className="mt-3 text-lg font-extrabold" style={{ color: 'var(--text-strong)' }}>
          تعذّر عرض هذا التبويب
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {this.state.error?.message || 'حدث خطأ غير متوقع.'}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={() => this.setState({ error: null })}>
            إعادة المحاولة
          </button>
          <button type="button" className="btn-ghost" onClick={() => this.props.onNavigate?.('overview')}>
            العودة لنظرة عامة
          </button>
        </div>
      </div>
    );
  }
}

export default function AdminDashboardPage() {
  const [status, setStatus] = useState('loading');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [inbox, setInbox] = useState(adminInbox);

  useEffect(() => {
    const t = setTimeout(() => setStatus('ready'), 1500);
    return () => clearTimeout(t);
  }, []);

  // التنقّل داخل لوحة المشرف عبر عناوين URL (تبويب ← مساره).
  const goTab = (id) => {
    const tab = ADMIN_TABS.find((t) => t.id === id);
    navigate(tab?.path || DEFAULT_PATH);
  };

  if (!isAdminLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  // تطبيع المسار (شرطة مائلة زائدة) ثم اشتقاق التبويب النشط.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') || DEFAULT_PATH : pathname;
  const notifSub = NOTIF_PATH_TO_SUB[path] || null;

  // المسارات غير المعروفة تُوجَّه للوجهة الصحيحة بدل عرض تبويب خاطئ تحت رابط خاطئ.
  if (path.startsWith('/admin/notifications')) {
    if (!notifSub) return <Navigate to={DEFAULT_NOTIF_PATH} replace />;
  } else if (!PATH_TO_TAB[path]) {
    return <Navigate to={DEFAULT_PATH} replace />;
  }

  // تنظيف العنوان من الشرطة المائلة الزائدة حتى لا يبقى الرابط على شكل غير معياري.
  if (path !== pathname) return <Navigate to={path} replace />;

  const activeTab = notifSub ? 'notifications' : PATH_TO_TAB[path];

  const handleLogout = () => {
    adminLogout();
    navigate('/login', { replace: true });
  };

  // الإشعارات غير المقروءة = غير المقروءة وغير المؤرشفة فقط (ما يطابق صندوق الوارد).
  const unreadCount = inbox.filter((n) => !n.read && !n.archived).length;

  return (
    <div className="min-h-screen font-['Cairo'] text-zinc-900 dir-rtl">
      <DashboardLoading done={status !== 'loading'} />
      <ScrollProgress />
      <AdminLayout active={activeTab} notifSub={notifSub} unreadCount={unreadCount} onNavigate={goTab} onLogout={handleLogout}>
        <TabErrorBoundary onNavigate={goTab}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab + (notifSub ? `:${notifSub}` : '')}
              className="dash__tab"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {activeTab === 'notifications' ? (
                notifSub === 'broadcast' ? (
                  <BroadcastNotifications />
                ) : (
                  <InboxNotifications inbox={inbox} setInbox={setInbox} onNavigate={goTab} />
                )
              ) : (
                (() => {
                  const ActiveComponent = TAB_COMPONENTS[activeTab] || AdminOverview;
                  return <ActiveComponent onNavigate={goTab} />;
                })()
              )}
            </motion.div>
          </AnimatePresence>
        </TabErrorBoundary>
      </AdminLayout>
    </div>
  );
}