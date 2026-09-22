import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, Building2, MapPin, Clock, Megaphone, Users, CalendarClock, CircleDollarSign, Wallet, CalendarCheck, Gauge, Wifi, Zap, Video, Snowflake, Mic, TrendingUp, TrendingDown, Search, X, ChevronDown, ChevronLeft } from 'lucide-react';

const AMENITY_ICONS = {
  internet: Wifi,
  electricity: Zap,
  projector: Video,
  ac: Snowflake,
  microphone: Mic,
};

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(t.getTime())) return '';
  const diff = Math.max(0, Math.round((Date.now() - t.getTime()) / 3600000));
  if (diff < 1) return 'الآن';
  if (diff < 24) return `منذ ${diff} ساعة`;
  const days = Math.round(diff / 24);
  return days <= 30 ? `منذ ${days} يوم` : `منذ ${Math.round(days / 30)} شهر`;
}

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

function fmtMoney(n) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(n || 0);
}

// شهور التقويم كـ 'YYYY-MM' لتصنيف الحجوزات حسب شهر الإيراد.
function monthKey(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : '';
}

function isRealMonth(key) {
  return /^\d{4}-\d{2}$/.test(key);
}

function isRealDay(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function localDayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ARABIC_MONTHS_SHORT = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function shortDayName(dateKey, full = false) {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const name = ARABIC_DAYS[d.getDay()];
  if (full) return `${name} ${Number(m[3])}`;
  return name;
}

function shortMonthName(monthKeyStr) {
  const m = String(monthKeyStr || '').match(/^(\d{4})-(\d{2})/);
  if (!m) return '';
  return ARABIC_MONTHS_SHORT[Number(m[2]) - 1];
}

// قيمة عليا متوازنة لمحور ص بحيث تقبل القسمة على 4 خطوط.
function niceMax(v) {
  if (!v || v <= 0) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = Math.ceil(v / pow);
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const BOOKING_STATUS_LABELS = {
  confirmed: 'مؤكَّد',
  accepted: 'مقبول',
  pending: 'قيد الانتظار',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  rejected: 'مرفوض',
  closed: 'مغلق',
};

function bookingStatusLabel(status) {
  return BOOKING_STATUS_LABELS[status] || status || 'غير معروف';
}

export default function OwnerOverview({ data, onNavigate }) {
  const stats = data.stats || {};
  const [chartRange, setChartRange] = useState('7d'); // 7d | 14d | 30d | month

  const allSpaces = (data.spaces || []).filter((s) => s.is_active !== false);
  const [spaceId, setSpaceId] = useState(''); // '' = كل المساحات
  const [query, setQuery] = useState('');
  const [openPicker, setOpenPicker] = useState(false);
  const pickerRef = useRef(null);

  const selectedSpace = allSpaces.find((s) => String(s.id) === String(spaceId)) || null;

  const filteredPicker = query
    ? allSpaces.filter((s) => (s.title || '').toLowerCase().includes(query.toLowerCase()))
    : allSpaces;

  useEffect(() => {
    const onDocClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpenPicker(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const bookings = data.bookings || [];
  const scopedBookings = selectedSpace
    ? bookings.filter((b) => b.spaceName && b.spaceName === selectedSpace.title)
    : bookings;
  const confirmedBookings = scopedBookings.filter((b) => b.status === 'confirmed' || b.status === 'accepted' || b.status === 'completed');

  // جدول اليوم: حجوزات مطابقة لتاريخ اليوم، مرتبة حسب وقت البداية.
  const todaysBookings = useMemo(() => {
    const todayKey = localDayKey(new Date());
    return scopedBookings
      .filter((b) => String(b.date || '').slice(0, 10) === todayKey)
      .sort((a, c) => String(a.timeFrom || a.time || '').localeCompare(String(c.timeFrom || c.time || '')));
  }, [scopedBookings]);

  const visibleSchedule = todaysBookings.slice(0, 4);

  // بيانات الرسم البياني لإجمالي الإيرادات: 7/14/30 يوماً أو 6 أشهر.
  const revenueChart = useMemo(() => {
    const days = chartRange === '7d' ? 7 : chartRange === '14d' ? 14 : chartRange === '30d' ? 30 : 0;
    const byDay = {};
    const byMonth = {};
    confirmedBookings.forEach((b) => {
      const dayKey = String(b.date || '').slice(0, 10);
      if (isRealDay(dayKey)) byDay[dayKey] = (byDay[dayKey] || 0) + Number(b.price || 0);
      const mKey = monthKey(b.date);
      if (isRealMonth(mKey)) byMonth[mKey] = (byMonth[mKey] || 0) + Number(b.price || 0);
    });

    const today = new Date();
    const dayKeys = [];

    if (days > 0) {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        dayKeys.push(localDayKey(d));
      }
      const current = dayKeys.reduce((s, k) => s + (byDay[k] || 0), 0);
      const previous = dayKeys.reduce((s, k, idx) => s + (byDay[localDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - idx - days))] || 0), 0);
      const points = dayKeys.map((k, idx) => ({
        key: k,
        label: shortDayName(k),
        value: byDay[k] || 0,
        showLabel: days >= 30 ? shortDayName(k) === 'السبت' : idx % (days >= 14 ? 2 : 1) === 0,
      }));
      return {
        days,
        timeframe: `آخر ${days} يوم`,
        points,
        total: current,
        previous,
        max: niceMax(Math.max(...points.map((p) => p.value), 0)),
      };
    }

    // عرض شهري: آخر 6 أشهر.
    const monthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const prevMonthKeys = monthKeys.map((k) => {
      const [yy, mm] = k.split('-').map(Number);
      const d = new Date(yy, mm - 7, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const current = monthKeys.reduce((s, k) => s + (byMonth[k] || 0), 0);
    const previous = prevMonthKeys.reduce((s, k) => s + (byMonth[k] || 0), 0);
    const points = monthKeys.map((k) => ({
      key: k,
      label: shortMonthName(k),
      value: byMonth[k] || 0,
      showLabel: true,
    }));
    return {
      days: 0,
      timeframe: 'آخر 6 أشهر',
      points,
      total: current,
      previous,
      max: niceMax(Math.max(...points.map((p) => p.value), 0)),
    };
  }, [confirmedBookings, chartRange]);

  const revenueGrowth = revenueChart.previous > 0
    ? Math.round(((revenueChart.total - revenueChart.previous) / revenueChart.previous) * 100)
    : (revenueChart.total > 0 ? 100 : 0);

  const CHART_RANGES = [
    { id: '7d', label: '7 أيام' },
    { id: '14d', label: '14 يوم' },
    { id: '30d', label: '30 يوم' },
    { id: 'month', label: '6 أشهر' },
  ];

  const spacePerformance = useMemo(() => {
    const totalRev = confirmedBookings.reduce((sum, b) => sum + Number(b.price || 0), 0);
    return allSpaces.map(s => {
      const spaceRev = confirmedBookings
        .filter(b => b.spaceName === s.title)
        .reduce((sum, b) => sum + Number(b.price || 0), 0);
      const percent = totalRev > 0 ? Math.round((spaceRev / totalRev) * 100) : 0;
      return { ...s, performance: percent, revenue: spaceRev };
    });
  }, [confirmedBookings, allSpaces]);

  // أرباح هذا الشهر مقارنةً بالشهر السابق.
  const profitSummary = useMemo(() => {
    const months = {};
    confirmedBookings.forEach((b) => {
      const key = monthKey(b.date);
      if (isRealMonth(key)) months[key] = (months[key] || 0) + Number(b.price || 0);
    });
    const keys = Object.keys(months).sort();
    const cur = keys[keys.length - 1] || '';
    const prev = keys.length > 1 ? keys[keys.length - 2] : '';
    const current = cur ? months[cur] : 0;
    const previous = prev ? months[prev] : 0;
    return { current, previous };
  }, [confirmedBookings]);

  const profitGrowth = profitSummary.previous > 0
    ? Math.round(((profitSummary.current - profitSummary.previous) / profitSummary.previous) * 100)
    : (profitSummary.current > 0 ? 100 : 0);

  // نمو عدد الحجوزات المؤكَّدة بين الشهر الحالي والسابق.
  const bookingGrowth = useMemo(() => {
    const counts = {};
    confirmedBookings.forEach((b) => {
      const key = monthKey(b.date);
      if (isRealMonth(key)) counts[key] = (counts[key] || 0) + 1;
    });
    const keys = Object.keys(counts).sort();
    const cur = keys[keys.length - 1] || '';
    const prev = keys.length > 1 ? keys[keys.length - 2] : '';
    const current = cur ? counts[cur] : 0;
    const previous = prev ? counts[prev] : 0;
    const growth = previous > 0
      ? Math.round(((current - previous) / previous) * 100)
      : (current > 0 ? 100 : 0);
    return { current, previous, growth };
  }, [confirmedBookings]);

  // معدّل الإشغال لليوم مقارنةً بالبارحة: ساعات محجوزة مؤكَّدة ÷ ساعات القدرة اليومية.
  const occupancyToday = useMemo(() => {
    const scopedSpaces = selectedSpace ? [selectedSpace] : allSpaces;
    const dailyCapacityHours = scopedSpaces.reduce((sum, s) => sum + Number(s.capacity || 0) * 8, 0);
    if (dailyCapacityHours <= 0) return { today: 0, yesterday: 0 };
    const byDay = {};
    confirmedBookings.forEach((b) => {
      const key = String(b.date || '').slice(0, 10);
      if (isRealDay(key)) byDay[key] = (byDay[key] || 0) + Number(b.hours || 0);
    });
    const todayKey = localDayKey(new Date());
    const yesterdayKey = localDayKey(new Date(new Date().getTime() - 86400000));
    const cap = (h) => Math.min(100, Math.round((h / dailyCapacityHours) * 100));
    return {
      today: cap(byDay[todayKey] || 0),
      yesterday: cap(byDay[yesterdayKey] || 0),
    };
  }, [confirmedBookings, selectedSpace, allSpaces]);

  const occupancyGrowth = occupancyToday.yesterday > 0
    ? Math.round(((occupancyToday.today - occupancyToday.yesterday) / occupancyToday.yesterday) * 100)
    : (occupancyToday.today > 0 ? 100 : 0);

  const marketCount = stats.openMarket ?? (data.market || []).length;

  const marketOpportunities = (data.market || [])
    .filter((r) => r.status !== 'closed' && r.status !== 'cancelled')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 3);

  const statCards = [
    {
      icon: Wallet,
      label: 'أرباح هذا الشهر',
      value: fmtMoney(profitSummary.current),
      unit: 'ش.ج',
      trend: profitSummary.current > 0 || profitSummary.previous > 0 ? profitGrowth : null,
      trendUp: profitGrowth >= 0,
      trendLabel: 'عن الشهر السابق',
      accent: 'orange',
    },
    {
      icon: CalendarCheck,
      label: 'إجمالي الحجوزات',
      value: fmtNumber(scopedBookings.length),
      trend: bookingGrowth.current > 0 || bookingGrowth.previous > 0 ? bookingGrowth.growth : null,
      trendUp: bookingGrowth.growth >= 0,
      trendLabel: 'عن الشهر السابق',
      accent: 'blue',
    },
    {
      icon: Gauge,
      label: 'نسبة الإشغال اليوم',
      value: `${fmtNumber(occupancyToday.today)}٪`,
      trend: occupancyToday.today > 0 || occupancyToday.yesterday > 0 ? occupancyGrowth : null,
      trendUp: occupancyGrowth >= 0,
      trendLabel: 'عن البارحة',
      accent: 'green',
    },
    {
      icon: Store,
      label: 'طلبات السوق',
      value: fmtNumber(marketCount),
      accent: 'violet',
    },
  ];

  const pickSpace = (id) => {
    setSpaceId(id);
    setQuery('');
    setOpenPicker(false);
  };

  return (
    <>
      {/* شريط اختيار مساحة محددة — كل المساحات افتراضياً */}
      <section className="odash__filter" ref={pickerRef}>
        <div className="odash__filter-ico"><Store /></div>
        <div className="odash__filter-main">
          <span className="odash__filter-label">
            {selectedSpace ? 'تُعرض الإحصاءات لـ ' : 'تُعرض الإحصاءات لكل المساحات'}
          </span>
          <div className="odash__filter-field">
            <Search className="odash__filter-search-ico" />
            <input
              type="text"
              value={query}
              placeholder={selectedSpace ? selectedSpace.title : 'ابحث عن مساحة محددة…'}
              onFocus={() => setOpenPicker(true)}
              onChange={(e) => { setQuery(e.target.value); setOpenPicker(true); }}
              aria-label="بحث عن مساحة"
            />
            {query || selectedSpace ? (
              <button
                type="button"
                className="odash__filter-clear"
                onClick={() => pickSpace('')}
                aria-label="إلغاء اختيار المساحة"
              >
                <X />
              </button>
            ) : (
              <ChevronDown className="odash__filter-caret" />
            )}
          </div>
        </div>

        {openPicker && (
          <div className="odash__filter-menu" role="listbox">
            <button type="button" role="option" className="odash__filter-item is-all" onClick={() => pickSpace('')}>
              <Building2 /> كل المساحات
            </button>
            {filteredPicker.map((s) => (
              <button
                type="button"
                role="option"
                key={s.id}
                className={`odash__filter-item${String(s.id) === String(spaceId) ? ' is-active' : ''}`}
                onClick={() => pickSpace(String(s.id))}
              >
                <Building2 />
                <span>
                  <b>{s.title}</b>
                  <small>{s.location || `تتسع لـ ${s.capacity} شخص`}</small>
                </span>
              </button>
            ))}
            {filteredPicker.length === 0 && (
              <span className="odash__filter-empty">لا توجد مساحات تطابق بحثك.</span>
            )}
          </div>
        )}
      </section>

      <section className="odash__stats odash__stats--4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div className={`odash__stat odash__stat--${c.accent}`} key={c.label}>
              <div className="ost-ico"><Icon /></div>
              <b>{c.value}{c.unit ? <small className="odash__stat-unit">{c.unit}</small> : null}</b>
              <span>{c.label}</span>
              {typeof c.trend === 'number' && (
                <span className={`odash__stat-trend is-${c.trendUp ? 'up' : 'down'}`}>
                  {c.trendUp ? <TrendingUp /> : <TrendingDown />}
                  {Math.abs(c.trend)}٪ {c.trendLabel || 'مقارنة'}
                </span>
              )}
            </div>
          );
        })}
      </section>

      <div className="odash__grid2">
        {/* إجمالي الإيرادات */}
        <section className="odash__section odash__section--chart">
          <div className="odash__section-head">
            <div>
              <h2><Wallet /> إجمالي الإيرادات</h2>
              <p>{revenueChart.timeframe} — مقارنةً بالفترة السابقة.</p>
            </div>
          </div>

          <div className="odash__chart">
            <div className="filterbar filterbar--sm">
              {CHART_RANGES.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className={chartRange === r.id ? 'is-active' : ''}
                  onClick={() => setChartRange(r.id)}
                  aria-pressed={chartRange === r.id}
                >
                  {chartRange === r.id && (
                    <motion.span
                      layoutId="filterbar-owner-ranges"
                      className="filterbar-pill"
                      transition={{ type: 'spring', stiffness: 480, damping: 38, mass: 0.9 }}
                    />
                  )}
                  <span className="filterbar-label">{r.label}</span>
                </button>
              ))}
            </div>

            {revenueChart.points.length > 0 ? (
              <>
                <div className="odash__chart-body">
                  <div className="odash__chart-y">
                    {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                      <span key={f} style={{ top: `${(1 - f) * 100}%` }}>
                        {fmtMoney(revenueChart.max * f)}
                      </span>
                    ))}
                  </div>
                  <div className="odash__chart-plot">
                    <div className="odash__chart-grid">
                      {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                        <i key={f} style={{ top: `${(1 - f) * 100}%` }} />
                      ))}
                    </div>
                    <div className={`odash__chart-bars${revenueChart.days >= 14 ? ' is-dense' : ''}`}>
                      {revenueChart.points.map((p) => {
                        const h = revenueChart.max > 0 ? Math.max(4, (p.value / revenueChart.max) * 100) : 4;
                        const isToday = chartRange !== 'month' && p.key === localDayKey(new Date());
                        return (
                          <div className={`odash__chart-col${isToday ? ' is-today' : ''}`} key={p.key} title={`${fmtMoney(p.value)} ش.ج`}>
                            <span className="odash__chart-val">{p.value > 0 ? fmtMoney(p.value) : ''}</span>
                            <div className="odash__chart-bar" style={{ height: `${h}%` }} />
                            <span className={`odash__chart-x${p.showLabel ? '' : ' is-hidden'}`}>{p.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="odash__chart-foot">
                  <div>
                    <small>إجمالي الإيرادات</small>
                    <b>{fmtMoney(revenueChart.total)} <span>ش.ج</span></b>
                  </div>
                  <span className={`odash__chart-growth is-${revenueGrowth >= 0 ? 'up' : 'down'}`}>
                    {revenueGrowth >= 0 ? <TrendingUp /> : <TrendingDown />}
                    {Math.abs(revenueGrowth)}٪ عن الفترة السابقة
                  </span>
                </div>
              </>
            ) : (
              <div className="odash__state">
                <div className="ost-svg"><Wallet /></div>
                <h3>لا توجد بيانات إيرادات</h3>
                <p>ستظهر الإيرادات عند تأكيد أول الحجوزات.</p>
              </div>
            )}
          </div>
        </section>

        {/* جدول اليوم */}
        <section className="odash__section odash__section--schedule">
          <div className="odash__section-head">
            <div>
              <h2><CalendarClock /> جدول اليوم</h2>
              <p>حجوزات اليوم لكل المساحات حسب وقت البدء.</p>
            </div>
            {todaysBookings.length > 0 && (
              <span className="odash__schedule-count">{fmtNumber(todaysBookings.length)} موعد</span>
            )}
          </div>

          {todaysBookings.length > 0 ? (
            <>
              <div className="odash__schedule">
                {visibleSchedule.map((b) => {
                  const hasStart = Boolean(b.timeFrom);
                  return (
                    <div className={`odash__schedule-row is-${b.status || 'pending'}`} key={b.id}>
                      <span className="odash__schedule-time">
                        {hasStart ? (
                          <>
                            <b>{b.timeFrom}</b>
                            <small>{b.timeTo ? `إلى ${b.timeTo}` : ''}</small>
                          </>
                        ) : (
                          <small>{b.time || 'وقت غير محدد'}</small>
                        )}
                      </span>
                      <span className="odash__schedule-line" />
                      <span className="odash__schedule-main">
                        <b>{b.customer || 'عميل'}</b>
                        <small><Building2 /> {b.spaceName || 'مساحة غير محددة'}</small>
                        <small className="odash__schedule-extra">
                          <Clock /> {fmtNumber(b.hours)} ساعات
                          <CircleDollarSign /> {fmtMoney(b.price)} ش.ج
                        </small>
                      </span>
                      <span className={`odash__schedule-status is-${b.status || 'pending'}`}>
                        {bookingStatusLabel(b.status)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {todaysBookings.length > 4 && (
                <button
                  type="button"
                  className="odash__show-all odash__schedule-all"
                  onClick={() => onNavigate && onNavigate('bookings')}
                >
                  كل الحجوزات ({fmtNumber(todaysBookings.length)}) — عرض السجل
                </button>
              )}
            </>
          ) : (
            <div className="odash__state">
              <div className="ost-svg"><CalendarClock /></div>
              <h3>لا توجد حجوزات اليوم</h3>
              <p>عند وصول أول حجز اليوم سيظهر هنا بمكانه في جدولك.</p>
            </div>
          )}
        </section>
      </div>

      <section className="odash__section odash__section--opps">
        <div className="odash__section-head">
          <div>
            <h2><Megaphone /> فرص السوق</h2>
            <p>أحدث طلبات العملاء المفتوحة — تقدّم عرضك قبل انتهاء الفرصة.</p>
          </div>
          <button
            type="button"
            className="odash__show-all"
            onClick={() => onNavigate && onNavigate('market')}
          >
            عرض السوق <ChevronLeft />
          </button>
        </div>

        {marketOpportunities.length > 0 ? (
          <div className="odash__list">
            {marketOpportunities.map((r) => (
              <div className="odash__opp" key={r.id}>
                <div className="odash__opp-ico"><Megaphone /></div>
                <div className="odash__opp-body">
                  <div className="odash__opp-topline">
                    <h3>{r.title}</h3>
                    <span className="odash__opp-badge"><Clock /> مفتوحة</span>
                  </div>
                  {r.notes && <p className="odash__opp-desc">{r.notes}</p>}
                  <div className="odash__opp-meta">
                    <span><CalendarClock /> {r.schedule_label || 'مرة واحدة'}</span>
                    <span><Clock /> {r.preferred_time || 'وقت مرن'}</span>
                    <span><Users /> {fmtNumber(r.capacity)} شخص</span>
                    {r.area && <span><MapPin /> {r.area}</span>}
                  </div>
                  <div className="odash__opp-foot">
                    {r.budget > 0 && (
                      <span className="odash__opp-budget"><CircleDollarSign /> حتى {fmtNumber(r.budget)} ش.ج</span>
                    )}
                    {r.amenities.length > 0 && (
                      <div className="odash__opp-chips">
                        {r.amenities.slice(0, 4).map((a) => {
                          const Icon = AMENITY_ICONS[a];
                          return (
                            <span key={a}>
                              {Icon ? <Icon /> : null} {a}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="odash__opp-side">
                  <span className="odash__opp-time">{timeAgo(r.created_at)}</span>
                  <span className="odash__opp-offers">{fmtNumber(r.offers_count)} عرض</span>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onNavigate && onNavigate('market', r.id)}
                  >
                    قدّم عرضك
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="odash__state">
            <div className="ost-svg"><Store /></div>
            <h3>لا توجد فرص سوق مفتوحة</h3>
            <p>عند نشر أحد العملاء طلباً خاصاً سيظهر هنا لتقدّم عرضك على الفور.</p>
          </div>
        )}
      </section>

      <section className="odash__section odash__section--performance">
        <div className="odash__section-head">
          <div>
            <h2><Building2 /> أداء المساحات</h2>
            <p>توزيع الإيرادات ونسبة المساهمة لكل مساحة.</p>
          </div>
        </div>

        <div className="odash__perf-grid">
          {spacePerformance.map((s) => {
            const radius = 36;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (s.performance / 100) * circumference;
            return (
              <Link to={`/ads/${s.id}`} className="odash__perf-card" key={s.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="odash__perf-ring">
                  <svg width="80" height="80" className="odash__ring-svg">
                    <circle className="odash__ring-bg" cx="40" cy="40" r={radius} />
                    <circle 
                      className="odash__ring-fill" 
                      cx="40" cy="40" r={radius} 
                      style={{ strokeDasharray: `${circumference} ${circumference}`, strokeDashoffset: offset }}
                    />
                    <span className="odash__ring-text">{s.performance}٪</span>
                  </svg>
                </div>
                <div className="odash__perf-info">
                  <h3>{s.title}</h3>
                  <div className="odash__perf-val">
                    <b>{fmtMoney(s.revenue)}</b> <small>ش.ج</small>
                  </div>
                </div>
              </Link>
            );
          })}
          {spacePerformance.length === 0 && (
            <div className="odash__state">
              <div className="ost-svg"><Building2 /></div>
              <h3>لا توجد بيانات أداء</h3>
              <p>ستظهر الإحصائيات هنا بمجرد وجود حجوزات مؤكدة.</p>
            </div>
          )}
        </div>
      </section>

      <section className="odash__actions">
        <button
          type="button"
          className="odash__action"
          onClick={() => onNavigate && onNavigate('market')}
        >
          <div className="oa-ico"><Store /></div>
          <div>
            <h3>استكشف السوق</h3>
            <p>طلبات مفتوحة تنتظر عروضك</p>
          </div>
        </button>
        <Link className="odash__action" to="/spaces">
          <div className="oa-ico"><MapPin /></div>
          <div>
            <h3>معاينة المساحات</h3>
            <p>كما يراها الزوار والطلاب</p>
          </div>
        </Link>
      </section>
    </>
  );
}