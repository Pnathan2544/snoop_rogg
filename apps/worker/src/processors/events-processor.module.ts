import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventsProcessor } from './events.processor';
import { AggregationService } from './aggregation.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'events',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  providers: [EventsProcessor, AggregationService],
})
export class EventsProcessorModule {}
