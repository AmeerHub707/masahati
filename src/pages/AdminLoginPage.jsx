import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '@/components/ui/BackButton';
import { adminLogin } from '@/lib/adminAuth';
import { useForceLight } from '@/hooks/useTheme';

// صفحة دخول المشرف: منفصلة عن دخول العملاء لأن مصادقة المشرف عقدٌ مختلف
// (/api/admin/login بتوكن مشرف منفصل). لا يوجد أي بريد أو كلمة مرور مُثبّتة
// في الكود — البيانات تُرسل للخادم مباشرة، وأي فشل يُعرض بنصّه.
export default function AdminLoginPage() {
  useForceLight();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = formData.email.trim();
    if (!email || !formData.password) {
      setError('الرجاء إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await adminLogin(email, formData.password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err?.message || 'تعذّر تسجيل الدخول. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center px-4 font-['Cairo']"
      style={{ background: 'linear-gradient(160deg, #18181b, #0b0b0d)' }}
    >
      <div className="w-full max-w-md rounded-3xl border border-orange-500/20 bg-zinc-900/90 p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <img src="/Logo.png" alt="مساحاتي" className="h-9 w-auto object-contain" />
          <BackButton fallback="/" ariaLabel="رجوع للرئيسية" />
        </div>

        <h1 className="text-2xl font-extrabold text-white mb-1">دخول المشرف</h1>
        <p className="text-sm text-zinc-400 mb-5">هذه الصفحة مخصّصة لإدارة المنصة.</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-zinc-200 mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="username"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3.5 py-2.5 text-white outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-zinc-200 mb-1.5">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3.5 py-2.5 text-white outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-400">
          لست مشرفاً؟ <Link to="/login" className="font-bold text-orange-400 underline">دخول الحسابات</Link>
        </p>
      </div>
    </div>
  );
}
