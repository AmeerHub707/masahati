import { useState } from 'react';
import { Wallet, Percent, Banknote, CalendarCheck } from 'lucide-react';
import { financials, CURRENCY } from '../../lib/adminMock';
import { Card } from './ui';

const RANGES = [
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
  const data = financials[range];

  const cards = [
    { icon: Wallet, label: 'إجمالي الإيرادات', value: `${fmt(data.revenue)} ${CURRENCY}`, tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
    { icon: Percent, label: 'عمولة المنصة', value: `${fmt(data.commission)} ${CURRENCY}`, tone: 'bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400' },
    { icon: Banknote, label: 'مستحقات الملاك', value: `${fmt(data.payouts)} ${CURRENCY}`, tone: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400' },
    { icon: CalendarCheck, label: 'عدد الحجوزات', value: fmt(data.bookings), tone: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400' },
  ];

  const commissionRate = data.revenue > 0 ? Math.round((data.commission / data.revenue) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                range === r.id
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-400">
          نسبة العمولة: {commissionRate}٪
        </span>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="flex flex-col gap-1">
              <span className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-gray-100">{c.value}</span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{c.label}</span>
            </Card>
          );
        })}
      </section>

      <Card>
        <h3 className="m-0 mb-3 text-base font-extrabold text-zinc-900 dark:text-gray-100">ملخص النطاق الزمني</h3>
        <p className="m-0 text-sm leading-7 text-gray-500 dark:text-gray-400">
          في {RANGES.find((r) => r.id === range).label} بلغت إيرادات المنصة <strong className="text-zinc-800 dark:text-gray-200">{fmt(data.revenue)} {CURRENCY}</strong>،
          منها عمولة منصة بقيمة <strong className="text-orange-500">{fmt(data.commission)} {CURRENCY}</strong>،
          بينما حُوّلت مستحقات الملاك بقيمة <strong className="text-emerald-600 dark:text-emerald-400">{fmt(data.payouts)} {CURRENCY}</strong> عبر {fmt(data.bookings)} عملية حجز.
        </p>
        <p className="m-0 mt-2 text-xs text-gray-400">
          ملاحظة: هذه أرقام وهمية للعرض، وستُربط لاحقاً بواجهة التقارير المالية في Laravel.
        </p>
      </Card>
    </div>
  );
}