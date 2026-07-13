import { HttpException, HttpStatus } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IngestService } from './ingest.service';

function createQueueMock() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    getWaitingCount: vi.fn().mockResolvedValue(0),
    getActiveCount: vi.fn().mockResolvedValue(0),
    getCompletedCount: vi.fn().mockResolvedValue(0),
    getFailedCount: vi.fn().mockResolvedValue(0),
    getDelayedCount: vi.fn().mockResolvedValue(0),
  };
}

const batch = {
  events: [
    {
      eventId: 'evt-1',
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      method: 'POST',
      statusCode: 200,
      latencyMs: 120,
      ts: '2026-07-12T09:41:27.123Z',
    },
  ],
};

describe('IngestService', () => {
  let queue: ReturnType<typeof createQueueMock>;
  let service: IngestService;

  beforeEach(() => {
    queue = createQueueMock();
    service = new IngestService(queue as unknown as Queue);
  });

  it('enqueues a named BullMQ job with retry policy', async () => {
    await expect(service.enqueueBatch('project-1', batch)).resolves.toEqual({
      accepted: 1,
      queued: true,
    });

    expect(queue.add).toHaveBeenCalledWith(
      'event-batch',
      expect.objectContaining({ projectId: 'project-1', events: batch.events }),
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
  });

  it('rejects work when pending jobs reach the backlog limit', async () => {
    queue.getWaitingCount.mockResolvedValue(9_998);
    queue.getActiveCount.mockResolvedValue(1);
    queue.getDelayedCount.mockResolvedValue(1);

    try {
      await service.enqueueBatch('project-1', batch);
      throw new Error('Expected enqueueBatch to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    expect(queue.add).not.toHaveBeenCalled();
  });
});
