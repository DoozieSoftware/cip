import { useState } from 'react';
import { IconDownload, IconFileExport } from '@tabler/icons-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input } from '../../../shared/ui';
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
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-ink)]">
          <IconFileExport className="h-5 w-5 text-white" stroke={1.6} />
        </div>
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            Operations · Export
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">
            Export complaints
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Download the complaints assigned to your department as a CSV, Excel, or PDF file.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Format</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          {(['csv', 'xlsx', 'pdf'] as ExportFormat[]).map((f) => (
            <Button
              key={f}
              variant={format === f ? 'primary' : 'secondary'}
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className="min-h-11 rounded-full px-5 focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2"
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
        <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              Status
            </span>
            <select
              aria-label="Status"
              className="min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] shadow-sm outline-none transition focus:border-[var(--color-ink)] focus:ring-2 focus:ring-[var(--color-ink)]/20"
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
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1 text-sm text-[var(--color-ink)]">
            <p>
              <Badge tone="info">{format.toUpperCase()}</Badge>{' '}
              <span className="text-xs text-[var(--color-text-secondary)]">
                with current filters.
              </span>
            </p>
            {/* The export URL is one unbroken string with query params — it must
                wrap, otherwise it drags the whole page sideways on a phone. */}
            <p className="break-all font-mono text-xs text-[var(--color-text-secondary)]">{url}</p>
            {downloadError && (
              <p role="alert" className="text-xs text-[var(--color-danger)]">
                {downloadError}
              </p>
            )}
          </div>
          <Button
            variant="primary"
            onClick={() => void handleDownload()}
            loading={downloading}
            leftIcon={<IconDownload className="h-4 w-4" stroke={1.6} />}
            className="min-h-11 rounded-full px-5 focus-visible:ring-2 focus-visible:ring-[var(--color-ink)] focus-visible:ring-offset-2"
          >
            Download
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
