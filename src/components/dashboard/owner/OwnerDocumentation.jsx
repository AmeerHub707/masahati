import { useRef, useState } from 'react';
import { Building2, FileText, Award, FileUp, CheckCircle2, AlertCircle, Upload, X } from 'lucide-react';

const DOCS_STORAGE_KEY = 'masahati.owner-docs';
const DOCS_SENT_KEY = 'masahati.owner-docs-sent';
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
const MAX_SIZE = 10 * 1024 * 1024;

const DOC_TYPES = [
  { id: 'assets', label: 'مستندات ملكية المساحة أو عقد الإيجار', hint: 'صورة أو PDF واضح لصك الملكية أو عقد الإيجار باسمك.', icon: FileText },
  { id: 'cert', label: 'شهادة مهنية أو رخصة مزاولة', hint: 'شهادة تخصصك أو رخصة مزاولة المهنة إن وجدت.', icon: Award },
];

function readStoredDocs() {
  try {
    const raw = localStorage.getItem(DOCS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readSubmitted() {
  try {
    return localStorage.getItem(DOCS_SENT_KEY) === '1';
  } catch {
    return false;
  }
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${bytes} ب`;
}

export default function OwnerDocumentation({ onNavigate }) {
  const fileRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [docs, setDocs] = useState(readStoredDocs);
  const [submitted, setSubmitted] = useState(readSubmitted);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const persist = (next) => {
    setDocs(next);
    try {
      localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* التخزين غير متاح */
    }
  };

  const handlePick = (id) => {
    setMsg({ type: '', text: '' });
    setActiveId(id);
    fileRef.current && fileRef.current.click();
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !activeId) return;

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

    persist({ ...docs, [activeId]: { name: file.name, size: file.size, type: file.type || 'file', addedAt: Date.now() } });
    setMsg({ type: 'ok', text: 'تم رفع المستند بنجاح.' });
  };

  const removeDoc = (id) => {
    const next = { ...docs };
    delete next[id];
    persist(next);
    setMsg({ type: '', text: '' });
  };

  const handleSubmit = () => {
    try {
      localStorage.setItem(DOCS_SENT_KEY, '1');
    } catch {
      /* التخزين غير متاح */
    }
    setSubmitted(true);
  };

  const uploadedCount = DOC_TYPES.filter((t) => docs[t.id]).length;

  return (
    <section className="dash__section dash__docs-owner">
      <div className="dash__section-head">
        <h2><Building2 /> وثائق استكمال حسابك</h2>
      </div>

      <div className="dash__docs">
        <p className="dash__docs-intro">
          لتفعيل إمكانية إضافة المساحات، أرفق أصول ملكية المساحة (أو عقد الإيجار) أو شهادة مهنية.
          تُراجع المستندات خلال 24 ساعة لتصبح مساحاتك ظاهرة للعملاء.
        </p>

        <div className="dash__docs-list">
          {DOC_TYPES.map((doc) => {
            const file = docs[doc.id];
            return (
              <div key={doc.id} className={`dash__docs-row${file ? ' has-file' : ''}`}>
                <span className="dash__docs-ico"><doc.icon /></span>
                <div className="dash__docs-body">
                  <b>{doc.label}</b>
                  <p>{doc.hint}</p>
                  {file ? (
                    <span className="dash__docs-file" title={file.name}>
                      <FileUp /> {file.name} <em>{formatSize(file.size)}</em>
                    </span>
                  ) : null}
                </div>
                <div className="dash__docs-actions">
                  {file ? (
                    <>
                      <button
                        type="button"
                        className="dash__docs-rm"
                        onClick={() => removeDoc(doc.id)}
                        aria-label="إزالة المستند"
                      >
                        <X />
                      </button>
                      <span className="dash__docs-done"><CheckCircle2 /> مرفوع</span>
                    </>
                  ) : (
                    <button type="button" className="dash__docs-btn" onClick={() => handlePick(doc.id)}>
                      <Upload /> رفع
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={handleFile} />

        {msg.text && (
          <div className={`dash__docs-msg ${msg.type === 'err' ? 'is-err' : 'is-ok'}`} role={msg.type === 'err' ? 'alert' : 'status'}>
            {msg.type === 'err' ? <AlertCircle /> : <CheckCircle2 />}
            <span>{msg.text}</span>
          </div>
        )}

        {submitted ? (
          <div className="dash__docs-msg is-ok dash__docs-submitted" role="status">
            <CheckCircle2 />
            <span>تم إرسال مستنداتك للمراجعة. سنخبرك فور اكتمال التحقق، وبعدها تستطيع إضافة مساحاتك.</span>
          </div>
        ) : (
          <div className="dash__docs-cta">
            <button type="button" className="btn-primary" disabled={uploadedCount === 0} onClick={handleSubmit}>
              إرسال الوثائق للمراجعة ({uploadedCount}/{DOC_TYPES.length})
            </button>
            <button type="button" className="btn-ghost" onClick={() => onNavigate?.('my-spaces')}>
              أضف مساحتك الأولى
            </button>
          </div>
        )}
      </div>
    </section>
  );
}