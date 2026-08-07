import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-[var(--color-ink)] text-white hover:bg-black focus-visible:ring-[var(--color-ink)] disabled:bg-[var(--color-text-tertiary)]',
  secondary:
    'bg-white text-[var(--color-ink)] ring-1 ring-[var(--color-border)] hover:bg-[var(--color-canvas)] hover:ring-[var(--color-border-strong)] focus-visible:ring-[var(--color-ink)] disabled:text-[var(--color-text-quaternary)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] focus-visible:ring-[var(--color-danger)] disabled:bg-[var(--color-danger-muted)]',
  success:
    'bg-[var(--color-success)] text-white hover:bg-[var(--color-success-hover)] focus-visible:ring-[var(--color-success)] disabled:bg-[var(--color-success-muted)]',
  ghost:
    'bg-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] focus-visible:ring-[var(--color-ink)]',
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
          className={cx(
            'h-4 w-4 animate-spin rounded-full border-2',
            variant === 'secondary' || variant === 'ghost'
              ? 'border-[var(--color-ink)]/30 border-t-[var(--color-ink)]'
              : 'border-white/40 border-t-white',
          )}
        />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  );
}
