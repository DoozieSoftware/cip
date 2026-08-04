import { Badge } from '../design';
import type { DepartmentReportListItem } from '../types';
import { formatSla } from './slaInfo';

export function SlaBadge({
  report,
}: {
  report: Pick<
    DepartmentReportListItem,
    'created_at' | 'department_sla_minutes' | 'current_status_code'
  >;
}) {
  const display = formatSla(
    report.created_at,
    report.department_sla_minutes,
    report.current_status_code,
  );
  if (!display) return null;
  return <Badge tone={display.tone}>{display.label}</Badge>;
}
