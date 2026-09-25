import { useMemo, useState } from 'react';
import { Wallet, Percent, HandCoins, TrendingUp, ReceiptText, ChevronDown, ChevronLeft } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { financialRangeData, commissionBreakdown, adminStats } from '../../data/adminMockData';
import { StatCard, SectionCard, SectionHeading, MiniRow, Pill } from './ui';

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

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function fmtDate(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AdminFinancials() {
  const [range, setRange] = useState('month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [showExport, setShowExport] = useState(false);

  // النطاق المخصص يحتاج بيانات من نقطة نهاية التقارير — حتى ذلك الحين نستخدم
  // أحدث نطاق جاهز كبديل آمن بدل قراءة كائن غير موجود (كان يُسقط الصفحة).
  const dateError = custom.from && custom.to && custom.from > custom.to;
  const effectiveRange = (range === CUSTOM_RANGE ? DEFAULT_RANGE : range) || DEFAULT_RANGE;
  const data = financialRangeData[effectiveRange] || financialRangeData[DEFAULT_RANGE];

  const rangeLabel = useMemo(() => {
    if (range !== CUSTOM_RANGE) return ranges.find((r) => r.id === range)?.label || '';
    const from = custom.from || '—';
    const to = custom.to || '—';
    return `نطاق مخصص (من ${from} إلى ${to})`;
  }, [range, custom.from, custom.to]);

  const cards = [
    { icon: Wallet, label: 'إجمالي الإيرادات', value: data.revenue, currency: 'ش.ج', tone: 'green', commas: true },
    { icon: Percent, label: `عمولة المنصة (${RATE_LABEL})`, value: data.commission, currency: 'ش.ج', tone: 'orange', commas: true },
    { icon: HandCoins, label: 'مستحقات الملاك', value: data.payouts, currency: 'ش.ج', tone: 'violet', commas: true },
    { icon: TrendingUp, label: 'عدد الحجوزات', value: data.bookings, tone: 'blue', commas: true },
  ];

  const breakdown = useMemo(() => {
    if (effectiveRange === 'month') {
      return commissionBreakdown.map((c) => ({
        label: c.label,
        value: c.amount,
        fill: c.label.includes('عمولة')
          ? '#f97316'
          : c.label.includes('مستحقات')
            ? '#8b5cf6'
            : c.label.includes('مدفوعات')
              ? '#fbbf24'
              : '#10b981',
      }));
    }
    return [
      { label: 'الإيرادات', value: data.revenue, fill: '#10b981' },
      { label: 'العمولة', value: data.commission, fill: '#f97316' },
      { label: 'مستحقات الملاك', value: data.payouts, fill: '#8b5cf6' },
    ];
  }, [data, effectiveRange]);

  const netProfit = Math.max(0, data.commission - (adminStats.payoutsPending || 0));
  const closeExport = () => setShowExport(false);

  return (
    <div className="space-y-6">
      {/* نطاق التاريخ + أدوات التصدير */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ranges.map((r) => (
            <Pill key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </Pill>
          ))}
          <Pill
            active={range === 'custom'}
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
          >
            تصدير التقرير
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {showExport && (
            <div className="absolute end-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-[var(--border)] dark:bg-[#1c1c22]">
              <button
                type="button"
                className="w-full px-4 py-2.5 text-sm font-bold text-left transition hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                onClick={() => { closeExport(); alert('تصدير Excel'); }}
              >
                Excel
              </button>
              <button
                type="button"
                className="w-full px-4 py-2.5 text-sm font-bold text-left transition hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                onClick={() => { closeExport(); alert('تصدير PDF'); }}
              >
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* نطاق مخصص — اختيار التاريخ */}
      {range === CUSTOM_RANGE && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>
      )}

      {/* البطاقات */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* تفصيل التوزيع */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
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
                <YAxis tick={{ fontSize: 10 }} width={40} />
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
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={46}>
                  {breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeading icon={HandCoins} title="ملخص مالي سريع" subtitle="ملخص النطاق المحدد" />
          <ul className="space-y-3">
            <MiniRow tone="green" label="إجمالي الإيرادات" value={`${fmt(data.revenue)} ش.ج`} />
            <MiniRow tone="orange" label={`عمولة المنصة (${RATE_LABEL})`} value={`${fmt(data.commission)} ش.ج`} />
            <MiniRow tone="violet" label="مستحقات الملاك" value={`${fmt(data.payouts)} ش.ج`} />
            <MiniRow tone="sky" label="صافي ربح المنصة" value={`${fmt(netProfit)} ش.ج`} />
          </ul>
        </SectionCard>
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
          <a href="#" className="inline-flex items-center gap-1 text-sm font-extrabold transition hover:text-orange-600" style={{ color: 'var(--accent)' }}>
            عرض الكل ←
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="dash__table min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b text-xs" style={{ borderColor: 'var(--border)' }}>
                {['الإجراءات', 'رقم الحجز', 'المساحة', 'المالك', 'المبلغ', `العمولة (${RATE_LABEL})`, 'صافي المالك', 'التاريخ', 'الحالة'].map((h) => (
                  <th key={h} className={`whitespace-nowrap pb-3 pe-3 font-extrabold ${h === 'الإجراءات' || h === 'الحالة' ? 'text-center' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { id: '#BK-1021', space: 'استوديو الأناقة', owner: 'أحمد العمري', amount: 120, date: '2026-09-18', status: 'مكتمل' },
                { id: '#BK-1022', space: 'مساحة المهندسين', owner: 'خالد المصري', amount: 108, date: '2026-09-18', status: 'مؤكد' },
                { id: '#BK-1023', space: 'مركز ريادة الأعمال', owner: 'هبة الرنتيسي', amount: 100, date: '2026-09-17', status: 'مؤكد' },
                { id: '#BK-1024', space: 'مساحة العمل الوسطى', owner: 'ديما الجمل', amount: 75, date: '2026-09-16', status: 'متنازع' },
              ].map((t) => {
                const comm = Math.round(t.amount * COMMISSION_RATE);
                const net = t.amount - comm;
                return (
                  <tr key={t.id} className="border-b transition hover:bg-orange-50/50 dark:hover:bg-white/[0.03]" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-3 pe-3 text-center">
                      <button
                        type="button"
                        title="عرض التفاصيل"
                        aria-label="عرض التفاصيل"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                        onClick={() => alert(`عرض تفاصيل المعاملة ${t.id}`)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="py-3 pe-3 text-right font-extrabold"><span dir="ltr">{t.id}</span></td>
                    <td className="py-3 pe-3 text-right">{t.space}</td>
                    <td className="py-3 pe-3 text-right">{t.owner}</td>
                    <td className="py-3 pe-3 text-right font-bold text-amber-600">{t.amount} ش.ج</td>
                    <td className="py-3 pe-3 text-right font-medium text-orange-500">{comm} ش.ج</td>
                    <td className="py-3 pe-3 text-right font-medium text-emerald-600">{net} ش.ج</td>
                    <td className="py-3 pe-3 text-right text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(t.date)}</td>
                    <td className="py-3 pe-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${t.status === 'مكتمل' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : t.status === 'متنازع' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}