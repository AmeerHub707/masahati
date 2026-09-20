import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  MapPin,
  CalendarCheck,
  Wallet,
  Scale,
  Sparkles,
  TicketCheck,
  MessageSquare,
  UserPlus,
  Banknote,
} from 'lucide-react';
import {
  overviewMetrics,
  revenueTrend,
  bookingTrend,
  activities,
  recentRegistrations,
  ROLE_LABELS,
  CURRENCY,
} from '../../lib/adminMock';
import { Card, SectionHeader, Badge } from './ui';

function useCountUp(target, duration = 1100) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [display, setDisplay] = useState(reduced ? target : 0);

  useEffect(() => {
    if (reduced) return;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);

  return display.toLocaleString('en-US');
}

const METRIC_COLORS = {
  orange: 'bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400',
  blue: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400',
  purple: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
};

const METRICS = [
  { icon: Users, label: 'إجمالي المستخدمين', value: overviewMetrics.totalUsers, color: METRIC_COLORS.orange },
  { icon: Building2, label: 'مالكو المساحات', value: overviewMetrics.spaceOwners, color: METRIC_COLORS.blue },
  { icon: MapPin, label: 'المساحات المسجلة', value: overviewMetrics.registeredSpaces, color: METRIC_COLORS.green },
  { icon: CalendarCheck, label: 'حجوزات الشهر', value: overviewMetrics.monthlyBookings, color: METRIC_COLORS.purple },
  { icon: Wallet, label: 'الإيرادات', value: overviewMetrics.totalRevenue, suffix: ` ${CURRENCY}`, color: METRIC_COLORS.amber },
  { icon: Scale, label: 'النزاعات المفتوحة', value: overviewMetrics.openDisputes, color: METRIC_COLORS.red },
];

const ACTIVITY_ICONS = {
  booking: { icon: TicketCheck, tone: 'bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400' },
  space: { icon: Building2, tone: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400' },
  dispute: { icon: Scale, tone: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' },
  user: { icon: UserPlus, tone: 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400' },
  payout: { icon: Banknote, tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
  review: { icon: MessageSquare, tone: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400' },
};

function MetricCard({ m }) {
  const Icon = m.icon;
  const animated = useCountUp(m.value);
  return (
    <div className="dash__stat">
      <span className="st-ico">
        <Icon />
      </span>
      <b>
        {animated}
        {m.suffix || ''}
      </b>
      <span>{m.label}</span>
    </div>
  );
}

function Bars({ data, height = 'h-40' }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={`flex items-end justify-between gap-2 ${height}`}>
      {data.map((d) => (
        <div key={d.label} className="group flex h-full w-full flex-col items-center justify-end gap-1.5">
          <div
            className="w-full max-w-8 rounded-t-lg bg-gradient-to-t from-orange-500 to-orange-400 transition-all duration-300 group-hover:from-orange-600 group-hover:to-orange-500"
            style={{ height: `${Math.max(6, Math.round((d.value / max) * 100))}%` }}
          />
          <span className="whitespace-nowrap text-[0.6rem] font-bold text-gray-400 dark:text-gray-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminOverview() {
  return (
    <div className="space-y-6">
      {/* بطاقات المؤشرات الست */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {METRICS.map((m) => (
          <MetricCard key={m.label} m={m} />
        ))}
      </section>

      {/* الاتجاهات (رسوم بيانية مكانية) */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader icon={Wallet} title="اتجاه الإيرادات (آخر 8 أشهر)" />
          <Bars data={revenueTrend} />
        </Card>
        <Card>
          <SectionHeader icon={CalendarCheck} title="حجوزات الأسبوع" />
          <Bars data={bookingTrend} />
        </Card>
      </section>

      {/* النشاطات الأخيرة + أحدث التسجيلات */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0! overflow-hidden">
          <div className="dash__section-head px-5 pt-4">
            <h2>
              <Sparkles />
              النشاطات الأخيرة
            </h2>
            <Link to="#" className="text-xs font-bold text-orange-500 hover:underline">
              عرض الكل
            </Link>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {activities.map((a) => {
              const meta = ACTIVITY_ICONS[a.kind] || ACTIVITY_ICONS.booking;
              const Icon = meta.icon;
              return (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="m-0 min-w-0 flex-1 truncate text-xs font-semibold text-zinc-700 dark:text-gray-300">{a.text}</p>
                  <span className="flex-none text-xs text-gray-400">{a.time}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-0! overflow-hidden">
          <div className="dash__section-head px-5 pt-4">
            <h2>
              <UserPlus />
              أحدث تسجيلات الأعضاء
            </h2>
            <Link to="#" className="text-xs font-bold text-orange-500 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="text-xs text-gray-400 dark:text-gray-500">
                  <th className="px-5 py-2.5 text-start font-bold">الاسم</th>
                  <th className="px-5 py-2.5 text-start font-bold">الدور</th>
                  <th className="px-5 py-2.5 text-start font-bold">تاريخ الانضمام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentRegistrations.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3 text-xs font-bold text-zinc-800 dark:text-gray-200">{r.name}</td>
                    <td className="px-5 py-3">
                      <Badge tone={r.role === 'owner' ? 'orange' : 'gray'}>{ROLE_LABELS[r.role] || r.role}</Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400" dir="ltr">{r.joinedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}