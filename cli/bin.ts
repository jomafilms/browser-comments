#!/usr/bin/env node

import { loadConfig } from './lib/config';
import { output, outputError } from './lib/output';
import { TicketFilters } from './lib/types';
import { listCommand } from './commands/list';
import { showCommand } from './commands/show';
import { resolveCommand } from './commands/resolve';
import { reopenCommand } from './commands/reopen';
import { assignCommand } from './commands/assign';
import { watchCommand } from './commands/watch';
import { closePool } from './lib/db-reader';

function parseArgs(argv: string[]): { command: string; positional: string[]; flags: Record<string, string> } {
  const args = argv.slice(2);
  const command = args[0] || 'list';
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        // Next arg is value if it doesn't start with --
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = 'true';
        }
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function extractFilters(flags: Record<string, string>): TicketFilters {
  const filters: TicketFilters = {};
  if (flags.status) filters.status = flags.status;
  if (flags.priority) filters.priority = flags.priority;
  if (flags.assignee) filters.assignee = flags.assignee;
  if (flags.section) filters.section = flags.section;
  if (flags.project) filters.project = flags.project;
  return filters;
}

const USAGE = `browser-comments <command> [options]

Commands:
  list    [--status=open|resolved] [--priority=high|med|low] [--assignee=X] [--section=X] [--project=ID] [--include-images]
  show    <id|#display_number> [--include-images]
  resolve <id|#display_number> [--note="reason"]
  reopen  <id|#display_number>
  assign  <id|#display_number> --to=<assignee>
  watch   [--interval=60] [--schedule=manual|hourly|daily|weekly] [+ any list filters]

Global:
  --format=json|text    (default: json)
  --help                Show this help message`;

async function main() {
  const { command, positional, flags } = parseArgs(process.argv);
  const format = flags.format || 'json';

  if (command === 'help' || command === '--help' || flags.help) {
    console.log(USAGE);
    return;
  }

  try {
    const config = loadConfig();

    switch (command) {
      case 'list': {
        const filters = extractFilters(flags);
        const includeImages = flags['include-images'] === 'true';
        const result = await listCommand(config, filters, includeImages);
        output(result, format);
        break;
      }

      case 'show': {
        const ref = positional[0];
        if (!ref) throw Object.assign(new Error('Usage: browser-comments show <id|#display_number>'), { _code: 'USAGE_ERROR' });
        const includeImages = flags['include-images'] === 'true';
        const result = await showCommand(config, ref, includeImages);
        output(result, format);
        break;
      }

      case 'resolve': {
        const ref = positional[0];
        if (!ref) throw Object.assign(new Error('Usage: browser-comments resolve <id|#display_number>'), { _code: 'USAGE_ERROR' });
        const result = await resolveCommand(config, ref, flags.note);
        output(result, format);
        break;
      }

      case 'reopen': {
        const ref = positional[0];
        if (!ref) throw Object.assign(new Error('Usage: browser-comments reopen <id|#display_number>'), { _code: 'USAGE_ERROR' });
        const result = await reopenCommand(config, ref);
        output(result, format);
        break;
      }

      case 'assign': {
        const ref = positional[0];
        const assignee = flags.to;
        if (!ref || !assignee) throw Object.assign(new Error('Usage: browser-comments assign <id|#display_number> --to=<assignee>'), { _code: 'USAGE_ERROR' });
        const result = await assignCommand(config, ref, assignee);
        output(result, format);
        break;
      }

      case 'watch': {
        const filters = extractFilters(flags);
        const interval = flags.interval ? parseInt(flags.interval, 10) : undefined;
        watchCommand(config, filters, format, flags.schedule, interval);
        return; // watch manages its own lifecycle
      }

      default:
        throw Object.assign(new Error(`Unknown command: ${command}. Run with --help for usage.`), { _code: 'UNKNOWN_COMMAND' });
    }
  } catch (err: any) {
    const code = err._code
      || (err.message?.includes('BROWSER_COMMENTS_') ? 'CONFIG_ERROR'
      : err.message?.includes('token') ? 'AUTH_FAILED'
      : err.message?.includes('not found') ? 'NOT_FOUND'
      : 'ERROR');
    outputError(err.message, code, format);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
