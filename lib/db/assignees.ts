import { withClient } from './pool';
import { Assignee } from './types';

export async function createAssignee(clientId: number, name: string): Promise<Assignee> {
  return withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO assignees (client_id, name) VALUES ($1, $2) RETURNING *`,
      [clientId, name]
    );
    return result.rows[0];
  });
}

export async function getAssigneesByClientId(clientId: number): Promise<Assignee[]> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT * FROM assignees WHERE client_id = $1 ORDER BY name`,
      [clientId]
    );
    return result.rows;
  });
}

export async function deleteAssignee(id: number): Promise<void> {
  await withClient((client) => client.query(`DELETE FROM assignees WHERE id = $1`, [id]));
}

export async function updateAssignee(id: number, name: string): Promise<Assignee> {
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE assignees SET name = $1 WHERE id = $2 RETURNING *`,
      [name, id]
    );
    return result.rows[0];
  });
}
