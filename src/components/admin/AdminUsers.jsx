import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  Clock,
  MoreVertical,
  Eye,
  Pencil,
  Ban,
  CheckCircle2,
  Trash2,
  Download,
  Check,
  RefreshCcw,
  Filter,
  FilterX,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
  Activity,
  FileText,
  ExternalLink,
} from 'lucide-react';
import {
  SectionCard,
  SectionHeading,
  StatusBadge,
  EmptyState,
  Modal,
  StatCard,
  DataSourceBanner,
  Toast,
  btnGhost,
  btnDanger,
  btnPrimary,
  Pill,
  Avatar,
  Tip,
  DataGate,
} from './ui';
import { useToast } from './useToast';
import useAdminData from './useAdminData';
import { downloadCsv } from '../../utils/csv';
import {
  listUsers,
  getUser,
  setUserStatus,
  updateUser,
  deleteUser,
  bulkUserStatus,
  isAdminTokenLive,
} from '../../lib/adminApi';
import { adaptUser, isOwnerRoleValue } from '../../lib/adminAdapters';
import { imageUrl } from '../../lib/api';
import { MENU_HEIGHT, MENU_WIDTH, placeFixed } from './menuPosition';

const PAGE_SIZE = 10;

// قائمة فارغة ثابتة تحفظ ثبات المرجع بين التصييرات: قبل أول رد من الخادم
// تكون البيانات فارغة (لا لست فارغة)، فلو أنشأناها في كل تصييرة لأعيد حساب
// التصفية والترقيم والعدّادات بلا داعٍ.
const NO_ROWS = [];

// أبعاد القائمة الفرعية (تغيير الحالة) مختلفة عن قائمة الصف، وتبقى هنا.
// عرض القائمة وارتفاعها و placeFixed يأتيان من menuPosition.js بالنسخة نفسها
// التي تستخدمها باقي اللوحة، حتى لا تتفرّق أبعاد القوائم بين الشاشات.
const SUBMENU_WIDTH = 168;
const SUBMENU_HEIGHT = 132;

// ترتيب الطبقات في هذه الشاشة وحدها (index.css هو المصدر، وهذه الشاشة أكثر
// شاشات اللوحة تكدّسَ نوافذ):
//   140  حجاب الشريط الجانبي على الجوّال   (.dash__scrim)
//   141  نافذة الملف
//   150  قوائم الصف الثابتة (.dash__menu--fixed) — فوق نافذة الملف عمداً
//   161  نافذة التعديل
//
// نافذة التعديل تُفتح من **داخل** نافذة الملف (زر القلم في ترويستها)، فكونها
// على 100 يعني أن حجاب نافذة الملف — وهو 141 — يعلوها، فلا يُرى نموذج
// التعديل ولا تُقبل عليه أي نقرة: النقرات تصيب حجاب الملف وتُغلق الملف، فيومض
// النموذج ويختفي. لذلك تُكتب الطبقتان مع علاقتين واضحين بينهما: لا رقم 141
// مكتوب في موضع، ولا رقم افتراضي في CSS من موضع آخر.
const PROFILE_MODAL_Z = 141;
// فوق قوائم الصف (150) لا تحتها: قائمة تُفتح على نموذج مفتوح تطفو فوقه، وهذا
// عكس المطلوب. الفارق 20 لا 1 ليبقى بين الطبقة العُليا والسفلى فراغٌ لطبقة
// وسطى تُفتح بينهما لاحقاً.
const EDIT_MODAL_Z = PROFILE_MODAL_Z + 20;

const TABS = [
  { id: 'all', label: 'كل الحسابات' },
  { id: 'freelancer', label: 'فريلانسرز' },
  { id: 'owner', label: 'ملاك المساحات' },
  // «بانتظار التفعيل» تبويبٌ مستقلّ لا مجرّد تسمية: هو طابور عمل للأدمن
  // (تفعيلٌ أو رفض)، ولولاه لأضطر السؤال الوحيد «من الذي ينتظر قراري؟»
  // إلى مسح الجدول كلّه بعينه.
  { id: 'pending', label: 'بانتظار التفعيل' },
  { id: 'suspended', label: 'الموقوفون' },
];

// نبضة تحديث تلقائي لقائمة الحسابات: 30 ثانية.
//
// 30 ثانية توازن بين حداثة الأرقام (تسجيل جديد، تغيير حالة) وثقل الخادم:
// طلب كل 5 ثوانٍ مع 32 حساباً بلا فائدة، والدقيقة الواحدة تتأخر عن لوحة
// monitoring. النبضة تتوقف والتبويب مخفيّ، وتبدأ من جديد فور ظهوره (انظر
// الخطّاف)، فالفحص على حالة التبويب لا على تمرير الوقت وحده.
const USERS_POLL_MS = 30000;

// أدوار المستخدم: مصدر واحد للتعريب واللون والعدّ.
//
// لماذا ملف واحد: كانت ثلاثة جداول متفرّقة (roleLabel وroleTone وROLE_AR)،
// فأُضيفت قيمةٌ في واحد وسُقطت من العرض في اثنين — والجدول يعرض تسمية لا
// يطبّقها الفلتر على نفس القيمة.
//
// **دمج الأدوار**: الخادم يرسل أربع قيم، والواجهة تعرض اثنين:
//   · مالك مساحة ← `space_owner` أو `owner`  (الأول ما يرسله اليوم، والثاني
//     ما كان يرسله سابقاً ويذكره العقد §1.1 — دور واحد بإملاءين)
//   · فريلانسر   ← `freelancer` أو `customer` (حساب يحجز مساحات ويسجّل باسمه
//     هو في هذا التصنيف فريلانسر، ولا يظهر كمصطلح مستقلّ في اللوحة)
// القيمة الخام تبقى كما أرسلها الخادم في `user.role` — الدمج للعرض والفلترة
// والعدّ فقط، فلا يُعاد كتابة أي حساب في القاعدة من شاشة عرض.
const ROLE_OWNER = 'owner';
const ROLE_SPACE_OWNER = 'space_owner';
const ROLE_FREELANCER = 'freelancer';
const ROLE_CUSTOMER = 'customer';

const roleMeta = {
  [ROLE_FREELANCER]: { label: 'فريلانسر', tone: 'violet' },
  // `customer` يُعرض «فريلانسر» عمداً: التصنيفان في لوحة المشرف واحد.
  [ROLE_CUSTOMER]: { label: 'فريلانسر', tone: 'violet' },
  [ROLE_OWNER]: { label: 'مالك مساحة', tone: 'orange' },
  [ROLE_SPACE_OWNER]: { label: 'مالك مساحة', tone: 'orange' },
};

/** هل القيمة دور مالك مساحة بأحد إملائيه؟ — المحوّل هو المصدر (انظر adaptUser). */
const isOwnerRole = isOwnerRoleValue;

/** هل القيمة دور فريلانسر بأحد اسميه؟ (`customer` مدمج في التصنيف) */
const isFreelancerRole = (role) => role === ROLE_FREELANCER || role === ROLE_CUSTOMER;

/**
 * وصف الدور للعرض. القيمة المجهولة أو الفارغة تُعرض شرطة لا تُختلق لها تسمية.
 * سبب الشرطة تحديداً: تمرير `role: undefined` إلى خريطة الجداول كان يُظهر
 * خانة فارغة تبدو كأن الحقل ناقص في الواجهة، بينما هو ناقص في ردّ الخادم.
 */
function roleOf(role) {
  const key = typeof role === 'string' ? role.trim().toLowerCase() : '';
  const meta = roleMeta[key];
  return meta ? { label: meta.label, tone: meta.tone, key } : { label: '—', tone: 'gray', key: null };
}

