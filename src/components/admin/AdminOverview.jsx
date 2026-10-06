import { useCallback, useMemo } from 'react';
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
} from 'recharts';
import { StatCard, SectionCard, SectionHeading, StatusBadge, Avatar, ViewAllButton, DataSourceBanner, DataGate } from './ui';
import useAdminData from './useAdminData';
import { getStats, getRevenueTrend, getActivities, getRecentRegistrations } from '../../lib/adminApi';

const activityMeta = {
  user: { icon: UserPlus, tone: 'green' },
  space: { icon: Building2, tone: 'orange' },
  booking: { icon: CalendarCheck, tone: 'blue' },
  dispute: { icon: AlertCircle, tone: 'red' },
  payment: { icon: BadgeDollarSign, tone: 'amber' },
  review: { icon: Star, tone: 'violet' },
};

// أدوار المستخدم في لوحة المشرف — نفس تصنيف AdminUsers: قيمتان فقط تظهران
// للمستخدم («فريلانسر» و«مالك مساحة»)، وكل إملاء يطابقهما يُعرض بتسمية
// واحدة. `customer` مدمج في «فريلانسر» فلا يظهر كمصطلح مستقلّ في أي شاشة.
const roleMeta = {
  freelancer: { label: 'فريلانسر', tone: 'violet' },
  customer: { label: 'فريلانسر', tone: 'violet' },
  owner: { label: 'مالك مساحة', tone: 'orange' },
  space_owner: { label: 'مالك مساحة', tone: 'orange' },
};

// قيمة بديلة آمنة: بيانات الـ API قد تحتوي دوراً غير معرّف أو غائباً، فنقول
// «—» بدل تسمية مخترعة.
const roleOf = (role) => {
  const meta = typeof role === 'string' ? roleMeta[role.trim().toLowerCase()] : null;
  return meta ? { label: meta.label, tone: meta.tone } : { label: '—', tone: 'gray' };
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

// لا قيم بديلة هنا: كل حقل يأتي من الخادم كما هو. الحقول الناقصة تصبح
// `undefined` فيُعرض مكانها '—' بدل رقم مخترَع.
const rowsOf = (value) => (Array.isArray(value) ? value : []);

// قيمة رقمية من الخادم، أو '—' إن لم تصل — لا صفر بديل.
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : '—');

