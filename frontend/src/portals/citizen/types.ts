export interface ReportType {
  id: string;
  name: string;
  code: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  requires_video: boolean;
  requires_photo: boolean;
  min_photos: number;
  max_photos: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface AiSummary {
  labels: Array<{ name: string; confidence: number }>;
  fraud_score: number;
  duplicate_of?: string | null;
  recommended_department?: { name: string; code: string } | null;
}

export interface ReportSummary {
  id: string;
  tracking_number: string;
  title: string;
  description?: string | null;
  status: { code: string; name: string; is_terminal?: boolean };
  type?: { code: string; name: string; icon?: string | null } | null;
  priority?: { code: string; name: string } | null;
  created_at?: string | null;
  updated_at?: string | null;
  assigned_department?: { id: string; name: string; code: string } | null;
  department?: { id: string; name: string; code: string } | null;
  location?: { latitude: number; longitude: number; address?: string | null } | null;
  media_count?: number;
}

export interface TimelineEntry {
  id?: string;
  at: string;
  actor?: string | null;
  event: string;
  note?: string | null;
  is_current?: boolean;
}

export interface MediaItem {
  id: string;
  kind: 'photo' | 'video';
  url?: string;
  signed_url?: string;
  audit?: unknown;
}

export interface ReportDetail extends ReportSummary {
  timeline: TimelineEntry[];
  media: MediaItem[];
  ai_summary?: AiSummary | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  channel: string;
  read_at?: string | null;
  created_at: string;
  data?: Record<string, unknown> | null;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export type LifecycleGroup = 'open' | 'awaiting_citizen' | 'closed' | 'rejected' | 'merged';
export type StatusFilter = 'all' | LifecycleGroup;

export const OPEN_STATUSES = [
  'submitted',
  'ai_processing',
  'pending_moderator',
  'assigned',
  'accepted',
  'in_progress',
  'escalated',
] as const;

export const AWAITING_CITIZEN_STATUSES = ['resolved'] as const;

export const CLOSED_STATUSES = ['verified', 'closed'] as const;

export const REJECTED_STATUSES = ['rejected'] as const;

export const MERGED_STATUSES = ['merged'] as const;

export function lifecycleGroup(code: string): LifecycleGroup {
  if ((OPEN_STATUSES as readonly string[]).includes(code)) return 'open';
  if ((AWAITING_CITIZEN_STATUSES as readonly string[]).includes(code)) return 'awaiting_citizen';
  if ((CLOSED_STATUSES as readonly string[]).includes(code)) return 'closed';
  if ((REJECTED_STATUSES as readonly string[]).includes(code)) return 'rejected';
  if ((MERGED_STATUSES as readonly string[]).includes(code)) return 'merged';
  return 'open';
}
