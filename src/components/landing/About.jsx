import TiltCard from '../common/TiltCard';

const cards = [
  {
    title: 'رسالتنا',
    desc: 'أن نجعل إيجاد مساحة عمل لائقة أمراً سهلاً وموثوقاً، مهما كانت الظروف.',
    icon: <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z" />,
  },
  {
    title: 'مجتمعنا',
    desc: 'طلاب ومستقلّون وأصحاب مساحات يتعاونون ليبقى العمل مستمراً في غزة.',
    icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  },
  {
    title: 'قيمنا',
    desc: 'الشفافية، الموثوقية، والوصول للجميع — في كل مساحة نعرضها.',
    icon: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  },
];

export default function About() {
  return (
    <section className="section" id="about">
      <div className="section__head">
        <span className="kicker">من نحن</span>
        <h2>بُنيت مساحاتي لغزة</h2>
        <p>فريق شبابي فلسطيني آمن أن العمل المشترك حق للجميع — فبنى منصة تجمع المساحات والناس بثقة.</p>
      </div>

      <div className="wrap grid-3">
        {cards.map((c) => (
          <TiltCard key={c.title}>
            <div className="feature glow-border glow-box">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
              </div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
