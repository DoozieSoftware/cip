import type { ReactNode } from 'react';

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
  error,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  error?: Error | null;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50/60 p-10 text-center"
    >
      <h3 className="text-base font-semibold text-rose-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-rose-700">{description}</p>}
      {error && error.message && (
        <p className="max-w-sm text-xs text-rose-600">{error.message}</p>
      )}
      {action}
    </div>
  );
}
