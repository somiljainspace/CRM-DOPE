import React, { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import { apiFetch, RetentionResponse, RetentionRow } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Loader2 } from 'lucide-react';

export default function Retention() {
  const { workspace } = useWorkspace();
  const [entryEvent, setEntryEvent] = useState('signup_completed');
  const [returningEvent, setReturningEvent] = useState('page_viewed');
  const [retentionData, setRetentionData] = useState<RetentionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRetention = async () => {
    if (!workspace) return;
    if (!entryEvent.trim() || !returningEvent.trim()) {
      setError('Both entry and returning events are required.');
      return;
    }

    setLoading(true);
    setError('');

    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const res = await apiFetch<RetentionResponse>('v1/control/analytics/retention', {
        method: 'POST',
        query: { workspaceId: workspace.id },
        body: {
          startDate,
          endDate,
          entryEvent: entryEvent.trim(),
          returningEvent: returningEvent.trim()
        }
      });
      setRetentionData(res.retention || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load retention');
      setRetentionData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspace) {
      fetchRetention();
    }
  }, [workspace]);

  // Build a 2D grid of cohorts: { cohortDate: { offset: count } }
  const cohortMap: Record<string, Record<number, number>> = {};
  let maxOffset = 0;
  const cohortDates: string[] = [];

  if (retentionData) {
    retentionData.forEach(row => {
      const dateKey = row.cohort_date.split('T')[0];
      if (!cohortMap[dateKey]) {
        cohortMap[dateKey] = {};
        cohortDates.push(dateKey);
      }
      cohortMap[dateKey][row.day_offset] = row.users_count;
      maxOffset = Math.max(maxOffset, row.day_offset);
    });
    cohortDates.sort();
  }

  const getRetentionPct = (cohort: string, offset: number) => {
    if (!cohortMap[cohort] || cohortMap[cohort][offset] === undefined) return null;
    const initial = cohortMap[cohort][0] || 0;
    if (initial === 0) return 0;
    return Math.round((cohortMap[cohort][offset] / initial) * 100);
  };

  return (
    <AppShell title="Retention" breadcrumb={['Analytics', 'Retention']}>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight">Retention Analysis</h1>
        </div>

        {/* Controls */}
        <div className="bg-[#121620] border border-[#22283a] rounded-2xl p-5 shadow-lg mb-8 grid md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="text-xs uppercase tracking-wider font-semibold text-[#5f6a7a] mb-1.5 block">Entry Event</label>
            <input
              value={entryEvent}
              onChange={(e) => setEntryEvent(e.target.value)}
              placeholder="e.g. signup_completed"
              className="w-full bg-[#0a0d13] border border-[#22283a] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1] text-[#e9edf3] placeholder-[#556374] transition-all font-mono"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs uppercase tracking-wider font-semibold text-[#5f6a7a] mb-1.5 block">Returning Event</label>
            <input
              value={returningEvent}
              onChange={(e) => setReturningEvent(e.target.value)}
              placeholder="e.g. page_viewed"
              className="w-full bg-[#0a0d13] border border-[#22283a] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1] text-[#e9edf3] placeholder-[#556374] transition-all font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchRetention}
              disabled={loading}
              className="w-full md:w-auto bg-[#6366f1] hover:bg-[#4f46e5] text-white font-medium py-2 px-5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>Analyze</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Cohort Table */}
        <div className="bg-[#121620] border border-[#22283a] rounded-2xl p-6 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-[#e9edf3]">Cohort Retention Matrix</h2>
            <span className="text-xs text-[#5f6a7a]">% of users returning in subsequent days</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#556374]">
              <Loader2 size={32} className="animate-spin mb-4 text-[#6366f1]" />
              <p className="text-sm">Computing cohort retention...</p>
            </div>
          ) : !retentionData ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#556374]">
              <p className="text-sm">Run the analysis to view cohort retention.</p>
            </div>
          ) : retentionData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#556374]">
              <p className="text-sm">No retention data for these events in the selected time range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="text-[#5f6a7a] text-xs uppercase tracking-wider">
                    <th className="text-left py-3 pr-4 font-semibold sticky left-0 bg-[#121620] z-10">Cohort</th>
                    <th className="text-right py-3 px-2 font-semibold">Users</th>
                    {Array.from({ length: maxOffset + 1 }).map((_, i) => (
                      <th key={i} className="text-right py-3 px-2 font-semibold min-w-[52px]">
                        {i === 0 ? 'Day 0' : `+${i}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22283a]">
                  {cohortDates.map(cohort => {
                    const initialUsers = cohortMap[cohort][0] || 0;
                    return (
                      <tr key={cohort} className="hover:bg-[#171b27]/40 transition-colors">
                        <td className="py-2.5 pr-4 font-medium text-[#e9edf3] sticky left-0 bg-[#121620] z-10 whitespace-nowrap">
                          {cohort}
                        </td>
                        <td className="py-2.5 px-2 text-right text-[#949dac]">
                          {initialUsers.toLocaleString()}
                        </td>
                        {Array.from({ length: maxOffset + 1 }).map((_, offset) => {
                          const pct = getRetentionPct(cohort, offset);
                          if (pct === null) {
                            return <td key={offset} className="py-2.5 px-2 text-center text-[#22283a]">—</td>;
                          }

                          // Heat coloring: 0% = transparent, 100% = vivid indigo
                          const intensity = pct / 100;
                          const bgColor = pct === 100 ? 'bg-[#6366f1]'
                            : intensity > 0.6 ? 'bg-[#4f46e5]/80'
                            : intensity > 0.3 ? 'bg-[#4f46e5]/50'
                            : intensity > 0 ? 'bg-[#4f46e5]/25'
                            : 'bg-[#22283a]/40';

                          return (
                            <td key={offset} className="py-2.5 px-2 text-right">
                              <div className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${bgColor} ${pct > 0 ? 'text-white' : 'text-[#556374]'}`}>
                                {pct}%
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
