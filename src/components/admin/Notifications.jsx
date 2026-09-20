import { useState } from 'react';
import { Send, BellRing, Users, Building2, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { sentNotifications as initialSent, users } from '../../lib/adminMock';
import { Card, SectionHeader, Field, inputClass, PrimaryButton, Badge } from './ui';

const AUDIENCES = [
  { id: 'all', label: 'كل المستخدمين', icon: Users },
  { id: 'owners', label: 'الملاك فقط', icon: Building2 },
  { id: 'specific', label: 'مستخدم محدد', icon: User },
];

const AUDIENCE_BADGE = {
  all: { label: 'كل المستخدمين', tone: 'orange' },
  owners: { label: 'الملاك فقط', tone: 'blue' },
  specific: { label: 'مستخدم محدد', tone: 'green' },
};

export default function AdminNotifications() {
  const [audience, setAudience] = useState('all');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(initialSent);
  const [feedback, setFeedback] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFeedback('err▶برجاء إدخال عنوان ورسالة الإشعار.');
      return;
    }
    if (audience === 'specific' && !targetId) {
      setFeedback('err▶اختر المستخدم المستهدف من القائمة.');
      return;
    }
    const entry = {
      id: Date.now(),
      audience,
      title: title.trim(),
      message: message.trim(),
      sentAt: new Date().toLocaleString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    setSent((prev) => [entry, ...prev]);
    setTitle('');
    setMessage('');
    setTargetId('');
    setFeedback('ok▶تم إرسال الإشعار بنجاح.');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* نموذج البث */}
      <Card>
        <SectionHeader icon={BellRing} title="إرسال إشعار جماعي" />
        {feedback && (
          <div
            className={`mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
              feedback.startsWith('err▶')
                ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                : 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
            }`}
            role={feedback.startsWith('err▶') ? 'alert' : 'status'}
          >
            {feedback.startsWith('err▶') ? <AlertCircle className="mt-0.5 h-4 w-4 flex-none" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />}
            <span>{feedback.replace(/^(err|ok)▶/, '')}</span>
          </div>
        )}

        <form onSubmit={handleSend}>
          <Field label="الفئة المستهدفة">
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAudience(a.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                      audience === a.id
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {audience === 'specific' && (
            <Field label="اختر المستخدم" hint="اكتب اسم المستخدم للانتقال المباشر">
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputClass}>
                <option value="">— اختر مستخدماً —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="عنوان الإشعار">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: عرض خاص بداية الموسم"
              className={inputClass}
              maxLength={80}
            />
          </Field>

          <Field label="نص الإشعار">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="اكتب نص الرسالة التي ستصل للمستهدفين…"
              className={`${inputClass} min-h-28 resize-y`}
              maxLength={500}
            />
          </Field>

          <div className="flex justify-end">
            <PrimaryButton type="submit">
              <Send className="h-4 w-4" />
              إرسال الإشعار
            </PrimaryButton>
          </div>
        </form>
      </Card>

      {/* سجل الإشعارات المرسلة */}
      <Card className="p-0! overflow-hidden">
        <div className="p-5">
          <SectionHeader icon={BellRing} title="سجل الإشعارات المرسلة" />
        </div>
        {sent.length === 0 ? (
          <div className="p-5 text-center text-sm text-gray-400">لا توجد إشعارات مرسلة بعد.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {sent.map((n) => {
              const meta = AUDIENCE_BADGE[n.audience] || AUDIENCE_BADGE.all;
              return (
                <li key={n.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-xs text-gray-400" dir="ltr">{n.sentAt}</span>
                  </div>
                  <h3 className="m-0 mt-2 text-xs font-extrabold text-zinc-900 dark:text-gray-100">{n.title}</h3>
                  <p className="m-0 mt-1 text-xs leading-6 text-gray-500 dark:text-gray-400">{n.message}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}