// نظام الثيم: الوضع الافتراضي يتبع ثيم النظام (prefers-color-scheme)
// زر التبديل يتجاوز الافتراضي ويحفظ الاختيار في localStorage.
const STORAGE_KEY = '***';

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// القيمة المخزنة قد تكون 'light' | 'dark' | undefined (لم يختر المستخدم بعد)
export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getInitialTheme() {
  const stored = getStoredTheme();
  if (stored === 'light' || stored === 'dark') return stored;
  return systemPrefersDark() ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}

export function setTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* تجاهل إن تعذر الحفظ */
  }
  applyTheme(theme);
}

// يُستدعى مرة واحدة عند الإقلاع (قبل الرسم لتفادي الوميض)
export function initTheme() {
  applyTheme(getInitialTheme());
}

// يراقب تغيّر ثيم النظام فقط إن لم يختر المستخدم يدوياً
export function watchSystemTheme(onChange) {
  if (!window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    if (getStoredTheme()) return; // المستخدم اختار يدوياً
    onChange(e.matches ? 'dark' : 'light');
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
