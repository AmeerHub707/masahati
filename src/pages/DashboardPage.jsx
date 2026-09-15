<<<<<<< HEAD
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, deleteUser, updateProfile, updateProfilePicture } from '../lib/authStore';
import { fetchDashboard, cancelBooking } from '../lib/dashboard';
import DashboardLayout from './dashboard/DashboardLayout';
import Overview from './dashboard/Overview';
import Bookings from './dashboard/Bookings';
import Favorites from './dashboard/Favorites';
import Settings from './dashboard/Settings';
import ScrollProgress from '../components/common/ScrollProgress';
import Footer from '../components/layout/Footer';
import WhatsAppBubble from '../components/common/WhatsAppBubble';
import AdBanner from '../components/dashboard/AdBanner';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState('overview');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [cancellingId, setCancellingId] = useState(null);
  const [dismissedAds] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteResolve = useRef(null);

  const requestDeleteConfirm = useCallback(() => {
    return new Promise((resolve) => {
      deleteResolve.current = resolve;
      setDeleteOpen(true);
    });
  }, []);

  const closeDelete = (confirmed) => {
    setDeleteOpen(false);
    if (deleteResolve.current) {
      deleteResolve.current(confirmed);
      deleteResolve.current = null;
    }
  };

  const load = useCallback(async () => {
    try {
      const result = await fetchDashboard();
      setData(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const result = await fetchDashboard();
        if (!isMounted) return;
        setData(result);
        setStatus('ready');
      } catch {
        if (isMounted) setStatus('error');
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCancel = async (id) => {
    setCancellingId(id);
    try {
      await cancelBooking(id);
      setData((prev) => ({
        ...prev,
        bookings: (prev.bookings || []).map((b) =>
          b.id === id ? { ...b, status: 'cancelled' } : b
        ),
        stats: {
          ...prev.stats,
          upcomingBookings: Math.max(0, (prev.stats.upcomingBookings || 1) - 1),
        },
      }));
    } finally {
      setCancellingId(null);
    }
  };

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [navigate]);

  const handleDeleteAccount = useCallback(async () => {
    const confirmed = await requestDeleteConfirm();
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteUser();
    } finally {
      logout();
    }
    navigate('/');
  }, [navigate, requestDeleteConfirm]);

  const applyUserPatch = useCallback((patch) => {
    setData((prev) => (prev ? { ...prev, user: { ...prev.user, ...patch } } : prev));
  }, []);

  const handleSaveProfile = useCallback(async (fields) => {
    await updateProfile(fields);
    applyUserPatch({
      name: fields.full_name,
      phone: fields.phone,
      email: fields.email,
    });
  }, [applyUserPatch]);

  const handleUploadPicture = useCallback(async (file) => {
    const res = await updateProfilePicture(file);
    const nested = res?.data || res;
    const picture = nested?.profile_picture_url || nested?.picture || nested?.photo || nested?.url || null;
    applyUserPatch({ photo: picture });
    // Persist to localStorage for reliability (survives refreshes, API failures)
    if (picture) {
      try {
        localStorage.setItem('profile_picture_url', picture);
      } catch {
        /* storage not available */
      }
    }
    return picture;
  }, [applyUserPatch]);

  let tabContent;
  if (status === 'loading') {
    tabContent = (
      <div className="dash__state">
        <div className="st-svg"><Loader2 style={{ animation: 'ptr-spin .8s linear infinite' }} /></div>
        <h3>جارٍ تحميل لوحة التحكم…</h3>
      </div>
    );
  } else if (status === 'error') {
    tabContent = (
      <div className="dash__state dash__state--error">
        <div className="st-svg"><AlertCircle /></div>
        <h3>تعذّر تحميل البيانات</h3>
        <p>تحقق من اتصالك ثم أعد المحاولة، أو جرّب بالضغط على زر الإنعاش.</p>
        <button type="button" className="btn-ghost" onClick={() => load()}>
          إعادة المحاولة
        </button>
      </div>
    );
  } else {
    tabContent = data &&
      (active === 'overview' ? (
        <Overview data={data} />
      ) : active === 'bookings' ? (
        <Bookings data={data} onCancel={handleCancel} cancellingId={cancellingId} />
      ) : active === 'favorites' ? (
        <Favorites data={data} />
      ) : (
        <Settings
          user={data?.user}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          onSaveProfile={handleSaveProfile}
          onUploadPicture={handleUploadPicture}
        />
      ));
  }

  return (
    <div className="min-h-screen font-['Cairo'] text-zinc-900 dir-rtl">
      <ScrollProgress />
      <DashboardLayout
        active={active}
        onNavigate={setActive}
        onLogout={handleLogout}
        user={data?.user}
      >
        {data?.user?.role === 'customer' && (
          <AdBanner
            ads={data?.ads || []}
            dismissed={dismissedAds}
          />
        )}
        {tabContent}
      </DashboardLayout>
      <Footer />
      <WhatsAppBubble />

      {deleteOpen && (
        <div className="modal-overlay delete-confirm__overlay" onClick={() => closeDelete(false)}>
          <div
            className="modal-box delete-confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="تأكيد حذف الحساب"
          >
            <div className="delete-confirm__ico"><Trash2 /></div>
            <h3>حذف الحساب نهائياً؟</h3>
            <p>
              سيتم حذف جميع بياناتك ومساحاتك وحجوزاتك من المنصة نهائياً.
              هذا الإجراء لا يمكن التراجع عنه.
            </p>
            <div className="delete-confirm__actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => closeDelete(false)}
                disabled={deleting}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => closeDelete(true)}
                disabled={deleting}
              >
                {deleting ? 'جارٍ الحذف…' : 'نعم، احذف حسابي'}
              </button>
            </div>
          </div>
        </div>
      )}
=======
import { Link, useLocation, Navigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { getUser, getHomePath } from '../lib/authStore';

// صفحة لوحة التحكم (مؤقتة). لوحة التحكم الحقيقية تُبنى لاحقاً.
// الزائر غير المسجّل يُحوَّل إلى الصفحة الرئيسية (انظر حماية المسار في App.jsx).
export default function DashboardPage() {
  const user = getUser();
  const location = useLocation();

  // حماية: إن لم يكن المسار الحالي هو لوحة تحكم الدور الفعلي للمستخدم،
  // نُحوّله إلى لوحة تحكمه الصحيحة (الدور مصدره الباك إند ولا يُتجاهل).
  const expectedPath = getHomePath(user?.role);
  if (expectedPath !== '/dashboard' && location.pathname !== expectedPath) {
    return <Navigate to={expectedPath} replace />;
  }

  const roleLabel = user?.role === 'space_owner' ? 'صاحب مساحة' : user?.role === 'customer' ? 'عميل' : '';
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center p-5 bg-cover bg-center bg-no-repeat overflow-hidden font-['Cairo'] text-zinc-900 dir-rtl" style={{ backgroundImage: "url('/background.jpeg')" }}>
      <div className="fixed inset-0 bg-gradient-to-br from-black/55 to-black/35 -z-10" />

      <Navbar />

      <main className="relative w-full max-w-[40rem] my-auto rounded-3xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55),0_0_0_2px_rgba(249,115,22,0.22)] bg-zinc-100 border border-white/75 p-10 text-center">
        <img src="/Logo.png" alt="Masahati" className="h-12 mx-auto mb-5 object-contain drop-shadow-[0_6px_14px_rgba(249,115,22,0.30)]" />
        <h1 className="text-3xl font-bold mb-3 flex items-center justify-center gap-3 flex-wrap">
          <span>{user?.name ? `مرحباً، ${user.name}` : 'مرحباً بك في لوحة التحكم'}</span>
          {roleLabel && (
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-300">
              {roleLabel}
            </span>
          )}
        </h1>
        <p className="text-sm text-zinc-500 leading-relaxed mb-6">
          هذه صفحة لوحة تحكم مؤقتة. سيتم تجهيز لوحة التحكم الكاملة (حجوزاتك، مساحاتك، الإعدادات) لاحقاً.
        </p>
        <Link
          to="/"
          className="inline-block bg-orange-500 text-white font-medium text-base py-2.5 px-6 rounded-[0.625rem] hover:bg-orange-600 transition-colors"
        >
          العودة إلى الصفحة الرئيسية
        </Link>
      </main>
>>>>>>> c11d71720e3cc630cfeb274674899e596bf43fed
    </div>
  );
}
