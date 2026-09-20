import { useState } from 'react';
import { User, Mail, Server, KeyRound, Trash2, PauseCircle, Camera, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { adminProfile } from '../../lib/adminMock';
import { Card, SectionHeader, Field, inputClass, PrimaryButton, Modal } from './ui';

export default function AdminSettings() {
  // البيانات الشخصية
  const [name, setName] = useState(adminProfile.name);
  const [email, setEmail] = useState(adminProfile.email);

  // الدعم والبريد
  const [supportEmail, setSupportEmail] = useState(adminProfile.supportEmail);
  const [mailer, setMailer] = useState(adminProfile.mailer);
  const [mailerHost, setMailerHost] = useState(adminProfile.mailerHost);
  const [mailerPort, setMailerPort] = useState(adminProfile.mailerPort);
  const [mailerUsername, setMailerUsername] = useState(adminProfile.mailerUsername);
  const [mailerEncryption, setMailerEncryption] = useState(adminProfile.mailerEncryption);

  // كلمة المرور
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [msg, setMsg] = useState('');
  const [confirmDanger, setConfirmDanger] = useState(null); // 'delete' | 'pause'

  const saveInfo = (e) => {
    e.preventDefault();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg('err▶الاسم مطلوب والبريد الإلكتروني غير صحيح.');
      return;
    }
    setMsg('ok▶تم حفظ بيانات المدير بنجاح.');
  };

  const saveMailer = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
      setMsg('err▶بريد الدعم غير صحيح.');
      return;
    }
    setMsg('ok▶تم حفظ إعدادات البريد النظام.');
  };

  const savePassword = (e) => {
    e.preventDefault();
    if (!current) {
      setMsg('err▶أدخل كلمة المرور الحالية.');
      return;
    }
    if (next.length < 8) {
      setMsg('err▶كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
      return;
    }
    if (next !== confirm) {
      setMsg('err▶كلمتا المرور غير متطابقتين.');
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    setMsg('ok▶تم تغيير كلمة المرور بنجاح.');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {msg && (
        <div
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-semibold ${
            msg.startsWith('err▶')
              ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
              : 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
          }`}
          role={msg.startsWith('err▶') ? 'alert' : 'status'}
        >
          {msg.startsWith('err▶') ? <AlertCircle className="mt-0.5 h-4 w-4 flex-none" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />}
          <span>{msg.replace(/^(err|ok)▶/, '')}</span>
        </div>
      )}

      {/* البيانات الشخصية */}
      <Card>
        <SectionHeader icon={User} title="بيانات المدير الشخصية" />
        <div className="mb-5 flex flex-col items-center gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-orange-400 to-orange-600 text-2xl font-extrabold text-white shadow-lg shadow-orange-500/30">
              {adminProfile.name.slice(0, 2)}
            </span>
            <span className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-orange-500 text-white shadow-md dark:border-gray-800">
              <Camera className="h-4 w-4" />
            </span>
          </div>
          <div className="text-center sm:text-start">
            <h3 className="m-0 text-base font-extrabold text-zinc-900 dark:text-gray-100">{name}</h3>
            <p className="m-0 text-xs text-gray-500 dark:text-gray-400">{adminProfile.role}</p>
          </div>
        </div>

        <form onSubmit={saveInfo}>
          <Field label="الاسم الكامل">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={60} />
          </Field>
          <Field label="البريد الإلكتروني">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} dir="ltr" />
          </Field>
          <div className="flex justify-end">
            <PrimaryButton type="submit">حفظ البيانات</PrimaryButton>
          </div>
        </form>
      </Card>

      {/* البريد النظامي */}
      <Card>
        <SectionHeader icon={Mail} title="بريد الدعم وإعدادات النظام" />
        <form onSubmit={saveMailer}>
          <Field label="بريد الدعم (يظهر للمستخدمين)">
            <input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className={inputClass} dir="ltr" />
          </Field>
          <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
            <Field label="نظام الإرسال (Mailer)">
              <select value={mailer} onChange={(e) => setMailer(e.target.value)} className={inputClass}>
                <option value="SMTP">SMTP</option>
                <option value="MAILGUN">Mailgun</option>
                <option value="SENDMAIL">Sendmail</option>
              </select>
            </Field>
            <Field label="التشفير">
              <select value={mailerEncryption} onChange={(e) => setMailerEncryption(e.target.value)} className={inputClass}>
                <option value="TLS">TLS</option>
                <option value="SSL">SSL</option>
                <option value="none">بدون تشفير</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
            <Field label="الخادم (Host)">
              <input type="text" value={mailerHost} onChange={(e) => setMailerHost(e.target.value)} className={inputClass} dir="ltr" />
            </Field>
            <Field label="المنفذ (Port)">
              <input type="text" value={mailerPort} onChange={(e) => setMailerPort(e.target.value)} className={inputClass} dir="ltr" />
            </Field>
          </div>
          <Field label="اسم المستخدم">
            <input type="text" value={mailerUsername} onChange={(e) => setMailerUsername(e.target.value)} className={inputClass} dir="ltr" />
          </Field>
          <div className="flex justify-end">
            <PrimaryButton type="submit">
              <Server className="h-4 w-4" />
              حفظ الإعدادات
            </PrimaryButton>
          </div>
        </form>
      </Card>

      {/* تغيير كلمة المرور */}
      <Card>
        <SectionHeader icon={KeyRound} title="تغيير كلمة المرور" />
        <form onSubmit={savePassword}>
          <Field label="كلمة المرور الحالية">
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} autoComplete="current-password" />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
            <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل">
              <input type={showPw ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} autoComplete="new-password" />
            </Field>
            <Field label="تأكيد كلمة المرور الجديدة">
              <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
            </Field>
          </div>
          <div className="flex justify-end">
            <PrimaryButton type="submit">تغيير كلمة المرور</PrimaryButton>
          </div>
        </form>
      </Card>

      {/* منطقة الخطر */}
      <Card className="border-2! border-red-200! dark:border-red-900!">
        <SectionHeader icon={Trash2} title="منطقة الخطر" />
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-red-50/60 p-4 dark:bg-red-500/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-xs font-extrabold text-red-700 dark:text-red-400">حذف حساب المدير نهائياً</h3>
                <p className="m-0 mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  إزالة حساب المدير وكل الصلاحيات المرتبطة به، ولا يمكن التراجع.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDanger('delete')}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-red-500/30 transition hover:bg-red-600"
              >
                <Trash2 className="h-4 w-4" />
                حذف الحساب
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-red-50/60 p-4 dark:bg-red-500/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="m-0 text-xs font-extrabold text-red-700 dark:text-red-400">إيقاف النظام مؤقتاً</h3>
                <p className="m-0 mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  تعليق عمل المنصة مؤقتاً بحيث يتعذر حجز مساحات جديدة حتى إعادة التشغيل.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDanger('pause')}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-red-200 bg-white px-4 py-2.5 text-xs font-extrabold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <PauseCircle className="h-4 w-4" />
                إيقاف النظام
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Modal open={!!confirmDanger} onClose={() => setConfirmDanger(null)} title={confirmDanger === 'delete' ? 'حذف حساب المدير' : 'إيقاف النظام مؤقتاً'}>
        <p className="m-0 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {confirmDanger === 'delete'
            ? 'هل أنت متأكد من حذف حساب المدير نهائياً؟ ستفقد كل الصلاحيات ولن يمكنك التراجع.'
            : 'هل تريد فعلاً إيقاف عمل المنصة مؤقتاً؟ لن يتمكن المستخدمون من إجراء حجوزات جديدة.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmDanger(null)}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            إلغاء
          </button>
          <PrimaryButton
            onClick={() => setConfirmDanger(null)}
            className={confirmDanger === 'delete' ? 'bg-red-500! shadow-red-500/25! hover:bg-red-600!' : 'bg-amber-500! shadow-amber-500/25! hover:bg-amber-600!'}
          >
            {confirmDanger === 'delete' ? 'نعم، احذف' : 'نعم، أوقف النظام'}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}