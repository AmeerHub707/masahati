import { Link } from 'react-router-dom';

const stats = [
  { value: '120+', label: 'مساحة موثّقة' },
  { value: '24/7', label: 'فلتر الكهرباء' },
  { value: '5 min', label: 'لحجز مقعد' },
  { value: '4.8★', label: 'تقييم الأعضاء' },
];

export default function Hero() {
  return (
    <>
      <header className="hero">
        <span className="blob blob--orange" style={{ top: '-6rem', right: '-5rem' }}></span>
        <span className="blob blob--soft" style={{ bottom: '-3rem', left: '8rem' }}></span>

        <div className="wrap hero__inner">
          <div className="hero__copy">
            <span className="live-chip"><span className="live-dot"></span>متصل الآن في غزة — جاهز للحجز</span>
            <span className="eyebrow"><span className="dot"></span>أول منصة لمساحات العمل المشتركة في غزة</span>
            <h1>اعثر على <span className="hl">مساحتك — بكهرباء ونت ومقعد، بنقرة واحدة.</span></h1>
            <p className="lead">تجمع مساحاتي كل مساحات العمل المشتركة وقاعات الدراسة في مكان واحد. قارن الأسعار وسرعة الإنترنت وتوفّر الكهرباء، ثم احجز مقعدك مباشرةً — دون اتصال ولا رسالة.</p>
            <div className="hero__cta">
              <Link className="btn-primary" to="/signup">ابدأ الآن</Link>
            </div>
          </div>

          <div className="hero__aside">
            <div className="hero__photo">
              <img src="/Loginside.jpg" alt="مساحة عمل مشتركة مضيئة في غزة" />
              <span className="photo-sheen"></span>
            </div>
          </div>
        </div>
      </header>

      <div className="wrap">
        <div className="stats">
          {stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
