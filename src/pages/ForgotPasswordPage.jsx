import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request, ApiError } from '../lib/authStore';

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
  const [emailError, setEmailError] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // الخطوة 2: الـ OTP والعدادات
  const [otp, setOtp] = useState(Array(OTP_LEN).fill(''));
  const [verifiedCode, setVerifiedCode] = useState(''); // الرمز الذي تم التحقق منه للتمرير إلى reset-password
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [timerRemain, setTimerRemain] = useState(OTP_TTL_SECONDS);
  const [resendRemain, setResendRemain] = useState(RESEND_WAIT_SECONDS);
  const [resendTries, setResendTries] = useState(0);
  const [isShake, setIsShake] = useState(false);
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
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setEmailError('');

    const isValidEmail = email.trim().includes('@') && email.trim().includes('.') && !email.trim().includes(' ');
    if (!isValidEmail) {
      setEmailError('الرجاء إدخال بريد إلكتروني صحيح.');
      return;
    }

    setIsSendingOtp(true);
    try {
      // يتحقق الباك إند من وجود البريد ويرسل رمز OTP عبر /api/send-otp
      await request('/api/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
      });
      await request('/api/send-otp', {
        method: 'POST',
        body: { email: email.trim() },
      });
      setStep(2);
      setTimerRemain(OTP_TTL_SECONDS);
      setResendRemain(RESEND_WAIT_SECONDS);
      setResendTries(0);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setEmailError('هذا البريد غير مسجّل لدينا. أنشئ حساباً أو تأكد من البريد.');
      } else {
        setEmailError(err.message || 'تعذر إرسال الرمز. حاول مرة أخرى.');
      }
    } finally {
      setIsSendingOtp(false);
    }
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
  const handleResend = async () => {
    if (resendRemain > 0 || resendTries >= MAX_RESEND_TRIES) return;

    setResendTries((prev) => prev + 1);
    try {
      await request('/api/send-otp', {
        method: 'POST',
        body: { email: email.trim() },
      });
      setOtp(Array(OTP_LEN).fill(''));
      setOtpError('');
      setTimerRemain(OTP_TTL_SECONDS);
      setResendRemain(RESEND_WAIT_SECONDS);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    } catch (err) {
      setOtpError(err.message || 'تعذر إعادة إرسال الرمز.');
    }
  };

  // معالجة الخطوة الثانية (التحقق من الرمز)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (timerRemain <= 0) {
      setOtpError('انتهت صلاحية الرمز. اطلب رمزاً جديداً.');
      return;
    }

    const enteredCode = otp.join('');
    if (enteredCode.length < OTP_LEN) {
      setOtpError('الرجاء إدخال الأرقام الستة كاملة.');
      setIsShake(true);
      setTimeout(() => setIsShake(false), 450);
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await request('/api/verify-otp', {
        method: 'POST',
        body: { email: email.trim(), code: enteredCode },
      });
      setVerifiedCode(enteredCode);
      setStep(3);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 422 || err.status === 401)) {
        setOtpError('الرمز غير صحيح. حاول مرة أخرى.');
        setIsShake(true);
        setTimeout(() => setIsShake(false), 450);
      } else {
        setOtpError(err.message || 'تعذر التحقق. حاول مرة أخرى.');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
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
  const handleResetPassword = async (e) => {
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
    try {
      await request('/api/reset-password', {
        method: 'POST',
        body: {
          email: email.trim(),
          token: verifiedCode,
          password,
          password_confirmation: confirmPassword,
        },
      });
      setStep('done');
      setTimeout(() => navigate('/login'), 2200);
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) {
        const e = err.data.errors;
        if (e.password) setPasswordError(Array.isArray(e.password) ? e.password[0] : e.password);
        if (e.email) setEmailError(Array.isArray(e.email) ? e.email[0] : e.email);
        if (!e.password && !e.email) {
          setPasswordError(err.message || 'تعذر تغيير كلمة المرور.');
        }
      } else {
        setPasswordError(err.message || 'تعذر تغيير كلمة المرور.');
      }
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

        /* أزرار مبدّل القناة (بريد/واتساب) */
        .channel-toggle {
          display: flex;
          gap: 0.5rem;
          padding: 0.3rem;
          background: rgba(255,255,255,0.08);
          border: 1.5px solid rgba(255,255,255,0.18);
          border-radius: 999px;
          margin-bottom: 1rem;
        }
        .channel-toggle button {
          flex: 1;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.55rem 0.5rem;
          border: none;
          border-radius: 999px;
          background: transparent;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          transition: all 0.2s var(--ease);
        }
        .channel-toggle button.active {
          background: linear-gradient(180deg, #fb923c, var(--accent) 60%, var(--accent-hover));
          color: #fff;
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

        /* صناديق OTP */
        .otp-row {
          display: flex;
          direction: ltr;
          gap: 0.5rem;
          justify-content: center;
          margin: 0.4rem 0 0.3rem;
        }
        .otp-box {
          width: 100%; flex: 1; max-width: 3.2rem; aspect-ratio: 1 / 1.1;
          text-align: center; font-size: 1.3rem; font-weight: 700;
          border: 1.5px solid rgba(255,255,255,0.85);
          border-radius: var(--radius-field);
          background: rgba(255,255,255,0.06);
          color: #fff;
          outline: none;
          transition: all 0.2s;
        }
        .otp-box:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 4px rgba(249,115,22,0.22);
          background: rgba(255,255,255,0.12);
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

        .step-pill {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--accent);
          background: rgba(249,115,22,0.14);
          border: 1px solid rgba(249,115,22,0.45);
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          margin-bottom: 0.8rem;
        }

        .row-between {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.8);
          margin: 0.6rem 0 0.6rem;
        }
        .link-btn {
          background: none;
          border: none;
          color: var(--accent);
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          padding: 0;
        }
        .link-btn:disabled { color: rgba(255,255,255,0.4); cursor: default; }

        .strength { margin: 0.4rem 0 1rem; }
        .strength__bars { display: flex; gap: 0.4rem; height: 0.4rem; margin-bottom: 0.4rem; }
        .strength__bars span { flex: 1; border-radius: 999px; background: rgba(255,255,255,0.2); transition: background 0.3s; }
        .strength__bars span.on-1 { background: #ef4444; }
        .strength__bars span.on-2 { background: var(--accent); }
        .strength__bars span.on-3 { background: #2563eb; }
        .strength__bars span.on-4 { background: #16a34a; }
        .strength__label { font-size: 0.75rem; color: rgba(255,255,255,0.75); }
        .strength__label b { color: #fff; }

        /* نافذة البريد التجريبي */
        .mail-overlay { position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
        .mail-modal { width: 100%; max-width: 26rem; background: #fff; border-radius: 1.25rem; overflow: hidden; box-shadow: 0 30px 60px -20px rgba(0,0,0,0.5); display: flex; flex-direction: column; color: #18181b; }
        .mail-modal__head { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid #e4e4e7; }
        .mail-modal__head b { font-size: 0.85rem; font-weight: 800; }
        .mail-modal__close { background: none; border: none; font-size: 1.25rem; line-height: 1; color: #a1a1aa; cursor: pointer; }
        .mail-modal__body { padding: 1rem; overflow-y: auto; }
        .mail-card { display: flex; gap: 0.75rem; padding: 0.875rem; border-radius: 0.75rem; background: linear-gradient(135deg, #fff7ed, #fff); border: 1px solid #fed7aa; }
        .mail-card__ico { width: 2.5rem; height: 2.5rem; border-radius: 999px; background: linear-gradient(180deg, #fb923c, #f97316); color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }
        .mail-card__from { font-size: 0.72rem; color: #71717a; }
        .mail-card__title { font-size: 0.9rem; font-weight: 800; margin: 0.1rem 0; }
        .mail-card__text { font-size: 0.72rem; color: #71717a; line-height: 1.6; margin: 0; }
        .mail-card__code { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; background: #fff; border: 1.5px dashed #f97316; color: #ea580c; font-weight: 800; font-size: 1.1rem; letter-spacing: 0.25em; padding: 0.25rem 0.75rem; border-radius: 0.75rem; }
        .mail-card__copy { margin: 0.5rem 0.5rem 0 0; background: #ffedd5; color: #ea580c; border: none; font-weight: 700; font-size: 0.75rem; padding: 0.375rem 0.75rem; border-radius: 0.5rem; cursor: pointer; }
        .mail-modal__foot { padding: 0.75rem 1rem; border-top: 1px solid #e4e4e7; font-size: 0.72rem; color: #71717a; text-align: center; }

        /* شاشة النجاح */
        .success-screen { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: rgba(15,15,20,0.92); border-radius: var(--radius-card); padding: 1.5rem; }
        .success-screen__ico { width: 5rem; height: 5rem; margin-bottom: 1rem; border-radius: 999px; background: rgba(34,197,94,0.16); display: flex; align-items: center; justify-content: center; color: #22c55e; }
        .success-screen h2 { color: #fff; font-size: 1.5rem; margin: 0 0 0.5rem; }
        .success-screen p { color: rgba(255,255,255,0.75); font-size: 0.9rem; margin: 0; }

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
            <h1>أمان حسابك أولاً</h1>
            <p>
              نستخدم رمز تحقق لمرة واحدة (OTP) لحماية بياناتك. حتى لو عرف أحد بريدك، لا يمكنه تغيير كلمتك دون الرمز.
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
          
          {/* الهيدر العلوي */}
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
            
            {/* ================= STEP 1: طلب الرمز ================= */}
            {step === 1 && (
              <form onSubmit={handleRequestOtp} noValidate className="animate-fadeIn">
                <span className="step-pill">الخطوة 1 من 3</span>
                <h2>نسيت كلمة المرور؟</h2>
                <p className="form-sub">
                  أدخل بريدك الإلكتروني لاستلام رمز التحقق لمرة واحدة لإعادة تعيين كلمة المرور بأمان.
                </p>

                <div className={`field ${emailError ? 'has-error' : ''}`}>
                  <label htmlFor="email">البريد الإلكتروني</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hi@hextastudio.in"
                    dir="ltr"
                  />
                  {emailError && <p className="error">{emailError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSendingOtp}
                  className="btn"
                >
                  {isSendingOtp ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    'إرسال رمز التحقق'
                  )}
                </button>

                <p className="switch">
                  تذكّرت كلمتك؟{' '}
                  <Link to="/login">العودة لتسجيل الدخول</Link>
                </p>
              </form>
            )}

            {/* ================= STEP 2: إدخال الرمز OTP ================= */}
            {step === 2 && (
              <form onSubmit={handleVerifyOtp} noValidate className="animate-fadeIn">
                <span className="step-pill">الخطوة 2 من 3</span>
                <h2>أدخل رمز التحقق</h2>
                <p className="form-sub">
                  لقد أرسلنا رمزاً مكوّناً من 6 أرقام إلى بريدك الإلكتروني
                  <> إلى <b>{maskEmail(email)}</b></> .
                </p>

                {/* العداد التنازلي وإعادة الإرسال */}
                <div className="row-between">
                  <span className={`font-bold tabular-nums ${timerRemain <= 0 ? 'text-red-500' : 'text-orange-500'}`} style={{ color: timerRemain <= 0 ? '#f87171' : 'var(--accent)' }}>
                    {formatTime(timerRemain)}
                  </span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendRemain > 0 || resendTries >= MAX_RESEND_TRIES}
                    className="link-btn"
                  >
                    {resendTries >= MAX_RESEND_TRIES
                      ? 'وصلت الحد الأقصى'
                      : resendRemain > 0
                      ? `إعادة الإرسال خلال ${resendRemain} ث`
                      : 'إعادة الإرسال'}
                  </button>
                </div>

                {/* صناديق الـ OTP */}
                <div className={`otp-row ${isShake ? 'animate-bounce' : ''}`}>
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
                      className="otp-box"
                    />
                  ))}
                </div>

                {otpError && <p className="error">{otpError}</p>}

                <button
                  type="submit"
                  disabled={otp.join('').length < OTP_LEN || timerRemain <= 0 || isVerifyingOtp}
                  className="btn"
                >
                  {isVerifyingOtp ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    'تأكيد الرمز'
                  )}
                </button>

                <p className="switch">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setOtp(Array(OTP_LEN).fill(''));
                    }}
                    className="link-btn"
                    style={{ textDecoration: 'underline' }}
                  >
                    تغيير البريد الإلكتروني
                  </button>
                </p>
              </form>
            )}

            {/* ================= STEP 3: تعيين كلمة المرور الجديدة ================= */}
            {step === 3 && (
              <form onSubmit={handleResetPassword} noValidate className="animate-fadeIn">
                <span className="step-pill">الخطوة 3 من 3</span>
                <h2>تعيين كلمة مرور جديدة</h2>
                <p className="form-sub">
                  اختر كلمة مرور قوية لم تستخدمها من قبل.
                </p>

                {/* كلمة المرور */}
                <div className={`field ${passwordError ? 'has-error' : ''}`}>
                  <label htmlFor="pw">كلمة المرور الجديدة</label>
                  <div className="pw-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="pw"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="pw-toggle"
                    >
                      <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                  {passwordError && <p className="error">{passwordError}</p>}
                </div>

                {/* مؤشر قوة كلمة المرور */}
                <div className="strength">
                  <div className="strength__bars">
                    {[1, 2, 3, 4].map((barIndex) => (
                      <span key={barIndex} className={barIndex <= passwordScore ? `on-${passwordScore}` : ''} />
                    ))}
                  </div>
                  <div className="strength__label">
                    قوة كلمة المرور: <b>{strengthLabels[passwordScore]}</b>
                  </div>
                </div>

                {/* تأكيد كلمة المرور */}
                <div className={`field ${confirmPasswordError ? 'has-error' : ''}`}>
                  <label htmlFor="pw2">تأكيد كلمة المرور</label>
                  <div className="pw-wrap">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="pw2"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="pw-toggle"
                    >
                      <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                  {confirmPasswordError && <p className="error">{confirmPasswordError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isResetting}
                  className="btn"
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
              <div className="success-screen">
                <div className="success-screen__ico">
                  <svg className="w-10 h-10 fill-none stroke-current stroke-[3] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <h2>تم التغيير بنجاح</h2>
                <p>تم تحديث كلمة المرور الخاصة بك. سيتم توجيهك لتسجيل الدخول…</p>
              </div>
            )}

          </div>
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