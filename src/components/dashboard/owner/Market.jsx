import { useCallback, useEffect, useState } from 'react';
import {
  Store, Megaphone, X, Loader2, Clock, CalendarClock, Users, MapPin,
  CircleDollarSign, Wifi, Zap, Video, Snowflake, Mic, Send, Check, Sparkles, Repeat, ChevronDown,
} from 'lucide-react';
import { loadMarketWithFallback, submitProposalWithFallback, isOwnerDemo } from '../../../lib/owner';
import { isRequestOpen, isRequestExpired, AMENITY_LABELS } from '../../../lib/requests';

const AMENITY_ICONS = {
  internet: Wifi,
  electricity: Zap,
  projector: Video,
  ac: Snowflake,
  microphone: Mic,
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

export default function Market({ data, onProposalSubmitted }) {
  const [market, setMarket] = useState(() => (data?.market || []));
  const [demo, setDemo] = useState(() => isOwnerDemo());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [modal, setModal] = useState(null); // الطلب الذي نقدّم عرضاً عليه
  const [form, setForm] = useState({ space_id: '', price_per_hour: '', duration_hours: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState([]); // معرفات الطلبات التي قدّمنا عليها
  const [toast, setToast] = useState(null);

  const spaces = (data?.spaces || []).filter((s) => s.is_active !== false);
  const selectedSpace = spaces.find((s) => String(s.id) === String(form.space_id));

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

  const loadMarket = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadMarketWithFallback(force);
      setMarket(result.requests);
      setDemo(result.demo);
      // إذا كان الوضع التجريبي، نستعرض عروضنا من البيانات الواردة عبر لوحة المالك.
      if (result.demo && data?.offers) {
        setSubmitted(data.offers
          .filter((o) => o.status === 'pending')
          .map((o) => String(o.requestId)));
      }
    } catch {
      /* لا نكسر العرض */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    const t = setTimeout(() => loadMarket(), 0);
    return () => clearTimeout(t);
  }, [loadMarket]);

  const openModal = (req) => {
    const defaultSpace = spaces.length === 1 ? String(spaces[0].id) : '';
    setForm({
      space_id: defaultSpace,
      price_per_hour: req.budget > 0 ? String(Math.round(Number(req.budget) * 0.9)) : '',
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
      setDemo(result.demo);
      setSubmitted((prev) => [...prev, String(modal.id)]);
      if (result.offer && onProposalSubmitted) onProposalSubmitted(result.offer);
      setToast({ msg: result.message, type: result.duplicate ? 'warn' : 'ok' });
      setModal(null);
    } catch {
      setToast({ msg: 'تعذّر إرسال العرض. حاول مجدداً.', type: 'err' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderCard = (r, expanded = false) => {
    const isSubmitted = submitted.includes(String(r.id));
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
              <span><Users /> {fmtNumber(r.capacity)} شخص</span>
              {r.area && <span><MapPin /> {r.area}</span>}
            </div>
            {r.amenities.length > 0 && (
              <div className="odash__market-chips">
                {r.amenities.slice(0, 4).map((a) => {
                  const Icon = AMENITY_ICONS[a];
                  return (
                    <span key={a}>
                      {Icon ? <Icon /> : null} {AMENITY_LABELS[a] || a}
                    </span>
                  );
                })}
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
      <div className="odash__banner">
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

      <div className="odash__market-head">
        <div>
          <h2><Store /> السوق المفتوح</h2>
          <p>طلبات خاصة نشرها الطلاب — اقرأ الاحتياج وقدّم أفضل عرض من مساحاتك.</p>
        </div>
        <button
          type="button"
          className="odash__market-refresh"
          onClick={() => loadMarket(true)}
          disabled={refreshing}
          aria-label="تحديث السوق"
          title="تحديث السوق"
        >
          <Repeat className={refreshing ? 'spin' : ''} />
        </button>
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
          <p>صفحة السوق تنعش تلقائياً — عد لاحقاً أو تواصل معنا لتوفير المساحة.</p>
        </div>
      ) : modal ? (
        <div className="odash__market-single">
          {renderCard(modal, true)}
          <div className="odash__market-form">
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
                لا توجد مساحات نشطة بعد — أضف مساحة من تبويب <b>مساحاتي</b> أولاً.
              </div>
            ) : (
              <>
                <div className={`odash__field${errors.space_id ? ' has-error' : ''}`}>
                  <label>المساحة <b>*</b></label>
                  <div className="odash__space-pick">
                    <button
                      type="button"
                      className={`odash__space-pick-btn${spaceMenuOpen ? ' is-open' : ''}`}
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
                          return (
                            <li
                              key={s.id}
                              role="option"
                              aria-selected={selected}
                              className={`odash__space-pick-item${selected ? ' is-selected' : ''}`}
                              onClick={() => {
                                setForm((f) => ({ ...f, space_id: String(s.id) }));
                                setErrors((er) => ({ ...er, space_id: '' }));
                                setSpaceMenuOpen(false);
                              }}
                            >
                              <span className="odash__space-pick-item-name">{s.title}</span>
                              <span className="odash__space-pick-item-price">{fmtNumber(s.price_per_hour)} ش.ج/ساعة</span>
                              {selected && <Check className="odash__space-pick-item-check" />}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <p>{errors.space_id || ''}</p>
                </div>

                <div className="odash__modal-grid2">
                  <div className={`odash__field${errors.price_per_hour ? ' has-error' : ''}`}>
                    <label>السعر (ش.ج/ساعة) <b>*</b></label>
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
                  <input
                    type="text"
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
          </div>
        </div>
      ) : (
        <div className="odash__market-grid">
          {openReqs.map((r) => renderCard(r))}
        </div>
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