import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';

// صفحة لوحة التحكم (مؤقتة). لوحة التحكم الحقيقية تُبنى لاحقاً.
// الزائر غير المسجّل يُحوَّل إلى الصفحة الرئيسية (انظر حماية المسار في App.jsx).
export default function DashboardPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center p-5 bg-cover bg-center bg-no-repeat overflow-hidden font-['Cairo'] text-zinc-900 dir-rtl" style={{ backgroundImage: "url('/background.jpeg')" }}>
      <div className="fixed inset-0 bg-gradient-to-br from-black/55 to-black/35 -z-10" />

      <Navbar />

      <main className="relative w-full max-w-[40rem] my-auto rounded-3xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55),0_0_0_2px_rgba(249,115,22,0.22)] bg-zinc-100 border border-white/75 p-10 text-center">
        <img src="/masahati.jpeg" alt="Masahati" className="h-12 mx-auto mb-5 object-contain drop-shadow-[0_6px_14px_rgba(249,115,22,0.30)]" />
        <h1 className="text-3xl font-bold mb-3">مرحباً بك في لوحة التحكم</h1>
        <p className="text-sm text-zinc-500 leading-relaxed mb-6">
          هذه صفحة لوحة تحكم مؤقتة. سيتم تجهيز لوحة التحكم الكاملة (حجوزاتك، مساحاتك، الإعدادات) لاحقاً.
        </p>
        <Link
          to="/"
          className="inline-block bg-orange-500 text-white font-medium text-base py-2.5 px-6 rounded-[0.625rem] hover:bg-orange-600 transition-colors"
        >
          العودة إلى الصفحة الرئيسية
        </Link>
      </main>
    </div>
  );
}
