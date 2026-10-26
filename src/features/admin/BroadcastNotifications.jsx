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
  { id: 'customers', label: 'جميع العملاء' },
  { id: 'owners', label: 'الملاك' },
  { id: 'freelancers', label: 'الفريلانسرز' },
];

const audienceBadge = {
  all: 'جميع المستخدمين',
  customers: 'جميع العملاء',
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

// وقت الإرسال كما يصل من الخادم (ISO أو "YYYY-MM-DD HH:mm:ss") بنفس صيغة العرض
// العربية. القيمة غير القابلة للتحليل تُعاد كما هي بدل اختلاق وقت.
function arabicStamp(value) {
  if (!value) return nowArabic();
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: 'numeric',
  });
}

// قنوات الخادم قد تصل مصفوفة أو نصاً مفصولاً بفواصل أو كائناً { email: true }.
// نوحّدها إلى مصفوفة لأن العرض والعدّ يعتمدان على `includes`.
function normalizeChannels(value) {
  if (Array.isArray(value)) return value.filter((c) => typeof c === 'string' && c.trim());
  if (typeof value === 'string') return value.split(',').map((c) => c.trim()).filter(Boolean);
  if (value && typeof value === 'object') return Object.keys(value).filter((k) => value[k]);
  return [];
}

/**
 * توحيد صفّ سجل البث: الخادم قد يرسل camelCase كما في العقد أو snake_case
 * (sent_at, recipients_count) كما هو شائع في Laravel. بلا هذا التوحيد كان
 * `n.title.toLowerCase()` يرمي عند صفّ بلا عنوان، وكان التاريخ يظهر فارغاً.
 */
function normalizeBroadcastRow(row) {
  if (!row || typeof row !== 'object') return null;
  const total = Number(row.total ?? row.recipients_count ?? row.recipients ?? 0);
  const opened = Number(row.opened ?? row.opened_count ?? row.opens ?? 0);
  const rawDate = row.sentAt ?? row.sent_at ?? row.created_at ?? row.date ?? '';
  return {
    id: row.id ?? nextLocalId(),
    title: String(row.title ?? row.subject ?? ''),
    body: String(row.body ?? row.message ?? row.content ?? ''),
    target: row.target ?? row.audience ?? 'all',
    link: row.link ?? row.url ?? '',
    channels: normalizeChannels(row.channels),
    sentAt: row.sentAt ?? arabicStamp(rawDate),
    date: String(row.date ?? rawDate).slice(0, 10),
    sentBy: row.sentBy ?? row.sent_by ?? 'admin',
    opened: Number.isFinite(opened) ? opened : 0,
    total: Number.isFinite(total) ? total : 0,
  };
}

