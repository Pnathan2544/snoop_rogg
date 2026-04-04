'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { VolumeDataPoint } from '@rate-snoop/types';
import { formatTime } from '@/lib/utils';
import { ChartSkeleton } from './ChartSkeleton';
import { useMemo } from 'react';

interface Props {
  data: VolumeDataPoint[];
  loading: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function VolumeChart({ data, loading }: Props) {
  if (loading) return <ChartSkeleton />;

  // Aggregate by time bucket, sum across providers/endpoints
  const chartData = useMemo(() => {
    const bucketMap = new Map<string, Record<string, number>>();

    for (const d of data) {
      const time = formatTime(d.bucketStart);
      if (!bucketMap.has(d.bucketStart)) {
        bucketMap.set(d.bucketStart, { time: time as unknown as number, total: 0 });
      }
      const bucket = bucketMap.get(d.bucketStart)!;
      bucket.total = (bucket.total as number) + d.requestCount;
    }

    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [data]);

  if (chartData.length === 0) {
    return <EmptyChart message="No data for the selected time range." />;
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
        />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="total"
          name="Requests"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-60 text-slate-400 text-sm">
      {message}
    </div>
  );
}
