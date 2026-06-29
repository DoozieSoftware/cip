import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 disabled:bg-brand-300',
  secondary:
    'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400 disabled:text-slate-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500 disabled:bg-emerald-300',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400',
};

const SIZE: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-sm rounded-md',
  md: 'px-3.5 py-2 text-sm rounded-md',
  lg: 'px-5 py-2.5 text-base rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  );
}
