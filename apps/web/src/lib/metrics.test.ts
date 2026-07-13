import { describe, expect, it } from 'vitest';
import {
  aggregateErrorRateByBucket,
  aggregateLatencyByBucket,
  aggregateVolumeByBucket,
  weightedAverageLatency,
} from './metrics';
import { formatTime } from './utils';

const bucket = '2026-07-12T09:41:00.000Z';
const displayTime = formatTime(bucket);

describe('dashboard metric aggregation', () => {
  it('sums request volume across endpoint groups', () => {
    expect(
      aggregateVolumeByBucket([
        { bucketStart: bucket, provider: 'a', endpointGroup: '/a', requestCount: 2 },
        { bucketStart: bucket, provider: 'b', endpointGroup: '/b', requestCount: 3 },
      ]),
    ).toEqual([{ time: displayTime, total: 5 }]);
  });

  it('computes a request-weighted error rate', () => {
    expect(
      aggregateErrorRateByBucket([
        {
          bucketStart: bucket,
          provider: 'a',
          endpointGroup: '/a',
          errorCount: 1,
          count429: 0,
          requestCount: 2,
          errorRate: 50,
        },
        {
          bucketStart: bucket,
          provider: 'b',
          endpointGroup: '/b',
          errorCount: 0,
          count429: 0,
          requestCount: 8,
          errorRate: 0,
        },
      ]),
    ).toEqual([{ time: displayTime, errorRate: 10 }]);
  });

  it('computes request-weighted latency for charts and summaries', () => {
    const data = [
      {
        bucketStart: bucket,
        provider: 'a',
        endpointGroup: '/a',
        avgLatencyMs: 100,
        requestCount: 1,
      },
      {
        bucketStart: bucket,
        provider: 'b',
        endpointGroup: '/b',
        avgLatencyMs: 500,
        requestCount: 3,
      },
    ];

    expect(aggregateLatencyByBucket(data)).toEqual([
      { time: displayTime, avgLatencyMs: 400 },
    ]);
    expect(weightedAverageLatency(data)).toBe(400);
    expect(weightedAverageLatency([])).toBeNull();
  });
});
