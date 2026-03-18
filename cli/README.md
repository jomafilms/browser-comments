# browser-comments CLI

A CLI tool for pulling and managing dev tickets (feedback comments) from browser-comments. Designed for AI agent consumption (Claude Code, OpenClaw) with JSON output to stdout.

## Setup

### 1. Install globally from this repo

```bash
cd browser-comments
npm run cli:build
npm link
```

This makes `browser-comments` available as a global command.

### 2. Configure your project

In the project where you want to use the CLI, create or edit `.env.local`:

```env
# Required — your client token (found in the admin panel)
BROWSER_COMMENTS_TOKEN=your-client-token

# Option A: Direct database access (fastest, read-only)
BROWSER_COMMENTS_DB=postgresql://user:pass@host/dbname

# Option B: HTTP API access (works everywhere, supports writes)
BROWSER_COMMENTS_API=https://your-deployment.vercel.app
```

**If both are set:** DB is used for reads, API for writes.
**If only API:** API handles everything.
**If only DB:** Reads work, writes will error with a helpful message.

Environment variables (`process.env`) take precedence over `.env.local` values.

## Usage

Run from your project directory (where `.env.local` lives):

```bash
browser-comments <command> [options]
```

Or during development in this repo:

```bash
npm run tickets -- <command> [options]
```

### Commands

#### `list` — List and filter tickets

```bash
browser-comments list
browser-comments list --status=open
browser-comments list --priority=high --assignee=Anne
browser-comments list --section=/dashboard --format=text
browser-comments list --project=5
```

#### `show` — View a single ticket

```bash
browser-comments show #3              # by display number
browser-comments show 45              # by database ID
browser-comments show #3 --include-images
```

#### `resolve` — Mark a ticket as resolved

```bash
browser-comments resolve #3
browser-comments resolve #3 --note="Fixed in commit abc123"
```

#### `reopen` — Reopen a resolved ticket

```bash
browser-comments reopen #3
```

#### `assign` — Assign a ticket

```bash
browser-comments assign #3 --to=Anne
```

#### `watch` — Poll for ticket updates

```bash
browser-comments watch --interval=60              # every 60 seconds
browser-comments watch --schedule=hourly           # named preset
browser-comments watch --schedule=daily --status=open --priority=high
```

Named schedules: `manual` (one-shot), `hourly`, `daily`, `weekly`.
`--interval=N` (seconds) overrides `--schedule`.

### Global Options

| Option | Default | Description |
|--------|---------|-------------|
| `--format=json\|text` | `json` | Output format |
| `--help` | | Show help message |

## JSON Output

### Success

```json
{
  "ok": true,
  "mode": "db",
  "timestamp": "2026-03-17T14:30:00.000Z",
  "filters": { "status": "open", "priority": "high" },
  "count": 1,
  "tickets": [{
    "id": 45,
    "display_number": 3,
    "url": "https://example.com/dashboard",
    "page_section": "/dashboard",
    "status": "open",
    "priority": "high",
    "priority_number": 1,
    "assignee": "Anne",
    "submitter_name": "Jane",
    "text_annotations": [{"text": "Button misaligned", "x": 120, "y": 340, "color": "red"}],
    "created_at": "2026-03-15T10:00:00.000Z",
    "updated_at": "2026-03-15T10:00:00.000Z"
  }]
}
```

### Error

```json
{
  "ok": false,
  "error": "BROWSER_COMMENTS_TOKEN is required.",
  "code": "CONFIG_ERROR"
}
```

Error codes: `CONFIG_ERROR`, `AUTH_FAILED`, `NOT_FOUND`, `USAGE_ERROR`, `UNKNOWN_COMMAND`, `ERROR`

## For AI Agents

Pipe JSON output directly:

```bash
# In a Claude Code CLAUDE.md or agent config:
browser-comments list --status=open --priority=high

# Poll and tail:
browser-comments watch --interval=300 --status=open
```

For cron-based scheduling, just call `browser-comments list` from your system crontab — no daemon needed.
