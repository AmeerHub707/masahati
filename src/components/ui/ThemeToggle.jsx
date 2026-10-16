import { Moon, Sun } from 'lucide-react';
import { useTranslation } from '@/hooks/useT';
import useTheme from '@/hooks/useTheme';

export default function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useTheme();
  const { t } = useTranslation('nav');
  const label = dark ? t('lightMode') : t('darkMode');
  return (
    <button
      type="button"
      className={`dash__theme-btn${className ? ` ${className}` : ''}`}
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}