// Shared shapes for the admin dashboard client components.

export interface Client {
  id: number;
  token: string;
  widget_key: string | null;
  name: string;
  created_at: string;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  url: string;
  token: string | null;
  ref_prefix?: string | null;
  client_name?: string;
}
