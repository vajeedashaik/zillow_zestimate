'use client';

/**
 * components/monitoring/AlertLog.tsx
 *
 * Table of past drift alerts with severity badges and status chips.
 */

import type { AlertEntry } from '@/data/mockMonitoringData';

interface Props {
  alerts: AlertEntry[];
}

const severityStyles: Record<AlertEntry['severity'], string> = {
  high:   'bg-red-500/15 text-red-400 border border-red-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  low:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
};

const statusStyles: Record<AlertEntry['status'], string> = {
  open:     'bg-red-500/10 text-red-300 border border-red-500/25',
  resolved: 'bg-green-500/10 text-green-400 border border-green-500/25',
};

export default function AlertLog({ alerts }: Props) {
  const sorted = [...alerts].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-800">
            {['Date', 'Feature', 'Drift Type', 'PSI', 'Severity', 'Status'].map((h) => (
              <th
                key={h}
                className="text-left text-gray-500 text-xs font-medium uppercase tracking-wider py-2 px-3 first:pl-0 last:pr-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((alert, i) => (
            <tr
              key={alert.id}
              className={`border-b border-gray-800/50 transition-colors hover:bg-gray-800/30 ${
                alert.status === 'open' ? 'bg-red-500/5' : ''
              }`}
            >
              <td className="py-2.5 px-3 first:pl-0 text-gray-400 text-xs font-mono whitespace-nowrap">
                {alert.date}
              </td>
              <td className="py-2.5 px-3 text-white text-xs font-medium whitespace-nowrap">
                {alert.feature}
              </td>
              <td className="py-2.5 px-3 text-gray-300 text-xs whitespace-nowrap">
                {alert.driftType}
              </td>
              <td className="py-2.5 px-3 text-xs font-mono">
                <span className={alert.psi > 0.2 ? 'text-red-400' : alert.psi > 0.1 ? 'text-amber-400' : 'text-gray-400'}>
                  {alert.psi.toFixed(2)}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium capitalize ${severityStyles[alert.severity]}`}>
                  {alert.severity}
                </span>
              </td>
              <td className="py-2.5 px-3 last:pr-0">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium capitalize ${statusStyles[alert.status]}`}>
                  {alert.status === 'open' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  )}
                  {alert.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-8">No alerts recorded.</p>
      )}
    </div>
  );
}
