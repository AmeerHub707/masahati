import { useState } from 'react';
import {
  UserCircle2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Percent,
  Phone,
} from 'lucide-react';
import useSafeInput from '../../hooks/useSafeInput';
import { getAdminProfile, updateAdminProfile, changeAdminPassword } from '../../lib/adminAuth';
import { adminStats } from '../../data/adminMockData';

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
  const [profile, setProfile] = useState(() => getAdminProfile() || {});
  const initials = (profile.name || 'م').trim().slice(0, 2) || 'م';

  // Section 1: البيانات الشخصية وكلمة المرور
  const name = useSafeInput(profile.name || '', { maxLength: 60 });
  const email = useSafeInput(profile.email || '', { maxLength: 120 });
  const whatsapp = useSafeInput(profile.whatsapp || '', { maxLength: 20 });
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ ok: false, text: '' });

  // Section 2: إعدادات الحجز والعمولة
  const [commissionRate, setCommissionRate] = useState(() =>
    Math.round((adminStats.platformCommission ?? 0.12) * 100)
  );
  const [gracePeriod, setGracePeriod] = useState(24);
  const [autoApprove, setAutoApprove] = useState(false);
  const [bookingMsg, setBookingMsg] = useState({ ok: false, text: '' });

  const saveProfile = (e) => {
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
    try {
      if (wantsPw) changeAdminPassword(current, newPass);
      const saved = updateAdminProfile({ name: name.value, email: nextEmail, whatsapp: whatsapp.value });
      setProfile(saved);
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
    }
  };

  const saveBooking = (e) => {
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
    setBookingMsg({ ok: true, text: 'تم حفظ إعدادات الحجز والعمولة.' });
  };

  return (
    <div className="dash__settings">
      {/* قسم 1: البيانات الشخصية وكلمة المرور */}
      <section className="dash__section">
        <div className="dash__section-head">
          <h2><UserCircle2 /> البيانات الشخصية وكلمة المرور</h2>
        </div>

        <div className="dash__profile-card">
          <div className="dash__profile-hero">
            <div className="dash__photo dash__photo--initials">{initials}</div>
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
            <button type="submit" className="btn-primary">
              حفظ الملف الشخصي
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
          <button type="submit" className="btn-primary">
            حفظ إعدادات الحجز
          </button>
        </form>
      </section>
    </div>
  );
}