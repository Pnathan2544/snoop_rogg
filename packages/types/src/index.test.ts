import { describe, expectTypeOf, it } from 'vitest';
import type { ChartSeries, IngestEventDto, Project } from './index';

describe('@rate-snoop/types public exports', () => {
  it('exports project, ingest, and chart DTO types', () => {
    expectTypeOf<Project>().toMatchTypeOf<{
      id: string;
      name: string;
      createdAt: Date;
    }>();

    expectTypeOf<IngestEventDto>().toMatchTypeOf<{
      provider: string;
      endpoint: string;
      method: string;
      statusCode: number;
      latencyMs: number;
      ts: string;
    }>();

    expectTypeOf<ChartSeries>().toMatchTypeOf<{
      name: string;
      data: Array<{ time: string; value: number; label?: string }>;
      color?: string;
    }>();
  });
});
