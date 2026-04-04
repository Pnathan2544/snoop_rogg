'use client';

import { TopEndpointDataPoint } from '@rate-snoop/types';

interface Props {
  data: TopEndpointDataPoint[];
  loading: boolean;
}

export function TopEndpointsTable({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        No endpoint data for the selected time range.
      </div>
    );
  }

  const maxRequests = Math.max(...data.map((d) => d.requestCount));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-slate-100">
            <th className="pb-3 font-medium text-slate-500">Provider</th>
            <th className="pb-3 font-medium text-slate-500">Endpoint</th>
            <th className="pb-3 font-medium text-slate-500 text-right">Requests</th>
            <th className="pb-3 font-medium text-slate-500 text-right">Errors</th>
            <th className="pb-3 font-medium text-slate-500 text-right">429s</th>
            <th className="pb-3 font-medium text-slate-500 text-right">Avg Latency</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const errorRate =
              row.requestCount > 0
                ? ((row.errorCount / row.requestCount) * 100).toFixed(1)
                : '0.0';
            const barWidth = Math.round((row.requestCount / maxRequests) * 100);

            return (
              <tr
                key={`${row.provider}-${row.endpointGroup}-${i}`}
                className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
              >
                <td className="py-3 pr-4">
                  <span className="badge bg-blue-100 text-blue-800">
                    {row.provider}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-700">{row.endpointGroup}</span>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-1 h-1 bg-slate-100 rounded-full w-full max-w-xs">
                    <div
                      className="h-1 bg-blue-400 rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </td>
                <td className="py-3 text-right font-medium text-slate-800">
                  {row.requestCount.toLocaleString()}
                </td>
                <td className="py-3 text-right">
                  <span
                    className={`font-medium ${
                      parseFloat(errorRate) > 5 ? 'text-red-600' : 'text-slate-600'
                    }`}
                  >
                    {row.errorCount.toLocaleString()}
                    <span className="text-slate-400 ml-1 text-xs">({errorRate}%)</span>
                  </span>
                </td>
                <td className="py-3 text-right">
                  <span
                    className={`font-medium ${
                      row.count429 > 0 ? 'text-orange-600' : 'text-slate-600'
                    }`}
                  >
                    {row.count429.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 text-right font-medium text-slate-700">
                  {Math.round(row.avgLatencyMs)}ms
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