/**
 * التصنيف المعروض (قيمة القائمة المنسدلة): الدور يُختزل إلى واحد من اثنين.
 * القائمة تعرض التصنيفين فقط لأن الواجهة تعرضهما، فلا معنى لخيار ثالث يخرج
 * عن التسميات المعروضة في الجدول نفسه.
 */
const roleCategory = (role) => {
  const key = typeof role === 'string' ? role.trim().toLowerCase() : '';
  if (isOwnerRole(key)) return ROLE_SPACE_OWNER;
  if (isFreelancerRole(key)) return ROLE_FREELANCER;
  return '';
};

// حالات الحساب: ثلاثٌ لا رابعة.
//
// `pending` هي الحالة التي يصل بها مالك مساحات جديد من التسجيل أو من رفع
// مستند التوثيق، فصارت **طابور قرارٍ واحد**. وإلى جانبها كانت قيمة `review`
// («قيد المراجعة») فحُذفت: تسمية ثانية لـ`pending` لا حالة مستقلة، لا يقرأ منها
// الخادم فرقاً ولا يحسب منها عدة.
//
// ووجودها كان يُنتج ثلاثة أرقام لمسارٍ واحد — «بانتظار التفعيل» و«قيد
// المراجعة» و«الموقوفون» — فيقسم الأدمن طابوراً واحداً إلى قائمتين يقرّر
// فيهما مرتين على الحساب نفسه.
const STATUS_PENDING = 'pending';

const statusMeta = {
  active: { tone: 'green', label: 'نشط', Icon: UserCheck },
  suspended: { tone: 'red', label: 'موقوف', Icon: UserX },
  [STATUS_PENDING]: { tone: 'amber', label: 'بانتظار التفعيل', Icon: Clock },
};

/**
 * حالة يُقرأ منها طرفان: البادج في الجدول، وقرار «يُفعّل/يُوقف» في نافذة
 * الملف. كمالةٌ داخل `statusMeta` تكفي الاثنين، لأن القائمة تعرض كل
 * مفاتيحها — فإضافة حالة هنا تُضيف بادجاً وصفاً في كل شاشة بلا تكرار.
 */
const STATUS_ORDER = [STATUS_PENDING, 'active', 'suspended'];

// حالةٌ لا نعرفها: شارةٌ محايدة بتسمية صريحة، بدل شارة خضراء تُقرأ
// موافقةً. القيمة وصلتنا من الخادم ولا نظنّها موافقة، فنقول «لا نعرف».
// قرارُ الأدمن يبقى متاحاً: هو مصدر الحقيقة، ونحن نعرض ما وصل فقط.
const UNKNOWN_STATUS = { tone: 'gray', label: 'حالة غير معروفة', Icon: Clock };

function PresenceDot({ online }) {
  return (
    <span
      title={online ? 'متصل الآن' : 'غير متصل'}
      className={`dash__dot${online ? ' is-on' : ''}`}
    />
  );
}

function Checkbox({ checked, indeterminate = false, onChange, label }) {
  return (
    <input
      type="checkbox"
      className={`dash__check${indeterminate ? ' is-indeterminate' : ''}`}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      aria-label={label || 'تحديد'}
    />
  );
}

const CSV_HEADERS = ['الاسم', 'البريد', 'الهاتف', 'الدور', 'الحالة', 'التحقق', 'الحجوزات', 'الانضمام'];
// يُبنى من statusMeta حتى لا تنحرف تسمية التصدير عن تسمية البادج: جدولان
// للحالة نفسها كانا يختلفان (التصدير يقول «نشط» والبادج «مفعّل»).
const STATUS_AR = Object.fromEntries(Object.entries(statusMeta).map(([k, m]) => [k, m.label]));

