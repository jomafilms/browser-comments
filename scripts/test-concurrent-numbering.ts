// Verifies atomic ticket-number allocation (schema v4): concurrent
// saveComment calls to the same project must never produce duplicate
// project_numbers (the numeric half of `ref`) — nor duplicate legacy
// display_numbers, which are still written under a unique index even though
// nothing reads them, so they are asserted straight from the DB rather than off
// the returned row. Creates a throwaway client + project,
// fires ROUNDS × CONCURRENCY inserts, asserts uniqueness, and cleans up
// everything it created. Run against the DEV database only:
//   npx tsx scripts/test-concurrent-numbering.ts
import pool, { saveComment, createClient, createProject } from '../lib/db';

const ROUNDS = 5;
const CONCURRENCY = 2;

async function main() {
  const client = await createClient(`numbering-test-${Date.now()}`);
  const project = await createProject(client.id, 'Numbering Test', 'https://numbering-test.invalid');
  console.log(`Created throwaway client ${client.id} / project ${project.id}`);

  try {
    const results = [];
    for (let round = 0; round < ROUNDS; round++) {
      const batch = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          saveComment({
            url: 'https://numbering-test.invalid/page',
            imageData: 'data:image/png;base64,dGVzdA==',
            textAnnotations: [],
            projectId: project.id,
          })
        )
      );
      results.push(...batch);
    }

    const projectNumbers = results.map((r) => r.project_number);
    const refs = results.map((r) => r.ref);
    // display_number never leaves the database, so read it back directly.
    const legacy = await pool.query<{ display_number: number }>(
      'SELECT display_number FROM comments WHERE project_id = $1',
      [project.id]
    );
    const displayNumbers = legacy.rows.map((r) => r.display_number);
    console.log('project_numbers:', projectNumbers.join(', '));
    console.log('refs:', refs.join(', '));
    console.log('display_numbers (DB-only, legacy):', displayNumbers.join(', '));

    const failures: string[] = [];
    if (new Set(projectNumbers).size !== results.length) failures.push('duplicate project_number');
    if (new Set(displayNumbers).size !== results.length) failures.push('duplicate display_number');
    if (projectNumbers.some((n) => n == null)) failures.push('null project_number');
    if (results.some((r) => !r.uuid)) failures.push('missing uuid');
    if (refs.some((r) => !r)) failures.push('missing ref');
    // The whole point of the coordination work: nothing a consumer receives may
    // carry a second, competing ticket number.
    if (results.some((r) => 'display_number' in r)) failures.push('display_number leaked into a returned comment');

    if (failures.length > 0) {
      console.error(`FAIL: ${failures.join('; ')}`);
      process.exitCode = 1;
    } else {
      console.log(`PASS: ${results.length} concurrent inserts, all numbers unique`);
    }
  } finally {
    // comments have ON DELETE SET NULL — delete them explicitly before the
    // client cascade removes the project
    await pool.query('DELETE FROM comments WHERE project_id = $1', [project.id]);
    await pool.query('DELETE FROM clients WHERE id = $1', [client.id]);
    await pool.end();
    console.log('Cleaned up test data');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
