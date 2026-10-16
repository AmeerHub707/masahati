import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useT';
import { Bot, X, Send, MapPin, Ruler, Sparkles, Trash2 } from 'lucide-react';
import { askAssistant } from '@/lib/assistant';

// مفاتيح الأسئلة السريعة — النص يُحلّ عند التصيير عبر `assistant.quick.<key>`.
const QUICK_KEYS = ['q1', 'q2', 'q3', 'q4'];
const STORAGE_KEY = 'masahati_assistant_messages';

const generateId = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export default function AssistantWidget() {
  const { t } = useTranslation('landing');
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
    return [{ id: generateId(), role: 'assistant', text: t('assistant.welcome'), spaces: [] }];
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
          text: reply || t('assistant.replyFallback'),
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
            t('assistant.errorFallback'),
          spaces: [],
          error: true,
        },
      ]);

      if (!openRef.current) setUnreadOnly((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }, [loading, t]);

  const clearChat = () => {
    setConfirmOpen(true);
  };

  const confirmClear = () => {
    const resetMessages = [{ id: generateId(), role: 'assistant', text: t('assistant.welcome'), spaces: [] }];
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
        aria-label={t('assistant.bubbleLabel')}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-tip={open ? t('assistant.tipClose') : t('assistant.tipAsk')}
      >
        <Bot className="assistant-bubble__icon" aria-hidden="true" />
        {unreadOnly > 0 && (
          <span className="assistant-badge" aria-label={t('assistant.unread', { count: unreadOnly })}>
            {unreadOnly > 99 ? '99+' : unreadOnly}
          </span>
        )}
      </button>

      {open && (
        <div
          className="assistant-panel"
          role="dialog"
          aria-label={t('assistant.headerTitle')}
          aria-modal="false"
        >
          <header className="assistant-header">
            <div className="assistant-header__avatar" aria-hidden="true">
              <Bot />
            </div>
            <div className="assistant-header__meta">
              <strong>{t('assistant.headerTitle')}</strong>
              <span><i className="assistant-header__dot" aria-hidden="true"></i>{t('assistant.online')}</span>
            </div>
            <div className="assistant-header__actions">
              {messages.length > 0 && (
                <button
                  type="button"
                  className="assistant-header__action assistant-header__action--clear"
                  onClick={clearChat}
                  aria-label={t('assistant.clearChat')}
                  title={t('assistant.clearChat')}
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              )}
              <button
                type="button"
                className="assistant-header__close"
                onClick={() => setOpen(false)}
                aria-label={t('assistant.tipClose')}
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
              <div className="assistant-typing" role="status" aria-label={t('assistant.typing')}>
                <span></span><span></span><span></span>
              </div>
            )}
          </div>

          {!loading && messages.length <= 1 && (
            <div className="assistant-chips">
              {QUICK_KEYS.map((k) => (
                <button
                  type="button"
                  key={k}
                  className="assistant-chip"
                  onClick={() => send(t(`assistant.quick.${k}`))}
                >
                  <Sparkles aria-hidden="true" />
                  {t(`assistant.quick.${k}`)}
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
              placeholder={t('assistant.placeholder')}
              aria-label={t('assistant.inputLabel')}
              disabled={loading}
            />
            <button
              type="submit"
              className="assistant-send"
              aria-label={t('assistant.send')}
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
            aria-label={t('assistant.confirmLabel')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="assistant-confirm__header">
              <Trash2 aria-hidden="true" size={20} />
              <strong>{t('assistant.clearChat')}</strong>
            </div>
            <p className="assistant-confirm__body">
              {t('assistant.confirmBody')}
            </p>
            <div className="assistant-confirm__actions">
              <button
                type="button"
                className="assistant-confirm__btn assistant-confirm__btn--cancel"
                onClick={() => setConfirmOpen(false)}
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                className="assistant-confirm__btn assistant-confirm__btn--confirm"
                onClick={confirmClear}
              >
                {t('assistant.confirmYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const { t } = useTranslation('landing');
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
              {t('assistant.browseAll')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
