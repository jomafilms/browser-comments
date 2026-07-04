// Email provider abstraction. Resend (via its REST API — no dependency) is
// preferred; SMTP via nodemailer is the self-hoster fallback; with neither
// configured, email is disabled with a single startup warning. The product
// runs fine without any email vendor — notifications just don't send.
//
// Env:
//   RESEND_API_KEY + EMAIL_FROM                         → Resend (recommended)
//   SMTP_HOST/SMTP_PORT[/SMTP_USER/SMTP_PASS] + EMAIL_FROM → SMTP fallback
//   EMAIL_ALLOWLIST (comma-separated, optional)         → restrict recipients

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean; // no provider / no recipients after the allowlist
  error?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Canonical origin for links inside emails. Prefer an explicitly-configured
// base (the request Host is spoofable via the public widget key); fall back to
// the caller's origin when none is set.
export function emailLinkBase(fallback: string): string {
  return (
    process.env.EMAIL_BASE_URL ||
    process.env.WEBHOOK_BASE_URL ||
    process.env.BETTER_AUTH_URL ||
    fallback
  );
}

function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

// True when some provider is configured. Callers check this before doing DB
// work so a no-email deployment stays completely inert.
export function emailEnabled(): boolean {
  return !!(process.env.RESEND_API_KEY || smtpConfigured());
}

let warnedDisabled = false;
function warnDisabledOnce(): void {
  if (warnedDisabled) return;
  warnedDisabled = true;
  console.warn(
    '[email] No RESEND_API_KEY or SMTP_* configured — email notifications are disabled.'
  );
}

// Optional outbound allowlist. When EMAIL_ALLOWLIST is set (comma-separated),
// only those addresses receive mail; everything else is dropped. This enforces
// the "sends go to one address only" gate in config for staging/testing.
function applyAllowlist(to: string[]): string[] {
  const raw = process.env.EMAIL_ALLOWLIST;
  if (!raw) return to;
  const allowed = new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  const filtered = to.filter((addr) => allowed.has(addr.toLowerCase()));
  if (filtered.length < to.length) {
    console.warn(`[email] EMAIL_ALLOWLIST dropped ${to.length - filtered.length} recipient(s).`);
  }
  return filtered;
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;
  const recipients = applyAllowlist(Array.isArray(message.to) ? message.to : [message.to]);

  if (recipients.length === 0) return { ok: false, skipped: true };

  if (!emailEnabled()) {
    warnDisabledOnce();
    return { ok: false, skipped: true };
  }
  if (!from) {
    console.warn('[email] EMAIL_FROM is not set — cannot send. Set it to a verified sender.');
    return { ok: false, skipped: true };
  }

  try {
    return process.env.RESEND_API_KEY
      ? await sendViaResend(from, recipients, message)
      : await sendViaSmtp(from, recipients, message);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'send failed';
    console.error('[email] send failed:', error);
    return { ok: false, error };
  }
}

async function sendViaResend(
  from: string,
  to: string[],
  message: EmailMessage
): Promise<SendResult> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: message.subject,
      html: message.html,
      ...(message.text ? { text: message.text } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true };
}

// nodemailer is lazy-imported so it only loads when SMTP is actually configured —
// Resend and disabled deployments never pull it in.
async function sendViaSmtp(
  from: string,
  to: string[],
  message: EmailMessage
): Promise<SendResult> {
  const nodemailer = await import('nodemailer');
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // implicit TLS on 465; STARTTLS on 587/25
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transport.sendMail({
    from,
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  return { ok: true };
}
