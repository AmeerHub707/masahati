import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { logout, deleteUser, updateProfile, updateProfilePicture, uploadPicture, getUser, setUser } from '@/lib/authStore';
import {
  loadOwnerDashboardWithFallback,
  readOwnerCache,
  writeOwnerCache,
  clearOwnerCache,
} from '@/lib/owner';
import { extractPicturePath, resolveNewPictureUrl, getCachedPictureUrl } from '@/lib/profilePicture';
import OwnerLayout from '@/features/owner/OwnerLayout';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import OwnerOverview from '@/features/owner/OwnerOverview';
import Reviews from '@/features/owner/Reviews';
import Market from '@/features/owner/Market';
import OwnerAds from '@/features/owner/OwnerAds';
import Spaces from '@/features/owner/Spaces';
import Bookings from '@/features/owner/Bookings';
import Financials from '@/features/owner/Financials';
import Settings from '@/components/dashboard/Settings';
import ScrollProgress from '@/components/ui/ScrollProgress';
import LogoutOverlay from '@/components/ui/LogoutOverlay';
import Footer from '@/components/layout/Footer';
import OwnerAssistant from '@/features/owner/OwnerAssistant';
import DashboardTour from '@/components/dashboard/DashboardTour';
import { hasCompletedDashboardTour, markDashboardTourCompleted } from '@/lib/dashboardTour';
import { AlertCircle, Trash2, Repeat } from 'lucide-react';
import { useDialogA11y } from '@/lib/dialogA11y';

const OWNER_TOUR_ID = 'owner-tour';

// حدّ أدنى لظهور شاشة تسجيل الخروج — يمنع وميض الشاشة كاملة على طلب سريع.
const MIN_LOGOUT_OVERLAY_MS = 700;

// خطوات جولة لوحة المالك — تُمرَّر إلى المحرّك المشترك مع بقية اللوحات.
const OWNER_TOUR_STEPS = [
  {
    id: 'header',
    target: 'owner-header',
    title: 'أهلاً بك في لوحة المالك',
    description: 'من هذا الشريط تصل إلى الإشعارات وتبديل الوضع الليلي، مع عنوان التبويب الحالي وتاريخ اليوم.',
  },
  {
    id: 'sidebar',
    target: 'owner-sidebar',
    title: 'التنقل بين تبويباتك',
    description: 'هنا تتنقل بين: نظرة عامة، مساحاتي، الحجوزات، المالية، السوق المفتوح، إعلاناتي، التقييمات، والإعدادات. وتجد بيانات ملفك الشخصي في الأعلى.',
  },
  {
    id: 'metrics',
    target: 'owner-metrics',
    title: 'مؤشرات الأداء',
    description: 'هذه البطاقات الأربع تلخّص أدائك: أرباح هذا الشهر، حجوزات هذا الشهر، نسبة الإشغال اليوم، وطلبات السوق.',
  },
  {
    id: 'quick-add',
    target: 'owner-quick-add',
    title: 'أضف مساحة جديدة',
    description: 'من هنا تضيف مساحة جديدة مع وثائق الإثبات. بعد الإرسال تراجعها الإدارة، وتظهر للعملاء بعد الاعتماد.',
    beforeStep: ({ onNavigate }) => onNavigate?.('my-spaces'),
  },
  {
    id: 'assistant',
    target: 'owner-assistant',
    title: 'مساعدك الذكي',
    description: 'اسأل عن مساحاتك وحجوزاتك وأرباحك واحصل على توصيات سريعة. وتتحكم في خصوصية البيانات من داخل المساعد نفسه.',
  },
];