export default function AdminUsers() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [advOpen, setAdvOpen] = useState(false);
  const [fVerif, setFVerif] = useState('all');
  const [fJoinedFrom, setFJoinedFrom] = useState('');
  const [fJoinedTo, setFJoinedTo] = useState('');
  const [fMinBookings, setFMinBookings] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [viewUser, setViewUser] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // إيقاف الحساب: هدفٌ منفصل عن `deleteTarget` لأن الإيقاف ليس حذفاً —
  // قرارٌ على حسابٍ ينتظر الاعتماد. والعنصر المعروض فيه هو نفس الحساب،
  // فنستطيع فتحه من قسم المستندات ومن نافذة الملف معاً.
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [menu, setMenu] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);
  // يُقرأ من مستمع Escape في نافذة الملف. انظر Effect أدناه: مرجع لا حالة،
  // لأن قيمته تُقرأ أثناء حدث لا في تصيير، وتحديثه لا يجب أن يعيد تسجيل
  // المستمعين (تنظيفهما يعيد قفل/فتح تمرير الصفحة بلا داعٍ).
  const editOpenRef = useRef(false);
  // مرافقته للحالة: كل فتح أو إغلاق للنموذج يعدّل المرجع، والتحديث يقع في
  // Effect بعد التصيير لا داخله.
  useEffect(() => {
    editOpenRef.current = Boolean(editTarget);
  }, [editTarget]);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // المعرّف يُقرأ من المسار مباشرة لا من useParams: المسار مُعرَّف كـ splat
  // واحد (`/admin/*`) فلا يمرّر React Router مقطع :id إلى useParams، فكان
  // الرابط المباشر يفتح الصفحة بلا نافذة عند التحميل الأول (paste/refresh).
  const routeUserId = useMemo(() => {
    const match = /^\/admin\/users\/([^/]+)\/?$/.exec(pathname || '');
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [pathname]);
  const { toast, announce, dismiss } = useToast();

  /* -------------------------------------------------------------- */
  /* جلب البيانات: من الخادم وحده — لا بيانات تجريبية في هذه الشاشة    */
  /* -------------------------------------------------------------- */

  // نقبل كل القيم: عقد الـ API يوصي بالقيم الخام (raw) في/users حتى يترجمها
  // الواجهة، فلا نُسقط حقلاً قد يرسله الخادم ونُنتظره.
  //
  // المحوّل (adminAdapters) يرقّي الأسماء ويكمّل الغائب: `whatsapp` ← `phone`
  // لأن قائمة المستخدمين في العقد لا تذكر `phone`، ويضع `مساحة #<id>` اسماً
  // وصفياً حين لا يكون هناك اسم (العقد ينبّه أن `spaces[].name` يرد `null`).
  // والدور يبقى null عمداً للحساب الذي لا دور له — انظر adaptUser.
  const normalizeUser = (raw) => adaptUser(raw);

  const fetchUsers = useCallback(async () => {
    const { rows } = await listUsers({ sort: 'newest' });
    return (rows || []).map(normalizeUser);
  }, []);

  const {
    data: users,
    setData: setUsers,
    loading,
    error: loadError,
    live,
    reload,
    updatedLabel,
  } = useAdminData(fetchUsers, [], { pollMs: USERS_POLL_MS });

  // البيانات تبقى فارغة (لا لست فارغة) حتى يصل أول رد من الخادم. نشتقّ من
  // القائمة الفارغة الثابتة فقط، فلا نُدرج أي حساب من عندنا، ونتذكّر أنّ
  // الأرقام لم تصل بعد فلا نعرض صفراً مكانها.
  const rows = users ?? NO_ROWS;
  const awaitingServer = users === null;

  // التحديث المتفائل قد يقع قبل أول رد، فيتسلم الدالة قيمة فارغة؛ نحوّلها
  // لقائمة صالحة أولاً حتى لا ينكسر أي إجراء.
  const patchRows = (fn) => setUsers((prev) => fn(Array.isArray(prev) ? prev : []));

  /* -------------------------------------------------------------- */
  /* رابط مباشر /admin/users/:id — فتح الملف يحدّث المسار والعكس    */
  /* -------------------------------------------------------------- */

  // فتح الملف من أي مكان (نقرة صف، قائمة إجراءات، رابط مباشر).
  const openProfile = useCallback(
    (user) => {
      if (!user) return;
      setViewUser(user);
      navigate(`/admin/users/${user.id}`);
    },
    [navigate]
  );

  const closeProfile = useCallback(() => {
    setViewUser(null);
    if (routeUserId) navigate('/admin/users');
  }, [navigate, routeUserId]);

  // الاشتقاق أثناء التصيير لا داخل أثر: النافذة تُفتح من المسار مباشرة، وأي
  // تعديل في القائمة (تغيير حالة/حظر) يصل إليها بلا نسخة قديمة.
  // الأولوية للمسار: النقر على صف آخر يجب ألّا يلغي رابطاً مفتوحاً.
  const routeUser = useMemo(
    () => (routeUserId ? rows.find((u) => String(u.id) === String(routeUserId)) || null : null),
    [routeUserId, rows]
  );
  const activeProfile = useMemo(() => {
    if (routeUser) return routeUser;
    if (viewUser) return rows.find((u) => u.id === viewUser.id) || viewUser;
    return null;
  }, [routeUser, rows, viewUser]);
  // رابط لمعرّف غير موجود: نقوله ذلك بدل إغلاق النافذة صمتاً.
  const missingProfileId = Boolean(routeUserId) && !routeUser;

  // Escape يغلق النافذة المفتوحة. نستمع على مستوى النافذة لا على مستوى الصفحة:
  // المستمع العام كان يبقى مسجّلاً بعد الإغلاق فيغلق ما يُفتح بعدها أيضاً.
  useEffect(() => {
    if (!activeProfile) return undefined;
    const onKey = (e) => {
      // النافذة **العليا** وحدها هي ما يغلقه Escape. نافذة التعديل تستمع هي
      // الأخرى على النافذة نفسها (Modal في ui.jsx)، ومستمعان على window في
      // مرحلة واحدة يلتقطان الحدث نفسه، فبلا هذا الشرط أغلق ضغطة واحدة الملف
      // والتعديل معاً. والشرط مرجعٌ لا حالة: لو اشتُرطت الحالة لانتسخ المستمع في
      // كل فتح وإغلاق، وتنظيفُه يمرّ على قفل تمرير الصفحة — ولا داعي لذلك
      // لقراءة علم واحد.
      if (e.key === 'Escape' && !editOpenRef.current) closeProfile();
    };
    window.addEventListener('keydown', onKey);
    // منع تمرير الصفحة خلف النافذة.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [activeProfile, closeProfile]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (!e.target?.closest?.('[data-row-menu]')) setMenu(null);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (menu.statusOpen) setMenu((cur) => (cur ? { ...cur, statusOpen: false } : null));
      else setMenu(null);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // تتبّع مرساة الصف أثناء التمرير/resize حتى لا تنفصل القائمة الثابتة عن الصف.
  useEffect(() => {
    if (!menu) return undefined;
    const reposition = () => {
      const anchor = menu.anchor;
      if (!anchor || !anchor.isConnected) {
        setMenu(null);
        return;
      }
      const pos = placeFixed(anchor.getBoundingClientRect(), MENU_WIDTH, MENU_HEIGHT);
      setMenu((cur) => (cur && cur.top === pos.top && cur.left === pos.left ? cur : { ...cur, ...pos }));
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [menu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const phoneQ = query.replace(/\s/g, '').toLowerCase();
    return rows.filter((u) => {
      // تبويب «ملاك المساحات» يجمع إملاءَي الدور، وتبويب «فريلانسرز» يجمع
      // `freelancer` و`customer` معاً كتصنيف واحد.
      if (tab === 'owner' && !isOwnerRole(u.role)) return false;
      if (tab === 'freelancer' && !isFreelancerRole(u.role)) return false;
      if (tab === 'suspended' && u.status !== 'suspended') return false;
      // طابور التفعيل: `pending` فقط لا `review` أيضاً. الحساب «قيد
      // المراجعة» ليس في طابور التفعيل (§1 من عقد التفعيل)، وضمّه كان
      // يخلط مسارين قرارٍ مختلفين في قائمة واحدة.
      if (tab === 'pending' && u.status !== STATUS_PENDING) return false;
      if (
        q &&
        !(
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.replace(/\s/g, '').toLowerCase().includes(phoneQ)
        )
      )
        return false;
      if (fVerif === 'verified' && !u.verified) return false;
      if (fVerif === 'unverified' && u.verified) return false;
      if (fJoinedFrom !== '' && u.joined < fJoinedFrom) return false;
      if (fJoinedTo !== '' && u.joined > fJoinedTo) return false;
      if (fMinBookings !== '' && u.bookings < Number(fMinBookings)) return false;
      return true;
    });
  }, [rows, tab, query, fVerif, fJoinedFrom, fJoinedTo, fMinBookings]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedUsers = rows.filter((u) => selected.has(u.id));
  const allChecked = filtered.length > 0 && filtered.every((u) => selected.has(u.id));
  const someChecked = !allChecked && filtered.some((u) => selected.has(u.id));

  // تبويب «كل الحسابات» لا يفلتر بالدور إطلاقاً: كل حساب بأي قيمة دور يدخل
  // عمداً، وإلا اختفى دورٌ جديد لم نُضف له تبويباً.
  //
  // العدّادات تُحسب من الصفوف المعروضة نفسها لا من جدول جانبي: هكذا رقم
  // البطاقة يطابق ما تراه تحت التبويبات دائماً.
  const counts = useMemo(() => {
    let total = 0;
    let freelancers = 0;
    let owners = 0;
    let pendingVerif = 0;
    let suspended = 0;
    let withoutRole = 0;
    let pending = 0;
    for (const u of rows) {
      total += 1;
      // تصنيفان فقط في اللوحة: مالك مساحة أو فريلانسر. أي قيمة أخرى (نقص في
      // ردّ الخادم أو دور جديد) لا تُطوى في أحدهما بل تُعدّ «بلا دور» صراحةً.
      if (isOwnerRole(u.role)) owners += 1;
      else if (isFreelancerRole(u.role)) freelancers += 1;
      else withoutRole += 1;
      if (!u.verified) pendingVerif += 1;
      if (u.status === 'suspended') suspended += 1;
      // `pending` حالةٌ مستقلة عن `review` (§1 في عقد التفعيل)، وعدّها
      // معه كان يُخفي عن الأدمن عدد ما ينتظر قراره.
      if (u.status === STATUS_PENDING) pending += 1;
    }
    return { total, freelancers, owners, withoutRole, pendingVerif, suspended, pending };
  }, [rows]);

  // قبل وصول أول رد لا نعرف العدد، فصفرٌ هنا ادّعاءُ لا معلومة: نعرض شرطة.
  const kpiValue = (n) => (awaitingServer ? '—' : n);

  // نسب التغيّر الشهري لا يرسلها الخادم إطلاقاً، ولا نخترع رقماً مكانها:
  // اتجاه محايد بلا سهم، وشرطة في خانة التلميح حتى تصل النسبة من الخادم.
  const kpis = [
    { icon: Users, label: 'إجمالي الحسابات', value: kpiValue(counts.total), tone: 'orange', trend: 'none', hint: '—' },
    { icon: Building2, label: 'ملاك المساحات', value: kpiValue(counts.owners), tone: 'blue', trend: 'none', hint: '—' },
    { icon: UserCheck, label: 'فريلانسرز', value: kpiValue(counts.freelancers), tone: 'violet', trend: 'none', hint: '—' },
    { icon: ShieldCheck, label: 'بانتظار التحقق', value: kpiValue(counts.pendingVerif), tone: 'amber', trend: 'warn', hint: 'تحتاج مراجعة' },
  ];

  // الملخص تحت العنوان: تصنيفان فقط، و«بلا دور» يظهر فقط إن وُجد حساب بقيمة
  // دور غير معروفة — فلا يُخفى نقص بيانات الخادم ولا يُصطنع تصنيف له.
  const summaryParts = [
    `${counts.total} حساب`,
    `${counts.owners} مالك مساحة`,
    `${counts.freelancers} فريلانسر`,
    `${counts.pendingVerif} بانتظار التحقق`,
    `${counts.suspended} موقوف`,
  ];
  // «بانتظار التفعيل» يظهر أولاً حين يفوق صفراً: هو المهمة التي تنتظر
  // قرار الأدمن، وإخفاؤه في آخر الملخص يجعل لوحة المهام تبدو مكتملة.
  if (counts.pending > 0) summaryParts.unshift(`${counts.pending} بانتظار التفعيل`);
  if (counts.withoutRole > 0) summaryParts.push(`${counts.withoutRole} بلا دور محدّد`);
  const listSummary = awaitingServer
    ? 'جارٍ التحميل من الخادم…'
    : summaryParts.join(' · ');

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((u) => next.delete(u.id));
      else filtered.forEach((u) => next.add(u.id));
      return next;
    });
  };

  // غلاف للطلبات: يحدّث محلياً دائماً (ردود فورية)، ويصل العملية للخادم حين
  // تتوفّر جلسة مشرف. الفشل يُعلَم ولا يُمحى التغيير المحلي.
  const runApi = useCallback(
    async (fn, { fallbackMessage } = {}) => {
      if (!isAdminTokenLive()) {
        if (fallbackMessage) announce(`${fallbackMessage} (وضع تجريبي — لم يُرسل شيء للخادم)`);
        return true;
      }
      setBusy(true);
      try {
        await fn();
        return true;
      } catch (err) {
        announce(err?.message || 'تعذّر تنفيذ الإجراء على الخادم.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [announce]
  );

  const setStatusMany = (ids, status) => {
    patchRows((prev) => prev.map((u) => (ids.has(u.id) ? { ...u, status } : u)));
    setSelected(new Set());
  };

  const toggleSuspend = (id) => {
    patchRows((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'suspended' ? 'active' : 'suspended' } : u
      )
    );
  };

  const handleBulkApprove = () => {
    patchRows((prev) =>
      prev.map((u) => (selected.has(u.id) ? { ...u, status: 'active', verified: true } : u))
    );
    const ids = [...selected];
    setSelected(new Set());
    runApi(
      () => bulkUserStatus(ids, 'verify'),
      { fallbackMessage: 'تم توثيق المحددين' }
    );
  };

  const handleBulkSuspend = () => {
    const ids = [...selected];
    setStatusMany(new Set(ids), 'suspended');
    runApi(() => bulkUserStatus(ids, 'suspend'), { fallbackMessage: 'تم إيقاف المحددين' });
  };

  const handleExportCsv = () => {
    const rows = selected.size > 0 ? selectedUsers : filtered;
    downloadCsv('masahati-users.csv', [
      CSV_HEADERS,
      ...rows.map((u) => [u.name, u.email, u.phone, roleOf(u.role).label, STATUS_AR[u.status], u.verified ? 'موثق' : 'غير موثق', u.bookings, u.joined]),
    ]);
    announce(`تم تصدير ${rows.length} حساب كملف CSV.`);
  };

  // التفعيل الصريح (زر «تفعيل الحساب» في نافذة الملف). مسار منفصل عن
// `handleToggleSuspend` عمداً: مفعّلٌ واحدٌ من معطّل يعطي `active`، بينما
// مفعّلٌ من `pending` أو `review` يعطي `active` أيضاً — لكن الأول رفعُ
// حظر والثاني قرارُ اعتماد، ودمجهما يجعل رسالة «تم رفع الحظر» تصف حساباً
// لم يكن موقوفاً قط.
  const handleActivate = (user) => {
    if (!user) return;
    patchRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 'active' } : u)));
    // النافذة تحتفظ بنسخة من الحساب، فنزامنها أو عرضت الحالة القديمة بعد
    // نجاح العملية.
    setViewUser((v) => (v && v.id === user.id ? { ...v, status: 'active' } : v));
    announce(`تم تفعيل حساب ${user.name}.`);
    runApi(() => setUserStatus(user.id, 'active'));
  };

  // إيقاف الحساب من قسم المستندات (زر «إيقاف»).
  //
  // **لماذا `suspended` فقط:** مفردات الحساب ثلاث (انظرstatusMeta)،
  // وعمود الحالة في القاعدة محدود بما يعرفه الخادم. والإيقاف يعني «لن يُعتمد
  // الآن» وعند هذه النافذة هو نفسه الحظر: الحساب لا يستطيع النشر. ولو
  // اخترعنا قيمة `rejected` لأظهرها العرض، فرفضها الخادم على
  // `PATCH /users/{id}/status`، فيبقى التعديل في متصفحنا وحده وتقول اللوحة
  // «تم الإيقاف» بينما الحساب ما زال `pending` في القاعدة. فنستعمل قيمةً
  // يعرفها الخادم ونقول للأدمن ما تعنيه بدقة.
  const confirmSuspend = (user) => {
    if (!user) return;
    patchRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 'suspended' } : u)));
    setViewUser((v) => (v && v.id === user.id ? { ...v, status: 'suspended' } : v));
    setSuspendTarget(null);
    announce(`تم إيقاف حساب ${user.name}.`);
    runApi(() => setUserStatus(user.id, 'suspended'));
  };

  // الحظر/رفع الحظر من قائمة الصف ومن داخل نافذة الملف: عملية واحدة تتصرّف
  // بحسب الحالة الحالية بدل مسارين منفصلين يختلفان في التحديث المحلي.
  const handleToggleSuspend = (user) => {
    if (!user) return;
    const next = user.status === 'suspended' ? 'active' : 'suspended';
    toggleSuspend(user.id);
    setViewUser((v) => (v && v.id === user.id ? { ...v, status: next } : v));
    announce(next === 'suspended' ? 'تم حظر الحساب.' : 'تم رفع الحظر عن الحساب.');
    runApi(() => setUserStatus(user.id, next));
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    patchRows((prev) => prev.filter((u) => u.id !== id));
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setViewUser((v) => (v && v.id === id ? null : v));
    setMenu((m) => (m && m.id === id ? null : m));
    setDeleteTarget(null);
    announce('تم حذف الحساب.');
    runApi(() => deleteUser(id));
  };

  const openEdit = (u) => {
    if (!u) return;
    setEditTarget(u);
    setDraft({ ...u });
    setMenu(null);
  };

  const saveEdit = () => {
    if (!draft || !editTarget) return;
    const target = editTarget;

    // الدمج للعرض فقط، فلا يجوز أن يُرسل للخادم إلا ما غيّره المدير فعلاً:
    // حساب قادم بـ`customer` يُعرض «فريلانسر»، ولو أرسلنا `draft.role` كما هو
    // لكان فتح النموذج والحفظ وحدهما يحوّلان دوره في القاعدة إلى `freelancer`
    // دون أن يكون المدير قد اختار شيئاً. فنُبقي القيمة الخام إن لم يتغيّر
    // التصنيف، ونرسل قيمة التصنيف الجديد إن اختار المدير فعلاً.
    const roleUnchanged = roleCategory(draft.role) === roleCategory(target.role);
    const roleToSend = roleUnchanged ? target.role ?? null : draft.role;
    const saved = { ...draft, role: roleToSend };

    patchRows((prev) => prev.map((u) => (u.id === target.id ? saved : u)));
    setEditTarget(null);
    setDraft(null);
    announce('تم تحديث بيانات الحساب.');
    // العقد §5.6: تعديل الحقول الأساسية فقط (name/email/phone/role).
    const statusChanged = (draft.status || '') !== (target.status || '');
    runApi(() =>
      updateUser(target.id, {
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        role: roleToSend,
      }).then(() => {
        // الحالة لها وصلها الخاص (PATCH /users/{id}/status) لا التحديث العام،
        // فكانت قائمة الحالة في النموذج تغيّر الشكل ثم لا تكتب شيئاً على
        // الخادم — تعديلٌ يعرض نجاحاً وهو لم يُحفظ. نرسلها فقط إن غيّرت
        // المدير حالتها فعلاً، فلا نطمس قراراً سابقاً بطلبٍ لم يُطلب.
        if (statusChanged) return setUserStatus(target.id, draft.status);
        return undefined;
      })
    );
  };

  const openRowMenu = (e, u) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = placeFixed(e.currentTarget.getBoundingClientRect(), MENU_WIDTH, MENU_HEIGHT);
    setMenu((current) => (current?.id === u.id ? null : { id: u.id, anchor: e.currentTarget, ...pos }));
  };

  const toggleStatusMenu = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const btnRect = e.currentTarget.getBoundingClientRect();
    const statusPos = placeFixed(btnRect, SUBMENU_WIDTH, SUBMENU_HEIGHT, 'left');
    setMenu((cur) =>
      cur
        ? cur.statusOpen
          ? { ...cur, statusOpen: false }
          : { ...cur, statusOpen: true, statusPos }
        : cur
    );
  };

  const applyStatus = (id, status) => {
    patchRows((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
    // النافذة المفتوحة تحتفظ بنسخة قديمة من الحساب، فنزامنها لئلا تعرض
    // الحالة السابقة بعد أن نجحت العملية.
    setViewUser((v) => (v && v.id === id ? { ...v, status } : v));
    setMenu(null);
    runApi(() => setUserStatus(id, status), { fallbackMessage: 'تم تحديث حالة الحساب.' });
  };

  const menuUser = menu ? rows.find((u) => u.id === menu.id) || null : null;
  const menuIsBlocked = menuUser?.status === 'suspended';

  const clearFilters = () => {
    setAdvOpen(false);
    setFVerif('all');
    setFJoinedFrom('');
    setFJoinedTo('');
    setFMinBookings('');
    setPage(1);
  };

  const hasAdvFilters = fVerif !== 'all' || fJoinedFrom || fJoinedTo || fMinBookings;

  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);

  // تفاصيل إضافية من الخادم (قائمة المساحات مثلاً، العقد §5.3) بلا انتظار:
  // النافذة تُفتح فوراً ببيانات الصف، وتُدمج التفاصيل فور وصولها.
  useEffect(() => {
    if (!viewUser || !isAdminTokenLive()) return undefined;
    const id = viewUser.id;
    let alive = true;
    getUser(id)
      .then((detail) => {
        if (!alive || !detail) return;
        setViewUser((cur) => (cur && cur.id === id ? { ...cur, ...normalizeUser(detail) } : cur));
      })
      .catch(() => {
        /* التفاصيل اختيارية: بقاء بيانات الصف كافٍ ولا نُظهر خطأً لمجردها */
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewUser?.id, live]);

  return (
    <div className="space-y-5">
      <DataSourceBanner live={live} loading={loading} error={loadError} onRetry={reload} />

      {/* رابط مباشر بمعرّف غير موجود: صرّح بذلك بدل إغلاق النافذة صمتاً،
          فالرابط قد يكون قديماً أو مكتوباً يدوياً. */}
      {missingProfileId && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <span>لا يوجد حساب بالمعرّف {routeUserId}.</span>
          <button type="button" className="underline" onClick={closeProfile}>
            العودة إلى القائمة
          </button>
        </div>
      )}

      {/* بطاقات المؤشرات */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c) => (
          <StatCard key={c.label} {...c} commas />
        ))}
      </div>

      <SectionCard>
        <SectionHeading
          icon={Users}
          title="إدارة المستخدمين والملاك"
          subtitle={listSummary}
          // أثر التحديث التلقائي مرئي: بلا ختم وقت، المستخدم يرى أرقاماً
          // تتغيّر ولا يعرف أن الصفحة تسأل الخادم أصلاً. والختم يُحسب عند
          // وصول الردّ لا أثناء التصيير (‎Date‎ غير نقية).
          action={
            updatedLabel ? (
              <span
                data-users-updated={updatedLabel}
                className="inline-flex items-center gap-1.5 text-xs font-bold"
                style={{ color: 'var(--text-muted)' }}
                title="تُحدَّث القائمة تلقائياً كل 30 ثانية"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                تحديث تلقائي كل 30 ثانية · آخر تحديث {updatedLabel}
              </span>
            ) : null
          }
        />

        {/* التبويبات + البحث */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Pill key={t.id} active={tab === t.id} onClick={() => { setTab(t.id); setPage(1); }}>
                {t.label}
              </Pill>
            ))}
          </div>
          <div className="relative lg:max-w-xs lg:flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="ابحث بالاسم أو البريد أو الهاتف…"
              className="dash__input dash__input--icon"
            />
          </div>
        </div>

        {/* شريط أدوات متقدم: فلاتر + إجراءات جماعية */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`dash__toolbtn${advOpen ? ' is-active' : ''}`}
            onClick={() => setAdvOpen((o) => !o)}
            aria-expanded={advOpen}
          >
            {advOpen ? <FilterX className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
            فلاتر متقدمة
            {hasAdvFilters && <span className="dash__toolbtn-count">{filteredActiveCount()}</span>}
          </button>

          <div className="relative">
            <button
              type="button"
              className={`dash__toolbtn${bulkOpen ? ' is-active' : ''}`}
              onClick={() => setBulkOpen((o) => !o)}
              disabled={selected.size === 0}
              aria-expanded={bulkOpen}
            >
              <CheckCircle2 className="h-4 w-4" />
              إجراءات جماعية
              {selected.size > 0 && <span className="dash__toolbtn-count">{selected.size}</span>}
            </button>

            {bulkOpen && (
              <AnimatePresence>
                <motion.div
                  className="dash__menu dash__menu--inline"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                >
                <button type="button" onClick={() => { handleBulkApprove(); setBulkOpen(false); }}>
                  <UserCheck className="h-4 w-4" />
                  اعتماد المحددين
                </button>
                <button type="button" onClick={() => { handleBulkSuspend(); setBulkOpen(false); }}>
                  <Ban className="h-4 w-4" />
                  إيقاف المحددين
                </button>
                <button type="button" onClick={() => { handleExportCsv(); setBulkOpen(false); }}>
                  <Download className="h-4 w-4" />
                  تصدير CSV
                </button>
              </motion.div>
              </AnimatePresence>
            )}
          </div>

          {selected.size > 0 && (
            <span className="dash__selected-bar">
              تم تحديد <b>{selected.size}</b>
              <button type="button" onClick={() => setSelected(new Set())}>
                إلغاء التحديد
              </button>
            </span>
          )}

          {!advOpen && hasAdvFilters && (
            <span className="dash__selected-bar">{filtered.length} نتيجة متوافقة مع الفلاتر</span>
          )}
        </div>

        {/* لوحة الفلاتر المتقدمة */}
        <AnimatePresence initial={false}>
          {advOpen && (
            <motion.div
              className="dash__filter-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="dash__field-label">حالة التحقق</label>
                  <select className="dash__input" value={fVerif} onChange={(e) => { setFVerif(e.target.value); setPage(1); }}>
                    <option value="all">الكل</option>
                    <option value="verified">تم التحقق</option>
                    <option value="unverified">غير موثق</option>
                  </select>
                </div>
                <div>
                  <label className="dash__field-label">الانضمام من</label>
                  <input type="date" className="dash__input" value={fJoinedFrom} onChange={(e) => { setFJoinedFrom(e.target.value); setPage(1); }} />
                </div>
                <div>
                  <label className="dash__field-label">الانضمام حتى</label>
                  <input type="date" className="dash__input" value={fJoinedTo} onChange={(e) => { setFJoinedTo(e.target.value); setPage(1); }} />
                </div>
                <div>
                  <label className="dash__field-label">حد أدنى للحجوزات</label>
                  <input type="number" min="0" placeholder="مثال: 5" className="dash__input" value={fMinBookings} onChange={(e) => { setFMinBookings(e.target.value); setPage(1); }} />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" className="btn-ghost" onClick={clearFilters}>
                  <FilterX className="h-4 w-4" />
                  إعادة الضبط
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {awaitingServer ? (
          // بلا جلسة خادم لا إرسال ولا بيانات، وبلا طلب في الطريق لا معنى
          // لعبارة «جارٍ التحميل». البوابة تختار بين الحالات الثلاث.
          <DataGate live={live} loading={loading} error={loadError} onRetry={reload} rows={5} errorTitle="تعذّر جلب الحسابات" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="لا توجد نتائج مطابقة"
            description="جرّب تعديل كلمة البحث أو تغيير الفلتر للعثور على الحسابات."
            actionLabel="إعادة الضبط"
            onAction={() => {
              setQuery('');
              setTab('all');
              clearFilters();
            }}
          />
        ) : (
          <div className="dash__table-wrap">
            <table className="dash__table min-w-[58rem] text-sm">
              <thead>
                <tr>
                  <th className="w-10">
                    <Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleSelectAll} label="تحديد الكل" />
                  </th>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>التحقق</th>
                  <th className="num">الحجوزات</th>
                  <th>آخر نشاط</th>
                  <th>الانضمام</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u, i) => {
                  // حالة مجهولة لا تُعرض «نشط»: البدال `statusMeta.active` كان يرسم حساباً
                  // بحالة لا نعرفها شارةً خضراء، فيقرأه الأدمن أنه مفعّل
                  // ومُعتمد، وقفل إضافة المساحة عليه مفتوح أيضاً (ownerGate
                  // يقفل على `active` وحده، لكن الجدول يقول غير ذلك).
                  const st = statusMeta[u.status] || UNKNOWN_STATUS;
                  const StatusIcon = st.Icon;
                  const isSelected = selected.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      className={`dash__tr-select dash__row-in${u.status === 'suspended' ? ' dash__tr--muted' : ''}${isSelected ? ' is-selected' : ''}`}
                      style={{ animationDelay: `${Math.min(i, 9) * 22}ms` }}
                      onClick={() => openProfile(u)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onChange={() => toggleSelect(u.id)} label={`تحديد ${u.name}`} />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <Avatar name={u.name} xs />
                            <PresenceDot online={u.online} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-bold" style={{ color: 'var(--text-strong)' }}>{u.name}</p>
                            <p className="txt-muted truncate text-xs" dir="ltr">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const role = roleOf(u.role);
                          // data-role-badge يميّز شارة الدور عن شارة الحالة
                          // وشارة التحقق في الاختبار: الثلاث نصّ عربي متشابه،
                          // وفحصها بالـ class وحده كان يفحص الثلاث معاً.
                          return (
                            <span data-role-badge={role.key || 'unknown'}>
                              <StatusBadge tone={role.tone}>{role.label}</StatusBadge>
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <span data-user-status={u.status || 'unknown'}>
                          <StatusBadge tone={st.tone} icon={StatusIcon}>{st.label}</StatusBadge>
                        </span>
                      </td>
                      <td>
                        {u.verified ? (
                          <StatusBadge tone="blue" icon={ShieldCheck}>تم التحقق</StatusBadge>
                        ) : (
                          <StatusBadge tone="amber" icon={Clock}>غير موثق</StatusBadge>
                        )}
                      </td>
                      <td>
                        <span className="num">{u.bookings}</span>
                      </td>
                      <td className="txt-muted text-xs">{u.lastActive}</td>
                      <td className="txt-muted text-xs" dir="ltr">{u.joined}</td>
                      <td data-row-menu className="dash__actions-cell">
                        {/* تفعيلٌ من الصفّ مباشرة: البادج وحده يجرّ الأنظار،
                            وقرار التفعيل كان يحتاج ثلاث خطوات (البحث عن
                            الصفّ، فتح النافذة، ثم الضغط). ولحساب معلّق
                            وحده — «تفعيل» لحساب نشطٍ بلا أثر. */}
                        {u.status !== 'active' && u.status !== 'suspended' && (
                          <Tip label={`تفعيل ${u.name}`}>
                            <button
                              type="button"
                              className="dash__iconbtn"
                              aria-label={`تفعيل حساب ${u.name}`}
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActivate(u);
                              }}
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          </Tip>
                        )}
                        <Tip label={`إجراءات ${u.name}`}>
                          <button
                            type="button"
                            className="dash__menu-btn"
                            aria-label={`إجراءات ${u.name}`}
                            aria-haspopup="menu"
                            aria-expanded={menu?.id === u.id}
                            aria-controls="admin-user-actions-menu"
                            onClick={(e) => openRowMenu(e, u)}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </Tip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* شريط الترقيم */}
        {filtered.length > 0 && (
          <div className="dash__pager">
            <span className="dash__pager-info">
              عرض {start}–{end} من <b>{filtered.length}</b> مستخدماً
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="dash__pager-btn"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 1}
                aria-label="الصفحة السابقة"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && arr[i - 1] !== p - 1) acc.push('gap');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === 'gap' ? (
                    <span key={`gap-${idx}`} className="dash__pager-gap">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`dash__pager-btn${safePage === p ? ' is-active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                type="button"
                className="dash__pager-btn"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= totalPages}
                aria-label="الصفحة التالية"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* قائمة إجراءات الصف — AnimatePresence داخل البوابة لأن Framer Motion
          يتجاهل عناصر createPortal كأبناء (يرشّحها onlyElements) فلا تظهر القائمة. */}
      {menu &&
        createPortal(
          <AnimatePresence>
            <motion.div
              key="row-menu"
              ref={menuRef}
              id="admin-user-actions-menu"
              className="dash__menu dash__menu--fixed"
              data-row-menu
              role="menu"
              aria-label="إجراءات المستخدم"
              style={{ top: menu.top, left: menu.left }}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16 }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  openProfile(menuUser);
                  setMenu(null);
                }}
              >
                <Eye className="h-4 w-4" />
                عرض الملف
              </button>
              {/* «تفعيل» في القائمة الأمامية لا داخل «تغيير الحالة»: هو
                  القرار الذي يتكرر (معلّق ← نشط)، والقائمة الفرعية خطوتان
                  بعيدتان عنه. ولحساب ليس نشطاً ولا موقوفاً فقط. */}
              {menuUser && menuUser.status !== 'active' && menuUser.status !== 'suspended' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    handleActivate(menuUser);
                    setMenu(null);
                  }}
                >
                  <UserCheck className="h-4 w-4" />
                  تفعيل الحساب
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="has-sub"
                aria-haspopup="menu"
                aria-expanded={Boolean(menu.statusOpen)}
                aria-controls="admin-user-status-menu"
                onClick={toggleStatusMenu}
              >
                <RefreshCcw className="h-4 w-4" />
                تغيير الحالة
                <ChevronLeft className="dash__menu-caret h-4 w-4" />
              </button>
              <button
                type="button"
                role="menuitem"
                className={menuIsBlocked ? '' : 'is-danger-soft'}
                onClick={() => {
                  handleToggleSuspend(menuUser);
                  setMenu(null);
                }}
              >
                {menuIsBlocked ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    رفع الحظر
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    حظر المستخدم
                  </>
                )}
              </button>
              <span className="dash__menu-sep" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  setDeleteTarget(menu.id);
                  setMenu(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
                حذف
              </button>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* قائمة تغيير الحالة الفرعية */}
      {menu?.statusOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              key="row-status-menu"
              id="admin-user-status-menu"
              className="dash__menu dash__menu--fixed dash__menu--sub"
              data-row-menu
              role="menu"
              aria-label="تغيير حالة الحساب"
              style={{ top: menu.statusPos?.top ?? menu.top, left: menu.statusPos?.left ?? menu.left }}
              initial={{ opacity: 0, x: 6, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 6, scale: 0.97 }}
              transition={{ duration: 0.14 }}
            >
              {STATUS_ORDER.map((key) => {
                const meta = statusMeta[key];
                const MetaIcon = meta.Icon;
                const active = menuUser?.status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className={`dash__menu-status is-${meta.tone}${active ? ' is-active' : ''}`}
                    onClick={() => applyStatus(menu.id, key)}
                  >
                    <MetaIcon className="h-4 w-4" />
                    {meta.label}
                    {active && <Check className="dash__menu-check h-4 w-4" />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* نافذة منبثقة مركزية لملف المستخدم.
          المواصفة: بلا أزرار سفلية (لا «تعديل الحساب» ولا «عرض التفاصيل» ولا «إغلاق»
          أسفل) — الإغلاق من زر X العلوي فقط، ويبقى الإجراء drastic الوحيد
          (إيقاف/رفع حظر الحساب) لأنه يفقده المستخدم إن أُزيل. */}
      {activeProfile &&
        createPortal(
          <AnimatePresence>
            <motion.div
              key="profile-modal"
              className="modal-overlay"
              style={{
                zIndex: PROFILE_MODAL_Z,
                // نموذج التعديل يُفتح من داخل هذه النافذة، فنُخفي البطاقة
                // خلفه بدل ترك بطاقتين متقاطعتين: طبقتان معتمتان فوق بعضهما
                // تُعتِمان الصفحة مرّتين، وحافتان من بطاقة بيضاء تبرزان
                // حول النموذج. الإخفاء يحفظ الطبقتين: فإغلاقُ النموذج يكشف
                // الملف وقد حُفظت تعديلاته، لا نسخة قديمة منه.
                visibility: editTarget ? 'hidden' : undefined,
              }}
              role="dialog"
              aria-modal="true"
              aria-label={`ملف ${activeProfile.name}`}
              onClick={closeProfile}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <motion.div
                className="dash__modal"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.96, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 14 }}
                transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              >
                {/* الترويسة: الهوية + إغلاق X */}
                <div className="dash__drawer-head">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative shrink-0">
                      <span className="dash__avatar" style={{ width: '3.25rem', height: '3.25rem', fontSize: '1.05rem' }}>
                        {(activeProfile.name || 'م').trim().slice(0, 2)}
                      </span>
                      <PresenceDot online={activeProfile.online} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="m-0 truncate text-base font-extrabold" style={{ color: 'var(--text-strong)' }}>
                        {activeProfile.name}
                      </h3>
                      <p className="m-0 truncate text-xs" style={{ color: 'var(--text-muted)' }} dir="ltr">
                        {activeProfile.email}
                      </p>
                      <p className="m-0 truncate text-xs" style={{ color: 'var(--text-muted)' }} dir="ltr">
                        {activeProfile.phone}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dash__iconbtn shrink-0"
                    onClick={() => openEdit(activeProfile)}
                    aria-label="تعديل البيانات"
                    title="تعديل البيانات"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="dash__iconbtn shrink-0"
                    onClick={closeProfile}
                    aria-label="إغلاق"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="dash__drawer-body">
                  {/* شارات الدور والحالة والتحقق */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span data-role-badge={roleOf(activeProfile.role).key || 'unknown'}>
                  <StatusBadge tone={roleOf(activeProfile.role).tone}>{roleOf(activeProfile.role).label}</StatusBadge>
                </span>
                    <StatusBadge tone={statusMeta[activeProfile.status]?.tone}>
                      {statusMeta[activeProfile.status]?.label}
                    </StatusBadge>
                    {activeProfile.verified ? (
                      <StatusBadge tone="blue" icon={ShieldCheck}>تم التحقق</StatusBadge>
                    ) : (
                      <StatusBadge tone="amber" icon={Clock}>غير موثق</StatusBadge>
                    )}
                  </div>

                  {/* بطاقات المعلومات: 3 أعمدة على المتوسطة، عمودان على الصغيرة */}
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="dash__soft p-3 text-center">
                      <dt className="txt-caption text-xs">تاريخ الانضمام</dt>
                      <dd className="mt-1 text-sm font-bold" style={{ color: 'var(--text-strong)' }}>{activeProfile.joined}</dd>
                    </div>
                    <div className="dash__soft p-3 text-center">
                      <dt className="txt-caption text-xs">آخر نشاط</dt>
                      <dd className="mt-1 text-sm font-bold" style={{ color: 'var(--text-strong)' }}>{activeProfile.lastActive}</dd>
                    </div>
                    <div className="dash__soft col-span-2 p-3 text-center sm:col-span-1">
                      <dt className="txt-caption text-xs">إجمالي الحجوزات</dt>
                      <dd className="mt-1 text-sm font-bold" style={{ color: 'var(--text-strong)' }}>
                        <span className="num">{activeProfile.bookings}</span>
                      </dd>
                    </div>
                  </div>

                  {/* قسم التحقق والنشاط */}
                  <div className="dash__soft p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-strong)' }}>
                      <Activity className="h-4 w-4" />
                      التحقق والنشاط
                    </h4>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span style={{ color: 'var(--text-muted)' }}>حالة التحقق</span>
                        {activeProfile.verified ? (
                          <StatusBadge tone="blue" icon={ShieldCheck}>تم التحقق</StatusBadge>
                        ) : (
                          <StatusBadge tone="amber" icon={Clock}>غير موثق</StatusBadge>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span style={{ color: 'var(--text-muted)' }}>حالة الحساب</span>
                        <StatusBadge tone={statusMeta[activeProfile.status]?.tone}>
                          {statusMeta[activeProfile.status]?.label}
                        </StatusBadge>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span style={{ color: 'var(--text-muted)' }}>عدد الحجوزات</span>
                        <span className="num font-bold">{activeProfile.bookings} حجز</span>
                      </div>
                      {activeProfile.spaces.length > 0 && (
                        <div className="flex items-start justify-between gap-3">
                          <span style={{ color: 'var(--text-muted)' }}>المساحات</span>
                          <span className="text-end font-bold">
                            {activeProfile.spaces.map((s) => s?.name).filter(Boolean).join('، ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* قسم مستندات التحقق — لمالك المساحة الذي ينتظر قراراً.
                      يظهر له وحده: الحساب النشط لا قرار عليه، وغير المالك
                      لا تُرفع له وثائق أصلاً، فالقسم لهما زينة بلا معنى.

                      `?.length` لا `length`: الملف قد يُفتح برابط مباشر لمعرّف
                      غير موجود في الجدول، فيبقى `viewUser` خاماً بلا `documents`. */}
                  {isOwnerRole(activeProfile.role)
                    && activeProfile.status === STATUS_PENDING && (
                    <div className="dash__soft mt-4 p-4" data-owner-docs={String(activeProfile.documents?.length || 0)}>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-strong)' }}>
                        <FileText className="h-4 w-4" />
                        مستندات التحقق
                      </h4>
                      {activeProfile.documents?.length > 0 ? (
                        <ul className="m-0 list-none space-y-2 p-0">
                          {activeProfile.documents.map((doc) => (
                            <li key={doc.url}>
                              <a
                                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm no-underline transition hover:bg-black/5 dark:hover:bg-white/10"
                                href={imageUrl(doc.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-doc-kind={doc.kind}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <ExternalLink className="h-4 w-4 shrink-0" />
                                  <span className="truncate font-bold">{doc.label}</span>
                                </span>
                                {doc.name && (
                                  <span className="shrink-0 truncate text-xs" style={{ color: 'var(--text-muted)' }} dir="ltr">
                                    {doc.name}
                                  </span>
                                )}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="m-0 text-sm" style={{ color: 'var(--text-muted)' }}>
                          لم يصل مع الحساب أي مستند. راجع الوثائق مع صاحب الحساب قبل الاعتماد.
                        </p>
                      )}

{/* قرار الاعتماد هنا لا في التذييل: القرار يُتخذ بعد
                          قراءة المستندات، وفصله عنها يجعل الأدمن يفعّل حساباً
                          قبل أن يرى ما قدّمه.

          الزرّان هما قرارا الأدمن الوحيد على طلب التوثيق: «اعتماد التوثيق»
          ينقل الحساب من `pending` إلى `active`، و«إيقاف» ينقله إلى
          `suspended`. ولا ثالث بينهما، فأي حساب ينتظر قراراً لا يجد طريقاً
          ثالثاً يخرج به من الطابور. */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={btnPrimary}
                          onClick={() => handleActivate(activeProfile)}
                          disabled={busy}
                          data-owner-approve
                        >
                          <UserCheck className="h-4 w-4" />
                          اعتماد التوثيق
                        </button>
                        <button
                          type="button"
                          className={btnDanger}
                          onClick={() => setSuspendTarget(activeProfile)}
                          disabled={busy}
                          data-owner-suspend
                        >
                          <Ban className="h-4 w-4" />
                          إيقاف
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* قرار التفعيل والإيقاف: زرٌ واحد يتقلّب مع الحالة، وزر تفعيل يظهر
                    فقط لحساب ليس نشطاً. الحساب المعلّق هو الوحيد الذي
                    يحتاج تفعيلاً صريحاً، ولا يُرى ذلك إلا هنا — لا في
                    قائمة الصف ولا في نافذة الحظر ذاتها. */}
                <div className="dash__drawer-foot">
                  {activeProfile.status === 'suspended' ? (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => handleToggleSuspend(activeProfile)}
                      disabled={busy}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      رفع الحظر
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() => handleToggleSuspend(activeProfile)}
                      disabled={busy}
                    >
                      <Ban className="h-4 w-4" />
                      إيقاف الحساب
                    </button>
                  )}
                  {/* «تفعيل» يظهر فقط لحساب ليس نشطاً: حساب نشط لا قرار
                      له، وزرٌّ يفعّل ما هو مفعّل يفتح باب «فعّل» بلا أثر. */}
                  {activeProfile.status !== 'active' && (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => handleActivate(activeProfile)}
                      disabled={busy}
                    >
                      <UserCheck className="h-4 w-4" />
                      تفعيل الحساب
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* نافذة التعديل — تُفتح من زر القلم داخل نافذة الملف، فتمرّر رقم
          طبقةٍ أعلى منها صراحةً. */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        zIndex={EDIT_MODAL_Z}
        title={editTarget ? `تعديل حساب ${editTarget.name}` : 'تعديل الحساب'}
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="dash__field-label">الاسم الكامل</label>
                <input className="dash__input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <label className="dash__field-label">البريد الإلكتروني</label>
                <input className="dash__input" dir="ltr" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </div>
              <div>
                <label className="dash__field-label">الهاتف</label>
                <input className="dash__input" dir="ltr" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </div>
              <div>
                <label className="dash__field-label">الدور</label>
                {/* القائمة تعرض التصنيفين المعروضَين في الجدول نفسه (مالك مساحة
                    وفريلانسر)، والقيمة المعروضة هي **تصنيف** الدور لا قيمته
                    الخام: حساب `customer` يختار «فريلانسر» تلقائياً لأن هذا ما
                    تراه في صفّه. خيار بلا قيمة يبقى للدور المجهول، تركته يُظهر
                    أول خيار وكأنه اختيار المدير. */}
                <select className="dash__input" value={roleCategory(draft.role)} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                  {!roleCategory(draft.role) && <option value="">— اختر دوراً —</option>}
                  <option value={ROLE_SPACE_OWNER}>مالك مساحة</option>
                  <option value={ROLE_FREELANCER}>فريلانسر</option>
                </select>
              </div>
              <div>
                <label className="dash__field-label">الحالة</label>
                {/* الخيارات من `statusMeta` لا مكتوبة يدوياً: كان الحقل يعرض
                    `active`/`suspended`/`review` فقط، فحسابٌ حالته `pending`
                    لا يجد خياراته، فيهبط `<select>` إلى أول خيار ويبدو
                    «نشطاً» — وحفظ النموذج يكتب `active` على حسابٍ ينتظر قرار
                    تفعيله. التوليد من المصدر يجعل هذا السهو مستحيلاً.
                    والقيمة الحالية تُضاف إن لم تكن في المصدر (حالة مجهولة
                    من الخادم)، وإلا عاد السهو نفسه من باب آخر. */}
                <select className="dash__input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  {Object.entries(statusMeta).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                  {draft.status && !statusMeta[draft.status] && (
                    <option value={draft.status}>{draft.status}</option>
                  )}
                </select>
              </div>
              {/* لا حقل «التحقق» هنا: كان قائمةً في هذا النموذج تغيّر
                  `draft.verified` محلياً بينما `saveEdit` لا يرسل التوثيق في
                  أي طلب — فتُظهر للمستخدم «تم تحديث بيانات الحساب» بعد تغيير
                  لم يُحفظ. قرار التوثيق في مكانه: «اعتماد التوثيق» في نافذة
                  الملف، و«توثيق المحددين» في الإجراء الجماعي. */}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setEditTarget(null)}>
                إلغاء
              </button>
              <button type="button" className={btnPrimary} onClick={saveEdit}>
                حفظ التعديلات
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* تأكيد الحذف */}
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="حذف الحساب نهائياً؟">
        <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          سيتم حذف جميع بيانات المستخدم وحجوزاته نهائياً من المنصة، ولا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setDeleteTarget(null)}>
            إلغاء
          </button>
          <button type="button" onClick={handleDelete} className={btnDanger}>
            <Trash2 className="h-4 w-4" />
            نعم، احذف الحساب
          </button>
        </div>
      </Modal>

{/* تأكيد الإيقاف. الإيقاف قرارٌ على صاحب حساب ينتظر اعتماداً، فيفصله
          عن «اعتماد التوثيق» بنقرة واحدة: خطأ نقرة واحدة هنا يعني حساباً
          سليماً صار موقوفاً بلا مراجعة. */}
      <Modal open={Boolean(suspendTarget)} onClose={() => setSuspendTarget(null)} title="إيقاف الحساب؟">
        <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          سيُوقَف حساب {suspendTarget?.name} ولن يستطيع إضافة مساحات أو نشرها. تبقى بياناته محفوظة،
          ويمكنك إعادة التفعيل لاحقاً.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setSuspendTarget(null)}>
            إلغاء
          </button>
          <button
            type="button"
            className={btnDanger}
            onClick={() => confirmSuspend(suspendTarget)}
            disabled={busy}
            data-suspend-confirm
          >
            <Ban className="h-4 w-4" />
            نعم، أوقف الحساب
          </button>
        </div>
      </Modal>

      <Toast message={toast} onClose={dismiss} />
    </div>
  );

  function filteredActiveCount() {
    let n = 0;
    if (fVerif === 'verified' || fVerif === 'unverified') n += 1;
    if (fJoinedFrom || fJoinedTo) n += 1;
    if (fMinBookings) n += 1;
    return n;
  }
}
