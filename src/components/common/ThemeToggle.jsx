import { Moon, Sun } from 'lucide-react';
import useTheme from '../../hooks/useTheme';

export default function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      className={`dash__theme-btn${className ? ` ${className}` : ''}`}
      onClick={toggle}
      aria-label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}