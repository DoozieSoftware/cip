import { Badge } from '../design';
import type { DepartmentReportListItem, ReportAssignment } from '../types';
import { formatSla } from './slaInfo';

export function SlaBadge({
  report,
  assignment,
}: {
  report: Pick<
    DepartmentReportListItem,
    'created_at' | 'department_sla_minutes' | 'current_status_code'
  >;
  assignment?: ReportAssignment | null;
}) {
  const isSecondary = assignment?.kind === 'secondary';
  const display = formatSla(
    isSecondary ? assignment.assigned_at : report.created_at,
    isSecondary ? assignment.sla_minutes : report.department_sla_minutes,
    isSecondary ? assignment.status : report.current_status_code,
  );
  if (!display) return null;
  return <Badge tone={display.tone}>{display.label}</Badge>;
}
