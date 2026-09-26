// مساعد العميل الذكي — يعمل داخل لوحة العميل.
//
// تصميم مستقل عن مساعد المالك مع الحفاظ على هوية الموقع البرتقالية: أصناف `cassist*`
// في `index.css` تأخذ لونها من `--accent` نفسه، فالفروق في FORM لا في اللون —
// فقاعة مربّعة الزوايا، ترويسة فاتحة، شبكة اقتراحات، وavatar ثابت بجانب كل رد.
//
// التدفق الذي يحكمه الإذن (نفس قاعدة لوحة المالك):
//   1. لا إدخال ولا رد ذكي حتى يقرر العميل («أوافق» أو «الوضع المحلي فقط»).
//   2. بطاقات اقتراح من بيانات العميل الحية — كل بطاقة تنقله للتبويب الصحيح.
//   3. شات حر: ذكاء حقيقي عند الإذن، ورد محلي قائم على القواعد عند أي فشل.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, ShieldCheck, Lock, Settings, X, Bot, ChevronLeft, CalendarCheck, CalendarX, Heart, Megaphone, MessageCircle, RefreshCw } from 'lucide-react';
import {
  readCustomerAssistantConsent,
  writeCustomerAssistantConsent,
  clearCustomerAssistantConsent,
  askCustomerAssistant,
  buildCustomerContext,
} from '../../lib/customerAssistant';

const CONSENT_VALUE_GRANTED = 'granted';
const CONSENT_VALUE_LOCAL = 'local';

const SUCCESS_MSG = 'تم الحفظ — يمكنك تغيير رأيك لاحقاً من الإعدادات.';

const THREAD_KEY = 'masahati_customer_assistant_thread';
const THREAD_LIMIT = 60;

