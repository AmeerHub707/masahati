import { useState } from 'react';
import {
  UserCircle2,
  Settings2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Percent,
  Phone,
} from 'lucide-react';
import useSafeInput from '../../hooks/useSafeInput';
import { getAdminProfile } from '../../lib/adminAuth';

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
  const profile = getAdminProfile();
  const initials = (profile?.name || 'م').trim().slice(0, 2) || 'م';

  // وضع الصيانة
  const [maintenance, setMaintenance] = useState(false);
  const [maintMsg, setMaintMsg] = useState({ ok: false, text: '' });

  // Section 1: البيانات الشخصية وكلمة المرور
  const name = useSafeInput(profile?.name || '', { maxLength: 60 });
  const email = useSafeInput(profile?.email || '', { maxLength: 120 });
  const whatsapp = useSafeInput('', { maxLength: 20 });
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ ok: false, text: '' });

  // Section 2: إعدادات البريد والدعم SMTP
  const supportEmail = useSafeInput('support@masahati.com', { maxLength: 120 });
  const mailerHost = useSafeInput('mail.masahati.com', { maxLength: 120 });
  const mailerPort = useSafeInput('587', { maxLength: 6 });
  const mailerUser = useSafeInput('no-reply@masahati.com', { maxLength: 120 });
  const [mailMsg, setMailMsg] = useState({ ok: false, text: '' });

  // Section 3: إعدادات الحجز والعمولة
  const [commissionRate, setCommissionRate] = useState(10);
  const [gracePeriod, setGracePeriod] = useState(24);
  const [autoApprove, setAutoApprove] = useState(false);
  const [bookingMsg, setBookingMsg] = useState({ ok: false, text: '' });

  const toggleMaintenance = (val) => {
    setMaintenance(val);
    setMaintMsg({ ok: true, text: val ? 'تم تفعيل وضع الصيانة.' : 'تم إيقاف وضع الصيانة.' });
  };

  const saveProfile = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
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
      setCurrent('');
      setNewPass('');
      setConfirm('');
    }
    setProfileMsg({
      ok: true,
      text: wantsPw ? 'تم حفظ الملف الشخصي وتغيير كلمة المرور بنجاح.' : 'تم حفظ الملف الشخصي بنجاح.',
    });
  };

  const saveMailer = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.value.trim())) {
      setMailMsg({ ok: false, text: 'بريد دعم المنصة غير صحيح.' });
      return;
    }
    setMailMsg({ ok: true, text: 'تم تحديث إعدادات البريد والدعم.' });
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
      {/* شريط علوي: وضع الصيانة */}
      <section className="dash__section">
        <div className="dash__section-head">
          <h2><Wrench /> وضع الصيانة</h2>
        </div>
        <div
          className="dash__form"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '.95rem', fontWeight: 800, color: 'var(--text-strong)' }}>
              إيقاف النظام مؤقتاً
            </p>
            <p style={{ margin: '.15rem 0 0', fontSize: '.8rem', color: 'var(--text-muted)' }}>
              يمنع المستخدمين من إجراء حجوزات جديدة حتى يُعاد التفعيل.
            </p>
          </div>
          <Toggle id="adm-maintenance" checked={maintenance} onChange={toggleMaintenance} />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <SettingsMsg ok={maintMsg.ok}>{maintMsg.text}</SettingsMsg>
        </div>
      </section>

      {/* قسم 1: البيانات الشخصية وكلمة المرور */}
      <section className="dash__section">
        <div className="dash__section-head">
          <h2><UserCircle2 /> البيانات الشخصية وكلمة المرور</h2>
        </div>

        <div className="dash__profile-card">
          <div className="dash__profile-hero">
            <div className="dash__photo dash__photo--initials">{initials}</div>
            <h3 className="dash__photo-name">{profile?.name || 'مدير المنصة'}</h3>
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

      {/* قسم 2: إعدادات البريد والدعم SMTP */}
      <section className="dash__section">
        <div className="dash__section-head">
          <h2><Settings2 /> إعدادات البريد والدعم SMTP</h2>
        </div>

        <form className="dash__form" onSubmit={saveMailer} noValidate>
          <SettingsMsg ok={mailMsg.ok}>{mailMsg.text}</SettingsMsg>
          <div className="field">
            <label htmlFor="adm-support">بريد دعم المنصة</label>
            <input id="adm-support" type="email" dir="ltr" value={supportEmail.value} onChange={supportEmail.onChange} placeholder="support@masahati.com" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="adm-host">خادم البريد (SMTP)</label>
              <input id="adm-host" type="text" dir="ltr" value={mailerHost.value} onChange={mailerHost.onChange} />
            </div>
            <div className="field">
              <label htmlFor="adm-port">المنفذ</label>
              <input id="adm-port" type="text" dir="ltr" value={mailerPort.value} onChange={mailerPort.onChange} placeholder="587" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="adm-user">اسم المستخدم / المرسل</label>
            <input id="adm-user" type="text" dir="ltr" value={mailerUser.value} onChange={mailerUser.onChange} />
          </div>
          <button type="submit" className="btn-primary">
            حفظ إعدادات البريد
          </button>
        </form>
      </section>

      {/* قسم 3: إعدادات الحجز والعمولة */}
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