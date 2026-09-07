import { type JSX } from 'react';
import { useMessages } from '../messages';

export default function PrivacyPage(): JSX.Element {
  const { t } = useMessages();
  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border-faint)] pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {t('legal.privacyTitle')}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
          {t('legal.privacyTitle')}
        </h1>
      </header>

      <article className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="space-y-6 text-sm leading-6 text-[var(--color-text-secondary)]">
          <p>
            Civic Intelligence Platform (CIP) collects only the information needed to receive,
            route, investigate, and report civic issues.
          </p>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              What we collect
            </h2>
            <p>
              Depending on your report, this includes your account contact details, report text,
              photos or video, device and upload metadata, GPS coordinates, and status history.
              Anonymous mode hides your identity from ordinary operational views, but does not
              prevent lawful safety or audit access.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Why we use it
            </h2>
            <p>
              We use this information to authenticate you, prevent abuse, verify evidence, route the
              report to the responsible agency, send status updates, measure service performance,
              and meet audit and legal obligations.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Sharing and processors
            </h2>
            <p>
              Reports are shared with the government department responsible for the location and
              issue. Approved infrastructure, storage, messaging, mapping, and safety vendors
              process data only to provide configured platform services. Public dashboards use
              aggregated data and suppress small groups.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
              Retention and your rights
            </h2>
            <p>
              Evidence and audit records are retained according to the platform retention register
              and legal hold requirements. You may request access, correction, deletion where
              legally available, or a copy of your record. Contact the grievance officer through the
              support channel shown in the platform.
            </p>
          </section>
          <p className="border-t border-[var(--color-border-subtle)] pt-6 text-xs leading-5 text-[var(--color-text-tertiary)]">
            GPS and camera notices are shown at the point of capture. Do not upload information
            about another person unless you have a lawful reason to do so.
          </p>
        </div>
      </article>
    </div>
  );
}
