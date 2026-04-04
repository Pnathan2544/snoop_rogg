import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: postgres.Sql | null = null;

export function createDbClient(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(client, { schema });
  return { db, client };
}

export function getDb(databaseUrl?: string) {
  if (!_db) {
    const url = databaseUrl || process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not defined');
    }
    const { db, client } = createDbClient(url);
    _db = db;
    _client = client;
  }
  return _db;
}

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
