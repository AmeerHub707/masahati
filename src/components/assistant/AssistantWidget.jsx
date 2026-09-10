import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bot, X, Send, MapPin, Ruler, Sparkles, Trash2 } from 'lucide-react';
import { askAssistant } from '../../lib/assistant';

const QUICK_QUESTIONS = [
  'كيف أحجز مقعداً؟',
  'كم سعر الساعة في المساحات؟',
  'ما الفرق بين العميل وصاحب المساحة؟',
  'ما المساحات المتوفرة الآن؟',
];

const WELCOME = 'مرحباً 👋 أنا مساعد مساحاتي. اسألني عن المساحات، الأسعار، الحجز، أو أي شيء يخص المنصة.';
const STORAGE_KEY = 'masahati_assistant_messages';

const generateId = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse assistant messages', e);
      }
    }
    return [{ id: generateId(), role: 'assistant', text: WELCOME, spaces: [] }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const openRef = useRef(false);
  const clearIdRef = useRef(0);

  // مزامنة openRef مع الحالة
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // حفظ الرسائل في LocalStorage عند كل تحديث
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // تمرير تلقائي إلى آخر رسالة عند كل تحديث
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // التركيز على حقل الإدخال + إغلاق بمفتاح Escape عند فتح اللوحة
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // مسح عداد غير المقروء عند فتح اللوحة
  useEffect(() => {
    if (open) setUnreadOnly(0);
  }, [open]);

  const send = useCallback(async (raw) => {
    const text = String(raw || '').trim();
    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: 'user', text, spaces: [] },
    ]);
    setInput('');
    setLoading(true);

    const currentClearId = clearIdRef.current;

    try {
      const { reply, spaces } = await askAssistant(text);

      if (clearIdRef.current !== currentClearId) return;

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          text: reply || 'لم أستطع صياغة رد الآن، جرّب سؤالاً آخر.',
          spaces,
        },
      ]);

      if (!openRef.current) setUnreadOnly((n) => n + 1);
    } catch (err) {
      if (clearIdRef.current !== currentClearId) return;

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          text:
            err?.message ||
            'تعذر الاتصال بالمساعد حالياً. حاول مرة أخرى بعد قليل.',
          spaces: [],
          error: true,
        },
      ]);

      if (!openRef.current) setUnreadOnly((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const clearChat = () => {
    setConfirmOpen(true);
  };

  const confirmClear = () => {
    const resetMessages = [{ id: generateId(), role: 'assistant', text: WELCOME, spaces: [] }];
    setMessages(resetMessages);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetMessages));
    setLoading(false);
    setUnreadOnly(0);
    clearIdRef.current += 1;
    setConfirmOpen(false);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="assistant">
      <button
        type="button"
        className="assistant-bubble"
        onClick={() => setOpen((v) => !v)}
        aria-label="مساعد مساحاتي"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-tip={open ? 'إغلاق المحادثة' : 'اسأل مساعد مساحاتي'}
      >
        <Bot className="assistant-bubble__icon" aria-hidden="true" />
        {unreadOnly > 0 && (
          <span className="assistant-badge" aria-label={`${unreadOnly} رسائل جديدة`}>
            {unreadOnly > 99 ? '99+' : unreadOnly}
          </span>
        )}
      </button>

      {open && (
        <div
          className="assistant-panel"
          role="dialog"
          aria-label="مساعد مساحاتي"
          aria-modal="false"
        >
          <header className="assistant-header">
            <div className="assistant-header__avatar" aria-hidden="true">
              <Bot />
            </div>
            <div className="assistant-header__meta">
              <strong>مساعد مساحاتي</strong>
              <span><i className="assistant-header__dot" aria-hidden="true"></i>متصل الآن</span>
            </div>
            <div className="assistant-header__actions">
              {messages.length > 0 && (
                <button
                  type="button"
                  className="assistant-header__action assistant-header__action--clear"
                  onClick={clearChat}
                  aria-label="مسح المحادثة"
                  title="مسح المحادثة"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              )}
              <button
                type="button"
                className="assistant-header__close"
                onClick={() => setOpen(false)}
                aria-label="إغلاق المحادثة"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </header>

          <div
            className="assistant-body"
            ref={listRef}
            aria-live="polite"
          >
            {messages.map((m) => (
              <Message key={m.id} msg={m} />
            ))}

            {loading && (
              <div className="assistant-typing" role="status" aria-label="المساعد يكتب">
                <span></span><span></span><span></span>
              </div>
            )}
          </div>

          {!loading && messages.length <= 1 && (
            <div className="assistant-chips">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  type="button"
                  key={q}
                  className="assistant-chip"
                  onClick={() => send(q)}
                >
                  <Sparkles aria-hidden="true" />
                  {q}
                </button>
              ))}
            </div>
          )}

          <form className="assistant-inputbar" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك…"
              aria-label="رسالتك للمساعد"
              disabled={loading}
            />
            <button
              type="submit"
              className="assistant-send"
              aria-label="إرسال"
              disabled={loading || !input.trim()}
            >
              <Send aria-hidden="true" />
            </button>
          </form>
        </div>
      )}

      {confirmOpen && (
        <div className="assistant-confirm-overlay" onClick={() => setConfirmOpen(false)}>
          <div
            className="assistant-confirm"
            role="alertdialog"
            aria-label="تأكيد مسح المحادثة"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="assistant-confirm__header">
              <Trash2 aria-hidden="true" size={20} />
              <strong>مسح المحادثة</strong>
            </div>
            <p className="assistant-confirm__body">
              هل تريد مسح المحادثة بالكامل؟ لن تتمكن من التراجع.
            </p>
            <div className="assistant-confirm__actions">
              <button
                type="button"
                className="assistant-confirm__btn assistant-confirm__btn--cancel"
                onClick={() => setConfirmOpen(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="assistant-confirm__btn assistant-confirm__btn--confirm"
                onClick={confirmClear}
              >
                نعم، مسح
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  const cls = isUser
    ? 'assistant-msg--user'
    : msg.error
      ? 'assistant-msg--error'
      : 'assistant-msg--bot';

  return (
    <div className={`assistant-msg ${cls}`}>
      {!isUser && (
        <span className="assistant-msg__avatar" aria-hidden="true">
          <Bot />
        </span>
      )}
      <div className="assistant-msg__content">
        <p>{msg.text}</p>

        {msg.spaces && msg.spaces.length > 0 && (
          <div className="assistant-spaces">
            {msg.spaces.map((s) => (
              <Link
                key={s.id}
                to="/spaces"
                className="assistant-space"
                onClick={(e) => e.stopPropagation()}
              >
                {s.image ? (
                  <img src={s.image} alt="" loading="lazy" />
                ) : (
                  <span className="assistant-space__img-fallback" aria-hidden="true" />
                )}
                <span className="assistant-space__info">
                  <strong>{s.name}</strong>
                  <span><MapPin aria-hidden="true" />{s.location}</span>
                  <span><Ruler aria-hidden="true" />{s.area}</span>
                </span>
                <b>{s.price}</b>
              </Link>
            ))}
            <Link to="/spaces" className="assistant-more">
              تصفح كل المساحات
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
