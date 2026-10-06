import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Percent, HandCoins, TrendingUp, ReceiptText, ChevronDown, ChevronLeft, Printer } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  StatCard,
  SectionCard,
  SectionHeading,
  MiniRow,
  Pill,
  Toast,
  Modal,
  StatusBadge,
  DataSourceBanner,
  DataGate,
} from './ui';
import { useToast } from './useToast';
import useAdminData from './useAdminData';
import {
  getFinancialSummary,
  getFinancialDaily,
  getCommissionBreakdown,
  listTransactions,
  getSettings,
  getStats,
} from '../../lib/adminApi';
import {
  adaptAll,
  adaptCommissionBreakdown,
  adaptCommissionRate,
  adaptDailyFinancial,
  adaptFinancialSummary,
  adaptTransaction,
  numOrNull,
} from '../../lib/adminAdapters';
import { downloadCsv } from '../../utils/csv';

// لون العلامة الموحّد لكل أعمدة «توزيع الإيرادات» — لا ألوان متعدّدة، فالمحور
// كلّه مميّز بلون واحد يُقرأ كتسلسل لا كأجزاء مختلفة.
const BRAND_ORANGE = '#f97316';

const ranges = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'year', label: 'السنة' },
];

const CUSTOM_RANGE = 'custom';
const DEFAULT_RANGE = 'month';

// نافذة جلب السلسلة اليومية: العقد يسمح بـ366 يوماً كحدّ أقصى، فطلَب سنة
// متمرّرة تنتهي اليوم. النافذة السابقة (2000 → 2100) كانت تخطئ الحدّ بسنتين
// وتُرجع 400 من خادم حقيقي.
const DAILY_SPAN_DAYS = 365;

const CURRENCY = 'ش.ج';

// ثوابت فارغة لمكان الردّ: لا بيانات، لا ذاكرة مؤقتة تحمل أرقاماً.
const EMPTY_SERIES = [];
const EMPTY_ROWS = [];

// حالة المعاملة من عقد الـ API (§1.4): التسمية العربية للعرض واللون للشارة.
const TX_STATUS_LABEL = { completed: 'مكتمل', confirmed: 'مؤكد', disputed: 'متنازع' };
const TX_STATUS_TONE = { completed: 'green', confirmed: 'blue', disputed: 'red' };
// قيمة بديلة واحدة لا كذبة: الحقل ناقص في ردّ الخادم، فنقول ذلك بدل اسماً.
const UNKNOWN_OWNER = 'غير محدّد';

// اختصارات النطاق المخصص — تُحسب من تاريخ اليوم الحقيقي، لا من تغطية سلسلة
// وهمية. المرجع هو اليوم، والأيام السابقة تُشتقّ منه للخلف.
// البناء بـ Date.UTC لا new Date(str): تحليل 'YYYY-MM-DDT00:00:00' يعطي
// منتصف الليل **محلياً**، وtoISOString يُرجع UTC، فتنزلق النتيجة يوماً كاملاً
// إلى الوراء في كل توقّع شرق غرينتش (UTC+3 مثلاً). التاريخ هنا بيانات لا
// حدث، فيجب أن يكون النتيجة نفسها في كل منطقة زمنية.
function daysBack(to, n) {
  const [y, m, d] = to.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - (n - 1) * 86400000).toISOString().slice(0, 10);
}

// تاريخ اليوم بصيغة العقد، محسوب محلياً (بلا Date.now في جسم المكوّن كي لا
// يُعيد React Compiler تصيير المكوّن كل ثانية).
let TODAY_ISO = new Date().toISOString().slice(0, 10);

const monthStartOf = (iso) => `${iso.slice(0, 7)}-01`;

const DATE_PRESETS = [
  { id: 'yesterday', label: 'أمس', from: daysBack(TODAY_ISO, 2), to: daysBack(TODAY_ISO, 2) },
  { id: 'last7', label: 'آخر 7 أيام', from: daysBack(TODAY_ISO, 7), to: TODAY_ISO },
  { id: 'mtd', label: 'منذ بداية الشهر', from: monthStartOf(TODAY_ISO), to: TODAY_ISO },
];

