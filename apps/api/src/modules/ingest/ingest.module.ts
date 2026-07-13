import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { AuthModule } from '../auth/auth.module';
import { AuthMiddleware } from '../auth/auth.middleware';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'events',
    }),
    AuthModule,
  ],
  controllers: [IngestController],
  providers: [IngestService],
  exports: [BullModule],
})
export class IngestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: 'ingest/*', method: RequestMethod.ALL });
  }
}
