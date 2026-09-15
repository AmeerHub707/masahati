import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Building2,
  ArrowLeft,
  Upload,
  FileCheck
} from 'lucide-react';
import {
  registerCustomer,
  registerOwner,
  googleLogin,
  getHomePath,
  ApiError,
} from '../lib/authStore';
import useGoogleAuth from '../hooks/useGoogleAuth';
import WhatsAppBubble from '../components/common/WhatsAppBubble';

export default function SignupPage() {
  const navigate = useNavigate();

  // --- States ---
  const [role, setRole] = useState('customer'); // 'customer' | 'space_owner'

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    ownershipDocument: null
  });

  // Errors State
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // --- Google Auth ---
  const googleBtnRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleSuccess = async (credential) => {
    try {
      // أولاً: حاول بدون دور. إذا كان المستخدم مسجلاً بالفعل، يعيد الباك إند
      // دوره الحقيقي من قاعدة البيانات ويُتجاهل مفتاح التسجيل المحدد في الصفحة.
      const data = await googleLogin(credential);
      navigate(getHomePath(data.user?.role));
    } catch (err) {
      // إذا لم يكن البريد مسجلاً (409)، أنشئ الحساب بالدور المختار من الصفحة.
      if (err instanceof ApiError && err.status === 409 && err.data?.code === 'NOT_REGISTERED') {
        setFormError('');
        try {
          const created = await googleLogin(credential, role);
          navigate(getHomePath(created.user?.role));
        } catch (createErr) {
          console.error('Google signup (create) failed:', createErr);
          setFormError(createErr?.message || 'تعذر إنشاء الحساب عبر Google. حاول مرة أخرى.');
        }
        return;
      }
      // إظهار رسالة الفشل بدل الفشل الصامت (مثال: الباك إند لم يُطبق المسار بعد).
      console.error('Google signup failed:', err);
      setFormError(err?.message || 'تعذر إنشاء الحساب عبر Google. حاول مرة أخرى.');
    }
  };

  const handleGoogleError = (err) => {
    setFormError(err?.message || 'تعذر تسجيل الدخول عبر Google. حاول مرة أخرى.');
  };

  const { isReady: googleReady, renderButton: renderGoogleButton } = useGoogleAuth({
    clientId: googleClientId,
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
  });

  useEffect(() => {
    if (googleReady && googleBtnRef.current) {
      renderGoogleButton(googleBtnRef.current);
    }
  }, [googleReady, renderGoogleButton]);

  // --- Handlers ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, ownershipDocument: file }));
      if (errors.ownershipDocument) {
        setErrors((prev) => ({ ...prev, ownershipDocument: '' }));
      }
    }
  };

  // Step 1: Validate & Submit Register Form → ثم توجيه المستخدم لصفحة OTP
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+]?[\d\s()-]{7,}$/;

    if (!formData.name.trim()) newErrors.name = 'الرجاء إدخال الاسم الكامل.';
    if (!emailRegex.test(formData.email.trim())) newErrors.email = 'البريد الإلكتروني غير صحيح.';
    if (!phoneRegex.test(formData.phone.trim())) newErrors.phone = 'رقم الهاتف غير صحيح.';
    if (formData.password.length < 6) newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'كلمات المرور غير متطابقة.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setFormError('');
    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        password_confirmation: formData.confirmPassword,
      };

      // الباك إند يُرسل رمز OTP عبر البريد تلقائياً عند التسجيل،
      // ويرجع registration_token (UUID) اللازم لاحقاً لـ verify/resend-otp.
      let regToken = '';
      if (role === 'space_owner') {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
        if (formData.ownershipDocument) {
          fd.append('proof_document', formData.ownershipDocument);
        }
        // نتأكد من نجاح تسجيل المالك أولاً ونلتقط registration_token،
        // ثم نكمل إلى صفحة OTP فقط عند النجاح.
        try {
          const res = await registerOwner(fd);
          regToken = res?.registration_token || '';
        } catch (ownerErr) {
          if (ownerErr instanceof ApiError && ownerErr.status === 422 && ownerErr.data?.errors) {
            setErrors(ownerErr.data.errors);
            setFormError('فشل رفع وثيقة الملكية. تحقق من الملف وحاول مجدداً.');
          } else {
            setFormError(ownerErr.message || 'تعذر إكمال تسجيل المالك. حاول مرة أخرى.');
          }
          throw ownerErr; // نُعيد الرمي ليُلتقط في الـ catch الخارجي
        }
      } else {
        const res = await registerCustomer(payload);
        regToken = res?.registration_token || '';
      }

      // الباك إند أرسل الرمز بالفعل أثناء التسجيل، فقط نحتاج registration_token.
      if (!regToken) {
        setFormError('تعذر بدء التحقق: لم يُرجع الخادم رمز التسجيل.');
        return;
      }

      // توجيه المستخدم إلى صفحة OTP المخصصة /verify-otp مع بيانات التدفق
      navigate('/verify-otp', {
        state: {
          registrationToken: regToken,
          email: formData.email.trim(),
          password: formData.password,
          role,
        },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.data?.errors) {
        setErrors(err.data.errors);
        setFormError('يرجى تصحيح الحقول المعلّمة أدناه.');
      } else {
        setFormError(err.message || 'تعذر إنشاء الحساب. حاول مرة أخرى.');
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

        /* ===== البطاقة: خلفية الصورة تغطي البطاقة بالكامل ===== */
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
        .auth-form::-webkit-scrollbar { width: 1px; }
        .auth-form::-webkit-scrollbar-track { background: transparent; }
        .auth-form::-webkit-scrollbar-thumb {
          background: rgba(249,115,22,0.4);
          border-radius: 0;
        }
        .auth-form::-webkit-scrollbar-thumb:hover { background: rgba(234,88,12,0.6); }
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

        /* Segmented Control */
        .segment {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          direction: rtl;
          background: rgba(255,255,255,0.08);
          border: 1.5px solid rgba(255,255,255,0.18);
          border-radius: 999px;
          padding: 0.3rem;
          margin-bottom: 1.05rem;
        }
        .segment__thumb {
          position: absolute;
          top: 0.3rem; bottom: 0.3rem; right: 0.3rem;
          width: calc(50% - 0.3rem);
          background: linear-gradient(180deg, #fb923c, var(--accent) 60%, var(--accent-hover));
          border-radius: 999px;
          transition: transform .28s var(--ease);
          z-index: 0;
        }
        .segment.owner .segment__thumb { transform: translateX(-100%); }
        .segment__opt {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.55rem 0.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
          color: rgba(255,255,255,0.7);
          transition: color .2s var(--ease);
        }
        .segment__opt.active { color: #fff; }

        /* Fields */
        .field { margin-bottom: 0.5rem; }
        .field label { display: block; font-size: 0.82rem; margin-bottom: 0.35rem; font-weight: 600; color: rgba(255,255,255,0.9); }
        .field input {
          width: 100%; font-size: 0.92rem; padding: 0.7rem 0.9rem;
          border: 1.5px solid rgba(255,255,255,0.85); border-radius: var(--radius-field);
          background: rgba(255,255,255,0.06); color: #fff; outline: none; transition: all .2s;
        }
        .field input::placeholder { color: rgba(255,255,255,0.6); }
        .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(249,115,22,0.22); background: rgba(255,255,255,0.12); }
        .field.has-error input { border-color: #f87171; box-shadow: 0 0 0 4px rgba(248,113,113,0.18); }
        .error { color: #fca5a5; font-size: 0.74rem; margin-top: 0.3rem; min-height: 1.1rem; }
        .form-error-slot { min-height: 2.2rem; margin-top: 0.2rem; }
        .form-error-toast {
          margin: 0;
          min-height: auto;
          padding: 0.45rem 0.6rem;
          border-radius: 0.5rem;
          background: rgba(248,113,113,0.12);
          border: 1px solid rgba(248,113,113,0.35);
          color: #fca5a5;
          font-weight: 700;
          font-size: 0.8rem;
        }

        /* Document Upload Field */
        .file-upload-box {
          border: 1.5px dashed rgba(255,255,255,0.5);
          border-radius: var(--radius-field);
          padding: 0.9rem;
          text-align: center;
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.75);
          cursor: pointer;
          transition: all 0.2s;
        }
        .file-upload-box:hover { border-color: var(--accent); background: rgba(249,115,22,0.14); }
        .file-upload-box.has-file { border-color: #4ade80; border-style: solid; background: rgba(74,222,128,0.12); color: #bbf7d0; }

        /* Buttons */
        .btn {
          width: 100%; background: linear-gradient(180deg, #fb923c, var(--accent) 60%, var(--accent-hover));
          color: #fff; font-weight: 700; font-size: 1rem; padding: 0.8rem 1rem;
          border: none; border-radius: var(--radius-field); cursor: pointer;
          box-shadow: 0 12px 26px -10px rgba(249,115,22,0.6);
          transition: all .18s var(--ease);
          margin-top: 0.5rem;
        }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.04); }

        /* ===== فصل + زر تسجيل الدخول عبر Google ===== */
        .google-divider {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin: 1rem 0 0.9rem;
          color: rgba(255,255,255,0.6);
          font-size: 0.8rem;
          font-weight: 600;
        }
        .google-divider::before,
        .google-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.18);
        }
        .google-btn-wrap {
          margin-bottom: 0.4rem;
        }
        .google-btn-wrap > div {
          width: 100%;
        }
        .google-btn-hero {
          margin: 0.1rem 0 0;
        }

        /* OTP Input */
        .otp-row { display: flex; direction: ltr; gap: 0.5rem; margin: 0.4rem 0 0.3rem; justify-content: center; }
        .otp-box {
          width: 100%; flex: 1; max-width: 3.2rem; aspect-ratio: 1 / 1.1;
          text-align: center; font-size: 1.3rem; font-weight: 700;
          border: 1.5px solid rgba(255,255,255,0.85); border-radius: var(--radius-field);
          background: rgba(255,255,255,0.06); color: #fff; outline: none; transition: all .2s;
        }
        .otp-box:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(249,115,22,0.22); background: rgba(255,255,255,0.12); }

        /* State Badges */
        .state-wrap { text-align: center; padding: 1rem 0; }
        .state-wrap h2 { color: #fff; font-size: 1.6rem; margin: 0 0 0.5rem; }
        .state-wrap p { color: rgba(255,255,255,0.75); margin: 0.5rem 0 1.5rem; line-height: 1.6; }
        .state-badge {
          width: 4rem; height: 4rem; margin: 0 auto 0.9rem; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .state-badge.ok { background: linear-gradient(180deg, #fb923c, var(--accent)); color: white; }

        .dev-note {
          margin-top: 0.8rem; padding: 0.55rem 0.75rem; border-radius: var(--radius-field);
          background: rgba(249,115,22,0.14); border: 1px dashed rgba(249,115,22,0.6);
          font-size: 0.76rem; color: #fed7aa;
        }

        /* ===== ضبط دقيق للهواتف ===== */
        @media (max-width: 600px) {
          .auth-welcome { display: none; }
          .auth-card { border-radius: 1.25rem; }
          .auth-form { background: rgba(18,16,14,0.78); padding: 1.8rem 1.3rem 1.6rem; }
          .field input { font-size: 16px; padding: 0.8rem 0.9rem; }
          .field label { font-size: 0.85rem; }
          .btn { font-size: 1.02rem; padding: 0.9rem 1rem; min-height: 52px; }
          .otp-box { font-size: 1.4rem; }
          .segment__opt { padding: 0.7rem 0.5rem; font-size: 0.95rem; min-height: 48px; }
          .file-upload-box { padding: 1rem; min-height: 48px; }
          .back-home { padding: 0.6rem 1rem; min-height: 44px; }
          .auth-wrapper { padding: calc(env(safe-area-inset-top) + 0.5rem) 0.75rem calc(env(safe-area-inset-bottom) + 0.5rem); }
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
            <h1>أنشئ حسابك</h1>
            <p>انضم إلى مساحاتي وابدأ بإدارة أو حجز أفضل المساحات المتاحة لك في مكان واحد.</p>
            <ul className="auth-welcome__list">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                تسجيل سريع بخطوات بسيطة
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                خيار لصاحب المساحة مع توثيق الوثائق
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

          {/* REGISTER FORM */}
          <form onSubmit={handleRegisterSubmit} className="form-panel" noValidate>
              <h2>أنشئ <span style={{ color: 'var(--accent)' }}>حسابك</span></h2>
              <p className="form-sub">
                سجّل في مساحاتي — سنتحقق من بريدك الإلكتروني.
              </p>

              {/* Segmented Role Selector */}
              <div className={`segment ${role === 'space_owner' ? 'owner' : ''}`}>
                <span className="segment__thumb" aria-hidden="true"></span>
                <button
                  type="button"
                  className={`segment__opt ${role === 'customer' ? 'active' : ''}`}
                  onClick={() => setRole('customer')}
                >
                  <GraduationCap size={18} />
                  عميل
                </button>
                <button
                  type="button"
                  className={`segment__opt ${role === 'space_owner' ? 'active' : ''}`}
                  onClick={() => setRole('space_owner')}
                >
                  <Building2 size={18} />
                  صاحب مساحة
                </button>
              </div>

              {/* تسجيل الدخول عبر Google — الأبرز قبل الحقول، يُرسل الدور المحدد */}
              <div ref={googleBtnRef} className="google-btn-wrap google-btn-hero" aria-label="المتابعة عبر Google" />
              <div className="google-divider">أو أنشئ حساباً يدوياً</div>

              {/* Name Field */}
              <div className={`field ${errors.name ? 'has-error' : ''}`}>
                <label>الاسم الكامل</label>
                <input
                  type="text"
                  name="name"
                  placeholder="اسمك"
                  value={formData.name}
                  onChange={handleInputChange}
                />
                <p className="error">{errors.name}</p>
              </div>

              {/* Email Field */}
              <div className={`field ${errors.email ? 'has-error' : ''}`}>
                <label>البريد الإلكتروني</label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  dir="ltr"
                  value={formData.email}
                  onChange={handleInputChange}
                />
                <p className="error">{errors.email}</p>
              </div>

              {/* Phone Field */}
              <div className={`field ${errors.phone ? 'has-error' : ''}`}>
                <label>رقم الهاتف</label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+970 59 000 0000"
                  dir="ltr"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
                <p className="error">{errors.phone}</p>
              </div>

              {/* Dynamic Field: Document Ownership (Optional for Space Owner) */}
              {role === 'space_owner' && (
                <div className={`field ${errors.ownershipDocument ? 'has-error' : ''}`}>
                  <label>إثبات ملكية/إدارة مساحة (اختياري)</label>
                  <label
                    htmlFor="doc-upload"
                    className={`file-upload-box ${formData.ownershipDocument ? 'has-file' : ''}`}
                  >
                    {formData.ownershipDocument ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#166534', fontSize: '0.85rem' }}>
                        <FileCheck size={18} />
                        <span>{formData.ownershipDocument.name}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem' }}>
                        <Upload size={18} />
                        <span>ارفاق وثيقة تثبت امتلاكك لمساحة (سند ملكية / عقد إيجار / ترخيص) — اختياري</span>
                      </div>
                    )}
                  </label>
                  <input
                    type="file"
                    id="doc-upload"
                    accept=".pdf,.png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <p className="error">{errors.ownershipDocument}</p>
                </div>
              )}

              {/* Password Field */}
              <div className={`field ${errors.password ? 'has-error' : ''}`}>
                <label>كلمة المرور</label>
                <input
                  type="password"
                  name="password"
                  placeholder="٦ أحرف على الأقل"
                  value={formData.password}
                  onChange={handleInputChange}
                />
                <p className="error">{errors.password}</p>
              </div>

              {/* Confirm Password Field */}
              <div className={`field ${errors.confirmPassword ? 'has-error' : ''}`}>
                <label>تأكيد كلمة المرور</label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="أعد إدخال كلمة المرور"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                />
                <p className="error">{errors.confirmPassword}</p>
              </div>

              <div className="form-error-slot" aria-live="polite">
                {formError && <p className="error form-error-toast">{formError}</p>}
              </div>

              <button type="submit" className="btn" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </span>
                ) : 'إنشاء حساب'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '0.85rem', marginTop: '1rem', color: 'rgba(255,255,255,0.72)' }}>
                هل لديك حساب؟ <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 'bold', textDecoration: 'none' }}>تسجيل الدخول</Link>
              </p>
            </form>
        </section>

        {/* WhatsApp Support Bubble (same as landing) */}
        <WhatsAppBubble />
      </main>
    </div>
  );
}