import { type JSX } from 'react';
import { useMessages } from '../messages';

export default function TermsPage(): JSX.Element {
  const { t } = useMessages();
  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border-faint)] pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {t('legal.termsTitle')}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          {t('legal.termsTitle')}
        </h1>
      </header>

      <article className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="space-y-6 text-sm leading-6 text-[var(--color-text-secondary)]">
          <p>
            By using CIP, you agree to submit accurate civic information and to use the service
            lawfully and respectfully.
          </p>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Acceptable use
            </h2>
            <p>
              Do not submit threats, harassment, knowingly false reports, malicious files, or
              content that violates another person&apos;s rights. Emergency situations should be
              reported to the appropriate emergency service first.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Reports and evidence
            </h2>
            <p>
              You grant CIP and the responsible public agency permission to process the report and
              attached evidence for investigation, routing, accountability, and public-interest
              reporting. Do not upload sensitive personal data that is unrelated to the issue.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Service limits
            </h2>
            <p>
              CIP provides a reporting and tracking service; it does not guarantee a particular
              agency outcome, response time, or emergency intervention. Planned maintenance,
              connectivity failures, and third-party outages may temporarily affect availability.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Account and enforcement
            </h2>
            <p>
              Keep your account secure and report suspected misuse. We may rate-limit, suspend, or
              remove access for abuse, misrepresentation, unlawful activity, or safety risks,
              subject to applicable law and review procedures.
            </p>
          </section>
          <p className="border-t border-[var(--color-border-subtle)] pt-6 text-xs leading-5 text-[var(--color-text-tertiary)]">
            These terms are effective for the current pilot and may be updated with notice.
            Questions or grievances should use the support contact published in the platform.
          </p>
        </div>
      </article>
    </div>
  );
}
