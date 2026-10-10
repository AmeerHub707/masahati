import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Megaphone, Users, Sparkles, Save, Search, MoreVertical, Copy, RotateCcw, Trash2, Bell, Mail, Link2, Eye } from 'lucide-react';
import { SectionCard, SectionHeading, StatusBadge, EmptyState, Field, inputCls, btnPrimary, btnGhost, Modal, DataSourceBanner, DataGate } from './ui';
import useSafeInput from '@/hooks/useSafeInput';
import useAdminData from './useAdminData';
import { sanitizeUrl } from '@/utils/sanitize';
import {
  listBroadcasts,
  getAudienceCounts,
  listBroadcastDrafts,
  sendBroadcast,
  saveBroadcastDraft,
  discardBroadcastDraft,
  resendBroadcast,
  isAdminTokenLive,
} from '@/lib/adminApi';

const audiences = [
  { id: 'all', label: 'جميع المستخدمين' },
  { id: 'owners', label: 'الملاك' },
  { id: 'freelancers', label: 'الفريلانسرز' },
];

const audienceBadge = {
  all: 'جميع المستخدمين',
  owners: 'الملاك',
  freelancers: 'الفريلانسرز',
};

const channelLabels = {
  in_app: 'داخل التطبيق',
  email: 'البريد الإلكتروني',
};

const NOTIF_TEMPLATES = {
  maintenance: {
    label: 'صيانة مجدولة',
    title: 'صيانة مجدولة للنظام',
    body: 'ستتوقف المنصة لفترة وجيزة لإجراء صيانة دورية. نعتذر عن أي إزعاج مسبقاً.',
  },
  policy: {
    label: 'تحديث سياسة',
    title: 'تحديث سياسة المنصة',
    body: 'يسرنا إعلامك أنه تم تحديث سياسة الاستخدام والاسترداد. يُرجى مراجعة التفاصيل الجديدة.',
  },
  announcement: {
    label: 'إعلان عن النظام',
    title: 'إعلان جديد من فريق مساحاتي',
    body: 'نعلن عن ميزة جديدة في المنصة نأمل أن تضيف قيمة لتجربتك. تابعوا آخر المستجدات.',
  },
};

// عدّاد معرّفات محلي للإشعارات التي تُضاف إلى السجلّ فوراً (قبل رد الخادم).
// متغيّر على مستوى الوحدة لا Date.now(): الأخير دالة غير نقية، وReact Compiler
// يمنع استدعاءها في كود المكوّن. العدّاد يكفي لتفادي تكرار المفتاح.
let localSeq = 0;
const nextLocalId = () => {
  localSeq += 1;
  return `local-${localSeq}`;
};
const nowISO = () => new Date().toISOString().slice(0, 10);
const nowArabic = () =>
  new Date().toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: 'numeric',
  });

function channelIcon(channel) {
  return channel === 'email' ? Mail : Bell;
}

// مكان فارغ للحالة الأولى: لا سجلّ ولا عدّادات حتى يردّ الخادم.
const NO_LOG = [];
const NO_COUNTS = { all: null, owners: null, freelancers: null };

