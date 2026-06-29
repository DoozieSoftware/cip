import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../design';
import { queueApi } from '../api/moderator';

export default function FraudQueuePage() {
  const q = useQuery({
    queryKey: ['moderator', 'fraud'],
    queryFn: () => queueApi.fraud(),
    refetchInterval: 15_000,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading fraud queue" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <EmptyState title="Could not load the fraud queue" description="The /moderator/fraud endpoint did not respond." />;
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Fraud queue</h1>
        <p className="text-sm text-slate-500">
          Reports with <code className="rounded bg-slate-100 px-1">fraud_score &gt; 60</code> — likely spam, repeat
          offenders, or synthetic media. Reject the clear cases; escalate the ambiguous ones.
        </p>
      </header>
      {q.data.data.length === 0 ? (
        <EmptyState title="No fraud suspects" description="Nothing to review right now." />
      ) : (
        <Card>
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Tracking</TH>
                  <TH>Submitted</TH>
                  <TH>Category</TH>
                  <TH>Fraud score</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {q.data.data.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono text-xs">{r.tracking_number}</TD>
                    <TD className="whitespace-nowrap text-xs text-slate-500">
                      {new Date(r.submitted_at).toLocaleString()}
                    </TD>
                    <TD>{r.category?.name ?? '—'}</TD>
                    <TD>
                      {r.fraud_score !== null && (
                        <Badge tone={r.fraud_score > 80 ? 'danger' : 'warning'}>
                          {r.fraud_score.toFixed(0)}%
                        </Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <Link
                        to={`/moderator/reports/${r.id}`}
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        Review →
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
