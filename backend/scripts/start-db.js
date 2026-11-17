import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../.data/postgres');

console.log('Starting local PostgreSQL on port 5432...');
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'password',
  port: 5432,
  persistent: true,
  autoRehydrateSymlinks: true,
});

try {
  await pg.initialise();
} catch (e) {
  console.log('Initialise note:', e?.message || e);
}

await pg.start();
console.log('Local PostgreSQL is running on port 5432!');

try {
  await pg.createDatabase('user_profile');
  console.log('Database "user_profile" created/ready.');
} catch (e) {
  console.log('Database "user_profile" note:', e?.message || e);
}

// Keep process alive if started directly
process.on('SIGINT', async () => {
  console.log('Stopping PostgreSQL...');
  await pg.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Stopping PostgreSQL...');
  await pg.stop();
  process.exit(0);
});
