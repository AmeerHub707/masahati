import { useState, useRef, useEffect } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Check, ArrowLeft } from 'lucide-react';
import { login, getHomePath, ApiError, request } from '../lib/authStore';
import WhatsAppBubble from '../components/common/WhatsAppBubble';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const { registrationToken = '', email = '', password = '', role = 'customer' } = state;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timerLeft, setTimerLeft] = useState(0);
  const [verified, setVerified] = useState(false);
  const otpInputsRef = useRef([]);

  // Timer logic for Resend OTP
  useEffect(() => {
    if (timerLeft <= 0) return;
    const interval = setInterval(() => setTimerLeft((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timerLeft]);

  // إذا وصلت الصفحة بدون بيانات التدفق (تحديث/دخول مباشر) نعيد للإنشاء
  if (!registrationToken || !email) {
    return <Navigate to="/signup" replace />;
  }

  const handleOtpChange = (index, value) => {
    const val = value.replace(/\D/g, '').slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    setOtpError('');

    if (val && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const newOtp = [...otp];
    pastedData.forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    if (pastedData.length > 0) {
      const nextIdx = Math.min(pastedData.length, 5);
      otpInputsRef.current[nextIdx]?.focus();
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) {
      setOtpError('الرجاء إدخال الأرقام الستة كاملة.');
      return;
    }

    setOtpError('');
    setLoading(true);
    try {
      await request('/api/verify-otp', {
        method: 'POST',
        body: { registration_token: registrationToken, code },
      });

      // تسجيل الدخول تلقائياً بعد التحقق
      const loggedIn = await login(email.trim(), password);

      if (role === 'space_owner') {
        navigate(getHomePath(loggedIn.user?.role));
      } else {
        setVerified(true);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 422 || err.status === 401 || err.status === 400)) {
        setOtpError('الرمز غير صحيح. حاول مرة أخرى.');
      } else {
        setOtpError(err.message || 'تعذر التحقق. حاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timerLeft > 0 || !registrationToken) return;
    setLoading(true);
    setOtpError('');
    try {
      await request('/api/resend-otp', {
        method: 'POST',
        body: { registration_token: registrationToken },
      });
      setOtp(['', '', '', '', '', '']);
      setTimerLeft(30);
    } catch (err) {
      setOtpError(err.message || 'تعذر إعادة إرسال الرمز.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-bg" aria-hidden="true" />
      <style>{`
        :root {
          --accent: #f97316;
          --accent-hover: #ea580c;
          --accent-soft: #fff3e9;
          --text-strong: #18181b;
          --text-muted: #71717a;
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
          .auth-bg,
          .auth-card__bg {
            animation: none;
            transform: scale(1.06);
          }
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
        .auth-welcome__list {
          list-style: none;
          margin: 1.4rem 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
        }
        .auth-welcome__list li {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.9rem;
          color: rgba(255,255,255,0.9);
        }
        .auth-welcome__list svg { width: 1.25rem; height: 1.25rem; color: var(--accent); flex: none; }

        .auth-form {
          position: relative;
          z-index: 1;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: 2rem 2rem 1.6rem;
          background: rgba(0,0,0,0.6);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--accent) transparent;
        }
        .auth-form::-webkit-scrollbar { width: 1px; }
        .auth-form::-webkit-scrollbar-track { background: transparent; }
        .auth-form::-webkit-scrollbar-thumb { background: rgba(249,115,22,0.4); border-radius: 0; }
        .auth-form::-webkit-scrollbar-thumb:hover { background: rgba(234,88,12,0.6); }
        @media (min-width: 768px) {
          .auth-form {
            width: 54%; flex: none;
            padding: 2.2rem 2.4rem 1.8rem;
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

        .otp-row { display: flex; direction: ltr; gap: 0.5rem; margin: 0.4rem 0 0.3rem; justify-content: center; }
        .otp-box {
          width: 100%; flex: 1; max-width: 3.2rem; aspect-ratio: 1 / 1.1;
          text-align: center; font-size: 1.3rem; font-weight: 700;
          border: 1.5px solid rgba(255,255,255,0.85); border-radius: var(--radius-field);
          background: rgba(255,255,255,0.06); color: #fff; outline: none; transition: all .2s;
        }
        .otp-box:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(249,115,22,0.22); background: rgba(255,255,255,0.12); }

        .error { color: #fca5a5; font-size: 0.74rem; margin-top: 0.3rem; min-height: 1.1rem; }

        .dev-note {
          margin-top: 0.8rem; padding: 0.55rem 0.75rem; border-radius: var(--radius-field);
          background: rgba(249,115,22,0.14); border: 1px dashed rgba(249,115,22,0.6);
          font-size: 0.76rem; color: #fed7aa;
        }

        .btn {
          width: 100%; background: linear-gradient(180deg, #fb923c, var(--accent) 60%, var(--accent-hover));
          color: #fff; font-weight: 700; font-size: 1rem; padding: 0.8rem 1rem;
          border: none; border-radius: var(--radius-field); cursor: pointer;
          box-shadow: 0 12px 26px -10px rgba(249,115,22,0.6);
          transition: all .18s var(--ease);
          margin-top: 0.5rem;
        }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.04); }

        .state-wrap { text-align: center; padding: 1rem 0; }
        .state-wrap h2 { color: #fff; font-size: 1.6rem; margin: 0 0 0.5rem; }
        .state-wrap p { color: rgba(255,255,255,0.75); margin: 0.5rem 0 1.5rem; line-height: 1.6; }
        .state-badge {
          width: 4rem; height: 4rem; margin: 0 auto 0.9rem; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .state-badge.ok { background: linear-gradient(180deg, #fb923c, var(--accent)); color: white; }

        @media (max-width: 600px) {
          .auth-welcome { display: none; }
          .auth-card { border-radius: 1.25rem; }
          .auth-form { background: rgba(18,16,14,0.78); padding: 1.8rem 1.3rem 1.6rem; }
          .btn { font-size: 1.02rem; padding: 0.9rem 1rem; min-height: 52px; }
          .otp-box { font-size: 1.4rem; }
          .back-home { padding: 0.6rem 1rem; min-height: 44px; }
          .auth-wrapper { padding: calc(env(safe-area-inset-top) + 0.5rem) 0.75rem calc(env(safe-area-inset-bottom) + 0.5rem); }
        }
      `}</style>

      <main className="auth-card">
        <div className="auth-card__bg" aria-hidden="true" />
        <div className="auth-card__scrim" aria-hidden="true" />
        <div className="auth-card__glow" aria-hidden="true" />

        <aside className="auth-welcome">
          <div className="auth-welcome__copy">
            <h1>خطوة أخيرة</h1>
            <p>أدخل رمز التحقق المرسل إلى بريدك لإتمام إنشاء حسابك.</p>
            <ul className="auth-welcome__list">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                رمز مكوّن من 6 أرقام
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                صالح لمدة محدودة
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                دعم فوري عبر الواتساب على مدار الساعة
              </li>
            </ul>
          </div>
        </aside>

        <section className="auth-form">
          <div className="form-head">
            <div className="brand">
              <img src="/Logo.png" alt="Masahati" className="brand-logo" />
            </div>
            <Link className="back-home" to="/">
              <ArrowLeft size={18} />
              <span>رجوع للرئيسية</span>
            </Link>
          </div>

          {verified ? (
            <div className="state-wrap">
              <div className="state-badge ok">
                <Check size={36} />
              </div>
              <h2>تم الأمر</h2>
              <p>
                تم التحقق من بريدك وحسابك كـ (طالب) في مساحاتي جاهز للاستخدام.
              </p>
              <Link to="/login" className="btn" style={{ display: 'block', textDecoration: 'none' }}>
                الذهاب لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleOtpSubmit} className="form-panel" noValidate>
              <h2>تحقق من <span style={{ color: 'var(--accent)' }}>بريدك</span></h2>
              <p className="form-sub">
                أرسلنا رمزًا مكوّنًا من 6 أرقام عبر <b>البريد الإلكتروني</b> إلى <b dir="ltr">{email}</b>. أدخله أدناه لإتمام التسجيل.
              </p>

              <div className="dev-note" style={{ marginBottom: '1rem' }}>
                تم إرسال رمز التحقق المكوّن من 6 أرقام إلى <b dir="ltr">{email}</b>. تحقق من بريدك (أو مجلد الرسائل غير المرغوبة) وأدخله أدناه.
              </div>

              <div className="otp-row">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    className="otp-box"
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                  />
                ))}
              </div>
              <p className="error">{otpError}</p>

              <button type="submit" className="btn" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </span>
                ) : 'تحقق من البريد'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '1rem', color: 'rgba(255,255,255,0.8)' }}>
                <span>لم تستلمه؟</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={timerLeft > 0 || loading}
                  style={{ background: 'none', border: 'none', color: timerLeft > 0 ? 'gray' : 'var(--accent)', fontWeight: 'bold', cursor: timerLeft > 0 || loading ? 'default' : 'pointer' }}
                >
                  {timerLeft > 0 ? `إعادة الإرسال خلال ${timerLeft}s` : 'إعادة الإرسال'}
                </button>
              </div>

              <p style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link
                  to="/signup"
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', textDecoration: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  ← تغيير البريد
                </Link>
              </p>
            </form>
          )}
        </section>

        <WhatsAppBubble />
      </main>
    </div>
  );
}