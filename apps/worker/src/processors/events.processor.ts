import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventBatchJob } from '@rate-snoop/types';
import { AggregationService } from './aggregation.service';

@Processor('events')
export class EventsProcessor {
  private readonly logger = new Logger(EventsProcessor.name);
  private processedCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  constructor(private readonly aggregationService: AggregationService) {}

  @Process({ concurrency: 3 })
  async processEventBatch(job: Job<EventBatchJob>): Promise<void> {
    const { projectId, events, enqueuedAt } = job.data;

    const queueLatencyMs = Date.now() - new Date(enqueuedAt).getTime();
    this.logger.log(
      `Processing job ${job.id} | project=${projectId} | events=${events.length} | queue_latency=${queueLatencyMs}ms`,
    );

    await this.aggregationService.processEvents(projectId, events);

    this.processedCount += events.length;
    this.logThroughputMetrics();
  }

  @OnQueueCompleted()
  onCompleted(job: Job<EventBatchJob>): void {
    this.logger.debug(`Job ${job.id} completed successfully`);
  }

  @OnQueueFailed()
  onFailed(job: Job<EventBatchJob>, error: Error): void {
    this.errorCount++;
    this.logger.error(
      `Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${error.message}`,
      error.stack,
    );

    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      this.logger.error(
        `Job ${job.id} moved to dead letter queue after ${job.attemptsMade} attempts`,
      );
    }
  }

  private logThroughputMetrics(): void {
    const uptime = (Date.now() - this.startTime) / 1000;
    const throughput = uptime > 0 ? (this.processedCount / uptime).toFixed(2) : '0';
    this.logger.log(
      `Throughput: ${throughput} events/s | Total processed: ${this.processedCount} | Errors: ${this.errorCount}`,
    );
  }
}
