import { useState } from 'react';
import {
  UserCircle2,
  Settings2,
  KeyRound,
  Trash2,
  PauseCircle,
  AlertTriangle,
  Mail,
  AtSign,
  Server,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SectionCard, SectionHeading, Field, inputCls, btnPrimary, btnDanger } from './ui';
import useSafeInput from '../../hooks/useSafeInput';
import { getAdminProfile } from '../../lib/adminAuth';

function InfoNote({ ok, children }) {
  if (!children) return null;
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className="mb-4 rounded-xl px-4 py-3 text-sm font-bold"
      style={
        ok
          ? { background: 'rgba(34,197,94,.12)', color: '#15803d' }
          : { background: 'rgba(239,68,68,.12)', color: '#b91c1c' }
      }
    >
      {children}
    </div>
  );
}

export default function AdminSettings() {
  const profile = getAdminProfile();

  // البيانات الشخصية
  const name = useSafeInput(profile?.name || '', { maxLength: 60 });
  const email = useSafeInput(profile?.email || '', { maxLength: 120 });
  const [profileMsg, setProfileMsg] = useState({ ok: false, text: '' });

  // إعدادات المنصة والبريد
  const supportEmail = useSafeInput('support@masahati.com', { maxLength: 120 });
  const mailerHost = useSafeInput('mail.masahati.com', { maxLength: 120 });
  const mailerPort = useSafeInput('587', { maxLength: 6 });
  const mailerUser = useSafeInput('no-reply@masahati.com', { maxLength: 120 });
  const [mailMsg, setMailMsg] = useState({ ok: false, text: '' });

  // كلمة المرور
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState({ ok: false, text: '' });

  const saveProfile = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      setProfileMsg({ ok: false, text: 'البريد الإلكتروني غير صحيح.' });
      return;
    }
    setProfileMsg({ ok: true, text: 'تم حفظ البيانات الشخصية بنجاح.' });
  };

  const saveMailer = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail.value.trim())) {
      setMailMsg({ ok: false, text: 'بريد دعم المنصة غير صحيح.' });
      return;
    }
    setMailMsg({ ok: true, text: 'تم تحديث إعدادات النظام والبريد.' });
  };

  const savePassword = (e) => {
    e.preventDefault();
    if (!current) {
      setPwMsg({ ok: false, text: 'أدخل كلمة المرور الحالية.' });
      return;
    }
    if (newPass.length < 8) {
      setPwMsg({ ok: false, text: 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.' });
      return;
    }
    if (newPass !== confirm) {
      setPwMsg({ ok: false, text: 'كلمتا المرور غير متطابقتين.' });
      return;
    }
    setCurrent('');
    setNewPass('');
    setConfirm('');
    setPwMsg({ ok: true, text: 'تم تغيير كلمة المرور بنجاح.' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* البيانات الشخصية */}
        <SectionCard>
          <SectionHeading icon={UserCircle2} title="البيانات الشخصية" subtitle="معلومات حساب المشرف" />
          <InfoNote ok={profileMsg.ok}>{profileMsg.text}</InfoNote>
          <form onSubmit={saveProfile} noValidate>
            <Field label="الاسم الكامل" htmlFor="adm-name">
              <input id="adm-name" type="text" value={name.value} onChange={name.onChange} className={inputCls} placeholder="اسمك الكامل" />
            </Field>
            <Field label="البريد الإلكتروني" htmlFor="adm-email">
              <input id="adm-email" type="email" dir="ltr" value={email.value} onChange={email.onChange} className={inputCls} placeholder="you@example.com" />
            </Field>
            <div className="flex justify-end">
              <button type="submit" className={btnPrimary}>
                حفظ البيانات
              </button>
            </div>
          </form>
        </SectionCard>

        {/* إعدادات النظام والبريد */}
        <SectionCard>
          <SectionHeading icon={Settings2} title="إعدادات النظام" subtitle="بريد الدعم وإعدادات خادم البريد" />
          <InfoNote ok={mailMsg.ok}>{mailMsg.text}</InfoNote>
          <form onSubmit={saveMailer} noValidate>
            <Field label="بريد دعم المنصة" htmlFor="adm-support">
              <div className="relative">
                <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input id="adm-support" type="email" dir="ltr" value={supportEmail.value} onChange={supportEmail.onChange} className="dash__input dash__input--icon" placeholder="support@masahati.com" />
              </div>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="خادم البريد (SMTP)" htmlFor="adm-host">
                <div className="relative">
                  <Server className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input id="adm-host" type="text" dir="ltr" value={mailerHost.value} onChange={mailerHost.onChange} className="dash__input dash__input--icon" />
                </div>
              </Field>
              <Field label="المنفذ" htmlFor="adm-port">
                <input id="adm-port" type="text" dir="ltr" value={mailerPort.value} onChange={mailerPort.onChange} className={inputCls} />
              </Field>
            </div>
            <Field label="اسم المستخدم / المرسل" htmlFor="adm-user">
              <div className="relative">
                <AtSign className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input id="adm-user" type="text" dir="ltr" value={mailerUser.value} onChange={mailerUser.onChange} className="dash__input dash__input--icon" />
              </div>
            </Field>
            <div className="flex justify-end">
              <button type="submit" className={btnPrimary}>
                حفظ الإعدادات
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      {/* تغيير كلمة المرور */}
      <SectionCard>
        <SectionHeading icon={KeyRound} title="تغيير كلمة المرور" subtitle="حافظ على أمان حساب المشرف" />
        <InfoNote ok={pwMsg.ok}>{pwMsg.text}</InfoNote>
        <form onSubmit={savePassword} noValidate className="max-w-lg">
          <Field label="كلمة المرور الحالية" htmlFor="adm-pw-current">
            <input id="adm-pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} placeholder="••••••••" autoComplete="current-password" />
          </Field>
          <Field label="كلمة المرور الجديدة" htmlFor="adm-pw-new">
            <div className="relative">
              <input id="adm-pw-new" type={showPw ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)} className="dash__input dash__input--pw" placeholder="٨ أحرف على الأقل" autoComplete="new-password" />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center"
                style={{ color: 'var(--text-muted)' }}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="تأكيد كلمة المرور الجديدة" htmlFor="adm-pw-confirm">
            <input id="adm-pw-confirm" type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} placeholder="أعد إدخال كلمة المرور" autoComplete="new-password" />
          </Field>
          <div className="flex justify-end">
            <button type="submit" className={btnPrimary}>
              <KeyRound className="h-4 w-4" />
              تغيير كلمة المرور
            </button>
          </div>
        </form>
      </SectionCard>

      {/* منطقة الخطر */}
      <SectionCard className="border-red-200! shadow-none! dark:border-red-900!">
        <div className="mb-4 flex items-center gap-3">
          <span className="st-ico st-ico--red">
            <AlertTriangle />
          </span>
          <div>
            <h3 className="text-lg font-extrabold text-red-600 dark:text-red-400">منطقة الخطر</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>إجراءات خطيرة لا يمكن التراجع عنها بسهولة</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-red-200 p-4 dark:border-red-900" style={{ background: 'rgba(239,68,68,.06)' }}>
            <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              إيقاف النظام مؤقتاً يمنع المستخدمين من إجراء حجوزات جديدة حتى يُعاد التفعيل.
            </p>
            <button type="button" className={btnDanger}>
              <PauseCircle className="h-4 w-4" />
              إيقاف النظام مؤقتاً
            </button>
          </div>
          <div className="rounded-2xl border border-red-200 p-4 dark:border-red-900" style={{ background: 'rgba(239,68,68,.06)' }}>
            <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              حذف حساب المشرف نهائياً يزيل الصلاحيات ويوقف الجلسة الحالية. لن يمكنك التراجع.
            </p>
            <button type="button" className={btnDanger}>
              <Trash2 className="h-4 w-4" />
              حذف الحساب
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}