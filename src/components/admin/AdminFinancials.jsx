import { useState } from 'react';
import { Wallet, Percent, HandCoins, TrendingUp, ReceiptText, ChevronDown } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { financialRangeData, commissionBreakdown } from '../../data/adminMockData';
import { StatCard, SectionCard, SectionHeading, MiniRow, Pill } from './ui';

const ranges = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'year', label: 'السنة' },
];

function fmt(n) {
  return n.toLocaleString('en-US');
}

export default function AdminFinancials() {
  const [range, setRange] = useState('month');
  const [showExport, setShowExport] = useState(false);
  const data = financialRangeData[range];

  const cards = [
    { icon: Wallet, label: 'إجمالي الإيرادات', value: `${data.revenue} ش.ج`, tone: 'green' },
    { icon: Percent, label: 'عمولة المنصة (12%)', value: `${data.commission} ش.ج`, tone: 'orange' },
    { icon: HandCoins, label: 'مستحقات الملاك', value: `${data.payouts} ش.ج`, tone: 'violet' },
    { icon: TrendingUp, label: 'عدد الحجوزات', value: data.bookings, tone: 'blue' },
  ];

  const breakdownMap = {
    today: [
      { label: 'الإيرادات', value: data.revenue, fill: '#10b981' },
      { label: 'العمولة', value: data.commission, fill: '#f97316' },
      { label: 'مستحقات الملاك', value: data.payouts, fill: '#8b5cf6' },
    ],
    week: [
      { label: 'الإيرادات', value: data.revenue, fill: '#10b981' },
      { label: 'العمولة', value: data.commission, fill: '#f97316' },
      { label: 'مستحقات الملاك', value: data.payouts, fill: '#8b5cf6' },
    ],
    month: commissionBreakdown.map((c) => ({
      label: c.label,
      value: c.amount,
      fill: c.label.includes('عمولة') ? '#f97316' : c.label.includes('مستحقات') ? '#8b5cf6' : c.label.includes('حجوزات') || c.label.includes('إيرادات') ? '#10b981' : '#10b981',
    })),
    year: [
      { label: 'الإيرادات', value: data.revenue, fill: '#10b981' },
      { label: 'العمولة', value: data.commission, fill: '#f97316' },
      { label: 'مستحقات الملاك', value: data.payouts, fill: '#8b5cf6' },
    ],
  };

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
            onClick={() => setRange('custom')}
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
                onClick={() => { setShowExport(false); alert('تصدير Excel'); }}
              >
                Excel
              </button>
              <button
                type="button"
                className="w-full px-4 py-2.5 text-sm font-bold text-left transition hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                onClick={() => { setShowExport(false); alert('تصدير PDF'); }}
              >
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* نطاق مخصص — اختيار التاريخ */}
      {range === 'custom' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="custom-from" className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-gray-400">من</label>
            <input id="custom-from" type="date" className="dash__input w-full" />
          </div>
          <div>
            <label htmlFor="custom-to" className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-gray-400">إلى</label>
            <input id="custom-to" type="date" className="dash__input w-full" />
          </div>
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
            subtitle={`النطاق المحدد: ${ranges.find((r) => r.id === range)?.label}`}
          />
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdownMap[range]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  {breakdownMap[range].map((entry, index) => (
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
            <MiniRow tone="orange" label="عمولة المنصة (12%)" value={`${fmt(data.commission)} ش.ج`} />
            <MiniRow tone="violet" label="مستحقات الملاك" value={`${fmt(data.payouts)} ش.ج`} />
            <MiniRow tone="sky" label="صافي ربح المنصة" value={`${fmt(data.commission)} ش.ج`} />
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
                {['الإجراءات', 'رقم الحجز', 'المساحة', 'المالك', 'المبلغ', 'العمولة (12%)', 'صافي الملاك', 'التاريخ', 'الحالة'].map((h) => (
                  <th key={h} className="whitespace-nowrap pb-3 pe-3 font-extrabold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { id: '#BK-1021', space: 'استوديو الأناقة', owner: 'أحمد العمري', amount: 120, status: 'مكتمل' },
                { id: '#BK-1022', space: 'مساحة المهندسين', owner: 'خالد المصري', amount: 108, status: 'مؤكد' },
                { id: '#BK-1023', space: 'مركز ريادة الأعمال', owner: 'هبة الرنتيسي', amount: 100, status: 'مؤكد' },
                { id: '#BK-1024', space: 'مساحة العمل الوسطى', owner: 'ديما الجمل', amount: 75, status: 'متنازع' },
              ].map((t) => {
                const comm = Math.round(t.amount * 0.12);
                const net = t.amount - comm;
                return (
                  <tr key={t.id} className="border-b transition hover:bg-orange-50/50 dark:hover:bg-white/[0.03]" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-3 pe-3 font-extrabold"><span dir="ltr">{t.id}</span></td>
                    <td className="py-3 pe-3">{t.space}</td>
                    <td className="py-3 pe-3">{t.owner}</td>
                    <td className="py-3 pe-3 font-bold text-amber-600">{t.amount} ش.ج</td>
                    <td className="py-3 pe-3 font-medium text-orange-500">{comm} ش.ج</td>
                    <td className="py-3 pe-3 font-medium text-emerald-600">{net} ش.ج</td>
                    <td className="py-3 pe-3 text-xs" style={{ color: 'var(--text-muted)' }}>2026-09-18</td>
                    <td className="py-3 pe-3">
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