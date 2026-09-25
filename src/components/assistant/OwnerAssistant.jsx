// مساعد المالك الذكي — يعمل داخل لوحة صاحب المساحة ويحل محل فقاعة الواتساب
// (الفقاعة تبقى كخيار دعم بشري داخل لوحة المساعد نفسها، ليست فقاعة عائمة).
//
// التدفق الذي يحكمه الإذن (يُطبَّق بالترتيب):
//   1. لا إدخال ولا أي رد ذكي حتى يقرّر المالك. القرار يُعرض أول مرة:
//      «أوافق — شارك بياناتي مع الذكاء» → consent='granted' (مسار AI حقيقي).
//      «الوضع المحلي فقط»             → consent='local'  (توصيات من جهازه فقط).
//      القرار قابل للتغيير من زر الإعدادات في أي وقت، ويُشار إليه في رأس اللوحة.
//   2. بطاقات اقتراحات تفاعلية من بيانات المالك الحية — كل بطاقة تنقلك للتبويب
//      الصحيح مباشرة (مساحاتي، الحجوزات، السوق، إعلاناتي، المالية).
//   3. شات حر: يسأل المالك أي سؤال، ونرد عبر الذكاء الحقيقي عند الإذن،
//      وأي فشل نعود لرد محلي قائم على القواعد — المساعد لا ينقطع أبداً.

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, ShieldCheck, Lock, Settings, X, Bot, ChevronLeft, Eye, Heart, Megaphone, Store, MessageCircle, RefreshCw } from 'lucide-react';
import {
  readOwnerAssistantConsent,
  writeOwnerAssistantConsent,
  clearOwnerAssistantConsent,
  askOwnerAssistant,
  buildOwnerContext,
} from '../../lib/ownerAssistant';

const CONSENT_VALUE_GRANTED = 'granted';
const CONSENT_VALUE_LOCAL = 'local';

const OWNER_SUCCESS_MSG = 'تم الحفظ — يمكنك تغيير رأيك لاحقاً من الإعدادات.';

const THREAD_KEY = 'masahati_owner_assistant_thread';
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
  } catch {
    /* التخزين غير متاح */
  }
}

// يبني بطاقات الاقتراحات من بيانات المالك الحية — كل بطاقة تحمل deep-link.
// نستخدم السياق المعياري buildOwnerContext ليتّحد المنطق مع بقية اللوحة.
function buildSuggestionCards(ctxMetrics) {
  const c = ctxMetrics || {};
  const cards = [];

  // مساحة متوقفة → فعّلها (deep-link إلى مساحاتي)
  if (c.inactiveSpacesCount > 0) {
    cards.push({
      id: 'oassist-activate',
      icon: <Sparkles />,
      title: 'فعّل مساحاتك المتوقفة',
      desc: `${c.inactiveSpacesCount} مساحة متوقفة — تفعيلها يزيد وصولك وفتح الباب لأول حجز.`,
      action: 'my-spaces',
      actionLabel: 'إدارة المساحات',
    });
  }

  // مساحات بدون أسعار → حدّد السعر
  if (c.unpricedSpaces > 0) {
    cards.push({
      id: 'oassist-price',
      icon: <Eye />,
      title: 'حدّد أسعارك',
      desc: `${c.unpricedSpaces} مساحة بدون سعر — حدّد سعر الساعة لتظهر في نتائج البحث بالأسعار.`,
      action: 'my-spaces',
      actionLabel: 'تحديد الأسعار',
    });
  }

  // مساحات بدون صور → أضف صوراً
  if (c.spacesWithoutImage > 0) {
    cards.push({
      id: 'oassist-image',
      icon: <Megaphone />,
      title: 'أضف صوراً لمساحاتك',
      desc: `المساحات المزوّدة بصور تجذب أكثر — أضف صوراً لـ ${c.spacesWithoutImage} مساحة.`,
      action: 'my-spaces',
      actionLabel: 'إضافة صور',
    });
  }

  // مرافق رقيقة → أضف مرافق
  if (c.amenitiesThinSpaces > 0) {
    cards.push({
      id: 'oassist-amenities',
      icon: <ShieldCheck />,
      title: 'أضف المرافق الأساسية',
      desc: 'الإنترنت والبروجيكتور والتكييف أول ما يبحث عنه الطلاب — أضف مرافق لمساحتك.',
      action: 'my-spaces',
      actionLabel: 'إضافة مرافق',
    });
  }

  // تقييمات ضعيفة → حسّن
  if (c.weakRatedSpaces > 0) {
    cards.push({
      id: 'oassist-rating',
      icon: <Heart />,
      title: 'حسّن تقييماتك',
      desc: `${c.weakRatedSpaces} مساحة بتقييم أقل من 4 — راجع ملاحظات العملاء وارفع الجودة.`,
      action: 'reviews',
      actionLabel: 'مراجعة التقييمات',
    });
  }

  // طلبات سوق مفتوحة → قدّم عرضاً
  if (c.openMarketCount > 0) {
    cards.push({
      id: 'oassist-market',
      icon: <Store />,
      title: 'أجب على طلبات السوق المفتوحة',
      desc: `${c.openMarketCount} طلب مفتوح ينتظر عروضك — قدّم عرضاً لتحويله لحجز جديد.`,
      action: 'market',
      actionLabel: 'عرض العروض',
    });
  }

  // إعلانات → أضف إعلاناً
  if (c.adsCount === 0) {
    cards.push({
      id: 'oassist-ad',
      icon: <Megaphone />,
      title: 'أضف إعلاناً في إعلاناتي',
      desc: 'الإعلان يزيد وصول مساحتك ويجلب طلبات — أضف إعلاناً جديداً الآن.',
      action: 'ads',
      actionLabel: 'إنشاء إعلان',
    });
  }

  return cards;
}

