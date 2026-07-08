import { useState } from 'react';
import { Card, CardBody, CardHeader, CardTitle, Input, Button, Badge } from '../design';
import { departmentApi, type ReportListFilters } from '../api/operations';

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export default function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filters, setFilters] = useState<ReportListFilters>({
    status: '',
    search: '',
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const url = departmentApi.exportUrl(format, filters);

  async function handleDownload(): Promise<void> {
    setDownloading(true);
    setDownloadError(null);
    try {
      await departmentApi.exportDownload(format, filters);
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
          <Input
            label="Status code"
            placeholder="assigned, accepted, in_progress…"
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          />
          <Input
            label="Search"
            placeholder="Tracking number or title"
            value={filters.search ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex items-center justify-between gap-3">
          <div className="space-y-1 text-sm text-slate-700">
            <p>
              <Badge tone="info">{format.toUpperCase()}</Badge> with current filters.
            </p>
            <p className="font-mono text-xs text-slate-500">{url}</p>
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
