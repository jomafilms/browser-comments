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

// Parse a data URL (data:image/jpeg;base64,...) into MCP image content
function parseImageContent(imageData: string): { type: 'image'; data: string; mimeType: string } | null {
  if (!imageData) return null;
  const match = imageData.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) return null;
  return { type: 'image', data: match[2], mimeType: match[1] };
}

// --- Tools ---

server.tool(
  'list_tickets',
  'List feedback tickets with optional filters. Use include_images to see annotated screenshots.',
  {
    status: z.enum(['open', 'resolved']).optional().describe('Filter by status'),
    priority: z.enum(['high', 'med', 'low']).optional().describe('Filter by priority'),
    assignee: z.string().optional().describe('Filter by assignee name'),
    section: z.string().optional().describe('Filter by page section (partial match)'),
    include_images: z.boolean().default(false).describe('Include annotated screenshot images'),
  },
  async ({ include_images, ...filters }) => {
    const tickets = await fetchTickets(apiUrl, token, filters, include_images);
    if (tickets.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No tickets found matching filters.' }] };
    }

    const content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[] = [];

    for (const ticket of tickets) {
      content.push({ type: 'text' as const, text: formatTicket(ticket) });
      if (include_images && ticket.image_data) {
        const img = parseImageContent(ticket.image_data);
        if (img) content.push(img);
      }
    }

    return { content };
  }
);

server.tool(
  'show_ticket',
  'Show details for a single ticket by number (e.g. #3) or internal ID. Includes screenshot by default.',
  {
    ref: z.number().describe('Ticket display number or internal ID'),
    by_display_number: z.boolean().default(true).describe('If true, ref is the display number (#N). If false, ref is the internal ID.'),
    include_image: z.boolean().default(true).describe('Include the annotated screenshot image'),
  },
  async ({ ref, by_display_number, include_image }) => {
    const ticket = await fetchTicketById(apiUrl, token, ref, by_display_number, include_image);
    if (!ticket) {
      return { content: [{ type: 'text' as const, text: `Ticket ${by_display_number ? '#' : 'id:'}${ref} not found.` }] };
    }

    const content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[] = [
      { type: 'text' as const, text: formatTicket(ticket) },
    ];

    if (include_image && ticket.image_data) {
      const img = parseImageContent(ticket.image_data);
      if (img) content.push(img);
    }

    return { content };
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
      return { content: [{ type: 'text' as const, text: `Ticket #${ref} not found.` }] };
    }
    await patchTicket(apiUrl, token, ticket.id, { status: 'resolved', ...(note ? { note } : {}) });
    return { content: [{ type: 'text' as const, text: `Ticket #${ref} resolved.${note ? ` Note: ${note}` : ''}` }] };
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
      return { content: [{ type: 'text' as const, text: `Ticket #${ref} not found.` }] };
    }
    await patchTicket(apiUrl, token, ticket.id, { status: 'open' });
    return { content: [{ type: 'text' as const, text: `Ticket #${ref} reopened.` }] };
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
      return { content: [{ type: 'text' as const, text: `Ticket #${ref} not found.` }] };
    }
    await patchTicket(apiUrl, token, ticket.id, { assignee });
    return { content: [{ type: 'text' as const, text: `Ticket #${ref} assigned to ${assignee}.` }] };
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
