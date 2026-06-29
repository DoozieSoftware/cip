import { cx } from './cx';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cx('inline-block', className)}>
      <svg
        aria-hidden
        className="h-5 w-5 animate-spin text-brand-600"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
