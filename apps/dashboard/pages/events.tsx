import React, { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import { apiFetch, EventsResponse, ExplorerEvent } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Search, Loader2, Database, Clock, Fingerprint } from 'lucide-react';

export default function Events() {
  const { workspace } = useWorkspace();
  const [events, setEvents] = useState<ExplorerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!workspace) return;

    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      setError('');

      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const query: Record<string, any> = { workspaceId: workspace.id, startDate, endDate, limit: 50 };
      if (searchTerm.trim()) query.eventName = searchTerm.trim();

      apiFetch<EventsResponse>('v1/control/analytics/events', { query })
        .then(res => {
          setEvents(res.events || []);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Failed to load events');
          setLoading(false);
        });
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [workspace, searchTerm]);

  return (
    <AppShell title="Event Explorer" breadcrumb={['Analytics', 'Events']}>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Event Explorer</h1>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-[#5f6a7a]" />
            <input
              placeholder="Search by event name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#121620] border border-[#22283a] rounded-xl pl-9 pr-4 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1] text-[#e9edf3] placeholder-[#5f6a7a] transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-[#121620] border border-[#22283a] rounded-2xl overflow-hidden shadow-lg flex flex-col min-h-[400px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#556374]">
              <Loader2 size={24} className="animate-spin mb-3 text-[#6366f1]" />
              <p className="text-sm">Querying events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#556374] p-12">
              <Database size={32} className="mb-4 opacity-50" />
              <p className="text-sm">No events found in the last 7 days.</p>
              {searchTerm && <p className="text-xs mt-1">Try clearing your search filter.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-[#171b27] text-xs uppercase tracking-wider text-[#5f6a7a] border-b border-[#22283a]">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Event Name</th>
                    <th className="px-5 py-3.5 font-semibold">User</th>
                    <th className="px-5 py-3.5 font-semibold">Properties</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22283a]">
                  {events.map((e) => (
                    <tr key={e.event_id} className="hover:bg-[#1a2029] transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${e.event_type === 'screen' ? 'bg-[#06b6d4]' : 'bg-[#818cf8]'}`} />
                          <span className="font-mono text-[13px] bg-[#0a0d13] border border-[#22283a] px-2 py-0.5 rounded-md text-[#e9edf3]">
                            {e.event_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 text-[#949dac]">
                          <Fingerprint size={14} className="opacity-70" />
                          <span className="truncate max-w-[150px] font-mono text-xs" title={e.user_id || e.anonymous_id || 'Unknown'}>
                            {e.user_id ? e.user_id : (e.anonymous_id ? `anon:${e.anonymous_id.substring(0, 8)}...` : 'Unknown')}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-xs text-[#5f6a7a] font-mono truncate max-w-[200px]">
                          {e.properties && Object.keys(e.properties).length > 0
                            ? Object.entries(e.properties).map(([k,v]) => `${k}:${v}`).join(', ')
                            : '—'}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-[#5f6a7a]">
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock size={12} />
                          <time dateTime={e.timestamp}>{new Date(e.timestamp).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}</time>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
