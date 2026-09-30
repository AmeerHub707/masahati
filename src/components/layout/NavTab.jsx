import { Link, useLocation } from 'react-router-dom';

// عنصر تبويب مستقل قابل لإعادة الاستخدام داخل شريط التنقل.
// يضيف is-active تلقائياً عند مطابقة المسار (أو الهاش) الحالي،
// فيعرف المستخدم أين هو داخل الشريط دون الحاجة لتمرير الحالة من المكوّن الأب.
export default function NavTab({ label, to, href, onClick }) {
  const location = useLocation();

  const isActive = to
    ? location.pathname === to
    : Boolean(href) && location.hash === href;

  const className = isActive ? 'nav-tab is-active' : 'nav-tab';
  const current = isActive ? 'page' : undefined;

  if (to) {
    return (
      <Link className={className} to={to} onClick={onClick} aria-current={current}>
        {label}
      </Link>
    );
  }

  return (
    <a className={className} href={href} onClick={onClick} aria-current={current}>
      {label}
    </a>
  );
}
