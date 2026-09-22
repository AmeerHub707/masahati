import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Building2, MapPin, Clock, Megaphone, Users, CalendarClock, CircleDollarSign, Wallet, CalendarCheck, Gauge, Wifi, Zap, Video, Snowflake, Mic, TrendingUp, TrendingDown, Search, X, ChevronDown, ChevronLeft, Sparkles, BarChart3, Target, Star, Wrench, FileText } from 'lucide-react';
import { belongsToSpace } from '../../../lib/owner';
import ChartBars from './ChartBars';

const SUGGESTIONS_KEY = 'masahati.owner-suggestions-dismissed';

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

// ينشئ اقتراحات ذكية بناءً على بيانات المالك.
// تعتمد على البيانات الفعلية (مساحات غير نشطة، أسعار، صور، حجوزات، طلبات سوق).
function generateSuggestions({ spaces, bookings, market }) {
  const suggestions = [];
  const allSpaces = (spaces || []).filter((s) => s.is_active !== false);
  const inactiveSpaces = (spaces || []).filter((s) => s.is_active === false);

  // 1. مساحة غير نشطة → شغّلها لزيادة الظهور
  if (inactiveSpaces.length > 0) {
    suggestions.push({
      id: 'activate-space',
      icon: <Target />,
      title: 'فعّل مساحتك لزيادة الوصول',
      desc: `${inactiveSpaces.length} مساحة متوقفة حالياً — فعّلها الآن وستظهر للعملاء في التدفق الحجزي.`,
      action: 'my-spaces',
      actionLabel: 'إدارة المساحات',
    });
  }

  // 2. مساحة بدون صورة → أضف صورة
  const spacesWithoutImage = allSpaces.filter((s) => !s.image);
  if (spacesWithoutImage.length > 0) {
    suggestions.push({
      id: 'add-image',
      icon: <Store />,
      title: 'أضف صور لمساحاتك',
      desc: `${spacesWithoutImage.length} مساحة لا تحتوي على صورة — الصور تزيد معدل الحجز بنسبة 60%.`,
      action: 'my-spaces',
      actionLabel: 'إضافة صور',
    });
  }

  // 3. لا طلبات سوق مفتوحة → جهّز مساحتك لاستقبال أول طلب
  const openMarket = (market || []).filter((r) => r.status !== 'closed' && r.status !== 'cancelled');
  if (openMarket.length === 0) {
    suggestions.push({
      id: 'no-market',
      icon: <Megaphone />,
      title: 'لا توجد طلبات سوق مفتوحة الآن',
      desc: 'لا توجد طلبات سوق مفتوحة حالياً — تأكد أن مساحتك محدّثة بصور ومرافق وسعر تنافسي لاستقبال أول طلب فور نشره.',
      action: 'my-spaces',
      actionLabel: 'إدارة المساحات',
    });
  }

  // 4. حجوزات قليلة هذا الأسبوع → خفّض السعر أو علن المساحة
  const confirmedThisWeek = (bookings || []).filter(
    (b) =>
      b.status === 'confirmed' || b.status === 'accepted' || b.status === 'completed'
  ).length;
  if (confirmedThisWeek === 0 && allSpaces.length > 0) {
    suggestions.push({
      id: 'promote-space',
      icon: <BarChart3 />,
      title: 'ادعُم مساحتك في الواجهة الرئيسية',
      desc: 'لم يحصل طلاب على حجز في مساحتك هذا الأسبوع — جرّب تخفيض السعر الساعة أو إضافة مساحة إعلانية.',
      action: 'market',
      actionLabel: 'عرض الأسعار',
    });
  }

  // 5. طلبات سوق مفتوحة لكن لا عروض → قدّم عرضاً
  if (openMarket.length > 0 && confirmedThisWeek === 0) {
    suggestions.push({
      id: 'submit-offer',
      icon: <Sparkles />,
      title: 'قدّم عرضاً على الطلبات المفتوحة',
      desc: `${openMarket.length} طلب مفتوح ينتظر عروضك — قدّم عرضاً واحصل على أول حجز.`,
      action: 'market',
      actionLabel: 'تقديم عرض',
    });
  }

  // 6. مساحة نشطة بدون وصف → أضف وصفاً يشرح مميزاتها
  const spacesNoDescription = allSpaces.filter((s) => !(s.description || '').trim());
  if (spacesNoDescription.length > 0) {
    suggestions.push({
      id: 'add-description',
      icon: <FileText />,
      title: 'أضف وصفاً يشرح مميزات مساحتك',
      desc: `${spacesNoDescription.length} مساحة بدون وصف — الوصف الجيد (الموقع، السعة، المناسب لها) يضاعف احتمالية الحجز.`,
      action: 'my-spaces',
      actionLabel: 'تحسين الوصف',
    });
  }

  // 7. مساحة نشطة بمرافق شبه معدومة → جهّزها بالمرافق الأساسية
  const thinAmenitySpaces = allSpaces.filter((s) => (s.amenities || []).length < 2);
  if (thinAmenitySpaces.length > 0) {
    suggestions.push({
      id: 'add-amenities',
      icon: <Wrench />,
      title: 'جهّز مساحتك بالمرافق الأساسية',
      desc: 'الإنترنت والتكييف والبروجيكتور هم أول ما يبحث عنه الطلاب — أضف مرافق لرفع قيمة مساحتك واستقطاب الحجوزات.',
      action: 'my-spaces',
      actionLabel: 'إضافة مرافق',
    });
  }

  // 8. مساحة نشطة بتقييم منخفض → حسّن تجربة العملاء
  const weakRatedSpaces = allSpaces.filter((s) => s.rating && s.rating < 4);
  if (weakRatedSpaces.length > 0) {
    suggestions.push({
      id: 'improve-rating',
      icon: <Star />,
      title: 'حسّن تقييم مساحتك',
      desc: `${weakRatedSpaces.length} مساحة بتقييم أقل من 4 — راقب ملاحظات العملاء (النظافة، الإنترنت، التواصل) وارفع جودة التجربة.`,
      action: 'reviews',
      actionLabel: 'مراجعة التقييمات',
    });
  }

  // 9. مساحة نشطة بدون سعر → حدّد سعر الساعة
  const unpricedSpaces = allSpaces.filter((s) => Number(s.price_per_hour) <= 0);
  if (unpricedSpaces.length > 0) {
    suggestions.push({
      id: 'set-price',
      icon: <CircleDollarSign />,
      title: 'حدّد سعر الساعة لمساحتك',
      desc: 'المساحات بدون سعر لا تظهر ضمن نتائج البحث بالأسعار — حدّد سعراً تنافسياً يجذب الطلبات ويبني الثقة.',
      action: 'my-spaces',
      actionLabel: 'تحديد السعر',
    });
  }

  return suggestions;
}