export default function OwnerAssistant({ data, onNavigate }) {
  const [consent, setConsent] = useState(() => readOwnerAssistantConsent());
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState(readThread);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [consentNotice, setConsentNotice] = useState('');
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const consentRef = useRef(null);

  // إعادة الضبط عند تغيّر الإذن من الإعدادات.
  const handleConsentChange = useCallback((value) => {
    writeOwnerAssistantConsent(value);
    setConsent(value);
    setConsentNotice(OWNER_SUCCESS_MSG);
    setSettingsOpen(false);
  }, []);

  const handleClearConsent = useCallback(() => {
    clearOwnerAssistantConsent();
    setConsent(null);
    setConsentNotice('تم إلغاء الإذن — البيانات لن تغادر جهازك بعد الآن.');
    setSettingsOpen(false);
  }, []);

  // تمرير الاقتراح إلى تبويب محدد داخل لوحة المالك.
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
    setOpen(false);
  }, [onNavigate]);

  // فتح/إغلاق اللوحة وإعادة تركيز حقل الإدخال.
  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next && consent === null) {
        setTimeout(() => consentRef.current?.focus(), 60);
      } else if (next) {
        setTimeout(() => inputRef.current?.focus(), 60);
      }
      return next;
    });
  }, [consent]);

  // التمرير لآخر رسالة تلقائياً.
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
    } catch {
      /* التخزين غير متاح */
    }
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
        setOpen(false);
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

    // بدون قرار بعد → لا رد ذكي، نرشد المالك للقرار أولاً.
    if (!readOwnerAssistantConsent()) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'bot',
          text: 'قبل أن أقدّم توصيات مخصصة، أحتاج قرارك بخصوص بياناتك: اختر خيار الإذن من زر الإعدادات أو من النافذة الأولى. بياناتك لا تُرسل لأي مسار ذكاء بدون موافقتك.',
        },
      ]);
      return;
    }

    setSending(true);
    try {
      const ctx = buildOwnerContext(data || {});
      const result = await askOwnerAssistant(text, ctx, readOwnerAssistantConsent());
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: 'bot',
          text: result.reply,
          local: result.local,
        },
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

  const ctx = buildOwnerContext(data || {});
  const cards = consent === null ? [] : buildSuggestionCards(ctx);
  const consentGranted = consent === CONSENT_VALUE_GRANTED;

  return (
    <div className={consent === null ? 'oassist oassist--consent' : 'oassist'}>
      <button
        type="button"
        className="oassist-bubble"
        onClick={toggleOpen}
        aria-label="افتح مساعدك الذكي"
        aria-expanded={open}
      >
        <Sparkles />
        {consent && (
          <span className="oassist-bubble__dot" aria-hidden="true">
            {consentGranted ? <ShieldCheck /> : <Lock />}
          </span>
        )}
      </button>

      {open && (
        <div className="oassist-panel" role="dialog" aria-modal="true" aria-label="مساعد المالك الذكي">
          <header className="oassist-header">
            <div className="oassist-header__brand">
              <Bot aria-hidden="true" />
              <div>
                <strong>مساعدك الذكي</strong>
                <span>
                  {consent === null ? (
                    <Lock /> ) : consentGranted ? (
                      <ShieldCheck />
                    ) : (
                      <Lock />
                    )}
                  {consent === null ? 'بانتظار قرارك' : consentGranted ? 'ذكاء كامل' : 'وضع محلي آمن'}
                </span>
              </div>
            </div>
            <div className="oassist-header__actions">
              <button
                type="button"
                className={`oassist-header__btn${settingsOpen ? ' is-active' : ''}`}
                onClick={() => setSettingsOpen((v) => !v)}
                aria-label="إعدادات الخصوصية"
                aria-expanded={settingsOpen}
              >
                <Settings />
              </button>
              <button
                type="button"
                className="oassist-header__close"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
              >
                <X />
              </button>
            </div>
          </header>

          <div className="oassist-stage">
            {settingsOpen && (
              <div className="oassist-settings" role="dialog" aria-label="إعدادات الخصوصية">
                <button
                  type="button"
                  className="oassist-settings__back"
                  onClick={() => setSettingsOpen(false)}
                >
                  <ChevronLeft />
                  رجوع
                </button>
                <h4>الخصوصية والبيانات</h4>
                <p>
                  المساعد يحتاج منك إذناً لمشاركة بيانات مساحتك مع الذكاء. بدون موافقتك،
                  تبقى كل البيانات على جهازك ولا تُرسل لأي مسار ذكاء.
                </p>
                <div className="oassist-settings__options">
                  <button
                    type="button"
                    className={`oassist-settings__opt${consentGranted ? ' is-active' : ''}`}
                    onClick={() => handleConsentChange(CONSENT_VALUE_GRANTED)}
                  >
                    <ShieldCheck />
                    <span>مشاركة كاملة مع الذكاء</span>
                  </button>
                  <button
                    type="button"
                    className={`oassist-settings__opt${consent === CONSENT_VALUE_LOCAL ? ' is-active' : ''}`}
                    onClick={() => handleConsentChange(CONSENT_VALUE_LOCAL)}
                  >
                    <Lock />
                    <span>الوضع المحلي فقط</span>
                  </button>
                </div>
                {consentNotice && <p className="oassist-settings__notice">{consentNotice}</p>}
                <button
                  type="button"
                  className="oassist-settings__clear"
                  onClick={handleClearConsent}
                >
                  إلغاء الإذن نهائياً
                </button>
                <button
                  type="button"
                  className="oassist-settings__new"
                  onClick={startNewThread}
                >
                  <RefreshCw />
                  محادثة جديدة
                </button>
              </div>
            )}

            {consent === null ? (
            <div className="oassist-consent" ref={consentRef} tabIndex={-1}>
              <div className="oassist-consent__icon">
                <ShieldCheck />
              </div>
              <h3>خصوصيتك أولاً</h3>
              <p>
                لوحة مساعدك تعمل من بياناتك الخاصة (مساحاتك، حجوزاتك، أرباحك، إعلاناتك).
                لتقدّم لك توصيات مخصصة، تحتاج أن تُشارك ملخصاً من هذه البيانات مع الذكاء.
                الاختيار بيدك دائماً:
              </p>
              <div className="oassist-consent__actions">
                <button
                  type="button"
                  className="oassist-consent__grant"
                  onClick={() => handleConsentChange(CONSENT_VALUE_GRANTED)}
                >
                  <ShieldCheck />
                  أوافق — شارك بياناتي مع الذكاء
                </button>
                <button
                  type="button"
                  className="oassist-consent__local"
                  onClick={() => handleConsentChange(CONSENT_VALUE_LOCAL)}
                >
                  <Lock />
                  الوضع المحلي فقط (الأكثر أماناً)
                </button>
              </div>
              <p className="oassist-consent__note">
                يمكنك تغيير رأيك في أي وقت من زر الإعدادات.
              </p>
            </div>
          ) : (
            <div className="oassist-body">
              <div className="oassist-chat">
                <div className="oassist-msgs" ref={chatRef}>
                  {messages.length === 0 && (
                    <div className="oassist-msg oassist-msg--bot">
                      <Bot aria-hidden="true" />
                      <p>
                        مرحباً! أستطيع مساعدتك في كل ما يخص مساحاتك: لماذا مساحتي غير محجوزة؟،
                        كيف أرفع أرباحي؟، أو اعرض ملخص أدائي. اسألني أو اختر من الاقتراحات.
                      </p>
                    </div>
                  )}
                  {messages.length === 0 && cards.length > 0 && (
                    <div className="oassist-cards">
                      {cards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          className="oassist-card"
                          onClick={() => handleAction(card)}
                        >
                          <span className="oassist-card__icon">{card.icon}</span>
                          <span className="oassist-card__body">
                            <strong>{card.title}</strong>
                            <span>{card.desc}</span>
                          </span>
                          <span className="oassist-card__action">
                            {card.actionLabel}
                            <ChevronLeft />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`oassist-msg oassist-msg--${m.role}`}>
                      {m.role === 'bot' && <Bot aria-hidden="true" />}
                      <p>{m.text}</p>
                    </div>
                  ))}
                  {sending && (
                    <div className="oassist-msg oassist-msg--bot oassist-msg--typing">
                      <Bot aria-hidden="true" />
                      <span className="oassist-typing" />
                    </div>
                  )}
                </div>

                {messages.length === 0 && (
                  <div className="oassist-chips">
                    <button type="button" onClick={() => handleSubmit('لماذا مساحتي غير محجوزة؟')}>
                      لماذا مساحتي غير محجوزة؟
                    </button>
                    <button type="button" onClick={() => handleSubmit('كيف أرفع أرباحي؟')}>
                      كيف أرفع أرباحي؟
                    </button>
                    <button type="button" onClick={() => handleSubmit('اعرض ملخص أدائي')}>
                      اعرض ملخص أدائي
                    </button>
                  </div>
                )}

                <form
                  className="oassist-inputbar"
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
                  <button type="submit" className="oassist-send" aria-label="إرسال" disabled={sending || !input.trim()}>
                    <Send />
                  </button>
                </form>
                <a
                  className="oassist-support"
                  href="https://wa.me/972567653009"
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
