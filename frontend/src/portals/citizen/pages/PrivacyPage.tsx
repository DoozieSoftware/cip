import { type JSX } from 'react';

/**
 * T-M13-018 — Privacy policy (placeholder).
 *
 * Minimal static page so the Settings link resolves inside the SPA
 * instead of bouncing to the fallback route. Replace with real copy.
 */
export default function PrivacyPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-lg font-semibold text-slate-800">Privacy policy</h1>
      <p className="mt-3 text-sm text-slate-600">
        This page is a placeholder. The full privacy policy will be published here.
      </p>
    </div>
  );
}
