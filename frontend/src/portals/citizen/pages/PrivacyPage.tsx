import { type JSX } from 'react';
import { useMessages } from '../messages';

export default function PrivacyPage(): JSX.Element {
  const { t } = useMessages();
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 py-6 text-sm leading-6 text-slate-600">
      <h1 className="text-lg font-semibold text-slate-800">{t('legal.privacyTitle')}</h1>
      <p>Civic Intelligence Platform (CIP) collects only the information needed to receive, route, investigate, and report civic issues.</p>
      <section><h2 className="font-semibold text-slate-800">What we collect</h2><p>Depending on your report, this includes your account contact details, report text, photos or video, device and upload metadata, GPS coordinates, and status history. Anonymous mode hides your identity from ordinary operational views, but does not prevent lawful safety or audit access.</p></section>
      <section><h2 className="font-semibold text-slate-800">Why we use it</h2><p>We use this information to authenticate you, prevent abuse, verify evidence, route the report to the responsible agency, send status updates, measure service performance, and meet audit and legal obligations.</p></section>
      <section><h2 className="font-semibold text-slate-800">Sharing and processors</h2><p>Reports are shared with the government department responsible for the location and issue. Approved infrastructure, storage, messaging, mapping, and safety vendors process data only to provide configured platform services. Public dashboards use aggregated data and suppress small groups.</p></section>
      <section><h2 className="font-semibold text-slate-800">Retention and your rights</h2><p>Evidence and audit records are retained according to the platform retention register and legal hold requirements. You may request access, correction, deletion where legally available, or a copy of your record. Contact the grievance officer through the support channel shown in the platform.</p></section>
      <p className="text-xs text-slate-500">GPS and camera notices are shown at the point of capture. Do not upload information about another person unless you have a lawful reason to do so.</p>
    </article>
  );
}
