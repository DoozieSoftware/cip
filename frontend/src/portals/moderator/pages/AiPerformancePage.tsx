import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader, CardTitle, EmptyState, Select, Spinner, Badge } from '../design';
import { analyticsApi } from '../api/moderator';
import { useState } from 'react';

export default function AiPerformancePage() {
  const [windowSel, setWindowSel] = useState<'24h' | '7d' | '30d'>('7d');
  const q = useQuery({
    queryKey: ['moderator', 'analytics', 'ai', windowSel],
    queryFn: () => analyticsApi.aiPerformance(windowSel),
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-20" aria-live="polite">
        <Spinner label="Loading AI performance" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <EmptyState title="Could not load AI performance" description="The /moderator/analytics/ai-performance endpoint did not respond." />;
  }

  const a = q.data;
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">AI performance</h1>
          <p className="text-sm text-slate-500">Override rate per provider — drives M8 prompt tuning.</p>
        </div>
        <Select
          aria-label="Time window"
          name="window"
          value={windowSel}
          onChange={(e) => setWindowSel(e.target.value as '24h' | '7d' | '30d')}
          options={[
            { value: '24h', label: 'Last 24 h' },
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: 'Last 30 days' },
          ]}
        />
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-slate-500">AI decisions</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{a.total_ai_decisions}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-slate-500">Overridden</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{a.overridden_by_moderator}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-wide text-slate-500">Override rate</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{a.override_rate_pct.toFixed(1)}%</p>
            <Badge tone={a.override_rate_pct < 10 ? 'success' : a.override_rate_pct < 25 ? 'warning' : 'danger'}>
              {a.override_rate_pct < 10 ? 'healthy' : a.override_rate_pct < 25 ? 'review prompts' : 'consider swap'}
            </Badge>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per provider</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Decisions</th>
                <th className="px-3 py-2">Overridden</th>
                <th className="px-3 py-2">Avg confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {a.per_provider.map((p) => (
                <tr key={p.provider_code}>
                  <td className="px-3 py-2 font-mono text-xs">{p.provider_code}</td>
                  <td className="px-3 py-2">{p.total}</td>
                  <td className="px-3 py-2">
                    {p.overridden} ({p.total > 0 ? ((p.overridden / p.total) * 100).toFixed(0) : 0}%)
                  </td>
                  <td className="px-3 py-2">{p.avg_confidence.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
