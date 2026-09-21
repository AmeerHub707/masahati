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
  orange: 'st-ico--orange',
  amber: 'st-ico--amber',
  green: 'st-ico--green',
  blue: 'st-ico--blue',
  red: 'st-ico--red',
  violet: 'st-ico--violet',
};

export function StatCard({ icon: Icon, label, value, hint, tone = 'orange' }) {
  const cls = statTones[tone] || statTones.orange;
  return (
    <div className="dash__stat">
      <div className={`st-ico ${cls}`}>
        <Icon />
      </div>
      <div className="flex items-baseline gap-1.5">
        <DashCountUp value={value} />
        {hint && <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{hint}</span>}
      </div>
      <span>{label}</span>
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