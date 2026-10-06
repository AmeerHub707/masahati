import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import {
  UserCircle2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Percent,
  Phone,
  Camera,
} from 'lucide-react';
import useSafeInput from '../../hooks/useSafeInput';
import {
  subscribeAdminProfile,
  getAdminProfileSnapshot,
  updateAdminProfile,
  changeAdminPassword,
  uploadAdminProfilePicture,
  isAdminApiLive,
} from '../../lib/adminAuth';
import { getSettings, saveSettings } from '../../lib/adminApi';
import { adaptSettings } from '../../lib/adminAdapters';
import { getCachedPictureUrl, validateImageFile, createPreviewUrl } from '../../lib/profilePicture';
import useAdminData from './useAdminData';
import { DataSourceBanner } from './ui';

function SettingsMsg({ ok, children }) {
  if (!children) return null;
  return (
    <div
      className={`dash__msg ${ok ? 'dash__msg--ok' : 'dash__msg--err'}`}
      role={ok ? 'status' : 'alert'}
    >
      {ok ? <CheckCircle2 /> : <AlertCircle />}
      <span>{children}</span>
    </div>
  );
}

function Toggle({ id, label = '', checked, onChange }) {
  return (
    <label htmlFor={id} className="dash__switch">
      {label && <span>{label}</span>}
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label || id}
      />
      <span className="track" aria-hidden="true" />
    </label>
  );
}

