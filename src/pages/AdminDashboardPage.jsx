import { Component, Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import AdminLayout from '../components/admin/AdminLayout';
import DashboardLoading from '../components/dashboard/DashboardLoading';
import ScrollProgress from '../components/common/ScrollProgress';
import useAdminData from '../components/admin/useAdminData';
import { isAdminLoggedIn, adminLogout, isAdminApiLive } from '../lib/adminAuth';
import { ADMIN_TABS } from '../data/adminTabs';
import { listInbox, markAllInboxRead, updateInboxItem, bulkInbox, onSessionExpired } from '../lib/adminApi';
import { adaptInboxItem, adaptAll } from '../lib/adminAdapters';

// كل تبويب حزمة منفصلة: تُحمَّل التبويبات كلها معاً كان يجعل recharts (≈450kB
// من الحزمة الأولى) جزءاً من تحميل اللوحة الأولى، مع أن Financials وOverview
// وحدهما يستعملانه. التحميل الكسول يجعل فتح التبويب يبني ما يُعرض فقط، ويبقى
// التصيير داخل TabErrorBoundary فتنهار حزمة مفقودة إلى رسالة إعادة المحاولة
// بدل لوحة بيضاء.
const AdminOverview = lazy(() => import('../components/admin/AdminOverview'));
const AdminUsers = lazy(() => import('../components/admin/AdminUsers'));
const AdminSpaces = lazy(() => import('../components/admin/AdminSpaces'));
const AdminBookings = lazy(() => import('../components/admin/AdminBookings'));
const AdminReviews = lazy(() => import('../components/admin/AdminReviews'));
const AdminFinancials = lazy(() => import('../components/admin/AdminFinancials'));
const InboxNotifications = lazy(() => import('../components/admin/InboxNotifications'));
const BroadcastNotifications = lazy(() => import('../components/admin/BroadcastNotifications'));
const AdminSettings = lazy(() => import('../components/admin/AdminSettings'));

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
// بادئة المسار الفرعي لتبويب المستخدمين: /admin/users/:id (رابط مباشر لملف حساب).
const USERS_PATH = '/admin/users';

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

// بديل التحميل الكسول: هيكل بنفس ارتفاع المحتوى حتى لا تقفز الصفحة، وحركته
// pulse معطّلة وقت الطباعة (@media print) فلا تُطبع حالة التحميل.
function TabFallback() {
  return (
    <div className="dash__tab-loading" data-tab-loading role="status" aria-live="polite">
      <span className="dash__tab-loading-bar" />
      <span className="dash__tab-loading-bar is-short" />
      <span className="dash__tab-loading-bar" />
    </div>
  );
}

// مكان فارغ للحالة الأولى: لا إشعارات ⇒ لا عدّاد.
const NO_INBOX = [];

// نبضة صندوق الوارد: 30 ثانية، وهي نفس نبضة قائمة المستخدمين.
//
// **لماذا تنبض أصلاً:** إشعار «رفع مالك مساحة لمستند توثيقه» يُنشئه الخادم
// لحظة الرفع، والأدمن يكون أمام لوحة مفتوحة. بلا نبضة كان لا يظهر الإشعار
// إلا بإعادة تحميل الصفحة كاملة، فيقرأ الأدمن «لا يوجد طلب توثيق» وهو
// أمامه طلبٌ ينتظر. والنبضة صامتة (لا تُظهر حالة انتظار)، وتتوقف في التبويب
// المخفي وتبدأ من جديد فور ظهوره — انظر `useAdminData`.
const INBOX_POLL_MS = 30000;

export default function AdminDashboardPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // العقد §14.6: أزلنا المؤقت الصناعي (setTimeout 1500ms) الذي كان يتظاهر
  // بتحميل بيانات. الآن المصدر هو الطلب الحقيقي، وDashboardLoading ينتظر
  // توفّر المحتوى فعلاً بدل انتظار ثابت لا صلة له بحالة الشبكة.
  // صندوق الوارد يبني شارة «غير المقروء» في الشريط الجانبي، فنجلبه هنا مرة
  // واحدة للوحة كلها بدل كل إشعار في كل تبويب على حدة.
  const fetchInbox = useCallback(async () => {
    const { rows } = await listInbox({ view: 'inbox' });
    // المحوّل يوحّد مفردات الفئات (العقد: general/support/report/billing) على
    // مفردات اللوحة، ويشتقّ «منذ …» إن لم يرسل الخادم وقتاً جاهزاً.
    return adaptAll(rows, adaptInboxItem);
  }, []);

  const { data: inboxRaw, setData: setInbox, loading: inboxLoading } = useAdminData(
    fetchInbox,
    [],
    { pollMs: INBOX_POLL_MS },
  );

  // صندوق الوارد فارغ (بلا أرقام) حتى يصل أول ردّ، فيبقى عدّاد الشريط الجانبي
  // صفراً حقيقياً لا عدداً مخترَعاً.
  const inbox = inboxRaw ?? NO_INBOX;

  // إجراءات صندوق الوارد تُمرَّر للمكوّن ليحدّث محلياً ثم يرسل للخادم، فتبقى
  // المكوّنات (InboxNotifications) مجرّد عرض بلا معرفة بأ URLs.
  const inboxApi = useMemo(
    () => ({
      markAllRead: () => markAllInboxRead(),
      setRead: (id, read) => updateInboxItem(id, { read }),
      bulk: (ids, action) => bulkInbox(ids, action),
    }),
    []
  );

  // التنقّل داخل لوحة المشرف عبر عناوين URL (تبويب ← مساره).
  const goTab = (id) => {
    const tab = ADMIN_TABS.find((t) => t.id === id);
    navigate(tab?.path || DEFAULT_PATH);
  };

  // 401 حقيقي من أي تبويب ⇒ الجلسة انتهت: نخرج إلى صفحة الدخول فوراً.
  //
  // لماذا اشتراك صريح هنا بدل اكتشاف `isAdminLoggedIn() === false` أثناء
  // التصيير: المسح وحده لا يُعيد تصييراً. فإذا جاء 401 من معالج حدث (فتح قائمة،
  // تغيير حالة، تصدير) فلا شيء خلفه يستدعي تصييراً، فيبقى المستخدم أمام لوحة
  // صامتة لا تُجلب فيها بيانات ولا يعرف أن انتهت جلسته.
  //
  // موضعه قبل `isAdminLoggedIn()` لأنه خطّاف: الخروج المبكر أدناه كان يجعل
  // ترتيب الخطّافات يتغيّر بين تصيير وآخر.
  useEffect(() => onSessionExpired(() => navigate('/login', { replace: true })), [navigate]);

  if (!isAdminLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  // تطبيع المسار (شرطة مائلة زائدة) ثم اشتقاق التبويب النشط.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') || DEFAULT_PATH : pathname;
  const notifSub = NOTIF_PATH_TO_SUB[path] || null;

  // المسارات غير المعروفة تُوجَّه للوجهة الصحيحة بدل عرض تبويب خاطئ تحت رابط خاطئ.
  if (path.startsWith('/admin/notifications')) {
    if (!notifSub) return <Navigate to={DEFAULT_NOTIF_PATH} replace />;
  } else if (!PATH_TO_TAB[path] && !path.startsWith(`${USERS_PATH}/`)) {
    // /admin/users/:id مسار فرعي لتبويب المستخدمين (رابط مباشر لملف حساب)؛
    // تحقّق «hasPrefix» وحده لا يكفي، لالتقاط /admin/users-extra مثلاً.
    return <Navigate to={DEFAULT_PATH} replace />;
  }

  // تنظيف العنوان من الشرطة المائلة الزائدة حتى لا يبقى الرابط على شكل غير معياري.
  if (path !== pathname) return <Navigate to={path} replace />;

  // المسار الفرعي /admin/users/:id يقع تحت تبويب المستخدمين، فنُبقي التبويب
  // نشطاً حتى لا يختفي تمييزه البصري ولا ينهار التنقّل عند فتح رابط مباشر.
  const activeTab = notifSub ? 'notifications' : (PATH_TO_TAB[path] ?? (path.startsWith(`${USERS_PATH}/`) ? 'users' : null));

  const handleLogout = () => {
    adminLogout();
    navigate('/login', { replace: true });
  };

  // الإشعارات غير المقروءة = غير المقروءة وغير المؤرشفة فقط (ما يطابق صندوق الوارد).
  const unreadCount = inbox.filter((n) => !n.read && !n.archived).length;

  return (
    <div className="min-h-screen font-['Cairo'] text-zinc-900 dir-rtl">
      {/* طبقة التحميل تحتاج `done` صراحةً: بدونه لا تصل إلى حالة الاختفاء أبداً،
          فتبقى تغطي اللوحة وتُبقي no-scroll على الـ body — وهو سبب ظهور اللوحة
          «معلّقة». بعد إزالة المؤقت الصناعي صار المصدر هو حالة الجلب نفسها. */}
      <DashboardLoading done={!inboxLoading} />
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
              {/* شارة data-tab-loading هي ما ينتظره اختبار الدخان بعد بدء
                  التحميل الكسول: وجودها يعني أن الحزمة لم تصل بعد. */}
              <Suspense fallback={<TabFallback />}>
                {activeTab === 'notifications' ? (
                  notifSub === 'broadcast' ? (
                    <BroadcastNotifications />
                  ) : (
                    <InboxNotifications
                      inbox={inbox}
                      setInbox={setInbox}
                      api={isAdminApiLive() ? inboxApi : null}
                    />
                  )
                ) : (
                  (() => {
                    const ActiveComponent = TAB_COMPONENTS[activeTab] || AdminOverview;
                    return <ActiveComponent onNavigate={goTab} />;
                  })()
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </TabErrorBoundary>
      </AdminLayout>
    </div>
  );
}