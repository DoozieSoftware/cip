/**
 * Domain types for the Moderator Portal.
 *
 * Mirrors the backend `ReportResource` + `AiResultResource` + `AuditLogResource`
 * shape documented in `docs/05-REST-API-Specification.md` §8.
 */

export type ReportStatusCode =
  | 'draft'
  | 'submitted'
  | 'ai_processing'
  | 'pending_moderator'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'resolved'
  | 'verified'
  | 'closed'
  | 'rejected'
  | 'merged'
  | 'escalated';

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Category {
  id: string;
  code: string;
  name: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface AiLabel {
  id: string;
  code: string;
  name: string;
  confidence: number;
}

export interface AiResult {
  job_id: string;
  provider_code: string;
  prompt_version: number;
  confidence: number;
  recommended_category: Category | null;
  recommended_department: Department | null;
  labels: AiLabel[];
  fraud_score: number;
  duplicate_score: number;
  quality_score: number;
  notes: string | null;
  created_at: string;
}

export interface MediaItem {
  id: string;
  mime_type: string;
  url: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  captured_at: string | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ReportListItem {
  id: string;
  tracking_number: string;
  title: string;
  category: Category | null;
  department: Department | null;
  status_code: ReportStatusCode;
  ai_confidence: number | null;
  fraud_score: number | null;
  duplicate_score: number | null;
  submitted_at: string;
  ward: string | null;
  district: string | null;
  evidence_count: number;
}

export interface ReportDetail extends ReportListItem {
  description: string;
  citizen_id: string;
  location: GeoPoint | null;
  media: MediaItem[];
  ai_result: AiResult | null;
  assigned_to: { id: string; name: string } | null;
  audit_log: AuditEntry[];
  status_history: StatusHistoryEntry[];
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface StatusHistoryEntry {
  from_code: ReportStatusCode | null;
  to_code: ReportStatusCode;
  actor_id: string | null;
  reason: string | null;
  created_at: string;
}

export type ModerationDecision = 'approve' | 'reject' | 'merge' | 'escalate';

export interface ReviewPayload {
  decision: ModerationDecision;
  reason_code?: string;
  remarks?: string;
  category_id?: string;
  department_id?: string;
  override_ai?: boolean;
}

export interface MergePayload {
  canonical_id: string;
  duplicate_ids: string[];
  reason_code?: string;
  remarks?: string;
}

export interface AnalyticsSummary {
  pending_moderator: number;
  duplicates_pending: number;
  fraud_pending: number;
  approved_today: number;
  rejected_today: number;
  merged_today: number;
  escalated_today: number;
  avg_review_minutes: number;
  ai_accuracy_pct: number;
}

export interface AiPerformance {
  window: '24h' | '7d' | '30d';
  total_ai_decisions: number;
  overridden_by_moderator: number;
  override_rate_pct: number;
  per_provider: {
    provider_code: string;
    total: number;
    overridden: number;
    avg_confidence: number;
  }[];
}
