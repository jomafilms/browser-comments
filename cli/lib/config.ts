import * as fs from 'fs';
import * as path from 'path';
import { CLIConfig } from './types';

function parseEnvFile(filePath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return vars;

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

export function loadConfig(): CLIConfig {
  const envFile = path.join(process.cwd(), '.env.local');
  const fileVars = parseEnvFile(envFile);

  const get = (key: string): string | undefined => process.env[key] || fileVars[key];

  const token = get('BROWSER_COMMENTS_TOKEN');
  if (!token) {
    throw new Error('BROWSER_COMMENTS_TOKEN is required. Set it in .env.local or as an environment variable.');
  }

  const dbUrl = get('BROWSER_COMMENTS_DB') || get('DATABASE_URL');
  const apiUrl = get('BROWSER_COMMENTS_API');

  if (!dbUrl && !apiUrl) {
    throw new Error('Either BROWSER_COMMENTS_DB or BROWSER_COMMENTS_API must be set.');
  }

  const mode = dbUrl ? 'db' : 'api';

  return { token, dbUrl, apiUrl, mode };
}
