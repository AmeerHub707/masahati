import { Link } from 'react-router-dom';

// عنصر تبويب مستقل قابل لإعادة الاستخدام داخل شريط التنقل
export default function NavTab({ label, to, href, onClick }) {
  const className = 'nav-tab';

  if (to) {
    return (
      <Link className={className} to={to} onClick={onClick}>
        {label}
      </Link>
    );
  }

  return (
    <a className={className} href={href} onClick={onClick}>
      {label}
    </a>
  );
}
