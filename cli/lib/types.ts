export interface Ticket {
  id: number;
  display_number: number;
  url: string;
  page_section: string;
  status: string;
  priority: string;
  priority_number: number;
  assignee: string;
  submitter_name: string;
  text_annotations: TextAnnotation[];
  created_at: string;
  updated_at: string;
  image_data?: string;
}

export interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  color: string;
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  assignee?: string;
  section?: string;
  project?: string;
}

export interface SuccessResponse {
  ok: true;
  mode: 'db' | 'api';
  timestamp: string;
  filters: TicketFilters;
  count: number;
  tickets: Ticket[];
}

export interface ErrorResponse {
  ok: false;
  error: string;
  code: string;
}

export type CLIResponse = SuccessResponse | ErrorResponse;

export interface CLIConfig {
  token: string;
  dbUrl?: string;
  apiUrl?: string;
  mode: 'db' | 'api';
}

export interface SchedulePreset {
  name: string;
  seconds: number;
}
