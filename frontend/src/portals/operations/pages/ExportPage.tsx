import { useState } from 'react';
import { Card, CardBody, CardHeader, CardTitle, Input, Button, Badge } from '../../../shared/ui';
import { departmentApi, type ReportListFilters } from '../api/operations';
import { useDepartmentSelection } from '../context/DepartmentSelectionContext';
import { statusLabel } from '../components/statusMeta';

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export default function ExportPage() {
  const { selectedId } = useDepartmentSelection();
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filters, setFilters] = useState<ReportListFilters>({
    status: '',
    search: '',
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const scopedFilters: ReportListFilters = { ...filters, department_id: selectedId ?? undefined };
  const url = departmentApi.exportUrl(format, scopedFilters);

  async function handleDownload(): Promise<void> {
    setDownloading(true);
    setDownloadError(null);
    try {
      await departmentApi.exportDownload(format, scopedFilters);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Export reports</h1>
        <p className="text-sm text-slate-500">
          Download the reports assigned to your department as a CSV, Excel, or PDF file.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Format</CardTitle>
        </CardHeader>
        <CardBody className="flex gap-2">
          {(['csv', 'xlsx', 'pdf'] as ExportFormat[]).map((f) => (
            <Button
              key={f}
              variant={format === f ? 'primary' : 'secondary'}
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
            >
              {f.toUpperCase()}
            </Button>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">Status</span>
            <select
              aria-label="Status"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={filters.status ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="assigned">{statusLabel('assigned')}</option>
              <option value="accepted">{statusLabel('accepted')}</option>
              <option value="in_progress">{statusLabel('in_progress')}</option>
              <option value="resolved">{statusLabel('resolved')}</option>
              <option value="resolved_pending_verification">
                {statusLabel('resolved_pending_verification')}
              </option>
              <option value="reopened">{statusLabel('reopened')}</option>
              <option value="verified,closed">{statusLabel('verified')}</option>
            </select>
          </label>
          <Input
            label="Search"
            placeholder="Tracking number or title"
            value={filters.search ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1 text-sm text-slate-700">
            <p>
              <Badge tone="info">{format.toUpperCase()}</Badge> with current filters.
            </p>
            {/* The export URL is one unbroken string with query params — it must
                wrap, otherwise it drags the whole page sideways on a phone. */}
            <p className="break-all font-mono text-xs text-slate-500">{url}</p>
            {downloadError && <p className="text-xs text-rose-600">{downloadError}</p>}
          </div>
          <Button variant="primary" onClick={() => void handleDownload()} loading={downloading}>
            Download
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
