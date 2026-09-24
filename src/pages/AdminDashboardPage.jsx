import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

export default function AdminDashboardPage() {
  const [status, setStatus] = useState('loading');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [inbox, setInbox] = useState(adminInbox);

  useEffect(() => {
    const t = setTimeout(() => setStatus('ready'), 1500);
    return () => clearTimeout(t);
  }, []);

  // إعادة توجيه تلقائية: /admin/notifications → /admin/notifications/inbox
  if (pathname === '/admin/notifications') {
    return <Navigate to="/admin/notifications/inbox" replace />;
  }

  if (!isAdminLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  const notifSub = pathname.startsWith('/admin/notifications/')
    ? pathname.endsWith('/broadcast')
      ? 'broadcast'
      : 'inbox'
    : null;
  const activeTab = notifSub ? 'notifications' : PATH_TO_TAB[pathname] || 'overview';

  const handleLogout = () => {
    adminLogout();
    navigate('/login', { replace: true });
  };

  // التنقّل داخل لوحة المشرف عبر عناوين URL (تبويب ← مساره).
  const goTab = (id) => {
    const tab = ADMIN_TABS.find((t) => t.id === id);
    navigate(tab?.path || '/admin');
  };

  const unreadCount = inbox.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen font-['Cairo'] text-zinc-900 dir-rtl">
      <DashboardLoading done={status !== 'loading'} />
      <ScrollProgress />
      <AdminLayout active={activeTab} notifSub={notifSub} unreadCount={unreadCount} onNavigate={goTab} onLogout={handleLogout}>
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
      </AdminLayout>
    </div>
  );
}