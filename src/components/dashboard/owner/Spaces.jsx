import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2, X, Loader2, MapPin, Users, Star, Wifi, Zap, Check,
  Sparkles, Repeat, Plus, BadgeCheck, Ban, CircleDollarSign, Send,
  CalendarCheck, TrendingUp, Pencil, Trash2, Search, Eye, Image, ImagePlus,
  ArrowRight,
} from 'lucide-react';
import {
  loadSpacesWithFallback,
  createSpaceWithFallback,
  toggleSpaceActiveWithFallback,
  updateSpaceWithFallback,
  deleteSpaceWithFallback,
  isOwnerDemo,
} from '../../../lib/owner';
import { AMENITY_LABELS } from '../../../lib/requests';

const AMENITY_KEYS = Object.keys(AMENITY_LABELS);

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'active', label: 'نشطة' },
  { id: 'inactive', label: 'موقوفة' },
];

function fmtNumber(n) {
  return new Intl.NumberFormat('ar-EG').format(n || 0);
}

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// يقرأ صورة من الجهاز، يصغّرها ويضغطها حتى لا تُتخم التخزين المحلي،
// ثم يعيدها كرابط بيانات (base64) جاهز للعرض والحفظ.
function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('read'));
    fr.onload = () => {
      const raw = String(fr.result);
      const img = new Image();
      img.onerror = () => resolve(raw);
      img.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve(raw);
        }
      };
      img.src = raw;
    };
    fr.readAsDataURL(file);
  });
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
  photos: [],
};

