# @jomafilms/browser-comments-mcp

MCP server for [browser-comments](https://github.com/jomafilms/browser-comments) — pull feedback tickets into Claude Code and other AI agents.

## Setup

Add to your Claude Code MCP config (`~/.claude/settings.json` or project-level `.claude/settings.json`):

```json
{
  "mcpServers": {
    "browser-comments": {
      "command": "npx",
      "args": ["-y", "@jomafilms/browser-comments-mcp"],
      "env": {
        "BROWSER_COMMENTS_TOKEN": "your_project_or_client_token",
        "BROWSER_COMMENTS_API": "https://your-instance.vercel.app"
      }
    }
  }
}
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BROWSER_COMMENTS_TOKEN` | yes | Client or project token from your browser-comments admin |
| `BROWSER_COMMENTS_API` | yes | Base URL of your browser-comments instance |

Project tokens scope access to a single project. Client tokens grant access to all projects under a client.

## Tools

| Tool | Description |
|------|-------------|
| `list_tickets` | List tickets with filters (status, priority, assignee, section). Supports `include_images`. |
| `show_ticket` | Show a single ticket by display number. Includes annotated screenshot by default. |
| `resolve_ticket` | Mark a ticket as resolved, optionally with a note. |
| `reopen_ticket` | Reopen a previously resolved ticket. |
| `assign_ticket` | Assign a ticket to a team member. |

## License

MIT
