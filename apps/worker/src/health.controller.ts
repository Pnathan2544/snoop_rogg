import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import { DatabaseService } from './database/database.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectQueue('events') private readonly eventsQueue: Queue,
  ) {}

  @Get()
  check() {
    return this.liveness();
  }

  @Get('live')
  liveness() {
    return { status: 'ok', service: 'worker' };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.databaseService.db.execute(sql`SELECT 1`);
      const redis = await this.eventsQueue.client;
      await redis.ping();

      return {
        status: 'ready',
        service: 'worker',
        dependencies: { postgres: 'ok', redis: 'ok' },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: 'worker',
      });
    }
  }
}
