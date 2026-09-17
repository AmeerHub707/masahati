import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { logout, deleteUser, updateProfile, updateProfilePicture, uploadPicture, getUser, setUser } from '../lib/authStore';
import { fetchDashboard, readDashboardCache, clearDashboardCache, writeDashboardCache, cancelBooking, toggleFavorite } from '../lib/dashboard';
import { extractPicturePath, resolveNewPictureUrl, getCachedPictureUrl } from '../lib/profilePicture';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import DashboardLoading from '../components/dashboard/DashboardLoading';
import Overview from '../components/dashboard/Overview';
import Bookings from '../components/dashboard/Bookings';
import Favorites from '../components/dashboard/Favorites';
import Settings from '../components/dashboard/Settings';
import ScrollProgress from '../components/common/ScrollProgress';
import Footer from '../components/layout/Footer';
import WhatsAppBubble from '../components/common/WhatsAppBubble';
import AdBanner from '../components/dashboard/AdBanner';
import { AlertCircle, Trash2 } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState('overview');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [cancellingId, setCancellingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
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

    // نسخة مخزنة: نعرضها فوراً (بدون شاشة تحميل) عبر مؤقّت لتجنب setState متزامن في الـ effect.
    const cached = readDashboardCache();
    let showCacheTimer = 0;
    if (cached) {
      showCacheTimer = setTimeout(() => {
        if (!isMounted) return;
        setData(cached);
        setStatus('ready');
      }, 0);
    }

    // تحديث الخلفية: جلب جديد يُستبدل البيانات عند وصوله، ولا يعيد شاشة التحميل.
    (async () => {
      try {
        const result = await fetchDashboard();
        if (!isMounted) return;
        setData(result);
        setStatus('ready');
      } catch {
        // فشل الجلب: نبقي البيانات المخزنة إن وُجدت، وإلا نعرض الخطأ.
        if (isMounted) {
          setStatus((prev) => (prev === 'loading' ? 'error' : prev));
        }
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(showCacheTimer);
    };
  }, []);

  // مزامنة النسخة المخزنة مع أي تغيير محلي (الاسم/الهاتف/البريد/الصورة/الإلغاء/المفضّلة)
  // حتى لا يعود المستخدم للوحة ويجد بيانات قديمة من الكاش.
  useEffect(() => {
    if (!data) return;
    writeDashboardCache(data);
  }, [data]);

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

  const handleToggleFavorite = async (id, name) => {
    setTogglingId(id);
    // إزالة تفاؤلية فورية ثم التراجع عند فشل الخادم فقط.
    setData((prev) => ({
      ...prev,
      favorites: (prev.favorites || []).filter((f) => f.id !== id),
      stats: {
        ...prev.stats,
        savedFavorites: Math.max(0, (prev.stats.savedFavorites || 1) - 1),
      },
    }));
    try {
      await toggleFavorite(id);
    } catch {
      // فشل الخادم: نعيد المساحة إلى القائمة كما كانت.
      setData((prev) => {
        const exists = (prev.favorites || []).some((f) => f.id === id);
        if (exists) return prev;
        return {
          ...prev,
          favorites: [...(prev.favorites || []), { id, name }],
          stats: {
            ...prev.stats,
            savedFavorites: (prev.stats.savedFavorites || 0) + 1,
          },
        };
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleLogout = useCallback(async () => {
    clearDashboardCache();
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
      clearDashboardCache();
      logout();
    }
    navigate('/');
  }, [navigate, requestDeleteConfirm]);

  const applyUserPatch = useCallback((patch) => {
    setData((prev) => (prev ? { ...prev, user: { ...prev.user, ...patch } } : prev));
  }, []);

  const handleSaveProfile = useCallback(async (fields) => {
    await updateProfile(fields);
    const patch = {
      name: fields.full_name,
      phone: fields.phone,
      email: fields.email,
    };
    applyUserPatch(patch);
    // حفظ التعديلات محلياً لضمان بقائها حتى فشل الاتصال بالخادم.
    try {
      const stored = getUser() || {};
      setUser({ ...stored, ...patch });
    } catch { /* */ }
  }, [applyUserPatch]);

  const handleUploadPicture = useCallback(async (file) => {
    // إصلاح الملف الشخصي: إن وُجدت صورة قائمة نستبدلها عبر PATCH /api/profile/picture،
    // وإلا نرفع الصورة لأول مرة عبر POST /api/uploadPicture (وفق /api.txt).
    const hasPhoto = Boolean(data?.user?.photo || getCachedPictureUrl());
    const res = hasPhoto ? await updateProfilePicture(file) : await uploadPicture(file);
    // استخراج مسار الصورة من أي صيغة استجابة، ثم ربطه بالنسخة (t=) وحفظه.
    const rawPath = extractPicturePath(res);
    if (!rawPath) return null;
    const picture = resolveNewPictureUrl(rawPath);
    if (picture) {
      // تحديث الحالة فوراً كي تظهر الصورة الجديدة في كل مكان (شريط/نظرة عامة/إعدادات).
      applyUserPatch({ photo: picture });
      try {
        const stored = getUser() || {};
        setUser({ ...stored, photo: picture });
      } catch {
        /* storage not available */
      }
    }
    return picture;
  }, [data?.user?.photo, applyUserPatch]);

  let tabContent;
  if (status === 'loading') {
    tabContent = null;
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
        <Favorites data={{ ...(data || {}), togglingId }} onToggleFavorite={handleToggleFavorite} />
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
      <DashboardLoading done={status !== 'loading'} />
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
        <AnimatePresence mode="wait" initial={false}>
          {tabContent ? (
            <motion.div
              key={active}
              className="dash__tab"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {tabContent}
            </motion.div>
          ) : null}
        </AnimatePresence>
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
    </div>
  );
}
