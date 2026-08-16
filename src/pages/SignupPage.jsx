import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, 
  Building2, 
  Check, 
  Clock, 
  ArrowLeft, 
  Upload, 
  FileCheck, 
  MessageCircle 
} from 'lucide-react';
import { registerEmail } from '../lib/authStore';

export default function SignupPage() {
  // --- States ---
  const [step, setStep] = useState('register'); // 'register' | 'otp' | 'done' | 'pending'
  const [role, setRole] = useState('student'); // 'student' | 'owner'
  const [otpChannel, setOtpChannel] = useState('email'); // 'email' | 'whatsapp'
  const [showChannelModal, setShowChannelModal] = useState(false);

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

  // OTP State
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [expectedOtp, setExpectedOtp] = useState('');
  const [timerLeft, setTimerLeft] = useState(0);
  const otpInputsRef = useRef([]);

  // Timer logic for Resend OTP
  useEffect(() => {
    if (timerLeft <= 0) return;
    const interval = setInterval(() => setTimerLeft((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timerLeft]);

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

  // Step 1: Validate & Submit Register Form
  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+]?[\d\s()-]{7,}$/;

    if (!formData.name.trim()) newErrors.name = 'الرجاء إدخال الاسم الكامل.';
    if (!emailRegex.test(formData.email.trim())) newErrors.email = 'البريد الإلكتروني غير صحيح.';
    if (!phoneRegex.test(formData.phone.trim())) newErrors.phone = 'رقم الهاتف غير صحيح.';
    if (formData.password.length < 6) newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'كلمات المرور غير متطابقة.';

    // شرط إضافي لصاحب المساحة: إرفاق وثيقة اثبات ملكية
    if (role === 'owner' && !formData.ownershipDocument) {
      newErrors.ownershipDocument = 'يرجى إرفاق وثيقة تثبت ملكيتك أو إدارتك لمساحة واحدة على الأقل.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // عرض نافذة اختيار قناة استلام الرمز (بريد أو هاتف)
    setShowChannelModal(true);
  };

  // اختيار القناة من النافذة المنبثقة ثم توليد الرمز
  const confirmChannel = (channel) => {
    setOtpChannel(channel);
    setShowChannelModal(false);

    // توليد رمز تحقق تجريبي
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    setExpectedOtp(generatedOtp);
    console.log(`[DEMO OTP via ${channel}]:`, generatedOtp);

    setTimerLeft(30);
    setStep('otp');
  };

  // OTP Handlers
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

  // Step 2: Verify OTP & Branching based on Role
  const handleOtpSubmit = (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) {
      setOtpError('الرجاء إدخال الأرقام الستة كاملة.');
      return;
    }

    if (code !== expectedOtp) {
      setOtpError('الرمز غير صحيح. حاول مرة أخرى.');
      return;
    }

    // توجيه المستخدم حسب الصلاحيات:
    // الطالب -> تم التفعيل مباشرة ('done')
    // صاحب المساحة -> بانتظار موافقة الادارة على وثيقة الملكية والحساب ('pending')
    registerEmail(formData.email);
    if (role === 'owner') {
      setStep('pending');
    } else {
      setStep('done');
    }
  };

  const handleResendOtp = () => {
    if (timerLeft > 0) return;
    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    setExpectedOtp(newCode);
    console.log(`[RESENT DEMO OTP]:`, newCode);
    setOtp(['', '', '', '', '', '']);
    setTimerLeft(30);
  };

  return (
    <div className="auth-wrapper">
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
          height: 100vh;
          height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(0.75rem, 4vh, 2.5rem) 1.25rem;
          background-image: url("background.jpeg");
          background-size: cover;
          background-position: center;
          position: relative;
          overflow: hidden;
          font-family: 'Cairo', sans-serif;
          direction: rtl;
        }

        .auth-wrapper::before {
          content: "";
          position: fixed;
          inset: 0;
          background: linear-gradient(160deg, rgba(0,0,0,0.58), rgba(0,0,0,0.38));
          z-index: 0;
        }

        .auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 54rem;
          max-height: 100%;
          display: flex;
          flex-direction: column;
          border-radius: var(--radius-card);
          overflow: hidden;
          box-shadow: var(--shadow), 0 0 0 1px rgba(249,115,22,0.08);
          background: var(--surface);
          border: 1px solid rgba(255,255,255,0.6);
        }

        @media (min-width: 768px) {
          .auth-card { flex-direction: row; min-height: 32rem; }
        }

        .auth-visual {
          position: relative;
          z-index: 1;
          min-height: 14rem;
          background-image: url("Loginside.jpg");
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: flex-end;
          padding: 1.9rem;
          color: #fff;
        }
        @media (min-width: 768px) {
          .auth-visual { width: 46%; flex: none; }
        }

        .auth-form {
          position: relative;
          z-index: 1;
          flex: 1;
          min-height: 0;
          padding: 1.9rem 2.1rem 1.6rem;
          display: flex;
          flex-direction: column;
          background: var(--surface);
          overflow-y: auto;
        }
        @media (min-width: 768px) { .auth-form { width: 54%; padding: 2.1rem 2.6rem 1.9rem; } }

        .form-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          width: 100%;
          margin-bottom: 1.25rem;
        }

        .brand { display: flex; align-items: center; gap: .6rem; }
        .brand-logo { height: 2.4rem; width: auto; object-fit: contain; }
        .brand-name { font-size: 1.4rem; font-weight: 800; color: var(--text-strong); direction: ltr; }
        .brand-name span { color: var(--accent); }

        .back-home {
          display: inline-flex;
          align-items: center;
          gap: .45rem;
          font-weight: 700;
          font-size: .85rem;
          color: #fb923c;
          text-decoration: none;
          padding: .5rem .95rem;
          border: 1.5px solid #fed7aa;
          border-radius: 999px;
          transition: all .2s var(--ease);
        }
        .back-home:hover {
          border-color: #fdba74;
          color: #ea580c;
          background: rgba(253,186,116,.12);
        }

        /* Segmented Control */
        .segment {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          direction: rtl;
          background: #fff;
          border: 1.5px solid var(--border);
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
          color: var(--text-muted);
          transition: color .2s var(--ease);
        }
        .segment__opt.active { color: #fff; }

        /* Fields */
        .field { margin-bottom: 0.6rem; }
        .field label { display: block; font-size: 0.8rem; margin-bottom: 0.3rem; font-weight: 600; }
        .field input {
          width: 100%; font-size: 0.92rem; padding: 0.55rem 0.8rem;
          border: 1.5px solid var(--border); border-radius: var(--radius-field);
          background: #fff; color: #000; outline: none; transition: all .2s;
        }
        .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(249,115,22,0.15); }
        .field.has-error input { border-color: var(--danger); box-shadow: 0 0 0 4px rgba(239,68,68,0.12); }
        .error { color: var(--danger); font-size: 0.72rem; margin-top: 0.25rem; min-height: 0.85rem; }

        /* Document Upload Field */
        .file-upload-box {
          border: 1.5px dashed var(--border);
          border-radius: var(--radius-field);
          padding: 0.75rem;
          text-align: center;
          background: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }
        .file-upload-box:hover { border-color: var(--accent); background: var(--accent-soft); }
        .file-upload-box.has-file { border-color: #22c55e; background: #f0fdf4; }

        /* Buttons */
        .btn {
          width: 100%; background: linear-gradient(180deg, #fb923c, var(--accent) 60%, var(--accent-hover));
          color: #fff; font-weight: 600; font-size: 0.98rem; padding: 0.7rem 1rem;
          border: none; border-radius: var(--radius-field); cursor: pointer;
          box-shadow: 0 10px 24px -8px rgba(249,115,22,0.6);
          transition: all .18s var(--ease);
          margin-top: 0.5rem;
        }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.04); }

        /* OTP Input */
        .otp-row { display: flex; direction: ltr; gap: 0.5rem; margin: 0.5rem 0; }
        .otp-box {
          width: 100%; flex: 1; aspect-ratio: 1 / 1.1;
          text-align: center; font-size: 1.3rem; font-weight: 700;
          border: 1.5px solid var(--border); border-radius: var(--radius-field);
          outline: none;
        }
        .otp-box:focus { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(249,115,22,0.15); }

        /* State Badges */
        .state-wrap { text-align: center; padding: 1rem 0; }
        .state-badge {
          width: 4rem; height: 4rem; margin: 0 auto 0.9rem; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .state-badge.ok { background: linear-gradient(180deg, #fb923c, var(--accent)); color: white; }
        .state-badge.pending { background: linear-gradient(180deg, #fbbf24, #f59e0b); color: white; }

        .dev-note {
          margin-top: 0.8rem; padding: 0.55rem 0.75rem; border-radius: var(--radius-field);
          background: var(--accent-soft); border: 1px dashed rgba(249,115,22,0.5);
          font-size: 0.76rem; color: #9a3412;
        }

        .wa-bubble {
          position: fixed; bottom: 1.4rem; left: 1.4rem; z-index: 90; width: 3.4rem; height: 3.4rem;
          border-radius: 50%; background: var(--accent); display: flex; align-items: center;
          justify-content: center; color: white; box-shadow: 0 14px 30px -8px rgba(249,115,22,.6);
        }
      `}</style>

      <main className="auth-card">
        {/* Visual Side */}
        <aside className="auth-visual">
          <div className="auth-visual__copy"></div>
        </aside>

        {/* Form Panel */}
        <section className="auth-form">
          <div className="form-head">
            <div className="brand">
              <img src="masahati.jpeg" alt="Masahati" className="brand-logo" />
              <span className="brand-name">Masa<span>hati</span></span>
            </div>

            <Link className="back-home" to="/">
              <ArrowLeft size={18} />
              <span>رجوع للرئيسية</span>
            </Link>
          </div>

          {/* STEP 1: REGISTER FORM */}
          {step === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="form-panel" noValidate>
              <h2>أنشئ <span style={{ color: 'var(--accent)' }}>حسابك</span></h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                سجّل في مساحاتي — سنتحقق من بريدك الإلكتروني.
              </p>

              {/* Segmented Role Selector */}
              <div className={`segment ${role === 'owner' ? 'owner' : ''}`}>
                <span className="segment__thumb" aria-hidden="true"></span>
                <button
                  type="button"
                  className={`segment__opt ${role === 'student' ? 'active' : ''}`}
                  onClick={() => setRole('student')}
                >
                  <GraduationCap size={18} />
                  طالب
                </button>
                <button
                  type="button"
                  className={`segment__opt ${role === 'owner' ? 'active' : ''}`}
                  onClick={() => setRole('owner')}
                >
                  <Building2 size={18} />
                  صاحب مساحة
                </button>
              </div>

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

              {/* Dynamic Field: Document Ownership (Required ONLY for Space Owner) */}
              {role === 'owner' && (
                <div className={`field ${errors.ownershipDocument ? 'has-error' : ''}`}>
                  <label>إثبات ملكية/إدارة مساحة</label>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <Upload size={18} />
                        <span>ارفاق وثيقة تثبت امتلاكك لمساحة (سند ملكية / عقد إيجار / ترخيص)</span>
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

              <button type="submit" className="btn">إنشاء حساب</button>

              <p style={{ textAlign: 'center', fontSize: '0.85rem', marginTop: '1rem', color: 'var(--text-muted)' }}>
                هل لديك حساب؟ <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 'bold', textDecoration: 'none' }}>تسجيل الدخول</Link>
              </p>
            </form>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="form-panel" noValidate>
              <h2>تحقق من <span style={{ color: 'var(--accent)' }}>بريدك</span></h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                أرسلنا رمزًا مكوّنًا من 6 أرقام عبر <b>{otpChannel === 'whatsapp' ? 'واتساب' : 'البريد الإلكتروني'}</b>
                {otpChannel === 'email' ? <> إلى <b>{formData.email}</b></> : <> إلى رقم <b dir="ltr">{formData.phone}</b></>} . أدخله أدناه لإتمام التسجيل.
              </p>

              {/* Demo Notice */}
              <div className="dev-note" style={{ marginBottom: '1rem' }}>
                <b>وضع تجريبي:</b> الرمز المولد للتجربة ({otpChannel === 'whatsapp' ? 'واتساب' : 'بريد'}) هو: <b>{expectedOtp}</b>
              </div>

              <div className="otp-row">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    className="otp-box"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                  />
                ))}
              </div>
              <p className="error">{otpError}</p>

              <button type="submit" className="btn">تحقق من البريد</button>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '1rem', color: 'var(--text-muted)' }}>
                <span>لم تستلمه؟</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={timerLeft > 0}
                  style={{ background: 'none', border: 'none', color: timerLeft > 0 ? 'gray' : 'var(--accent)', fontWeight: 'bold', cursor: timerLeft > 0 ? 'default' : 'pointer' }}
                >
                  {timerLeft > 0 ? `إعادة الإرسال خلال ${timerLeft}s` : 'إعادة الإرسال'}
                </button>
              </div>

              <p style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setStep('register')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  ← تغيير البريد
                </button>
              </p>
            </form>
          )}

          {/* STEP 3A: STUDENT SUCCESS */}
          {step === 'done' && (
            <div className="form-panel state-wrap">
              <div className="state-badge ok">
                <Check size={36} />
              </div>
              <h2>تم الأمر</h2>
              <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>
                تم التحقق من بريدك وحسابك كـ (طالب) في مساحاتي جاهز للاستخدام.
              </p>
              <Link to="/login" className="btn" style={{ display: 'block', textDecoration: 'none' }}>
                الذهاب لتسجيل الدخول
              </Link>
            </div>
          )}

          {/* STEP 3B: OWNER PENDING APPROVAL */}
          {step === 'pending' && (
            <div className="form-panel state-wrap">
              <div className="state-badge pending">
                <Clock size={36} />
              </div>
              <h2>بانتظار موافقة الإدارة</h2>
              <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem', lineHeight: '1.6' }}>
                شكرًا لانضمامك كصاحب مساحة! تم استلام بياناتك ووثيقة الملكية بنجاح. سيقوم فريق الإدارة بمراجعة الوثائق وتفعيل حسابك قريبًا، وسنحيطك علمًا عبر البريد الإلكتروني.
              </p>
              <Link to="/" className="btn" style={{ display: 'block', textDecoration: 'none' }}>
                العودة للرئيسية
              </Link>
            </div>
          )}
        </section>

        {/* WhatsApp Support Bubble */}
        <a
          className="wa-bubble"
          href="https://wa.me/972567653009"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تواصل عبر واتساب"
        >
          <MessageCircle size={24} />
        </a>
      </main>

      {/* نافذة اختيار قناة استلام رمز التحقق */}
      {showChannelModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowChannelModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.55)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
        >
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
            style={{
              width: '100%', maxWidth: '24rem', background: '#fff',
              borderRadius: '1.25rem', padding: '1.75rem', textAlign: 'center',
              boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)'
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-strong)' }}>
              كيف تريد استلام رمز التحقق؟
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              اختر القناة المفضّلة لإرسال الرمز المكوّن من 6 أرقام.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => confirmChannel('email')}
                style={{
                  padding: '0.75rem', borderRadius: 'var(--radius-field)', border: '1.5px solid var(--accent)',
                  background: 'var(--accent-soft)', color: 'var(--accent-hover)',
                  fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
                }}
              >
                البريد الإلكتروني ({formData.email})
              </button>
              <button
                type="button"
                onClick={() => confirmChannel('whatsapp')}
                style={{
                  padding: '0.75rem', borderRadius: 'var(--radius-field)', border: '1.5px solid var(--accent)',
                  background: 'var(--accent-soft)', color: 'var(--accent-hover)',
                  fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
                }}
              >
                واتساب ({formData.phone})
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowChannelModal(false)}
              style={{
                marginTop: '1.25rem', background: 'none', border: 'none',
                color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}