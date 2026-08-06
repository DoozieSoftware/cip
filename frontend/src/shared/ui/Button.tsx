import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-[#1d1d1b] text-white hover:bg-black focus-visible:ring-[#1d1d1b] disabled:bg-[#85847f]',
  secondary:
    'bg-white text-[#1d1d1b] ring-1 ring-[#d0cec8] hover:bg-[#f3f2ed] hover:ring-[#aaa9a4] focus-visible:ring-[#1d1d1b] disabled:text-[#a8a7a1]',
  danger:
    'bg-[#a42f29] text-white hover:bg-[#8a2621] focus-visible:ring-[#a42f29] disabled:bg-[#d8a5a1]',
  success:
    'bg-[#226b46] text-white hover:bg-[#1b5738] focus-visible:ring-[#226b46] disabled:bg-[#9bc3ab]',
  ghost:
    'bg-transparent text-[#4f4e4a] hover:bg-[#f3f2ed] hover:text-[#1d1d1b] focus-visible:ring-[#1d1d1b]',
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
              ? 'border-[#1d1d1b]/30 border-t-[#1d1d1b]'
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
