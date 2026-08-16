import { Link } from 'react-router-dom';

export default function CtaBand() {
  return (
    <div className="wrap">
      <section className="cta-band">
        <span className="blob blob--soft" style={{ top: '-4rem', right: '-3rem' }}></span>
        <span className="blob blob--soft" style={{ bottom: '-4rem', left: '-2rem' }}></span>
        <h2>جاهز لتجد مساحتك؟</h2>
        <p>انضم إلى الطلاب وأصحاب المساحات في غزة على المنصة المبنية للعمل الموثوق القابل للحجز.</p>
        <div className="hero__cta" style={{ justifyContent: 'center' }}>
          <Link className="btn-primary btn-light" to="/signup">أنشئ حسابك</Link>
          <Link className="btn-ghost btn-outline" to="/login">تسجيل الدخول</Link>
        </div>
      </section>
    </div>
  );
}
