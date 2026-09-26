import { useEffect, useMemo, useState } from 'react';
import { Wallet, Percent, HandCoins, TrendingUp, ReceiptText, ChevronDown, ChevronLeft, Printer } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { financialRangeData, financialDailySeries, financialDailySpan, commissionBreakdown, adminStats } from '../../data/adminMockData';
import { StatCard, SectionCard, SectionHeading, MiniRow, Pill, Toast, Modal, StatusBadge } from './ui';
import { useToast } from './useToast';
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
const COMMISSION_RATE = adminStats.platformCommission ?? 0.12;
const RATE_LABEL = `${Math.round(COMMISSION_RATE * 100)}%`;

const CURRENCY = 'ش.ج';

// معاملات حديثة — مرفوعة إلى النطاق العام لتُستخدم في الجدول وفي ملف التصدير معاً،
// فلا تتكرّر البيانات ولا يختلف ما يُطبع عمّا يُنزَّل.
const RECENT_TRANSACTIONS = [
  { id: '#BK-1021', space: 'استوديو الأناقة', owner: 'أحمد العمري', amount: 120, date: '2026-09-18', status: 'مكتمل' },
  { id: '#BK-1022', space: 'مساحة المهندسين', owner: 'خالد المصري', amount: 108, date: '2026-09-18', status: 'مؤكد' },
  { id: '#BK-1023', space: 'مركز ريادة الأعمال', owner: 'هبة الرنتيسي', amount: 100, date: '2026-09-17', status: 'مؤكد' },
  { id: '#BK-1024', space: 'مساحة العمل الوسطى', owner: 'ديما الجمل', amount: 75, date: '2026-09-16', status: 'متنازع' },
];

// عمود الإجراءات لا يُطبع (لا معنى لأزرار تفاعلية على الورق)، فالعناوين تبدأ
// من رقم الحجز. تُستخدم نفسها للجدول ولملف التصدير فيبقى ترتيبهما واحداً.
const TX_HEADERS = ['رقم الحجز', 'المساحة', 'المالك', `المبلغ (${CURRENCY})`, `العمولة (${RATE_LABEL})`, `صافي المالك (${CURRENCY})`, 'التاريخ', 'الحالة'];

// نبرة الشارة موحّدة بين الجدول والنافذة فلا يُرسم للحالة نفسها لونان.
const TX_STATUS_TONE = { مكتمل: 'green', مؤكد: 'blue', متنازع: 'red' };

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
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

// نطاقات التقارير: النطاق المخصص يُحسب من financialDailySeries (يوميّاً)،
// والباقي يقرأ من financialRangeData. كلاهما يُرجع نفس الشكل: { revenue,
// bookings, commission, payouts }.
const PRESET_RANGES = new Set(['today', 'week', 'month', 'year']);

function sumDaily(from, to) {
  const rows = financialDailySeries.filter((d) => d.date >= from && d.date <= to);
  const revenue = rows.reduce((sum, d) => sum + d.revenue, 0);
  return {
    revenue,
    bookings: rows.reduce((sum, d) => sum + d.bookings, 0),
    // العمولة تُشتقّ من مجموع الإيراد لا من جمع عمولات الأيام، فتبقى نسبة 12%
    // صحيحة عند أي نطاق — وعند اختيار سبتمبر كاملاً تنتج 28,980 بالضبط.
    commission: Math.round(revenue * COMMISSION_RATE),
    payouts: revenue - Math.round(revenue * COMMISSION_RATE),
  };
}

