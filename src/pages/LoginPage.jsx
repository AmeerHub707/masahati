import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setLoggedIn } from '../lib/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    remember: false
  });
  const [errors, setErrors] = useState({ identifier: '', password: '' });

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

  const handleSubmit = (e) => {
    e.preventDefault();
    let valid = true;
    const newErrors = { identifier: '', password: '' };

    const identifier = formData.identifier.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+]?[\d\s()-]{7,}$/;

    if (!identifier) {
      newErrors.identifier = 'الرجاء إدخال البريد الإلكتروني أو رقم الهاتف';
      valid = false;
    } else if (!emailRegex.test(identifier) && !phoneRegex.test(identifier)) {
      newErrors.identifier = 'أدخل بريداً إلكترونياً أو رقم هاتف صحيحاً';
      valid = false;
    }

    if (!formData.password) {
      newErrors.password = 'الرجاء إدخال كلمة المرور';
      valid = false;
    }

    setErrors(newErrors);

    if (valid) {
      // هنا يتم وضع المنطق الخاص بالـ Authentication لاحقاً (API فريق Laravel/MySQL)
      const isEmail = emailRegex.test(identifier);
      console.log('مرحباً بعودتك:', { type: isEmail ? 'email' : 'phone', identifier, password: formData.password });
      setLoggedIn(true); // وهمي حتى يجهز الـ API
      navigate('/dashboard');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-5 bg-cover bg-center bg-no-repeat overflow-hidden font-['Cairo'] text-zinc-900 dir-rtl" style={{ backgroundImage: "url('/background.jpeg')" }}>
      {/* طبقة التعتيم الخلفية */}
      <div className="fixed inset-0 bg-gradient-to-br from-black/55 to-black/35 -z-10" />

      {/* التوهج البرتقالي الخلفي */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46rem] h-[46rem] bg-[radial-gradient(circle,rgba(249,115,22,0.38)_0%,rgba(249,115,22,0.12)_40%,transparent_70%)] blur-2xl -z-10 pointer-events-none" />

      {/* الكارت الرئيسي (Auth Card) */}
      <main className="relative w-full max-w-[52rem] my-auto max-h-full flex flex-col md:flex-row md:min-h-[34rem] rounded-3xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55),0_0_0_2px_rgba(249,115,22,0.22),0_40px_90px_-25px_rgba(249,115,22,0.55)] bg-zinc-100 border border-white/75 isolate">
        
        {/* تأثير اللمعان (Glass Sheen) */}
        <div className="absolute inset-0 z-[2] pointer-events-none bg-[radial-gradient(130%_70%_at_0%_0%,rgba(249,115,22,0.20),transparent_50%),radial-gradient(130%_70%_at_100%_100%,rgba(249,115,22,0.14),transparent_50%)]" />

        {/* عناصر الديكور العائمة (Blobs & Streaks) */}
        <div className="hidden md:block absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {[2, 8, 14, 20, 26, 32].map((left, idx) => (
            <span key={idx} className="absolute top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-black to-white/20 opacity-30 blur-md translate-x-[36rem]" style={{ left: `${left}rem` }} />
          ))}
        </div>
        <span className="absolute w-60 h-60 bg-orange-500 -bottom-24 -right-16 rounded-full opacity-90 blur-[2px] z-0 pointer-events-none" />
        <span className="absolute w-32 h-20 bg-white bottom-6 right-8 rounded-full opacity-35 z-0 pointer-events-none" />
        <span className="absolute w-32 h-20 bg-white bottom-12 right-40 rounded-full opacity-35 z-0 pointer-events-none" />

        {/* الصورة الجانبية الهوية */}
        <aside className="relative z-[1] min-h-[14rem] md:w-[48%] md:flex-none bg-cover bg-center flex items-end p-7 text-white" style={{ backgroundImage: "url('/Loginside.jpg')" }}>
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-orange-500/45 via-orange-600/22 to-transparent mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
        </aside>

        {/* لوحة النموذج (Form Panel) */}
        <section className="relative z-[1] flex-1 p-8 md:p-11 flex flex-col bg-zinc-100">
          
          {/* الهيدر العلوي (الشعار وزر الرجوع) */}
          <div className="flex items-center justify-between gap-4 flex-nowrap w-full mb-5">
            <div className="flex items-center gap-2.5 flex-none m-0">
              <img src="/masahati.jpeg" alt="Masahati" className="h-9 w-auto object-contain drop-shadow-[0_6px_14px_rgba(249,115,22,0.30)]" />
              <span className="text-2xl font-extrabold tracking-tight leading-none text-zinc-900 dir-ltr inline-flex items-baseline">
                Masa<span className="text-orange-500">hati</span>
              </span>
            </div>

            <Link
              to="/"
              aria-label="العودة إلى الصفحة الرئيسية"
              className="flex-none inline-flex items-center gap-2 font-bold text-sm text-orange-400 whitespace-nowrap px-4 py-2 bg-transparent border-[1.5px] border-orange-200 rounded-full transition-all duration-200 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-300/12 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-8px_rgba(249,115,22,0.4)] active:translate-y-0.5 active:bg-orange-200 active:border-orange-300 active:text-orange-900 active:shadow-inner focus-visible:outline-none focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500/35"
            >
              <span className="inline-flex transition-transform duration-250 hover:-translate-x-1">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-[2.2] stroke-linecap-round stroke-linejoin-round">
                  <path d="M14 6l-6 6 6 6" />
                </svg>
              </span>
              <span>رجوع للرئيسية</span>
            </Link>
          </div>

          {/* محتوى نموذج الدخول */}
          <div className="relative flex-1">
            <form onSubmit={handleSubmit} noValidate>
              <h2 className="m-0 mb-1.5 text-3xl font-medium tracking-tight">مرحباً بعودتك</h2>
              <p className="m-0 mb-7 text-sm opacity-80 text-zinc-600">سجّل الدخول إلى حسابك في مساحاتي.</p>

              {/* المعرّف: بريد إلكتروني أو رقم هاتف ) */}
              <div className="mb-4">
                <label htmlFor="login-identifier" className="block text-sm mb-2 font-medium">البريد الإلكتروني أو رقم الهاتف</label>
                <input
                  type="text"
                  id="login-identifier"
                  value={formData.identifier}
                  onChange={handleChange}
                  placeholder="you@example.com , +970 59 000 0000"
                  dir="ltr"
                  autoComplete="username"
                  className={`w-full text-sm px-3 py-2.5 border rounded-[0.625rem] bg-white text-black transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 ${
                    errors.identifier ? 'border-red-500' : 'border-zinc-300'
                  }`}
                />
                {errors.identifier && <p className="text-red-500 text-xs mt-1.5 min-h-[1rem]">{errors.identifier}</p>}
              </div>

              {/* كلمة المرور */}
              <div className="mb-4">
                <label htmlFor="login-password" className="block text-sm mb-2 font-medium">كلمة المرور</label>
                <input
                  type="password"
                  id="login-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full text-sm px-3 py-2.5 border rounded-[0.625rem] bg-white text-black transition-all duration-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 ${
                    errors.password ? 'border-red-500' : 'border-zinc-300'
                  }`}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1.5 min-h-[1rem]">{errors.password}</p>}
              </div>

              {/* تذكرني + نسيت كلمة المرور */}
              <div className="flex items-center justify-between my-2 mb-4 text-xs leading-none">
                <label htmlFor="login-remember" className="inline-flex items-center gap-2 text-zinc-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="login-remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    className="w-4 h-4 border-[1.5px] border-zinc-300 rounded bg-white accent-orange-500 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/35"
                  />
                  تذكرني
                </label>
                <Link to="/forgot" className="text-zinc-500 text-xs hover:text-orange-500 transition-colors">
                  هل نسيت كلمة المرور؟
                </Link>
              </div>

              {/* زر التسجيل */}
              <button
                type="submit"
                className="w-full bg-orange-500 text-white font-medium text-base py-2.5 px-4 rounded-[0.625rem] hover:bg-orange-600 transition-colors cursor-pointer mt-2"
              >
                تسجيل الدخول
              </button>

              {/* التحويل إلى إنشاء حساب */}
              <p className="text-center text-sm text-zinc-500 mt-5">
                ليس لديك حساب؟{' '}
                <Link to="/signup" className="text-zinc-900 font-semibold underline cursor-pointer hover:text-orange-500">
                  إنشاء حساب
                </Link>
              </p>
            </form>
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