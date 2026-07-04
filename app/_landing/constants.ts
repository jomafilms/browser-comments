// Single source of truth for the landing page's external URLs and copy-paste
// snippets. Keep every hardcoded string that a reader might copy in here so the
// section components stay presentational and nothing drifts out of sync.

/** Public repo — also the Deploy Button clone source. */
export const GITHUB_URL = 'https://github.com/jomafilms/browser-comments';

/** Placeholder origin shown in copy-paste snippets on the (static) landing page. */
const INSTANCE = 'https://your-instance.vercel.app';

/**
 * Vercel Deploy Button clone URL.
 *
 * `products` attaches the Neon Postgres storage integration so the wizard
 * provisions a database and injects `DATABASE_URL` automatically — the schema
 * self-initializes on first request, so no migration step is needed.
 *
 * We prompt only for `BETTER_AUTH_SECRET` (required, signs the owner-login
 * session). `ADMIN_SECRET` is deprecated and intentionally not requested;
 * `BETTER_AUTH_URL` is set after the first deploy (see the setup docs / link).
 */
const NEON_PRODUCT = [
  { type: 'integration', integrationSlug: 'neon', productSlug: 'neon', protocol: 'storage' },
];

export const DEPLOY_URL =
  'https://vercel.com/new/clone?' +
  new URLSearchParams({
    'repository-url': GITHUB_URL,
    'project-name': 'browser-comments',
    'repository-name': 'browser-comments',
    env: 'BETTER_AUTH_SECRET',
    envDescription:
      'A random 32+ character secret that signs your owner-login session. Generate one with: openssl rand -base64 32',
    envLink: `${GITHUB_URL}/blob/main/RELEASE-NOTES.md`,
    products: JSON.stringify(NEON_PRODUCT),
  }).toString();

/** The widget embed — the whole install surface for the client's site. */
export const WIDGET_SNIPPET = `<script
  src="${INSTANCE}/widget.js"
  data-key="YOUR_WIDGET_KEY"
></script>`;

/** Agent tooling one-liners (CLI + MCP). */
export const CLI_INSTALL = `npm i -g @jomafilms/browser-comments-cli`;

export const CLI_WATCH = `export BROWSER_COMMENTS_API=${INSTANCE}
export BROWSER_COMMENTS_TOKEN=YOUR_TOKEN

# Stream new/changed tickets as JSON, exactly once across restarts:
browser-comments watch --interval=30 --since-file ~/.bc-checkpoint`;

export const WEBHOOK_REGISTER = `curl -X POST "${INSTANCE}/api/webhooks" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-agent/hook","events":["comment.created"]}'`;

/**
 * llms.txt-style plain block an agent can paste to self-configure.
 * Parameterized by the API base so the `/llms.txt` route can serve the real
 * requesting origin, while the landing page shows the placeholder for display.
 */
export function buildLlmsBlock(apiBase: string): string {
  return `# browser-comments — agent integration

Feedback tickets are filed by humans annotating a web page. This tool is
plumbing only: it emits webhooks and answers polls. It never calls your agent.

API base:   ${apiBase}
Auth:       Authorization: Bearer <TOKEN>   (project or client scope)

Find new/changed tickets — pick one:
  Poll:    GET /api/comments?since=<ISO8601>&excludeImages=true
           Use the X-Server-Time response header as your next ?since= value.
  Webhook: POST /api/webhooks {"url","events":["comment.created","comment.updated"]}
           Verify X-BC-Signature (HMAC-SHA256 of the raw body) before trusting.

Read one ticket:  GET /api/comments/<ref|uuid|id>          (e.g. LWF-12)
                  add ?includeImage=true for the annotated screenshot.
Update a ticket:  PATCH /api/comments/<ref> {"status":"resolved","note":"..."}

CLI:  npm i -g @jomafilms/browser-comments-cli   then  browser-comments --help
MCP:  server in the repo under mcp/ — exposes list_tickets / show_ticket / resolve.

Full recipes: ${GITHUB_URL}/blob/main/docs/AGENT-SETUP.md`;
}

/** Placeholder-host version for display in the landing page's copy block. */
export const LLMS_BLOCK = buildLlmsBlock(INSTANCE);
