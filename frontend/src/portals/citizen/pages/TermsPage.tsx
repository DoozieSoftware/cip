import { type JSX } from 'react';
import { useMessages } from '../messages';

/**
 * T-M13-019 — Terms of use (placeholder).
 *
 * Minimal static page so the Settings link resolves inside the SPA
 * instead of bouncing to the fallback route. Replace with real copy.
 */
export default function TermsPage(): JSX.Element {
  const { t } = useMessages();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-lg font-semibold text-slate-800">{t('legal.termsTitle')}</h1>
      <p className="mt-3 text-sm text-slate-600">{t('legal.termsPlaceholder')}</p>
    </div>
  );
}
