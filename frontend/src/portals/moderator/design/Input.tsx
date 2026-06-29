import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cx } from './cx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cx(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-err`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={cx(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
