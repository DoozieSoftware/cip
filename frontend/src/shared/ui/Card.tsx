import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx(
        'rounded-xl bg-white shadow-sm ring-1 ring-black/5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx('text-base font-semibold text-[var(--color-ink)]', className)}>{children}</h2>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex items-center justify-end gap-2 border-t border-[var(--color-border-subtle)] px-5 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
