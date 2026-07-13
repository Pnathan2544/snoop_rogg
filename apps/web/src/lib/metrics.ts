import type {
  ErrorDataPoint,
  LatencyDataPoint,
  VolumeDataPoint,
} from '@rate-snoop/types';
import { formatTime } from './utils';

export interface CountPoint {
  time: string;
  total: number;
}

export interface ErrorRatePoint {
  time: string;
  errorRate: number;
}

export interface LatencyPoint {
  time: string;
  avgLatencyMs: number;
}

export function aggregateVolumeByBucket(data: VolumeDataPoint[]): CountPoint[] {
  const buckets = new Map<string, CountPoint>();

  for (const point of data) {
    const bucket = buckets.get(point.bucketStart) ?? {
      time: formatTime(point.bucketStart),
      total: 0,
    };
    bucket.total += point.requestCount;
    buckets.set(point.bucketStart, bucket);
  }

  return sortedValues(buckets);
}

export function aggregateErrorRateByBucket(
  data: ErrorDataPoint[],
): ErrorRatePoint[] {
  const buckets = new Map<
    string,
    { time: string; errors: number; requests: number }
  >();

  for (const point of data) {
    const bucket = buckets.get(point.bucketStart) ?? {
      time: formatTime(point.bucketStart),
      errors: 0,
      requests: 0,
    };
    bucket.errors += point.errorCount;
    bucket.requests += point.requestCount;
    buckets.set(point.bucketStart, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, bucket]) => ({
      time: bucket.time,
      errorRate:
        bucket.requests > 0
          ? Number(((bucket.errors / bucket.requests) * 100).toFixed(1))
          : 0,
    }));
}

export function aggregateLatencyByBucket(
  data: LatencyDataPoint[],
): LatencyPoint[] {
  const buckets = new Map<
    string,
    { time: string; totalLatencyMs: number; requests: number }
  >();

  for (const point of data) {
    const bucket = buckets.get(point.bucketStart) ?? {
      time: formatTime(point.bucketStart),
      totalLatencyMs: 0,
      requests: 0,
    };
    bucket.totalLatencyMs += point.avgLatencyMs * point.requestCount;
    bucket.requests += point.requestCount;
    buckets.set(point.bucketStart, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, bucket]) => ({
      time: bucket.time,
      avgLatencyMs:
        bucket.requests > 0
          ? Math.round(bucket.totalLatencyMs / bucket.requests)
          : 0,
    }));
}

export function weightedAverageLatency(data: LatencyDataPoint[]): number | null {
  const totals = data.reduce(
    (result, point) => ({
      latencyMs: result.latencyMs + point.avgLatencyMs * point.requestCount,
      requests: result.requests + point.requestCount,
    }),
    { latencyMs: 0, requests: 0 },
  );

  return totals.requests > 0 ? Math.round(totals.latencyMs / totals.requests) : null;
}

function sortedValues<T>(buckets: Map<string, T>): T[] {
  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}
