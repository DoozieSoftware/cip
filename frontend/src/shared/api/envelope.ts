export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  errors: Record<string, unknown> | object;
  code?: string;
  trace_id?: string;
}
