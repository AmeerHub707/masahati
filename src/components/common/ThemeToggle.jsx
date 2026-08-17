import { useEffect, useState } from 'react';
import { getInitialTheme, getStoredTheme, setTheme, watchSystemTheme } from '../../lib/theme';

export default function ThemeToggle() {
  const [theme, setLocalTheme] = useState(getInitialTheme);

  useEffect(() => {
    const off = watchSystemTheme((t) => {
      setLocalTheme(t);
      // فقط إن لم يختر المستخدم يدوياً نطبّق تغيّر النظام
      if (!getStoredTheme()) document.documentElement.setAttribute(t === 'dark' ? 'data-theme' : 'data-theme', t === 'dark' ? 'dark' : '');
      if (t === 'light') document.documentElement.removeAttribute('data-theme');
    });
    return off;
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setLocalTheme(next);
    setTheme(next);
  };

  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
      title={isDark ? 'الوضع الداكن' : 'الوضع الفاتح'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}
