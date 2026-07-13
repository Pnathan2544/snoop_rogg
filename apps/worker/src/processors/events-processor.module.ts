import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventsProcessor } from './events.processor';
import { AggregationService } from './aggregation.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'events' }),
  ],
  providers: [EventsProcessor, AggregationService],
  exports: [BullModule],
})
export class EventsProcessorModule {}
