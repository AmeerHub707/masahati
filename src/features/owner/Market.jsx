import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Store, Megaphone, Building2, X, Loader2, Clock, CalendarClock, Users, MapPin,
  CircleDollarSign, Wifi, Zap, Video, Snowflake, Mic, Send, Check, Sparkles, Repeat, ChevronDown, Plus,
} from 'lucide-react';
import { loadMarketWithFallback, submitProposalWithFallback, isOwnerDemo } from '@/lib/owner';
import { isRequestOpen, isRequestExpired, AMENITY_LABELS } from '@/lib/requests';
import { useDialogA11y } from '@/lib/dialogA11y';
import { AnimatePresence, motion } from 'framer-motion';

const AMENITY_ICONS = {
  internet: Wifi,
  electricity: Zap,
  projector: Video,
  ac: Snowflake,
  microphone: Mic,
};

const numFmt = new Intl.NumberFormat('ar-EG');

function fmtNumber(n) {
  return numFmt.format(n || 0);
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

export default function Market({ data, onProposalSubmitted, onNavigate }) {
  const [market, setMarket] = useState(() => (data?.market || []));
  const [demo, setDemo] = useState(() => isOwnerDemo());
  const [loading, setLoading] = useState(() => !Array.isArray(data?.market));
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [modal, setModal] = useState(null); // الطلب الذي نقدّم عرضاً عليه
  const [form, setForm] = useState({ space_id: '', price_per_hour: '', duration_hours: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(() =>
    new Set(
      (data?.offers || [])
        .filter((o) => o.status === 'pending')
        .map((o) => String(o.requestId))
    )
  );
  const [toast, setToast] = useState(null);
  const mountedRef = useRef(true);

  // إغلاق يُستدعى لاحقاً (عند Escape)؛ لذا نمرّر دالة كسول لتجنّب الـ TDZ
  // لأن closeForm معرّفة أدناه في نفس نطاق المكوّن.
  const proposalDialogRef = useDialogA11y({ open: !!modal, trap: false, onClose: () => closeForm() });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const spaces = (data?.spaces || []).filter((s) => s.is_active !== false);
  const selectedSpace = spaces.find((s) => String(s.id) === String(form.space_id));
  const capacityWarn = (() => {
    if (!form.space_id || !selectedSpace) return '';
    const cap = Number(selectedSpace.capacity);
    const need = Number(modal?.capacity || 0);
    if (cap > 0 && need > 0 && cap < need) {
      return `تتّسع «${selectedSpace.title}» لـ ${fmtNumber(cap)} شخص فقط، والطلب يحتاج ${fmtNumber(need)}.`;
    }
    return '';
  })();

  const suggestedFor = (space, budget) => {
    const rate = Number(space?.price_per_hour || 0);
    if (budget > 0 && rate > 0) return String(Math.round(Math.min(rate, budget)));
    if (budget > 0) return String(Math.round(budget * 0.9));
    if (rate > 0) return String(Math.round(rate));
    return '';
  };

  const loadMarket = useCallback(async (force = false, silent = false) => {
    if (force) setRefreshing(true);
    else if (!silent) setLoading(true);
    try {
      const result = await loadMarketWithFallback(force);
      if (!mountedRef.current) return;
      setMarket(result.requests);
      setDemo(result.demo);
    } catch {
      /* لا نكسر العرض */
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // السوق يستقبل طلبات حديثة من اللوحة الأم؛ نترك التحميل لأول فتحة للبيانات فقط.
  useEffect(() => {
    if (Array.isArray(data?.market)) return undefined;
    const t = setTimeout(() => loadMarket(), 0);
    return () => clearTimeout(t);
  }, [loadMarket, data?.market]);

  useEffect(() => {
    // إنعاش خفيف في الخلفية: لا يرمش الواجهة ولا يفتح نافذة التحميل،
    // ويتوقف أثناء الكتابة في نموذج العرض أو عند تصغير التبويب.
    const id = setInterval(() => {
      if (document.hidden || modal || submitting) return;
      loadMarket(false, true);
    }, 60000);
    return () => clearInterval(id);
  }, [loadMarket, modal, submitting]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!spaceMenuOpen) return undefined;
    const onDocClick = (e) => {
      if (!e.target.closest('.odash__space-pick')) setSpaceMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setSpaceMenuOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [spaceMenuOpen]);

  const openModal = (req) => {
    const single = spaces.length === 1 ? spaces[0] : null;
    setForm({
      space_id: single ? String(single.id) : '',
      price_per_hour: single
        ? suggestedFor(single, Number(req.budget || 0))
        : req.budget > 0
          ? String(Math.round(Number(req.budget) * 0.9))
          : '',
      duration_hours: '',
      notes: '',
    });
    setErrors({});
    setSpaceMenuOpen(false);
    setModal(req);
  };

  const closeForm = () => {
    if (submitting) return;
    setSpaceMenuOpen(false);
    setModal(null);
    setErrors({});
  };

  const submitProposal = async () => {
    if (!modal) return;
    const e = {};
    if (!form.space_id) e.space_id = 'اختر مساحة من قائمتك.';
    if (!form.price_per_hour || Number(form.price_per_hour) <= 0) e.price_per_hour = 'حدّد سعر الساعة.';
    if (!form.duration_hours || Number(form.duration_hours) <= 0) e.duration_hours = 'حدّد عدد الساعات.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitting(true);
    try {
      const result = await submitProposalWithFallback(modal.id, {
        space_id: form.space_id,
        price_per_hour: Number(form.price_per_hour),
        duration_hours: Number(form.duration_hours),
        notes: form.notes.trim(),
        currency: 'ش.ج',
        request_title: modal.title,
      });
      if (!mountedRef.current) return;
      setDemo(result.demo);
      setSubmitted((prev) => new Set(prev).add(String(modal.id)));
      if (result.offer && onProposalSubmitted) onProposalSubmitted(result.offer);
      setToast({ msg: result.message, type: result.duplicate ? 'warn' : 'ok' });
      setModal(null);
    } catch {
      if (mountedRef.current) setToast({ msg: 'تعذّر إرسال العرض. حاول مجدداً.', type: 'err' });
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const renderCard = (r, expanded = false) => {
    const isSubmitted = submitted.has(String(r.id));
    const expired = isRequestExpired(r);
    return (
      <div
        className={[
          'odash__market-card',
          isSubmitted ? ' is-submitted' : '',
          expired ? ' is-expired' : '',
          expanded ? ' is-selected' : '',
        ].filter(Boolean).join(' ')}
        key={r.id}
      >
        <div className="odash__market-card-main">
          <div className="odash__market-ico"><Megaphone /></div>
          <div className="odash__market-body">
            <div className="odash__market-topline">
              <span className="odash__market-badge"><Clock /> مفتوحة</span>
              <span className="odash__market-time">{timeAgo(r.created_at)}</span>
            </div>
            <h3>{r.title}</h3>
            {r.notes && <p className="odash__market-desc">{r.notes}</p>}
            <div className="odash__market-meta">
              <span><CalendarClock /> {r.schedule_label || 'مرة واحدة'}</span>
              <span><Clock /> {r.preferred_time || 'وقت مرن'}</span>
              <span className="odash__market-cap"><Users /> {fmtNumber(r.capacity)} شخص</span>
              {r.area && <span><MapPin /> {r.area}</span>}
            </div>
            {Array.isArray(r.amenities) && r.amenities.length > 0 && (
              <div className="odash__market-chips">
                {r.amenities.slice(0, 4).map((a) => {
                  const Icon = AMENITY_ICONS[a];
                  return (
                    <span key={a}>
                      {Icon ? <Icon /> : null} {AMENITY_LABELS[a] || a}
                    </span>
                  );
                })}
                {r.amenities.length > 4 && (
                  <span className="odash__market-chip-more">+{r.amenities.length - 4}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="odash__market-foot">
          <div className="odash__market-budget">
            {r.budget > 0 ? (
              <>
                <CircleDollarSign /> حتى {fmtNumber(r.budget)} ش.ج
              </>
            ) : (
              <span>الميزانية: غير محددة</span>
            )}
          </div>
          <div className="odash__market-actions">
            {expanded ? (
              <button type="button" className="odash__market-close-form" onClick={closeForm} disabled={submitting} aria-label="إلغاء">
                <X />
              </button>
            ) : isSubmitted ? (
              <span className="odash__market-submitted"><Check /> تم إرسال عرضك</span>
            ) : (
              <button type="button" className="odash__market-bid" onClick={() => openModal(r)}>
                <Send /> قدّم عرضاً
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderBanner = () => {
    if (!demo || bannerDismissed) return null;
    return (
      <div className="odash__banner" role="status">
        <Sparkles />
        <p>
          <b>وضع تجريبي</b> — واجهة الخادم (API) غير مفعّلة بعد، البيانات أدناه للتجربة
          وستُحفظ محلياً. عند نزول واجهة الباك إند سيتولّى النظام تلقائياً.
        </p>
        <button type="button" onClick={() => setBannerDismissed(true)} aria-label="إغلاق" className="odash__banner-x">
          <X />
        </button>
      </div>
    );
  };

  const openReqs = market.filter((r) => isRequestOpen(r) && !isRequestExpired(r));

  return (
    <section className="odash__market">
      {renderBanner()}

      <div className="obk__hero">
        <div className="obk__hero-main">
          <h2><Store /> السوق المفتوح</h2>
          <p>طلبات خاصة نشرها الطلاب — اقرأ الاحتياج وقدّم أفضل عرض من مساحاتك.</p>
          <div className="obk__hero-meta">
            <span className={`obk__hero-chip${openReqs.length > 0 ? ' is-good' : ''}`}>
              <Store /> {fmtNumber(openReqs.length)} طلب مفتوح
            </span>
            <span className="obk__hero-chip"><Building2 /> {fmtNumber(spaces.length)} مساحة نشطة</span>
            <span className="obk__hero-chip"><Send /> {fmtNumber(submitted.size)} عرض قدّمتها</span>
          </div>
        </div>
        <div className="obk__hero-side">
          <button
            type="button"
            className="odash__market-refresh obk__hero-refresh"
            onClick={() => loadMarket(true)}
            disabled={refreshing}
            aria-label="تحديث السوق"
            title="تحديث السوق"
          >
            <Repeat className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="odash__state">
          <div className="ost-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ تحميل السوق…</h3>
          <p>نعرض أحدث الطلبات المفتوحة لك.</p>
        </div>
      ) : openReqs.length === 0 ? (
        <div className="odash__state">
          <div className="ost-svg"><Store /></div>
          <h3>لا توجد طلبات مفتوحة حالياً</h3>
          <p>نحدّث القائمة تلقائياً كل دقيقة — عد لاحقاً، أو استخدم زر التحديث أعلاه لعرض أحدث الطلبات.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {modal ? (
            <motion.div
              key="proposal"
              className="odash__market-single"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {renderCard(modal, true)}
              <motion.div
                className="odash__market-form"
                ref={proposalDialogRef}
                tabIndex={-1}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.06, ease: 'easeOut' }}
              >
            <div className="odash__market-form-head">
              <button type="button" className="odash__market-close-form" onClick={closeForm} disabled={submitting} aria-label="إغلاق">
                <X />
              </button>
              <span className="odash__modal-ico"><Send /></span>
              <h3>قدّم عرضك على الطلب</h3>
              <p className="odash__modal-sub">{modal.title}</p>
            </div>

            {spaces.length === 0 ? (
              <div className="odash__modal-empty">
                <p>لا توجد مساحات نشطة بعد — أضف مساحة من تبويب <b>مساحاتي</b> أولاً لتتمكن من تقديم العروض.</p>
                <button type="button" className="btn-primary" onClick={() => onNavigate?.('my-spaces')}>
                  <Plus /> أضف مساحة الآن
                </button>
              </div>
            ) : (
              <>
                <div className={`odash__field${errors.space_id ? ' has-error' : ''}`}>
                  <label>المساحة <b>*</b></label>
                  <div className="odash__space-pick">
                    <button
                      type="button"
                      className={`odash__space-pick-btn${spaceMenuOpen ? ' is-open' : ''}`}
                      data-autofocus
                      onClick={() => setSpaceMenuOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={spaceMenuOpen}
                    >
                      <span className={`odash__space-pick-value${form.space_id ? '' : ' is-placeholder'}`}>
                        {selectedSpace
                          ? `${selectedSpace.title} — ${fmtNumber(selectedSpace.price_per_hour)} ش.ج/ساعة`
                          : 'اختر مساحة…'}
                      </span>
                      <ChevronDown className="odash__space-pick-caret" />
                    </button>
                    {spaceMenuOpen && (
                      <ul className="odash__space-pick-list" role="listbox" aria-label="اختر المساحة">
                        {spaces.map((s) => {
                          const selected = form.space_id === String(s.id);
                          const unfit =
                            Number(s.capacity) > 0 && Number(modal?.capacity) > 0 && Number(s.capacity) < Number(modal.capacity);
                          return (
                            <li
                              key={s.id}
                              role="option"
                              aria-selected={selected}
                              className={`odash__space-pick-item${selected ? ' is-selected' : ''}${unfit ? ' is-unfit' : ''}`}
                              onClick={() => {
                                setForm((f) => ({ ...f, space_id: String(s.id), price_per_hour: suggestedFor(s, Number(modal?.budget || 0)) }));
                                setErrors((er) => ({ ...er, space_id: '' }));
                                setSpaceMenuOpen(false);
                              }}
                            >
                              <span className="odash__space-pick-item-name">{s.title}</span>
                              <span className="odash__space-pick-item-meta">
                                <span className="odash__space-pick-item-price">{fmtNumber(s.price_per_hour)} ش.ج/ساعة</span>
                                {Number(s.capacity) > 0 && (
                                  <>
                                    <span className="odash__space-pick-item-dot">·</span>
                                    <span className="odash__space-pick-item-cap">{fmtNumber(s.capacity)} شخص</span>
                                  </>
                                )}
                              </span>
                              {selected && <Check className="odash__space-pick-item-check" />}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <p className={!errors.space_id && capacityWarn ? 'is-warn' : ''}>{errors.space_id || capacityWarn}</p>
                </div>

                <div className="odash__modal-grid2">
                  <div className={`odash__field${errors.price_per_hour ? ' has-error' : ''}`}>
                    <label>
                      السعر (ش.ج/ساعة) <b>*</b>
                      {modal?.budget > 0 && <small>الميزانية: حتى {fmtNumber(modal.budget)} ش.ج</small>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={form.price_per_hour}
                      onChange={(e) => setForm((f) => ({ ...f, price_per_hour: e.target.value }))}
                      placeholder="مثال: 120"
                    />
                    <p>{errors.price_per_hour || ''}</p>
                  </div>
                  <div className={`odash__field${errors.duration_hours ? ' has-error' : ''}`}>
                    <label>عدد الساعات <b>*</b></label>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={form.duration_hours}
                      onChange={(e) => setForm((f) => ({ ...f, duration_hours: e.target.value }))}
                      placeholder="مثال: 3"
                    />
                    <p>{errors.duration_hours || ''}</p>
                  </div>
                </div>

                <div className="odash__field">
                  <label>ملاحظات للطالب (اختياري)</label>
                  <textarea
                    rows="2"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="مثال: تتضمن الشاشة والإنترنت والمشروبات"
                  />
                  <p />
                </div>

                <div className="odash__modal-actions">
                  <button type="button" className="btn-ghost" onClick={closeForm} disabled={submitting}>
                    إلغاء
                  </button>
                  <button type="button" className="btn-primary" onClick={submitProposal} disabled={submitting}>
                    {submitting ? <Loader2 className="spin" /> : <Send />}
                    {submitting ? 'جارٍ الإرسال…' : 'إرسال العرض'}
                  </button>
                </div>
              </>
            )}
            </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="feed"
              className="odash__market-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {openReqs.map((r) => renderCard(r))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {toast && (
        <div className={`odash__market-toast is-${toast.type}`} role="status">
          {toast.type === 'ok' ? <Check /> : toast.type === 'warn' ? <Clock /> : <X />}
          <span>{toast.msg}</span>
        </div>
      )}
    </section>
  );
}