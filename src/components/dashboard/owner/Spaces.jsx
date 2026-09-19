import { useCallback, useEffect, useState } from 'react';
import {
  Building2, X, Loader2, MapPin, Users, Star, Wifi, Zap, Check,
  Sparkles, Repeat, Plus, BadgeCheck, Ban, CircleDollarSign, Send,
} from 'lucide-react';
import { loadSpacesWithFallback, createSpaceWithFallback, toggleSpaceActiveWithFallback, isOwnerDemo } from '../../../lib/owner';
import { AMENITY_LABELS } from '../../../lib/requests';

const AMENITY_KEYS = Object.keys(AMENITY_LABELS);

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

const DEFAULT_FORM = {
  title: '',
  description: '',
  location: '',
  price_per_hour: '',
  capacity: '',
  amenities: [],
  internet: false,
  power: false,
};

export default function Spaces({ data }) {
  const [spaces, setSpaces] = useState(() => (data?.spaces || []));
  const [demo, setDemo] = useState(() => isOwnerDemo());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const loadSpaces = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadSpacesWithFallback(force);
      setSpaces(result.spaces);
      setDemo(result.demo);
    } catch {
      /* لا نكسر العرض */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadSpaces(), 0);
    return () => clearTimeout(t);
  }, [loadSpaces]);

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
    if (!form.title.trim()) e.title = 'اكتب اسماً للمساحة.';
    if (!form.location.trim()) e.location = 'حدّد المنطقة/الموقع.';
    if (!form.price_per_hour || Number(form.price_per_hour) <= 0) e.price_per_hour = 'حدّد سعر الساعة.';
    if (!form.capacity || Number(form.capacity) <= 0) e.capacity = 'حدّد السعة.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) {
      setToast({ msg: 'يرجى استكمال الحقول المطلوبة.', type: 'err' });
      return;
    }
    setCreating(true);
    try {
      const result = await createSpaceWithFallback({
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        price_per_hour: Number(form.price_per_hour),
        capacity: Number(form.capacity),
        amenities: form.amenities,
        internet: form.internet,
        power: form.power,
      });
      setDemo(result.demo);
      setSpaces((prev) => [result.space, ...prev]);
      setForm(DEFAULT_FORM);
      setErrors({});
      setAddOpen(false);
      setToast({ msg: result.message, type: 'ok' });
    } catch {
      setToast({ msg: 'تعذّر إضافة المساحة. حاول مجدداً.', type: 'err' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (space) => {
    setTogglingId(space.id);
    const next = space.is_active === false;
    try {
      const result = await toggleSpaceActiveWithFallback(space.id, next, space);
      setDemo(result.demo);
      setSpaces((prev) =>
        prev.map((s) => (s.id === space.id ? { ...s, is_active: next } : s))
      );
      setToast({ msg: result.message, type: 'ok' });
    } catch {
      setToast({ msg: 'تعذّر تحديث حالة المساحة.', type: 'err' });
    } finally {
      setTogglingId(null);
    }
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

  const activeSpaces = spaces.filter((s) => s.is_active !== false);
  const inactiveSpaces = spaces.filter((s) => s.is_active === false);

  return (
    <section className="odash__spaces">
      {renderBanner()}

      <div className="odash__spaces-head">
        <div>
          <h2><Building2 /> مساحاتي</h2>
          <p>أدر مساحاتك المسجّلة، وافق على العروض، وحدّث تفاصيل كل مساحة بسهولة.</p>
        </div>
        <div className="odash__spaces-head-actions">
          <button
            type="button"
            className="odash__spaces-refresh"
            onClick={() => loadSpaces(true)}
            disabled={refreshing}
            aria-label="تحديث المساحات"
            title="تحديث المساحات"
          >
            <Repeat className={refreshing ? 'spin' : ''} />
          </button>
          <button type="button" className="odash__spaces-add" onClick={() => setAddOpen(true)}>
            <Plus /> أضف مساحة
          </button>
        </div>
      </div>

      {loading ? (
        <div className="odash__state">
          <div className="ost-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ تحميل مساحاتك…</h3>
          <p>نعرض أحدث حالة لمساحاتك.</p>
        </div>
      ) : spaces.length === 0 ? (
        <div className="odash__state">
          <div className="ost-svg"><Building2 /></div>
          <h3>لا مساحات بعد</h3>
          <p>أضف مساحتك الأولى لتظهر في التصفح ويصلتها الحجوزات والعروض.</p>
          <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
            <Plus /> أضف مساحتك الأولى
          </button>
        </div>
      ) : (
        <>
          {activeSpaces.length > 0 && (
            <section className="odash__section">
              <div className="odash__section-head">
                <h2><BadgeCheck /> مساحات نشطة</h2>
              </div>
              <div className="odash__spaces-grid">
                {activeSpaces.map((s) => renderCard(s, handleToggle, togglingId))}
              </div>
            </section>
          )}

          {inactiveSpaces.length > 0 && (
            <section className="odash__section">
              <div className="odash__section-head">
                <h2><Ban /> مساحات موقوفة</h2>
              </div>
              <div className="odash__spaces-grid">
                {inactiveSpaces.map((s) => renderCard(s, handleToggle, togglingId))}
              </div>
            </section>
          )}
        </>
      )}

      {addOpen && (
        <div className="modal-overlay odash__modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal-box odash__modal odash__modal--form" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="إضافة مساحة">
            <button type="button" className="odash__modal-close" onClick={() => setAddOpen(false)} aria-label="إغلاق">
              <X />
            </button>
            <span className="odash__modal-ico"><Building2 /></span>
            <h3>أضف مساحة جديدة</h3>
            <p className="odash__modal-sub">ستظهر في تصفح المساحات فور تنشيطها.</p>

            <div className={`odash__field${errors.title ? ' has-error' : ''}`}>
              <label>اسم المساحة <b>*</b></label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثال: قاعة العروض الكبرى"
              />
              <p>{errors.title || ''}</p>
            </div>

            <div className="odash__field">
              <label>الوصف</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="قاعة واسعة تتسع لـ 120 شخصاً…"
              />
              <p />
            </div>

            <div className={`odash__field${errors.location ? ' has-error' : ''}`}>
              <label>الموقع / المنطقة <b>*</b></label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="مثال: وسط المدينة"
              />
              <p>{errors.location || ''}</p>
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
              <div className={`odash__field${errors.capacity ? ' has-error' : ''}`}>
                <label>السعة (شخصاً) <b>*</b></label>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  placeholder="مثال: 30"
                />
                <p>{errors.capacity || ''}</p>
              </div>
            </div>

            <div className="odash__field">
              <label>المرافق المتوفرة</label>
              <div className="odash__form-chips">
                {AMENITY_KEYS.map((key) => {
                  const on = form.amenities.includes(key);
                  return (
                    <button
                      type="button"
                      key={key}
                      className={on ? 'is-on' : ''}
                      onClick={() => toggleAmenity(key)}
                      aria-pressed={on}
                    >
                      {AMENITY_LABELS[key]}
                      {on && <Check />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="odash__form-switches">
              <label className={form.internet ? 'is-on' : ''}>
                <Wifi /> إنترنت
                <input
                  type="checkbox"
                  checked={form.internet}
                  onChange={(e) => setForm((f) => ({ ...f, internet: e.target.checked }))}
                />
                <span />
              </label>
              <label className={form.power ? 'is-on' : ''}>
                <Zap /> كهرباء
                <input
                  type="checkbox"
                  checked={form.power}
                  onChange={(e) => setForm((f) => ({ ...f, power: e.target.checked }))}
                />
                <span />
              </label>
            </div>

            <div className="odash__modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setAddOpen(false)} disabled={creating}>
                إلغاء
              </button>
              <button type="button" className="btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="spin" /> : <Send />}
                {creating ? 'جارٍ الإضافة…' : 'إضافة المساحة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`odash__spaces-toast is-${toast.type}`} role="status">
          {toast.type === 'ok' ? <Check /> : <X />}
          <span>{toast.msg}</span>
        </div>
      )}
    </section>
  );
}

function renderCard(space, onToggle, togglingId) {
  const isActive = space.is_active !== false;
  const Icon = isActive ? CircleDollarSign : Ban;
  return (
    <div className={`odash__space-card${isActive ? '' : ' is-inactive'}`} key={space.id}>
      <img src={space.image || ''} alt={space.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      <div className="odash__space-card-body">
        <h3>{space.title}</h3>
        {space.description && <p>{space.description}</p>}
        <div className="odash__space-card-meta">
          {space.location && <span><MapPin /> {space.location}</span>}
          {space.capacity > 0 && <span><Users /> {fmtNumber(space.capacity)} شخص</span>}
          {space.internet && <span><Wifi /> إنترنت</span>}
          {space.power && <span><Zap /> كهرباء</span>}
          {space.rating > 0 && <span className="odash__space-card-rating"><Star /> {space.rating}</span>}
        </div>
      </div>
      <div className="odash__space-card-side">
        <b>{fmtNumber(space.price_per_hour)}</b>
        <small>ش.ج / ساعة</small>
        <button
          type="button"
          className={isActive ? 'odash__space-card-toggle is-on' : 'odash__space-card-toggle'}
          onClick={() => onToggle(space)}
          disabled={togglingId === space.id}
        >
          {togglingId === space.id ? <Loader2 className="spin" /> : <Icon />}
          {isActive ? 'إيقاف' : 'تفعيل'}
        </button>
      </div>
    </div>
  );
}