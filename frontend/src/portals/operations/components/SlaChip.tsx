import { Badge } from '../design';
import { formatSla } from './slaInfo';

export function SlaChip({
  createdAt,
  slaMinutes,
  status,
}: {
  createdAt: string | null | undefined;
  slaMinutes: number | null | undefined;
  status: string | null | undefined;
}) {
  const display = formatSla(createdAt, slaMinutes, status);
  if (display === null) return null;
  return <Badge tone={display.tone}>{display.label}</Badge>;
}
