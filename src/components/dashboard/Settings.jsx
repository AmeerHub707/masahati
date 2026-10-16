import { useRef, useState } from 'react';
import { LogOut, User, Pencil, HelpCircle, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Camera, Trash2 } from 'lucide-react';
import { changePassword, ApiError, getUser, setUser } from '@/lib/authStore';
import { getCachedPictureUrl } from '@/lib/profilePicture';
import useSafeInput from '@/hooks/useSafeInput';
import { getPasswordChecks, PASSWORD_RULES, PASSWORD_MIN_LENGTH } from '@/lib/passwordRules';
import { useTranslation } from '@/hooks/useT';

function initialsOf(name, fallback) {
  const source = name || fallback || '';
  return source.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || (fallback || '');
}

// مطابقة رسالة الخادم ثنائية اللغة: قد تصل بالعربية أو بالإنجليزية، فنُخرج
// النصّ من مفاتيح الترجمة حسب اللغة النشطة لا من نصّ ثابت.
function translatePasswordError(msg, t) {
  if (!msg) return t('dashboard:err.unexpected');
  const m = String(msg).toLowerCase();
  if (m.includes('current') || m.includes('كلمة المرور الحالية')) return t('dashboard:err.currentPasswordWrong');
  if (m.includes('password') && (m.includes('format') || m.includes('uppercase') || m.includes('symbol') || m.includes('numeric')))
    return t('auth:pwMsgFormat');
  if (m.includes('password') && (m.includes('short') || m.includes('min') || m.includes('at least') || m.includes('characters')))
    return t('auth:pwMsgLength', { n: PASSWORD_MIN_LENGTH });
  if (m.includes('mismatch') || m.includes('confirmation')) return t('dashboard:err.passwordMismatch');
  return msg;
}

