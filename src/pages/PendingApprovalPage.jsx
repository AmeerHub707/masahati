import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Hourglass, LogOut } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { getUser } from '@/lib/authStore';
import { useForceLight } from '@/hooks/useTheme';

export default function PendingApprovalPage() {
  useForceLight();
  const navigate = useNavigate();
  const [user] = useState(() => {
    try {
      return getUser() || {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    document.title = 'بانتظار الموافقة — مساحتي';
  }, []);

  const displayName = (user.full_name || user.name || '').trim();

  return (
    <div className="auth-wrapper">
      <div className="auth-bg" aria-hidden="true" />
      <style>{`
        .pa-card {
          width: min(30rem, 92vw);
          margin: 4rem auto;
          padding: 2.2rem 1.8rem;
          border-radius: 1.2rem;
          background: rgba(17, 24, 39, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
          color: #f9fafb;
          text-align: center;
          backdrop-filter: blur(14px);
        }
        .pa-icon {
          width: 4.4rem;
          height: 4.4rem;
          margin: 0 auto 1.1rem;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(249, 115, 22, 0.16);
          border: 1px solid rgba(249, 115, 22, 0.45);
          color: #fb923c;
        }
        .pa-title { margin: 0 0 0.5rem; font-size: 1.4rem; font-weight: 800; }
        .pa-text { margin: 0 0 0.8rem; font-size: 0.92rem; line-height: 1.8; color: rgba(255, 255, 255, 0.78); }
        .pa-eta {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          margin: 0.4rem 0 1.4rem;
          padding: 0.5rem 0.9rem;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.14);
          border: 1px solid rgba(59, 130, 246, 0.4);
          color: #93c5fd;
          font-size: 0.82rem;
          font-weight: 700;
        }
        .pa-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.8rem 1rem;
          border: none;
          border-radius: 0.8rem;
          background: var(--accent, #f97316);
          color: #fff;
          font-size: 0.95rem;
          font-weight: 800;
          cursor: pointer;
          transition: filter 0.2s;
        }
        .pa-btn:hover { filter: brightness(1.08); }
        .pa-note { margin: 1rem 0 0; font-size: 0.76rem; color: rgba(255, 255, 255, 0.55); line-height: 1.7; }
        /* الشكل يأتي من .back-circle؛ يبقى للزر هنا الفسحة تحت البطاقة فقط */
        .pa-back { margin: 0 0 1.4rem; }
      `}</style>

      <main className="pa-card">
        <BackButton className="pa-back" fallback="/" ariaLabel="رجوع" />

        <div className="pa-icon" aria-hidden="true">
          <Hourglass size={30} strokeWidth={2} />
        </div>

        <h1 className="pa-title">حسابك في انتظار المراجعة</h1>
        {displayName ? <p className="pa-text">شكراً لتسجيلك يا {displayName}.</p> : null}
        <p className="pa-text">
          حسابك كصاحب مساحة بانتظار موافقة الإدارة قبل تفعيله. بعد الموافقة ستتمكّن من
          الوصول إلى لوحة تحكم مساحاتك.
        </p>

        <div className="pa-eta">
          <Clock size={15} strokeWidth={2.2} />
          الوقت المتوقع للموافقة: 24–48 ساعة
        </div>

        <div>
          <button
            type="button"
            className="pa-btn"
            onClick={() => navigate('/login', { replace: true })}
          >
            <LogOut size={17} strokeWidth={2.2} />
            العودة لتسجيل الدخول
          </button>
        </div>

        <p className="pa-note">
          إن كان حسابك مفعّلاً بالفعل، فقد سجّل الدخول بالطريقة العادية.
        </p>
      </main>
    </div>
  );
}