export default function AdminOverview({ onNavigate = () => {} }) {
  // العقد §4: أربعة مصادر للنظرة العامة. نطلبها معاً فيات ووعد واحد حتى لا
  // ترسم الشاشة بأرقام جزئية (رسوم من مصدر وبطاقات من آخر).
  const fetchOverview = useCallback(
    () =>
      Promise.all([getStats(), getRevenueTrend(12), getActivities(10), getRecentRegistrations(5)]).then(
        ([stats, trend, activities, registrations]) => ({
          stats: stats && typeof stats === 'object' ? stats : {},
          trend: rowsOf(trend),
          activities: rowsOf(activities),
          registrations: rowsOf(registrations),
        })
      ),
    []
  );

  const { data, loading, error, live, reload } = useAdminData(fetchOverview);

  // نسبة التغيّر محسوبة من السلسلة نفسها (آخر شهرين)، لا نسبة مكتوبة في الكود:
  // نمو المنصة رقم يجب أن يُشتق من الخادم وإلا صار دعوى بلا مصدر.
  const trendChange = useMemo(() => {
    const rows = rowsOf(data?.trend);
    if (rows.length < 2) return null;
    const last = Number(rows[rows.length - 1]?.revenue);
    const prev = Number(rows[rows.length - 2]?.revenue);
    if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null;
    return Math.round(((last - prev) / prev) * 100);
  }, [data]);

  if (!data) {
    return <DataGate live={live} loading={loading} error={error} onRetry={reload} rows={4} />;
  }

  const { stats, trend, activities, registrations } = data;

  // البطاقات بلا نسب نمو: العقد لا يوفّر مقارنة بالفترة السابقة، فكتابة
  // «+4.2%» كانت رقماً بلا مصدر. الاتجاه يُترك بلا وسم حتى يصل من الخادم.
  const cards = [
    { icon: Users, label: 'إجمالي المستخدمين', value: num(stats.totalUsers), tone: 'orange', trend: 'none' },
    { icon: Building2, label: 'مالكو المساحات', value: num(stats.spaceOwners), tone: 'violet', trend: 'none' },
    { icon: MapPin, label: 'المساحات المسجلة', value: num(stats.registeredSpaces), tone: 'blue', trend: 'none' },
    { icon: CalendarCheck, label: 'حجوزات الشهر', value: num(stats.monthlyBookings), tone: 'green', trend: 'none' },
    { icon: Wallet, label: 'الإيرادات', value: num(stats.totalRevenue), currency: 'ش.ج', tone: 'amber', trend: 'none' },
    {
      icon: ShieldAlert,
      label: 'النزاعات المفتوحة',
      value: num(stats.openDisputes),
      tone: 'red',
      trend: 'warn',
      hint: stats.openDisputes ? 'تحتاج متابعة' : '',
    },
  ];

  return (
    <div className="space-y-6">
      <DataSourceBanner live={live} loading={loading} error={error} onRetry={reload} />

      {/* بطاقات المؤشرات الست */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} commas />
        ))}
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <SectionHeading
            icon={Wallet}
            title="اتجاه الإيرادات"
            subtitle="آخر 12 شهراً (ش.ج)"
            action={
              // الشارة مشتقة من السلسلة الواردة: لا تُدّعي نمواً بلا قياس.
              trendChange === null ? null : (
                <StatusBadge tone={trendChange >= 0 ? 'green' : 'red'} icon={trendChange >= 0 ? CheckCircle2 : AlertCircle}>
                  {trendChange >= 0 ? '↑' : '↓'} {Math.abs(trendChange)}% عن الشهر السابق
                </StatusBadge>
              )
            }
          />
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="opacity-40 dark:opacity-20" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "'Cairo', sans-serif" }} />
                <YAxis tick={{ fontSize: 10 }} width={72} tickFormatter={(v) => `${v.toLocaleString('en-US')} ش.ج`} />
                <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => [`${v.toLocaleString('en-US')} ش.ج`, 'الإيراد']} />
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
              <BarChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="opacity-40 dark:opacity-20" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "'Cairo', sans-serif" }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => [v, 'الحجوزات']} cursor={{ fill: 'rgba(249,115,22,0.08)' }} />
                <Bar dataKey="bookings" fill="#fb923c" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* الأنشطة والتسجيلات */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard>
          <SectionHeading
            icon={Activity}
            title="أحدث أنشطة المنصة"
            subtitle="نظرة سريعة على آخر الأحداث"
            action={<ViewAllButton onClick={() => onNavigate('bookings')} />}
          />
          <ul className="space-y-3 pb-3">
            {activities.length === 0 && (
              <li className="txt-muted py-6 text-center text-sm">لا توجد أنشطة مسجّلة بعد.</li>
            )}
            {activities.map((a) => {
              const meta = activityMeta[a.icon] || activityMeta.user;
              const Icon = meta.icon;
              return (
                <li key={a.id} className="flex items-start gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-orange-50/70 dark:hover:bg-white/5">
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
          <SectionHeading
            icon={UserPlus}
            title="أحدث التسجيلات"
            subtitle="مستخدمون جدد انضموا مؤخراً"
            action={<ViewAllButton onClick={() => onNavigate('users')} />}
          />
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
                {registrations.length === 0 && (
                  <tr>
                    <td colSpan={3} className="txt-muted py-6 text-center text-sm">
                      لا يوجد تسجيلات حديثة.
                    </td>
                  </tr>
                )}
                {registrations.map((r) => {
                  const role = roleOf(r.role);
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.name} xs />
                          <span className="font-bold" style={{ color: 'var(--text-strong)' }}>{r.name}</span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge tone={role.tone}>{role.label}</StatusBadge>
                      </td>
                      <td className="txt-muted text-xs">{r.time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}