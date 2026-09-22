import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import AdminLayout from '../components/admin/AdminLayout';
import AdminOverview from '../components/admin/AdminOverview';
import AdminUsers from '../components/admin/AdminUsers';
import AdminSpaces from '../components/admin/AdminSpaces';
import AdminBookings from '../components/admin/AdminBookings';
import AdminReviews from '../components/admin/AdminReviews';
import AdminFinancials from '../components/admin/AdminFinancials';
import AdminNotifications from '../components/admin/AdminNotifications';
import AdminSettings from '../components/admin/AdminSettings';
import DashboardLoading from '../components/dashboard/DashboardLoading';
import ScrollProgress from '../components/common/ScrollProgress';
import { isAdminLoggedIn, adminLogout } from '../lib/adminAuth';

const TAB_COMPONENTS = {
  overview: AdminOverview,
  users: AdminUsers,
  spaces: AdminSpaces,
  bookings: AdminBookings,
  reviews: AdminReviews,
  financials: AdminFinancials,
  notifications: AdminNotifications,
  settings: AdminSettings,
};

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [status, setStatus] = useState('loading');
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setStatus('ready'), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!isAdminLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab] || AdminOverview;

  const handleLogout = () => {
    adminLogout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen font-['Cairo'] text-zinc-900 dir-rtl">
      <DashboardLoading done={status !== 'loading'} />
      <ScrollProgress />
      <AdminLayout active={activeTab} onNavigate={setActiveTab} onLogout={handleLogout}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            className="dash__tab"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <ActiveComponent onNavigate={setActiveTab} />
          </motion.div>
        </AnimatePresence>
      </AdminLayout>
    </div>
  );
}