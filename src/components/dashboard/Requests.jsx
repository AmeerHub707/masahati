import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Plus, Sparkles, Repeat, ChevronLeft, ChevronRight, X, Check,
  Loader2, Clock, CalendarClock, Users, MapPin, Wallet, Building2,
  DoorOpen, BadgeCheck, CircleDollarSign, Wifi, Zap, Video, Snowflake, Mic, Pencil, Send,
  Share2, Copy, Lock, AlertTriangle, Ban, Eraser,
} from 'lucide-react';
import {
  loadRequestsWithFallback,
  loadRequestDetailWithFallback,
  createRequestWithFallback,
  rejectOfferWithFallback,
  closeRequestWithFallback,
  newOffersCountFor,
  markRequestSeen,
  isRequestOpen,
  isRequestExpired,
  SPACE_TYPES,
  AMENITY_LABELS,
  SCHEDULE_LABELS,
} from '../../lib/requests';

const AMENITY_ICONS = {
  internet: Wifi,
  electricity: Zap,
  projector: Video,
  ac: Snowflake,
  microphone: Mic,
  whiteboard: Pencil,
};

const DEFAULT_FORM = {
  title: '',
  space_type: 'whole',
  capacity: '',
  schedule: { preset: 'once', count: 1 },
  preferred_time: '',
  area: '',
  amenities: [],
  budget: '',
  notes: '',
};

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

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

