import React, { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import { apiFetch, TrendsResponse, TrendPoint } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, Activity } from 'lucide-react';

export default function Trends() {
  const { workspace } = useWorkspace();
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<'day' | 'hour'>('day');
  const [error, setError] = useState('');
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    if (!workspace) return;

    setLoading(true);
    setError('');

    const endDate = new Date().toISOString();
    // The analytics API supports hourly and daily buckets.
    const startMs = interval === 'hour' ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;

    const startDate = new Date(Date.now() - startMs).toISOString();

    const query: Record<string, any> = { workspaceId: workspace.id, startDate, endDate, interval };
    if (eventName.trim()) query.eventName = eventName.trim();

    apiFetch<TrendsResponse>('v1/control/analytics/trends', { query })
      .then(res => {
        if (res.trends) {
          setTrends(res.trends.map((t: TrendPoint) => ({
            date: new Date(t.time_bucket).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: interval !== 'day' ? 'numeric' : undefined,
              minute: interval === 'hour' ? '2-digit' : undefined
            }),
            events: t.event_count
          })));
        } else {
          setTrends([]);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load trends');
        setLoading(false);
      });

  }, [workspace, interval, eventName]);

  return (
    <AppShell title="Trends" breadcrumb={['Analytics', 'Trends']}>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight">Event Trends</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              placeholder="Filter by event name (optional)..."
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="bg-[#121620] border border-[#22283a] rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1] text-[#e9edf3] placeholder-[#5f6a7a] transition-all min-w-[240px]"
            />
            <div className="flex p-1 bg-[#121620] border border-[#22283a] rounded-xl self-start">
              {(['hour', 'day'] as const).map(inv => (
                <button
                  key={inv}
                  onClick={() => setInterval(inv)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors capitalize ${interval === inv ? 'bg-[#22283a] text-[#e9edf3]' : 'text-[#5f6a7a] hover:text-[#949dac]'}`}
                >
                  {inv}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-[#121620] border border-[#22283a] rounded-2xl p-6 shadow-lg h-[500px] flex flex-col">
          <div className="text-sm font-semibold mb-6 flex items-center justify-between">
            <span className="text-[#e9edf3]">Event volume over time ({interval === 'day' ? 'Last 30 Days' : 'Last 24 Hours'})</span>
            {eventName && <span className="text-xs bg-[#22283a] text-[#e9edf3] px-2 py-1 rounded font-mono border border-[#444c68]">event: {eventName}</span>}
          </div>

          <div className="flex-1 min-h-0 relative">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#556374]">
                <Loader2 size={32} className="animate-spin mb-4 text-[#6366f1]" />
                <p className="text-sm">Calculating trends...</p>
              </div>
            ) : trends.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#556374] bg-[#0a0d13] border border-dashed border-[#22283a] rounded-xl mt-4 max-h-[80%] my-auto">
                <Activity size={32} className="mb-4 opacity-50" />
                <p className="text-sm">No trend data available for this selection.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTrends" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#22283a" />
                  <XAxis dataKey="date" stroke="#5f6a7a" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                  <YAxis stroke="#5f6a7a" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#141921', borderColor: '#22283a', borderRadius: '12px', color: '#e9edf3', fontSize: '13px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#8b5cf6', fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="events" name="events" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorTrends)" activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#121620', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