function readThread() {
  try {
    const raw = localStorage.getItem(THREAD_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((m) => m && (m.role === 'user' || m.role === 'bot') && typeof m.text === 'string')
      .slice(-THREAD_LIMIT);
  } catch {
    return [];
  }
}

function writeThread(list) {
  try {
    localStorage.setItem(THREAD_KEY, JSON.stringify(list.slice(-THREAD_LIMIT)));
  } catch { /* التخزين غير متاح */ }
}

// بطاقات الاقتراح: علاقة العميل فقط — حجوزاته ومفضّلته وطلباته.
// لا بطاقة تفتح التصفّح ولا تطلب إنشاء شيء: كل بطاقة تعرض ما يملكه فعلاً ويقفز لتبويبه.
function buildSuggestionCards(ctx) {
  const c = ctx || {};
  const cards = [];

  cards.push({
    id: 'cassist-upcoming',
    icon: <CalendarCheck />,
    title: c.upcomingCount > 0 ? `لديك ${c.upcomingCount} حجز قادم` : 'حجوزاتك',
    desc: c.nextBookingDate
      ? `أقربها «${c.nextBookingName}» بتاريخ ${c.nextBookingDate}.`
      : 'سجلك كامل بالتواريخ والحالات.',
    action: 'bookings',
    actionLabel: 'فتح حجوزاتي',
  });

  if (c.favoritesCount > 0) {
    cards.push({
      id: 'cassist-favorites',
      icon: <Heart />,
      title: 'مساحاتك المفضلة',
      desc: `${c.favoritesCount} مساحة محفوظة.`,
      action: 'favorites',
      actionLabel: 'فتح المفضلة',
    });
  }

  if (c.openRequests > 0) {
    cards.push({
      id: 'cassist-requests',
      icon: <Megaphone />,
      title: 'طلباتك الخاصة',
      desc: `${c.openRequests} بانتظار العروض.`,
      action: 'requests',
      actionLabel: 'فتح الطلبات',
    });
  }

  if (c.cancelledBookings > 0) {
    cards.push({
      id: 'cassist-cancelled',
      icon: <CalendarX />,
      title: 'حجوزات ملغاة',
      desc: `${c.cancelledBookings} في سجلك.`,
      action: 'bookings',
      actionLabel: 'سجل الحجوزات',
    });
  }

  return cards;
}

export default function CustomerAssistant({ data, onNavigate, tourActive = false }) {
  const [consent, setConsent] = useState(() => readCustomerAssistantConsent());
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState(readThread);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [consentNotice, setConsentNotice] = useState('');
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const consentRef = useRef(null);

  // أثناء جولة التعريف يُبرز زر المساعد فقط، فتبقى اللوحة ولوحة الخصوصية مغلقتين.
  const open = panelOpen && !tourActive;
  const settingsVisible = settingsOpen && !tourActive;

  const handleConsentChange = useCallback((value) => {
    writeCustomerAssistantConsent(value);
    setConsent(value);
    setConsentNotice(SUCCESS_MSG);
    setSettingsOpen(false);
  }, []);

  const handleClearConsent = useCallback(() => {
    clearCustomerAssistantConsent();
    setConsent(null);
    setConsentNotice('تم إلغاء الإذن — البيانات لن تغادر جهازك بعد الآن.');
    setSettingsOpen(false);
  }, []);

  const handleAction = useCallback((card) => {
    if (!card) return;
    setMessages((prev) => [
      ...prev,
      { id: `a-${card.id}-${Date.now()}`, role: 'user', text: card.title },
      {
        id: `b-${card.id}-${Date.now()}`,
        role: 'bot',
        text: `وجدت لك: ${card.desc} سأفتح لك «${card.actionLabel}» الآن.`,
      },
    ]);
    if (typeof onNavigate === 'function') onNavigate(card.action);
    setPanelOpen(false);
  }, [onNavigate]);

  const toggleOpen = useCallback(() => {
    setPanelOpen((prev) => {
      const next = !prev;
      if (next && consent === null) {
        setTimeout(() => consentRef.current?.focus(), 60);
      } else if (next) {
        setTimeout(() => inputRef.current?.focus(), 60);
      }
      return next;
    });
  }, [consent]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    writeThread(messages);
  }, [messages]);

  const startNewThread = useCallback(() => {
    setMessages([]);
    setInput('');
    try {
      localStorage.removeItem(THREAD_KEY);
    } catch { /* التخزين غير متاح */ }
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
        setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSubmit = useCallback(async (override) => {
    const text = String(override == null ? input : override).trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', text }]);
    setInput('');

    if (!readCustomerAssistantConsent()) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'bot',
          text: 'قبل أن أساعدك بالذكاء الكامل، أحتاج قرارك بخصوص بياناتك: اختر خيار الإذن من زر الإعدادات. بياناتك لا تُرسل لأي مسار ذكاء بدون موافقتك.',
        },
      ]);
      return;
    }

    setSending(true);
    try {
      const ctx = buildCustomerContext(data || {});
      const result = await askCustomerAssistant(text, ctx, readCustomerAssistantConsent());
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, role: 'bot', text: result.reply, local: result.local },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 3,
          role: 'bot',
          text: 'تعذّر الاتصال بالمساعد حالياً — جرّب سؤالك من جديد بعد قليل، أو راجع الاقتراحات في الأعلى.',
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, data]);

  const ctx = buildCustomerContext(data || {});
  const cards = consent === null ? [] : buildSuggestionCards(ctx);
  const consentGranted = consent === CONSENT_VALUE_GRANTED;

  return (
    <div className={consent === null ? 'cassist cassist--consent' : 'cassist'}>
      <button
        type="button"
        className="cassist-bubble"
        onClick={toggleOpen}
        aria-label="افتح مساعدك الذكي"
        aria-expanded={open}
        data-tour="customer-assistant"
      >
        <Sparkles />
        {consent && (
          <span className="cassist-bubble__dot" aria-hidden="true">
            {consentGranted ? <ShieldCheck /> : <Lock />}
          </span>
        )}
      </button>

      {open && (
        <div className="cassist-panel" role="dialog" aria-modal="true" aria-label="مساعد العميل الذكي">
          <header className="cassist-header">
            <div className="cassist-header__brand">
              <Bot aria-hidden="true" />
              <div>
                <strong>مساعدك الذكي</strong>
                <span>
                  {consent === null ? <Lock /> : consentGranted ? <ShieldCheck /> : <Lock />}
                  {consent === null ? 'بانتظار قرارك' : consentGranted ? 'ذكاء كامل' : 'وضع محلي آمن'}
                </span>
              </div>
            </div>
            <div className="cassist-header__actions">
              <button
                type="button"
                className={`cassist-header__btn${settingsVisible ? ' is-active' : ''}`}
                onClick={() => setSettingsOpen((v) => !v)}
                aria-label="إعدادات الخصوصية"
                aria-expanded={settingsVisible}
              >
                <Settings />
              </button>
              <button
                type="button"
                className="cassist-header__close"
                onClick={() => setPanelOpen(false)}
                aria-label="إغلاق"
              >
                <X />
              </button>
            </div>
          </header>

          <div className="cassist-stage">
            {settingsVisible && (
              <div className="cassist-settings" role="dialog" aria-label="إعدادات الخصوصية">
                <button type="button" className="cassist-settings__back" onClick={() => setSettingsOpen(false)}>
                  <ChevronLeft />
                  رجوع
                </button>
                <h4>الخصوصية والبيانات</h4>
                <p>
                  المساعد يحتاج منك إذناً لمشاركة ملخّص من حجوزاتك ومفضلاتك وطلباتك.
                  بدون موافقتك تبقى كل البيانات على جهازك ولا تُرسل لأي مسار ذكاء.
                </p>
                <div className="cassist-settings__options">
                  <button
                    type="button"
                    className={`cassist-settings__opt${consentGranted ? ' is-active' : ''}`}
                    onClick={() => handleConsentChange(CONSENT_VALUE_GRANTED)}
                  >
                    <ShieldCheck />
                    <span>مشاركة كاملة مع الذكاء</span>
                  </button>
                  <button
                    type="button"
                    className={`cassist-settings__opt${consent === CONSENT_VALUE_LOCAL ? ' is-active' : ''}`}
                    onClick={() => handleConsentChange(CONSENT_VALUE_LOCAL)}
                  >
                    <Lock />
                    <span>الوضع المحلي فقط</span>
                  </button>
                </div>
                {consentNotice && <p className="cassist-settings__notice">{consentNotice}</p>}
                <button type="button" className="cassist-settings__clear" onClick={handleClearConsent}>
                  إلغاء الإذن نهائياً
                </button>
                <button type="button" className="cassist-settings__new" onClick={startNewThread}>
                  <RefreshCw />
                  محادثة جديدة
                </button>
              </div>
            )}

            {consent === null ? (
              <div className="cassist-consent" ref={consentRef} tabIndex={-1}>
                <div className="cassist-consent__icon">
                  <ShieldCheck />
                </div>
                <h3>خصوصيتك أولاً</h3>
                <p>
                  مساعدك يقرأ من بياناتك الخاصة فقط: حجوزاتك، مساحاتك المفضلة، وطلباتك.
                  الوضع المحلي يبقي كل شيء داخل متصفحك، والوضع الكامل يشارك ملخصاً من هذه البيانات فقط.
                  الاختيار بيدك دائماً:
                </p>
                <div className="cassist-consent__actions">
                  <button type="button" className="cassist-consent__grant" onClick={() => handleConsentChange(CONSENT_VALUE_GRANTED)}>
                    <ShieldCheck />
                    أوافق — شارك بياناتي مع الذكاء
                  </button>
                  <button type="button" className="cassist-consent__local" onClick={() => handleConsentChange(CONSENT_VALUE_LOCAL)}>
                    <Lock />
                    الوضع المحلي فقط (الأكثر أماناً)
                  </button>
                </div>
                <p className="cassist-consent__note">يمكنك تغيير رأيك في أي وقت من زر الإعدادات.</p>
              </div>
            ) : (
              <div className="cassist-body">
                <div className="cassist-chat">
                  <div className="cassist-msgs" ref={chatRef}>
                    {messages.length === 0 && (
                      <div className="cassist-msg cassist-msg--bot">
                        <span className="cassist-msg__avatar">
                          <Bot aria-hidden="true" />
                        </span>
                        <p>
                          مرحباً! أعرف ما يخصك فقط: حجوزاتك، مساحاتك المفضلة، وطلباتك.
                          اسألني أو اختر من الاقتراحات.
                        </p>
                      </div>
                    )}
                    {messages.length === 0 && cards.length > 0 && (
                      <div className="cassist-cards">
                        {cards.map((card) => (
                          <button key={card.id} type="button" className="cassist-card" onClick={() => handleAction(card)}>
                            <span className="cassist-card__icon">{card.icon}</span>
                            <span className="cassist-card__body">
                              <strong>{card.title}</strong>
                              <span>{card.desc}</span>
                            </span>
                            <span className="cassist-card__action">
                              {card.actionLabel}
                              <ChevronLeft />
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {messages.map((m) => (
                      <div key={m.id} className={`cassist-msg cassist-msg--${m.role}`}>
                        {m.role === 'bot' && (
                          <span className="cassist-msg__avatar">
                            <Bot aria-hidden="true" />
                          </span>
                        )}
                        <p>{m.text}</p>
                      </div>
                    ))}
                    {sending && (
                      <div className="cassist-msg cassist-msg--bot cassist-msg--typing">
                        <span className="cassist-msg__avatar">
                          <Bot aria-hidden="true" />
                        </span>
                        <span className="cassist-typing" />
                      </div>
                    )}
                  </div>

                  {messages.length === 0 && (
                    <div className="cassist-chips">
                      <button type="button" onClick={() => handleSubmit('ما هي حجوزاتي القادمة؟')}>
                        ما هي حجوزاتي القادمة؟
                      </button>
                      <button type="button" onClick={() => handleSubmit('ما مساحاتي المفضلة؟')}>
                        ما مساحاتي المفضلة؟
                      </button>
                      <button type="button" onClick={() => handleSubmit('ما حالة طلباتي الخاصة؟')}>
                        ما حالة طلباتي؟
                      </button>
                    </div>
                  )}

                  <form
                    className="cassist-inputbar"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmit();
                    }}
                  >
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="اكتب سؤالك هنا…"
                      aria-label="رسالتك للمساعد"
                      disabled={sending}
                    />
                    <button type="submit" className="cassist-send" aria-label="إرسال" disabled={sending || !input.trim()}>
                      <Send />
                    </button>
                  </form>
                  <a className="cassist-support" href="https://wa.me/972567653009" target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                    تواصل مع الدعم البشري
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
