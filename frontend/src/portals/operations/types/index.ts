/**
 * Domain types for the Operations (Department) portal.
 *
 * Mirrors the M11 backend `DepartmentReportResource` and
 * the OpenAPI `DepartmentReportListItem` schema documented
 * in `docs/08` and the OpenAPI `Operations` tag.
 */

export type WorkflowEvent = 'accept' | 'start' | 'progress' | 'resolve' | 'close';

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

export interface Priority {
  id: string;
  code: string;
  name: string;
  sla_minutes: number | null;
}

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface ReportType {
  id: string;
  code: string;
  name: string;
}

export interface Status {
  id: string;
  code: string;
  name: string;
  is_terminal: boolean;
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
  accuracy: number | null;
  address: string | null;
}

export interface ReportListItem {
  id: string;
  tracking_number: string;
  title: string;
  description: string | null;
  is_anonymous: boolean;
  is_verified: boolean;
  ai_confidence: number | null;
  fraud_score: number | null;
  duplicate_score: number | null;
  submitted_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  report_type: ReportType | null;
  status: Status | null;
  priority: Priority | null;
  location: GeoPoint | null;
  department: Department | null;
}

export interface DepartmentReportListItem extends ReportListItem {
  current_status_code: string | null;
  department_sla_minutes: number | null;
  internal_notes: InternalNote[];
}

export interface InternalNote {
  id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string | null;
}

export interface DepartmentDashboardCounts {
  open: number;
  due_today: number;
  sla_breached: number;
  by_category: Record<string, number>;
}

export interface DepartmentOfficer {
  id: string;
  name: string | null;
  mobile: string;
  email: string | null;
  is_manager: boolean;
  assigned_at: string | null;
}

export interface WorkingHours {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  open: string;
  close: string;
}

export interface EscalationStep {
  after_minutes: number;
  escalate_to: string | null;
}

export interface DepartmentAdminSettings {
  default_sla_minutes: number | null;
  working_hours: WorkingHours[] | null;
  holiday_calendar: string[] | null;
  escalation_matrix: EscalationStep[] | null;
}