export default function BroadcastNotifications() {
  const [target, setTarget] = useState('all');
  const title = useSafeInput('', { maxLength: 120 });
  const body = useSafeInput('', { maxLength: 1000 });
  const link = useSafeInput('', { maxLength: 300 });
  const [channels, setChannels] = useState({ in_app: true, email: false });
  const [template, setTemplate] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [log, setLog] = useState(NO_LOG);
  const [sent, setSent] = useState(false);
  const [logMsg, setLogMsg] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  // العقد §12.1 + §12.2 + §12.5: سجلّ الإرسال، عدّادات الجمهور، والمسودات —
  // ثلاثة مصادر في طلب واحد حتى لا تُرسم الشاشة بنصف أرقام.
  const fetchBroadcasts = useCallback(async () => {
    const [sentLog, counts, draftsList] = await Promise.all([
      listBroadcasts({}),
      getAudienceCounts(),
      listBroadcastDrafts(),
    ]);
    // لا استبدال بجدول محلي: ردّ فارغ يعني «لا بثّ بعد» لا «أرسلنا أربعة».
    return {
      log: Array.isArray(sentLog?.rows) ? sentLog.rows : [],
      counts: counts && typeof counts === 'object' ? counts : NO_COUNTS,
      drafts: Array.isArray(draftsList) ? draftsList : [],
    };
  }, []);

  const {
    data: remote,
    loading,
    error: loadError,
    live,
    reload,
  } = useAdminData(fetchBroadcasts);

  // السجلّ والمسودات يبدآن من الخادم عند وصوله. المقارنة بـ«آخر نسخة مطبَّقة»
  // تمنع تكرار setState في كل تصيير (كان يعيد رسم الجدول بلا داعٍ) وتكتفي مرة
  // واحدة عند كل تغيّر. النمط حالة لا مرجع: قراءة مرجع أثناء التصيير ممنوعة،
  // والمقارنة بـstate هي النمط الذي توثّقه React لضبط الحالة عند تغيّر مُدخل.
  const [appliedLog, setAppliedLog] = useState(null);
  const [appliedDrafts, setAppliedDrafts] = useState(null);
  const serverLog = remote?.log ?? null;
  const serverDrafts = remote?.drafts ?? null;
  if (remote && serverLog !== appliedLog) {
    setAppliedLog(serverLog);
    setLog(serverLog);
  }
  if (remote && serverDrafts !== appliedDrafts) {
    setAppliedDrafts(serverDrafts);
    setDrafts(serverDrafts);
  }

  // عدّادات الجمهور من الخادم فقط؛ الفارغ يعني «لم يردّ» ويُعرض «—».
  const audienceCounts = remote?.counts ?? NO_COUNTS;

  const [menu, setMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // فلاتر سجل الإرسال
  const [q, setQ] = useState('');
  const [fTarget, setFTarget] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (!e.target?.closest?.('[data-notif-menu]')) setMenu(null);
    };
    const onKey = (e) => e.key === 'Escape' && setMenu(null);
    // القائمة مثبّتة بـ position:fixed — تُغلق عند التمرير حتى لا تنفصل عن الصف.
    const onScroll = () => setMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [menu]);

  const filteredLog = useMemo(() => {
    const query = q.trim().toLowerCase();
    return log.filter((n) => {
      if (fTarget !== 'all' && n.target !== fTarget) return false;
      const d = (n.date || n.sentAt || '').slice(0, 10);
      if (fFrom && d < fFrom) return false;
      if (fTo && d > fTo) return false;
      if (query && !(n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query))) return false;
      return true;
    });
  }, [log, q, fTarget, fFrom, fTo]);

  const handleTemplateChange = (e) => {
    const key = e.target.value;
    setTemplate(key);
    if (key) {
      const tpl = NOTIF_TEMPLATES[key];
      title.setValue(tpl.title);
      body.setValue(tpl.body);
    }
  };

  const validate = () => {
    setError('');
    setSent(false);
    if (!title.value.trim()) {
      setError('عنوان الإشعار مطلوب.');
      return false;
    }
    if (!body.value.trim()) {
      setError('نص الإشعار مطلوب.');
      return false;
    }
    const rawLink = link.value.trim();
    if (rawLink && sanitizeUrl(rawLink) !== rawLink) {
      setError('رابط الإشعار غير صالح — استخدم رابطاً آمناً يبدأ بـ https:// أو مساراً داخلياً.');
      return false;
    }
    if (!channels.in_app && !channels.email) {
      setError('اختر قناة إرسال واحدة على الأقل.');
      return false;
    }
    return true;
  };

  const openConfirm = (e) => {
    e.preventDefault();
    if (validate()) setConfirm(true);
  };

  // العقد §12.3: الإرسال الفوري. السجلّ يُحدَّث محلياً فوراً (رحلة بريد
  // جماعي take وقتاً)، ثم يذهب للخادم؛ الفشل يزيل السجلّ المُضاف ويرفعه.
  const dispatchNow = () => {
    const entry = {
      id: nextLocalId(),
      title: title.value.trim(),
      body: body.value.trim(),
      target,
      link: link.value.trim(),
      channels: Object.keys(channels).filter((c) => channels[c]),
      sentAt: nowArabic(),
      date: nowISO(),
      sentBy: 'admin',
      opened: 0,
      total: recipients ?? 0,
    };
    setLog((prev) => [entry, ...prev]);
    setConfirm(false);
    title.setValue('');
    body.setValue('');
    link.setValue('');
    setTemplate('');
    setSent(true);
    setLogMsg('');

    if (!isAdminTokenLive()) {
      setLogMsg('تم الإرسال (وضع تجريبي — لم يُرسل شيء فعلياً).');
      return;
    }
    sendBroadcast({
      title: entry.title,
      body: entry.body,
      target: entry.target,
      link: entry.link,
      channels: entry.channels,
    })
      .then((saved) => {
        // نعتمد الأرقام التي أعادها الخادم (المعرّف الفعلي وحجم الجمهور
        // وقت الإرسال) بدل المُقدَّرة محلياً.
        setLog((prev) =>
          prev.map((n) =>
            n.id === entry.id
              ? { ...n, id: saved?.id ?? n.id, total: saved?.total ?? n.total, sentAt: saved?.sentAt ?? n.sentAt }
              : n
          )
        );
        setLogMsg(saved?.message || 'تم إرسال الإشعار بنجاح.');
      })
      .catch((err) => {
        setLog((prev) => prev.filter((n) => n.id !== entry.id));
        setSent(false);
        setLogMsg(err?.message || 'تعذّر إرسال الإشعار.');
      });
  };

  // العقد §12.6: المسودة تبقى على الخادم، لا في الذاكرة فقط — فكانت تضيع
  // بانتقال الصفحة. حقل واحد على الأقل من العنوان أو النص مطلوب.
  const saveDraft = () => {
    if (!title.value.trim() && !body.value.trim()) return;
    const draft = {
      title: title.value.trim(),
      body: body.value.trim(),
      target,
      link: link.value.trim(),
      channels: Object.keys(channels).filter((c) => channels[c]),
    };
    setDrafts((prev) => [{ id: prev.length ? Math.max(...prev.map((d) => d.id)) + 1 : 1, ...draft }, ...prev]);
    setSent(false);
    setLogMsg('تم حفظ الإشعار كمسودة.');
    if (isAdminTokenLive()) {
      saveBroadcastDraft(draft).catch((err) => setLogMsg(err?.message || 'تعذّر حفظ المسودة على الخادم.'));
    }
  };

  const loadDraft = (d) => {
    title.setValue(d.title);
    body.setValue(d.body);
    link.setValue(d.link);
    setTarget(d.target);
    setChannels({ in_app: d.channels.includes('in_app'), email: d.channels.includes('email') });
    setTemplate('');
    setDrafts((prev) => prev.filter((x) => x.id !== d.id));
    setLogMsg('تم تحميل المسودة في النموذج.');
    // العقد §12.7: المسودة المحمَّلة لم تعد في القائمة، فنخبر الخادم.
    if (isAdminTokenLive()) {
      discardBroadcastDraft(d.id).catch((err) => setLogMsg(err?.message || 'تعذّر تحديث المسودة على الخادم.'));
    }
  };

  const discardDraft = (id) => {
    setDrafts((prev) => prev.filter((x) => x.id !== id));
    if (isAdminTokenLive()) {
      discardBroadcastDraft(id).catch((err) => setLogMsg(err?.message || 'تعذّر حذف المسودة على الخادم.'));
    }
  };

  // العقد §12.2: عدّاد المستقبِلين حيّ ولا يُكتب يدوياً — تغييره من لوحة أخرى
  // كان يستلزم تحديث الكود. بلا ردّ من الخادم يبقى null (لا صفر)، والعرض
  // يتحوّل منه إلى «—» عند كل موضع.
  const recipients = Number.isFinite(audienceCounts[target]) ? audienceCounts[target] : null;
  // نصّ العرض: الرقم مفصول بالفواصل، أو «—» إن لم يرد.
  const recipientsText = recipients === null ? '—' : recipients.toLocaleString('en-US');

  const openRowMenu = (e, n) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = 160;
    const padding = 8;
    const gap = 6;
    const maxLeft = Math.max(padding, window.innerWidth - menuWidth - padding);
    const left = Math.min(maxLeft, Math.max(padding, r.left - menuWidth - gap));
    const below = r.bottom + gap;
    const above = r.top - menuHeight - gap;
    const maxTop = Math.max(padding, window.innerHeight - menuHeight - padding);
    const preferredTop = below + menuHeight <= window.innerHeight - padding ? below : above;
    const top = Math.min(maxTop, Math.max(padding, preferredTop));
    setMenu((current) => (current?.id === n.id ? null : { id: n.id, top, left }));
  };

  // العقد §12.4: إعادة الإرسال طلب حقيقي إلى الخادم (إعادة بثٍ سابق إلى جمهوره
  // الأصلي). نُدرج السطر محلياً أولاً ليكون الفحص فورياً، ثم نصحّح المعرّف
  // وحجم الجمهور من رد الخادم، ونُرجع الحالة السابقة إن رفض الخادم.
  const resend = () => {
    if (!menu) return;
    const n = log.find((x) => x.id === menu.id);
    if (!n) {
      setMenu(null);
      return;
    }
    const localId = nextLocalId();
    setLog((prev) => [
      {
        id: localId,
        title: n.title,
        body: n.body,
        target: n.target,
        link: n.link,
        channels: n.channels,
        sentAt: nowArabic(),
        date: nowISO(),
        sentBy: 'admin',
        opened: 0,
        total: audienceCounts[n.target] ?? n.total ?? 0,
      },
      ...prev,
    ]);
    setMenu(null);
    setLogMsg('تمت إعادة إرسال الإشعار بنجاح.');

    if (!isAdminTokenLive()) return;
    resendBroadcast(n.id, n.channels)
      .then((saved) => {
        setLog((prev) =>
          prev.map((row) =>
            row.id === localId
              ? { ...row, id: saved?.id ?? row.id, total: saved?.total ?? row.total }
              : row
          )
        );
        if (saved?.message) setLogMsg(saved.message);
      })
      .catch((err) => {
        // الخادم رفض ⇒ نُرجع الحالة السابقة بدل ترك سطر وهمي في السجل.
        setLog((prev) => prev.filter((row) => row.id !== localId));
        setLogMsg(err?.message || 'تعذّرت إعادة إرسال الإشعار.');
      });
  };

  const copyText = async () => {
    if (!menu) return;
    const n = log.find((x) => x.id === menu.id);
    if (!n) {
      setMenu(null);
      return;
    }
    const text = `${n.title}\n\n${n.body}${n.link ? `\n${n.link}` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setMenu(null);
    setLogMsg('تم نسخ نص الإشعار.');
  };

  const deleteFromLog = () => {
    if (!deleteTarget) return;
    setLog((prev) => prev.filter((x) => x.id !== deleteTarget));
    setDeleteTarget(null);
    setLogMsg('تم حذف الإشعار من السجل.');
  };

  const clearFilters = () => {
    setQ('');
    setFTarget('all');
    setFFrom('');
    setFTo('');
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
        {logMsg && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm font-bold" role="status" style={{ background: 'rgba(14,165,233,.12)', color: '#0369a1' }}>
            {logMsg}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm font-bold" role="alert" style={{ background: 'rgba(239,68,68,.12)', color: '#b91c1c' }}>
            {error}
          </div>
        )}

        <form onSubmit={openConfirm} noValidate>
          <Field label="الجمهور المستهدف" htmlFor="notif-target">
            <select
              id="notif-target"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setError('');
                setSent(false);
                setLogMsg('');
              }}
              className={inputCls}
            >
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              إجمالي المستلمين المتوقع: <b style={{ color: 'var(--accent)' }}>{recipientsText}</b> مستخدم
            </p>
          </Field>

          <Field label="قالب الإشعار" htmlFor="notif-template">
            <select
              id="notif-template"
              value={template}
              onChange={handleTemplateChange}
              className={inputCls}
            >
              <option value="">— قالب مخصص / لا شيء —</option>
              {Object.entries(NOTIF_TEMPLATES).map(([key, tpl]) => (
                <option key={key} value={key}>
                  {tpl.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="عنوان الإشعار" htmlFor="notif-title">
            <input
              id="notif-title"
              type="text"
              value={title.value}
              onChange={(e) => {
                title.onChange(e);
                setError('');
                setSent(false);
                setLogMsg('');
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
                setLogMsg('');
              }}
              placeholder="اكتب محتوى الرسالة هنا…"
              className={`${inputCls} resize-none`}
            />
          </Field>

          <Field label="رابط / رابط إجراء (اختياري)" htmlFor="notif-link">
            <div className="relative">
              <Link2 className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                id="notif-link"
                type="url"
                dir="ltr"
                value={link.value}
                onChange={(e) => {
                  link.onChange(e);
                  setError('');
                  setSent(false);
                }}
                placeholder="https://example.com/page"
                className={`${inputCls} dash__input--icon`}
              />
            </div>
          </Field>

          <Field label="قنوات الإرسال">
            <div className="flex flex-wrap gap-3">
              {Object.keys(channelLabels).map((c) => {
                const Icon = channelIcon(c);
                const activeCh = channels[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setChannels((prev) => ({ ...prev, [c]: !prev[c] }));
                      setError('');
                      setSent(false);
                    }}
                    aria-pressed={activeCh}
                    className={`dash__toolbtn${activeCh ? ' is-active' : ''}`}
                  >
                    <Icon className="h-4 w-4" />
                    {channelLabels[c]}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button type="button" className={btnGhost} onClick={saveDraft}>
              <Save className="h-4 w-4" />
              حفظ كمسودة
            </button>
            <button type="submit" className={btnPrimary}>
              <Send className="h-4 w-4" />
              إرسال الإشعار
            </button>
          </div>
        </form>

        {/* المسودات المحفوظة */}
        {drafts.length > 0 && (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold" style={{ color: 'var(--text-strong)' }}>
              <Save className="h-4 w-4" />
              المسودات المحفوظة ({drafts.length})
            </h4>
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: 'rgba(249,115,22,.07)' }}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold" style={{ color: 'var(--text-strong)' }}>{d.title}</p>
                    <p className="txt-caption truncate">{d.body}</p>
                  </div>
                  <div className="flex flex-none items-center gap-1">
                    <button type="button" className="dash__btn-soft is-sky" onClick={() => loadDraft(d)}>
                      <RotateCcw className="h-4 w-4" />
                      تحميل
                    </button>
                    <button type="button" className="dash__iconbtn is-red" aria-label="حذف المسودة" onClick={() => discardDraft(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      {/* سجل الإشعارات المرسلة */}
      <SectionCard>
        <SectionHeading icon={Sparkles} title="سجل الإشعارات المرسلة" subtitle="آخر الرسائل التي بثتها المنصة" />
        <DataSourceBanner live={live} loading={loading} error={loadError} onRetry={reload} />

        {/* لا سجلّ قبل ردّ الخادم: «لا إشعارات» كانت جواباً كاذباً قبل أن يرد. */}
        {!remote && (
          <DataGate live={live} loading={loading} error={loadError} onRetry={reload} rows={3} errorTitle="تعذّر جلب سجل الإشعارات" />
        )}

        {/* فلاتر السجل */}
        <div className="mb-4 space-y-3">
          {/* Row 1: Search Input (Full Width) */}
          <div className="relative">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بعنوان الإشعار أو المحتوى..."
              className={`${inputCls} dash__input--icon w-full transition-all duration-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
            />
          </div>

          {/* Row 2: Target Audience Dropdown (Full Width) */}
          <select
            className={`${inputCls} w-full transition-all duration-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
            value={fTarget}
            onChange={(e) => setFTarget(e.target.value)}
          >
            <option value="all">جميع الجماهير المستهدفة</option>
            <option value="owners">الملاك</option>
            <option value="freelancers">الفريلانسرز</option>
          </select>

          {/* Row 3: Date Range Grid (Side-by-Side 2-Column Grid) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="date-from" className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-gray-400">
                من تاريخ
              </label>
              <input
                id="date-from"
                type="date"
                className={`${inputCls} w-full transition-all duration-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
                value={fFrom}
                onChange={(e) => setFFrom(e.target.value)}
                aria-label="من تاريخ"
              />
            </div>
            <div>
              <label htmlFor="date-to" className="mb-1.5 block text-xs font-bold text-gray-600 dark:text-gray-400">
                إلى تاريخ
              </label>
              <input
                id="date-to"
                type="date"
                className={`${inputCls} w-full transition-all duration-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
                value={fTo}
                onChange={(e) => setFTo(e.target.value)}
                aria-label="إلى تاريخ"
              />
            </div>
          </div>
        </div>

        {(q || fTarget !== 'all' || fFrom || fTo) && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 dark:border-orange-500/20 dark:bg-orange-500/10">
            <span className="text-sm font-bold text-orange-700 dark:text-orange-400">
              <b className="text-lg">{filteredLog.length}</b> نتيجة مطابقة
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-orange-700 transition-all duration-200 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-500/20"
              onClick={clearFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              إعادة الضبط
            </button>
          </div>
        )}

        {!remote ? null : filteredLog.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="لا توجد إشعارات مطابقة"
            description="كل نتائج الفلتر؛ جرّب تعديل البحث أو إعادة الضبط لرؤية الإشعارات المرسلة."
          />
        ) : (
          <ul className="max-h-[46rem] space-y-3 overflow-y-auto pe-1">
            {filteredLog.map((n) => {
              const ChannelIcons = n.channels?.map(channelIcon) || [];
              return (
                <li key={n.id} className="dash__card dash__card--flush group transition-all duration-300 hover:scale-[1.01] hover:shadow-md hover:border-orange-200 dark:hover:border-orange-500/40" data-notif-menu>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex min-w-0 items-center gap-2.5 text-sm font-extrabold" style={{ color: 'var(--text-strong)' }}>
                      <span className="st-ico group-hover:scale-110 transition-transform duration-300" style={{ width: '2.2rem', height: '2.2rem', borderRadius: '.65rem' }}>
                        <Users />
                      </span>
                      <span className="truncate">{n.title}</span>
                    </h4>
                    <div className="flex flex-none items-center gap-2">
                      <span className="badge badge--green transition-all duration-200 group-hover:shadow-sm">
                        <Eye className="h-3.5 w-3.5" />
                        {n.opened}/{n.total}
                      </span>
                      <StatusBadge tone="orange">{audienceBadge[n.target] || 'غير محدد'}</StatusBadge>
                      <div className="dash__actions-cell" data-notif-menu>
                        <button
                          type="button"
                          className="dash__menu-btn transition-all duration-200 hover:scale-110"
                          aria-label="خيارات الإشعار"
                          onClick={(e) => openRowMenu(e, n)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{n.body}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="txt-caption">{n.sentAt}</span>
                    <span className="flex items-center gap-2">
                      {ChannelIcons.map((Icon, i) => (
                        <span key={i} className="badge badge--blue transition-all duration-200 hover:scale-105" title={`قناة: ${channelLabels[n.channels[i]]}`}>
                          <Icon />
                        </span>
                      ))}
                      {n.link && (
                        <span className="badge badge--gray transition-all duration-200 hover:scale-105" title={n.link}>
                          <Link2 />
                          رابط
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* قائمة الخيارات (ثلاث نقاط) — AnimatePresence داخل البوابة لأن Framer Motion
          يتجاهل عناصر createPortal كأبناء فلا تظهر القائمة. */}
      {menu &&
        createPortal(
          <AnimatePresence>
            <motion.div
              key="notif-row-menu"
              className="dash__menu dash__menu--fixed"
              data-notif-menu
              role="menu"
              aria-label="خيارات الإشعار"
              style={{ top: menu.top, left: menu.left }}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              <button type="button" role="menuitem" onClick={resend}>
                <RotateCcw className="h-4 w-4" />
                إعادة الإرسال
              </button>
              <button type="button" role="menuitem" onClick={copyText}>
                <Copy className="h-4 w-4" />
                نسخ النص
              </button>
              <button type="button" role="menuitem" className="is-danger" onClick={() => { setDeleteTarget(menu.id); setMenu(null); }}>
                <Trash2 className="h-4 w-4" />
                حذف من السجل
              </button>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* نافذة تأكيد الإرسال */}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="تأكيد إرسال الإشعار" wide>
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            سيتم إرسال الإشعار الجماعي التالي:
          </p>
          <div className="dash__soft">
            <p className="mb-1 text-sm font-extrabold" style={{ color: 'var(--text-strong)' }}>{title.value}</p>
            <p className="m-0 text-sm">{body.value}</p>
            {link.value && (
              <p className="mt-2 break-all text-xs" dir="ltr" style={{ color: 'var(--accent)' }}>{link.value}</p>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            <li className="dash__mini is-orange">
              <span className="lbl">الجمهور المستهدف</span>
              <span className="val">{audienceBadge[target] || 'غير محدد'}</span>
            </li>
            <li className="dash__mini is-green">
              <span className="lbl">إجمالي المستلمين</span>
              <span className="val">{recipientsText}</span>
            </li>
            <li className="dash__mini is-sky col-span-2">
              <span className="lbl">قنوات الإرسال</span>
              <span className="val">{Object.keys(channels).filter((c) => channels[c]).map((c) => channelLabels[c]).join(' · ')}</span>
            </li>
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setConfirm(false)}>
              إلغاء
            </button>
            <button type="button" className={btnPrimary} onClick={dispatchNow}>
              <Send className="h-4 w-4" />
              تأكيد وإرسال ({recipientsText})
            </button>
          </div>
        </div>
      </Modal>

      {/* تأكيد الحذف من السجل */}
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="حذف الإشعار من السجل؟">
        <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          سيتم إزالة هذا الإشعار من السجل، ولن يظهر في قائمة الإشعارات المرسلة.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={() => setDeleteTarget(null)}>
            إلغاء
          </button>
          <button type="button" className="btn-danger" onClick={deleteFromLog}>
            <Trash2 className="h-4 w-4" />
            نعم، احذف
          </button>
        </div>
      </Modal>
    </div>
  );
}