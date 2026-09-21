import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'masahati_theme';

function getInitialDark() {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDark(dark) {
  document.documentElement.classList.toggle('dark', dark);
}

function removeDark() {
  document.documentElement.classList.remove('dark');
}

export default function useTheme() {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    applyDark(dark);
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return { dark, toggle };
}

export function useForceLight() {
  useEffect(() => {
    const previously = document.documentElement.classList.contains('dark');
    removeDark();
    return () => {
      if (previously) applyDark(true);
    };
  }, []);
}