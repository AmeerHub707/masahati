import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X, Star } from 'lucide-react';
import DashCountUp from '../dashboard/DashCountUp';

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

export const inputCls = 'dash__input';

export const btnPrimary = 'btn-primary';

export const btnGhost = 'btn-ghost';

export const btnDanger = 'btn-danger';

// حبوب التصفية/التبويب
export function Pill({ active = false, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-extrabold transition-all duration-200 [&_svg]:h-4 [&_svg]:w-4 ${
        active
          ? 'border-transparent bg-orange-500 text-white shadow-sm shadow-orange-500/20'
          : 'border-black/15 bg-white text-[var(--text-muted)] hover:border-orange-500 hover:bg-orange-50 hover:text-orange-500 dark:border-[var(--border)] dark:bg-transparent dark:text-[var(--text-muted)] dark:hover:border-orange-500 dark:hover:bg-orange-500/10 dark:hover:text-orange-400'
      } ${className}`}
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