import { useState } from 'react';
import { Wallet, Percent, HandCoins, TrendingUp, ReceiptText } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
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
  const data = financialRangeData[range];

  const cards = [
    { icon: Wallet, label: 'إجمالي الإيرادات', value: `${data.revenue} ش.ج`, tone: 'green' },
    { icon: Percent, label: 'عمولة المنصة (12%)', value: `${data.commission} ش.ج`, tone: 'orange' },
    { icon: HandCoins, label: 'مستحقات الملاك', value: `${data.payouts} ش.ج`, tone: 'violet' },
    { icon: TrendingUp, label: 'عدد الحجوزات', value: data.bookings, tone: 'blue' },
  ];

  const breakdownMap = {
    today: [
      { label: 'الإيرادات', value: data.revenue },
      { label: 'العمولة', value: data.commission },
      { label: 'مستحقات الملاك', value: data.payouts },
    ],
    week: [
      { label: 'الإيرادات', value: data.revenue },
      { label: 'العمولة', value: data.commission },
      { label: 'مستحقات الملاك', value: data.payouts },
    ],
    month: commissionBreakdown.map((c) => ({ label: c.label, value: c.amount })),
    year: [
      { label: 'الإيرادات', value: data.revenue },
      { label: 'العمولة', value: data.commission },
      { label: 'مستحقات الملاك', value: data.payouts },
    ],
  };

  return (
    <div className="space-y-6">
      {/* نطاق التاريخ */}
      <div className="flex flex-wrap gap-2">
        {ranges.map((r) => (
          <Pill key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>
            {r.label}
          </Pill>
        ))}
      </div>

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
                <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={46} />
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
    </div>
  );
}