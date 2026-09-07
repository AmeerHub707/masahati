import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bot, X, Send, MapPin, Ruler, Sparkles } from 'lucide-react';
import { askAssistant } from '../../lib/assistant';

// اقتراحات سريعة تظهر عند فتح المحادثة أول مرة
const QUICK_QUESTIONS = [
  'كيف أحجز مقعداً؟',
  'كم سعر الساعة في المساحات؟',
  'ما الفرق بين العميل وصاحب المساحة؟',
  'ما المساحات المتوفرة الآن؟',
];

const WELCOME = 'مرحباً 👋 أنا مساعد مساحاتي. اسألني عن المساحات، الأسعار، الحجز، أو أي شيء يخص المنصة.';

let idCounter = 0;
const nextId = () => ++idCounter;

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    { id: nextId(), role: 'assistant', text: WELCOME, spaces: [] },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);

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

  const send = useCallback(async (raw) => {
    const text = String(raw || '').trim();
    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', text, spaces: [] },
    ]);
    setInput('');
    setLoading(true);

    try {
      const { reply, spaces } = await askAssistant(text);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text: reply || 'لم أستطع صياغة رد الآن، جرّب سؤالاً آخر.',
          spaces,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text:
            err?.message ||
            'تعذر الاتصال بالمساعد حالياً. حاول مرة أخرى بعد قليل.',
          spaces: [],
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const onSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="assistant">
      {/* زر الفقاعة — فوق فقاعة واتساب في الزاوية السفلية اليسرى */}
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
      </button>

      {/* لوحة المحادثة */}
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
            <button
              type="button"
              className="assistant-header__close"
              onClick={() => setOpen(false)}
              aria-label="إغلاق المحادثة"
            >
              <X aria-hidden="true" />
            </button>
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

          {/* اقتراحات سريعة قبل أول تفاعل */}
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