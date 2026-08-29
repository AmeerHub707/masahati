import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { request, ApiError } from '../lib/authStore';

// ترجمة رسائل الخطأ الإنجليزية القادمة من Laravel إلى العربية.
function translateError(msg, status) {
  if (status === 405) {
    return 'رابط إعادة التعيين مفتوح بطريقة غير صحيحة. انسخ الرابط وافتحه في المتصفح، أو اطلب رابطاً جديداً.';
  }
  if (!msg) return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
  const m = String(msg).toLowerCase();
  if (m.includes('token')) return 'رابط إعادة التعيين غير صالح أو منتهٍ. اطلب رابطاً جديداً.';
  if (m.includes('password') && (m.includes('reset') || m.includes('short') || m.includes('min') || m.includes('at least') || m.includes('characters')))
    return 'كلمة المرور يجب ألا تقل عن 8 أحرف.';
  if (m.includes('mismatch') || m.includes('confirmation'))
    return 'كلمتا المرور غير متطابقتين.';
  if (m.includes('selected email is invalid')) return 'هذا البريد غير صحيح. اطلب رابطاً جديداً.';
  return msg;
}

const EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // الباك إند يمرّر التوكن والبريد في رابط الإعادة.
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  // رابط بلا توكن = غير صالح (نحسب الحالة من الدعائم بدل setState داخل effect).
  const [isInvalidLink] = useState(!token);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'done'
  const [isResetting, setIsResetting] = useState(false);

  const getPasswordStrength = (p) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return Math.min(score, 4);
  };
  const passwordScore = getPasswordStrength(password);
  const strengthLabels = ['—', 'ضعيف', 'متوسط', 'جيد', 'ممتاز'];

  const validate = () => {
    let valid = true;
    setPasswordError('');
    setConfirmPasswordError('');
    setFormError('');

    if (!EMAIL_REGEX.test(email)) {
      setFormError('رابط إعادة التعيين غير مكتمل (البريد مفقود). اطلب رابطاً جديداً.');
      valid = false;
    }
    if (password.length < 8) {
      setPasswordError('كلمة المرور يجب ألا تقل عن 8 أحرف.');
      valid = false;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError('كلمتا المرور غير متطابقتين.');
      valid = false;
    }
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsResetting(true);
    setStatus('submitting');
    try {
      // الباك إند يتحقق من التوكن والبريد ويعيّن كلمة المرور الجديدة.
      await request('/api/reset-password', {
        method: 'POST',
        body: {
          email: email.trim(),
          token,
          password,
          password_confirmation: confirmPassword,
        },
      });
      setStatus('done');
      setTimeout(() => navigate('/login'), 2200);
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) {
        const e = err.data.errors;
        if (e.password) setPasswordError(translateError(Array.isArray(e.password) ? e.password[0] : e.password, err.status));
        if (e.token) setFormError(translateError(Array.isArray(e.token) ? e.token[0] : e.token, err.status));
        if (e.email) setFormError(translateError(Array.isArray(e.email) ? e.email[0] : e.email, err.status));
        if (!e.password && !e.token && !e.email) {
          setFormError(translateError(err.message, err.status));
        }
      } else if (err instanceof ApiError) {
        setFormError(translateError(err.message, err.status));
      } else {
        setFormError('تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.');
      }
      setStatus('idle');
    } finally {
      setIsResetting(false);
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
          .auth-bg { animation: none; transform: scale(1.06); }
        }

        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 50rem;
          max-height: 100%;
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

        .auth-card__bg { position: absolute; inset: 0; z-index: 0; background: transparent; }
        .auth-card__scrim { position: absolute; inset: 0; z-index: 0; background: transparent; }
        .auth-card__glow { display: none; }

        .auth-welcome {
          position: relative;
          z-index: 1;
          display: flex;
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
        .back-home:hover { border-color: var(--accent); background: rgba(249,115,22,0.18); }

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

        .pw-wrap { position: relative; }
        .pw-toggle {
          position: absolute;
          left: 8px; top: 50%;
          transform: translateY(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2rem; height: 2rem;
          color: rgba(255,255,255,0.85);
          background: transparent;
          border: none;
          cursor: pointer;
          border-radius: 0.5rem;
          transition: color 0.2s;
        }
        .pw-toggle:hover { color: var(--accent); }

        .strength { margin: 0.4rem 0 1rem; }
        .strength__bars { display: flex; gap: 0.4rem; height: 0.4rem; margin-bottom: 0.4rem; }
        .strength__bars span { flex: 1; border-radius: 999px; background: rgba(255,255,255,0.2); transition: background 0.3s; }
        .strength__bars span.on-1 { background: #ef4444; }
        .strength__bars span.on-2 { background: var(--accent); }
        .strength__bars span.on-3 { background: #2563eb; }
        .strength__bars span.on-4 { background: #16a34a; }
        .strength-label { font-size: 0.75rem; color: rgba(255,255,255,0.75); }
        .strength-label b { color: #fff; }

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
        .switch a { color: #fff; font-weight: 700; text-decoration: underline; }
        .switch a:hover { color: var(--accent); }

        .success-screen { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: rgba(15,15,20,0.92); border-radius: var(--radius-card); padding: 1.5rem; }
        .success-screen__ico { width: 5rem; height: 5rem; margin-bottom: 1rem; border-radius: 999px; background: rgba(34,197,94,0.16); display: flex; align-items: center; justify-content: center; color: #22c55e; }
        .success-screen h2 { color: #fff; font-size: 1.5rem; margin: 0 0 0.5rem; }
        .success-screen p { color: rgba(255,255,255,0.75); font-size: 0.9rem; margin: 0; }

        @media (max-width: 600px) {
          .auth-welcome { display: none; }
          .auth-form { background: rgba(0,0,0,0.6); padding: 1.8rem 1.3rem 1.6rem; }
          .field input { font-size: 16px; padding: 0.8rem 0.9rem; }
          .btn { font-size: 1.02rem; padding: 0.9rem 1rem; min-height: 52px; }
          .back-home { padding: 0.55rem 0.85rem; }
          .auth-wrapper {
            padding: calc(env(safe-area-inset-top) + 0.5rem) 0.75rem calc(env(safe-area-inset-bottom) + 0.5rem);
          }
        }
      `}</style>

      <main className="auth-card">
        <div className="auth-card__bg" aria-hidden="true" />
        <div className="auth-card__scrim" aria-hidden="true" />
        <div className="auth-card__glow" aria-hidden="true" />

        <aside className="auth-welcome">
          <div className="auth-welcome__copy">
            <h1>كلمة مرور جديدة</h1>
            <p>
              أنشئ كلمة مرور قوية لحسابك في مساحاتي. تأكد من تطابق الحقلين قبل الحفظ.
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

        <section className="auth-form">
          <div className="form-head">
            <div className="brand">
              <img src="/masahati.jpeg" alt="Masahati" className="brand-logo" />
              <span className="brand-name">Masa<span>hati</span></span>
            </div>

            <Link to="/" aria-label="العودة إلى الصفحة الرئيسية" className="back-home">
              <span className="inline-flex">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round">
                  <path d="M14 6l-6 6 6 6" />
                </svg>
              </span>
              <span>رجوع للرئيسية</span>
            </Link>
          </div>

          <div className="relative flex-1">
            {status === 'done' ? (
              <div className="success-screen">
                <div className="success-screen__ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="42" height="42">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h2>تم تغيير كلمة المرور</h2>
                <p>سيتم توجيهك إلى تسجيل الدخول الآن…</p>
              </div>
            ) : isInvalidLink ? (
              <div className="success-screen">
                <div className="success-screen__ico" style={{ background: 'rgba(248,113,113,0.16)', color: '#f87171' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="42" height="42">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                </div>
                <h2>الرابط غير صالح</h2>
                <p>رابط إعادة التعيين مفقود أو منتهٍ. اطلب رابطاً جديداً من صفحة نسيت كلمة المرور.</p>
                <Link to="/forgot" className="btn" style={{ display: 'block', textDecoration: 'none', maxWidth: '16rem' }}>
                  طلب رابط جديد
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="animate-fadeIn">
                <h2>تعيين كلمة مرور جديدة</h2>
                <p className="form-sub">
                  {email ? (
                    <>أدخل كلمة المرور الجديدة لحساب <b dir="ltr">{email}</b>.</>
                  ) : (
                    <>أدخل كلمة المرور الجديدة لحسابك.</>
                  )}
                </p>

                <div className={`field ${passwordError ? 'has-error' : ''}`}>
                  <label htmlFor="password">كلمة المرور الجديدة</label>
                  <div className="pw-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(''); if (formError) setFormError(''); }}
                      placeholder="٨ أحرف على الأقل"
                      autoComplete="new-password"
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowPassword((s) => !s)} aria-label="إظهار/إخفاء">
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                  <div className="strength">
                    <div className="strength__bars">
                      {[0,1,2,3].map((i) => (
                        <span key={i} className={passwordScore > i ? `on-${passwordScore}` : ''} />
                      ))}
                    </div>
                    <div className="strength-label">قوة كلمة المرور: <b>{strengthLabels[passwordScore]}</b></div>
                  </div>
                  {passwordError && <p className="error">{passwordError}</p>}
                </div>

                <div className={`field ${confirmPasswordError ? 'has-error' : ''}`}>
                  <label htmlFor="confirmPassword">تأكيد كلمة المرور</label>
                  <div className="pw-wrap">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); if (confirmPasswordError) setConfirmPasswordError(''); if (formError) setFormError(''); }}
                      placeholder="أعد إدخال كلمة المرور"
                      autoComplete="new-password"
                    />
                    <button type="button" className="pw-toggle" onClick={() => setShowConfirmPassword((s) => !s)} aria-label="إظهار/إخفاء">
                      {showConfirmPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                  {confirmPasswordError && <p className="error">{confirmPasswordError}</p>}
                </div>

                {formError && <p className="error" style={{ textAlign: 'center' }}>{formError}</p>}

                <button type="submit" disabled={isResetting} className="btn">
                  {isResetting ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    'تعيين كلمة المرور'
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
