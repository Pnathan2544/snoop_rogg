/**
 * Database migration script
 * Run with: npx ts-node scripts/migrate.ts
 * Or: DATABASE_URL=... npx ts-node scripts/migrate.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  console.log('Running migrations...');
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../packages/db/drizzle'),
  });

  console.log('Migrations complete!');
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
