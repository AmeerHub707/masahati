import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, ApiError } from '../lib/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    remember: false
  });
  const [errors, setErrors] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const toggleShowPassword = () => setShowPassword((s) => !s);

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id === 'login-password' ? 'password' : id === 'login-remember' ? 'remember' : 'identifier']:
        type === 'checkbox' ? checked : value
    }));
    if (id === 'login-identifier') {
      setErrors((prev) => ({ ...prev, identifier: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let valid = true;
    const newErrors = { identifier: '', password: '' };

    const identifier = formData.identifier.trim();
    const emailOk = identifier.includes('@') && identifier.includes('.') && !identifier.includes(' ');

    if (!identifier) {
      newErrors.identifier = 'الرجاء إدخال البريد الإلكتروني';
      valid = false;
    } else if (!emailOk) {
      newErrors.identifier = 'أدخل بريداً إلكترونياً صحيحاً';
      valid = false;
    }

    if (!formData.password) {
      newErrors.password = 'الرجاء إدخال كلمة المرور';
      valid = false;
    }

    setErrors(newErrors);
    setFormError('');
    if (!valid) return;

    setLoading(true);
    try {
      await login(identifier, formData.password);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 422)) {
        setFormError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else {
        setFormError(err.message || 'تعذر تسجيل الدخول. حاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
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
          --surface: #fbfbfc;
          --text-strong: #18181b;
          --text-muted: #71717a;
          --border: #e4e4e7;
          --danger: #ef4444;
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

        /* ===== البطاقة: خلفية الصورة تغطي البطاقة بالكامل (ليست نصفاً) ===== */
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

        .auth-card__bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: transparent;
          background-size: cover;
          background-position: center;
        }
        /* تظليل يضمن تباين النص: يسار (الترحيب) أغمق، يمين (النموذج) بلمسة برتقالية */
        .auth-card__scrim {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: transparent;
        }
        .auth-card__glow {
          display: none;
        }

        /* ===== الجانب الترحيبي (يسار على سطح المكتب) ===== */
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
        .auth-welcome__list svg {
          width: 1.25rem; height: 1.25rem;
          color: var(--accent);
          flex: none;
        }

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
          scrollbar-width: thin;
          scrollbar-color: var(--accent) transparent;
        }
        .auth-form::-webkit-scrollbar { width: 6px; }
        .auth-form::-webkit-scrollbar-track { background: transparent; }
        .auth-form::-webkit-scrollbar-thumb {
          background: var(--accent);
          border-radius: 999px;
        }
        .auth-form::-webkit-scrollbar-thumb:hover { background: var(--accent-hover); }
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
          margin-bottom: 1.4rem;
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
          color: #fff;
          background: rgba(249,115,22,0.18);
        }

        .auth-form h2 {
          margin: 0 0 0.35rem;
          font-size: clamp(1.5rem, 2.6vw, 2rem);
          font-weight: 800;
          color: #fff;
        }
        .form-sub {
          margin: 0 0 1.5rem;
          font-size: 0.92rem;
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
        /* فتحة ثابتة لرسائل الخطأ لتفادي اهتزاز التخطيط */
        .error {
          color: #fca5a5;
          font-size: 0.74rem;
          margin-top: 0.3rem;
          min-height: 1.1rem;
        }

        /* زر إظهار/إخفاء كلمة المرور */
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

        /* تذكرني + نسيت كلمة المرور */
        .form-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin: 0.6rem 0 1.1rem;
          flex-wrap: wrap;
        }
        .remember {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          cursor: pointer;
          user-select: none;
          color: rgba(255,255,255,0.85);
          font-size: 0.82rem;
        }
        .remember input { position: absolute; opacity: 0; width: 0; height: 0; }
        .remember .box {
          width: 1.05rem; height: 1.05rem;
          border-radius: 5px;
          border: 1.5px solid rgba(255,255,255,0.75);
          background: rgba(255,255,255,0.06);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .remember input:checked + .box {
          background: var(--accent);
          border-color: var(--accent);
        }
        .remember .box svg {
          width: 0.7rem; height: 0.7rem;
          color: #fff;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .remember input:checked + .box svg { opacity: 1; }
        .forgot {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          color: rgba(255,255,255,0.7);
          font-size: 0.8rem;
          text-decoration: none;
          transition: color 0.2s;
        }
        .forgot:hover { color: var(--accent); }

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
        }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.04); }

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

        /* ===== ضبط دقيق للهواتف ===== */
        @media (max-width: 600px) {
          .auth-welcome { display: none; }
          .auth-form {
            background: rgba(0,0,0,0.6);
            padding: 1.8rem 1.3rem 1.6rem;
          }
          .field input { font-size: 16px; padding: 0.8rem 0.9rem; }
          .btn { font-size: 1.02rem; padding: 0.9rem 1rem; min-height: 52px; }
          .back-home { padding: 0.55rem 0.85rem; }
          .auth-wrapper {
            padding: calc(env(safe-area-inset-top) + 0.5rem) 0.75rem calc(env(safe-area-inset-bottom) + 0.5rem);
          }
        }
      `}</style>

      <main className="auth-card">
        {/* خلفية الصورة تغطي البطاقة بالكامل */}
        <div className="auth-card__bg" aria-hidden="true" />
        <div className="auth-card__scrim" aria-hidden="true" />
        <div className="auth-card__glow" aria-hidden="true" />

        {/* الجانب الترحيبي */}
        <aside className="auth-welcome">
          <div className="auth-welcome__copy">
            <h1>مرحباً بعودتك</h1>
            <p>سجّل الدخول إلى حسابك في مساحاتي، واستكشف أفضل المساحات المتاحة لك في مكان واحد.</p>
            <ul className="auth-welcome__list">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                إدارة حجوزاتك ومساحاتك بسهولة
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                تتبّع مدفوعاتك وتقاريرك لحظياً
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                دعم فوري عبر الواتساب على مدار الساعة
              </li>
            </ul>
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

          <form onSubmit={handleSubmit} noValidate>
            <h2>سجّل الدخول</h2>
            <p className="form-sub">أدخل بياناتك للوصول إلى حسابك.</p>

            {formError && (
              <p className="error" aria-live="polite" style={{ color: '#fca5a5', marginBottom: '0.8rem' }}>
                {formError}
              </p>
            )}

            {/* المعرّف: بريد إلكتروني أو رقم هاتف */}
            <div className={`field ${errors.identifier ? 'has-error' : ''}`}>
              <label htmlFor="login-identifier">البريد الإلكتروني</label>
              <input
                type="text"
                id="login-identifier"
                value={formData.identifier}
                onChange={handleChange}
                placeholder="you@example.com"
                dir="ltr"
                autoComplete="username"
              />
              <p className="error" aria-live="polite">{errors.identifier}</p>
            </div>

            {/* كلمة المرور */}
            <div className={`field ${errors.password ? 'has-error' : ''}`}>
              <label htmlFor="login-password">كلمة المرور</label>
              <div className="pw-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  dir="rtl"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={toggleShowPassword}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="pw-toggle"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-[2] stroke-linecap-round stroke-linejoin-round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="4" y1="20" x2="20" y2="4" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-[2] stroke-linecap-round stroke-linejoin-round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="error" aria-live="polite">{errors.password}</p>
            </div>

            {/* تذكرني + نسيت كلمة المرور */}
            <div className="form-row">
              <label className="remember">
                <input
                  type="checkbox"
                  id="login-remember"
                  checked={formData.remember}
                  onChange={handleChange}
                />
                <span className="box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>
                </span>
                <span>تذكرني</span>
              </label>

              <Link to="/forgot" className="forgot">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-[2] stroke-linecap-round stroke-linejoin-round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                <span>هل نسيت كلمة المرور؟</span>
              </Link>
            </div>

            {/* زر الدخول */}
            <button type="submit" className="btn" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : 'تسجيل الدخول'}
            </button>

            {/* التحويل إلى إنشاء حساب */}
            <p className="switch">
              ليس لديك حساب؟{' '}
              <Link to="/signup">إنشاء حساب</Link>
            </p>
          </form>
        </section>

        {/* زر الواتساب العائم */}
        <a
          href="https://wa.me/972567653009"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تواصل عبر واتساب"
          className="fixed bottom-5 left-5 z-50 w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center shadow-[0_14px_30px_-8px_rgba(249,115,22,0.6)] hover:-translate-y-1 hover:scale-105 hover:shadow-[0_18px_36px_-8px_rgba(249,115,22,0.75)] transition-all duration-200"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.474 5.222l-.999 3.648 3.977-1.043zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.695.247-1.29.173-1.414z" />
          </svg>
        </a>
      </main>
    </div>
  );
}
