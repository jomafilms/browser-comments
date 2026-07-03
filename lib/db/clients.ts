import { withClient, generateToken } from './pool';
import { Client, WidgetSettings } from './types';

export async function createClient(name: string): Promise<Client> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      `INSERT INTO clients (token, widget_key, name) VALUES ($1, $2, $3) RETURNING *`,
      [generateToken(), generateToken(), name]
    );
    return result.rows[0];
  });
}

export async function getClientById(id: number): Promise<Client | null> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(`SELECT * FROM clients WHERE id = $1`, [id]);
    return result.rows[0] || null;
  });
}

export async function getClientByToken(token: string): Promise<Client | null> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(`SELECT * FROM clients WHERE token = $1`, [token]);
    return result.rows[0] || null;
  });
}

export async function getClientByWidgetKey(widgetKey: string): Promise<Client | null> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(`SELECT * FROM clients WHERE widget_key = $1`, [widgetKey]);
    return result.rows[0] || null;
  });
}

// Regenerate client access token
export async function regenerateClientToken(clientId: number): Promise<string> {
  return withClient(async (dbClient) => {
    const token = generateToken();
    await dbClient.query(`UPDATE clients SET token = $1 WHERE id = $2`, [token, clientId]);
    return token;
  });
}

// Generate or regenerate widget key for a client
export async function generateWidgetKeyForClient(clientId: number): Promise<string> {
  return withClient(async (dbClient) => {
    const widgetKey = generateToken();
    await dbClient.query(`UPDATE clients SET widget_key = $1 WHERE id = $2`, [widgetKey, clientId]);
    return widgetKey;
  });
}

// Update widget settings for a client
export async function updateWidgetSettings(clientId: number, settings: WidgetSettings): Promise<Client> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      `UPDATE clients SET widget_settings = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(settings), clientId]
    );
    return result.rows[0];
  });
}

// Get widget settings by widget key (for widget.js to fetch)
export async function getWidgetSettingsByKey(widgetKey: string): Promise<WidgetSettings | null> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      `SELECT widget_settings FROM clients WHERE widget_key = $1`,
      [widgetKey]
    );
    return result.rows[0]?.widget_settings || null;
  });
}

export async function getClients(): Promise<Client[]> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(`SELECT * FROM clients ORDER BY name`);
    return result.rows;
  });
}

export async function deleteClient(id: number): Promise<void> {
  await withClient((dbClient) => dbClient.query(`DELETE FROM clients WHERE id = $1`, [id]));
}
