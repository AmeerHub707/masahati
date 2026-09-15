import { Link } from 'react-router-dom';

export default function SpacesPage() {
  return (
    <div className="placeholder-page">
      <div className="wrap">
        <h1>تصفح المساحات</h1>
        <p>قريباً: قائمة المساحات المتاحة للحجز مع الفلاتر والخرائط.</p>
        <Link className="btn-primary" to="/">العودة للرئيسية</Link>
      </div>
    </div>
  );
}
