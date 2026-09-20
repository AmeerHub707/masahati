// مكوّنات مشتركة للوحة الإدارة — كلها Tailwind utilities خالصة.
import { Search, X } from 'lucide-react';

export function SectionHeader({ icon: Icon, title, children }) {
  return (
    <div className="dash__section-head">
      <h2>
        {Icon && <Icon />}
        {title}
      </h2>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Card({ className = '', children }) {
  return (
    <div className={`rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.4)] dark:border-gray-700 dark:bg-[#1c1c22] ${className}`}>
      {children}
    </div>
  );
}

const BADGE_CLASSES = {
  green: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-gray-700 dark:text-orange-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
};

export function Badge({ tone = 'gray', children }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold ${BADGE_CLASSES[tone] || BADGE_CLASSES.gray}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action, tone = 'orange' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-[#1c1c22]">
      <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${tone === 'red' ? 'bg-red-50 text-red-500 dark:bg-red-500/10' : 'bg-orange-50 text-orange-500 dark:bg-gray-700 dark:text-orange-400'}`}>
        {Icon && <Icon className="h-8 w-8" />}
      </div>
      <h3 className="m-0 text-sm font-extrabold text-zinc-900 dark:text-gray-100">{title}</h3>
      {description && <p className="m-0 mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'بحث…' }) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pe-3 ps-9 text-sm font-semibold text-zinc-900 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 dark:border-gray-600 dark:bg-[#131318] dark:text-gray-100 dark:focus:bg-[#16161c]"
      />
    </div>
  );
}

export function IconButton({ onClick, label, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-500 transition hover:bg-orange-50 hover:text-orange-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-orange-500/10 dark:hover:text-orange-400 ${className}`}
    >
      {children}
    </button>
  );
}

export function CloseButton({ onClick, label = 'إغلاق' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-zinc-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
    >
      <X className="h-5 w-5" />
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1c1c22]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 text-sm font-extrabold text-zinc-900 dark:text-gray-100">{title}</h3>
          <CloseButton onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-bold text-zinc-800 dark:text-gray-200">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-semibold text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-zinc-900 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 dark:border-gray-600 dark:bg-[#131318] dark:text-gray-100 dark:focus:bg-[#16161c]';

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}