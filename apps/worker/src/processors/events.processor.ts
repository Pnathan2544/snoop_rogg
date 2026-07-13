import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventBatchJob } from '@rate-snoop/types';
import { AggregationService } from './aggregation.service';

@Processor('events', { concurrency: 3 })
export class EventsProcessor extends WorkerHost {
  private readonly logger = new Logger(EventsProcessor.name);
  private processedCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  constructor(private readonly aggregationService: AggregationService) {
    super();
  }

  async process(job: Job<EventBatchJob>): Promise<void> {
    const { projectId, events, enqueuedAt } = job.data;

    const queueLatencyMs = Date.now() - new Date(enqueuedAt).getTime();
    this.logger.log(
      `Processing job ${job.id} | project=${projectId} | events=${events.length} | queue_latency=${queueLatencyMs}ms`,
    );

    await this.aggregationService.processEvents(projectId, events);

    this.processedCount += events.length;
    this.logThroughputMetrics();
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EventBatchJob>): void {
    this.logger.debug(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EventBatchJob> | undefined, error: Error): void {
    this.errorCount++;

    if (!job) {
      this.logger.error(
        `Worker failed without job context: ${error.message}`,
        error.stack,
      );
      return;
    }
    this.logger.error(
      `Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${error.message}`,
      error.stack,
    );

    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      this.logger.error(
        `Job ${job.id} exhausted retries and remains in BullMQ's failed job set`,
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
