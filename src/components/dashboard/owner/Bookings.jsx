import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CalendarCheck, CalendarDays, History, ListChecks, Clock, ChevronRight, ChevronLeft,
  Loader2, Sparkles, X, Repeat, BadgeCheck, AlarmClock,
  Building2, MapPin, Gauge, Check, Store, Search, ChevronDown,
} from 'lucide-react';
import {
  isOwnerDemo,
  loadOwnerDashboardWithFallback,
  setBookingStatusWithFallback,
} from '../../../lib/owner';

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

function isConfirmed(status) {
  return status === 'confirmed' || status === 'accepted' || status === 'completed';
}

function isCancelled(status) {
  return status === 'cancelled' || status === 'rejected' || status === 'closed';
}

const STATUS_LABELS = {
  confirmed: 'مؤكَّد',
  accepted: 'مقبول',
  pending: 'قيد الانتظار',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  rejected: 'مرفوض',
  closed: 'مغلق',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'غير معروف';
}

const ARABIC_DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function localDayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayKeyOf(date) {
  const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

// يقرأ وقت البدء من الحجز (ساعة:دقيقة) مع تجاهل الثواني إن وُجدت.
function startClock(b) {
  const m = String(b.timeFrom || b.time || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return `${m[1]}:${m[2]}`;
}

function fmtDayTitle(key) {
  const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

const VIEWS = [
  { id: 'today', label: 'حجوزات اليوم', icon: AlarmClock },
  { id: 'calendar', label: 'التقويم', icon: CalendarDays },
  { id: 'requests', label: 'طلبات الحجز', icon: ListChecks },
  { id: 'history', label: 'سجل الحجوزات', icon: History },
];

export default function Bookings({ data }) {
  const [bookings, setBookings] = useState(() => data?.bookings || []);
  const [spaces, setSpaces] = useState(() => data?.spaces || []);
  const [demo, setDemo] = useState(() => isOwnerDemo());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [view, setView] = useState('calendar');
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1 };
  });
  const [selectedDay, setSelectedDay] = useState(() => localDayKey(new Date()));
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [spaceId, setSpaceId] = useState(''); // '' = كل المساحات
  const [query, setQuery] = useState('');
  const [openPicker, setOpenPicker] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpenPicker(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pickSpace = useCallback((id) => {
    setSpaceId(id);
    setQuery('');
    setOpenPicker(false);
  }, []);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadOwnerDashboardWithFallback(force);
      setBookings(result.bookings || []);
      setSpaces(result.spaces || []);
      setDemo(result.demo);
    } catch {
      /* لا نكسر العرض */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const todayKey = localDayKey(new Date());
  const monthKeyNow = todayKey.slice(0, 7);

  // إحصاءات كل مساحة على حدة: تُشتق من الحجوزات نفسها وتُدمج مع بطاقة المساحة.
  const spaceRows = useMemo(() => {
    const empty = () => ({ confirmed: 0, pending: 0, cancelled: 0, today: 0, monthHours: 0 });
    const agg = {};
    bookings.forEach((b) => {
      const name = b.spaceName || 'أخرى';
      if (!agg[name]) agg[name] = empty();
      const a = agg[name];
      const dk = dayKeyOf(b.date);
      if (dk === todayKey) a.today += 1;
      if (isCancelled(b.status)) a.cancelled += 1;
      else if (isConfirmed(b.status)) {
        a.confirmed += 1;
        if (dk && dk.slice(0, 7) === monthKeyNow) a.monthHours += Number(b.hours || 0);
      } else a.pending += 1;
    });

    const occupancyFor = (sp) => {
      const stored = Math.round(Number(sp.stats?.occupancy ?? -1));
      if (stored >= 0) return stored;
      const cap = Number(sp.capacity || 0);
      const a = agg[sp.title];
      if (!cap || !a || !a.monthHours) return 0;
      const days = new Date(Number(monthKeyNow.slice(0, 4)), Number(monthKeyNow.slice(5, 7)), 0).getDate();
      const total = cap * 8 * days;
      return total > 0 ? Math.min(100, Math.round((a.monthHours / total) * 100)) : 0;
    };

    if (spaces.length) {
      return spaces.map((sp) => ({ ...sp, ...(agg[sp.title] || empty()), occupancy: occupancyFor(sp) }));
    }
    return Object.entries(agg).map(([title, a]) => ({
      id: title, title, image: '', location: '', is_active: true, capacity: 0, ...a, occupancy: 0,
    }));
  }, [spaces, bookings, todayKey, monthKeyNow]);

  const selectedSpace = spaceRows.find((s) => String(s.id) === String(spaceId)) || null;

  // كل أقسام الصفحة (التقويم، الطلبات، السجل) تعرض حجوزات المساحة المختارة فقط.
  const scopedBookings = selectedSpace
    ? bookings.filter((b) => b.spaceName && b.spaceName === selectedSpace.title)
    : bookings;

  const confirmedBookings = scopedBookings.filter((b) => isConfirmed(b.status));
  const pendingBookings = scopedBookings.filter((b) => b.status === 'pending');
  const todayCount = scopedBookings.filter((b) => dayKeyOf(b.date) === localDayKey(new Date())).length;

  // حجوزات اليوم حسب المساحة المختارة: قائمة موسّعة بالتواريخ والأوقات.
  const todayBookings = useMemo(() => {
    const key = localDayKey(new Date());
    return scopedBookings
      .filter((b) => dayKeyOf(b.date) === key)
      .slice()
      .sort((a, b) => String(a.timeFrom || a.time || '').localeCompare(String(b.timeFrom || b.time || '')));
  }, [scopedBookings]);

  const filteredPicker = query
    ? spaceRows.filter((s) => (s.title || '').toLowerCase().includes(query.toLowerCase()))
    : spaceRows;

  // إجمالي كل المساحات (يُعرض افتراضياً قبل اختيار مساحة محددة).
  const allAgg = useMemo(() => {
    const t = { confirmed: 0, pending: 0, cancelled: 0, today: 0, monthHours: 0, occupancy: 0 };
    let occSum = 0;
    let occCount = 0;
    spaceRows.forEach((s) => {
      t.confirmed += s.confirmed;
      t.pending += s.pending;
      t.cancelled += s.cancelled;
      t.today += s.today;
      t.monthHours += s.monthHours;
      if (s.occupancy > 0) { occSum += s.occupancy; occCount += 1; }
    });
    t.occupancy = occCount ? Math.round(occSum / occCount) : 0;
    const activeCount = spaceRows.filter((s) => s.is_active !== false).length;
    return { id: 'all', title: 'كل المساحات', image: '', location: `${activeCount} مساحة نشطة`, is_active: true, ...t };
  }, [spaceRows]);

  // البطاقة العلوية تتغيّر حسب المساحة المختارة: إحصاءات المساحة فقط عند اختيارها.
  const summary = useMemo(() => {
    const scoped = selectedSpace
      ? {
          confirmed: selectedSpace.confirmed,
          pending: selectedSpace.pending,
          today: selectedSpace.today,
          monthHours: selectedSpace.monthHours,
        }
      : {
          confirmed: confirmedBookings.length,
          pending: pendingBookings.length,
          today: todayCount,
          monthHours: spaceRows.reduce((sum, s) => sum + s.monthHours, 0),
        };
    return [
      { icon: BadgeCheck, value: scoped.confirmed, label: 'حجوزات مؤكَّدة' },
      { icon: AlarmClock, value: scoped.pending, label: 'طلبات بانتظار الرد' },
      { icon: CalendarCheck, value: scoped.today, label: 'حجوزات اليوم' },
      { icon: Clock, value: fmtNumber(scoped.monthHours), label: 'ساعات محجوزة' },
    ];
  }, [selectedSpace, confirmedBookings.length, pendingBookings.length, todayCount, spaceRows]);

  const renderSpaceStat = (s, isAll) => (
    <article className={`obk__space obk__space--single${s.is_active === false ? ' is-off' : ''}`}>
      <div className="obk__space-head">
        {s.image ? (
          <img src={s.image} alt={s.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div className="obk__space-ico"><Building2 /></div>
        )}
        <div className="obk__space-title">
          <h3>{s.title}</h3>
          {s.location && <p><MapPin /> {s.location}</p>}
        </div>
        {isAll ? (
          <span className="obk__space-status">{fmtNumber(s.confirmed)} تأكيداً</span>
        ) : (
          <span className={`obk__space-status${s.is_active === false ? ' is-off' : ''}`}>
            {s.is_active === false ? 'موقوفة' : 'نشطة'}
          </span>
        )}
      </div>
      <div className="obk__space-stats">
        <div><b>{fmtNumber(s.confirmed)}</b><span>حجز مؤكَّد</span></div>
        <div><b>{fmtNumber(s.today)}</b><span>حجوزات اليوم</span></div>
        <div><b>{fmtNumber(s.pending)}</b><span>قيد الانتظار</span></div>
        <div><b>{fmtNumber(s.monthHours)}</b><span>ساعات الشهر</span></div>
      </div>
      <div className="obk__space-occ">
        <div className="obk__space-occ-label">
          <span><Gauge /> {isAll ? 'متوسط الإشغال' : 'إشغال الشهر'}</span>
          <b>{fmtNumber(s.occupancy)}٪</b>
        </div>
        <div className="odash__util-bar" role="img" aria-label={`نسبة الإشغال ${s.occupancy}٪`}>
          <span className="odash__util-bar-fill" style={{ width: `${Math.min(100, s.occupancy)}%` }} />
        </div>
      </div>
    </article>
  );

  const handleStatus = useCallback(async (b, status) => {
    if (busyId) return;
    setBusyId(b.id);
    try {
      const result = await setBookingStatusWithFallback(b.id, status);
      setBookings((prev) =>
        prev.map((x) => (String(x.id) === String(b.id) ? { ...x, status } : x))
      );
      setToast({ msg: result.message, type: status === 'confirmed' ? 'ok' : 'warn' });
    } catch {
      setToast({ msg: 'تعذّر تحديث حالة الحجز.', type: 'err' });
    } finally {
      setBusyId(null);
    }
  }, [busyId]);

  const byDay = useMemo(() => {
    const map = {};
    scopedBookings.forEach((b) => {
      const key = dayKeyOf(b.date);
      if (!key) return;
      if (!map[key]) map[key] = { confirmed: 0, pending: 0, cancelled: 0, list: [] };
      if (isCancelled(b.status)) map[key].cancelled += 1;
      else if (isConfirmed(b.status)) map[key].confirmed += 1;
      else map[key].pending += 1;
      map[key].list.push(b);
    });
    return map;
  }, [scopedBookings]);

  const monthTitle = `${ARABIC_MONTHS[cursor.m - 1]} ${cursor.y}`;
  const dayTitle = fmtDayTitle(selectedDay);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m - 1, 1);
    const startOffset = first.getDay();
    const start = new Date(cursor.y, cursor.m - 1, 1 - startOffset);
    const out = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const selectedBookings = useMemo(() => {
    const list = (byDay[selectedDay] || {}).list || [];
    return [...list].sort((a, b) => String(a.timeFrom || a.time || '').localeCompare(String(b.timeFrom || b.time || '')));
  }, [byDay, selectedDay]);

  const moveMonth = (dir) => {
    const next = new Date(cursor.y, cursor.m - 1 + dir, 1);
    setCursor({ y: next.getFullYear(), m: next.getMonth() + 1 });
  };

  const jumpToToday = () => {
    const now = new Date();
    setCursor({ y: now.getFullYear(), m: now.getMonth() + 1 });
    setSelectedDay(localDayKey(now));
  };

  const renderBookingRow = (b, opts = {}) => {
    const pending = b.status === 'pending';
    const statusEl = (
      <span className={`obk__status is-${isCancelled(b.status) ? 'off' : (isConfirmed(b.status) ? 'ok' : 'pending')}`}>
        {statusLabel(b.status)}
      </span>
    );
    const side = opts.actions && pending ? (
      <span className="obk__row-side">
        {statusEl}
        <span className="obk__row-actions">
          <button
            type="button"
            className="obk__act is-ok"
            onClick={() => handleStatus(b, 'confirmed')}
            disabled={busyId === b.id}
          >
            {busyId === b.id ? <Loader2 className="spin" /> : <Check />}
            تأكيد
          </button>
          <button
            type="button"
            className="obk__act is-danger"
            onClick={() => handleStatus(b, 'cancelled')}
            disabled={busyId === b.id}
          >
            <X /> رفض
          </button>
        </span>
      </span>
    ) : statusEl;

    return (
      <div className={`obk__row is-${b.status || 'pending'}`} key={b.id}>
        <span className="obk__row-time">{startClock(b) || '—'}</span>
        <span className="obk__row-line" />
        <span className="obk__row-main">
          <b>{b.customer || 'عميل'}</b>
          {opts.showDate && b.date && (
            <small className="obk__row-date"><CalendarDays /> {fmtDayTitle(b.date)}</small>
          )}
          <small><CalendarCheck /> {b.spaceName || 'مساحة غير محددة'}</small>
          <small className="obk__row-extra">
            <Clock /> {fmtNumber(b.hours)} ساعات
          </small>
        </span>
        {side}
      </div>
    );
  };

  const renderListState = (icon, title, desc) => (
    <div className="odash__state">
      <div className="ost-svg">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );

  return (
    <section className="odash__bookings obk">
      {demo && !bannerDismissed && (
        <div className="odash__banner">
          <Sparkles />
          <p>
            <b>وضع تجريبي</b> — تُبنى الحجوزات أدناه من بيانات تجريبية حول تاريخ اليوم.
            عند تفعيل واجهة الباك إند ستُحدَّث تلقائياً من سجل الحجوزات الحقيقي.
          </p>
          <button type="button" onClick={() => setBannerDismissed(true)} aria-label="إغلاق" className="odash__banner-x">
            <X />
          </button>
        </div>
      )}

      <div className="obk__hero">
        <div className="obk__hero-main">
          <h2><CalendarCheck /> الحجوزات</h2>
          <p>تقويم حجوزاتك، وطلبات بانتظار الرد، والسجل الكامل لمساحاتك.</p>
          <div className="obk__hero-meta">
            <span className="obk__hero-chip"><CalendarDays /> {fmtDayTitle(todayKey)}</span>
            <span className="obk__hero-chip"><ListChecks /> {fmtNumber(pendingBookings.length)} بانتظار الرد</span>
            <span className="obk__hero-chip"><Building2 /> {fmtNumber(spaceRows.length)} مساحة</span>
          </div>
        </div>
        <button
          type="button"
          className="odash__market-refresh obk__hero-refresh"
          onClick={() => load(true)}
          disabled={refreshing}
          aria-label="تحديث الحجوزات"
          title="تحديث الحجوزات"
        >
          <Repeat className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {loading && bookings.length === 0 ? (
        <div className="odash__state">
          <div className="ost-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ تحميل الحجوزات…</h3>
          <p>نعرض تقويم حجوزاتك وطلباتك الحالية.</p>
        </div>
      ) : (
        <>
          <section className="odash__section obk__spaces-sec" ref={pickerRef}>
            <div className="odash__section-head">
              <div>
                <h2><Building2 /> إحصائيات كل مساحة</h2>
                <p className="obk__day-sub">اختر مساحة لتعرض كل الأقسام أدناه — التقويم والطلبات والسجل — حجوزاتها فقط.</p>
              </div>
            </div>

            <div className="odash__filter">
              <div className="odash__filter-ico"><Store /></div>
              <div className="odash__filter-main">
                <span className="odash__filter-label">
                  {selectedSpace ? 'إحصاءات مساحة ' : 'تُعرض الإحصاءات لكل المساحات'}
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
            </div>

            {spaceRows.length > 0 ? (
              selectedSpace
                ? renderSpaceStat(selectedSpace, false)
                : renderSpaceStat(allAgg, true)
            ) : (
              renderListState(
                <Building2 />,
                'لا توجد مساحات بعد',
                'أضف مساحة، وعند ورود الحجوزات ستظهر إحصاءات كل مساحة هنا.'
              )
            )}
          </section>

          <section className="odash__stats odash__stats--4">
            {summary.map((c) => {
              const Icon = c.icon;
              return (
                <div className="odash__stat" key={c.label}>
                  <div className="ost-ico"><Icon /></div>
                  <b>{fmtNumber(c.value)}</b>
                  <span>{c.label}</span>
                </div>
              );
            })}
          </section>

          <div className="obk__tabs" role="group" aria-label="أقسام الحجوزات">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const on = view === v.id;
              return (
                <button
                  type="button"
                  key={v.id}
                  className={on ? 'is-active' : ''}
                  onClick={() => setView(v.id)}
                  aria-pressed={on}
                >
                  <Icon />
                  <span>{v.label}</span>
                  {v.id === 'requests' && pendingBookings.length > 0 && (
                    <b className="obk__tab-count">{fmtNumber(pendingBookings.length)}</b>
                  )}
                </button>
              );
            })}
          </div>

          {view === 'today' && (
            <section className="odash__section obk__today-sec">
              <div className="odash__section-head">
                <div>
                  <h2><AlarmClock /> حجوزات اليوم</h2>
                  <p className="obk__day-sub">
                    {fmtDayTitle(todayKey)}
                    {selectedSpace ? ` — حجوزات «${selectedSpace.title}» المقرَّرة اليوم فقط.` : ' — كل حجوزات اليوم على مساحاتك.'}
                  </p>
                </div>
                {todayBookings.length > 0 && (
                  <span className="obk__day-count">{fmtNumber(todayCount)} حجز</span>
                )}
              </div>

              {todayBookings.length > 0 ? (
                <>
                  <div className="obk__rows">
                    {todayBookings.map((b) => renderBookingRow(b, { actions: true }))}
                  </div>
                </>
              ) : (
                renderListState(
                  <AlarmClock />,
                  'لا حجوزات لليوم',
                  selectedSpace
                    ? `لا توجد حجوزات لـ «${selectedSpace.title}» مقرَّرة اليوم.`
                    : 'لا توجد حجوزات مقرَّرة على مساحاتك اليوم.'
                )
              )}
            </section>
          )}

          {view === 'calendar' && (
            <section className="odash__section obk__cal-sec">
              <div className="obk__cal-head">
                <div className="obk__cal-nav">
                  <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    aria-label="الشهر السابق"
                    title="الشهر السابق"
                  >
                    <ChevronRight />
                  </button>
                  <h2>{monthTitle}</h2>
                  <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    aria-label="الشهر التالي"
                    title="الشهر التالي"
                  >
                    <ChevronLeft />
                  </button>
                </div>
                <button type="button" className="obk__cal-today" onClick={jumpToToday}>
                  اليوم
                </button>
              </div>

              <div className="obk__cal-week" role="row" aria-label="أسماء الأيام">
                {ARABIC_DAYS_SHORT.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="obk__cal-grid" role="grid" aria-label="تقويم الحجوزات">
                {cells.map((d) => {
                  const key = localDayKey(d);
                  const inMonth = d.getMonth() === cursor.m - 1;
                  const info = byDay[key];
                  const isToday = key === todayKey;
                  const isSelected = key === selectedDay;
                  return (
                    <button
                      type="button"
                      key={key}
                      className={[
                        'obk__day',
                        inMonth ? '' : ' is-muted',
                        info && (info.confirmed || info.pending) ? ' is-booked' : '',
                        isToday ? ' is-today' : '',
                        isSelected ? ' is-selected' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setSelectedDay(key)}
                      aria-pressed={isSelected}
                      aria-label={`${Number(d.getDate())} ${ARABIC_MONTHS[d.getMonth()]}`}
                    >
                      <span className="obk__day-num">{d.getDate()}</span>
                      {info && (info.confirmed > 0 || info.pending > 0) && (
                        <span className="obk__day-chips">
                          {info.confirmed > 0 && <b className="is-ok" title={`${info.confirmed} حجز مؤكَّد`}>{info.confirmed}</b>}
                          {info.pending > 0 && <b className="is-pending" title={`${info.pending} بانتظار الرد`}>{info.pending}</b>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="obk__legend">
                <span><i className="is-ok" /> مؤكَّد</span>
                <span><i className="is-pending" /> قيد الانتظار</span>
                <span><i className="is-today" /> اليوم</span>
              </div>

              <div className="obk__day-list">
                <div className="odash__section-head">
                  <div>
                    <h2><CalendarDays /> حجوزات اليوم المحدد</h2>
                    <p className="obk__day-sub">{dayTitle}</p>
                  </div>
                  {selectedBookings.length > 0 && (
                    <span className="obk__day-count">{fmtNumber(selectedBookings.length)} حجز</span>
                  )}
                </div>
                {selectedBookings.length > 0 ? (
                  <div className="obk__rows">
                    {selectedBookings.map((b) => renderBookingRow(b))}
                  </div>
                ) : (
                  <div className="odash__state">
                    <div className="ost-svg"><CalendarDays /></div>
                    <h3>لا حجوزات في هذا اليوم</h3>
                    <p>ستظهر حجوزات هذا اليوم بمجرد ورودها من الباك إند.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === 'requests' && (
            <section className="odash__section">
              <div className="odash__section-head">
                <div>
                  <h2><ListChecks /> طلبات الحجز</h2>
                  <p className="obk__day-sub">حجوزات قيد الانتظار بانتظار تأكيدك.</p>
                </div>
                {pendingBookings.length > 0 && (
                  <span className="obk__day-count">{fmtNumber(pendingBookings.length)} طلب</span>
                )}
              </div>
              {pendingBookings.length > 0 ? (
                <>
                  <div className="obk__rows">
                    {pendingBookings
                      .slice()
                      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
                      .map((b) => renderBookingRow(b, { actions: true }))}
                  </div>
                  <p className="obk__note">
                    تأكيد الحجز يرسل الطلب للعميل، والرفض يلغي طلب الحجز نهائياً.
                  </p>
                </>
              ) : (
                renderListState(
                  <ListChecks />,
                  'لا توجد طلبات حجز معلقة',
                  'عند وصول طلب حجز جديد سيظهر هنا ليتم تأكيده أو رفضه.'
                )
              )}
            </section>
          )}

          {view === 'history' && (
            <section className="odash__section">
              <div className="odash__section-head">
                <div>
                  <h2><History /> سجل الحجوزات</h2>
                  <p className="obk__day-sub">كل الحجوزات المؤكَّدة والمكتملة والملغاة حسب تاريخها.</p>
                </div>
                {scopedBookings.length > 0 && (
                  <span className="obk__day-count">{fmtNumber(scopedBookings.length)} حجز</span>
                )}
              </div>
              {scopedBookings.length > 0 ? (
                <>
                  <div className="obk__rows">
                    {scopedBookings
                      .slice()
                      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
                      .map((b) => renderBookingRow(b, { showDate: true }))}
                  </div>
                </>
              ) : (
                renderListState(
                  <History />,
                  'لا حجوزات بعد',
                  'ستظهر الحجوزات هنا فور ورودها من الباك إند مع حالتها وتفاصيلها.'
                )
              )}
            </section>
          )}
        </>
      )}

      {toast && (
        <div className={`odash__market-toast is-${toast.type}`} role="status">
          {toast.type === 'ok' ? <Check /> : <X />}
          <span>{toast.msg}</span>
        </div>
      )}
    </section>
  );
}