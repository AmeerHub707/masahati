import TiltCard from '../common/TiltCard';

const check = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const roles = [
  {
    tag: 'طالب',
    title: 'احجز وقارن',
    icon: (
      <>
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" />
      </>
    ),
    items: [
      'تصفّح المساحات حسب السعر والسرعة والكهرباء',
      'احجز مقعداً في أقل من خمس دقائق',
      'احفظ المفضّلة وادرس بتركيز',
    ],
  },
  {
    tag: 'صاحب مساحة',
    title: 'اعرض مساحتك',
    icon: (
      <>
        <path d="M3 21h18M5 21V7l8-4 8 4v14" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
    items: [
      'انشر مساحتك بصور وأسعار',
      'أدِر الحجوزات والتوفّر',
      'تحتاج موافقة المشرف قبل النشر',
    ],
  },
  {
    tag: 'موثوق',
    title: 'موثّق وآمن',
    icon: (
      <>
        <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    items: [
      'كل مساحة تُراجَع قبل النشر',
      'أعضاء موثّقو البريد فقط',
      'التقييمات تحفظ جودة الشفافية',
    ],
  },
];

export default function Roles() {
  return (
    <section className="section roles" id="roles">
      <div className="section__head">
        <span className="kicker">لكلٍّ كما يناسبه</span>
        <h2>لكلٍّ كما يناسبه — طالب أو صاحب مساحة</h2>
        <p>سواء كنت تبحث عن مقعد هادئ أو تريد عرض مساحتك، مساحاتي مبنية للطرفين.</p>
      </div>

      <div className="wrap grid-3">
        {roles.map((r) => (
          <TiltCard key={r.title}>
            <div className="role-card glow-border glow-box">
              <div className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{r.icon}</svg>
              </div>
              <span className="tag">{r.tag}</span>
              <h3>{r.title}</h3>
              <ul>
                {r.items.map((li) => (
                  <li key={li}>
                    {check}
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
