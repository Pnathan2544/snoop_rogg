import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { DatabaseService } from '../../database/database.service';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('rejects a reversed time range before querying PostgreSQL', async () => {
    const service = new MetricsService({} as DatabaseService);

    await expect(
      service.getVolume({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        from: '2026-07-13T00:00:00.000Z',
        to: '2026-07-12T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
