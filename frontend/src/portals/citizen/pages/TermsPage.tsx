import { type JSX } from 'react';

/**
 * T-M13-019 — Terms of use (placeholder).
 *
 * Minimal static page so the Settings link resolves inside the SPA
 * instead of bouncing to the fallback route. Replace with real copy.
 */
export default function TermsPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-lg font-semibold text-slate-800">Terms of use</h1>
      <p className="mt-3 text-sm text-slate-600">
        This page is a placeholder. The full terms of use will be published here.
      </p>
    </div>
  );
}
