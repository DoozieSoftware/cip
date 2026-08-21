import type { ReportStatusCode } from '../types';

export function moderatorActionMessage(statusCode: ReportStatusCode): string {
  if (statusCode === 'verified' || statusCode === 'closed') {
    return 'This complaint is complete. No further moderator action is needed.';
  }

  return 'Approve and Reject are available only while a complaint is awaiting moderator review.';
}
