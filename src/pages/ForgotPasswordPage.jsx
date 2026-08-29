import { useState } from 'react';
import { Link } from 'react-router-dom';
import { request, ApiError } from '../lib/authStore';

// ترجمة رسائل الخطأ الإنجليزية القادمة من Laravel إلى العربية.
function translate(msg) {
  if (!msg) return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
  const m = String(msg).toLowerCase();
  if (m.includes('selected email is invalid')) return 'هذا البريد غير مسجّل لدينا أو غير صحيح.';
  if (m.includes('email') && m.includes('required')) return 'البريد الإلكتروني مطلوب.';
  if (m.includes('throttled') || m.includes('too many')) return 'طلبات كثيرة جداً. انتظر قليلاً وحاول مجدداً.';
  return msg;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent'
  const [isSending, setIsSending] = useState(false);

  const maskEmail = (e) => {
    const [u, d] = e.split('@');
    if (!d) return e;
    const head = u.length > 2 ? u[0] + '•••' + u.slice(-1) : u[0] + '••';
    return head + '@' + d;
  };

  const isValidEmail = (v) => v.trim().includes('@') && v.trim().includes('.') && !v.trim().includes(' ');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setFormError('');

    const value = email.trim();
    if (!isValidEmail(value)) {
      setEmailError('الرجاء إدخال بريد إلكتروني صحيح.');
      return;
    }

    setIsSending(true);
    setStatus('sending');
    try {
      // الباك إند يرسل رابط إعادة التعيين إلى البريد (نموذج الرابط، لا OTP).
      await request('/api/forgot-password', {
        method: 'POST',
        body: { email: value },
      });
      setStatus('sent');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.data?.errors?.email) {
        setEmailError(translate(err.data.errors.email[0]));
      } else if (err instanceof ApiError) {
        setFormError(translate(err.message));
      } else {
        setFormError('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.');
      }
      setStatus('idle');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-bg" aria-hidden="true" />
      {/* Styles inject */}
      <style>{`
        :root {
          --accent: #f97316;
          --accent-hover: #ea580c;
          --accent-soft: #fff3e9;
          --radius-card: 1.75rem;
          --radius-field: 0.75rem;
          --shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.5);
          --ease: cubic-bezier(0.22, 1, 0.36, 1);
        }

        .auth-wrapper {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(0.75rem, 4vh, 2.5rem) 1.25rem;
          background-image: url("/background.jpeg");
          background-size: cover;
          background-position: center;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          font-family: 'Cairo', sans-serif;
          direction: rtl;
        }
        .auth-wrapper::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: 0;
          background: linear-gradient(160deg, rgba(0,0,0,0.58), rgba(0,0,0,0.40));
        }
        .auth-wrapper::after {
          content: "";
          position: fixed;
          z-index: 0;
          left: 50%; top: 50%;
          width: 46rem; height: 46rem;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(249,115,22,0.38) 0%, rgba(249,115,22,0.12) 40%, transparent 70%);
          filter: blur(20px);
          pointer-events: none;
        }

        /* ===== طبقة الخلفية المتحركة (تكبير/تصغير) ===== */
        .auth-bg {
          position: absolute;
          inset: 0;
          z-index: -1;
          background-image: url("/background.jpeg");
          background-size: cover;
          background-position: center;
          transform: scale(1.06);
          animation: authZoom 9s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes authZoom {
          0%   { transform: scale(1.05); }
          50%  { transform: scale(1.18); }
          100% { transform: scale(1.05); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-bg,
          .auth-card__bg {
            animation: none;
            transform: scale(1.06);
          }
        }

        /* ===== البطاقة ===== */
        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: min(30rem, 100%);
          max-height: min(92vh, 44rem);
          margin: auto;
          display: flex;
          flex-direction: column;
          border-radius: var(--radius-card);
          overflow: hidden;
          box-shadow: var(--shadow), 0 0 0 1px rgba(249,115,22,0.10);
          background: rgba(0,0,0,0.6);
          isolation: isolate;
        }
        @media (min-width: 768px) {
          .auth-card { flex-direction: row; min-height: 35rem; }
        }

        .auth-card__bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: transparent;
          background-size: cover;
          background-position: center;
        }
        .auth-card__scrim {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: transparent;
        }
        .auth-card__glow {
          display: none;
        }

        /* ===== الجانب الترحيبي ===== */
        .auth-welcome {
          display: none;
          position: relative;
          z-index: 1;
          flex-direction: column;
          justify-content: space-between;
          gap: 1.5rem;
          padding: 2rem 2rem;
          color: #fff;
        }
        @media (min-width: 768px) {
          .auth-welcome { width: 46%; flex: none; }
        }
        .auth-welcome__copy h1 {
          font-size: clamp(1.8rem, 3.4vw, 2.6rem);
          font-weight: 800;
          margin: 0 0 0.6rem;
          line-height: 1.15;
        }
        .auth-welcome__copy p {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.7;
          color: rgba(255,255,255,0.82);
        }
        .auth-welcome__badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          margin-top: 1.4rem;
          font-size: 0.78rem;
          font-weight: 700;
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.3);
          padding: 0.4rem 0.9rem;
          border-radius: 999px;
          backdrop-filter: blur(6px);
          width: fit-content;
        }
        .auth-welcome__badge svg { width: 1rem; height: 1rem; color: #fff; }

        /* ===== لوحة النموذج (زجاجية) ===== */
        .auth-form {
          position: relative;
          z-index: 1;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: 2rem 2rem 1.6rem;
          background: rgba(0,0,0,0.6);
          border-top: none;
          overflow-y: auto;
        }
        @media (min-width: 768px) {
          .auth-form {
            width: 54%; flex: none;
            padding: 2.2rem 2.4rem 1.8rem;
            border-top: none;
            border-inline-start: 1px solid rgba(255,255,255,0.12);
          }
        }

        .form-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          width: 100%;
          margin-bottom: 1.2rem;
        }
        .brand { display: flex; align-items: center; gap: 0.6rem; }
        .brand-logo { height: 2.4rem; width: auto; object-fit: contain; filter: drop-shadow(0 6px 14px rgba(249,115,22,0.3)); }
        .brand-name { font-size: 1.4rem; font-weight: 800; color: #fff; direction: ltr; }
        .brand-name span { color: var(--accent); }

        .back-home {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          font-weight: 700;
          font-size: 0.82rem;
          color: #fff;
          text-decoration: none;
          padding: 0.5rem 0.9rem;
          border: 1.5px solid rgba(255,255,255,0.35);
          border-radius: 999px;
          transition: all 0.2s var(--ease);
        }
        .back-home:hover {
          border-color: var(--accent);
          background: rgba(249,115,22,0.18);
        }

        .auth-form h2 {
          margin: 0 0 0.35rem;
          font-size: clamp(1.5rem, 2.6vw, 2rem);
          font-weight: 800;
          color: #fff;
        }
        .form-sub {
          margin: 0 0 1.4rem;
          font-size: 0.92rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.72);
        }

        /* الحقول */
        .field { margin-bottom: 0.5rem; }
        .field label {
          display: block;
          font-size: 0.82rem;
          margin-bottom: 0.35rem;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
        }
        .field input {
          width: 100%;
          font-size: 0.92rem;
          padding: 0.7rem 0.9rem;
          border: 1.5px solid rgba(255,255,255,0.85);
          border-radius: var(--radius-field);
          background: rgba(255,255,255,0.06);
          color: #fff;
          outline: none;
          transition: all 0.2s;
        }
        .field input::placeholder { color: rgba(255,255,255,0.6); }
        .field input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 4px rgba(249,115,22,0.22);
          background: rgba(255,255,255,0.12);
        }
        .field.has-error input {
          border-color: #f87171;
          box-shadow: 0 0 0 4px rgba(248,113,113,0.18);
        }
        .error {
          color: #fca5a5;
          font-size: 0.74rem;
          margin-top: 0.3rem;
          min-height: 1.1rem;
        }

        .btn {
          width: 100%;
          background: linear-gradient(180deg, #fb923c, var(--accent) 60%, var(--accent-hover));
          color: #fff;
          font-weight: 700;
          font-size: 1rem;
          padding: 0.8rem 1rem;
          border: none;
          border-radius: var(--radius-field);
          cursor: pointer;
          box-shadow: 0 12px 26px -10px rgba(249,115,22,0.6);
          transition: all 0.18s var(--ease);
          margin-top: 0.4rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.04); }
        .btn:disabled { opacity: 0.55; cursor: default; }

        .switch {
          text-align: center;
          font-size: 0.9rem;
          color: rgba(255,255,255,0.72);
          margin-top: 1.2rem;
        }
        .switch a {
          color: #fff;
          font-weight: 700;
          text-decoration: underline;
        }
        .switch a:hover { color: var(--accent); }

        /* شاشة النجاح */
        .success-screen { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: rgba(15,15,20,0.92); border-radius: var(--radius-card); padding: 1.5rem; }
        .success-screen__ico { width: 5rem; height: 5rem; margin-bottom: 1rem; border-radius: 999px; background: rgba(34,197,94,0.16); display: flex; align-items: center; justify-content: center; color: #22c55e; }
        .success-screen h2 { color: #fff; font-size: 1.5rem; margin: 0 0 0.5rem; }
        .success-screen p { color: rgba(255,255,255,0.75); font-size: 0.9rem; margin: 0 0 1.2rem; }

        @media (max-width: 600px) {
          .auth-welcome { display: none; }
          .auth-card { min-height: 0; max-width: 100%; max-height: none; width: 100%; }
          .auth-form {
            background: rgba(0,0,0,0.6);
            padding: 1.8rem 1.3rem 1.6rem;
            width: 100%;
          }
          .field input { font-size: 16px; padding: 0.8rem 0.9rem; }
          .btn { font-size: 1.02rem; padding: 0.9rem 1rem; min-height: 52px; }
          .back-home { padding: 0.55rem 0.85rem; }
          .auth-wrapper {
            padding: calc(env(safe-area-inset-top) + 0.75rem) 0.75rem calc(env(safe-area-inset-bottom) + 0.75rem);
            align-items: center;
          }
        }
        @media (max-width: 380px) {
          .auth-form { padding: 1.4rem 1rem 1.4rem; }
          .auth-card { border-radius: 1.25rem; }
          .brand-logo { height: 2rem; }
        }
      `}</style>

      <main className="auth-card">
        <div className="auth-card__bg" aria-hidden="true" />
        <div className="auth-card__scrim" aria-hidden="true" />
        <div className="auth-card__glow" aria-hidden="true" />

        {/* الجانب الترحيبي */}
        <aside className="auth-welcome">
          <div className="auth-welcome__copy">
            <h1>استرجاع كلمة المرور</h1>
            <p>
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور.
              افتح الرابط من رسالتك لإنشاء كلمة مرور جديدة.
            </p>
            <span className="auth-welcome__badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              اتصال مشفّر
            </span>
          </div>
        </aside>

        {/* لوحة النموذج الزجاجية */}
        <section className="auth-form">
          <div className="form-head">
            <div className="brand">
              <img src="/masahati.jpeg" alt="Masahati" className="brand-logo" />
              <span className="brand-name">Masa<span>hati</span></span>
            </div>

            <Link
              to="/"
              aria-label="العودة إلى الصفحة الرئيسية"
              className="back-home"
            >
              <span className="inline-flex">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round">
                  <path d="M14 6l-6 6 6 6" />
                </svg>
              </span>
              <span>رجوع للرئيسية</span>
            </Link>
          </div>

          <div className="relative flex-1">
            {status === 'sent' ? (
              <div className="success-screen">
                <div className="success-screen__ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="42" height="42">
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22 11 13 2 9 22 2z" />
                  </svg>
                </div>
                <h2>تم إرسال الرابط</h2>
                <p>
                  أرسلنا رابط إعادة تعيين كلمة المرور إلى{' '}
                  <b dir="ltr">{maskEmail(email)}</b>. تحقق من بريدك (ورسائل غير المرغوبة) وافتح الرابط.
                </p>
                <Link to="/login" className="btn" style={{ display: 'block', textDecoration: 'none', maxWidth: '16rem' }}>
                  الذهاب إلى تسجيل الدخول
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="animate-fadeIn">
                <h2>نسيت كلمة المرور؟</h2>
                <p className="form-sub">
                  أدخل بريدك الإلكتروني لاستلام رابط آمن لإعادة تعيين كلمة المرور.
                </p>

                <div className={`field ${emailError ? 'has-error' : ''}`}>
                  <label htmlFor="email">البريد الإلكتروني</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); if (formError) setFormError(''); }}
                    placeholder="hi@hextastudio.in"
                    dir="ltr"
                    autoComplete="email"
                  />
                  {emailError && <p className="error">{emailError}</p>}
                </div>

                {formError && <p className="error" style={{ textAlign: 'center' }}>{formError}</p>}

                <button
                  type="submit"
                  disabled={isSending}
                  className="btn"
                >
                  {isSending ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    'إرسال رابط إعادة التعيين'
                  )}
                </button>

                <p className="switch">
                  تذكّرت كلمتك؟{' '}
                  <Link to="/login">العودة لتسجيل الدخول</Link>
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