// عدّادات الجمهور قد تصل مباشرة (`{all, customers}`) أو داخل مغلّف
// (`{counts: {...}}` / `{audiences: {...}}`) وبأسماء مفاتيح مختلفة بين
// `customers`/`customer` و`owners`/`space_owners`. التوحيد هنا يمنع أن يظهر
// «—» أمام جمهور الخادم يعرف عدده، ويمنع أيضاً تعطيل تنبيه «العدّاد صفر».
function normalizeCounts(raw) {
  const src =
    raw && typeof raw === 'object'
      ? raw.counts && typeof raw.counts === 'object'
        ? raw.counts
        : raw.audiences && typeof raw.audiences === 'object'
          ? raw.audiences
          : raw
      : {};
  const num = (...keys) => {
    for (const key of keys) {
      const value = src[key];
      if (value === null || value === undefined || value === '') continue;
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };
  return {
    all: num('all', 'total', 'all_users'),
    customers: num('customers', 'customer', 'customers_count'),
    owners: num('owners', 'space_owners', 'owner', 'space_owner', 'owners_count'),
    freelancers: num('freelancers', 'freelancer', 'freelancers_count'),
  };
}

// مكان فارغ للحالة الأولى: لا سجلّ ولا عدّادات حتى يردّ الخادم.
const NO_LOG = [];
const NO_COUNTS = { all: null, customers: null, owners: null, freelancers: null };

function channelIcon(channel) {
  return channel === 'email' ? Mail : Bell;
}

export default function BroadcastNotifications() {
  const [target, setTarget] = useState('all');
  const title = useSafeInput('', { maxLength: 120 });
  const body = useSafeInput('', { maxLength: 1000 });
  const link = useSafeInput('', { maxLength: 300 });
  const [channels, setChannels] = useState({ in_app: true, email: false });
  const [template, setTemplate] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [log, setLog] = useState(NO_LOG);
  // رسالة واحدة للحالة: نجاح (أخضر)، جارٍ العمل (أزرق)، خطأ (أحمر).
  // الفصل بين «تم الإرسال» و«تعذّر الإرسال» مقصود: الواجهة السابقة كانت
  // تعرض الفشل برسالة زرقاء ودّية بعد أن تمسح النموذج، فيظنّ المشرف أن البث
  // وصل بينما لم يُرسل شيء.
  const [feedback, setFeedback] = useState(null);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // آخر استجابة من الخادم (نجاحاً أو فشلاً) لعرضها في لوحة تشخيص قابلة للطي.
  // الغرض: التمييز بين «قُبل الطلب» و«حُفظ فعلاً لمستلمين». لا توكن ولا كلمة
  // مرور في الاستجابة، فآمنة للنسخ عند طلب الدعم.
  const [lastResponse, setLastResponse] = useState(null);

  const notify = (tone, text) => setFeedback(text ? { tone, text } : null);

  // العقد §12.1 + §12.2 + §12.5: سجلّ الإرسال، عدّادات الجمهور، والمسودات —
  // ثلاثة مصادر في طلب واحد حتى لا تُرسم الشاشة بنصف أرقام.
  const fetchBroadcasts = useCallback(async () => {
    const [sentLog, counts, draftsList] = await Promise.all([
      listBroadcasts({}),
      getAudienceCounts(),
      listBroadcastDrafts(),
    ]);
    // لا استبدال بجدول محلي: ردّ فارغ يعني «لا بثّ بعد» لا «أرسلنا أربعة».
    const draftList = Array.isArray(draftsList)
      ? draftsList
      : Array.isArray(draftsList?.drafts)
        ? draftsList.drafts
        : [];
    return {
      log: Array.isArray(sentLog?.rows) ? sentLog.rows.map(normalizeBroadcastRow).filter(Boolean) : [],
      counts: normalizeCounts(counts),
      drafts: draftList,
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
    setFeedback(null);
    if (!title.value.trim()) {
      notify('error', 'عنوان الإشعار مطلوب.');
      return false;
    }
    if (!body.value.trim()) {
      notify('error', 'نص الإشعار مطلوب.');
      return false;
    }
    const rawLink = link.value.trim();
    if (rawLink && sanitizeUrl(rawLink) !== rawLink) {
      notify('error', 'رابط الإشعار غير صالح — استخدم رابطاً آمناً يبدأ بـ https:// أو مساراً داخلياً.');
      return false;
    }
    if (!channels.in_app && !channels.email) {
      notify('error', 'اختر قناة إرسال واحدة على الأقل.');
      return false;
    }
    // عدّاد معروف وصفر ⇒ لا أحد ليستلم. نمنع الطلب بدل إظهار «نجاح» فارغ.
    const selectedCount = Number.isFinite(audienceCounts[target]) ? audienceCounts[target] : null;
    if (selectedCount === 0) {
      notify('error', 'عدد مستلمي هذا الجمهور صفر حسب عدّاد الخادم — لن يصل الإشعار لأي حساب.');
      return false;
    }
    return true;
  };

  const openConfirm = (e) => {
    e.preventDefault();
    if (validate()) setConfirm(true);
  };

  // العقد §12.3: الإرسال الفوري.
  //
  // كان السجلّ يُضاف والنموذج يُفرَّغ **قبل** ردّ الخادم، فإن فشل الإرسال
  // (422/401/شبكة) ضاع ما كتبه المشرف وبقي سطر وهمي ثم اختفى. الآن:
  //   - النموذج يبقى كما هو حتى يؤكّد الخادم استلام الطلب.
  //   - لا سطر في السجلّ إلا بعد نجاح الطلب.
  //   - الفشل يظهر بالأحمر بنصّ الخادم، فيعرف المشرف أن البريد لم يُرسل.
  const dispatchNow = async () => {
    if (sending) return;
    const payload = {
      title: title.value.trim(),
      body: body.value.trim(),
      target,
      link: link.value.trim(),
      channels: Object.keys(channels).filter((c) => channels[c]),
    };
    setConfirm(false);

    if (!isAdminTokenLive()) {
      notify('error', 'لا توجد جلسة مشرف صالحة. سجّل الدخول من جديد قبل الإرسال.');
      return;
    }

    setSending(true);
    notify('info', 'جارٍ إرسال الإشعار… قد يستغرق البريد الجماعي بعض الوقت.');
    setLastResponse(null);
    try {
      const saved = await sendBroadcast(payload);
      setLastResponse({ ok: true, request: payload, response: saved });
      const serverRow = saved && typeof saved === 'object' ? saved : {};
      const entry = normalizeBroadcastRow({
        ...payload,
        ...serverRow,
        title: serverRow.title ?? payload.title,
        body: serverRow.body ?? payload.body,
        target: serverRow.target ?? serverRow.audience ?? payload.target,
        link: serverRow.link ?? payload.link,
        channels: serverRow.channels ?? payload.channels,
        total: serverRow.total ?? serverRow.recipients_count ?? audienceCounts[target] ?? 0,
        sentAt: serverRow.sentAt ?? serverRow.sent_at ?? undefined,
      }) ?? {
        ...payload,
        id: nextLocalId(),
        sentAt: nowArabic(),
        date: nowISO(),
        opened: 0,
        total: audienceCounts[target] ?? 0,
      };

      setLog((prev) => [entry, ...prev]);
      title.setValue('');
      body.setValue('');
      link.setValue('');
      setTemplate('');
      notify('ok', saved?.message || 'تم إرسال الإشعار وقبِله الخادم.');

      // ردّ 2xx يعني «قُبل الطلب» فقط، لا «وصل لشخص». نقرأ السجلّ من الخادم
      // ونتأكد من الصفّ المسجّل: كم مستلماً حُسب، وأي قنوات حُفظت فعلاً.
      // بهذا يظهر على الشاشة سبب عدم الوصول بدل رسالة خضراء مطمئنة كاذبة.
      try {
        const sentLog = await listBroadcasts({});
        const rawRows = Array.isArray(sentLog?.rows) ? sentLog.rows : [];
        const raw = rawRows.find((r) => String(r?.id) === String(entry.id)) ?? null;
        if (raw) {
          const recorded = normalizeBroadcastRow(raw);
          if (recorded) setLog((prev) => prev.map((r) => (r.id === entry.id ? recorded : r)));

          const rawTotal = raw.total ?? raw.recipients_count ?? raw.recipients;
          const totalKnown =
            rawTotal !== undefined && rawTotal !== null && rawTotal !== '' && Number.isFinite(Number(rawTotal));
          const recordedTotal = totalKnown ? Number(rawTotal) : null;
          const missEmail =
            payload.channels.includes('email') &&
            recorded.channels.length > 0 &&
            !recorded.channels.includes('email');

          if (totalKnown && recordedTotal === 0) {
            notify(
              'error',
              'قبل الخادم الطلب (2xx) لكن عدد المستلمين المسجّل 0 — لم يصل الإشعار لأي حساب. راجع قيمة الجمهور المستهدف في الباك إند.'
            );
          } else if (missEmail) {
            notify(
              'error',
              `حُفظ الإشعار لكن دون قناة البريد (القنوات المسجّلة: ${recorded.channels
                .map((c) => channelLabels[c] || c)
                .join(' · ')}) — الباك إند لم يعتمد email.`
            );
          } else if (recordedTotal !== null) {
            const ch = recorded.channels.length
              ? ` · القنوات: ${recorded.channels.map((c) => channelLabels[c] || c).join(' · ')}`
              : '';
            notify('ok', `${saved?.message || 'تم الإرسال.'} المستلمون: ${recordedTotal.toLocaleString('en-US')}${ch}`);
          }
        }
      } catch {
        /* التحقق اختياري: تعثّره لا يحوّل نجاح الخادم إلى خطأ */
      }
    } catch (err) {
      setLastResponse({
        ok: false,
        status: err?.status ?? null,
        message: err?.message ?? '',
        data: err?.data ?? null,
      });
      notify('error', err?.message || 'تعذّر إرسال الإشعار — لم يُرسل شيء.');
    } finally {
      setSending(false);
    }
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
    notify('info', 'تم حفظ الإشعار كمسودة.');
    if (isAdminTokenLive()) {
      saveBroadcastDraft(draft).catch((err) => notify('error', err?.message || 'تعذّر حفظ المسودة على الخادم.'));
    }
  };

  const loadDraft = (d) => {
    title.setValue(d.title);
    body.setValue(d.body);
    link.setValue(d.link);
    setTarget(d.target);
    const draftChannels = normalizeChannels(d.channels);
    setChannels({ in_app: draftChannels.includes('in_app'), email: draftChannels.includes('email') });
    setTemplate('');
    setDrafts((prev) => prev.filter((x) => x.id !== d.id));
    notify('info', 'تم تحميل المسودة في النموذج.');
    // العقد §12.7: المسودة المحمَّلة لم تعد في القائمة، فنخبر الخادم.
    if (isAdminTokenLive()) {
      discardBroadcastDraft(d.id).catch((err) => notify('error', err?.message || 'تعذّر تحديث المسودة على الخادم.'));
    }
  };

  const discardDraft = (id) => {
    setDrafts((prev) => prev.filter((x) => x.id !== id));
    if (isAdminTokenLive()) {
      discardBroadcastDraft(id).catch((err) => notify('error', err?.message || 'تعذّر حذف المسودة على الخادم.'));
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
  // الأصلي). لا نضيف سطراً للسجل قبل موافقة الخادم: السطر الوهمي الذي يُحذف
  // بعد ثانية كان يجعل المشرف يظن أن البريد خرج.
  const resend = async () => {
    if (!menu || sending) return;
    const n = log.find((x) => x.id === menu.id);
    setMenu(null);
    if (!n) return;
    if (!isAdminTokenLive()) {
      notify('error', 'لا توجد جلسة مشرف صالحة. سجّل الدخول من جديد قبل إعادة الإرسال.');
      return;
    }
    setSending(true);
    notify('info', 'جارٍ إعادة إرسال الإشعار…');
    try {
      const saved = await resendBroadcast(n.id, n.channels);
      const serverRow = saved && typeof saved === 'object' ? saved : {};
      const row = normalizeBroadcastRow({
        ...n,
        ...serverRow,
        id: serverRow.id ?? n.id,
        title: serverRow.title ?? n.title,
        body: serverRow.body ?? n.body,
        target: serverRow.target ?? serverRow.audience ?? n.target,
        link: serverRow.link ?? n.link,
        channels: serverRow.channels ?? n.channels,
        total: serverRow.total ?? serverRow.recipients_count ?? audienceCounts[n.target] ?? n.total ?? 0,
      });
      if (row) setLog((prev) => [row, ...prev]);
      notify('ok', serverRow.message || 'تمت إعادة إرسال الإشعار.');
    } catch (err) {
      notify('error', err?.message || 'تعذّرت إعادة إرسال الإشعار.');
    } finally {
      setSending(false);
    }
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
    notify('info', 'تم نسخ نص الإشعار.');
  };

  const deleteFromLog = () => {
    if (!deleteTarget) return;
    setLog((prev) => prev.filter((x) => x.id !== deleteTarget));
    setDeleteTarget(null);
    notify('info', 'تم حذف الإشعار من السجل.');
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

        {feedback && (
          <div
            className="mb-4 rounded-xl px-4 py-3 text-sm font-bold"
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            style={
              feedback.tone === 'error'
                ? { background: 'rgba(239,68,68,.12)', color: '#b91c1c' }
                : feedback.tone === 'ok'
                  ? { background: 'rgba(34,197,94,.12)', color: '#15803d' }
                  : { background: 'rgba(14,165,233,.12)', color: '#0369a1' }
            }
          >
            {feedback.text}
          </div>
        )}

        {lastResponse && (
          <details className="mb-4 rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(15,23,42,.05)' }}>
            <summary className="cursor-pointer font-extrabold" style={{ color: 'var(--text-strong)' }}>
              تفاصيل استجابة الخادم (للتشخيص)
            </summary>
            <pre
              dir="ltr"
              className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </details>
        )}

        <form onSubmit={openConfirm} noValidate>
          <Field label="الجمهور المستهدف" htmlFor="notif-target">
            <select
              id="notif-target"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setFeedback(null);
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
                setFeedback(null);
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
                setFeedback(null);
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
                  setFeedback(null);
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
                      setFeedback(null);
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
            {channels.email && (
              <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                البريد يُرسل إلى العنوان المسجّل في كل حساب مستلم. الحساب بلا بريد إلكتروني
                لا يصله شيء — راجع عمود البريد في تبويب «المستخدمون» قبل البث.
              </p>
            )}
            {channels.email && recipients === 0 && (
              <p className="mt-1.5 text-xs font-bold" style={{ color: '#b45309' }} role="alert">
                عدّاد هذا الجمهور صفر: لن يصل بريد إلى أي حساب.
              </p>
            )}
          </Field>

          <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button type="button" className={btnGhost} onClick={saveDraft} disabled={sending}>
              <Save className="h-4 w-4" />
              حفظ كمسودة
            </button>
            <button type="submit" className={btnPrimary} disabled={sending}>
              <Send className="h-4 w-4" />
              {sending ? 'جارٍ الإرسال…' : 'إرسال الإشعار'}
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
            <option value="customers">جميع العملاء</option>
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
            <button type="button" className={btnPrimary} onClick={dispatchNow} disabled={sending}>
              <Send className="h-4 w-4" />
              {sending ? 'جارٍ الإرسال…' : `تأكيد وإرسال (${recipientsText})`}
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