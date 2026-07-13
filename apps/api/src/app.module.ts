import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './modules/auth/auth.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    DatabaseModule,
    AuthModule,
    IngestModule,
    MetricsModule,
    ProjectsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
