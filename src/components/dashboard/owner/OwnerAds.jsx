import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Megaphone, Plus, X, Loader2, Send, Tag, Link as LinkIcon, Image as ImageIcon,
  CalendarClock, Users, Check, Clock, Repeat, BarChart3,
  ArrowRight,
} from 'lucide-react';
import {
  loadAdsWithFallback,
  createAdWithFallback,
  updateAdWithFallback,
  publishAdWithFallback,
  deleteAdWithFallback,
} from '../../../lib/ads';
import { useDialogA11y } from '../../../lib/dialogA11y';

const numFmt = new Intl.NumberFormat('ar-EG');
function fmtNumber(n) {
  return numFmt.format(n || 0);
}

const TARGET_OPTIONS = [
  { value: 'customers', label: 'جميع العملاء (مشتري المساحات)', desc: 'الإعلان يظهر لكل العملاء على المنصة.' },
  { value: 'space_customers', label: 'عملاء مساحاتهم فقط', desc: 'يظهر للعملاء الذين حجزوا مساحة لديك.' },
];

const STATUS_LABELS = {
  draft: 'مسودة',
  published: 'منشور',
  archived: 'مؤرشف',
};

const STATUS_META = {
  draft: { icon: Clock, cls: 'badge--muted', color: 'orange' },
  published: { icon: Check, cls: 'badge--confirmed', color: 'green' },
  archived: { icon: X, cls: 'badge--cancelled', color: 'red' },
};

const DEFAULT_FORM = {
  title: '',
  description: '',
  link: '',
  image: '',
  target: 'customers',
  schedule: null,
  photos: [],
};