// حدود كل نطاق جاهز — تُجمع أرقامه من السلسلة اليومية الواردة، فلا نقرأ من
// جدول محلي ونُظهر رقماً لا مصدر له.
const RANGE_WINDOWS = {
  today: { from: TODAY_ISO, to: TODAY_ISO },
  week: { from: daysBack(TODAY_ISO, 7), to: TODAY_ISO },
  month: { from: monthStartOf(TODAY_ISO), to: TODAY_ISO },
  year: { from: daysBack(TODAY_ISO, DAILY_SPAN_DAYS + 1), to: TODAY_ISO },
};

// المعاملات تأتي من نقطة نهاية المعاملات (§10.4) وفيها المالك محسوم من
// المساحة، فلا نحتاج ربطاً ولا جدول مساحات محلياً. الصفوف الفارغة نتيجة
// صحيحة (لا حجوزات) وتُعرض كحالة فارغة لا كأرقام مستعارة من شاشة أخرى.
function buildTransactions(rows) {
  const source = Array.isArray(rows) ? rows : [];
  return [...source]
    .sort((a, b) => (a.date === b.date ? (b.id ?? 0) - (a.id ?? 0) : (a.date < b.date ? 1 : -1)))
    .map((b) => ({
      id: b.ref ?? b.id,
      space: b.space ?? '—',
      owner: b.owner ?? UNKNOWN_OWNER,
      user: b.user ?? '—',
      hours: b.hours ?? 0,
      amount: b.amount ?? 0,
      date: b.date ?? '',
      // نُبقي المفتاح(raw) للون والعنوان العربي للعرض: لون الشارة يحتاج القيمة
      // كما في عقد الـ API، لا الترجمة.
      statusKey: b.status,
      status: TX_STATUS_LABEL[b.status] || b.status || '—',
    }));
}

// عمود الإجراءات لا يُطبع (لا معنى لأزرار تفاعلية على الورق)، فالعناوين تبدأ
// من رقم الحجز. تُستخدم نفسها للجدول ولملف التصدير فيبقى ترتيبهما واحداً.
// «المستخدم» (صاحب الحجز) عمود مستقل عن «المالك» (مالك المساحة): خلطهما كان
// سبب الخطأ أصلاً، وفصلهما يمنع تكراره.
// النسبة قد تتغيّر من الإعدادات، وثباتها هنا كان يجعل الترويسة تناقض الأرقام؛
// لذلك تُبنى العناوين داخل المكوّن (انظر txHeaders) من نسبة الخادم.

function fmt(n) {
  return Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : '—';
}

