import type { ReactNode } from 'react';
import { cx } from './cx';

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-lg ring-1 ring-slate-200', className)}>
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>;
}

export function TR({ children, onClick, className, selected }: { children: ReactNode; onClick?: () => void; className?: string; selected?: boolean }) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        'transition',
        onClick && 'cursor-pointer hover:bg-brand-50/60 focus-within:bg-brand-50/60',
        selected && 'bg-brand-50',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cx('px-3 py-2 font-medium', className)}>{children}</th>;
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cx('px-3 py-2 text-slate-800', className)}>{children}</td>;
}
