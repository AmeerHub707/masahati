import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useDialogA11y } from '../../../lib/dialogA11y';

const SPOTLIGHT_PADDING = 10;
const GAP = 14;
const VIEWPORT_MARGIN = 16;
const POPOVER_WIDTH = 340;
const MAX_FIND_MS = 3000;
const SETTLE_MS = 420;

const STEPS = [
  {
    id: 'header',
    target: 'owner-header',
    title: 'أهلاً بك في لوحة المالك',
    description: 'من هذا الشريط تصل إلى الإشعارات وتبديل الوضع الليلي، مع عنوان التبويب الحالي وتاريخ اليوم.',
  },
  {
    id: 'sidebar',
    target: 'owner-sidebar',
    title: 'التنقل بين تبويباتك',
    description: 'هنا تتنقل بين: نظرة عامة، مساحاتي، الحجوزات، المالية، السوق المفتوح، إعلاناتي، التقييمات، والإعدادات. وتجد بيانات ملفك الشخصي في الأعلى.',
  },
  {
    id: 'metrics',
    target: 'owner-metrics',
    title: 'مؤشرات الأداء',
    description: 'هذه البطاقات الأربع تلخّص أدائك: أرباح هذا الشهر، حجوزات هذا الشهر، نسبة الإشغال اليوم، وطلبات السوق.',
  },
  {
    id: 'quick-add',
    target: 'owner-quick-add',
    title: 'أضف مساحة جديدة',
    description: 'من هنا تضيف مساحة جديدة مع وثائق الإثبات. بعد الإرسال تراجعها الإدارة، وتظهر للعملاء بعد الاعتماد.',
    beforeStep: ({ onNavigate }) => onNavigate?.('my-spaces'),
  },
  {
    id: 'assistant',
    target: 'owner-assistant',
    title: 'مساعدك الذكي',
    description: 'اسأل عن مساحاتك وحجوزاتك وأرباحك واحصل على توصيات سريعة. وتتحكم في خصوصية البيانات من داخل المساعد نفسه.',
  },
];

function padRect(rect) {
  return {
    left: rect.left - SPOTLIGHT_PADDING,
    top: rect.top - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function isRtl() {
  if (typeof document === 'undefined') return true;
  const root = document.documentElement;
  const attr = root?.getAttribute?.('dir');
  if (attr) return attr.toLowerCase() === 'rtl';
  const view = document.defaultView;
  try {
    if (view && typeof view.getComputedStyle === 'function') {
      return view.getComputedStyle(root).direction === 'rtl';
    }
  } catch { /* بيئة بلا حساب أنماط */ }
  return true;
}

function placementCandidate(rect, placement, w, h, vw, vh, rtl) {
  let top = rect.top + rect.height / 2 - h / 2;
  let left;
  if (placement === 'inline-end') left = rtl ? rect.left - GAP - w : rect.right + GAP;
  else if (placement === 'inline-start') left = rtl ? rect.right + GAP : rect.left - GAP - w;
  else left = rect.left + rect.width / 2 - w / 2;
  if (placement === 'bottom') top = rect.bottom + GAP;
  else if (placement === 'top') top = rect.top - GAP - h;
  return { top, left };
}

function computePosition(rect, w, h, vw, vh, rtl) {
  const placements = ['inline-end', 'inline-start', 'bottom', 'top'];
  for (const placement of placements) {
    const pos = placementCandidate(rect, placement, w, h, vw, vh, rtl);
    const fits =
      pos.left >= VIEWPORT_MARGIN &&
      pos.left + w <= vw - VIEWPORT_MARGIN &&
      pos.top >= VIEWPORT_MARGIN &&
      pos.top + h <= vh - VIEWPORT_MARGIN;
    if (fits) {
      return { top: pos.top, left: pos.left, placement };
    }
  }
  const fallback = placementCandidate(rect, 'bottom', w, h, vw, vh, rtl);
  return {
    top: clamp(fallback.top, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vh - h - VIEWPORT_MARGIN)),
    left: clamp(fallback.left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vw - w - VIEWPORT_MARGIN)),
    placement: 'bottom',
  };
}