const MAX_PHOTOS = 3;
const MAX_DESC = 500;
const MAX_TITLE = 100;

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('read'));
    fr.onload = () => {
      const raw = String(fr.result);
      const img = new Image();
      img.onerror = () => resolve(raw);
      img.onload = () => {
        const maxSide = 800;
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

export default function OwnerAds() {
  const [ads, setAds] = useState(() => []);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null); // null | { mode:'create' } | { mode:'edit', ad }
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const mountedRef = useRef(true);
  const fileInputRef = useRef(null);

  const dialogRef = useDialogA11y({ open: !!modal, onClose: () => { if (!saving && !publishing) resetModal(); } });
  const deleteDialogRef = useDialogA11y({ open: !!deleteTarget, onClose: () => { if (!deletingId) setDeleteTarget(null); } });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const loadAds = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadAdsWithFallback(force);
      if (!mountedRef.current) return;
      setAds(result.ads);
      setDemo(result.demo);
    } catch {
      if (mountedRef.current) setAds([]);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadAds(), 0);
    return () => clearTimeout(t);
  }, [loadAds]);

  const resetModal = () => {
    setModal(null);
    setForm(DEFAULT_FORM);
    setErrors({});
  };

  const openCreate = () => {
    console.log('[AD_FORM] Open Create Triggered');
    setForm(DEFAULT_FORM);
    setErrors({});
    setModal({ mode: 'create' });
  };

  const openEdit = (ad) => {
    const isEdit = ad ? { mode: 'edit', ad } : { mode: 'create' };
    setForm({
      title: ad?.title || '',
      description: ad?.description || '',
      link: ad?.link || '',
      image: ad?.image || '',
      target: ad?.target || 'customers',
      schedule: ad?.schedule || null,
      photos: [],
    });
    setErrors({});
    setModal(isEdit);
  };

  const validateForm = () => {
    const e = {};
    if (!form.title || !form.title.trim()) {
      e.title = 'اكتب عنواناً للإعلان.';
    } else if (form.title.length > MAX_TITLE) {
      e.title = `العنوان طويل جداً (الحد الأقصى ${MAX_TITLE} حرفاً).`;
    }
    if (form.description && form.description.length > MAX_DESC) {
      e.description = `الوصف طويل جداً (الحد الأقصى ${MAX_DESC} حرفاً).`;
    }
    if (form.link && !/^https?:\/\//i.test(form.link)) {
      e.link = 'أدخل رابطاً كاملاً يبدأ بـ https:// أو http://.';
    }
    setErrors(e);
    console.log('[AD_FORM] Validation Errors:', e);
    return Object.keys(e).length === 0;
  };

  const readPayload = () => ({
    title: (form.title || '').trim(),
    description: (form.description || '').trim(),
    link: (form.link || '').trim(),
    image: (form.photos && form.photos[0]) || form.image || '',
    target: form.target || 'customers',
    schedule: form.schedule || null,
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
    if (images.some((f) => f.size > 5 * 1024 * 1024)) {
      setToast({ msg: 'بعض الصور أكبر من 5 ميجابايت — اختر صوراً أصغر.', type: 'err' });
      return;
    }
    const remaining = MAX_PHOTOS - (form.photos || []).length;
    if (remaining <= 0) {
      setToast({ msg: `يكفي! أقصى عدد صور هو ${MAX_PHOTOS}.`, type: 'err' });
      return;
    }
    try {
      const out = [];
      for (const f of images.slice(0, remaining)) out.push(await readImageFile(f));
      setForm((prev) => ({ ...prev, photos: [...(prev.photos || []), ...out] }));
    } catch {
      setToast({ msg: 'تعذّرت معالجة بعض الصور، جرّب من جديد.', type: 'err' });
    }
  };

  const removePhoto = (idx) => {
    setForm((prev) => ({ ...prev, photos: (prev.photos || []).filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setToast({ msg: 'يرجى استكمال الحقول المطلوبة.', type: 'err' });
      return;
    }
    setSaving(true);
    try {
      const payload = readPayload();
      let result;
      if (modal.mode === 'edit') {
        result = await updateAdWithFallback(modal.ad.id, payload);
      } else {
        result = await createAdWithFallback(payload);
      }
      if (!mountedRef.current) return;
      const next = result.ad;
      if (modal.mode === 'edit') {
        setAds((prev) => prev.map((a) => (a.id === next.id ? next : a)));
      } else {
        setAds((prev) => [next, ...prev]);
      }
      setToast({ msg: result.message, type: 'ok' });
      resetModal();
    } catch {
      if (mountedRef.current) setToast({ msg: 'تعذّر حفظ الإعلان. حاول مجدداً.', type: 'err' });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const handlePublish = async (ad) => {
    setPublishing(true);
    try {
      const result = await publishAdWithFallback(ad.id, ad);
      if (!mountedRef.current) return;
      setAds((prev) => prev.map((a) => (a.id === result.ad.id ? result.ad : a)));
      setToast({ msg: result.message, type: 'ok' });
    } catch {
      if (mountedRef.current) setToast({ msg: 'تعذّر نشر الإعلان. حاول مجدداً.', type: 'err' });
    } finally {
      if (mountedRef.current) setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const result = await deleteAdWithFallback(deleteTarget.id);
      if (!mountedRef.current) return;
      setAds((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setToast({ msg: result.message, type: 'ok' });
      setDeleteTarget(null);
    } catch {
      if (mountedRef.current) setToast({ msg: 'تعذّر حذف الإعلان.', type: 'err' });
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const handleCopyLink = async (ad) => {
    const link = ad.link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  };

  const publishedAds = useMemo(() => ads.filter((a) => a.status === 'published'), [ads]);
  const draftAds = useMemo(() => ads.filter((a) => a.status === 'draft'), [ads]);

  const renderBanner = () => {
    if (!demo) return null;
    return (
      <div className="odash__banner" role="status">
        <Clock />
        <p>
          <b>وضع تجريبي</b> — واجهة الباك إند (API) غير مفعّلة بعد، الإعلانات أدناه للتجربة
          وتُحفظ محلياً. عند إتاحة الواجهة سيتولّى النظام التزامين تلقائياً.
        </p>
        <button type="button" onClick={() => setToast(null)} aria-label="إغلاق" className="odash__banner-x">
          <X />
        </button>
      </div>
    );
  };

  const renderCard = (ad) => {
    const meta = STATUS_META[ad.status] || STATUS_META.draft;
    const Icon = meta.icon;
    return (
      <motion.article
        className="oads__card"
        key={ad.id}
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <div className="oads__card-media">
          {ad.image ? (
            <img src={ad.image} alt={ad.title} loading="lazy" />
          ) : (
            <div className="oads__card-media-fallback"><Megaphone /></div>
          )}
          <span className={`oads__card-status is-${ad.status}`}>
            <Icon /> {STATUS_LABELS[ad.status] || ad.status}
          </span>
        </div>

        <div className="oads__card-body">
          <h3>{ad.title || 'بدون عنوان'}</h3>
          {ad.description && <p className="oads__card-desc">{ad.description}</p>}

          <div className="oads__card-target">
            <Tag /> {TARGET_OPTIONS.find((t) => t.value === ad.target)?.label || ad.target}
          </div>

          {ad.link && (
            <button
              type="button"
              className="oads__link"
              onClick={() => handleCopyLink(ad)}
              title="نسخ الرابط"
              aria-label="نسخ الرابط"
            >
              <LinkIcon /> {copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}
            </button>
          )}

          <div className="oads__card-meta">
            <span><CalendarClock /> {timeAgo(ad.created_at) || '-'}</span>
            {ad.sent_at && (
              <span><Send /> أُرسل {timeAgo(ad.sent_at)}</span>
            )}
            {ad.impressions > 0 && (
              <span><BarChart3 /> {fmtNumber(ad.impressions)} عرض</span>
            )}
          </div>
        </div>

        <div className="oads__card-actions">
          {ad.status === 'draft' && (
            <button
              type="button"
              className="btn-primary oads__act"
              onClick={() => handlePublish(ad)}
              disabled={publishing}
              aria-label="نشر الإعلان"
              title="نشر وبث للعملاء"
            >
              {publishing ? <Loader2 className="spin" /> : <Megaphone />}
              {publishing ? 'جارٍ النشر…' : 'نشر'}
            </button>
          )}
          <button
            type="button"
            className="oads__act oads__act--edit"
            onClick={() => openEdit(ad)}
            aria-label="تعديل الإعلان"
            title="تعديل"
          >
            <Plus className="rotate-180" />
          </button>
          <button
            type="button"
            className="oads__act oads__act--delete"
            onClick={() => setDeleteTarget(ad)}
            aria-label="حذف الإعلان"
            title="حذف"
          >
            <X />
          </button>
        </div>
      </motion.article>
    );
  };

  const renderForm = () => {
    const isEdit = modal?.mode === 'edit';
    return (
      <div className="modal-overlay" style={{ zIndex: 1000, position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div className="oads__form-panel" style={{ zIndex: 1001, position: 'relative', maxWidth: '600px', width: '100%', margin: 'auto' }}>
          <form
            ref={dialogRef}
            className="oads__form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="oads-form-title"
            tabIndex={-1}
            onSubmit={(e) => { e.preventDefault(); if (!saving) handleSave(); }}
            noValidate
          >

          <button type="button" className="odash__modal-close" onClick={resetModal} aria-label="إغلاق" disabled={saving}>
            <X />
          </button>

          <div className="oads__form-head">
            <span className="odash__modal-ico">{isEdit ? <Plus className="rotate-180" /> : <Megaphone />}</span>
            <h3 id="oads-form-title">{isEdit ? 'تعديل الإعلان' : 'إنشاء إعلان جديد'}</h3>
            <p className="odash__modal-sub">
              {isEdit
                ? 'حدّث تفاصيل الإعلان واحفظها. سيظهر للعملاء بعد النشر.'
                : 'أنشئ إعلاناً مخصصاً للعملاء — يُبث بعد النشر إلى جميع من لديهم حسابات عميل.'}
            </p>
          </div>

          <div className="oads__form-body space-y-6">
            {/* المعلومات الأساسية */}
            <section className="oads__form-sec flex flex-col gap-4">
              <h4><Megaphone /> المعلومات الأساسية</h4>

              <div className={`odash__field ${errors.title ? 'has-error' : ''}`}>
                <label htmlFor="oads-title">عنوان الإعلان <b>*</b></label>
                <div className="odash__input-wrap">
                  <Megaphone className="odash__input-ico" />
                  <input
                    id="oads-title"
                    type="text"
                    maxLength={MAX_TITLE}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="مثال: عرض خاص للمنصة"
                  />
                </div>
                <p>{errors.title || ''}</p>
              </div>

              <div className={`odash__field ${errors.description ? 'has-error' : ''}`}>
                <label htmlFor="oads-desc">نص الإعلان <small>{form.description.length}/{MAX_DESC}</small></label>
                <textarea
                  id="oads-desc"
                  rows="3"
                  maxLength={MAX_DESC}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="شرّح العرض أو الخدمة باختصار..."
                />
                <p>{errors.description || ''}</p>
              </div>

              <div className={`odash__field ${errors.link ? 'has-error' : ''}`}>
                <label htmlFor="oads-link">رابط (اختياري)</label>
                <div className="odash__input-wrap">
                  <LinkIcon className="odash__input-ico" />
                  <input
                    id="oads-link"
                    type="url"
                    value={form.link}
                    onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                    placeholder="https://example.com/special-offer"
                  />
                </div>
                <p>{errors.link || ''}</p>
              </div>
            </section>

            {/* الاستهداف */}
            <section className="oads__form-sec">
              <h4><Tag /> استهداف الجمهور</h4>
              <p className="oads__form-hint">اختر من سيلرى هذا الإعلان.</p>
              <div className="odash__form-chips flex flex-wrap gap-3">
                {TARGET_OPTIONS.map((opt) => {
                  const on = form.target === opt.value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      className={on ? 'is-on' : ''}
                      onClick={() => setForm((f) => ({ ...f, target: opt.value }))}
                      aria-pressed={on}
                    >
                      {opt.label}
                      {on && <Check />}
                    </button>
                  );
                })}
              </div>
              {form.target === 'space_customers' && (
                <p className="oads__form-note">
                  يبث للعملاء الذين حجزوا مساحة لديك مسبقاً. يتطلب دعماً من الباك إند لتحديد "العملاء المرتبطين".
                </p>
              )}
            </section>

            {/* الصورة */}
            <section className="oads__form-sec flex flex-col gap-4">
              <h4><ImageIcon /> صورة الإعلان</h4>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFilesUpload}
                aria-label="رفع صورة الإعلان"
              />
              <button
                type="button"
                className="oads__upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={(form.photos || []).length >= MAX_PHOTOS}
              >
                <ImageIcon /> رفع صورة من جهازك
              </button>
              {(form.photos || []).length > 0 ? (
                <div className="oads__upload-grid">
                  {form.photos.map((src, i) => (
                    <div className="oads__upload-thumb" key={`${src.slice(0, 24)}-${i}`}>
                      <img src={src} alt={`صورة ${i + 1}`} />
                      <button type="button" className="oads__upload-remove" onClick={() => removePhoto(i)} aria-label="حذف الصورة">
                        <X />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="oads__upload-hint"><ImageIcon /> لا توجد صور مرفوعة بعد.</div>
              )}
            </section>
          </div>

          <div className="oads__form-foot">
            <button type="button" className="btn-ghost" onClick={resetModal} disabled={saving}>
              إلغاء
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="spin" /> : <Send />}
              {saving ? 'جارٍ الحفظ…' : (isEdit ? 'حفظ التغييرات' : 'إنشاء الإعلان')}
            </button>
          </div>
        </form>
      </div>
      </div>
    );
  };

  return (
    <section className="odash__ads oads">
      {renderBanner()}

      <div className="obk__hero">
        <div className="obk__hero-main">
          <h2>{modal ? (modal.mode === 'edit' ? <Plus className="rotate-180" /> : <Megaphone />) : <Megaphone />} {modal ? (modal.mode === 'edit' ? 'تعديل الإعلان' : 'إنشاء إعلان') : 'إعلاناتي'}</h2>
          <p>{modal ? 'حدّث إعلانك واحفظه للعرض على البث.' : 'أنشئ إعلاناتك وأرسلها كبث إلى جميع العملاء على المنصة.'}</p>
          {!modal && (
            <div className="obk__hero-meta">
              <span className="obk__hero-chip"><Megaphone /> {fmtNumber(publishedAds.length)} منشور</span>
              <span className="obk__hero-chip"><Clock /> {fmtNumber(draftAds.length)} مسودة</span>
              <span className="obk__hero-chip is-good"><Users /> {fmtNumber(publishedAds.reduce((s, a) => s + (a.impressions || 0), 0))} إجمالي العرض</span>
            </div>
          )}
        </div>
        <div className="obk__hero-side">
          {modal ? (
            <button type="button" className="odash__spaces-add is-back" onClick={resetModal} aria-label="الرجوع إلى قائمة الإعلانات">
              <ArrowRight /> رجوع
            </button>
          ) : (
            <>
              <button
                type="button"
                className="odash__market-refresh obk__hero-refresh"
                onClick={() => loadAds(true)}
                disabled={refreshing}
                aria-label="تحديث الإعلانات"
                title="تحديث الإعلانات"
              >
                <Repeat className={refreshing ? 'spin' : ''} />
              </button>
              <button type="button" className="odash__spaces-add" onClick={openCreate}>
                <Plus /> إعلان جديد
              </button>
            </>
          )}
        </div>
      </div>

      {modal ? (
        renderForm()
      ) : loading ? (
        <div className="odash__state">
          <div className="ost-svg"><Loader2 className="spin" /></div>
          <h3>جارٍ تحميل إعلاناتك…</h3>
          <p>نعرض أحدث إعلاناتك.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {ads.length === 0 ? (
            <motion.div
              key="empty"
              className="odash__state"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              <div className="ost-svg"><Megaphone /></div>
              <h3>لا إعلانات بعد</h3>
              <p>أنشئ إعلاناً الأول وأرسله كبث إلى جميع العملاء.</p>
              <button type="button" className="btn-primary" onClick={openCreate}>
                <Plus /> إنشاء إعلان جديد
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              className="oads__grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {ads.map(renderCard)}
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

      {deleteTarget && (
        <div className="modal-overlay odash__modal-overlay" onClick={() => { if (!deletingId) setDeleteTarget(null); }}>
          <div
            className="modal-box odash__modal"
            ref={deleteDialogRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="تأكيد حذف الإعلان"
          >
            <span className="odash__modal-ico oads__modal-ico-danger"><X /></span>
            <h3>حذف الإعلان؟</h3>
            <p className="odash__modal-sub">
              سيتم حذف «{deleteTarget.title}» نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="odash__modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)} disabled={!!deletingId}>
                إلغاء
              </button>
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={!!deletingId}>
                {deletingId ? <Loader2 className="spin" /> : <X />}
                {deletingId ? 'جارٍ الحذف…' : 'نعم، احذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
