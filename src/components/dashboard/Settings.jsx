import { useRef, useState } from 'react';
import { LogOut, User, Pencil, HelpCircle, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Camera, Trash2 } from 'lucide-react';
import { changePassword, ApiError } from '../../lib/authStore';
import { imageUrl } from '../../lib/api';
import useSafeInput from '../../hooks/useSafeInput';

function initialsOf(name) {
  return (name || 'م').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || 'م';
}

function translatePasswordError(msg) {
  if (!msg) return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
  const m = String(msg).toLowerCase();
  if (m.includes('current') || m.includes('كلمة المرور الحالية')) return 'كلمة المرور الحالية غير صحيحة.';
  if (m.includes('password') && (m.includes('short') || m.includes('min') || m.includes('at least') || m.includes('characters')))
    return 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.';
  if (m.includes('mismatch') || m.includes('confirmation')) return 'كلمتا المرور غير متطابقتين.';
  return msg;
}

export default function Settings({ user, onLogout, onDeleteAccount, onSaveProfile, onUploadPicture }) {
  // حقول بيانات الملف الشخصي (قابلة للتعديل)
  const name = useSafeInput(user?.name || '', { maxLength: 60 });
  const email = useSafeInput(user?.email || '', { maxLength: 120 });
  const phone = useSafeInput(user?.phone || '', { maxLength: 20 });

  // --- صورة الملف الشخصي (معاينة قبل الرفع للـ API) ---
  const [photoPreview, setPhotoPreview] = useState(() => {
    const cached = localStorage.getItem('profile_picture_url');
    return cached || user?.photo || null;
  });
  const fileRef = useRef(null);

  // --- حالة الحفظ ---
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handlePhotoChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);
    setSaveMsg('');
    try {
      if (onUploadPicture) {
        const uploadedUrl = await onUploadPicture(file);
        // انعكس الصورة إلى الرابط المؤكَّد (أو أبقِ المعاينة المؤقتة كبديل).
        setPhotoPreview((prev) => (uploadedUrl ? imageUrl(uploadedUrl) : prev));
        setSaveMsg('ok▶تم تحديث صورة الملف الشخصي.');
      }
    } catch (err) {
      setSaveMsg(`err▶${err?.message || 'تعذر تحديث صورة الملف الشخصي. حاول مجدداً.'}`);
      setPhotoPreview(user?.photo || localStorage.getItem('profile_picture_url') || null);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // --- تغيير كلمة المرور ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const resetPwFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    setPwLoading(true);

    if (!currentPassword) {
      setPwError('أدخل كلمة المرور الحالية.');
      setPwLoading(false);
      return;
    }
    if (newPassword.length < 8) {
      setPwError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
      setPwLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('كلمتا المرور غير متطابقتين.');
      setPwLoading(false);
      return;
    }

    try {
      await changePassword({
        oldPassword: currentPassword,
        newPassword: newPassword,
        newPassword_confirmation: confirmPassword,
      });
      setPwSuccess('تم تغيير كلمة المرور بنجاح.');
      resetPwFields();
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) {
        const firstKey = Object.keys(err.data.errors)[0];
        const msg = firstKey && Array.isArray(err.data.errors[firstKey])
          ? err.data.errors[firstKey][0]
          : err.message;
        setPwError(translatePasswordError(msg));
      } else {
        setPwError(translatePasswordError(err && err.message));
      }
    } finally {
      setPwLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveMsg('');
    setFieldErrors({});

    // Field-level validation
    const errs = {};
    if (!name.value.trim()) errs.name = 'الاسم مطلوب.';
    if (!email.value.trim()) errs.email = 'البريد الإلكتروني مطلوب.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) errs.email = 'البريد الإلكتروني غير صحيح.';
    if (phone.value && !/^\+?[\d\s-]{7,}$/.test(phone.value)) errs.phone = 'رقم الهاتف غير صحيح.';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    // No actual changes? no need to confirm
    const changed =
      name.value !== (user?.name || '') ||
      phone.value !== (user?.phone || '') ||
      email.value !== (user?.email || '');
    if (!changed) {
      setSaveMsg('ok▶لا توجد تغييرات لحفظها.');
      return;
    }

    setConfirmOpen(true);
  };

  const confirmSave = async () => {
    setSaving(true);
    setSaveMsg('');
    setConfirmOpen(false);
    setFieldErrors({});

    try {
      if (onSaveProfile) {
        await onSaveProfile({
          full_name: name.value,
          phone: phone.value,
          email: email.value,
        });
        setSaveMsg('ok▶تم حفظ التغييرات.');
      }
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) {
        const mapped = {};
        const backendMap = { full_name: 'name', email: 'email', phone: 'phone' };
        Object.entries(err.data.errors).forEach(([key, val]) => {
          const field = backendMap[key] || key;
          if (Array.isArray(val)) mapped[field] = val[0];
          else if (typeof val === 'string') mapped[field] = val;
        });
        if (Object.keys(mapped).length > 0) setFieldErrors(mapped);
        const firstKey = Object.keys(err.data.errors)[0];
        const msg = firstKey && Array.isArray(err.data.errors[firstKey])
          ? err.data.errors[firstKey][0]
          : err.message;
        setSaveMsg(`err▶${msg || 'تعذر حفظ التغييرات.'}`);
      } else {
        setSaveMsg(`err▶${err?.message || 'تعذر حفظ التغييرات.'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dash__settings">
      <section className="dash__section">
        <div className="dash__section-head">
          <h2><User /> بياناتك الشخصية</h2>
        </div>

        <div className="dash__profile-card">
          <div className="dash__profile-hero">
            <button
              type="button"
              className="dash__photo-btn"
              onClick={() => fileRef.current && fileRef.current.click()}
              aria-label="تغيير صورة الملف الشخصي"
            >
              {photoPreview ? (
                <img
                  className="dash__photo"
                  src={photoPreview}
                  alt={user?.name || ''}
                  onError={e => {
                    e.target.onerror = null;
                    e.target.src = '/placeholder-profile.jpg';
                  }}
                />
              ) : (
                <div className="dash__photo dash__photo--initials">{initialsOf(user?.name)}</div>
              )}
              <span className="dash__photo-edit"><Camera /></span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePhotoChange}
            />
            <h3 className="dash__photo-name">{user?.name || 'المستخدم'}</h3>
            <p className="dash__photo-role">{user?.role === 'owner' ? 'صاحب مساحة' : 'طالب'}</p>
          </div>

          <form className="dash__form dash__form--inside" onSubmit={handleSave}>
            <div className={`field${fieldErrors.name ? ' has-error' : ''}`}>
              <label htmlFor="set-name">الاسم الكامل</label>
              <input
                id="set-name"
                type="text"
                value={name.value}
                onChange={name.onChange}
                placeholder="اسمك"
                dir="rtl"
              />
              <p className="error">{fieldErrors.name}</p>
            </div>

            <div className={`field${fieldErrors.email ? ' has-error' : ''}`}>
              <label htmlFor="set-email">البريد الإلكتروني (للتحقق)</label>
              <input
                id="set-email"
                type="email"
                value={email.value}
                onChange={email.onChange}
                dir="ltr"
                placeholder="you@example.com"
              />
              <p className="error">{fieldErrors.email}</p>
            </div>

            <div className={`field${fieldErrors.phone ? ' has-error' : ''}`}>
              <label htmlFor="set-phone">رقم الهاتف</label>
              <input
                id="set-phone"
                type="tel"
                dir="ltr"
                value={phone.value}
                onChange={phone.onChange}
                placeholder="+970 59 000 0000"
              />
              <p className="error">{fieldErrors.phone}</p>
            </div>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
            </button>
          </form>

          {/* رسالة الحفظ */}
          {saveMsg && (
            <div
              className={`dash__msg ${saveMsg.startsWith('err▶') ? 'dash__msg--err' : 'dash__msg--ok'}`}
              style={{ marginTop: '1rem' }}
              role={saveMsg.startsWith('err▶') ? 'alert' : 'status'}
            >
              {saveMsg.startsWith('err▶') ? <AlertCircle /> : <CheckCircle2 />}
              <span>{saveMsg.replace(/^(ok|err)▶/, '')}</span>
            </div>
          )}

          {/* حالة رفع الصورة */}
          {uploading && (
            <p style={{ marginTop: '1rem', fontSize: '.9rem', color: 'var(--accent)' }}>
                جاري رفع الصورة...
            </p>
          )}

        </div>
      </section>

      <section className="dash__section">
        <div className="dash__section-head">
          <h2><KeyRound /> تغيير كلمة المرور</h2>
        </div>

        <form className="dash__form" onSubmit={handleChangePassword}>
          {pwSuccess && (
            <div className="dash__msg dash__msg--ok" role="status">
              <CheckCircle2 />
              <span>{pwSuccess}</span>
            </div>
          )}
          {pwError && (
            <div className="dash__msg dash__msg--err" role="alert">
              <AlertCircle />
              <span>{pwError}</span>
            </div>
          )}

          <div className="field">
            <label htmlFor="pw-current">كلمة المرور الحالية</label>
            <input
              id="pw-current"
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); if (pwError) setPwError(''); }}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="field">
            <label htmlFor="pw-new">كلمة المرور الجديدة</label>
            <div className="dash__pw-wrap">
              <input
                id="pw-new"
                type={showPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); if (pwError) setPwError(''); }}
                placeholder="٨ أحرف على الأقل"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="dash__pw-toggle"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="pw-confirm">تأكيد كلمة المرور الجديدة</label>
            <input
              id="pw-confirm"
              type={showPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); if (pwError) setPwError(''); }}
              placeholder="أعد إدخال كلمة المرور"
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={pwLoading}>
            <KeyRound style={{ width: '1rem', height: '1rem' }} />
            {pwLoading ? 'جارٍ الحفظ…' : 'تغيير كلمة المرور'}
          </button>
        </form>
      </section>

      <section className="dash__section">
        <div className="dash__section-head">
          <h2><HelpCircle /> الدعم</h2>
        </div>
        <div className="dash__form">
          <p style={{ margin: '0 0 1rem', fontSize: '.9rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            لديك مشكلة أو سؤال؟ تواصل مع فريقنا عبر الواتساب على مدار الساعة ونحن جاهزون لمساعدتك.
          </p>
          <a
            className="btn-primary"
            href="https://wa.me/972567653009"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            تواصل عبر واتساب
          </a>
        </div>
      </section>

      <section className="dash__section">
        <div className="dash__section-head">
          <h2><LogOut /> الجلسة</h2>
        </div>
        <div className="dash__form">
          <p style={{ margin: '0 0 1rem', fontSize: '.9rem', color: 'var(--text-muted)' }}>
            سجّل خروجك بأمان عند انتهائك من استخدام الجهاز.
          </p>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            <LogOut style={{ width: '1rem', height: '1rem' }} />
            تسجيل الخروج
          </button>
        </div>
      </section>
      <section className="dash__section">
        <div className="dash__section-head risk-head">
          <h2><Trash2 /> منطقة الخطر</h2>
        </div>
        <div className="dash__form risk-box">
          <p style={{ margin: '0 0 1rem', fontSize: '.9rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            حذف حسابك نهائياً يزيل جميع بياناتك ومساحاتك وحجوزاتك من المنصة. لن تتمكن من التراجع عن هذا الإجراء، ولن تستطيع استعادة حسابك بعد الحذف.
          </p>
          <button type="button" className="btn-danger" onClick={onDeleteAccount}>
            <Trash2 style={{ width: '1rem', height: '1rem' }} />
            حذف الحساب نهائياً
          </button>
        </div>
      </section>

      {confirmOpen && (
        <div className="modal-overlay delete-confirm__overlay" onClick={() => !saving && setConfirmOpen(false)}>
          <div
            className="modal-box delete-confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="تأكيد حفظ التغييرات"
          >
            <div className="delete-confirm__ico" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Pencil style={{ width: '1.6rem', height: '1.6rem' }} />
            </div>
            <h3>هل أنت متأكد من تحديث بياناتك؟</h3>
            <p>
              سيتم حفظ التعديلات التالية: الاسم، رقم الهاتف، والبريد الإلكتروني.
              هل تريد المتابعة؟
            </p>
            <div className="delete-confirm__actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmSave}
                disabled={saving}
              >
                {saving ? 'جارٍ الحفظ…' : 'نعم، حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
