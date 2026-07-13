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
import { VolumeDataPoint } from '@rate-snoop/types';
import { aggregateVolumeByBucket } from '@/lib/metrics';
import { ChartSkeleton } from './ChartSkeleton';
import { useMemo } from 'react';

interface Props {
  data: VolumeDataPoint[];
  loading: boolean;
}

export function VolumeChart({ data, loading }: Props) {
  // Aggregate by time bucket, sum across providers/endpoints
  const chartData = useMemo(() => {
    return aggregateVolumeByBucket(data);
  }, [data]);

  if (loading) return <ChartSkeleton />;

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
