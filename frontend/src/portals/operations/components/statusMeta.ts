import {
  reportStatusTone,
  staffReportStatusLabel,
  type ReportStatusTone,
} from '../../../shared/statusDisplay';

export type StatusTone = ReportStatusTone;

/**
 * Human label for a status code, shared by the list, detail header, and timeline.
 * These are staff-facing workflow labels, not raw database names.
 */
export function statusLabel(code: string | null | undefined): string {
  return staffReportStatusLabel(code);
}

/** Keep status tone mapping in one place so all operations screens agree. */
export function statusTone(code: string | null | undefined): StatusTone {
  return reportStatusTone(code);
}
