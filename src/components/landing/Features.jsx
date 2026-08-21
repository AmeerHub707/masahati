const features = [
  {
    title: 'أسعار شفافة',
    desc: 'الأسعار بالساعة واليوم جنباً إلى جنب — بلا رسوم خفية ولا مفاجآت على الباب.',
    icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  },
  {
    title: 'سرعة إنترنت حقيقية',
    desc: 'صفِ حسب الرفع والتنزيل لتستقرّ مكالماتك ورفع ملفاتك حيث يهمّ الأمر.',
    icon: <path d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01" />,
  },
  {
    title: 'حالة الكهرباء',
    desc: 'اعرف أي المساحات بها كهرباء ٢٤/٧ أو بديلة — واحجز بثقة أثناء الانقطاعات.',
    icon: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
  },
];

export default function Features() {
  return (
    <section className="section" id="features">
      <div className="section__head">
        <span className="kicker">لماذا مساحاتي</span>
        <h2>قارن ما يهمّ فعلاً</h2>
        <p>توقّف عن التخمين. كل مساحة تعرض أرقاماً حقيقية لتختار مقعدك المناسب قبل أن تخرج من منزلك.</p>
      </div>

      <div className="wrap grid-3">
        {features.map((f) => (
          <div className="feature" key={f.title}>
            <div className="ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
