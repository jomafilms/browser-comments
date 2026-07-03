import { withClient, generateToken } from './pool';
import { generateRefPrefix, dedupeRefPrefix } from './refs';
import { Project, TokenContext } from './types';

// Resolve a token to its context — checks project tokens first, then client tokens.
// Project tokens scope access to a single project; client tokens grant access to all projects.
export async function resolveToken(token: string): Promise<TokenContext | null> {
  return withClient(async (dbClient) => {
    // Check project tokens first (more specific scope wins)
    const projectResult = await dbClient.query(
      `SELECT id, client_id FROM projects WHERE token = $1`,
      [token]
    );
    if (projectResult.rows.length > 0) {
      return {
        clientId: projectResult.rows[0].client_id,
        projectId: projectResult.rows[0].id,
      };
    }

    // Fall back to client token
    const clientResult = await dbClient.query(`SELECT id FROM clients WHERE token = $1`, [token]);
    if (clientResult.rows.length > 0) {
      return { clientId: clientResult.rows[0].id, projectId: null };
    }

    return null;
  });
}

// Generate or regenerate a token for a project
export async function generateProjectToken(projectId: number): Promise<string> {
  return withClient(async (dbClient) => {
    const token = generateToken();
    await dbClient.query(`UPDATE projects SET token = $1 WHERE id = $2`, [token, projectId]);
    return token;
  });
}

// Get project by its token
export async function getProjectByToken(token: string): Promise<Project | null> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(`SELECT * FROM projects WHERE token = $1`, [token]);
    return result.rows[0] || null;
  });
}

// Get project by matching origin URL.
// The url column can hold multiple comma-separated URLs (e.g. "https://staging.example.com, http://localhost:3000").
// Each entry is matched against the origin.
export async function getProjectByOrigin(clientId: number, origin: string): Promise<Project | null> {
  return withClient(async (dbClient) => {
    const projects = await dbClient.query(`SELECT * FROM projects WHERE client_id = $1`, [clientId]);
    const originClean = origin.replace(/\/$/, '').toLowerCase();
    const originNaked = originClean.replace(/^https?:\/\//, '');

    for (const project of projects.rows) {
      const urls = (project.url || '').split(',').map((u: string) => u.trim().replace(/\/$/, '').toLowerCase());
      for (const url of urls) {
        const urlNaked = url.replace(/^https?:\/\//, '');
        // Prefix matches require a '/' boundary so example.com never matches example.com.evil.io
        if (
          url === originClean ||
          urlNaked === originNaked ||
          originClean.startsWith(url + '/') ||
          url.startsWith(originClean + '/')
        ) {
          return project;
        }
      }
    }
    return null;
  });
}

export async function createProject(clientId: number, name: string, url: string): Promise<Project> {
  return withClient(async (dbClient) => {
    // Auto-generate the ticket ref prefix (e.g. "LWF" in LWF-12) from the
    // name, deduped within the client; editable later via project PATCH
    const existing = await dbClient.query(
      `SELECT ref_prefix FROM projects WHERE client_id = $1 AND ref_prefix IS NOT NULL`,
      [clientId]
    );
    const used = new Set<string>(existing.rows.map((r) => r.ref_prefix));
    const refPrefix = dedupeRefPrefix(generateRefPrefix(name), used);

    const result = await dbClient.query(
      `INSERT INTO projects (client_id, name, url, ref_prefix) VALUES ($1, $2, $3, $4) RETURNING *`,
      [clientId, name, url, refPrefix]
    );
    return result.rows[0];
  });
}

// Is this ref prefix already used by another project of the same client?
export async function isRefPrefixTaken(clientId: number, prefix: string, excludeProjectId?: number): Promise<boolean> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      `SELECT id FROM projects WHERE client_id = $1 AND UPPER(ref_prefix) = UPPER($2) AND id <> $3`,
      [clientId, prefix, excludeProjectId ?? -1]
    );
    return result.rows.length > 0;
  });
}

export async function updateProject(
  id: number,
  updates: { name?: string; url?: string; ref_prefix?: string }
): Promise<Project | null> {
  const sets: string[] = [];
  const params: (string | number)[] = [];
  let idx = 1;
  if (updates.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(updates.name);
  }
  if (updates.url !== undefined) {
    sets.push(`url = $${idx++}`);
    params.push(updates.url);
  }
  if (updates.ref_prefix !== undefined) {
    sets.push(`ref_prefix = $${idx++}`);
    params.push(updates.ref_prefix);
  }
  if (sets.length === 0) return getProjectById(id);
  params.push(id);
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  });
}

export async function getProjectsByClientId(clientId: number): Promise<Project[]> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      `SELECT * FROM projects WHERE client_id = $1 ORDER BY name`,
      [clientId]
    );
    return result.rows;
  });
}

export async function getProjectById(id: number): Promise<Project | null> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(`SELECT * FROM projects WHERE id = $1`, [id]);
    return result.rows[0] || null;
  });
}

export async function deleteProject(id: number): Promise<void> {
  await withClient((dbClient) => dbClient.query(`DELETE FROM projects WHERE id = $1`, [id]));
}
