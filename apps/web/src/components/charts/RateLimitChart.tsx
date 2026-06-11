'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ErrorDataPoint } from '@rate-snoop/types';
import { formatTime } from '@/lib/utils';
import { ChartSkeleton } from './ChartSkeleton';
import { useMemo } from 'react';

interface Props {
  data: ErrorDataPoint[];
  loading: boolean;
}

export function RateLimitChart({ data, loading }: Props) {
  const chartData = useMemo(() => {
    const bucketMap = new Map<string, { time: string; count429: number }>();

    for (const d of data) {
      if (!bucketMap.has(d.bucketStart)) {
        bucketMap.set(d.bucketStart, {
          time: formatTime(d.bucketStart),
          count429: 0,
        });
      }
      const bucket = bucketMap.get(d.bucketStart)!;
      bucket.count429 += d.count429;
    }

    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
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
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
          width={40}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
          cursor={{ fill: '#fff7ed' }}
        />
        <Bar
          dataKey="count429"
          name="429 Responses"
          fill="#f97316"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
