import { X, Star } from 'lucide-react';
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

const statTones = {
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
};

function sparkPoints(data) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  return data
    .map((d, i) => `${(i / (data.length - 1)) * 100},${40 - ((d - min) / range) * 32}`)
    .join(' ');
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'orange', currency, trend = 'up', spark, commas = false }) {
  const cls = statTones[tone] || statTones.orange;
  const isWarn = trend === 'warn';
  const isUp = trend === 'up';
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white p-4 transition-all duration-200 hover:shadow-md dark:bg-[#1c1c22] ${
        isWarn ? 'border-amber-200/50 hover:border-amber-400' : 'border-[var(--border)] hover:border-amber-300'
      }`}
    >
      {spark && spark.length > 1 && (
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 w-full"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points={sparkPoints(spark)}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            className="text-amber-500/20"
          />
        </svg>
      )}
      <div className="relative flex items-start justify-between gap-3">
        <span className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-strong)' }}>{label}</span>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cls}`}>
          <Icon />
        </span>
      </div>
      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        <span className="text-2xl font-bold leading-none" style={{ color: 'var(--accent)' }}>
          <DashCountUp value={value} commas={commas} />
          {currency && <span className="mr-1 font-normal text-sm text-gray-500 dark:text-gray-400">{currency}</span>}
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
      className={`dash__pill${active ? ' is-active' : ''} ${className}`}
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