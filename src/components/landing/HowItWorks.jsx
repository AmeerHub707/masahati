import TiltCard from '../common/TiltCard';

const steps = [
  { title: 'استكشف', desc: 'صفِ مساحات غزة حسب السعر والسرعة والكهرباء — وشاهد بالضبط ما ستحصل عليه.' },
  { title: 'احجز', desc: 'اختر مقعداً وأكّد خلال ثوانٍ. يُحجز مقعدك ويتلقّى المالك إشعاراً فوراً.' },
  { title: 'احضر', desc: 'ادخل، وصِّل جهازك، واعمل. قيّم المساحة ليأخذ العضو التالي فكرة عمّا يتوقّعه.' },
];

export default function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="section__head">
        <span className="kicker">كيف يعمل</span>
        <h2>من التصفّح إلى المقعد في ثلاث خطوات</h2>
        <p>بلا اتصالات وبلا رسائل. فقط افتح وقارن واحجز.</p>
      </div>

      <div className="wrap steps">
        {steps.map((s) => (
          <TiltCard key={s.title}>
            <div className="step glow-border glow-box">
              <div className="num"></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
