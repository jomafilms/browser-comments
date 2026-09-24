import { Branding } from './db/types';

// Shared chrome for the hand-rolled HTML emails (no React Email dependency).
// The templates themselves live in email-templates.ts (client-facing) and
// email-templates-owner.ts (the operator's cross-client digest).
// Originally all one file; split when it crossed the 300-line limit.
//
// Plain and readable, no marketing chrome, no tracking pixels. Header and
// footer come from the operator's resolved branding, so the mail wears the
// self-hoster's brand, not browser-comments'.

// Escape untrusted text before interpolating into HTML.
export function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const CONTAINER =
  'max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1f2937;';
export const MUTED = 'color:#6b7280;font-size:13px;';
export const BUTTON =
  'display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;';

export function header(branding: Branding): string {
  if (branding.logoUrl) {
    return `<img src="${esc(branding.logoUrl)}" alt="${esc(branding.companyName || 'Logo')}" style="max-height:40px;margin-bottom:16px;" />`;
  }
  const name = branding.companyName || 'Feedback';
  return `<div style="font-size:18px;font-weight:700;margin-bottom:16px;">${esc(name)}</div>`;
}

// `manage` says where this mail is switched off. Client-facing mail points at
// client settings; the owner digest is env-driven, so it says so instead.
export function footer(branding: Branding, manage = 'Manage notifications in your client settings.'): string {
  const support = branding.supportEmail
    ? `Questions? <a href="mailto:${esc(branding.supportEmail)}" style="color:#2563eb;">${esc(branding.supportEmail)}</a>`
    : 'You are receiving this because you are listed as a notification recipient.';
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
    <p style="${MUTED}">${support}<br/>${esc(manage)}</p>`;
}

// Wrap body content in the branded shell.
export function shell(branding: Branding, body: string, manage?: string): string {
  return `<div style="${CONTAINER}">${header(branding)}${body}${footer(branding, manage)}</div>`;
}

export function button(url: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${esc(url)}" style="${BUTTON}">${esc(label)}</a></p>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
