export interface SlaInfo {
  deadline: Date;
  overdue: boolean;
}

export function slaInfo(
  createdAt: string | null | undefined,
  slaMinutes: number | null | undefined,
): SlaInfo | null {
  if (slaMinutes == null || createdAt == null) return null;
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return null;
  const deadline = new Date(start + slaMinutes * 60_000);
  return { deadline, overdue: Date.now() > deadline.getTime() };
}
