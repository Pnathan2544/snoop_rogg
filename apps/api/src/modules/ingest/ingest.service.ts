import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IngestBatchDto } from './ingest.dto';
import { EventBatchJob } from '@rate-snoop/types';

const QUEUE_DEPTH_LIMIT = 10000;

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    @InjectQueue('events')
    private readonly eventsQueue: Queue<EventBatchJob>,
  ) {}

  async enqueueBatch(
    projectId: string,
    dto: IngestBatchDto,
  ): Promise<{ accepted: number; queued: boolean }> {
    const [waiting, active, delayed] = await Promise.all([
      this.eventsQueue.getWaitingCount(),
      this.eventsQueue.getActiveCount(),
      this.eventsQueue.getDelayedCount(),
    ]);
    const queueDepth = waiting + active + delayed;

    if (queueDepth >= QUEUE_DEPTH_LIMIT) {
      this.logger.warn(`Queue overloaded (depth: ${queueDepth}), rejecting batch`);
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Queue is overloaded. Try again later.',
          queueDepth,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const job: EventBatchJob = {
      projectId,
      events: dto.events,
      enqueuedAt: new Date().toISOString(),
    };

    await this.eventsQueue.add('event-batch', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    this.logger.log(
      `Enqueued batch of ${dto.events.length} events for project ${projectId}`,
    );

    return { accepted: dto.events.length, queued: true };
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.eventsQueue.getWaitingCount(),
      this.eventsQueue.getActiveCount(),
      this.eventsQueue.getCompletedCount(),
      this.eventsQueue.getFailedCount(),
      this.eventsQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
