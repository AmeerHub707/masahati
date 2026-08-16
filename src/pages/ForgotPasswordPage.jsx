import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isEmailRegistered } from '../lib/authStore';

const OTP_LEN = 6;
const OTP_TTL_SECONDS = 300; // 5 دقائق
const RESEND_WAIT_SECONDS = 45;
const MAX_RESEND_TRIES = 3;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // ----- الحالات الخاصة بالخطوات والـ Wizard -----
  const [step, setStep] = useState(1); // 1, 2, 3, أو 'done'
  
  // الخطوة 1: البريد الإلكتروني
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpChannel, setOtpChannel] = useState('email'); // 'email' | 'whatsapp'
  const [emailError, setEmailError] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // الخطوة 2: الـ OTP والعدادات
  const [otp, setOtp] = useState(Array(OTP_LEN).fill(''));
  const [sentOtpCode, setSentOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [timerRemain, setTimerRemain] = useState(OTP_TTL_SECONDS);
  const [resendRemain, setResendRemain] = useState(RESEND_WAIT_SECONDS);
  const [resendTries, setResendTries] = useState(0);
  const [isShake, setIsShake] = useState(false);
  const [showMailOverlay, setShowMailOverlay] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);

  // الخطوة 3: كلمة المرور الجديدة
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // مراجع عناصر الإدخال
  const otpInputsRef = useRef([]);

  // توليد OTP عشوائي
  const generateOTP = () => {
    let code = '';
    for (let i = 0; i < OTP_LEN; i++) {
      code += Math.floor(Math.random() * 10);
    }
    return code;
  };

  // إخفاء جزء من البريد الإلكتروني لدواعي الأمان
  const maskEmail = (e) => {
    const [u, d] = e.split('@');
    if (!d) return e;
    const head = u.length > 2 ? u[0] + '•••' + u.slice(-1) : u[0] + '••';
    return head + '@' + d;
  };

  // العداد التنازلي للرمز وإعادة الإرسال
  useEffect(() => {
    let interval = null;
    if (step === 2) {
      interval = setInterval(() => {
        setTimerRemain((prev) => (prev > 0 ? prev - 1 : 0));
        setResendRemain((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step]);

  // صيغة الوقت التنازلي mm:ss
  const formatTime = (totalSec) => {
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // ----- معالجة الخطوة الأولى (إرسال الرمز) -----
  const handleRequestOtp = (e) => {
    e.preventDefault();
    setEmailError('');

    if (otpChannel === 'email') {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      if (!isValidEmail) {
        setEmailError('الرجاء إدخال بريد إلكتروني صحيح.');
        return;
      }
      // التحقق من أن البريد مسجّل فعلاً قبل إرسال الرمز
      if (!isEmailRegistered(email)) {
        setEmailError('هذا البريد غير مسجّل لدينا. أنشئ حساباً أو تأكد من البريد.');
        return;
      }
    } else {
      if (!/^[+]?[\d\s()-]{7,}$/.test(phone.trim())) {
        setEmailError('الرجاء إدخال رقم هاتف صحيح لاستلام الرمز عبر واتساب.');
        return;
      }
    }

    setIsSendingOtp(true);

    // محاكاة إرسال طلب للباك إند (القناة: بريد أو واتساب)
    setTimeout(() => {
      const generated = generateOTP();
      setSentOtpCode(generated);
      console.log(`[DEMO OTP via ${otpChannel}]:`, generated);
      setTimerRemain(OTP_TTL_SECONDS);
      setResendRemain(RESEND_WAIT_SECONDS);
      setResendTries(0);
      setIsSendingOtp(false);
      setStep(2);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    }, 1000);
  };

  // ----- معالجة إدخال وحقول الـ OTP -----
  const handleOtpChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = cleanValue;
    setOtp(newOtp);
    setOtpError('');

    if (cleanValue && index < OTP_LEN - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LEN - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (!pastedData) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    const focusIndex = Math.min(pastedData.length, OTP_LEN - 1);
    otpInputsRef.current[focusIndex]?.focus();
  };

  // إعادة إرسال الـ OTP
  const handleResend = () => {
    if (resendRemain > 0 || resendTries >= MAX_RESEND_TRIES) return;

    setResendTries((prev) => prev + 1);
    const generated = generateOTP();
    setSentOtpCode(generated);
    setOtp(Array(OTP_LEN).fill(''));
    setOtpError('');
    setTimerRemain(OTP_TTL_SECONDS);
    setResendRemain(RESEND_WAIT_SECONDS);
    setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
  };

  // معالجة الخطوة الثانية (التحقق من الرمز)
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (timerRemain <= 0) {
      setOtpError('انتهت صلاحية الرمز. اطلب رمزاً جديداً.');
      return;
    }

    const enteredCode = otp.join('');
    if (enteredCode !== sentOtpCode) {
      setOtpError('الرمز غير صحيح. حاول مرة أخرى.');
      setIsShake(true);
      setTimeout(() => setIsShake(false), 450);
      return;
    }

    setIsVerifyingOtp(true);
    setTimeout(() => {
      setIsVerifyingOtp(false);
      setStep(3);
    }, 600);
  };

  // ----- حساب قوة كلمة المرور -----
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

  // ----- معالجة الخطوة الثالثة (تغيير كلمة المرور) -----
  const handleResetPassword = (e) => {
    e.preventDefault();
    let valid = true;

    if (password.length < 8) {
      setPasswordError('كلمة المرور يجب ألا تقل عن 8 أحرف.');
      valid = false;
    } else {
      setPasswordError('');
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('كلمتا المرور غير متطابقتين.');
      valid = false;
    } else {
      setConfirmPasswordError('');
    }

    if (!valid) return;

    setIsResetting(true);
    setTimeout(() => {
      setIsResetting(false);
      setStep('done');
      setTimeout(() => {
        navigate('/login');
      }, 2200);
    }, 1000);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sentOtpCode);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 1500);
  };

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center p-5 bg-cover bg-center bg-no-repeat overflow-hidden font-['Cairo'] text-zinc-900 dir-rtl"
      style={{ backgroundImage: "url('/background.jpeg')" }}
    >
      {/* طبقة التعتيم والتوهج الخلفية */}
      <div className="fixed inset-0 bg-gradient-to-br from-black/55 to-black/35 -z-10" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46rem] h-[46rem] bg-[radial-gradient(circle,rgba(249,115,22,0.38)_0%,rgba(249,115,22,0.12)_40%,transparent_70%)] blur-2xl -z-10 pointer-events-none" />

      {/* الكارت الرئيسي (Auth Card) */}
      <main className="relative w-full max-w-[52rem] my-auto max-h-full flex flex-col md:flex-row md:min-h-[34rem] rounded-3xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55),0_0_0_2px_rgba(249,115,22,0.22),0_40px_90px_-25px_rgba(249,115,22,0.55)] bg-zinc-100 border border-white/75 isolate">
        
        {/* تأثير اللمعان الجانبي والشرائط */}
        <div className="absolute inset-0 z-[2] pointer-events-none bg-[radial-gradient(130%_70%_at_0%_0%,rgba(249,115,22,0.20),transparent_50%),radial-gradient(130%_70%_at_100%_100%,rgba(249,115,22,0.14),transparent_50%)]" />
        <div className="hidden md:block absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {[2, 8, 14, 20, 26, 32].map((left, idx) => (
            <span key={idx} className="absolute top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-black to-white/20 opacity-30 blur-md translate-x-[36rem]" style={{ left: `${left}rem` }} />
          ))}
        </div>
        <span className="absolute w-60 h-60 bg-orange-500 -bottom-24 -right-16 rounded-full opacity-90 blur-[2px] z-0 pointer-events-none" />
        <span className="absolute w-32 h-20 bg-white bottom-6 right-8 rounded-full opacity-35 z-0 pointer-events-none" />
        <span className="absolute w-32 h-20 bg-white bottom-12 right-40 rounded-full opacity-35 z-0 pointer-events-none" />

        {/* الجانب البصري والتوعوي */}
        <aside className="relative z-[1] min-h-[14rem] md:w-[48%] md:flex-none bg-cover bg-center flex items-end p-7 text-white" style={{ backgroundImage: "url('/Loginside.jpg')" }}>
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-orange-500/45 via-orange-600/22 to-transparent mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
          
          <div className="relative z-10 max-w-[22rem]">
            <h1 className="m-0 text-2xl md:text-3xl font-medium tracking-tight leading-tight">أمان حسابك أولاً</h1>
            <p className="mt-2 text-sm opacity-90 leading-relaxed">
              نستخدم رمز تحقق لمرة واحدة (OTP) لحماية بياناتك. حتى لو عرف أحد بريدك، لا يمكنه تغيير كلمتك دون الرمز.
            </p>
            <span className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold bg-white/16 border border-white/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              اتصال مشفّر
            </span>
          </div>
        </aside>

        {/* قسم النماذج والخطوات */}
        <section className="relative z-[1] flex-1 p-8 md:p-11 flex flex-col bg-zinc-100">
          
          {/* الهيدر العلوي */}
          <div className="flex items-center justify-between gap-4 flex-nowrap w-full mb-5">
            <div className="flex items-center gap-2.5 flex-none m-0">
              <img src="/masahati.jpeg" alt="Masahati" className="h-9 w-auto object-contain drop-shadow-[0_6px_14px_rgba(249,115,22,0.30)]" />
              <span className="text-2xl font-extrabold tracking-tight leading-none text-zinc-900 dir-ltr inline-flex items-baseline">
                Masa<span className="text-orange-500">hati</span>
              </span>
            </div>

            <Link
              to="/"
              className="flex-none inline-flex items-center gap-2 font-bold text-sm text-orange-400 whitespace-nowrap px-4 py-2 bg-transparent border-[1.5px] border-orange-200 rounded-full transition-all duration-200 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-300/12 hover:-translate-y-0.5 active:translate-y-0.5"
            >
              <span className="inline-flex transition-transform duration-250 hover:-translate-x-1">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round">
                  <path d="M14 6l-6 6 6 6" />
                </svg>
              </span>
              <span>رجوع للرئيسية</span>
            </Link>
          </div>

          <div className="relative flex-1">
            
            {/* ================= STEP 1: طلب الرمز ================= */}
            {step === 1 && (
              <form onSubmit={handleRequestOtp} noValidate className="animate-fadeIn">
                <span className="inline-block text-[0.72rem] font-extrabold text-orange-500 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full mb-3">
                  الخطوة 1 من 3
                </span>
                <h2 className="m-0 mb-1.5 text-2xl font-medium tracking-tight">نسيت كلمة المرور؟</h2>
                <p className="m-0 mb-6 text-sm text-zinc-500 leading-relaxed">
                  اختر طريقة استلام رمز التحقق لمرة واحدة لإعادة تعيين كلمة المرور بأمان.
                </p>

                {/* مبدّل قناة استلام الرمز: بريد / واتساب */}
                <div className="flex gap-2 mb-4 p-1 bg-zinc-200/70 rounded-[0.75rem] w-full">
                  <button
                    type="button"
                    onClick={() => { setOtpChannel('email'); setEmailError(''); }}
                    className={`flex-1 text-sm font-semibold py-2 rounded-[0.625rem] transition-colors duration-200 ${
                      otpChannel === 'email' ? 'bg-white text-orange-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    البريد الإلكتروني
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOtpChannel('whatsapp'); setEmailError(''); }}
                    className={`flex-1 text-sm font-semibold py-2 rounded-[0.625rem] transition-colors duration-200 ${
                      otpChannel === 'whatsapp' ? 'bg-white text-orange-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    واتساب
                  </button>
                </div>

                {otpChannel === 'email' ? (
                  <div className="mb-4">
                    <label htmlFor="email" className="block text-sm mb-2 font-medium">البريد الإلكتروني</label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="hi@hextastudio.in"
                      dir="ltr"
                      className={`w-full text-sm px-3.5 py-2.5 border rounded-[0.625rem] bg-white text-black transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 ${
                        emailError ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-300'
                      }`}
                    />
                    {emailError && <p className="text-red-500 text-xs mt-1.5">{emailError}</p>}
                  </div>
                ) : (
                  <div className="mb-4">
                    <label htmlFor="phone" className="block text-sm mb-2 font-medium">رقم الهاتف (واتساب)</label>
                    <input
                      type="tel"
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+970 59 000 0000"
                      dir="ltr"
                      className={`w-full text-sm px-3.5 py-2.5 border rounded-[0.625rem] bg-white text-black transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 ${
                        emailError ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-300'
                      }`}
                    />
                    {emailError && <p className="text-red-500 text-xs mt-1.5">{emailError}</p>}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSendingOtp}
                  className="w-full bg-orange-500 text-white font-semibold text-base py-2.5 px-4 rounded-[0.625rem] hover:bg-orange-600 transition-colors disabled:opacity-55 cursor-pointer mt-2 flex items-center justify-center"
                >
                  {isSendingOtp ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    'إرسال رمز التحقق'
                  )}
                </button>

                <p className="text-center text-sm text-zinc-500 mt-5">
                  تذكّرت كلمتك؟{' '}
                  <Link to="/login" className="text-zinc-900 font-bold underline hover:text-orange-500">
                    العودة لتسجيل الدخول
                  </Link>
                </p>
              </form>
            )}

            {/* ================= STEP 2: إدخال الرمز OTP ================= */}
            {step === 2 && (
              <form onSubmit={handleVerifyOtp} noValidate className="animate-fadeIn">
                <span className="inline-block text-[0.72rem] font-extrabold text-orange-500 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full mb-3">
                  الخطوة 2 من 3
                </span>
                <h2 className="m-0 mb-1.5 text-2xl font-medium tracking-tight">أدخل رمز التحقق</h2>
                <p className="m-0 mb-4 text-sm text-zinc-500 leading-relaxed">
                  لقد أرسلنا رمزاً مكوّناً من 6 أرقام عبر <b className="text-zinc-800">{otpChannel === 'whatsapp' ? 'واتساب' : 'البريد الإلكتروني'}</b>
                  {otpChannel === 'email'
                    ? <> إلى <b className="text-zinc-800">{maskEmail(email)}</b></>
                    : <> إلى رقمك <b className="text-zinc-800" dir="ltr">{phone}</b></>} .
                </p>

                {/* زر مشاهدة البريد التجريبي */}
                <button
                  type="button"
                  onClick={() => setShowMailOverlay(true)}
                  className="inline-flex items-center gap-2 mb-4 bg-orange-50 border border-orange-200 text-orange-900 font-bold text-xs px-3.5 py-2 rounded-full hover:bg-orange-100 transition-colors"
                >
                  <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  <span>عرض بريدي التجريبي</span>
                  <span className="bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[0.7rem]">1</span>
                </button>

                {/* العداد التنازلي وإعادة الإرسال */}
                <div className="flex justify-between items-center text-xs text-zinc-500 mb-2">
                  <span className={`font-bold tabular-nums ${timerRemain <= 0 ? 'text-red-500' : 'text-orange-500'}`}>
                    {formatTime(timerRemain)}
                  </span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendRemain > 0 || resendTries >= MAX_RESEND_TRIES}
                    className="bg-transparent border-none text-orange-500 font-bold text-xs disabled:text-zinc-400 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {resendTries >= MAX_RESEND_TRIES
                      ? 'وصلت الحد الأقصى'
                      : resendRemain > 0
                      ? `إعادة الإرسال خلال ${resendRemain} ث`
                      : 'إعادة الإرسال'}
                  </button>
                </div>

                {/* صناديق الـ OTP */}
                <div
                  dir="ltr"
                  className={`dir-ltr flex gap-2 justify-between my-2 mb-3 ${
                    isShake ? 'animate-bounce' : ''
                  }`}
                >
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className={`flex-1 min-w-0 max-w-[3.2rem] aspect-square text-center text-2xl font-bold rounded-2xl border transition-all duration-200 bg-white text-zinc-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 ${
                        digit ? 'border-orange-500 bg-orange-50/50' : 'border-zinc-300'
                      }`}
                    />
                  ))}
                </div>

                {otpError && <p className="text-red-500 text-xs mb-3">{otpError}</p>}

                <button
                  type="submit"
                  disabled={otp.join('').length < OTP_LEN || timerRemain <= 0 || isVerifyingOtp}
                  className="w-full bg-orange-500 text-white font-semibold text-base py-2.5 px-4 rounded-[0.625rem] hover:bg-orange-600 transition-colors disabled:opacity-55 cursor-pointer mt-2 flex items-center justify-center"
                >
                  {isVerifyingOtp ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    'تأكيد الرمز'
                  )}
                </button>

                <p className="text-center text-sm text-zinc-500 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setOtp(Array(OTP_LEN).fill(''));
                    }}
                    className="text-zinc-900 font-semibold underline hover:text-orange-500 bg-transparent border-none cursor-pointer"
                  >
                    تغيير البريد الإلكتروني
                  </button>
                </p>
              </form>
            )}

            {/* ================= STEP 3: تعيين كلمة المرور الجديدة ================= */}
            {step === 3 && (
              <form onSubmit={handleResetPassword} noValidate className="animate-fadeIn">
                <span className="inline-block text-[0.72rem] font-extrabold text-orange-500 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full mb-3">
                  الخطوة 3 من 3
                </span>
                <h2 className="m-0 mb-1.5 text-2xl font-medium tracking-tight">تعيين كلمة مرور جديدة</h2>
                <p className="m-0 mb-6 text-sm text-zinc-500 leading-relaxed">
                  اختر كلمة مرور قوية لم تستخدمها من قبل.
                </p>

                {/* كلمة المرور */}
                <div className="mb-3 relative">
                  <label htmlFor="pw" className="block text-sm mb-2 font-medium">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="pw"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full text-sm pl-10 pr-3.5 py-2.5 border rounded-[0.625rem] bg-white text-black transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 ${
                        passwordError ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 bg-transparent border-none cursor-pointer"
                    >
                      <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                  {passwordError && <p className="text-red-500 text-xs mt-1.5">{passwordError}</p>}
                </div>

                {/* مؤشر قوة كلمة المرور */}
                <div className="mb-4">
                  <div className="flex gap-1.5 h-1.5 mb-1.5">
                    {[1, 2, 3, 4].map((barIndex) => (
                      <span
                        key={barIndex}
                        className={`flex-1 rounded-full transition-colors duration-300 ${
                          barIndex <= passwordScore
                            ? passwordScore === 1
                              ? 'bg-red-500'
                              : passwordScore === 2
                              ? 'bg-orange-500'
                              : passwordScore === 3
                              ? 'bg-blue-600'
                              : 'bg-green-600'
                            : 'bg-zinc-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium">
                    قوة كلمة المرور: <b className="text-zinc-800">{strengthLabels[passwordScore]}</b>
                  </div>
                </div>

                {/* تأكيد كلمة المرور */}
                <div className="mb-5 relative">
                  <label htmlFor="pw2" className="block text-sm mb-2 font-medium">تأكيد كلمة المرور</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="pw2"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full text-sm pl-10 pr-3.5 py-2.5 border rounded-[0.625rem] bg-white text-black transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 ${
                        confirmPasswordError ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 bg-transparent border-none cursor-pointer"
                    >
                      <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                  {confirmPasswordError && <p className="text-red-500 text-xs mt-1.5">{confirmPasswordError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isResetting}
                  className="w-full bg-orange-500 text-white font-semibold text-base py-2.5 px-4 rounded-[0.625rem] hover:bg-orange-600 transition-colors disabled:opacity-55 cursor-pointer flex items-center justify-center"
                >
                  {isResetting ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    'تعيين كلمة المرور الجديدة'
                  )}
                </button>
              </form>
            )}

            {/* ================= SUCCESS OVERLAY ================= */}
            {step === 'done' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center bg-zinc-100 p-6 rounded-2xl animate-fadeIn">
                <div className="w-20 h-20 mb-4 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <svg className="w-10 h-10 fill-none stroke-current stroke-[3] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold m-0 mb-2">تم التغيير بنجاح</h2>
                <p className="text-zinc-500 text-sm m-0">تم تحديث كلمة المرور الخاصة بك. سيتم توجيهك لتسجيل الدخول…</p>
              </div>
            )}

          </div>
        </section>

        {/* ================= EXPERIMENTAL INBOX OVERLAY ================= */}
        {showMailOverlay && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
                <b className="text-sm font-bold">صندوق البريد التجريبي</b>
                <button
                  type="button"
                  onClick={() => setShowMailOverlay(false)}
                  className="text-xl leading-none text-zinc-400 hover:text-zinc-700 bg-transparent border-none cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="p-4 overflow-y-auto">
                <div className="flex gap-3 p-3.5 rounded-xl bg-gradient-to-br from-orange-50 to-white border border-orange-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white flex items-center justify-center flex-none">
                    <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-500">من: أمان مساحاتي · no-reply@masahati.ps</div>
                    <div className="font-extrabold text-sm my-0.5">رمز التحقق لإعادة تعيين كلمة المرور</div>
                    <p className="text-xs text-zinc-500 leading-relaxed m-0">
                      مرحباً، لقد طلبت إعادة تعيين كلمة المرور. استخدم الرمز أدناه (صالح لمدة 5 دقائق):
                    </p>
                    
                    <div className="inline-flex items-center gap-2 mt-3 bg-white border border-dashed border-orange-500 text-orange-600 font-extrabold text-lg tracking-[0.25em] px-3 py-1 rounded-xl">
                      <span>{sentOtpCode || '------'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="mt-2 mr-2 bg-orange-100 text-orange-600 border-none font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer hover:bg-orange-200 transition-colors"
                    >
                      {copiedOtp ? 'تم النسخ ✓' : 'نسخ الرمز'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-zinc-200 text-[0.72rem] text-zinc-500 text-center">
                هذا صندوق بريد وهمي للتجربة فقط — في الإصدار الحقيقي يصلك الرمز عبر بريدك الفعلي.
              </div>
            </div>
          </div>
        )}

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