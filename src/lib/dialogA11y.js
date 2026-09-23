import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function isVisible(el) {
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
}

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
}

/**
 * تجربة وصول موحّدة لكل نوافذ لوحة المالك (WCAG 2.1.2 + 2.4.3):
 *  - حصر التنقل بالـ Tab داخل الحاوية أثناء فتحها (trap)
 *  - إغلاق بزر Escape
 *  - إعادة التركيز للعنصر الذي فتح النافذة عند إغلاقها
 *  - نقل التركيز لأول عنصر قابل للتركيز عند الفتح
 */
export function useDialogA11y({ open, onClose, trap = true, initialFocusRef } = {}) {
  const containerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const prevFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    prevFocusedRef.current = document.activeElement;

    const initial =
      (initialFocusRef && initialFocusRef.current) ||
      container.querySelector('[data-autofocus]') ||
      getFocusable(container)[0] ||
      container;
    if (initial && typeof initial.focus === 'function') initial.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (!trap || e.key !== 'Tab') return;
      const items = getFocusable(container);
      if (items.length === 0) {
        e.preventDefault();
        if (typeof container.focus === 'function') container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const prev = prevFocusedRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus();
    };
  }, [open, trap, initialFocusRef]);

  return containerRef;
}