export default function OwnerTour({
  open,
  step,
  onStepChange,
  onFinish,
  onDismiss,
  onNavigate,
}) {
  const total = STEPS.length;
  const current = STEPS[step - 1] || STEPS[0];
  const reduceMotion = useReducedMotion();
  const [rtl] = useState(isRtl);

  // القياس يُخزَّن مع اسم الهدف، فيُهمَل تلقائياً عند تغيّر الخطوة
  // أو الإغلاق بدل تصفيره يدوياً من داخل التأثير.
  const [measured, setMeasured] = useState({ target: '', rect: null });
  const [popSize, setPopSize] = useState({ w: POPOVER_WIDTH, h: 220 });

  const rect = measured.target === current.target ? measured.rect : null;
  const titleId = 'otour-title';
  const descId = 'otour-desc';

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  const dialogRef = useDialogA11y({ open, onClose: handleDismiss });

  const goTo = useCallback(
    (next) => {
      if (next > total) {
        onFinish?.();
        return;
      }
      onStepChange?.(next);
    },
    [onFinish, onStepChange, total]
  );

  const handleNext = useCallback(() => goTo(step + 1), [goTo, step]);
  const handleBack = useCallback(() => {
    if (step > 1) onStepChange?.(step - 1);
  }, [onStepChange, step]);

  // قياس البطاقة عند تركيبها (وبتغيّر الخطوة) يحدّث الموضع في نفس دورة الالتزام.
  const setPopNode = useCallback(
    (node) => {
      dialogRef.current = node;
      if (!node) return;
      const box = node.getBoundingClientRect();
      setPopSize({ w: box.width || POPOVER_WIDTH, h: box.height || 220 });
    },
    [dialogRef]
  );

  useEffect(() => {
    if (!open) return;
    current.beforeStep?.({ onNavigate });
  }, [open, step, current, onNavigate]);

  useEffect(() => {
    if (!open) return undefined;
    let frame = 0;
    let findDeadline = 0;
    let settleUntil = 0;
    let observer = null;
    let disposed = false;

    const readRect = () => {
      const el = document.querySelector(`[data-tour="${current.target}"]`);
      return el ? el.getBoundingClientRect() : null;
    };

    const observe = (el) => {
      if (observer || typeof ResizeObserver === 'undefined') return;
      observer = new ResizeObserver(() => {
        if (!disposed) setMeasured({ target: current.target, rect: el.getBoundingClientRect() });
      });
      observer.observe(el);
    };

    const storeRect = (next) => {
      if (disposed) return;
      setMeasured({ target: current.target, rect: next });
    };

    const tick = () => {
      if (disposed) return;
      const r = readRect();
      if (r) {
        storeRect(r);
        const el = document.querySelector(`[data-tour="${current.target}"]`);
        if (el) observe(el);
        if (!settleUntil) settleUntil = performance.now() + SETTLE_MS;
        if (performance.now() < settleUntil) frame = requestAnimationFrame(tick);
        return;
      }
      if (!findDeadline) findDeadline = performance.now() + MAX_FIND_MS;
      if (performance.now() > findDeadline) {
        if (step < total) onStepChange?.(step + 1);
        else onFinish?.();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    tick();

    const onViewportChange = () => {
      const r = readRect();
      if (r) storeRect(r);
    };

    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
    };
  }, [open, current.target, onFinish, onStepChange, step, total]);

  // الموضع مشتقّ من القياس، فلا يحتاج حالة مستقلة ولا تحديثاً داخل التأثير.
  const pos = useMemo(() => {
    if (!open || !rect) return null;
    return computePosition(rect, popSize.w, popSize.h, window.innerWidth, window.innerHeight, rtl);
  }, [open, rect, popSize, rtl]);

  useEffect(() => {
    if (!open) return undefined;
    const root = document.getElementById('root');
    if (!root) return undefined;
    const previous = root.inert;
    root.inert = true;
    return () => {
      root.inert = previous;
    };
  }, [open]);

  const spot = useMemo(() => (rect ? padRect(rect) : null), [rect]);
  const isLast = step >= total;
  const BackIcon = rtl ? ArrowRight : ArrowLeft;
  const NextIcon = rtl ? ArrowLeft : ArrowRight;

  if (typeof document === 'undefined' || !open) return null;

  return createPortal(
    <div className="otour" data-tour-overlay="">
      {spot && (
        <svg className="otour__spotlight" aria-hidden="true" focusable="false">
          <defs>
            {/* قناع الإضاءة: الأبيض = التعتيم ظاهر، الأسود = فتحة تُظهر العنصر بلونه الطبيعي */}
            <mask id="otour-spot-mask">
              <rect data-tour-mask="base" x="0" y="0" width="100%" height="100%" fill="#fff" />
              <rect
                data-tour-mask="hole"
                x={spot.left}
                y={spot.top}
                width={spot.width}
                height={spot.height}
                rx="16"
                fill="#000"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(8,8,10,.68)"
            mask="url(#otour-spot-mask)"
          />
          <rect
            className="otour__ring"
            x={spot.left}
            y={spot.top}
            width={spot.width}
            height={spot.height}
            rx="16"
          />
        </svg>
      )}

      <motion.div
        key={`otour-step-${step}`}
        ref={setPopNode}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        data-tour="owner-tour-popover"
        data-tour-step={step}
        className="otour__popover"
        style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <div className="otour__head">
          <span className="otour__counter" aria-live="polite">
            {`الخطوة ${step} من ${total}`}
          </span>
          <button
            type="button"
            className="otour__close"
            onClick={handleDismiss}
            data-tour="owner-tour-skip"
            aria-label="تخطي الجولة"
          >
            <X />
          </button>
        </div>

        <h3 id={titleId} className="otour__title">
          {current.title}
        </h3>
        <p id={descId} className="otour__desc">
          {current.description}
        </p>

        <div className="otour__dots" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`otour__dot${i + 1 === step ? ' is-active' : ''}${i + 1 < step ? ' is-done' : ''}`} />
          ))}
        </div>

        <div className="otour__actions">
          <button type="button" className="otour__skip" onClick={handleDismiss} data-tour="owner-tour-skip-text">
            تخطي
          </button>
          <div className="otour__nav">
            {step > 1 && (
              <button type="button" className="otour__btn otour__btn--ghost" onClick={handleBack} data-tour="owner-tour-back">
                <BackIcon /> السابق
              </button>
            )}
            {isLast ? (
              <button type="button" className="otour__btn otour__btn--primary" onClick={() => goTo(total + 1)} data-tour="owner-tour-finish">
                <Check /> تم
              </button>
            ) : (
              <button type="button" className="otour__btn otour__btn--primary" onClick={handleNext} data-tour="owner-tour-next">
                التالي <NextIcon />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