export default function AdminFinancials() {
  const [range, setRange] = useState('month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [showExport, setShowExport] = useState(false);
  const [txDetails, setTxDetails] = useState(null);
  const { toast, announce, dismiss } = useToast();

  // النطاق المخصص صار محسوباً من financialDailySeries بدل السقوط الصامت إلى
  // «هذا الشهر». نطاق ناقص أو معكوس لا نخترع له أرقاماً: نُبقي النطاق الجاهز
  // مع تنبيه، ونمنع التصدير حتى لا يُنزَّل ملف تحت عنوان لا يصفه.
  const dateError = Boolean(custom.from && custom.to && custom.from > custom.to);
  const customMissing = !custom.from || !custom.to;
  const customReady = !dateError && !customMissing;
  const useCustom = range === CUSTOM_RANGE && customReady;

  const effectiveRange = PRESET_RANGES.has(range) ? range : DEFAULT_RANGE;
  const rangeKey = useCustom ? CUSTOM_RANGE : effectiveRange;
  const data = (useCustom ? sumDaily(custom.from, custom.to) : financialRangeData[effectiveRange])
    || financialRangeData[DEFAULT_RANGE];
  const exportable = range !== CUSTOM_RANGE || customReady;

  // السلسلة اليومية تغطي سبتمبر 2026 فقط — يُقال ذلك صراحةً بدل أن يبدو نطاق
  // سنة كاملة كأنه سنة كاملة من البيانات.
  const outsideCoverage = range === CUSTOM_RANGE
    && ((custom.from && custom.from < financialDailySpan.from)
      || (custom.to && custom.to > financialDailySpan.to));

  const rangeLabel = useMemo(() => {
    if (range !== CUSTOM_RANGE) return ranges.find((r) => r.id === range)?.label || '';
    const from = custom.from || '—';
    const to = custom.to || '—';
    return `نطاق مخصص (من ${from} إلى ${to})`;
  }, [range, custom.from, custom.to]);

  const cards = [
    { icon: Wallet, label: 'إجمالي الإيرادات', value: data.revenue, currency: CURRENCY, tone: 'green', commas: true },
    { icon: Percent, label: `عمولة المنصة (${RATE_LABEL})`, value: data.commission, currency: CURRENCY, tone: 'orange', commas: true },
    { icon: HandCoins, label: 'مستحقات الملاك', value: data.payouts, currency: CURRENCY, tone: 'violet', commas: true },
    { icon: TrendingUp, label: 'عدد الحجوزات', value: data.bookings, tone: 'blue', commas: true },
  ];

  // الأعمدة كلها بلون العلامة الواحد — لا Cell ولا ألوان متعددة. breakdown يحمل
  // { label, value } فقط، واللون يأتي من <Bar fill> في مكان واحد.
  const breakdown = useMemo(() => {
    if (rangeKey === 'month') {
      return commissionBreakdown.map((c) => ({ label: c.label, value: c.amount }));
    }
    return [
      { label: 'الإيرادات', value: data.revenue },
      { label: 'العمولة', value: data.commission },
      { label: 'مستحقات الملاك', value: data.payouts },
    ];
  }, [data, rangeKey]);


  const netProfit = Math.max(0, data.commission - (adminStats.payoutsPending || 0));

  // حساب العمولة وصافي المالك مرّة واحدة يتشاركها الجدول وملف التصدير.
  const transactions = useMemo(
    () => RECENT_TRANSACTIONS.map((t) => {
      const commission = Math.round(t.amount * COMMISSION_RATE);
      return { ...t, commission, net: t.amount - commission };
    }),
    []
  );

  // نفس المؤشرات التي تعرضها البطاقات والملخّص — لكن كنصّ ثابت يُطبع ويُصدَّر.
  const kpis = useMemo(
    () => [
      ['إجمالي الإيرادات', `${fmt(data.revenue)} ${CURRENCY}`],
      [`عمولة المنصة (${RATE_LABEL})`, `${fmt(data.commission)} ${CURRENCY}`],
      ['مستحقات الملاك', `${fmt(data.payouts)} ${CURRENCY}`],
      ['صافي ربح المنصة', `${fmt(netProfit)} ${CURRENCY}`],
      ['عدد الحجوزات', fmt(data.bookings)],
      ['مدفوعات معلقة', `${fmt(adminStats.payoutsPending)} ${CURRENCY}`],
    ],
    [data, netProfit]
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
      ['نسبة العمولة', RATE_LABEL],
      [],
      ['المؤشر', `القيمة (${CURRENCY})`],
      ...kpis,
      [],
      ['توزيع الإيرادات', `المبلغ (${CURRENCY})`],
      ...breakdown.map((b) => [b.label, b.value]),
      [],
      TX_HEADERS,
      ...transactions.map((t) => [t.id, t.space, t.owner, t.amount, t.commission, t.net, fmtDate(t.date), t.status]),
    ]);
    announce('تم تصدير التقرير كملف CSV.');
  };

  return (
    <div className="space-y-6">
      {/* ترويسة الطباعة — تظهر على الورق فقط لأن الشريط الجانبي والعنوان مخفيّان */}
      <div className="fin-print-only fin-print-head">
        <h1>التقارير المالية</h1>
        <p>
          <span>النطاق: {rangeLabel}</span>
          <span>نسبة العمولة: {RATE_LABEL}</span>
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

      {/* نطاق مخصص — اختيار التاريخ */}
      {range === CUSTOM_RANGE && (
        <div className="fin-print-hide grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              {`البيانات اليومية المتاحة في النسخة التجريبية تغطي ${fmtDate(financialDailySpan.from)} — ${fmtDate(financialDailySpan.to)} فقط، وما خارجها غير محسوب.`}
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
            <MiniRow tone="orange" label={`عمولة المنصة (${RATE_LABEL})`} value={`${fmt(data.commission)} ${CURRENCY}`} />
            <MiniRow tone="violet" label="مستحقات الملاك" value={`${fmt(data.payouts)} ${CURRENCY}`} />
            <MiniRow tone="sky" label="صافي ربح المنصة" value={`${fmt(netProfit)} ${CURRENCY}`} />
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
                {TX_HEADERS.map((h) => (
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
                  <td className="py-3 pe-3 text-right font-bold text-amber-600">{`${t.amount} ${CURRENCY}`}</td>
                  <td className="py-3 pe-3 text-right font-medium text-orange-500">{`${t.commission} ${CURRENCY}`}</td>
                  <td className="py-3 pe-3 text-right font-medium text-emerald-600">{`${t.net} ${CURRENCY}`}</td>
                  <td className="py-3 pe-3 text-right text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(t.date)}</td>
                  <td className="py-3 pe-3 text-center">
                    <StatusBadge tone={TX_STATUS_TONE[t.status] || 'gray'}>{t.status}</StatusBadge>
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
            <div className="fin-receipt-row"><dt>تاريخ الحجز</dt><dd>{fmtDate(txDetails.date)}</dd></div>
            <div className="fin-receipt-row"><dt>الحالة</dt><dd>{txDetails.status}</dd></div>
            <div className="fin-receipt-row"><dt>{`إجمالي المبلغ (${CURRENCY})`}</dt><dd>{fmt(txDetails.amount)}</dd></div>
            <div className="fin-receipt-row"><dt>{`عمولة المنصة (${RATE_LABEL})`}</dt><dd>{fmt(txDetails.commission)}</dd></div>
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
              <StatusBadge tone={TX_STATUS_TONE[txDetails.status] || 'gray'}>{txDetails.status}</StatusBadge>
            </div>

            <ul className="space-y-2">
              <MiniRow tone="orange" label={`إجمالي المبلغ (${CURRENCY})`} value={fmt(txDetails.amount)} />
              <MiniRow tone="violet" label={`عمولة المنصة (${RATE_LABEL})`} value={fmt(txDetails.commission)} />
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
