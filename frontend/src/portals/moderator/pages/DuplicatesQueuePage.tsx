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

export default function DuplicatesQueuePage() {
  const q = useQuery({
    queryKey: ['moderator', 'duplicates'],
    queryFn: () => queueApi.duplicates(),
    refetchInterval: 15_000,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading duplicates" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <EmptyState title="Could not load duplicates" description="The /moderator/duplicates endpoint did not respond." />;
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Duplicate queue</h1>
        <p className="text-sm text-slate-500">
          Reports with <code className="rounded bg-slate-100 px-1">duplicate_score &gt; 60</code> that the AI pipeline
          flagged as potentially the same incident. Open one to merge it into its canonical report.
        </p>
      </header>
      {q.data.data.length === 0 ? (
        <EmptyState title="No duplicate candidates" description="Nothing to merge right now." />
      ) : (
        <Card>
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Tracking</TH>
                  <TH>Submitted</TH>
                  <TH>Category</TH>
                  <TH>Duplicate score</TH>
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
                      {r.duplicate_score !== null && (
                        <Badge tone={r.duplicate_score > 80 ? 'danger' : 'warning'}>
                          {r.duplicate_score.toFixed(0)}%
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
