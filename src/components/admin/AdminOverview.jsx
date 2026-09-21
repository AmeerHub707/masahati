import {
  Users,
  Building2,
  CalendarCheck,
  Wallet,
  ShieldAlert,
  UserPlus,
  MapPin,
  Activity,
  Star,
  AlertCircle,
  BadgeDollarSign,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { adminStats, revenueTrend, adminActivities, recentRegistrations } from '../../data/adminMockData';
import { StatCard, SectionCard, SectionHeading, StatusBadge, Avatar } from './ui';

const activityMeta = {
  user: { icon: UserPlus, tone: 'green' },
  space: { icon: Building2, tone: 'orange' },
  booking: { icon: CalendarCheck, tone: 'blue' },
  dispute: { icon: AlertCircle, tone: 'red' },
  payment: { icon: BadgeDollarSign, tone: 'amber' },
  review: { icon: Star, tone: 'violet' },
};

const roleLabel = {
  student: 'طالب',
  freelancer: 'فريلانسر',
  owner: 'صاحب مساحة',
};

const roleTone = {
  student: 'blue',
  freelancer: 'violet',
  owner: 'orange',
};

function chartTooltipStyle() {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return {
    borderRadius: 12,
    border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
    background: dark ? '#1f2937' : '#ffffff',
    color: dark ? '#f9fafb' : '#111827',
    fontFamily: "'Cairo', sans-serif",
    fontSize: 12,
    direction: 'rtl',
  };
}

export default function AdminOverview() {
  const stats = adminStats;

  const cards = [
    { icon: Users, label: 'إجمالي المستخدمين', value: stats.totalUsers, tone: 'orange', hint: '+4.2%' },
    { icon: Building2, label: 'مالكو المساحات', value: stats.spaceOwners, tone: 'violet', hint: '+1.8%' },
    { icon: MapPin, label: 'المساحات المسجلة', value: stats.registeredSpaces, tone: 'blue', hint: '+2.5%' },
    { icon: CalendarCheck, label: 'حجوزات الشهر', value: stats.monthlyBookings, tone: 'green', hint: '+6.1%' },
    { icon: Wallet, label: 'الإيرادات', value: `${stats.totalRevenue} ش.ج`, tone: 'amber', hint: '+8.9%' },
    { icon: ShieldAlert, label: 'النزاعات المفتوحة', value: stats.openDisputes, tone: 'red', hint: 'تحتاج متابعة' },
  ];

  return (
    <div className="space-y-6">
      {/* بطاقات المؤشرات الست */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <SectionHeading
            icon={Wallet}
            title="اتجاه الإيرادات"
            subtitle="آخر 12 شهراً (ش.ج)"
            action={<StatusBadge tone="green" icon={CheckCircle2}>نمو مستمر</StatusBadge>}
          />
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="opacity-40 dark:opacity-20" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "'Cairo', sans-serif" }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => [`${v} ش.ج`, 'الإيراد']} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeading
            icon={CalendarCheck}
            title="الحجوزات الشهرية"
            subtitle="عدد الحجوزات المؤكدة"
          />
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="opacity-40 dark:opacity-20" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "'Cairo', sans-serif" }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => [v, 'حجز']} cursor={{ fill: 'rgba(249,115,22,0.08)' }} />
                <Bar dataKey="bookings" fill="#fb923c" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Legend wrapperStyle={{ fontFamily: "'Cairo', sans-serif", fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* الأنشطة والتسجيلات */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <SectionHeading icon={Activity} title="أحدث أنشطة المنصة" subtitle="نظرة سريعة على آخر الأحداث" />
          <ul className="space-y-3">
            {adminActivities.map((a) => {
              const meta = activityMeta[a.icon] || activityMeta.user;
              const Icon = meta.icon;
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <span className={`st-ico st-ico--${meta.tone}`}>
                    <Icon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-strong)' }}>{a.text}</p>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.time}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>

        <SectionCard>
          <SectionHeading icon={UserPlus} title="أحدث التسجيلات" subtitle="مستخدمون جدد انضموا مؤخراً" />
          <div className="overflow-x-auto">
            <table className="dash__table min-w-[24rem] text-sm">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>الدور</th>
                  <th>الانضمام</th>
                </tr>
              </thead>
              <tbody>
                {recentRegistrations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.name} xs />
                        <span className="font-bold" style={{ color: 'var(--text-strong)' }}>{r.name}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={roleTone[r.role]}>{roleLabel[r.role]}</StatusBadge>
                    </td>
                    <td className="txt-muted text-xs">{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}