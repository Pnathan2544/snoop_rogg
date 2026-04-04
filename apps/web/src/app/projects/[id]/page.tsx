'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchProject,
  fetchVolumeMetrics,
  fetchErrorMetrics,
  fetchLatencyMetrics,
  fetchTopEndpoints,
} from '@/lib/api';
import { getDefaultTimeRange } from '@/lib/utils';
import { VolumeChart } from '@/components/charts/VolumeChart';
import { ErrorRateChart } from '@/components/charts/ErrorRateChart';
import { RateLimitChart } from '@/components/charts/RateLimitChart';
import { LatencyChart } from '@/components/charts/LatencyChart';
import { TopEndpointsTable } from '@/components/charts/TopEndpointsTable';

type TimeRange = '1h' | '6h' | '24h' | '7d';

function getTimeRange(range: TimeRange): { from: string; to: string } {
  const to = new Date();
  const hoursMap: Record<TimeRange, number> = {
    '1h': 1,
    '6h': 6,
    '24h': 24,
    '7d': 168,
  };
  const from = new Date(to.getTime() - hoursMap[range] * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function ProjectDashboardPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');

  const { from, to } = getTimeRange(timeRange);
  const metricsParams = { projectId, from, to };

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId),
  });

  const { data: volumeData = [], isLoading: volumeLoading } = useQuery({
    queryKey: ['metrics', 'volume', projectId, timeRange],
    queryFn: () => fetchVolumeMetrics(metricsParams),
    refetchInterval: 30000,
  });

  const { data: errorData = [], isLoading: errorLoading } = useQuery({
    queryKey: ['metrics', 'errors', projectId, timeRange],
    queryFn: () => fetchErrorMetrics(metricsParams),
    refetchInterval: 30000,
  });

  const { data: latencyData = [], isLoading: latencyLoading } = useQuery({
    queryKey: ['metrics', 'latency', projectId, timeRange],
    queryFn: () => fetchLatencyMetrics(metricsParams),
    refetchInterval: 30000,
  });

  const { data: topEndpoints = [], isLoading: topLoading } = useQuery({
    queryKey: ['metrics', 'top-endpoints', projectId, timeRange],
    queryFn: () => fetchTopEndpoints(metricsParams),
    refetchInterval: 30000,
  });

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/" className="hover:text-blue-600">Projects</Link>
            <span>/</span>
            <span>{project?.name}</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{project?.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
            {(['1h', '6h', '24h', '7d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <Link
            href={`/projects/${projectId}/settings`}
            className="btn-secondary text-sm"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Requests"
          value={volumeData.reduce((sum, d) => sum + d.requestCount, 0).toLocaleString()}
          loading={volumeLoading}
        />
        <StatCard
          label="Total Errors"
          value={errorData.reduce((sum, d) => sum + d.errorCount, 0).toLocaleString()}
          loading={errorLoading}
          valueClass="text-red-600"
        />
        <StatCard
          label="429s (Rate Limited)"
          value={errorData.reduce((sum, d) => sum + d.count429, 0).toLocaleString()}
          loading={errorLoading}
          valueClass="text-orange-600"
        />
        <StatCard
          label="Avg Latency"
          value={
            latencyData.length > 0
              ? `${Math.round(latencyData.reduce((sum, d) => sum + d.avgLatencyMs, 0) / latencyData.length)}ms`
              : '—'
          }
          loading={latencyLoading}
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Request Volume</h2>
          <VolumeChart data={volumeData} loading={volumeLoading} />
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Error Rate</h2>
          <ErrorRateChart data={errorData} loading={errorLoading} />
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Rate Limit Hits (429s)</h2>
          <RateLimitChart data={errorData} loading={errorLoading} />
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Avg Latency</h2>
          <LatencyChart data={latencyData} loading={latencyLoading} />
        </div>
      </div>

      {/* Top Endpoints */}
      <div className="card">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Top Endpoints</h2>
        <TopEndpointsTable data={topEndpoints} loading={topLoading} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  valueClass = 'text-slate-900',
}: {
  label: string;
  value: string;
  loading: boolean;
  valueClass?: string;
}) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      {loading ? (
        <div className="h-8 w-20 bg-slate-200 rounded animate-pulse mt-1" />
      ) : (
        <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
      )}
    </div>
  );
}