export default function AdminSettings() {
  // الملف الشخصي من اللقطة المشتركة: أي رفع صورة (أو حفظ الاسم) يحدّثها، فيتغيّر
  // الشريط الجانبي في كل تبويبات اللوحة بلا رفع حالة يدوي بينهما.
  const sharedProfile = useSyncExternalStore(subscribeAdminProfile, getAdminProfileSnapshot);
  const profile = sharedProfile || {};

  // --- صورة الملف الشخصي ---
  // مصدر العرض: صورة الملف المحفوظة، وإلا كاش لوحة المشرف.
  // `photoBroken` منفصل عن `photoSrc`: رابط ميّت (صورة حُذفت من الخادم مثلاً) يجب
  // أن يسقط إلى الحروف الأولى فوراً.
  const savedPhoto = profile.photo || getCachedPictureUrl('admin') || null;
  const [photoSrc, setPhotoSrc] = useState(() => savedPhoto);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  // يمنع نتيجة رفع قديم من الكتابة فوق نتيجة رفع أحدث (نقرات متتالية سريعة).
  const uploadSeq = useRef(0);

  const [saving, setSaving] = useState(false);
  const initials = (profile.name || 'م').trim().slice(0, 2) || 'م';
  const showPhoto = Boolean(photoSrc) && !photoBroken;

  // Section 1: البيانات الشخصية وكلمة المرور
  const name = useSafeInput(profile.name || '', { maxLength: 60 });
  const email = useSafeInput(profile.email || '', { maxLength: 120 });
  const whatsapp = useSafeInput(profile.whatsapp || '', { maxLength: 20 });
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ ok: false, text: '' });

  // Section 2: إعدادات الحجز والعمولة — القيمة الابتدائية من الخادم (العقد §11)
  // وحده. حقول النموذج تبدأ فارغة: تعبئتها بـ12% و24 قبل الردّ كانت تعرض
  // رقمين لم يقرّرهما الخادم، وإرسالها عند أول تعديل كان يكتبهما في القاعدة.
  const fetchSettings = useCallback(async () => adaptSettings(await getSettings()), []);

  const { data: platform, loading: settingsLoading, error: settingsError, reload } = useAdminData(fetchSettings);

  const [commissionRate, setCommissionRate] = useState('');
  const [gracePeriod, setGracePeriod] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  // `PUT /settings` يطلب **كل** الحقول إجبارياً (العقد §11)، فالحقل الرابع
  // ليس اختيارياً في الحفظ وإن كان غير معروض. نحتفظ بقيمة الخادم كما هي
  // ولا نخترع عملة: فإن لم يرد الحقل يبقى `''` ويظهر التنبيه بدل أن نكتب
  // عملةً في قاعدة البيانات باسم الإعداد.
  const [currency, setCurrency] = useState('');
  const [bookingMsg, setBookingMsg] = useState({ ok: false, text: '' });

  // أول تحميل حقيقي يملأ الحقول مرة واحدة. التحديث يتم في معالج الأحداث وحده،
  // فنُعيد ملء الحقول في retryLoad بدل أثر يطارد كل تصيير. الحقل الذي لم يرد
  // من الخادم يبقى فارغاً (لا قيمة مخترعة).
  const [seeded, setSeeded] = useState(false);
  if (!seeded && platform) {
    setSeeded(true);
    setCommissionRate(platform.commission_rate ?? '');
    setGracePeriod(platform.booking_grace_period_hours ?? '');
    setAutoApprove(Boolean(platform.auto_approve_bookings));
    setCurrency(platform.currency ?? '');
  }

  // رفع صورة الملف الشخصي.
  //
  // التسلسل: تحقّق محلي (نوع/حجم) ← معاينة فورية من الملف نفسه ← رفع حقيقي.
  // المعاينة قبل الردّ هي ما يجعل الاختيار محسوساً فوراً؛ ولو فشل الرفع نُعيد
  // الصورة السابقة بدل ترك صورة محلية لا تقابلها صورة في الخادم.
  const handlePhotoChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    // نُفرغ الحقل فوراً كي يُعاد إطلاق الحدث عند اختيار الملف نفسه لاحقاً.
    e.target.value = '';
    if (!file) return;

    const invalid = validateImageFile(file);
    if (invalid) {
      setProfileMsg({ ok: false, text: invalid });
      return;
    }

    const seq = ++uploadSeq.current;
    let preview = null;
    try {
      preview = await createPreviewUrl(file);
      if (seq !== uploadSeq.current) return;
      setPhotoSrc(preview.url);
      setPhotoBroken(false);
      setUploading(true);
      setProfileMsg({ ok: false, text: '' });

      // الرفع ينهي بـ refreshAdminProfile داخل adminAuth، فتتحدّث اللقطة
      // المشتركة ويُعاد تصيير الشريط الجانبي في كل التبويبات معه.
      const saved = await uploadAdminProfilePicture(file);
      if (seq !== uploadSeq.current) return;
      // لا نُبقي معاينة الملف المحلي بعد النجاح: رابط الخادم (أو data URL في
      // الوضع المحلي) هو ما يبقى صحيحاً بعد إعادة التحميل.
      if (!saved.photo) throw new Error('لم يُرجع الخادم رابط الصورة.');
      setPhotoSrc(saved.photo);
      setPhotoBroken(false);
      setProfileMsg({ ok: true, text: 'تم تحديث صورة الملف الشخصي.' });
    } catch (err) {
      if (seq !== uploadSeq.current) return;
      setPhotoSrc(savedPhoto);
      setPhotoBroken(false);
      setProfileMsg({ ok: false, text: err?.message || 'تعذّر رفع الصورة. حاول مجدداً.' });
    } finally {
      preview?.revoke();
      if (seq === uploadSeq.current) setUploading(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const nextEmail = email.value.trim();
    if (!name.value.trim()) {
      setProfileMsg({ ok: false, text: 'الاسم الكامل مطلوب.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setProfileMsg({ ok: false, text: 'البريد الإلكتروني غير صحيح.' });
      return;
    }
    const wantsPw = Boolean(current || newPass || confirm);
    if (wantsPw) {
      if (!current) {
        setProfileMsg({ ok: false, text: 'أدخل كلمة المرور الحالية.' });
        return;
      }
      if (newPass.length < 8) {
        setProfileMsg({ ok: false, text: 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.' });
        return;
      }
      if (newPass !== confirm) {
        setProfileMsg({ ok: false, text: 'كلمتا المرور غير متطابقتين.' });
        return;
      }
    }
    // الطلبان غير ذرّيّين: كلمة المرور قد تنجح ثم يفشل الملف (أو العكس)،
    // فنعكس النتيجة على الشاشة كما هي بدل حفظ محلي يفتح باب «نجح» كاذب.
    setSaving(true);
    try {
      if (wantsPw) await changeAdminPassword(current, newPass);
      const saved = await updateAdminProfile({ name: name.value, email: nextEmail, whatsapp: whatsapp.value });
      name.setValue(saved.name);
      email.setValue(saved.email);
      whatsapp.setValue(saved.whatsapp || '');
      setCurrent('');
      setNewPass('');
      setConfirm('');
      setProfileMsg({
        ok: true,
        text: wantsPw ? 'تم حفظ الملف الشخصي وتغيير كلمة المرور بنجاح.' : 'تم حفظ الملف الشخصي بنجاح.',
      });
    } catch (err) {
      setProfileMsg({ ok: false, text: err?.message || 'تعذّر حفظ البيانات.' });
    } finally {
      setSaving(false);
    }
  };

  const saveBooking = async (e) => {
    e.preventDefault();
    const rate = Number(commissionRate);
    const grace = Number(gracePeriod);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setBookingMsg({ ok: false, text: 'نسبة العمولة يجب أن تكون بين 0 و 100.' });
      return;
    }
    if (!Number.isFinite(grace) || grace < 0) {
      setBookingMsg({ ok: false, text: 'فترة الإلغاء يجب أن تكون رقماً موجباً.' });
      return;
    }
    // يُتحقَّق من العملة قبل رفع علم الانتظار، فلا يدخل النموذج حالة «يحفظ»
    // ثم يخرج منها في الرسالة التالية بلا طلب صادر أصلاً.
    if (!currency.trim()) {
      setBookingMsg({ ok: false, text: 'لم يرد الخادم بعملة المنصة، فلا يمكن حفظ الإعدادات (حقل إلزامي عند الخادم).' });
      return;
    }
    setSaving(true);
    try {
      // العقد §11.2: النسبة نسبة مئوية 0..100 كما تُدخل هنا، لا كسراً 0..1.
      // والعملة رُبعٌ إجباري في نفس الطلب — إغفالها كان يجعل الخادم يرفض
      // الحفظ كله بـ422 فتضيع تعديلات المستخدم.
      // بلا جلسة حيّة لا داعي لإرسال شيء: الحقول لم تُملأ أصلاً ولا يوجد خادم.
      if (isAdminApiLive()) {
        await saveSettings({
          commission_rate: rate,
          booking_grace_period_hours: grace,
          auto_approve_bookings: autoApprove,
          currency: currency.trim(),
        });
      }
      setBookingMsg({ ok: true, text: 'تم حفظ إعدادات الحجز والعمولة.' });
    } catch (err) {
      setBookingMsg({ ok: false, text: err?.message || 'تعذّر حفظ إعدادات الحجز.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dash__settings">
      <DataSourceBanner live={isAdminApiLive()} loading={settingsLoading} error={settingsError} onRetry={reload} />
      {settingsError && (
        <SettingsMsg ok={false}>
          تعذّر تحميل إعدادات المنصة من الخادم، فالحقول فارغة ولم يُحفظ شيء بعد.
        </SettingsMsg>
      )}
      {!settingsError && settingsLoading && (
        <SettingsMsg ok={true}>جارٍ تحميل إعدادات المنصة من الخادم…</SettingsMsg>
      )}

      {/* قسم 1: البيانات الشخصية وكلمة المرور */}
      <section className="dash__section">
        <div className="dash__section-head">
          <h2><UserCircle2 /> البيانات الشخصية وكلمة المرور</h2>
        </div>

        <div className="dash__profile-card">
          <div className="dash__profile-hero">
            {/* الصورة قابلة للنقر: تفتح منتقي الملفات. زر (لا div) ليعمل معها
                لوحة المفاتيح وقارئات الشاشة — والنص البديل داخل الطبقة يشرح
                ما يفعله النقر. */}
            <button
              type="button"
              className={`dash__photo-btn${showPhoto ? '' : ' is-empty'}`}
              onClick={() => fileRef.current && fileRef.current.click()}
              aria-label="تغيير صورة الملف الشخصي"
              aria-busy={uploading || undefined}
              disabled={uploading}
            >
              {showPhoto ? (
                <img
                  className="dash__photo"
                  src={photoSrc}
                  alt={profile.name || 'صورة الملف الشخصي'}
                  onError={() => setPhotoBroken(true)}
                />
              ) : (
                <div className="dash__photo dash__photo--initials">{initials}</div>
              )}
              <span className="dash__photo-overlay">
                <Camera />
                <span>{uploading ? 'جارٍ الرفع…' : 'تغيير الصورة'}</span>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePhotoChange}
            />
            <h3 className="dash__photo-name">{profile.name || 'مدير المنصة'}</h3>
            <p className="dash__photo-role">مدير المنصة</p>
          </div>

          <form className="dash__form dash__form--inside" onSubmit={saveProfile} noValidate>
            <div className="field">
              <label htmlFor="adm-name">الاسم الكامل</label>
              <input id="adm-name" type="text" value={name.value} onChange={name.onChange} placeholder="اسمك الكامل" dir="rtl" />
            </div>
            <div className="field">
              <label htmlFor="adm-email">البريد الإلكتروني</label>
              <input id="adm-email" type="email" dir="ltr" value={email.value} onChange={email.onChange} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label htmlFor="adm-whatsapp">
                <Phone style={{ width: '.9rem', height: '.9rem', verticalAlign: '-.1em' }} /> رقم واتساب الدعم
              </label>
              <input id="adm-whatsapp" type="tel" dir="ltr" value={whatsapp.value} onChange={whatsapp.onChange} placeholder="+970 59 000 0000" />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '1.2rem 0 1rem', paddingTop: '1rem' }}>
              <p style={{ margin: '0 0 .9rem', fontSize: '.82rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                تغيير كلمة المرور (اختياري)
              </p>
            </div>

            <div className="field">
              <label htmlFor="adm-pw-current">كلمة المرور الحالية</label>
              <input id="adm-pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="adm-pw-new">كلمة المرور الجديدة</label>
              <div className="dash__pw-wrap">
                <input
                  id="adm-pw-new"
                  type={showPw ? 'text' : 'password'}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
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
              <label htmlFor="adm-pw-confirm">تأكيد كلمة المرور الجديدة</label>
              <input
                id="adm-pw-confirm"
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="أعد إدخال كلمة المرور"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ الملف الشخصي'}
            </button>
          </form>

          <div style={{ marginTop: '1rem' }}>
            <SettingsMsg ok={profileMsg.ok}>{profileMsg.text}</SettingsMsg>
          </div>
        </div>
      </section>

      {/* قسم 2: إعدادات الحجز والعمولة */}
      <section className="dash__section">
        <div className="dash__section-head">
          <h2><Percent /> إعدادات الحجز والعمولة</h2>
        </div>

        <form className="dash__form" onSubmit={saveBooking} noValidate>
          <SettingsMsg ok={bookingMsg.ok}>{bookingMsg.text}</SettingsMsg>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="adm-commission">نسبة عمولة المنصة %</label>
              <input
                id="adm-commission"
                type="number"
                dir="ltr"
                min="0"
                max="100"
                step="0.5"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="adm-grace">فترة إلغاء الحجز (ساعات)</label>
              <input
                id="adm-grace"
                type="number"
                dir="ltr"
                min="0"
                step="1"
                value={gracePeriod}
                onChange={(e) => setGracePeriod(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <Toggle
              id="adm-auto-approve"
              label="تفعيل الموافقة التلقائية على الحجوزات"
              checked={autoApprove}
              onChange={setAutoApprove}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ إعدادات الحجز'}
          </button>
        </form>
      </section>
    </div>
  );
}