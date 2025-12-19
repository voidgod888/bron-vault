import { initializeDatabase } from '../lib/db';

async function main() {
  console.log('Running database initialization to ensure schema...');
  try {
    await initializeDatabase();
    console.log('Database initialization complete.');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

main();
