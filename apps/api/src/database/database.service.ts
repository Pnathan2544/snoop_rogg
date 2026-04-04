import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@rate-snoop/db';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private client!: postgres.Sql;
  public db!: ReturnType<typeof drizzle<typeof schema>>;

  onModuleInit() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    this.logger.log(`Connecting to: ${url}`);
    this.client = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    this.db = drizzle(this.client, { schema });
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    await this.client.end();
    this.logger.log('Database connection closed');
  }
}
