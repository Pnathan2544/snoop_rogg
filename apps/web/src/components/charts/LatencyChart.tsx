'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { LatencyDataPoint } from '@rate-snoop/types';
import { formatTime } from '@/lib/utils';
import { ChartSkeleton } from './ChartSkeleton';
import { useMemo } from 'react';

interface Props {
  data: LatencyDataPoint[];
  loading: boolean;
}

export function LatencyChart({ data, loading }: Props) {
  const chartData = useMemo(() => {
    const bucketMap = new Map<string, { time: string; totalLatency: number; count: number }>();

    for (const d of data) {
      if (!bucketMap.has(d.bucketStart)) {
        bucketMap.set(d.bucketStart, {
          time: formatTime(d.bucketStart),
          totalLatency: 0,
          count: 0,
        });
      }
      const bucket = bucketMap.get(d.bucketStart)!;
      bucket.totalLatency += d.avgLatencyMs;
      bucket.count++;
    }

    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        time: v.time,
        avgLatencyMs: v.count > 0 ? Math.round(v.totalLatency / v.count) : 0,
      }));
  }, [data]);

  if (loading) return <ChartSkeleton />;

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-60 text-slate-400 text-sm">
        No data for the selected time range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(v) => `${v}ms`}
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(value: number) => [`${value}ms`, 'Avg Latency']}
        />
        <Line
          type="monotone"
          dataKey="avgLatencyMs"
          name="Avg Latency"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
