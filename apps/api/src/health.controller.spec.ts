import { ServiceUnavailableException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from './database/database.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const execute = vi.fn();
  const ping = vi.fn();
  let controller: HealthController;

  beforeEach(() => {
    execute.mockReset().mockResolvedValue([]);
    ping.mockReset().mockResolvedValue('PONG');

    const database = { db: { execute } } as unknown as DatabaseService;
    const queue = { client: Promise.resolve({ ping }) } as unknown as Queue;
    controller = new HealthController(database, queue);
  });

  it('returns the API liveness payload without checking dependencies', () => {
    expect(controller.check()).toEqual({ status: 'ok', service: 'api' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('reports ready when PostgreSQL and Redis respond', async () => {
    await expect(controller.readiness()).resolves.toEqual({
      status: 'ready',
      service: 'api',
      dependencies: { postgres: 'ok', redis: 'ok' },
    });
    expect(ping).toHaveBeenCalledOnce();
  });

  it('reports unavailable when a dependency fails', async () => {
    execute.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(controller.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
