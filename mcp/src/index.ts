#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fetchTickets, fetchTicketById, patchTicket, Ticket } from './api-client';

const apiUrl = process.env.BROWSER_COMMENTS_API;
const token = process.env.BROWSER_COMMENTS_TOKEN;

if (!apiUrl || !token) {
  console.error('BROWSER_COMMENTS_API and BROWSER_COMMENTS_TOKEN env vars are required');
  process.exit(1);
}

const server = new McpServer({
  name: 'browser-comments',
  version: '0.1.0',
});

function formatTicket(t: Ticket): string {
  const notes = t.text_annotations
    .filter(a => a.text)
    .map(a => `  - ${a.text}`)
    .join('\n');

  return [
    `#${t.display_number} [${t.status}] ${t.priority} priority`,
    `  URL: ${t.url}`,
    `  Section: ${t.page_section}`,
    `  Assignee: ${t.assignee}`,
    t.submitter_name ? `  Submitted by: ${t.submitter_name}` : null,
    `  Created: ${t.created_at}`,
    notes ? `  Notes:\n${notes}` : null,
  ].filter(Boolean).join('\n');
}

// --- Tools ---

server.tool(
  'list_tickets',
  'List feedback tickets with optional filters',
  {
    status: z.enum(['open', 'resolved']).optional().describe('Filter by status'),
    priority: z.enum(['high', 'med', 'low']).optional().describe('Filter by priority'),
    assignee: z.string().optional().describe('Filter by assignee name'),
    section: z.string().optional().describe('Filter by page section (partial match)'),
  },
  async (filters) => {
    const tickets = await fetchTickets(apiUrl, token, filters);
    if (tickets.length === 0) {
      return { content: [{ type: 'text', text: 'No tickets found matching filters.' }] };
    }
    const text = `${tickets.length} ticket(s):\n\n${tickets.map(formatTicket).join('\n\n')}`;
    return { content: [{ type: 'text', text }] };
  }
);

server.tool(
  'show_ticket',
  'Show details for a single ticket by number (e.g. #3) or internal ID',
  {
    ref: z.number().describe('Ticket display number or internal ID'),
    by_display_number: z.boolean().default(true).describe('If true, ref is the display number (#N). If false, ref is the internal ID.'),
  },
  async ({ ref, by_display_number }) => {
    const ticket = await fetchTicketById(apiUrl, token, ref, by_display_number);
    if (!ticket) {
      return { content: [{ type: 'text', text: `Ticket ${by_display_number ? '#' : 'id:'}${ref} not found.` }] };
    }
    return { content: [{ type: 'text', text: formatTicket(ticket) }] };
  }
);

server.tool(
  'resolve_ticket',
  'Mark a ticket as resolved, optionally with a note',
  {
    ref: z.number().describe('Ticket display number'),
    note: z.string().optional().describe('Resolution note (e.g. "Fixed in commit abc123")'),
  },
  async ({ ref, note }) => {
    const ticket = await fetchTicketById(apiUrl, token, ref, true);
    if (!ticket) {
      return { content: [{ type: 'text', text: `Ticket #${ref} not found.` }] };
    }
    await patchTicket(apiUrl, token, ticket.id, { status: 'resolved', ...(note ? { note } : {}) });
    return { content: [{ type: 'text', text: `Ticket #${ref} resolved.${note ? ` Note: ${note}` : ''}` }] };
  }
);

server.tool(
  'reopen_ticket',
  'Reopen a previously resolved ticket',
  {
    ref: z.number().describe('Ticket display number'),
  },
  async ({ ref }) => {
    const ticket = await fetchTicketById(apiUrl, token, ref, true);
    if (!ticket) {
      return { content: [{ type: 'text', text: `Ticket #${ref} not found.` }] };
    }
    await patchTicket(apiUrl, token, ticket.id, { status: 'open' });
    return { content: [{ type: 'text', text: `Ticket #${ref} reopened.` }] };
  }
);

server.tool(
  'assign_ticket',
  'Assign a ticket to a team member',
  {
    ref: z.number().describe('Ticket display number'),
    assignee: z.string().describe('Name of the person to assign to'),
  },
  async ({ ref, assignee }) => {
    const ticket = await fetchTicketById(apiUrl, token, ref, true);
    if (!ticket) {
      return { content: [{ type: 'text', text: `Ticket #${ref} not found.` }] };
    }
    await patchTicket(apiUrl, token, ticket.id, { assignee });
    return { content: [{ type: 'text', text: `Ticket #${ref} assigned to ${assignee}.` }] };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
