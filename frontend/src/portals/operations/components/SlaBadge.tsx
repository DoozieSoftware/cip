import { Badge } from '../design';
import type { DepartmentReportListItem } from '../types';
import { slaInfo } from './slaInfo';

export function SlaBadge({
  report,
}: {
  report: Pick<DepartmentReportListItem, 'created_at' | 'department_sla_minutes'>;
}) {
  const info = slaInfo(report.created_at, report.department_sla_minutes);
  if (!info) return null;
  return (
    <Badge tone={info.overdue ? 'danger' : 'success'}>
      {info.overdue ? 'SLA overdue' : 'On time'}
    </Badge>
  );
}
