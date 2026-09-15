import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

const ads = [
  { id: 1, title: 'مساحة عمل فاخرة', desc: 'استمتع بتجربة عمل مريحة في بيئة احترافية مع جميع المرافق. مساحة مفتوحة واسعة بإضاءة طبيعية ومكاتب مريحة وخدمة إنترنت فائقة السرعة.', badge: 'جديد', price: '25 ر.س/ساعة', features: ['إنترنت فائق السرعة', 'مكاتب مريحة', 'إضاءة طبيعية', 'قهوة مجانية', 'موقف سيارات'] },
  { id: 2, title: 'قاعة اجتماعات', desc: 'قاعة مجهزة بالكامل لاجتماعات العمل والمحاضرات. شاشة عرض كبيرة ونظام صوتي متطور وسброс انترنت سلكي ولاسلكي.', badge: 'متوفر', price: '50 ر.س/ساعة', features: ['شاشة عرض 75 بوصة', 'نظام صوتي', 'سبورة بيضاء', 'إنترنت سلكي', 'تحكم بالإنارة'] },
  { id: 3, title: 'مكتب خاص', desc: 'مكتب خاص مع خصوصية تامة ومناسب للعمل المركّز. مدخل خاص وقفل رقمي وتجهيزات مكتبية كاملة.', badge: 'حصري', price: '40 ر.س/ساعة', features: ['خصوصية تامة', 'قفل رقمي', 'مكتب كبير', 'خزانة ملفات', 'تكييف مستقل'] },
  { id: 4, title: 'مساحة مشتركة', desc: 'مساحة عمل مشتركة مناسبة للـ freelancers والمشاريع الناشئة. بيئة عمل تفاعلية مع فرصة التواصل مع رواد أعمال آخرين.', badge: 'الأكثر طلباً', price: '15 ر.س/ساعة', features: ['مكاتب مشتركة', 'منطقة استراحة', 'إنترنت سريع', 'مطبخ مشترك', 'فعاليات شهرية'] },
  { id: 5, title: 'استوديو تصوير', desc: 'استوديو مجهز للتصوير الفوتوغرافي والفيديو. خلفيات متعددة ومعدات احترافية وإضاءة صناعية.', badge: 'جديد', price: '60 ر.س/ساعة', features: ['خلفيات متعددة', 'إضاءة احترافية', 'كاميرات متوفرة', 'غرفة ملابس', 'مونتاج فوري'] },
  { id: 6, title: 'صالة مؤتمرات', desc: 'صالة كبيرة لإقامة المؤتمرات والفعاليات الكبيرة. تتسع لأكثر من 200 شخص مع تجهيزات صوتية وبصرية متكاملة.', badge: 'متوفر', price: '150 ر.س/ساعة', features: ['سعة 200+ شخص', 'نظام صوت متطور', 'شاشات عرض متعددة', 'منصة رئيسية', 'خدمة ضيافة'] },
  { id: 7, title: 'ورشة عمل', desc: 'مساحة عمل مناسبة للحرفيين والحرف اليدوية. مجهزة بأدوات وتجهيزات خاصة مع نظام تهوية متطور.', badge: 'حصري', price: '35 ر.س/ساعة', features: ['أدوات عمل', 'نظام تهوية', 'منطقة تخزين', 'مغسلة', 'مكتب إداري'] },
  { id: 8, title: 'مكتب تنفيذي', desc: 'مكتب فاخر للمسؤولين التنفيذيين مع إطلالة رائعة. ديكور عصري ومجهز بأحدث التقنيات.', badge: 'الأكثر طلباً', price: '80 ر.س/ساعة', features: ['إطلالة بانورامية', 'ديكور فاخر', 'غرفة اجتماعات خاصة', 'ميني بار', 'خدمة كونسيرج'] },
  { id: 9, title: 'مساحة تعليمية', desc: 'مساحة مناسبة للدروس الخصوصية والـ workshops التعليمية. سبورة ذكية وتجهيزات تعليمية متكاملة.', badge: 'جديد', price: '20 ر.س/ساعة', features: ['سبورة ذكية', 'جهاز عرض', 'مقاعد متحركة', 'إنترنت تعليمي', 'صوت مكشوف'] },
  { id: 10, title: 'مختبر تقني', desc: 'مختبر مجهز للتجارب التقنية والابتكار. أجهزة حاسوب متقدمة وبرمجيات مخصصة و_backup كهربائي.', badge: 'متوفر', price: '70 ر.س/ساعة', features: ['أجهزة متقدمة', 'برمجيات مخصصة', 'backup كهربائي', 'خادم محلي', 'شاشة عرض'] },
];

const gallery = [
  '/Loginside.jpg',
  '/360-workspace-kita-e2-open-office.jpg',
  '/images.jfif',
  '/m.jfif',
];

export default function AdDetailsPage() {
  const { id } = useParams();
  const ad = ads.find((a) => a.id === Number(id));
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setActiveImg((i) => (i + 1) % gallery.length), 5000);
    return () => clearInterval(t);
  }, []);

  if (!ad) {
    return (
      <div className="placeholder-page">
        <h1>الإعلان غير موجود</h1>
        <p>الإعلان الذي تبحث عنه غير متاح حالياً.</p>
        <Link className="btn-primary" to="/">العودة للرئيسية</Link>
      </div>
    );
  }

  return (
    <div className="ad-details">
      <div className="wrap">
        <Link to="/" className="ad-details__back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          العودة للرئيسية
        </Link>

        <div className="ad-details__hero">
          <div className="ad-details__gallery">
            {gallery.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={ad.title}
                className={`ad-details__img${i === activeImg ? ' is-active' : ''}`}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            ))}
            <div className="ad-details__scrim" />
            <div className="ad-details__gallery-dots">
              {gallery.map((_, i) => (
                <button
                  key={i}
                  className={`ad-details__dot${i === activeImg ? ' is-active' : ''}`}
                  onClick={() => setActiveImg(i)}
                  aria-label={`صورة ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="ad-details__info">
            <div className="tag" style={{ marginBottom: '0.8rem', alignSelf: 'flex-start' }}>{ad.badge}</div>
            <h1>{ad.title}</h1>
            <p className="ad-details__price">{ad.price}</p>
            <p className="ad-details__desc">{ad.desc}</p>

            <div className="ad-details__features">
              <h3>المميزات</h3>
              <ul>
                {ad.features.map((f) => (
                  <li key={f}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <Link className="btn-primary ad-details__cta" to="/signup">احجز الآن</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
