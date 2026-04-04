'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ErrorDataPoint } from '@rate-snoop/types';
import { formatTime } from '@/lib/utils';
import { ChartSkeleton } from './ChartSkeleton';
import { useMemo } from 'react';

interface Props {
  data: ErrorDataPoint[];
  loading: boolean;
}

export function ErrorRateChart({ data, loading }: Props) {
  if (loading) return <ChartSkeleton />;

  const chartData = useMemo(() => {
    const bucketMap = new Map<string, { time: string; errorRate: number; errors: number; requests: number }>();

    for (const d of data) {
      if (!bucketMap.has(d.bucketStart)) {
        bucketMap.set(d.bucketStart, {
          time: formatTime(d.bucketStart),
          errorRate: 0,
          errors: 0,
          requests: 0,
        });
      }
      const bucket = bucketMap.get(d.bucketStart)!;
      bucket.errors += d.errorCount;
      // requestCount is available through errorRate calculation
    }

    // Since errorRate is already pre-computed as percentage
    const directMap = new Map<string, { time: string; errorRate: number }>();
    for (const d of data) {
      if (!directMap.has(d.bucketStart)) {
        directMap.set(d.bucketStart, {
          time: formatTime(d.bucketStart),
          errorRate: d.errorRate,
        });
      } else {
        // Average error rates
        const existing = directMap.get(d.bucketStart)!;
        existing.errorRate = (existing.errorRate + d.errorRate) / 2;
      }
    }

    return Array.from(directMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, errorRate: parseFloat(v.errorRate.toFixed(1)) }));
  }, [data]);

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
          width={40}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(value: number) => [`${value}%`, 'Error Rate']}
        />
        <ReferenceLine y={5} stroke="#fca5a5" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="errorRate"
          name="Error Rate"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
