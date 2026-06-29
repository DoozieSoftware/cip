import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx(
        'rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70',
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
        'flex items-center justify-between border-b border-slate-200/70 px-5 py-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-slate-900">{children}</h2>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex items-center justify-end gap-2 border-t border-slate-200/70 px-5 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