export default function SpaceOwnerDashboard() {
  const navigate = useNavigate();
  const [active, setActive] = useState('overview');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loaderDone, setLoaderDone] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(1);
  const [loggingOut, setLoggingOut] = useState(false);
  const autoTourCheckedRef = useRef(false);
  const deleteResolve = useRef(null);
  const mountedRef = useRef(true);
  const logoutStartedRef = useRef(false);
  const deleteDialogRef = useDialogA11y({ open: deleteOpen, onClose: () => { if (!deleting) closeDelete(false); } });

  // حماية الدور: لوحة المالك خاصة بصاحب المساحة فقط.
  useEffect(() => {
    const role = getUser()?.role;
    if (role !== 'space_owner' && role !== 'owner') {
      navigate('/dashboard/customer', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
        setLoadError(result.error ?? '');
      } catch {
        if (isMounted) {
          setLoadError('تعذّر تحميل بيانات اللوحة.');
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
    // النقر المزدوج قبل وصول الحالة كان سيطلق الطلب مرتين.
    if (logoutStartedRef.current) return;
    logoutStartedRef.current = true;
    setLoggingOut(true);
    const startedAt = Date.now();
    clearOwnerCache();
    await logout();
    const remaining = MIN_LOGOUT_OVERLAY_MS - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    // replace: اللوحة logout-ged لا يجب أن تبقى في سجلّ الترجع.
    navigate('/', { replace: true });
  }, [navigate]);

  // إعادة المحاولة من شاشة الخطأ: تحميل قسري (تجاوز الكاش) يحدّث الصفحة فعلياً.
  const handleRetry = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await loadOwnerDashboardWithFallback(true);
      if (!mountedRef.current) return;
      setData(result);
      setStatus('ready');
      setLoadError(result.error ?? '');
    } catch {
      if (mountedRef.current) {
        setStatus('error');
        setLoadError('تعذّر تحميل بيانات اللوحة.');
      }
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    const confirmed = await requestDeleteConfirm();
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteUser();
    } catch {
      // فشل الحذف لا يترك المستخدم عالقاً: نكمّل تسجيل الخروج والعودة للرئيسية.
    } finally {
      clearOwnerCache();
      await logout();
    }
    if (mountedRef.current) setDeleting(false);
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

  // يوصل تغييرات المساحات (إضافة/تعديل/حذف/إيقاف) من تبويب «مساحاتي»
  // إلى بيانات اللوحة كاملة حتى تبقى كل التبويبات متزامنة بدون إعادة تحميل.
  const handleSpacesChange = useCallback((next) => {
    setData((prev) => (prev ? { ...prev, spaces: next } : prev));
  }, []);

  // يوصل قرار تأكيد/رفض الحجز (من تبويب الحجوزات) للوحة كاملة حتى تنعكس
  // التغييرات في النظرة العامة والإيرادات مباشرة.
  const handleBookingStatusChange = useCallback((bookingId, status) => {
    setData((prev) => {
      if (!prev || !Array.isArray(prev.bookings)) return prev;
      return {
        ...prev,
        bookings: prev.bookings.map((b) =>
          String(b.id) === String(bookingId) ? { ...b, status } : b
        ),
      };
    });
  }, []);

  // ----- جولة تعريفية للوحة المالك -----
  const tourOwnerId =
    data?.user?.id ?? data?.user?.user_id ?? getUser()?.id ?? getUser()?.user_id ?? null;

  // مرآة للتبويب النشط + التبويب الذي كانت عليه اللوحة قبل بدء الجولة،
  // حتى يعود إليه المستخدم عند إنهائها أو تخطيها.
  const activeRef = useRef(active);
  const tabBeforeTourRef = useRef('overview');
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const handleLoaderHidden = useCallback(() => setLoaderDone(true), []);

  const startTour = useCallback(() => {
    tabBeforeTourRef.current = activeRef.current;
    setActive('overview');
    setTourStep(1);
    setTourOpen(true);
  }, []);

  const stopTour = useCallback(() => {
    setTourOpen(false);
    setTourStep(1);
    setActive(tabBeforeTourRef.current);
  }, []);

  const handleTourFinish = useCallback(() => {
    markDashboardTourCompleted(OWNER_TOUR_ID, tourOwnerId);
    stopTour();
  }, [tourOwnerId, stopTour]);

  const handleTourDismiss = useCallback(() => {
    markDashboardTourCompleted(OWNER_TOUR_ID, tourOwnerId);
    stopTour();
  }, [tourOwnerId, stopTour]);

  // التشغيل التلقائي مرة واحدة فقط: بعد زوال شاشة التحميل ونجاح جلب البيانات،
  // وغياب علامة الإنجاز لهذا المالك. التخطي أو إنهاء الجولة يكتبان نفس العلامة.
  useEffect(() => {
    if (autoTourCheckedRef.current) return undefined;
    if (!loaderDone || status !== 'ready') return undefined;
    autoTourCheckedRef.current = true;
    if (hasCompletedDashboardTour(OWNER_TOUR_ID, tourOwnerId)) return undefined;
    tabBeforeTourRef.current = activeRef.current;
    const frame = requestAnimationFrame(() => {
      setActive('overview');
      setTourStep(1);
      setTourOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [loaderDone, status, tourOwnerId]);

  let tabContent;
  if (status === 'loading') {
    tabContent = null;
  } else if (status === 'error') {
    tabContent = (
      <div className="dash__state dash__state--error">
        <div className="st-svg"><AlertCircle /></div>
        <h3>تعذّر تحميل البيانات</h3>
        <p>تحقق من اتصالك ثم أعد المحاولة، أو جرّب بالضغط على زر الإنعاش.</p>
        <button type="button" className="btn-ghost" onClick={handleRetry}>
          إعادة المحاولة
        </button>
      </div>
    );
  } else {
    tabContent = data &&
      (active === 'overview' ? (
        <OwnerOverview data={data} onNavigate={setActive} onStatusChange={handleBookingStatusChange} />
      ) : active === 'market' ? (
        <Market data={data} onProposalSubmitted={handleProposalSubmitted} onNavigate={setActive} />
      ) : active === 'ads' ? (
        <OwnerAds />
      ) : active === 'reviews' ? (
        <Reviews data={data} onNavigate={setActive} />
      ) : active === 'bookings' ? (
        <Bookings data={data} onStatusChange={handleBookingStatusChange} />
      ) : active === 'financials' ? (
        <Financials data={data} />
      ) : active === 'my-spaces' ? (
        <Spaces data={data} onSpacesChange={handleSpacesChange} />
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
    <div className="odash__page-root" inert={loggingOut || undefined}>
      <DashboardLoading done={status !== 'loading'} onHidden={handleLoaderHidden} />
      <LogoutOverlay open={loggingOut} />
      <ScrollProgress />
<OwnerLayout
          active={active}
          onNavigate={setActive}
          onLogout={handleLogout}
          user={data?.user}
          tourStep={tourOpen ? tourStep : 0}
          onStartTour={startTour}
        >
          {loadError && status === 'ready' && (
            <div className="odash__banner is-error" role="alert">
              <span>{loadError}</span>
              <button type="button" className="odash__banner-btn" onClick={handleRetry}>
                <Repeat /> إعادة المحاولة
              </button>
            </div>
          )}
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
      <OwnerAssistant data={data} onNavigate={setActive} tourActive={tourOpen} />
      <DashboardTour
        open={tourOpen}
        step={tourStep}
        steps={OWNER_TOUR_STEPS}
        tourId={OWNER_TOUR_ID}
        onStepChange={setTourStep}
        onFinish={handleTourFinish}
        onDismiss={handleTourDismiss}
        onNavigate={setActive}
      />

      {deleteOpen && (
        <div className="modal-overlay delete-confirm__overlay" onClick={() => closeDelete(false)}>
          <div
            ref={deleteDialogRef}
            tabIndex={-1}
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