// محور القيم يُقرَّأ بصرياً لا حسابياً: 241,500 أربعة أرقام وعرض 40px لا يكفيها.
// يُختصر للأرقام الكبيرة (260K / 1.9M) ويُترك تحت الألف رقماً كاملاً.
// القيم في Tooltip تبقى كاملة — الاختصار للقراءة السريعة على المحور فقط.
function fmtCompact(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs < 1000) return fmt(v);
  const [div, suffix] = abs >= 1_000_000 ? [1_000_000, 'M'] : [1000, 'K'];
  const scaled = v / div;
  // نُسقّ الكسر بخانة واحدة فقط ثم نُسقط الأصفار الزائدة (1.0K ← 1K).
  const rounded = Math.round(scaled * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${suffix}`;
}

function fmtDate(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtStamp(d) {
  return d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
}

// نطاقات التقارير: كلها تُجمع من السلسلة اليومية (§10.2) فيرد الرقم نفسه
// من نفس المصدر دائماً، ونطاق مخصص يشترك في نفس الدالة فلا يختلف المنهج.
const PRESET_RANGES = new Set(['today', 'week', 'month', 'year']);

// السلسلة اليومية محور الحقيقة: كل نطاق (جاهز أو مخصص) مجموع صفوفها داخل
// نافذته. `rate` نسبة العمولة من الخادم؛ إن لم تصل فلا نخترع نسبة ولا
// نُظهر أرقام عمولة مختلقة.
function sumDaily(from, to, series, rate) {
  const rows = (series || []).filter((d) => d.date >= from && d.date <= to);
  const revenue = rows.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0);
  const commission = Number.isFinite(rate) ? Math.round(revenue * rate) : null;
  return {
    revenue,
    bookings: rows.reduce((sum, d) => sum + (Number(d.bookings) || 0), 0),
    pending: rows.reduce((sum, d) => sum + (Number(d.pending) || 0), 0),
    commission,
    payouts: commission === null ? null : revenue - commission,
  };
}

// المدفوعات المعلّقة رقمٌ لحظي من الخادم لا يتغيّر مع النطاق، فنسقّطه على كل
// نطاق بنسبة حجوزاته إلى حجوزات الشهر. إن لم يرد الرقم نُبقيه null ولا
// نُشتق صفراً من عدمه.
function pendingForPreset(range, data, { total, monthBookings }) {
  if (!Number.isFinite(total)) return null;
  if (range === 'month' || !monthBookings) return total;
  return Math.round(total * (data.bookings / monthBookings));
}

export default function AdminFinancials() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [showExport, setShowExport] = useState(false);
  const [txDetails, setTxDetails] = useState(null);
  const { toast, announce, dismiss } = useToast();

  // تاريخ اليوم يُلتقط مرّة عند فتح الشاشة: التواريخ النسبية تُشتقّ منه،
  // وتثبيته يمنع أن يختلف النطاق بين تصيير وآخر عند منتصف الليل.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  // العقد §10: ملخّص الشهر + السلسلة اليومية + تغطيتها + تفصيل العمولة.
  // السلسلة تُجلب مرّة واحدة بنافذة سنة، فتكفي كل نطاقات المخصصة أن تحسب نفسها
  // منها بدل أن تسأل الخادم عند كل ضغطة مفتاح.
  //
  // المحوّلات (adminAdapters) توحّد أسماء الحقول: السلسلة اليومية ترد
  // أحياناً مصفوفةً مباشرة وأحياناً في غلاف، ونسبة العمولة تأتي أحياناً
  // مئوية (12) وأحياناً كسراً (0.12) — فنوحّدها على الكسر قبل العرض.
  const fetchFinancials = useCallback(async () => {
    const [summary, daily, breakdown, tx, settings, stats] = await Promise.all([
      getFinancialSummary({ range: DEFAULT_RANGE }),
      getFinancialDaily({ from: daysBack(today, DAILY_SPAN_DAYS + 1), to: today }),
      getCommissionBreakdown(),
      listTransactions({ range: DEFAULT_RANGE }),
      getSettings(),
      getStats(),
    ]);
    const chart = adaptDailyFinancial(daily);
    const cleanSummary = adaptFinancialSummary(summary);

    return {
      summary: summary && typeof summary === 'object' ? cleanSummary : null,
      series: chart.series,
      // التغطية تُقرأ كما وردت؛ غيابها يعني «غير معلنة» لا «بيانات كل شيء».
      span: chart.coverage,
      breakdown: adaptCommissionBreakdown(breakdown),
      txRows: adaptAll(tx?.rows, adaptTransaction),
      rate: cleanSummary.commission_rate
        ?? adaptCommissionRate(settings?.commission_rate),
      // المدفوعات المعلّقة ليست في الملخّص، بل في `stats.payoutsPending`،
      // فنقرأها من هناك عند غيابها. ولا نصل إلى أي بديل آخر: أرقام التقرير
      // يجب أن تأتي من الخادم أو تبقى `null`.
      payoutsPending: numOrNull(cleanSummary.payouts_pending ?? stats?.payoutsPending),
      monthBookings: numOrNull(cleanSummary.bookings),
    };
  }, [today]);

  const {
    data: fin,
    loading,
    error: loadError,
    live,
    reload,
  } = useAdminData(fetchFinancials);

  // نسبة العمولة من الخادم: الرقم قد يكون 0.10 بعد تعديله من الإعدادات، وإظهار
  // 12% ثابتاً كان يجعل الترويسة تناقض أرقام التقرير نفسها. بلا نسبة من
  // الخادم نعرض شرطة لا تخميناً.
  const rate = fin?.rate ?? null;
  const rateLabel = Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : '—';

  // الأشتقّات كلها تعمل قبل وصول الردّ على مدخلات فارغة، فتبقى الـ hooks في
  // ترتيبها الثابت في كل تصيير. الأرقام التي نُخرجها من ردّ فارغ لا تُعرض
  // أبداً: فرع التحميل/الخطأ أدناه يسبّق كل بطاقة.
  const series = fin?.series ?? EMPTY_SERIES;
  const span = fin?.span ?? null;
  const breakdownFromApi = fin?.breakdown ?? EMPTY_ROWS;
  const txRows = fin?.txRows ?? EMPTY_ROWS;
  const pendingTotal = Number.isFinite(fin?.payoutsPending) ? fin.payoutsPending : null;
  const monthBookings = Number.isFinite(fin?.monthBookings) ? fin.monthBookings : null;

  // العناوين تتبع النسبة الفعلية، فيبقى رأس الجدول وملف التصدير متفقين مع
  // أرقام العمولة المعروضة أمامها.
  const txHeaders = useMemo(
    () => [
      'رقم الحجز',
      'المساحة',
      'المالك',
      'المستخدم',
      `المبلغ (${CURRENCY})`,
      `عمولة المنصة (${rateLabel})`,
      `صافي المالك (${CURRENCY})`,
      'التاريخ',
      'الحالة',
    ],
    [rateLabel]
  );

  // النطاق المخصص صار محسوباً من السلسلة اليومية بدل السقوط الصامت إلى
  // «هذا الشهر». نطاق ناقص أو معكوس لا نخترع له أرقاماً: نُبقي النطاق الجاهز
  // مع تنبيه، ونمنع التصدير حتى لا يُنزَّل ملف تحت عنوان لا يصفه.
  const dateError = Boolean(custom.from && custom.to && custom.from > custom.to);
  const customMissing = !custom.from || !custom.to;
  const customReady = !dateError && !customMissing;
  const useCustom = range === CUSTOM_RANGE && customReady;

  // حساب النطاق المخصص يُعدّ مسبقاً (قد يكون null) فيُقرأ في المؤشرات كلها.
  const customData = useMemo(
    () => (customReady ? sumDaily(custom.from, custom.to, series, rate) : null),
    [customReady, custom.from, custom.to, series, rate]
  );

  const effectiveRange = PRESET_RANGES.has(range) ? range : DEFAULT_RANGE;
  const rangeKey = useCustom ? CUSTOM_RANGE : effectiveRange;

  // كل نطاق جاهز مجموع من السلسلة اليومية: نافذته من تاريخ اليوم، وقيمته من
  // صفوف الخادم. لا جدول محلي ولا قيمة احتياطية.
  const presetWindow = RANGE_WINDOWS[effectiveRange];
  const data = useMemo(
    () => (useCustom ? customData : sumDaily(presetWindow.from, presetWindow.to, series, rate)),
    [useCustom, customData, presetWindow.from, presetWindow.to, series, rate]
  );

  const exportable = range !== CUSTOM_RANGE || customReady;

  // حدود التغطية تأتي من الخادم، ويُقال ذلك صراحةً بدل أن يبدو نطاق سنة كاملة
  // كأنه سنة كاملة من البيانات. بلا تغطية معلنة لا تدّعي الشاشة شيئاً.
  const outsideCoverage = Boolean(
    span && range === CUSTOM_RANGE
      && ((custom.from && custom.from < span.from) || (custom.to && custom.to > span.to))
  );

  const rangeLabel = useMemo(() => {
    if (range !== CUSTOM_RANGE) return ranges.find((r) => r.id === range)?.label || '';
    const from = custom.from || '—';
    const to = custom.to || '—';
    return `نطاق مخصص (من ${from} إلى ${to})`;
  }, [range, custom.from, custom.to]);

  // قيمة للعرض: الرقم من الخادم، أو '—' إن لم يرد — ولا صفر بديل.
  const money = (value) => (Number.isFinite(value) ? `${fmt(value)} ${CURRENCY}` : '—');

  const cards = [
    { icon: Wallet, label: 'إجمالي الإيرادات', value: data.revenue, currency: CURRENCY, tone: 'green', commas: true },
    {
      icon: Percent,
      label: `عمولة المنصة (${rateLabel})`,
      value: data.commission ?? '—',
      currency: data.commission === null ? '' : CURRENCY,
      tone: 'orange',
      commas: true,
    },
    {
      icon: HandCoins,
      label: 'مستحقات الملاك',
      value: data.payouts ?? '—',
      currency: data.payouts === null ? '' : CURRENCY,
      tone: 'violet',
      commas: true,
    },
    { icon: TrendingUp, label: 'عدد الحجوزات', value: data.bookings, tone: 'blue', commas: true },
  ];

  // الأعمدة كلها بلون العلامة الواحد — لا Cell ولا ألوان متعددة. breakdown يحمل
  // { label, value } فقط، واللون يأتي من <Bar fill> في مكان واحد.
  const breakdown = useMemo(() => {
    if (rangeKey === 'month' && breakdownFromApi.length) {
      return breakdownFromApi.map((c) => ({ label: c.label, value: c.amount }));
    }
    return [
      { label: 'الإيرادات', value: data.revenue },
      { label: 'العمولة', value: data.commission ?? 0 },
      { label: 'مستحقات الملاك', value: data.payouts ?? 0 },
    ];
  }, [data, rangeKey, breakdownFromApi]);


  // المدفوعات المعلّقة تخصّ النطاق المعروض لا كل النطاقات: للنطاق المخصص
  // تُجمع من السلسلة اليومية، وللجاهز تُوزَّع بنسبة حجوزاته إلى حجوزات الشهر
  // فيعود رقم الشهر كما ورد من الخادم. بلا رقم من الخادم يبقى null.
  const pending = useCustom
    ? customData.pending
    : pendingForPreset(rangeKey, data, { total: pendingTotal, monthBookings });

  // صافي ربح المنصة = عمولة النطاق − مدفوعاته المعلّقة، وقد يكون سالباً فعلاً
  // (عمولة يوم أقلّ من مدفوعاته المعلّقة) فلا نقصّه عند الصفر ونُخفي الحقيقة.
  const netProfit = Number.isFinite(data.commission) && Number.isFinite(pending)
    ? data.commission - pending
    : null;

  // حساب العمولة وصافي المالك مرّة واحدة يتشاركها الجدول وملف التصدير.
  const transactions = useMemo(
    () => buildTransactions(txRows).map((t) => {
      const commission = Number.isFinite(rate) ? Math.round(t.amount * rate) : null;
      return { ...t, commission, net: commission === null ? null : t.amount - commission };
    }),
    [txRows, rate]
  );

  // نفس المؤشرات التي تعرضها البطاقات والملخّص — لكن كنصّ ثابت يُطبع ويُصدَّر.
  const kpis = useMemo(
    () => [
      ['إجمالي الإيرادات', money(data.revenue)],
      [`عمولة المنصة (${rateLabel})`, money(data.commission)],
      ['مستحقات الملاك', money(data.payouts)],
      ['صافي ربح المنصة', money(netProfit)],
      ['عدد الحجوزات', fmt(data.bookings)],
      ['مدفوعات معلقة', money(pending)],
    ],
    [data, netProfit, pending, rateLabel]
  );

  const closeExport = () => setShowExport(false);

  // الإيصال يُطبع وحده: نضع صنفاً على <body> فيحتفظ المتصفح بالتخطيط لكن
  // يُخفي كل شيء عدا كتلة الإيصال (visibility لا يلغي التخطيط، فلا تنهار الصفحة).
  // التنظيف على afterprint لأن بعض المتصفحات لا تُطلق beforeprint.
  useEffect(() => {
    const clear = () => document.body.classList.remove('is-receipt-print');
    window.addEventListener('afterprint', clear);
    // شبكة أمان: إن أُلغيت الطباعة دون إطلاق afterprint يبقى الصنف بلا أثر حقيقي
    // (قواعده داخل @media print) لكن نُزيله عند إغلاق الإيصال.
    return () => {
      window.removeEventListener('afterprint', clear);
      clear();
    };
  }, []);

  const printReceipt = () => {
    if (!txDetails) return;
    document.body.classList.add('is-receipt-print');
    window.print();
  };

  // إغلاق النافذة يزيل صنف الطباعة أيضاً: لو أُلغيت الطباعة دون إطلاق afterprint
  // لبقي الصنف بلا تنظيف (لا أثر له على الشاشة، لكن يُبقى قائماً بلا داعٍ).
  const closeTx = () => {
    document.body.classList.remove('is-receipt-print');
    setTxDetails(null);
  };

  // PDF عبر نافذة الطباعة الأصلية: المتصفح يطبع محتوى الصفحة فعلياً (نصوص حية
  // محدّدة الأرقام) — فلا نحتاج مكتبة تولّد PDF من DOM وتضيف وزناً للحزمة.
  const handleExportPdf = () => {
    if (!exportable) return;
    closeExport();
    window.print();
    announce('اختر «حفظ كملف PDF» من نافذة الطباعة.');
  };

  const handleExportCsv = () => {
    if (!exportable) return;
    closeExport();
    const now = new Date();
    downloadCsv(`masahati-financials-${rangeKey}-${now.toISOString().slice(0, 10)}.csv`, [
      ['التقرير', 'التقارير المالية'],
      ['النطاق', rangeLabel],
      ['تاريخ التصدير', fmtStamp(now)],
      ['نسبة العمولة', rateLabel],
      [],
      ['المؤشر', `القيمة (${CURRENCY})`],
      ...kpis,
      [],
      ['توزيع الإيرادات', `المبلغ (${CURRENCY})`],
      ...breakdown.map((b) => [b.label, b.value]),
      [],
      txHeaders,
      ...transactions.map((t) => [t.id, t.space, t.owner, t.user, t.amount, t.commission, t.net, fmtDate(t.date), t.status]),
    ]);
    announce('تم تصدير التقرير كملف CSV.');
  };

  // لا بطاقة ولا رسم قبل وصول ردّ واحد من الخادم: الأرقام المستخرجة من ردّ
  // فارغ كانت ستُعرض كأصفار حقيقية. البوابة تأتي بعد كل الـ hooks كي لا
  // يتغيّر ترتيبها، وتختار بين الانتظار والخطأ وغياب الجلسة بنفس القواعد.
  if (!fin) {
    return (
      <DataGate
        live={live}
        loading={loading}
        error={loadError}
        onRetry={reload}
        rows={4}
        errorTitle="تعذّر جلب التقارير المالية"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="fin-print-hide">
        <DataSourceBanner live={live} loading={loading} error={loadError} onRetry={reload} />
      </div>
      {/* ترويسة الطباعة — تظهر على الورق فقط لأن الشريط الجانبي والعنوان مخفيّان */}
      <div className="fin-print-only fin-print-head">
        <h1>التقارير المالية</h1>
        <p>
          <span>النطاق: {rangeLabel}</span>
          <span>نسبة العمولة: {rateLabel}</span>
          <span>تاريخ الطباعة: {fmtStamp(new Date())}</span>
        </p>
      </div>

      {/* نطاق التاريخ + أدوات التصدير */}
      <div className="fin-print-hide flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ranges.map((r) => (
            <Pill key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </Pill>
          ))}
          <Pill
            active={range === CUSTOM_RANGE}
            onClick={() => setRange(CUSTOM_RANGE)}
          >
            نطاق مخصص
          </Pill>
        </div>
        <div className="relative">
          <button
            type="button"
            className="dash__toolbtn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
            onClick={() => setShowExport((s) => !s)}
            aria-expanded={showExport}
            aria-haspopup="menu"
            disabled={!exportable}
            title={exportable ? undefined : 'حدّد تاريخي البداية والنهاية لتفعيل التصدير'}
          >
            تصدير التقرير
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {showExport && (
            <div className="dash__menu dash__menu--inline" role="menu" aria-label="تصدير التقرير">
              <button
                type="button"
                role="menuitem"
                onClick={handleExportCsv}
              >
                <ReceiptText className="h-4 w-4" />
                CSV / Excel
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleExportPdf}
              >
                <ReceiptText className="h-4 w-4" />
                طباعة / حفظ PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* نطاق مخصص — اختصارات ثم اختيار التاريخ.
          الاختصارات تحسب من تغطية
          «أخر 7 أيام» فنال نطاقاً خارج البيانات فظهر صفراً بلا سبب. */}
      {range === CUSTOM_RANGE && (
        <div className="fin-print-hide grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">اختصارات:</span>
            {DATE_PRESETS.map((p) => (
              <Pill key={p.id} onClick={() => setCustom({ from: p.from, to: p.to })}>
                {p.label}
              </Pill>
            ))}
          </div>
          <div>
            <label htmlFor="custom-from" className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-gray-400">من</label>
            <input
              id="custom-from"
              type="date"
              className="dash__input w-full"
              value={custom.from}
              max={custom.to || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="custom-to" className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-gray-400">إلى</label>
            <input
              id="custom-to"
              type="date"
              className="dash__input w-full"
              value={custom.to}
              min={custom.from || undefined}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            />
          </div>
          {dateError && (
            <p role="alert" className="text-xs font-bold text-red-600 sm:col-span-2 dark:text-red-400">
              تاريخ البداية يجب أن يسبق تاريخ النهاية — يتم عرض أحدث نطاق جاهز بدلاً منه.
            </p>
          )}
          {!dateError && customMissing && (
            <p className="text-xs font-bold text-amber-600 sm:col-span-2 dark:text-amber-400">
              حدّد تاريخ البداية والنهاية لعرض أرقام هذا النطاق — حالياً يُعرض أحدث نطاق جاهز.
            </p>
          )}
          {outsideCoverage && (
            <p className="text-xs font-bold text-amber-600 sm:col-span-2 dark:text-amber-400">
              {`البيانات اليومية في الخادم تغطي ${fmtDate(span.from)} — ${fmtDate(span.to)} فقط، وما خارجها غير محسوب.`}
            </p>
          )}
        </div>
      )}

      {/* البطاقات — لا تُطبع: العدّاد التصاعدي (DashCountUp) يبدأ من الصفر
          ويملأ قيمته عند الظهور، فقد تخرج أصفاراً إذا طُبع قبل اكتمال الحركة.
          البديل الطباعي ثابت النصّ ويأتي من نفس المصدر (kpis) أدناه. */}
      <div className="fin-print-hide grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* تفصيل التوزيع */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard className="fin-print-hide">
          <SectionHeading
            icon={ReceiptText}
            title="توزيع الإيرادات"
            subtitle={`النطاق المحدد: ${rangeLabel}`}
          />
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="opacity-40 dark:opacity-20" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: "'Cairo', sans-serif" }} />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  cursor={{ fill: 'rgba(249,115,22,0.08)' }}
                  formatter={(v) => [`${fmt(v)} ش.ج`, 'المبلغ']}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    background: 'var(--surface)',
                    color: 'var(--text-strong)',
                    fontFamily: "'Cairo', sans-serif",
                    fontSize: 12,
                    direction: 'rtl',
                  }}
                />
                <Bar dataKey="value" fill={BRAND_ORANGE} radius={[6, 6, 0, 0]} maxBarSize={46} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard className="fin-print-hide">
          <SectionHeading icon={HandCoins} title="ملخص مالي سريع" subtitle="ملخص النطاق المحدد" />
          <ul className="space-y-3">
            <MiniRow tone="green" label="إجمالي الإيرادات" value={`${fmt(data.revenue)} ${CURRENCY}`} />
            <MiniRow tone="orange" label={`عمولة المنصة (${rateLabel})`} value={`${fmt(data.commission)} ${CURRENCY}`} />
            <MiniRow tone="violet" label="مستحقات الملاك" value={`${fmt(data.payouts)} ${CURRENCY}`} />
            <MiniRow tone="sky" label={`مدفوعات معلّقة (${rangeLabel})`} value={money(pending)} />
            <MiniRow
              tone={netProfit < 0 ? 'orange' : 'sky'}
              label="صافي ربح المنصة"
              value={money(netProfit)}
            />
          </ul>
        </SectionCard>
      </div>

      {/* البديل الطباعي للرسوم والبطاقات — نصوص ثابتة، تُطبع فقط */}
      <div className="fin-print-only fin-print-kpis">
        <h2>ملخّص المؤشرات</h2>
        <dl>
          {kpis.map(([label, value]) => (
            <div key={label} className="fin-print-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <h2>توزيع الإيرادات</h2>
        <dl>
          {breakdown.map((b) => (
            <div key={b.label} className="fin-print-row">
              <dt>{b.label}</dt>
              <dd>{`${fmt(b.value)} ${CURRENCY}`}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* معاملات حديثة */}
      <SectionCard>
        <div className="dash__section-head mb-4 flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: '1rem' }}>
          <div className="flex items-center gap-3">
            <span className="st-ico"><ReceiptText /></span>
            <div>
              <h2 style={{ margin: 0, display: 'block' }}>معاملات حديثة</h2>
              <p className="m-0 text-sm" style={{ margin: '.1rem 0 0', fontSize: '.82rem', color: 'var(--text-muted)' }}>آخر الحجوزات والدفعات</p>
            </div>
          </div>
          <a href="/admin/bookings" className="fin-print-hide inline-flex items-center gap-1 text-sm font-extrabold transition hover:text-orange-600" style={{ color: 'var(--accent)' }}>
            عرض الكل ←
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="dash__table min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                <th className="fin-print-hide whitespace-nowrap pb-3 pe-3 text-center font-extrabold" style={{ color: 'var(--text-muted)' }}>الإجراءات</th>
                {txHeaders.map((h) => (
                  <th key={h} className={`whitespace-nowrap pb-3 pe-3 font-extrabold ${h === 'الحالة' ? 'text-center' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b transition hover:bg-orange-50/50 dark:hover:bg-white/[0.03]" style={{ borderColor: 'var(--border)' }}>
                  <td className="fin-print-hide py-3 pe-3 text-center">
                    <button
                      type="button"
                      title="عرض التفاصيل"
                      aria-label={`عرض تفاصيل المعاملة ${t.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                      onClick={() => setTxDetails(t)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="py-3 pe-3 text-right font-extrabold"><span dir="ltr">{t.id}</span></td>
                  <td className="py-3 pe-3 text-right">{t.space}</td>
                  <td className="py-3 pe-3 text-right">{t.owner}</td>
                  <td className="py-3 pe-3 text-right">{t.user}</td>
                  <td className="py-3 pe-3 text-right font-bold text-amber-600">{`${t.amount} ${CURRENCY}`}</td>
                  <td className="py-3 pe-3 text-right font-medium text-orange-500">{`${t.commission} ${CURRENCY}`}</td>
                  <td className="py-3 pe-3 text-right font-medium text-emerald-600">{`${t.net} ${CURRENCY}`}</td>
                  <td className="py-3 pe-3 text-right text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(t.date)}</td>
                  <td className="py-3 pe-3 text-center">
                    <StatusBadge tone={TX_STATUS_TONE[t.statusKey] || 'gray'}>{t.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* إيصال الطباعة — كتلة شقيقة للنافذة لا داخلها: قاعدة .modal-overlay
          في @media print (index.css) تخفي النافذة عن الورق، فإيصال داخلها
          لا يُطبع أبداً. تُعرض هذه الكتلة على الشاشة ولا تطبع إلا
          عند وجود الصنف is-receipt-print على body. */}
      {txDetails && (
        <div className="fin-receipt">
          <div className="fin-receipt-head">
            <h1>إيصال معاملة</h1>
            <p>
              <span>رقم الحجز: {txDetails.id}</span>
              <span>تاريخ الطباعة: {fmtStamp(new Date())}</span>
            </p>
          </div>
          <dl>
            <div className="fin-receipt-row"><dt>المساحة</dt><dd>{txDetails.space}</dd></div>
            <div className="fin-receipt-row"><dt>المالك</dt><dd>{txDetails.owner}</dd></div>
            <div className="fin-receipt-row"><dt>المستخدم</dt><dd>{txDetails.user}</dd></div>
            <div className="fin-receipt-row"><dt>تاريخ الحجز</dt><dd>{fmtDate(txDetails.date)}</dd></div>
            <div className="fin-receipt-row"><dt>الحالة</dt><dd>{txDetails.status}</dd></div>
            <div className="fin-receipt-row"><dt>{`إجمالي المبلغ (${CURRENCY})`}</dt><dd>{fmt(txDetails.amount)}</dd></div>
            <div className="fin-receipt-row"><dt>{`عمولة المنصة (${rateLabel})`}</dt><dd>{fmt(txDetails.commission)}</dd></div>
            <div className="fin-receipt-row is-total"><dt>{`صافي مستحقات المالك (${CURRENCY})`}</dt><dd>{fmt(txDetails.net)}</dd></div>
          </dl>
        </div>
      )}

      <Modal
        open={Boolean(txDetails)}
        onClose={closeTx}
        title={txDetails ? `تفاصيل المعاملة ${txDetails.id}` : 'تفاصيل المعاملة'}
        wide
      >
        {txDetails && (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['رقم الحجز', txDetails.id],
                ['المساحة', txDetails.space],
                ['المالك', txDetails.owner],
                ['المستخدم', txDetails.user],
                ['التاريخ', fmtDate(txDetails.date)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="dash__field-label">{label}</dt>
                  <dd className="font-extrabold" style={{ color: 'var(--text-strong)' }}>{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex items-center gap-2">
              <span className="text-[.8rem] font-bold" style={{ color: 'var(--text-muted)' }}>
                الحالة:
              </span>
              <StatusBadge tone={TX_STATUS_TONE[txDetails.statusKey] || 'gray'}>{txDetails.status}</StatusBadge>
            </div>

            <ul className="space-y-2">
              <MiniRow tone="orange" label={`إجمالي المبلغ (${CURRENCY})`} value={fmt(txDetails.amount)} />
              <MiniRow tone="violet" label={`عمولة المنصة (${rateLabel})`} value={fmt(txDetails.commission)} />
              <MiniRow tone="green" label={`صافي مستحقات المالك (${CURRENCY})`} value={fmt(txDetails.net)} />
            </ul>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={closeTx}>
                إغلاق
              </button>
              <button type="button" className="btn-primary" onClick={printReceipt}>
                <Printer className="h-4 w-4" />
                طباعة الإيصال
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toast message={toast} onClose={dismiss} icon={ReceiptText} />
    </div>
  );
}
