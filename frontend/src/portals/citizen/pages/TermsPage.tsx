import { type JSX } from 'react';
import { useMessages } from '../messages';

export default function TermsPage(): JSX.Element {
  const { t } = useMessages();
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 py-6 text-sm leading-6 text-slate-600">
      <h1 className="text-lg font-semibold text-slate-800">{t('legal.termsTitle')}</h1>
      <p>By using CIP, you agree to submit accurate civic information and to use the service lawfully and respectfully.</p>
      <section><h2 className="font-semibold text-slate-800">Acceptable use</h2><p>Do not submit threats, harassment, knowingly false reports, malicious files, or content that violates another person’s rights. Emergency situations should be reported to the appropriate emergency service first.</p></section>
      <section><h2 className="font-semibold text-slate-800">Reports and evidence</h2><p>You grant CIP and the responsible public agency permission to process the report and attached evidence for investigation, routing, accountability, and public-interest reporting. Do not upload sensitive personal data that is unrelated to the issue.</p></section>
      <section><h2 className="font-semibold text-slate-800">Service limits</h2><p>CIP provides a reporting and tracking service; it does not guarantee a particular agency outcome, response time, or emergency intervention. Planned maintenance, connectivity failures, and third-party outages may temporarily affect availability.</p></section>
      <section><h2 className="font-semibold text-slate-800">Account and enforcement</h2><p>Keep your account secure and report suspected misuse. We may rate-limit, suspend, or remove access for abuse, fraud, unlawful activity, or safety risks, subject to applicable law and review procedures.</p></section>
      <p className="text-xs text-slate-500">These terms are effective for the current pilot and may be updated with notice. Questions or grievances should use the support contact published in the platform.</p>
    </article>
  );
}
