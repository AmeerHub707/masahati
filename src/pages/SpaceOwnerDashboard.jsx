import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { logout, deleteUser, updateProfile, updateProfilePicture, uploadPicture, getUser, setUser } from '../lib/authStore';
import {
  loadOwnerDashboardWithFallback,
  readOwnerCache,
  writeOwnerCache,
  clearOwnerCache,
} from '../lib/owner';
import { extractPicturePath, resolveNewPictureUrl, getCachedPictureUrl } from '../lib/profilePicture';
import OwnerLayout from '../components/dashboard/owner/OwnerLayout';
import DashboardLoading from '../components/dashboard/DashboardLoading';
import OwnerOverview from '../components/dashboard/owner/OwnerOverview';
import Market from '../components/dashboard/owner/Market';
import MyOffers from '../components/dashboard/owner/MyOffers';
import Spaces from '../components/dashboard/owner/Spaces';
import Bookings from '../components/dashboard/owner/Bookings';
import Reports from '../components/dashboard/owner/Reports';
import Revenues from '../components/dashboard/owner/Revenues';
import Settings from '../components/dashboard/Settings';
import ScrollProgress from '../components/common/ScrollProgress';
import Footer from '../components/layout/Footer';
import WhatsAppBubble from '../components/common/WhatsAppBubble';
import { AlertCircle, Trash2 } from 'lucide-react';

export default function SpaceOwnerDashboard() {
  const navigate = useNavigate();
  const [active, setActive] = useState('overview');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteResolve = useRef(null);

  // حماية الدور: لوحة المالك خاصة بصاحب المساحة فقط.
  useEffect(() => {
    const role = getUser()?.role;
    if (role !== 'space_owner' && role !== 'owner') {
      navigate('/dashboard/customer', { replace: true });
    }
  }, [navigate]);

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

  // تحميل: نسخة فورية من الكاش ثم تحديث في الخلفية (نفس نمط لوحة العميل).
  useEffect(() => {
    let isMounted = true;

    const cached = readOwnerCache();
    let showCacheTimer = 0;
    if (cached?.data) {
      showCacheTimer = setTimeout(() => {
        if (!isMounted) return;
        setData(cached.data);
        setStatus('ready');
      }, 0);
    }

    (async () => {
      try {
        const result = await loadOwnerDashboardWithFallback();
        if (!isMounted) return;
        setData(result);
        setStatus('ready');
      } catch {
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

  // مزامنة الكاش مع أي تغيير محلي.
  useEffect(() => {
    if (!data) return;
    writeOwnerCache({ data });
  }, [data]);

  const handleLogout = useCallback(async () => {
    clearOwnerCache();
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
      clearOwnerCache();
      await logout();
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
    try {
      const stored = getUser() || {};
      setUser({ ...stored, ...patch });
    } catch { /* storage not available */ }
  }, [applyUserPatch]);

  const handleUploadPicture = useCallback(async (file) => {
    const hasPhoto = Boolean(data?.user?.photo || getCachedPictureUrl());
    const res = hasPhoto ? await updateProfilePicture(file) : await uploadPicture(file);
    const rawPath = extractPicturePath(res);
    if (!rawPath) return null;
    const picture = resolveNewPictureUrl(rawPath);
    if (picture) {
      applyUserPatch({ photo: picture });
      try {
        const stored = getUser() || {};
        setUser({ ...stored, photo: picture });
      } catch { /* storage not available */ }
    }
    return picture;
  }, [data?.user?.photo, applyUserPatch]);

  // تحديث الحالة بعد تقديم عرض أو مناوبات المساحات: نحدّث الحقول المتبدلة فقط.
  const handleProposalSubmitted = useCallback((offer) => {
    if (!offer) return;
    setData((prev) => (prev ? { ...prev, offers: [offer, ...(prev.offers || [])] } : prev));
  }, []);

  let tabContent;
  if (status === 'loading') {
    tabContent = null;
  } else if (status === 'error') {
    tabContent = (
      <div className="dash__state dash__state--error">
        <div className="st-svg"><AlertCircle /></div>
        <h3>تعذّر تحميل البيانات</h3>
        <p>تحقق من اتصالك ثم أعد المحاولة، أو جرّب بالضغط على زر الإنعاش.</p>
        <button type="button" className="btn-ghost" onClick={() => setStatus('loading')}>
          إعادة المحاولة
        </button>
      </div>
    );
  } else {
    tabContent = data &&
      (active === 'overview' ? (
        <OwnerOverview data={data} onNavigate={setActive} />
      ) : active === 'market' ? (
        <Market data={data} onProposalSubmitted={handleProposalSubmitted} />
      ) : active === 'offers' ? (
        <MyOffers data={data} />
      ) : active === 'bookings' ? (
        <Bookings data={data} />
      ) : active === 'my-spaces' ? (
        <Spaces data={data} />
      ) : active === 'spaces' ? (
        <Spaces data={data} autoOpen />
      ) : active === 'reports' ? (
        <Reports data={data} />
      ) : active === 'revenues' ? (
        <Revenues data={data} />
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
      <OwnerLayout
        active={active}
        onNavigate={setActive}
        onLogout={handleLogout}
        user={data?.user}
      >
        <AnimatePresence mode="wait" initial={false}>
          {tabContent ? (
            <motion.div
              key={active}
              className="odash__tab"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {tabContent}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </OwnerLayout>
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
              سيتم حذف جميع بياناتك ومساحاتك وعروضك من المنصة نهائياً.
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