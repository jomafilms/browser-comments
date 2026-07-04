# Setup

The one canonical setup path for **dev·tix** (repo: `browser-comments`). Pick
**Deploy** for a hosted instance or **Local development** to hack on it.

- Framework: Next.js 15 · React 19 · Tailwind v4
- Data: PostgreSQL — local for dev, [Neon](https://neon.tech) in production
- Auth: Better Auth (owner login at `/admin`)

The database schema is **created automatically on first request** (and by
`npm run init-db`), so there is no separate migration step to run.

---

## Deploy (Vercel + Neon)

The fastest path is the **Deploy Button** on the landing page (`/`) — it clones
the repo, provisions a free Neon Postgres, and prompts for one secret.

1. Click **Deploy**. When prompted, set **`BETTER_AUTH_SECRET`** — a random 32+
   character string. Generate one with:
   ```bash
   openssl rand -base64 32
   ```
   The Neon integration injects **`DATABASE_URL`** for you.
2. After the first deploy, set **`BETTER_AUTH_URL`** to your production origin
   (e.g. `https://your-instance.vercel.app`) and redeploy.
3. Visit **`/admin`** and create your owner account (first sign-up bootstraps the
   single owner; later sign-ups are rejected).
4. In the admin **client view**, create a client + project and copy the widget
   snippet (see [Add the widget](#add-the-widget)).

Prefer to wire it up by hand? Import the repo in Vercel, add a Neon (or any
Postgres) database, and set the env vars from the [reference](#environment-variables).

---

## Local development

**1. Install PostgreSQL**

```bash
# macOS
brew install postgresql@14 && brew services start postgresql@14
# …or Docker
docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

**2. Create the database**

```bash
createdb browser_comments
# Docker: docker exec -it postgres createdb -U postgres browser_comments
```

**3. Install deps and configure env**

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgresql://localhost:5432/browser_comments
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
```

**4. Run**

```bash
npm run dev          # http://localhost:3000
npm run init-db      # optional — pre-creates the schema (also happens lazily)
```

Open `http://localhost:3000/admin` and create the owner account.

---

## Add the widget

Grab the client's widget key from the admin **client view** (one-click copy),
then paste this before `</body>` on the site you want feedback on:

```html
<script
  src="https://your-instance.vercel.app/widget.js"
  data-key="YOUR_WIDGET_KEY"
></script>
```

The key is safe to embed publicly — it only authorizes feedback submissions for
that project, not ticket access. Optional attributes: `data-user-name`,
`data-position` (`bottom-right` default), `data-color` (`#2563eb` default),
`data-button-text`, `data-title`, `data-subtitle`.

Some assets won't appear in captures unless their host sends CORS headers — see
[docs/CORS.md](./CORS.md).

---

## Pull tickets into your workflow

- **External devs & agents** (tokens, CLI, MCP, direct API): [docs/EXTERNAL-DEV-SETUP.md](./EXTERNAL-DEV-SETUP.md)
- **Wire tickets to a coding agent** (webhooks, polling, Claude Routine / GitHub Action recipes): [docs/AGENT-SETUP.md](./AGENT-SETUP.md)
- CLI reference: [`cli/README.md`](../cli/README.md) · MCP reference: [`mcp/README.md`](../mcp/README.md)

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string. Injected by the Neon integration on Vercel. |
| `BETTER_AUTH_SECRET` | ✅ | ≥32 chars; signs owner-login sessions. `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | ✅ (prod) | Public https origin used for auth cookies/callbacks. |
| `ADMIN_SECRET` | — | **Deprecated** break-glass bearer. Leave unset to require the owner login only. |
| `WEBHOOK_BASE_URL` | — | Canonical origin for links in webhook payloads. |
| `WEBHOOK_ALLOW_LOOPBACK` | — | Set `false` to forbid loopback webhook targets in hosted prod. |

See [RELEASE-NOTES.md](../RELEASE-NOTES.md) for breaking changes when upgrading a fork.

---

## Troubleshooting

- **Database connection error** — is Postgres running? Check `DATABASE_URL`; `psql -l` lists databases.
- **Can't sign in / no owner** — the first visit to `/admin` creates the owner. If you're locked out, recover via the DB or re-bootstrap (password reset isn't built yet).
- **Images blank in the capture** — cross-origin assets need CORS headers; see [docs/CORS.md](./CORS.md).
- **Widget button doesn't appear** — the script must be at the end of `<body>`; check the browser console and that `data-key` is a valid project key.
