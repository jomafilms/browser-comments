// Shared row/domain types for the db modules.

export interface WidgetSettings {
  buttonText?: string;
  buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor?: string;
  modalTitle?: string;
  modalSubtitle?: string;
  successMessage?: string;
}

// Operator branding shown on client-facing surfaces. All keys optional;
// resolved per-key: project → client → instance.
export interface Branding {
  companyName?: string;
  logoUrl?: string;
  supportEmail?: string;
}

export interface Client {
  id: number;
  token: string;
  widget_key: string;
  name: string;
  widget_settings: WidgetSettings | null;
  branding: Branding | null;
  created_at: Date;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  url: string;
  token: string | null;
  ref_prefix: string | null;
  branding: Branding | null;
  created_at: Date;
}

// Resolved token context — tells you whether a token is client-level or project-level
export interface TokenContext {
  clientId: number;
  projectId: number | null; // null = client token (all projects), number = project token (scoped)
}

export interface Assignee {
  id: number;
  client_id: number;
  name: string;
  created_at: Date;
}

export interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  color: string;
}

export interface Comment {
  id: number;
  uuid: string; // stable external identifier (v4 schema)
  project_id: number | null;
  display_number: number; // DEPRECATED: per-client sequential number — kept for back-compat, prefer ref
  project_number: number | null; // per-project sequential number (v4 schema)
  ref: string | null; // "<PREFIX>-<project_number>", computed in queries, e.g. "LWF-12"
  url: string;
  page_section: string; // Auto-populated from URL path, can be manually overridden
  image_data: string; // base64 encoded image
  text_annotations: TextAnnotation[];
  status: 'open' | 'resolved';
  priority: 'high' | 'med' | 'low';
  priority_number: number;
  assignee: string;
  submitter_name: string | null; // Name of the person who submitted the feedback
  user_agent: string | null;
  viewport_w: number | null;
  viewport_h: number | null;
  device_category: string | null;
  device_model: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CommentFilters {
  status?: string;
  priority?: string;
  assignee?: string;
  pageSection?: string;
  deviceCategory?: string;
}

export interface DecisionItem {
  id: number;
  uuid: string;
  comment_id: number | null;
  project_id: number | null;
  note_text: string;
  note_index: number | null;
  source: string | null;
  created_at: Date;
  updated_at: Date;
}
