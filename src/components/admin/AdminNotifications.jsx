import { useState } from 'react';
import { Send, Megaphone, Users, Sparkles } from 'lucide-react';
import { adminNotifications } from '../../data/adminMockData';
import { SectionCard, SectionHeading, StatusBadge, EmptyState, Field, inputCls, btnPrimary } from './ui';
import useSafeInput from '../../hooks/useSafeInput';

const audiences = [
  { id: 'all', label: 'جميع المستخدمين' },
  { id: 'owners', label: 'مالكو المساحات فقط' },
  { id: 'freelancers', label: 'الفريلانسرز' },
  { id: 'specific', label: 'مستخدم محدد' },
];

const audienceBadge = {
  all: 'كل المستخدمين',
  owners: 'الملاك',
  freelancers: 'الفريلانسرز',
  specific: 'مستخدم محدد',
};

export default function AdminNotifications() {
  const [target, setTarget] = useState('all');
  const [specificEmail, setSpecificEmail] = useState('');
  const title = useSafeInput('', { maxLength: 120 });
  const body = useSafeInput('', { maxLength: 1000 });
  const [log, setLog] = useState(adminNotifications);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    setError('');
    setSent(false);

    if (target === 'specific') {
      const email = specificEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('أدخل بريداً إلكترونياً صحيحاً للمستخدم المستهدف.');
        return;
      }
    }
    if (!title.value.trim()) {
      setError('عنوان الإشعار مطلوب.');
      return;
    }
    if (!body.value.trim()) {
      setError('نص الإشعار مطلوب.');
      return;
    }

    setLog((prev) => [
      {
        id: Date.now(),
        title: title.value.trim(),
        body: body.value.trim(),
        target,
        sentAt: new Date().toLocaleString('ar-EG', {
          day: 'numeric',
          month: 'long',
          hour: 'numeric',
          minute: 'numeric',
        }),
        sentBy: 'admin',
      },
      ...prev,
    ]);
    if (target === 'specific') {
      title.setValue('');
      body.setValue('');
      setSpecificEmail('');
    } else {
      title.setValue('');
      body.setValue('');
    }
    setSent(true);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* نموذج الإرسال */}
      <SectionCard>
        <SectionHeading icon={Megaphone} title="إرسال إشعار جماعي" subtitle="بث رسالة لجمهور محدد عبر المنصة" />

        {sent && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm font-bold" role="status" style={{ background: 'rgba(34,197,94,.12)', color: '#15803d' }}>
            تم إرسال الإشعار بنجاح.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm font-bold" role="alert" style={{ background: 'rgba(239,68,68,.12)', color: '#b91c1c' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSend} noValidate>
          <Field label="الجمهور المستهدف" htmlFor="notif-target">
            <select
              id="notif-target"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setError('');
                setSent(false);
              }}
              className={inputCls}
            >
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

          {target === 'specific' && (
            <Field label="البريد الإلكتروني للمستخدم" htmlFor="notif-email">
              <input
                id="notif-email"
                type="email"
                dir="ltr"
                value={specificEmail}
                onChange={(e) => {
                  setSpecificEmail(e.target.value);
                  setError('');
                  setSent(false);
                }}
                placeholder="user@example.com"
                className={inputCls}
              />
            </Field>
          )}

          <Field label="عنوان الإشعار" htmlFor="notif-title">
            <input
              id="notif-title"
              type="text"
              value={title.value}
              onChange={(e) => {
                title.onChange(e);
                setError('');
                setSent(false);
              }}
              placeholder="مثال: صيانة مجدولة للنظام"
              className={inputCls}
            />
          </Field>

          <Field label="نص الإشعار" htmlFor="notif-body">
            <textarea
              id="notif-body"
              rows={4}
              value={body.value}
              onChange={(e) => {
                body.onChange(e);
                setError('');
                setSent(false);
              }}
              placeholder="اكتب محتوى الرسالة هنا…"
              className={`${inputCls} resize-none`}
            />
          </Field>

          <div className="flex justify-end">
            <button type="submit" className={btnPrimary}>
              <Send className="h-4 w-4" />
              إرسال الإشعار
            </button>
          </div>
        </form>
      </SectionCard>

      {/* سجل الإشعارات المرسلة */}
      <SectionCard>
        <SectionHeading icon={Sparkles} title="سجل الإشعارات المرسلة" subtitle="آخر الرسائل التي بثتها المنصة" />
        {log.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="لا توجد إشعارات مرسلة بعد"
            description="ستظهر هنا جميع الإشعارات الجماعية التي ترسلها للمستخدمين."
          />
        ) : (
          <ul className="max-h-[34rem] space-y-3 overflow-y-auto pe-1">
            {log.map((n) => (
              <li key={n.id} className="dash__card dash__card--flush">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2.5 text-sm font-extrabold" style={{ color: 'var(--text-strong)' }}>
                    <span className="st-ico" style={{ width: '2.2rem', height: '2.2rem', borderRadius: '.65rem' }}>
                      <Users />
                    </span>
                    {n.title}
                  </h4>
                  <StatusBadge tone="orange">{audienceBadge[n.target]}</StatusBadge>
                </div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{n.body}</p>
                <p className="txt-caption mt-2">{n.sentAt}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}