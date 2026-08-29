import { Link } from 'react-router-dom';
import MagneticButton from '../common/MagneticButton';

export default function CtaBand() {
  return (
    <div className="wrap">
      <section className="cta-glass">
        {/* صورة الغروب كخلفية رئيسية للبطاقة */}
        <div className="cta-glass__photo" aria-hidden="true" />

        {/* نافذة زجاجية شفافة تحتوي على العنوان والإجراءات فقط */}
        <div className="cta-glass__card">
          <h2>جاهز لتجد مساحتك؟</h2>
          <p>انضم إلى الطلاب وأصحاب المساحات في غزة على المنصة المبنية للعمل الموثوق القابل للحجز.</p>

          <div className="cta-actions">
            <MagneticButton>
              <Link className="cta-btn cta-btn--primary" to="/signup">
                <span>أنشئ حسابك</span>
                <svg className="cta-btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 6l-6 6 6 6" />
                </svg>
              </Link>
            </MagneticButton>
            <Link className="cta-btn cta-btn--ghost" to="/login">تسجيل الدخول</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