export default function Requests({ onAcceptOffer, onOffersChange, view: viewProp, onViewChange }) {
  const [view, setView] = useState(viewProp !== undefined ? viewProp : 'list'); // 'list' | 'create' | 'detail'
  const [requests, setRequests] = useState([]);
  const [detail, setDetail] = useState(null);
  const [demo, setDemo] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [confirmOffer, setConfirmOffer] = useState(null);
  const [confirmReject, setConfirmReject] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [sortKey, setSortKey] = useState('default');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
  }, []);

  // إبلاغ الأب (لوحة التحكم) عند تغيير العرض حتى تبقى حالة التبويب الداخلي
  // محفوظة إذا غادر المستخدم الصفحة ثم عاد إليها.
  const setCurrentView = useCallback((v) => {
    setView(v);
    if (onViewChange) onViewChange(v);
  }, [onViewChange]);

  // في الوضع المُتحكَّم (من اللوحة) نشتقّ العرض مباشرة من الأب،
  // وإلا نستخدم الحالة الداخلية — بلا مضاعفة مزامنة عبر تأثيرات.
  const effectiveView = viewProp !== undefined ? viewProp : view;

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const loadList = useCallback(async (force = false) => {
    setListLoading((prev) => prev && !force);
    if (force) setRefreshing(true);
    try {
      const result = await loadRequestsWithFallback(force);
      setRequests(result.requests);
      setDemo(result.demo);
    } catch {
      /* النافذة الاستهلالية لا ترمي أخطاءً */
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadList(), 0);
    return () => clearTimeout(t);
  }, [loadList]);

  // شارة لوحة التحكم: عدد الطلبات المفتوحة التي وصلها عروض للمراجعة.
  const badgeCount = useMemo(
    () => requests.filter((r) => r.status === 'open' && Number(r.offers_count) > 0).length,
    [requests]
  );

  useEffect(() => {
    if (onOffersChange) onOffersChange(badgeCount);
  }, [badgeCount, onOffersChange]);

  const openDetail = useCallback(async (id) => {
    setCurrentView('detail');
    setDetailLoading(true);
    setDetail(null);
    try {
      const result = await loadRequestDetailWithFallback(id);
      setDetail(result);
      setDemo(result.demo);
      markRequestSeen(result.id, (result.offers || []).length);
      loadList();
    } catch {
      showToast('تعذّر تحميل تفاصيل الطلب.', 'err');
      setCurrentView('list');
    } finally {
      setDetailLoading(false);
    }
  }, [showToast, loadList, setCurrentView]);

  const backToList = useCallback(() => {
    setCurrentView('list');
    setDetail(null);
    loadList();
  }, [loadList, setCurrentView]);

  const toggleAmenity = (key) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(key)
        ? f.amenities.filter((a) => a !== key)
        : [...f.amenities, key],
    }));
  };

  const validateForm = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'يرجى كتابة عنوان للطلب.';
    if (!form.capacity || Number(form.capacity) <= 0) e.capacity = 'حدّد عدد الأشخاص المتوقع.';
    if (!form.preferred_time.trim()) e.preferred_time = 'حدّد الوقت التقريبي المفضّل.';
    if (form.schedule.preset !== 'once' && (!form.schedule.count || Number(form.schedule.count) < 1)) {
      e.schedule = 'حدّد عدد مرات التكرار.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) {
      showToast('يرجى استكمال الحقول المطلوبة.', 'err');
      return;
    }
    setCreating(true);
    try {
      const result = await createRequestWithFallback({
        title: form.title.trim(),
        notes: form.notes.trim(),
        space_type: form.space_type,
        capacity: Number(form.capacity),
        schedule: {
          preset: form.schedule.preset,
          count: form.schedule.preset === 'once' ? 1 : Number(form.schedule.count),
        },
        preferred_time: form.preferred_time.trim(),
        area: form.area.trim(),
        amenities: form.amenities,
        budget: Number(form.budget) || 0,
      });
      setDemo(result.demo);
      setForm(DEFAULT_FORM);
      setErrors({});
      setCurrentView('list');
      await loadList(result.demo ? false : true);
      showToast(
        result.demo
          ? 'تم نشر طلبك (وضع تجريبي) — ستظهر العروض هنا عند وصولها.'
          : 'تم نشر طلبك بنجاح — سيصلك تنبيه عند وصول العروض.'
      );
    } catch {
      showToast('تعذّر نشر الطلب. حاول مجدداً.', 'err');
    } finally {
      setCreating(false);
    }
  };

  const handleAccept = async () => {
    if (!confirmOffer) return;
    const offer = confirmOffer.offer;
    setAcceptingId(offer.id);
    try {
      if (onAcceptOffer) {
        const result = await onAcceptOffer(confirmOffer.requestId, offer.id, detail);
        setDemo(result?.demo ?? demo);
        if (result?.request) {
          setDetail((prev) => (prev ? { ...prev, ...result.request } : prev));
        }
        if (result?.message) showToast(result.message);
      }
      setConfirmOffer(null);
      loadList();
    } catch {
      showToast('تعذّر قبول العرض. حاول مجدداً.', 'err');
      setConfirmOffer(null);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async () => {
    if (!confirmReject || !detail || rejectingId) return;
    const offer = confirmReject.offer;
    setRejectingId(offer.id);
    try {
      const result = await rejectOfferWithFallback(detail.id, offer.id);
      setDemo(result?.demo ?? demo);
      if (result?.request) {
        setDetail((prev) => (prev ? { ...prev, ...result.request } : prev));
      }
      setConfirmReject(null);
      showToast(result?.message || 'تم رفض العرض.', 'ok');
      loadList();
    } catch {
      showToast('تعذّر رفض العرض. حاول مجدداً.', 'err');
      setConfirmReject(null);
    } finally {
      setRejectingId(null);
    }
  };

  const handleClose = async () => {
    if (!detail || closingId) return;
    setClosingId(detail.id);
    try {
      const result = await closeRequestWithFallback(detail.id);
      setDemo(result?.demo ?? demo);
      if (result?.request) {
        setDetail((prev) => (prev ? { ...prev, ...result.request } : prev));
      }
      setConfirmClose(false);
      showToast(result?.message || 'تم إغلاق الطلب.', 'ok');
      loadList();
    } catch {
      showToast('تعذّر إغلاق الطلب. حاول مجدداً.', 'err');
      setConfirmClose(false);
    } finally {
      setClosingId(null);
    }
  };

  const offerCountLabel = (n) => {
    const v = Number(n || 0);
    if (v === 0) return 'لا عروض بعد';
    if (v === 1) return 'عرض واحد';
    if (v === 2) return 'عرضان';
    if (v <= 10) return `${fmtNumber(v)} عروض`;
    return `${fmtNumber(v)} عرضًا`;
  };

  // وصف نصي مختصر للطلب للمشاركة في واتساب / النسخ.
  const describeRequest = (r) => {
    const budget = r.budget > 0 ? ` | ميزانية تصل ${fmtNumber(r.budget)} ش.ج` : '';
    return `طلب خاص في مساحاتي: ${r.title}${budget}`;
  };

  const shareViaWhatsApp = (r) => {
    const text = `${describeRequest(r)}\nhttps://masahati.ps/requests/${r.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const copyShareLink = async (r) => {
    const text = `${describeRequest(r)}\nhttps://masahati.ps/requests/${r.id}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('تم نسخ رابط الطلب لمشاركته.', 'ok');
    } catch {
      showToast('تعذّر النسخ. حاول مجدداً.', 'err');
    }
  };

  // "نشر طلب مشابه": يبني استمارة مسبقة من طلب قائم ويفتح صفحة الإنشاء.
  const duplicateRequest = (r) => {
    const preset = r.schedule?.preset || 'once';
    setForm({
      title: r.title || '',
      space_type: r.space_type || 'whole',
      capacity: r.capacity ? String(r.capacity) : '',
      schedule: {
        preset,
        count: Number(r.schedule?.count) || 1,
      },
      preferred_time: r.preferred_time || '',
      area: r.area || '',
      amenities: r.amenities || [],
      budget: r.budget ? String(r.budget) : '',
      notes: r.notes || '',
    });
    setErrors({});
    setCurrentView('create');
    showToast('تم تعبئة النموذج من الطلب المحدد — عدّل ثم انشر.', 'ok');
  };

  // مسح النموذج بالكامل ليبدأ المستخدم من جديد.
  const clearForm = () => {
    setForm(DEFAULT_FORM);
    setErrors({});
    showToast('تم مسح الحقول — يمكنك التعبئة من جديد.', 'ok');
  };

  const SORT_OPTIONS = [
    { key: 'default', label: 'الترتيب الافتراضي' },
    { key: 'price-asc', label: 'الأرخص أولاً' },
    { key: 'rating-desc', label: 'الأعلى تقييماً' },
    { key: 'duration-asc', label: 'الأقصر مدة' },
  ];

  const sortedOffers = (offers) => {
    const arr = [...offers];
    if (sortKey === 'price-asc') {
      arr.sort((a, b) => Number(a.price_per_hour || 0) - Number(b.price_per_hour || 0));
    } else if (sortKey === 'rating-desc') {
      arr.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    } else if (sortKey === 'duration-asc') {
      arr.sort((a, b) => Number(a.duration_hours || 0) - Number(b.duration_hours || 0));
    }
    return arr;
  };

  const renderBanner = () => {
    if (!demo || bannerDismissed) return null;
    return (
      <div className="dash__req-banner">
        <Sparkles />
        <p>
          <b>وضع تجريبي</b> — واجهة الخادم (API) غير مفعّلة بعد، البيانات أدناه للتجربة
          وستُحفظ محلياً. عند نزول واجهة الباك إند سيتولّى النظام تلقائياً.
        </p>
        <button type="button" onClick={() => setBannerDismissed(true)} aria-label="إغلاق" className="dash__req-banner-x">
          <X />
        </button>
      </div>
    );
  };

  const renderList = () => {
    if (listLoading) {
      return (
        <div className="dash__state">
          <div className="st-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ تحميل طلباتك…</h3>
          <p>نصادق على العروض الواصلة لك.</p>
        </div>
      );
    }

    const openReqs = requests.filter((r) => isRequestOpen(r));
    const closedReqs = requests.filter((r) => !isRequestOpen(r));

    return (
      <>
        <div className="dash__req-steps">
          <div><span>1</span> اكتب ما تحتاجه</div>
          <div><span>2</span> يصلك عروض المالكين</div>
          <div><span>3</span> اختر الأنسب واحجز</div>
        </div>

        {requests.length === 0 ? (
          <div className="dash__state">
            <div className="st-svg"><Megaphone /></div>
            <h3>لا توجد طلبات خاصة بعد</h3>
            <p>أخبر مالكي المساحات بما تبحث عنه بالظبط، ودعهم يقدّموا لك عروضهم.</p>
            <button type="button" className="btn-primary" onClick={() => setCurrentView('create')}>
              <Plus /> أنشئ طلبك الأول
            </button>
          </div>
        ) : (
          <>
            {openReqs.length > 0 && (
              <section className="dash__section">
                <div className="dash__section-head">
                  <h2><Megaphone /> في انتظار العروض</h2>
                </div>
                <div className="dash__req-grid">
                  {openReqs.map((r) => renderCard(r))}
                </div>
              </section>
            )}

            {closedReqs.length > 0 && (
              <section className="dash__section">
                <div className="dash__section-head">
                  <h2><BadgeCheck /> طلبات منتهية</h2>
                </div>
                <div className="dash__req-grid">
                  {closedReqs.map((r) => renderCard(r))}
                </div>
              </section>
            )}
          </>
        )}
      </>
    );
  };

  const renderCard = (r) => {
    const expired = isRequestExpired(r);
    const newCount = isRequestOpen(r) && !expired ? newOffersCountFor(r) : 0;
    const statusMeta = r.status === 'accepted'
      ? { label: 'تم القبول', cls: 'badge--confirmed', Icon: BadgeCheck }
      : r.status === 'closed' || expired
        ? { label: expired ? 'انتهى وقته' : 'تم الإغلاق', cls: 'badge--muted', Icon: Ban }
        : Number(r.offers_count) > 0
          ? { label: offerCountLabel(r.offers_count), cls: 'badge--pending', Icon: Clock }
          : { label: 'بانتظار العروض', cls: 'badge--pending', Icon: Clock };
    const SIcon = r.status === 'accepted' ? BadgeCheck : (r.status === 'closed' || expired) ? Ban : Megaphone;
    const meta = statusMeta;
    const MIcon = meta.Icon;

    return (
      <div className={`dash__req-card${r.status === 'accepted' ? ' is-done' : ''}${r.status === 'closed' || expired ? ' is-closed' : ''}`} key={r.id}>
        <div className="dash__req-main">
          <div className="dash__req-ico"><SIcon /></div>
          <div className="dash__req-body">
            <div className="dash__req-topline">
              <span className={`badge ${meta.cls}`}><MIcon /> {meta.label}</span>
              <span className="dash__req-time">{timeAgo(r.created_at)}</span>
            </div>
            {newCount > 0 && (
              <span className="dash__offer-badge-new"><Sparkles /> {newCount} عروض جديدة</span>
            )}
            <h3>{r.title}</h3>
            <p className="dash__req-desc">{r.notes || 'بدون تفاصيل إضافية.'}</p>
            <div className="dash__req-meta">
              <span><CalendarClock /> {r.schedule_label || 'مرة واحدة'}</span>
              <span><Clock /> {r.preferred_time || 'وقت مرن'}</span>
              <span><Users /> {fmtNumber(r.capacity)} شخص</span>
              {r.area && <span><MapPin /> {r.area}</span>}
              <span><DoorOpen /> {r.spaceTypeLabel}</span>
            </div>
            <div className="dash__req-chips">
              {r.amenities.slice(0, 4).map((a) => {
                const AIcon = AMENITY_ICONS[a];
                return (
                  <span key={a}>
                    {AIcon ? <AIcon /> : null} {AMENITY_LABELS[a] || a}
                  </span>
                );
              })}
              {r.budget > 0 && (
                <span className="is-price"><CircleDollarSign /> حتى {fmtNumber(r.budget)} ش.ج</span>
              )}
            </div>
          </div>
        </div>
        <div className="dash__req-foot">
          {r.status === 'accepted' ? (
            <span className="dash__req-accepted"><Check /> تم تحويل الحجز إلى تبويب الحجوزات</span>
          ) : (
            <span className="dash__req-offers"><BadgeCheck /> {offerCountLabel(r.offers_count)}</span>
          )}
          <div className="dash__req-foot-actions">
            <button
              type="button"
              className="dash__req-iconbtn"
              onClick={() => duplicateRequest(r)}
              title="نشر طلب مشابه"
              aria-label="نشر طلب مشابه"
            >
              <Repeat />
            </button>
            <button
              type="button"
              className="dash__req-iconbtn"
              onClick={() => shareViaWhatsApp(r)}
              title="مشاركة الطلب"
              aria-label="مشاركة الطلب"
            >
              <Share2 />
            </button>
            <button
              type="button"
              className="dash__req-iconbtn"
              onClick={() => copyShareLink(r)}
              title="نسخ الرابط"
              aria-label="نسخ رابط الطلب"
            >
              <Copy />
            </button>
            <button
              type="button"
              className="dash__req-open"
              onClick={() => openDetail(r.id)}
            >
              {r.status === 'accepted' || r.status === 'closed' || expired ? 'عرض الطلب' : 'عرض العروض'}
              <ChevronLeft />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCreate = () => {
    const setSeg = (key, val) => setForm((f) => ({ ...f, [key]: val }));

    return (
      <>
        <button type="button" className="dash__req-back" onClick={() => setCurrentView('list')}>
          <ChevronRight /> كل الطلبات
        </button>
        <div className="dash__req-form">
        <div className="dash__req-form-head">
          <div className="dash__req-form-ico"><Megaphone /></div>
          <div>
            <h3>أنشئ طلباً خاصاً</h3>
            <p>صف احتياجك مرة واحدة ودع المالكين يتنافسون لخدمتك بأفضل عرض.</p>
          </div>
          <button type="button" className="btn-ghost dash__req-clear" onClick={clearForm} title="مسح كل الحقول">
            <Eraser /> مسح الحقول
          </button>
        </div>

        <div className="dash__req-field">
          <label>عنوان الطلب <b>*</b></label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="مثال: قاعة محاضرات لدورة تدريبية"
            className={errors.title ? 'has-error' : ''}
          />
          <p className="dash__req-error">{errors.title || ''}</p>
        </div>

        <div className="dash__req-grid2">
          <div className="dash__req-field">
            <label>نوع المساحة</label>
            <div className="dash__req-seg">
              {Object.entries(SPACE_TYPES).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={form.space_type === key ? 'is-on' : ''}
                  onClick={() => setSeg('space_type', key)}
                >
                  {key === 'whole' ? <Building2 /> : <DoorOpen />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="dash__req-field">
            <label>عدد الأشخاص المتوقع</label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
              placeholder="مثال: 30"
              className={errors.capacity ? 'has-error' : ''}
            />
            <p className="dash__req-error">{errors.capacity || ''}</p>
          </div>
        </div>

        <div className="dash__req-field">
          <label>الجدول المطلوب</label>
          <div className="dash__req-seg is-schedule">
            {Object.entries(SCHEDULE_LABELS).map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={form.schedule.preset === key ? 'is-on' : ''}
                onClick={() => setForm((f) => ({ ...f, schedule: { ...f.schedule, preset: key } }))}
              >
                {label}
              </button>
            ))}
          </div>
          {form.schedule.preset !== 'once' && (
            <div className={`dash__req-field is-inline${errors.schedule ? ' has-error' : ''}`}>
              <label>عدد مرات التكرار</label>
              <input
                type="number"
                min="1"
                max="36"
                inputMode="numeric"
                value={form.schedule.count}
                onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, count: Number(e.target.value) || 1 } }))}
              />
              <p className="dash__req-error">{errors.schedule || ''}</p>
            </div>
          )}
        </div>

        <div className="dash__req-grid2">
          <div className="dash__req-field">
            <label>الوقت التقريبي المفضّل</label>
            <input
              type="text"
              value={form.preferred_time}
              onChange={(e) => setForm((f) => ({ ...f, preferred_time: e.target.value }))}
              placeholder="مثال: 10 ص – 1 م"
              className={errors.preferred_time ? 'has-error' : ''}
            />
            <p className="dash__req-error">{errors.preferred_time || ''}</p>
          </div>

          <div className="dash__req-field">
            <label>المنطقة / الموقع (اختياري)</label>
            <input
              type="text"
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              placeholder="مثال: وسط المدينة"
            />
            <p className="dash__req-error" />
          </div>
        </div>

        <div className="dash__req-field">
          <label>المرافق المطلوبة</label>
          <div className="filterbar filterbar--chips">
            {Object.entries(AMENITY_LABELS).map(([key, label]) => {
              const Icon = AMENITY_ICONS[key];
              const on = form.amenities.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  className={on ? 'is-on' : ''}
                  onClick={() => toggleAmenity(key)}
                  aria-pressed={on}
                >
                  {Icon ? <Icon /> : null}
                  {label}
                  {on && <Check />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="dash__req-grid2">
          <div className="dash__req-field">
            <label>الميزانية التقريبية (ش.ج/سورة واحدة)</label>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              placeholder="مثال: 150"
            />
            <p className="dash__req-error" />
          </div>

          <div className="dash__req-field">
            <label>ملاحظات إضافية</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="مثال: نحتاج بروجيكتور وإنترنت قوي"
            />
            <p className="dash__req-error" />
          </div>
        </div>

        <div className="dash__req-form-actions">
          <button type="button" className="btn-ghost" onClick={() => setCurrentView('list')}>
            <ChevronRight /> إلغاء
          </button>
          <button type="button" className="btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="spin" /> : <Send />}
            {creating ? 'جارٍ النشر…' : 'نشر الطلب'}
          </button>
        </div>
        </div>
      </>
    );
  };

  const renderDetail = () => {
    const d = detail;

    if (detailLoading || !d) {
      return (
        <div className="dash__state">
          <div className="st-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ تحميل العروض…</h3>
          <p>نعود إليك بأحدث عروض المالكين.</p>
        </div>
      );
    }

    const expired = isRequestExpired(d);
    const isOpen = isRequestOpen(d) && !expired;
    const offers = sortedOffers(d.offers || []);
    const acceptedOffer = offers.find((o) => o.status === 'accepted');
    const prices = offers.filter((o) => Number(o.price_per_hour) > 0).map((o) => Number(o.price_per_hour));
    const bestPrice = prices.length > 1 ? Math.min(...prices) : null;
    const statusLabel =
      d.status === 'accepted' ? 'تم القبول'
        : d.status === 'closed' ? 'تم الإغلاق'
          : expired ? 'انتهى وقت الطلب'
            : 'مفتوحة للعروض';

    return (
      <>
        <button type="button" className="dash__req-back" onClick={backToList}>
          <ChevronRight /> كل الطلبات
        </button>

        <div className="dash__req-detail">
          <div className="dash__req-detail-head">
            <div className={`badge ${d.status === 'accepted' ? 'badge--confirmed' : d.status === 'closed' || expired ? 'badge--muted' : 'badge--pending'}`}>
              {d.status === 'accepted' ? <BadgeCheck /> : d.status === 'closed' || expired ? <Ban /> : <Clock />}
              {statusLabel}
            </div>
            <span>نُشر {timeAgo(d.created_at)}</span>
          </div>

          <h3 className="dash__req-detail-title">{d.title}</h3>
          {d.notes && <p className="dash__req-detail-desc">{d.notes}</p>}

          <div className="dash__req-detail-info">
            <div><span><CalendarClock /></span><b>الجدول</b><em>{d.schedule_label || 'مرة واحدة'}</em></div>
            <div><span><Clock /></span><b>الوقت</b><em>{d.preferred_time || 'مرن'}</em></div>
            <div><span><Users /></span><b>الأشخاص</b><em>{fmtNumber(d.capacity)} شخص</em></div>
            <div><span><DoorOpen /></span><b>النوع</b><em>{d.spaceTypeLabel}</em></div>
            {d.area && <div><span><MapPin /></span><b>المنطقة</b><em>{d.area}</em></div>}
            {d.budget > 0 && (
              <div><span><Wallet /></span><b>الميزانية</b><em>حتى {fmtNumber(d.budget)} ش.ج</em></div>
            )}
            {d.amenities.length > 0 && (
              <div className="is-wide">
                <span><Sparkles /></span>
                <b>المرافق</b>
                <em className="dash__req-chips">{d.amenities.map((a) => {
                  const Icon = AMENITY_ICONS[a];
                  return <span key={a}>{Icon ? <Icon /> : null} {AMENITY_LABELS[a] || a}</span>;
                })}</em>
              </div>
            )}
          </div>

          {isOpen && (
            <div className="dash__req-detail-actions">
              <button
                type="button"
                className="dash__req-iconbtn"
                onClick={() => duplicateRequest(d)}
                title="نشر طلب مشابه"
              >
                <Repeat /> نشر طلب مشابه
              </button>
              <button
                type="button"
                className="dash__req-iconbtn"
                onClick={() => shareViaWhatsApp(d)}
                title="مشاركة الطلب"
              >
                <Share2 /> مشاركة
              </button>
              <button
                type="button"
                className="dash__req-iconbtn"
                onClick={() => copyShareLink(d)}
                title="نسخ الرابط"
              >
                <Copy /> نسخ الرابط
              </button>
              <button
                type="button"
                className="dash__req-close"
                onClick={() => setConfirmClose(true)}
                disabled={closingId === d.id}
              >
                {closingId === d.id ? <Loader2 className="spin" /> : <Lock />}
                إغلاق الطلب
              </button>
            </div>
          )}
        </div>

        <section className="dash__section">
          <div className="dash__section-head">
            <h2><BadgeCheck /> العروض المقدمة</h2>
            <div className="dash__req-count-wrap">
              {offers.length > 1 && (
                <label className="dash__offer-sort">
                  <span>ترتيب:</span>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value)}
                    aria-label="ترتيب العروض"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <span className="dash__req-count">{offerCountLabel(offers.length)}</span>
            </div>
          </div>

          {offers.length === 0 ? (
            <div className="dash__state">
              <div className="st-svg"><Clock /></div>
              <h3>لا توجد عروض بعد</h3>
              <p>
                طلبك منشور لجميع المالكين. سنرسل لك تنبيهاً فور وصول أول عرض.
                {demo && ' (الوضع التجريبي لا يضيف عروضاً جديدة بنفسه.)'}
              </p>
            </div>
          ) : (
            <div className="dash__offers">
              {offers.map((o, i) => {
                const isAccepted = o.status === 'accepted';
                const isRejected = o.status === 'rejected';
                const isBest = !isAccepted && bestPrice !== null && Number(o.price_per_hour) === bestPrice;
                const inBudget = isOpen && d.budget > 0 && Number(o.price_per_hour) <= Number(d.budget);
                const overBudget = isOpen && d.budget > 0 && !inBudget;
                return (
                  <div className={`dash__offer${isAccepted ? ' is-accepted' : ''}${isRejected ? ' is-rejected' : ''}${isBest ? ' is-best' : ''}`} key={o.id}>
                    <div className="dash__offer-main">
                      <div className="dash__offer-avatar">
                        {o.owner_avatar ? (
                          <img src={o.owner_avatar} alt={o.owner_name} loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <Building2 />
                        )}
                      </div>
                      <div className="dash__offer-body">
                        <div className="dash__offer-line">
                          <h4>{o.space_name}</h4>
                          {inBudget && <span className="dash__offer-budget-ok"><Check /> ضمن ميزانيتك</span>}
                          {overBudget && <span className="dash__offer-budget-over"><AlertTriangle /> يتجاوز ميزانيتك</span>}
                          {isBest && <span className="dash__offer-best"><Sparkles /> الأفضل سعراً</span>}
                          {isAccepted && <span className="badge badge--confirmed"><Check /> العرض المقبول</span>}
                        </div>
                        <p className="dash__offer-owner">
                          <BadgeCheck /> {o.owner_name}
                          {o.rating > 0 && <em>★ {o.rating}</em>}
                        </p>
                        <div className="dash__offer-tags">
                          {o.location && <span><MapPin /> {o.location}</span>}
                          {o.duration_hours > 0 && <span><Clock /> {o.duration_hours} ساعات</span>}
                        </div>
                        {o.notes && <p className="dash__offer-notes">{o.notes}</p>}
                      </div>
                    </div>
                    <div className="dash__offer-side">
                      {!isAccepted && <span className="dash__offer-rank">الخيار {i + 1}</span>}
                      <div className="dash__offer-price">
                        {fmtNumber(o.price_per_hour)}
                        <small>ش.ج / ساعة</small>
                      </div>
                      {isOpen && !isAccepted && (
                        <div className="dash__offer-btns">
                          <button
                            type="button"
                            className="btn-ghost dash__offer-accept"
                            onClick={() => setConfirmOffer({ requestId: d.id, offer: o })}
                            disabled={acceptingId === o.id || rejectingId === o.id}
                          >
                            {acceptingId === o.id ? <Loader2 className="spin" /> : <Check />}
                            قبول هذا العرض
                          </button>
                          <button
                            type="button"
                            className="dash__offer-reject"
                            onClick={() => setConfirmReject({ offer: o })}
                            disabled={acceptingId === o.id || rejectingId === o.id}
                          >
                            {rejectingId === o.id ? <Loader2 className="spin" /> : <X />}
                            رفض هذا العرض
                          </button>
                        </div>
                      )}
                      {isRejected && <span className="dash__offer-rejected"><X /> تم رفض هذا العرض</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {acceptedOffer && (
            <div className="dash__req-hint">
              <Check />
              <p>
                تم قبول عرض <b>{acceptedOffer.space_name}</b>. حوّلنا الحجز إلى
                تبويب <b>حجوزاتي</b> وانتظر تأكيد المالك.
              </p>
            </div>
          )}
        </section>
      </>
    );
  };

  return (
    <section className="dash__req">
      {renderBanner()}

      <div className="dash__req-head">
        <div className="dash__req-head-copy">
          <h2><Megaphone /> الطلبات الخاصة</h2>
          <p>نشر طلباً واحدة، ودع مالكي المساحات يتنافسون لتقديم أفضل عرض لك.</p>
        </div>
        <div className="dash__req-head-actions">
          {effectiveView === 'list' && (
            <button
              type="button"
              className="dash__req-refresh"
              onClick={() => loadList(true)}
              disabled={refreshing}
              aria-label="تحديث"
              title="تحديث"
            >
              <Repeat className={refreshing ? 'spin' : ''} />
            </button>
          )}
          {effectiveView !== 'create' && (
            <button type="button" className="dash__req-add" onClick={() => setCurrentView('create')}>
              <Plus /> طلب جديد
            </button>
          )}
        </div>
      </div>

      {effectiveView === 'list' && renderList()}
      {effectiveView === 'create' && renderCreate()}
      {effectiveView === 'detail' && renderDetail()}

      {toast && (
        <div className={`dash__req-toast is-${toast.type}`} role="status">
          {toast.type === 'ok' ? <Check /> : <X />}
          <span>{toast.msg}</span>
        </div>
      )}

      {confirmOffer && (
        <div className="modal-overlay dash__req-overlay" onClick={() => setConfirmOffer(null)}>
          <div className="modal-box dash__req-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="تأكيد قبول العرض">
            <span className="dash__req-confirm-ico"><BadgeCheck /></span>
            <h3>قبول العرض؟</h3>
            <p>
              سيُحوَّل هذا العرض إلى حجز جديد في <b>حجوزاتي</b> بانتظار تأكيد
              صاحب المساحة، ويُغلق الطلب عن بقية العروض.
            </p>
            <div className="dash__req-confirm-offer">
              <div>
                <span>{confirmOffer.offer.space_name}</span>
                <small>{confirmOffer.offer.owner_name}</small>
              </div>
              <b>{fmtNumber(confirmOffer.offer.price_per_hour)} <small>ش.ج/ساعة</small></b>
            </div>
            <div className="dash__req-confirm-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmOffer(null)} disabled={acceptingId}>
                إلغاء
              </button>
              <button type="button" className="btn-primary" onClick={handleAccept} disabled={acceptingId}>
                {acceptingId ? <Loader2 className="spin" /> : <Check />}
                {acceptingId ? 'جارٍ القبول…' : 'نعم، أقبل العرض'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmReject && (
        <div className="modal-overlay dash__req-overlay" onClick={() => setConfirmReject(null)}>
          <div className="modal-box dash__req-confirm is-danger" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="تأكيد رفض العرض">
            <span className="dash__req-confirm-ico is-danger"><X /></span>
            <h3>رفض العرض؟</h3>
            <p>
              سيُرفض عرض <b>{confirmReject.offer.space_name}</b> نهائياً ولن يتمكّن
              مالكه من متابعته على هذا الطلب.
            </p>
            <div className="dash__req-confirm-offer">
              <div>
                <span>{confirmReject.offer.space_name}</span>
                <small>{confirmReject.offer.owner_name}</small>
              </div>
              <b>{fmtNumber(confirmReject.offer.price_per_hour)} <small>ش.ج/ساعة</small></b>
            </div>
            <div className="dash__req-confirm-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmReject(null)} disabled={rejectingId}>
                إلغاء
              </button>
              <button type="button" className="dash__offer-reject is-confirm" onClick={handleReject} disabled={rejectingId}>
                {rejectingId ? <Loader2 className="spin" /> : <X />}
                {rejectingId ? 'جارٍ الرفض…' : 'نعم، أرفض العرض'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClose && (
        <div className="modal-overlay dash__req-overlay" onClick={() => setConfirmClose(false)}>
          <div className="modal-box dash__req-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="تأكيد إغلاق الطلب">
            <span className="dash__req-confirm-ico is-danger"><Lock /></span>
            <h3>إغلاق الطلب؟</h3>
            <p>
              سيُغلق الطلب عن المالكين ولن يستطيعوا تقديم عروض جديدة. يمكنك إرجاع
              عرض مقبول منه لاحقاً، لكن هذا الإجراء يوقف استقبال العروض.
            </p>
            <div className="dash__req-confirm-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmClose(false)} disabled={closingId}>
                إلغاء
              </button>
              <button type="button" className="dash__offer-reject is-confirm" onClick={handleClose} disabled={closingId}>
                {closingId ? <Loader2 className="spin" /> : <Lock />}
                {closingId ? 'جارٍ الإغلاق…' : 'نعم، أغلق الطلب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}