export default function Spaces({ data, autoOpen = false }) {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState(() => (data?.spaces || []));
  const [demo, setDemo] = useState(() => isOwnerDemo());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | { mode:'create' } | { mode:'edit', space }
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef(null);
  const [togglingId, setTogglingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
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

  // ----- تصفية وعدّ -----
  const counts = useMemo(() => {
    const active = spaces.filter((s) => s.is_active !== false).length;
    return { all: spaces.length, active, inactive: spaces.length - active };
  }, [spaces]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spaces.filter((s) => {
      if (filter === 'active' && s.is_active === false) return false;
      if (filter === 'inactive' && s.is_active !== false) return false;
      if (q) {
        const hay = `${s.title} ${s.description} ${s.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [spaces, filter, search]);

  // ----- النموذج -----
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

  const resetModal = () => {
    setModal(null);
    setForm(DEFAULT_FORM);
    setErrors({});
  };

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setErrors({});
    setModal({ mode: 'create' });
  };

  useEffect(() => {
    if (!autoOpen) return undefined;
    const t = setTimeout(() => openCreate(), 0);
    return () => clearTimeout(t);
  }, [autoOpen]);

  const openEdit = (space) => {
    setForm({
      title: space.title || '',
      description: space.description || '',
      location: space.location || '',
      price_per_hour: space.price_per_hour ? String(space.price_per_hour) : '',
      capacity: space.capacity ? String(space.capacity) : '',
      amenities: Array.isArray(space.amenities) ? space.amenities : [],
      internet: Boolean(space.internet),
      power: Boolean(space.power),
      photos: Array.isArray(space.gallery) && space.gallery.length
        ? space.gallery
        : (space.image ? [space.image] : []),
    });
    setErrors({});
    setModal({ mode: 'edit', space });
  };

  const readPayload = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    location: form.location.trim(),
    price_per_hour: Number(form.price_per_hour),
    capacity: Number(form.capacity),
    amenities: form.amenities,
    internet: form.internet,
    power: form.power,
    image: (form.photos || [])[0] || '',
    gallery: form.photos || [],
  });

  const handleFilesUpload = async (e) => {
    const incoming = Array.from(e.target.files || []);
    if (e.target) e.target.value = '';
    if (!incoming.length) return;
    const images = incoming.filter((f) => f.type && f.type.startsWith('image/'));
    if (!images.length) {
      setToast({ msg: 'اختر ملفات صور صالحة (JPG، PNG، WEBP).', type: 'err' });
      return;
    }
    if (images.some((f) => f.size > MAX_PHOTO_BYTES)) {
      setToast({ msg: 'بعض الصور أكبر من 5 ميجابايت — اختر صوراً أصغر.', type: 'err' });
      return;
    }
    const remaining = MAX_PHOTOS - (form.photos || []).length;
    if (remaining <= 0) {
      setToast({ msg: `يكفي! أقصى عدد صور هو ${MAX_PHOTOS}.`, type: 'err' });
      return;
    }
    setPhotoBusy(true);
    try {
      const out = [];
      for (const f of images.slice(0, remaining)) out.push(await readImageFile(f));
      setForm((prev) => ({ ...prev, photos: [...(prev.photos || []), ...out] }));
    } catch {
      setToast({ msg: 'تعذّرت معالجة بعض الصور، جرّب من جديد.', type: 'err' });
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = (idx) => {
    setForm((prev) => ({ ...prev, photos: (prev.photos || []).filter((_, i) => i !== idx) }));
  };

  // ----- إجراءات -----
  const handleSave = async () => {
    if (!validateForm()) {
      setToast({ msg: 'يرجى استكمال الحقول المطلوبة.', type: 'err' });
      return;
    }
    setSaving(true);
    try {
      let result;
      if (modal?.mode === 'edit') {
        result = await updateSpaceWithFallback(modal.space.id, readPayload());
        setDemo(result.demo);
        setSpaces((prev) => prev.map((s) => (s.id === modal.space.id ? result.space : s)));
      } else {
        result = await createSpaceWithFallback(readPayload());
        setDemo(result.demo);
        setSpaces((prev) => [result.space, ...prev]);
      }
      resetModal();
      setToast({ msg: result.message, type: 'ok' });
    } catch {
      setToast({ msg: 'تعذّر حفظ المساحة. حاول مجدداً.', type: 'err' });
    } finally {
      setSaving(false);
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteSpaceWithFallback(deleteTarget.id);
      setDemo(result.demo);
      setSpaces((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setToast({ msg: result.message, type: 'ok' });
    } catch {
      setToast({ msg: 'تعذّر حذف المساحة.', type: 'err' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ----- عرض -----
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

  const renderCard = (s) => {
    const isActive = s.is_active !== false;
    const st = s.stats;
    const extraAmenities = (s.amenities || []).filter(
      (a) => a !== 'internet' && a !== 'electricity'
    );
    return (
      <article className={`msp__card${isActive ? '' : ' is-inactive'}`} key={s.id}>
        <div className="msp__card-media">
          {s.image ? (
            <img src={s.image} alt={s.title} loading="lazy" />
          ) : (
            <div className="msp__card-media-fallback"><Building2 /></div>
          )}
          <span className={`msp__card-status is-${isActive ? 'on' : 'off'}`}>
            {isActive ? <BadgeCheck /> : <Ban />}
            {isActive ? 'نشطة' : 'موقوفة'}
          </span>
          {s.rating > 0 && (
            <span className="msp__card-rating"><Star /> {s.rating}</span>
          )}
        </div>

        <div className="msp__card-body">
          <h3>{s.title}</h3>
          {s.location && (
            <p className="msp__card-loc"><MapPin /> {s.location}</p>
          )}
          {s.description && <p className="msp__card-desc">{s.description}</p>}
          <div className="msp__card-meta">
            {s.capacity > 0 && <span><Users /> {fmtNumber(s.capacity)} شخص</span>}
            {s.internet && <span><Wifi /> إنترنت</span>}
            {s.power && <span><Zap /> كهرباء</span>}
            {(s.gallery?.length || 0) > 1 && (
              <span className="msp__card-meta-chip"><Image /> {s.gallery.length} صور</span>
            )}
            {extraAmenities.slice(0, 2).map((a) =>
              AMENITY_LABELS[a] ? (
                <span key={a} className="msp__card-meta-chip">{AMENITY_LABELS[a]}</span>
              ) : null
            )}
          </div>
          {st && (
            <div className="msp__card-stats">
              <span title="حجوزات هذا الشهر"><CalendarCheck /> {fmtNumber(st.bookings)}</span>
              <span title="إيراد هذا الشهر"><CircleDollarSign /> {fmtNumber(st.revenue)} ش.ج</span>
              <span title="معدّل الإشغال"><TrendingUp /> {fmtNumber(st.occupancy)}٪</span>
            </div>
          )}
        </div>

        <div className="msp__card-foot">
          <div className="msp__card-price">
            <b>{fmtNumber(s.price_per_hour)}</b>
            <small>ش.ج / ساعة</small>
          </div>
          <div className="msp__card-actions">
            <button
              type="button"
              className="msp__icon"
              title="عرض في تصفح المساحات"
              aria-label="عرض في تصفح المساحات"
              onClick={() => navigate('/spaces')}
            >
              <Eye />
            </button>
            <button
              type="button"
              className="msp__icon"
              title="تعديل المساحة"
              aria-label="تعديل المساحة"
              onClick={() => openEdit(s)}
            >
              <Pencil />
            </button>
            <button
              type="button"
              className={`msp__icon ${isActive ? 'is-stop' : 'is-start'}`}
              title={isActive ? 'إيقاف المساحة' : 'تفعيل المساحة'}
              aria-label={isActive ? 'إيقاف المساحة' : 'تفعيل المساحة'}
              onClick={() => handleToggle(s)}
              disabled={togglingId === s.id}
            >
              {togglingId === s.id ? <Loader2 className="spin" /> : (isActive ? <Ban /> : <Check />)}
            </button>
            <button
              type="button"
              className="msp__icon is-danger"
              title="حذف المساحة"
              aria-label="حذف المساحة"
              onClick={() => setDeleteTarget(s)}
            >
              <Trash2 />
            </button>
          </div>
        </div>
      </article>
    );
  };

  const renderForm = () => {
    const isEdit = modal?.mode === 'edit';
    return (
      <div className="msp__form-panel">
        <form
          className="msp__form"
          role="dialog"
          aria-label={isEdit ? 'تعديل المساحة' : 'إضافة مساحة'}
          onSubmit={(e) => { e.preventDefault(); if (!saving) handleSave(); }}
          noValidate
        >
          <button type="button" className="odash__modal-close" onClick={resetModal} aria-label="إغلاق" disabled={saving}>
            <X />
          </button>

          <div className="msp__form-head">
            <span className="odash__modal-ico">{isEdit ? <Pencil /> : <Building2 />}</span>
            <h3>{isEdit ? 'تعديل المساحة' : 'أضف مساحة جديدة'}</h3>
            <p className="odash__modal-sub">
              {isEdit
                ? 'حدّث تفاصيل المساحة وستُحفظ مباشرة.'
                : 'ستظهر في تصفح المساحات فور تنشيطها.'}
            </p>
          </div>

          <div className="msp__form-body">
            <section className="msp__form-sec">
              <h4><Building2 /> المعلومات الأساسية</h4>

              <div className={`odash__field${errors.title ? ' has-error' : ''}`}>
                <label htmlFor="msp-title">اسم المساحة <b>*</b></label>
                <div className="odash__input-wrap">
                  <Building2 className="odash__input-ico" />
                  <input
                    id="msp-title"
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="مثال: قاعة العروض الكبرى"
                  />
                </div>
                <p>{errors.title || ''}</p>
              </div>

              <div className={`odash__field${errors.location ? ' has-error' : ''}`}>
                <label htmlFor="msp-location">الموقع / المنطقة <b>*</b></label>
                <div className="odash__input-wrap">
                  <MapPin className="odash__input-ico" />
                  <input
                    id="msp-location"
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="مثال: وسط المدينة"
                  />
                </div>
                <p>{errors.location || ''}</p>
              </div>

              <div className="odash__field">
                <label htmlFor="msp-desc">الوصف <small>{form.description.length}/200</small></label>
                <textarea
                  id="msp-desc"
                  rows="4"
                  maxLength={200}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="قاعة واسعة تتسع لـ 120 شخصاً مع إضاءة طبيعية وتجهيزات عرض كاملة…"
                />
                <p />
              </div>
            </section>

            <section className="msp__form-sec">
              <h4><CircleDollarSign /> السعر والسعة</h4>
              <div className="odash__modal-grid2">
                <div className={`odash__field${errors.price_per_hour ? ' has-error' : ''}`}>
                  <label htmlFor="msp-price">السعر بالساعة <b>*</b></label>
                  <div className="odash__input-wrap has-suffix">
                    <CircleDollarSign className="odash__input-ico" />
                    <input
                      id="msp-price"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={form.price_per_hour}
                      onChange={(e) => setForm((f) => ({ ...f, price_per_hour: e.target.value }))}
                      placeholder="مثال: 120"
                    />
                    <span className="odash__input-suffix">ش.ج</span>
                  </div>
                  <p>{errors.price_per_hour || ''}</p>
                </div>
                <div className={`odash__field${errors.capacity ? ' has-error' : ''}`}>
                  <label htmlFor="msp-capacity">السعة <b>*</b></label>
                  <div className="odash__input-wrap has-suffix">
                    <Users className="odash__input-ico" />
                    <input
                      id="msp-capacity"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={form.capacity}
                      onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                      placeholder="مثال: 30"
                    />
                    <span className="odash__input-suffix">شخص</span>
                  </div>
                  <p>{errors.capacity || ''}</p>
                </div>
              </div>
            </section>

            <section className="msp__form-sec">
              <h4><Image /> الصور</h4>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={handleFilesUpload}
                aria-label="رفع صور المساحة"
              />
              <button
                type="button"
                className="msp__upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoBusy || (form.photos || []).length >= MAX_PHOTOS}
              >
                {photoBusy ? <Loader2 className="spin" /> : <ImagePlus />}
                <b>{photoBusy ? 'جارٍ معالجة الصور…' : 'رفع صور من جهازك'}</b>
                <small>يمكنك اختيار أكثر من صورة — الأولى تصبح الصورة الرئيسية للمساحة</small>
              </button>

              {(form.photos || []).length > 0 ? (
                <div className="msp__upload-grid">
                  {form.photos.map((src, i) => (
                    <div className={`msp__upload-thumb${i === 0 ? ' is-main' : ''}`} key={`${src.slice(0, 24)}-${i}`}>
                      <img src={src} alt={`صورة ${i + 1}`} />
                      {i === 0 && <span className="msp__upload-main">الرئيسية</span>}
                      <button
                        type="button"
                        className="msp__upload-remove"
                        onClick={() => removePhoto(i)}
                        disabled={photoBusy}
                        aria-label="حذف الصورة"
                      >
                        <X />
                      </button>
                    </div>
                  ))}
                  {(form.photos || []).length < MAX_PHOTOS && (
                    <button
                      type="button"
                      className="msp__upload-add"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photoBusy}
                      aria-label="إضافة صورة"
                    >
                      <Plus />
                    </button>
                  )}
                </div>
              ) : (
                <div className="msp__upload-hint"><Image /> لا توجد صور مرفوعة بعد.</div>
              )}
            </section>

            <section className="msp__form-sec">
              <h4><Sparkles /> المرافق</h4>
              <div className="odash__field">
                <label>المرافق المتوفرة <small>(اختياري)</small></label>
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
                <p />
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
            </section>
          </div>

          <div className="msp__form-foot">
            <button type="button" className="btn-ghost" onClick={resetModal} disabled={saving}>
              إلغاء
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="spin" /> : (isEdit ? <Send /> : <Plus />)}
              {saving ? 'جارٍ الحفظ…' : (isEdit ? 'حفظ التغييرات' : 'إضافة المساحة')}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const hasNoMatches = spaces.length > 0 && filtered.length === 0;
  const showingInactive = filter !== 'all' && counts[filter] === 0;

  return (
    <section className="odash__spaces msp">
      {renderBanner()}

      <div className="obk__hero">
        <div className="obk__hero-main">
          <h2>{modal ? (modal.mode === 'edit' ? <Pencil /> : <Plus />) : <Building2 />} {modal ? (modal.mode === 'edit' ? 'تعديل المساحة' : 'إضافة مساحة') : 'مساحاتي'}</h2>
          <p>{modal ? 'املأ بيانات المساحة واحفظها لعرضها في السوق.' : 'أدر مساحاتك، راقب تفاصيلها، وعدّل أو فعّل أي مساحة بسهولة.'}</p>
          {!modal && (
            <div className="obk__hero-meta">
              <span className="obk__hero-chip"><Building2 /> {fmtNumber(counts.all)} مساحة</span>
              <span className="obk__hero-chip is-good"><BadgeCheck /> {fmtNumber(counts.active)} نشطة</span>
              <span className="obk__hero-chip is-bad"><Ban /> {fmtNumber(counts.inactive)} موقوفة</span>
            </div>
          )}
        </div>
        <div className="obk__hero-side">
          {modal ? (
            <button type="button" className="odash__spaces-add is-back" onClick={resetModal} aria-label="الرجوع إلى قائمة المساحات">
              <ArrowRight /> رجوع
            </button>
          ) : (
            <>
              <div className="msp__search">
                <Search />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث باسم المساحة…"
                  aria-label="بحث في مساحاتي"
                />
                {search && (
                  <button
                    type="button"
                    className="msp__search-clear"
                    onClick={() => setSearch('')}
                    aria-label="مسح البحث"
                  >
                    <X />
                  </button>
                )}
              </div>
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
              <button type="button" className="odash__spaces-add" onClick={openCreate}>
                <Plus /> أضف مساحة
              </button>
            </>
          )}
        </div>
      </div>

      {!modal && (
        <div className="msp__filters" role="group" aria-label="تصفية المساحات حسب الحالة">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                className={on ? 'is-active' : ''}
                aria-pressed={on}
                onClick={() => setFilter(f.id)}
              >
                {on && (
                  <motion.span
                    layoutId="mspFilterPill"
                    className="msp__filters-pill"
                    transition={{ type: 'spring', stiffness: 480, damping: 38, mass: 0.9 }}
                  />
                )}
                <span className="msp__filters-label">{f.label}</span>
                <span className="msp__filters-count">{counts[f.id]}</span>
              </button>
            );
          })}
        </div>
      )}

      {modal ? renderForm() : loading ? (
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
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus /> أضف مساحتك الأولى
          </button>
        </div>
      ) : hasNoMatches ? (
        <div className="odash__state">
          <div className="ost-svg"><Search /></div>
          <h3>{showingInactive ? 'لا مساحات بهذه الحالة' : 'لا نتائج تطابق بحثك'}</h3>
          <p>جرّب تعديل الفلتر أو مسح البحث لعرض جميع مساحاتك.</p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { setFilter('all'); setSearch(''); }}
          >
            عرض الكل
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${filter}-${search.trim().toLowerCase()}`}
            className="msp__grid"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
          >
            {filtered.map((s) => renderCard(s))}
          </motion.div>
        </AnimatePresence>
      )}

      {deleteTarget && (
        <div className="modal-overlay odash__modal-overlay" onClick={() => { if (!deleting) setDeleteTarget(null); }}>
          <div className="modal-box odash__modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="تأكيد حذف المساحة">
            <span className="odash__modal-ico msp__modal-ico-danger"><Trash2 /></span>
            <h3>حذف المساحة؟</h3>
            <p className="odash__modal-sub">
              سيتم حذف «{deleteTarget.title}» نهائياً وستختفي من التصفح والعروض.
              لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="odash__modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                إلغاء
              </button>
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="spin" /> : <Trash2 />}
                {deleting ? 'جارٍ الحذف…' : 'نعم، احذف'}
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