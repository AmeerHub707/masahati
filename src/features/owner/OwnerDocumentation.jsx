import { useEffect, useRef, useState } from 'react';
import {
  Building2, FileText, Award, FileUp, CheckCircle2, AlertCircle, Upload, X, Clock, ShieldCheck,
} from 'lucide-react';
import {
  DOC_STATUS,
  isDocsLocked,
  loadOwnerDocumentsWithFallback,
  submitOwnerDocumentsWithFallback,
  readOwnerDocuments,
} from '@/lib/owner';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
const MAX_SIZE = 10 * 1024 * 1024;

const DOC_TYPES = [
  { id: 'assets', label: 'مستندات ملكية المساحة أو عقد الإيجار', hint: 'صورة أو PDF واضح لصك الملكية أو عقد الإيجار باسمك.', icon: FileText },
  { id: 'cert', label: 'شهادة مهنية أو رخصة مزاولة', hint: 'شهادة تخصصك أو رخصة مزاولة المهنة إن وجدت.', icon: Award },
];

const STATUS_META = {
  [DOC_STATUS.NONE]: { label: 'لم تُرسل', cls: 'badge--muted', Icon: AlertCircle },
  [DOC_STATUS.PENDING]: { label: 'قيد المراجعة', cls: 'badge--pending', Icon: Clock },
  [DOC_STATUS.APPROVED]: { label: 'معتمدة', cls: 'badge--confirmed', Icon: ShieldCheck },
  [DOC_STATUS.REJECTED]: { label: 'مرفوضة', cls: 'badge--cancelled', Icon: AlertCircle },
};

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${bytes} ب`;
}

export default function OwnerDocumentation({ onNavigate }) {
  const fileRef = useRef(null);
  const mountedRef = useRef(true);
  const [doc, setDoc] = useState(readOwnerDocuments);
  const [draft, setDraft] = useState({}); // الملفات المختارة قبل الإرسال (كائنات File في الذاكرة)
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const locked = isDocsLocked(doc);
  const status = doc.status || DOC_STATUS.NONE;
  const meta = STATUS_META[status] || STATUS_META[DOC_STATUS.NONE];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // جلب آخر حالة من الخادم (مع بقاء النسخة المحلية فوراً على الشاشة).
  useEffect(() => {
    let alive = true;
    loadOwnerDocumentsWithFallback()
      .then((result) => {
        if (!alive || !mountedRef.current) return;
        setDoc(result.doc);
        setDraft({});
      })
      .catch(() => {
        /* نبقي النسخة المحلية */
      })
      .finally(() => {
        if (alive && mountedRef.current) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handlePick = (id) => {
    if (locked) return;
    setMsg({ type: '', text: '' });
    setActiveId(id);
    fileRef.current && fileRef.current.click();
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !activeId || locked) return;

    const isImage = Boolean(file.type && file.type.startsWith('image/'));
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isImage && !isPdf) {
      setMsg({ type: 'err', text: 'يرجى اختيار ملف صورة (PNG، JPG، WEBP) أو ملف PDF.' });
      return;
    }
    if (file.size > MAX_SIZE) {
      setMsg({ type: 'err', text: 'حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت.' });
      return;
    }

    setDraft((prev) => ({ ...prev, [activeId]: file }));
    setMsg({ type: 'ok', text: 'تم اختيار المستند — لن يُرسل حتى تضغط «إرسال الوثائق».' });
  };

  const removeDoc = (id) => {
    if (locked) return;
    setDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMsg({ type: '', text: '' });
  };

  // الملف المعروض: ما اختير للتو (draft) أو ما مُسجَّل من قبل (doc.files).
  const shownFile = (id) => {
    const f = draft[id];
    if (f) return { name: f.name, size: f.size, type: f.type || 'file' };
    return doc.files?.[id] || null;
  };

  // يجمع ما اختُير الآن مع ما بقي محفوظاً (بعد الرفض يمكن الإبقاء على ملف وإعادة الآخر).
  const buildEntries = () => {
    const out = {};
    for (const t of DOC_TYPES) {
      const f = draft[t.id];
      if (f) out[t.id] = { name: f.name, size: f.size, type: f.type || 'file', file: f };
      else if (doc.files?.[t.id]) out[t.id] = doc.files[t.id];
    }
    return out;
  };

  const uploadedCount = DOC_TYPES.filter((t) => shownFile(t.id)).length;
  const readyToSubmit = uploadedCount === DOC_TYPES.length && !locked && !submitting;

  const handleSubmit = async () => {
    if (!readyToSubmit) return;
    setSubmitting(true);
    setMsg({ type: '', text: '' });
    try {
      const result = await submitOwnerDocumentsWithFallback(buildEntries());
      if (!mountedRef.current) return;
      setDoc(result.doc);
      setDraft({});
      setMsg({
        type: result.locked ? 'warn' : 'ok',
        text: result.message,
      });
    } catch {
      if (mountedRef.current) setMsg({ type: 'err', text: 'تعذّر إرسال الوثائق. حاول مجدداً.' });
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <section className="dash__section dash__docs-owner">
      <div className="dash__section-head">
        <h2><Building2 /> وثائق استكمال حسابك</h2>
      </div>

      <div className="dash__docs">
        <div className="dash__docs-head">
          <span className={`badge ${meta.cls}`} role="status">
            <meta.Icon /> {meta.label}
          </span>
          {loading && <span className="dash__docs-sync">جارٍ مزامنة الحالة…</span>}
        </div>

        <p className="dash__docs-intro">
          لإتمام إضافة مساحاتك، أرفق أصول الملكية (أو عقد الإيجار) وشهادة مهنية مرة واحدة فقط.
          ترفع الوثائق مرة واحدة، ثم تراجعها الإدارة فتعتمدها أو ترفضها — وبعد الاعتماد فقط يمكنك إضافة مساحاتك.
        </p>

        <div className="dash__docs-list">
          {DOC_TYPES.map((t) => {
            const file = shownFile(t.id);
            return (
              <div key={t.id} className={`dash__docs-row${file ? ' has-file' : ''}${locked ? ' is-locked' : ''}`}>
                <span className="dash__docs-ico"><t.icon /></span>
                <div className="dash__docs-body">
                  <b>{t.label}</b>
                  <p>{t.hint}</p>
                  {file ? (
                    <span className="dash__docs-file" title={file.name}>
                      <FileUp /> {file.name} <em>{formatSize(file.size)}</em>
                    </span>
                  ) : null}
                </div>
                {!locked && (
                  <div className="dash__docs-actions">
                    {file ? (
                      <>
                        <button
                          type="button"
                          className="dash__docs-rm"
                          onClick={() => removeDoc(t.id)}
                          aria-label="إزالة المستند"
                        >
                          <X />
                        </button>
                        <span className="dash__docs-done"><CheckCircle2 /> مختار</span>
                      </>
                    ) : (
                      <button type="button" className="dash__docs-btn" onClick={() => handlePick(t.id)}>
                        <Upload /> رفع
                      </button>
                    )}
                  </div>
                )}
                {locked && file && (
                  <div className="dash__docs-actions">
                    <span className="dash__docs-done"><CheckCircle2 /> مُرسل</span>
                  </div>
                )}
                {locked && !file && (
                  <div className="dash__docs-actions">
                    <span className="dash__docs-missing"><AlertCircle /> ناقص</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={handleFile} />

        {msg.text && (
          <div className={`dash__docs-msg is-${msg.type}`} role={msg.type === 'err' ? 'alert' : 'status'}>
            {msg.type === 'ok' ? <CheckCircle2 /> : msg.type === 'warn' ? <Clock /> : <AlertCircle />}
            <span>{msg.text}</span>
          </div>
        )}

        {status === DOC_STATUS.APPROVED && (
          <div className="dash__docs-msg is-ok dash__docs-submitted" role="status">
            <CheckCircle2 />
            <span>تم اعتماد وثائقك — يمكنك الآن إضافة مساحاتك وعرضها للعملاء.</span>
          </div>
        )}

        {status === DOC_STATUS.PENDING && (
          <div className="dash__docs-msg is-pending" role="status">
            <Clock />
            <span>
              وثائقك قيد المراجعة لدى الإدارة. الرفع مقفل حتى صدور القرار،
              وسيُفتح إضافة المساحات فور الاعتماد.
              {doc.submittedAt ? ` (أُرسلت في ${doc.submittedAt})` : ''}
            </span>
          </div>
        )}

        {status === DOC_STATUS.REJECTED && (
          <div className="dash__docs-msg is-err" role="alert">
            <AlertCircle />
            <span>
              رُفضت وثائقك{doc.note ? ` — ${doc.note}` : ''}. عدّل الملفات وأعد الإرسال للمراجعة.
            </span>
          </div>
        )}

        {!locked && status !== DOC_STATUS.APPROVED && (
          <div className="dash__docs-cta">
            <button type="button" className="btn-primary" disabled={!readyToSubmit} onClick={handleSubmit}>
              {submitting ? <Clock className="spin" /> : <CheckCircle2 />}
              {submitting ? 'جارٍ الإرسال…' : `إرسال الوثائق للمراجعة (${uploadedCount}/${DOC_TYPES.length})`}
            </button>
            <button type="button" className="btn-ghost" onClick={() => onNavigate?.('my-spaces')}>
              عرض مساحاتي
            </button>
          </div>
        )}

        {status === DOC_STATUS.APPROVED && (
          <div className="dash__docs-cta">
            <button type="button" className="btn-primary" onClick={() => onNavigate?.('spaces')}>
              <Upload /> أضف مساحتك الأولى
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