export default function Settings({ user, onLogout, onDeleteAccount, onSaveProfile, onUploadPicture }) {
  // حقول بيانات الملف الشخصي (قابلة للتعديل)
  const name = useSafeInput(user?.name || '', { maxLength: 60 });
  const email = useSafeInput(user?.email || '', { maxLength: 120 });
  const phone = useSafeInput(user?.phone || '', { maxLength: 20 });

  const { t } = useTranslation();

  // رسالة كلمة المرور تُبنى من مفاتيح الترجمة (نفس نمط صفحة التسجيل): القواعد
  // تُسمّى بالعربية أو الإنجليزية حسب اللغة النشطة بدل نصّ ثابت.
  const passwordMessage = (value) => {
    const checks = getPasswordChecks(value);
    const failed = PASSWORD_RULES.filter((r) => !checks[r.id]).map((r) =>
      t(`auth:pwRules.${r.id}`, { n: PASSWORD_MIN_LENGTH })
    );
    if (!failed.length) return '';
    return t('auth:pwInvalid', { rules: failed.join(t('auth:pwInvalidSeparator')) });
  };

  // --- صورة الملف الشخصي (معاينة قبل الرفع للـ API) ---
  const [photoPreview, setPhotoPreview] = useState(() => {
    const cached = getCachedPictureUrl();
    return cached || user?.photo || null;
  });
  const fileRef = useRef(null);
  // يمنع نتيجة رفع قديم من الكتابة فوق نتيجة رفع أحدث (نقرات متتالية سريعة).
  const uploadSeq = useRef(0);

  // --- حالة الحفظ ---
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleProfilePhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    // نُفرغ الحقل فوراً كي يُعاد إطلاق الحدث عند اختيار نفس الملف لاحقاً.
    e.target.value = '';
    if (!file) return;

    // تحقق من نوع الملف وحجمه قبل إرساله للخادم
    if (!file.type || !file.type.startsWith('image/')) {
      setSaveMsg(`err▶${t('dashboard:err.imageType')}`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveMsg(`err▶${t('dashboard:err.imageSize')}`);
      return;
    }
    if (typeof onUploadPicture !== 'function') {
      setSaveMsg(`err▶${t('dashboard:err.uploadUnavailable')}`);
      return;
    }

    const seq = ++uploadSeq.current;
    // معاينة فورية مؤقتة للمستخدم (Blob URL) أثناء الرفع
    const tempPreviewUrl = URL.createObjectURL(file);
    setPhotoPreview(tempPreviewUrl);
    setUploading(true);
    setSaveMsg('');

    try {
      // إرسال الملف للباك إند واستلام رابط الصورة الراجع (Cloudinary)
      const uploadedUrl = await onUploadPicture(file);
      if (seq !== uploadSeq.current) return; // نتيجة رفع أقدم: تُتجاهل

      if (!uploadedUrl) {
        throw new Error(t('dashboard:err.noImageUrl'));
      }

      // استبدال معاينة الـ Blob بالرابط الحقيقي وتحديث الكاش والمستخدم المخزن
      setPhotoPreview(uploadedUrl);
      try {
        const stored = getUser() || {};
        setUser({ ...stored, photo: uploadedUrl });
      } catch {
        /* التخزين غير متاح */
      }
      setSaveMsg(`ok▶${t('dashboard:ok.photoUpdated')}`);
    } catch (error) {
      if (seq !== uploadSeq.current) return;
      console.warn('Picture upload failed:', error);
      setPhotoPreview(user?.photo || getCachedPictureUrl() || null);
      setSaveMsg(`err▶${error?.message || t('dashboard:err.uploadFailed')}`);
    } finally {
      // تنظيف رابط الـ Blob المؤقت فوراً من ذاكرة المتصفح
      URL.revokeObjectURL(tempPreviewUrl);
      if (seq === uploadSeq.current) setUploading(false);
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
      setPwError(t('dashboard:err.currentPasswordRequired'));
      setPwLoading(false);
      return;
    }
    const newPasswordIssue = passwordMessage(newPassword);
    if (newPasswordIssue) {
      setPwError(newPasswordIssue);
      setPwLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t('dashboard:err.passwordMismatch'));
      setPwLoading(false);
      return;
    }

    try {
      await changePassword({
        oldPassword: currentPassword,
        newPassword: newPassword,
        newPassword_confirmation: confirmPassword,
      });
      setPwSuccess(t('dashboard:ok.passwordChanged'));
      resetPwFields();
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) {
        const firstKey = Object.keys(err.data.errors)[0];
        const msg = firstKey && Array.isArray(err.data.errors[firstKey])
          ? err.data.errors[firstKey][0]
          : err.message;
        setPwError(translatePasswordError(msg, t));
      } else {
        setPwError(translatePasswordError(err && err.message, t));
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
    if (!name.value.trim()) errs.name = t('dashboard:err.nameRequired');
    if (!email.value.trim()) errs.email = t('dashboard:err.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) errs.email = t('dashboard:err.emailInvalid');
    if (phone.value && !/^\+?[\d\s-]{7,}$/.test(phone.value)) errs.phone = t('dashboard:err.phoneInvalid');

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
      setSaveMsg(`ok▶${t('dashboard:ok.noChanges')}`);
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
        setSaveMsg(`ok▶${t('dashboard:ok.saved')}`);
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
        setSaveMsg(`err▶${msg || t('dashboard:err.saveFailed')}`);
      } else {
        setSaveMsg(`err▶${err?.message || t('dashboard:err.saveFailed')}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dash__settings">
      <section className="dash__section">
        <div className="dash__section-head">
          <h2><User /> {t('dashboard:settings.personalTitle')}</h2>
        </div>

        <div className="dash__profile-card">
          <div className="dash__profile-hero">
            <button
              type="button"
              className="dash__photo-btn"
              onClick={() => fileRef.current && fileRef.current.click()}
              aria-label={t('dashboard:settings.changePhotoAria')}
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
                <div className="dash__photo dash__photo--initials">{initialsOf(user?.name, t('common:appName'))}</div>
              )}
              <span className="dash__photo-edit"><Camera /></span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleProfilePhoto}
            />
            <h3 className="dash__photo-name">{user?.name || t('dashboard:settings.fallbackUser')}</h3>
            <p className="dash__photo-role">{user?.role === 'owner' ? t('dashboard:settings.roleOwner') : t('dashboard:settings.roleStudent')}</p>
          </div>

          <form className="dash__form dash__form--inside" onSubmit={handleSave}>
            <div className={`field${fieldErrors.name ? ' has-error' : ''}`}>
              <label htmlFor="set-name">{t('dashboard:settings.fullName')}</label>
              <input
                id="set-name"
                type="text"
                value={name.value}
                onChange={name.onChange}
                placeholder={t('dashboard:settings.namePlaceholder')}
              />
              <p className="error">{fieldErrors.name}</p>
            </div>

            <div className={`field${fieldErrors.email ? ' has-error' : ''}`}>
              <label htmlFor="set-email">{t('dashboard:settings.emailLabel')}</label>
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
              <label htmlFor="set-phone">{t('dashboard:settings.phoneLabel')}</label>
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
              {saving ? t('dashboard:settings.saving') : t('dashboard:settings.saveChanges')}
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
          <h2><KeyRound /> {t('dashboard:settings.changePasswordTitle')}</h2>
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
            <label htmlFor="pw-current">{t('dashboard:settings.currentPassword')}</label>
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
                placeholder={t('dashboard:settings.newPasswordPlaceholder')}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="dash__pw-toggle"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? t('dashboard:settings.hidePassword') : t('dashboard:settings.showPassword')}
              >
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="pw-confirm">{t('dashboard:settings.confirmPassword')}</label>
            <input
              id="pw-confirm"
              type={showPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); if (pwError) setPwError(''); }}
              placeholder={t('dashboard:settings.confirmPasswordPlaceholder')}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={pwLoading}>
            <KeyRound style={{ width: '1rem', height: '1rem' }} />
            {pwLoading ? t('dashboard:settings.saving') : t('dashboard:settings.changePasswordBtn')}
          </button>
        </form>
      </section>

      <section className="dash__section">
        <div className="dash__section-head">
          <h2><HelpCircle /> {t('dashboard:settings.supportTitle')}</h2>
        </div>
        <div className="dash__form">
          <p style={{ margin: '0 0 1rem', fontSize: '.9rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {t('dashboard:settings.supportText')}
          </p>
          <a
            className="btn-primary"
            href="https://wa.me/972567653009"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            {t('dashboard:settings.contactWhatsapp')}
          </a>
        </div>
      </section>

      <section className="dash__section">
        <div className="dash__section-head">
          <h2><LogOut /> {t('dashboard:settings.sessionTitle')}</h2>
        </div>
        <div className="dash__form">
          <p style={{ margin: '0 0 1rem', fontSize: '.9rem', color: 'var(--text-muted)' }}>
            {t('dashboard:settings.sessionText')}
          </p>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            <LogOut style={{ width: '1rem', height: '1rem' }} />
            {t('dashboard:settings.logout')}
          </button>
        </div>
      </section>
      <section className="dash__section">
        <div className="dash__section-head risk-head">
          <h2><Trash2 /> {t('dashboard:settings.dangerTitle')}</h2>
        </div>
        <div className="dash__form risk-box">
          <p style={{ margin: '0 0 1rem', fontSize: '.9rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {t('dashboard:settings.dangerText')}
          </p>
          <button type="button" className="btn-danger" onClick={onDeleteAccount}>
            <Trash2 style={{ width: '1rem', height: '1rem' }} />
            {t('dashboard:settings.deleteAccount')}
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
            aria-label={t('dashboard:settings.confirmSaveAria')}
          >
            <div className="delete-confirm__ico" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Pencil style={{ width: '1.6rem', height: '1.6rem' }} />
            </div>
            <h3>{t('dashboard:settings.confirmSaveTitle')}</h3>
            <p>
              {t('dashboard:settings.confirmSaveBody')}
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
                {saving ? t('dashboard:settings.saving') : t('dashboard:settings.confirmSaveYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