// خلط عشوائي (Fisher–Yates) — يُستخدم مرة واحدة عند فتح لوحة التحكم.
function shuffleIds(ids) {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function OwnerOverview({ data, onNavigate }) {
  const stats = data.stats || {};
  const [chartRange, setChartRange] = useState('7d'); // 7d | 14d | 30d | month
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(SUGGESTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

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
    ? bookings.filter((b) => belongsToSpace(b, selectedSpace))
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
        .filter(b => belongsToSpace(b, s))
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
      label: 'حجوزات هذا الشهر',
      value: fmtNumber(bookingGrowth.current),
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

  const suggestions = useMemo(
    () => generateSuggestions({ spaces: data.spaces, bookings: data.bookings, market: data.market }),
    [data.spaces, data.bookings, data.market]
  );

  // ترتيب الاقتراحات يُخلط عشوائياً مرة واحدة عند فتح اللوحة،
  // ثم يتبقى ثابتاً حتى مع تغيّر البيانات (مقاومة «عمى البانر»).
  const [orderIds] = useState(() => shuffleIds(suggestions.map((s) => s.id)));

  const visibleSuggestions = useMemo(() => {
    const byId = new Map(suggestions.map((s) => [s.id, s]));
    const ordered = orderIds.map((id) => byId.get(id)).filter(Boolean);
    // أي اقتراح جديد وصل بعد التحميل يُلحق في نهاية الترتيب.
    suggestions.forEach((s) => {
      if (!orderIds.includes(s.id)) ordered.push(s);
    });
    return ordered.filter((s) => !dismissedIds.includes(s.id));
  }, [suggestions, orderIds, dismissedIds]);

  const activeIndex = visibleSuggestions.length ? currentIndex % visibleSuggestions.length : 0;
  const activeSuggestion = visibleSuggestions[activeIndex] || null;

  // تدوير تلقائي كل 6 ثوانٍ: يتوقف عند التحويم/التركيز، ولا يعمل مع اقتراح واحد.
  useEffect(() => {
    if (visibleSuggestions.length <= 1 || paused) return undefined;
    const t = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % visibleSuggestions.length);
    }, 6000);
    return () => clearInterval(t);
  }, [visibleSuggestions.length, paused]);

  const dismissSuggestion = () => {
    if (!activeSuggestion) return;
    setDismissedIds((ids) => (ids.includes(activeSuggestion.id) ? ids : [...ids, activeSuggestion.id]));
  };

  // يحفظ الاقتراحات المُتجاهَلة محلياً حتى لا تظهر بعد إعادة التحميل.
  useEffect(() => {
    try {
      localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(dismissedIds));
    } catch {
      /* التخزين غير متاح */
    }
  }, [dismissedIds]);

  return (
    <>
      {/* بنر الاقتراحات الذكية */}
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

      {visibleSuggestions.length > 0 && (
        <motion.div
          className="odash__sug-banner"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {visibleSuggestions.length > 1 && (
            <div className={`odash__sug-progress${paused ? ' is-paused' : ''}`}>
              <span key={`${activeIndex}-${activeSuggestion.id}`} className="odash__sug-progress-bar" />
            </div>
          )}

          {activeSuggestion && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeSuggestion.id}
                className="odash__sug-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
              >
                <div className="odash__sug-ico">{activeSuggestion.icon}</div>
                <div className="odash__sug-body">
                  <h3>{activeSuggestion.title}</h3>
                  <p>{activeSuggestion.desc}</p>
                </div>
                <div className="odash__sug-actions">
                  <button
                    type="button"
                    className="btn-primary odash__sug-btn"
                    onClick={() => {
                      onNavigate(activeSuggestion.action);
                    }}
                  >
                    {activeSuggestion.actionLabel}
                  </button>
                  <button
                    type="button"
                    className="odash__sug-dismiss"
                    onClick={dismissSuggestion}
                    aria-label="إخفاء هذا الاقتراح"
                  >
                    <X />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      )}

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
                  <ChartBars
                    points={revenueChart.points.map((p) => ({
                      ...p,
                      key: p.key,
                      isToday: chartRange !== 'month' && p.key === localDayKey(new Date()),
                    }))}
                    max={revenueChart.max}
                    dense={revenueChart.days >= 14}
                    barClassName={(p) => (p.isToday ? ' is-today' : '')}
                    xHidden={(p) => !p.showLabel}
                    tip={(p) => `${p.label} — ${fmtMoney(p.value)} ش.ج`}
                  />
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
                    className="btn-primary"
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
    </>
  );
}