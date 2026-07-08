import { useState } from 'react';
import { Button } from '../design';
import { departmentApi, type ReportListFilters } from '../api/operations';

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

interface ExportMenuProps {
  filters: ReportListFilters;
}

/**
 * T-M11-021 — Exports UI buttons.
 *
 * Per `docs/08` §25 the assigned-reports list and other list pages
 * expose CSV / XLSX / PDF download buttons. We render them as a
 * small split-button group that opens a panel when "Export" is
 * clicked. Each format builds its download URL via the shared
 * `departmentApi.exportUrl` helper so the wire contract stays in
 * one place.
 */
export function ExportMenu({ filters }: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  const triggerDownload = (format: ExportFormat): void => {
    departmentApi.exportDownload(format, filters).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Export download failed', err);
    });
    setOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <Button
        variant="secondary"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Export
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Download formats"
          className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {(['csv', 'xlsx', 'pdf'] as ExportFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              role="menuitem"
              onClick={() => {
                triggerDownload(f);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Download as <span className="font-mono text-xs uppercase">{f}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
