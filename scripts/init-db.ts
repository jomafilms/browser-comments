import { initDB } from '../lib/db';

async function main() {
  console.log('Initializing database...');
  try {
    await initDB();
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

main();
