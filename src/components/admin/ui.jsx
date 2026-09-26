import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, MoreVertical, X, Star, CheckCircle2 } from 'lucide-react';
import DashCountUp from '../dashboard/DashCountUp';
import { placeFixed, MENU_WIDTH, MENU_HEIGHT } from './menuPosition';

// مكوّنات واجهة مشتركة للوحة تحكم المشرف — مبنية على نظام تصميم dash__ (لوحة المستخدم).

export function SectionCard({ className = '', children }) {
  return (
    <div className={`dash__card ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="dash__section-head mb-4 flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: '1rem' }}>
      <div className="flex items-center gap-3">
        <span className="st-ico">
          <Icon />
        </span>
        <div>
          <h2 style={{ margin: 0, display: 'block' }}>{title}</h2>
          {subtitle && (
            <p className="m-0 text-sm" style={{ margin: '.1rem 0 0', fontSize: '.82rem', color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function ViewAllButton({ onClick, label = 'عرض الكل' }) {
  return (
    <button type="button" className="dash__show-all" onClick={onClick}>
      {label}
      <ArrowLeft className="h-3.5 w-3.5" />
    </button>
  );
}

const statTones = {
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
};

export function StatCard({ icon: Icon, label, value, hint, tone = 'orange', currency, trend = 'up', commas = false }) {
  const cls = statTones[tone] || statTones.orange;
  const isWarn = trend === 'warn';
  const isUp = trend === 'up';
  return (
    <div
      className={`group relative rounded-xl border bg-white p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-400/40 hover:shadow-xl hover:shadow-orange-500/10 dark:bg-[#1c1c22] ${
        isWarn ? 'border-amber-300/80 dark:border-amber-500/30' : 'border-[var(--border)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {isWarn && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500"></span>
            </span>
          )}
          <span className="text-base font-bold leading-snug text-slate-800 dark:text-slate-100">{label}</span>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${cls}`}>
          <Icon />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-2xl font-bold leading-none" style={{ color: 'var(--accent)' }}>
          <DashCountUp value={value} commas={commas} />
          {currency && <span className="mr-1 font-normal text-sm text-slate-500 dark:text-slate-400">{currency}</span>}
        </span>
        {isWarn ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            {hint}
          </span>
        ) : (
          <span
            dir="ltr"
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}
          >
            {isUp ? '↑' : '↓'} {hint}
          </span>
        )}
      </div>
    </div>
  );
}

// شارة حالة ملوّنة: نشط/موقوف/مؤكد/مكتمل/متنازع عليه…
const badgeMap = {
  green: 'badge--confirmed',
  red: 'badge--cancelled',
  amber: 'badge--pending',
  blue: 'badge--blue',
  violet: 'badge--violet',
  gray: 'badge--gray',
  orange: 'badge--orange',
};

export function StatusBadge({ children, tone = 'gray', icon: Icon }) {
  return (
    <span className={`badge ${badgeMap[tone] || badgeMap.gray}`}>
      {Icon && <Icon />}
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, actionIcon: ActionIcon }) {
  return (
    <div className="dash__state">
      <div className="st-svg"><Icon /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && (
        <button type="button" className="btn-primary" onClick={onAction}>
          {ActionIcon && <ActionIcon />}
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`modal-box ${wide ? 'max-w-xl' : ''}`}
        style={{ maxWidth: wide ? '40rem' : undefined, textAlign: 'initial' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="m-0" style={{ fontSize: '1.15rem' }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="dash__iconbtn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, error, children, htmlFor }) {
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={htmlFor} className="dash__field-label">
          {label}
        </label>
      )}
      {children}
      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}

// إشعار عائم (Toast) بديلاً عن alert() في متصفّح المستخدم.
export function Toast({ message, onClose, icon: Icon = CheckCircle2 }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="dash__toast fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold shadow-2xl dark:border-white/10 dark:bg-[#1c1c22] dark:text-gray-200"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
        <Icon className="h-4 w-4" />
      </span>
      {message}
      <button
        type="button"
        onClick={onClose}
        aria-label="إغلاق"
        className="ms-1 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// خطّاف useToast lives in ./useToast.js — تصدير خطّاف من هنا يخالف قاعدة react-refresh.

export const inputCls = 'dash__input';

export const btnPrimary = 'btn-primary';

export const btnGhost = 'btn-ghost';

export const btnDanger = 'btn-danger';

// حبوب التصفية/التبويب — تُمرَّر بقية الخصائص (aria-pressed, aria-current, data-*) كما هي.
export function Pill({ active = false, onClick, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-extrabold transition-all duration-200 [&_svg]:h-4 [&_svg]:w-4 ${
        active
          ? 'border-transparent bg-orange-500 text-white shadow-sm shadow-orange-500/20'
          : 'border-black/15 bg-white text-[var(--text-muted)] hover:border-orange-500 hover:bg-orange-50 hover:text-orange-500 dark:border-[var(--border)] dark:bg-transparent dark:text-[var(--text-muted)] dark:hover:border-orange-500 dark:hover:bg-orange-500/10 dark:hover:text-orange-400'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// زر أيقوني مربع
export function IconButton({ tone = '', label, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`dash__iconbtn${tone ? ` is-${tone}` : ''} ${className}`}
    >
      {children}
    </button>
  );
}

// زر إجراء صغير ملوّن
export function SmallAction({ tone, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dash__btn-soft is-${tone} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * قائمة إجراءات عائمة خلف زر «⋮» — مشتركة بين كل البطاقات والصفوف.
 *
 * items: [{ id, label, icon: Icon, onSelect, tone: 'danger' | 'danger-soft' }] أو { id, separator: true }
 * القائمة تُعرض عبر بوابة على body حتى لا يقصّها أي حاوية overflow، وتُعاد محاذاتها أثناء
 * التمرير (بمرحلة الالتقاط) وحجم النافذة، وتُغلق بالضغط خارجها أو بمفتاح Escape.
 *
 * ملاحظة مهمة: AnimatePresence داخل createPortal وليس العكس — لأن Framer Motion يتجاهل
 * عناصر createPortal كأبناء (يرشّحها onlyElements) فلا تظهر القائمة ولا تعمل حركة الخروج.
 */
export function ActionMenu({ items = [], label, menuId, className = '', buttonClassName = '' }) {
  const [menu, setMenu] = useState(null);

  const toggle = (e) => {
    // القائمة مثبتة على body، لكن React يمرّر الأحداث عبر شجرة المكوّنات لا شجرة DOM،
    // فأي نقرة داخلها تصل إلى onClick الخاص بالبطاقة — لذلك نوقفها عند المصدر.
    e.stopPropagation();
    const anchor = e.currentTarget;
    const { top, left } = placeFixed(anchor.getBoundingClientRect(), MENU_WIDTH, MENU_HEIGHT);
    setMenu((cur) => (cur && cur.anchor === anchor ? null : { anchor, top, left }));
  };

  // الإغلاق بالضغط خارج القائمة أو بمفتاح Escape.
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (!e.target?.closest?.('[data-action-menu]')) setMenu(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // تتبّع المرساة أثناء التمرير/resize حتى لا تنفصل القائمة الثابتة عن الزر.
  useEffect(() => {
    if (!menu) return undefined;
    const reposition = () => {
      const anchor = menu.anchor;
      if (!anchor || !anchor.isConnected) {
        setMenu(null);
        return;
      }
      const pos = placeFixed(anchor.getBoundingClientRect(), MENU_WIDTH, MENU_HEIGHT);
      setMenu((cur) => (cur && cur.top === pos.top && cur.left === pos.left ? cur : { ...cur, ...pos }));
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [menu]);

  return (
    <span className={`inline-flex ${className}`} data-action-menu>
      <button
        type="button"
        className={`dash__menu-btn ${buttonClassName}`}
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        {...(menuId ? { 'aria-controls': menuId } : {})}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {createPortal(
        <AnimatePresence>
          {menu && (
            <motion.div
              key="action-menu"
              {...(menuId ? { id: menuId } : {})}
              className="dash__menu dash__menu--fixed"
              data-action-menu
              role="menu"
              aria-label={label}
              style={{ top: menu.top, left: menu.left }}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16 }}
            >
              {items.map((item) =>
                item.separator ? (
                  <span key={item.id} className="dash__menu-sep" role="separator" />
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={
                      item.tone === 'danger' ? 'is-danger' : item.tone === 'danger-soft' ? 'is-danger-soft' : ''
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu(null);
                      item.onSelect?.();
                    }}
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    {item.label}
                  </button>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}

// نجوم التقييم
export function Stars({ value, size = 16 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          width={size}
          height={size}
          className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}
        />
      ))}
    </span>
  );
}

// صورة رمزية بالأحرف الأولى (تدرّج برتقالي)
export function Avatar({ name, xs = false }) {
  return (
    <span className={`dash__avatar${xs ? ' dash__avatar--xs' : ''}`}>
      {(name || 'م').trim().slice(0, 2)}
    </span>
  );
}

// صف ملخص ملوّن
export function MiniRow({ tone, label, value }) {
  return (
    <li className={`dash__mini is-${tone}`}>
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
    </li>
  );
}

// تلميح عائم يُعرض عبر بوابة على body حتى لا يقصّه أي حاوية overflow
export function Tip({ label, children }) {
  const [pos, setPos] = useState(null);

  const measure = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({
      top: Math.max(8, r.top - 32),
      left: Math.min(Math.max(8, r.left - 60), Math.max(8, window.innerWidth - 160)),
    });
  };
  const hide = () => setPos(null);

  return (
    <>
      <span className="dash__tip-anchor" onPointerEnter={measure} onPointerLeave={hide} onFocus={measure} onBlur={hide}>
        {children}
      </span>
      {pos &&
        createPortal(
          <span className="dash__tip" role="tooltip" style={{ top: pos.top, left: pos.left }}>
            {label}
          </span>,
          document.body
        )}
    </>
  );
}