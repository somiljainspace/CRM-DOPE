import React, { useEffect, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { apiFetch, ActiveUsersResponse, TrendsResponse } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Activity, Users, Layers, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Overview() {
  const { workspace } = useWorkspace();
  const [metrics, setMetrics] = useState({
    dau: '...',
    events24h: '...',
    segments: '...',
    activations: '...'
  });
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace) return;

    // Default dates for the requested payload
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    setLoading(true);

    Promise.all([
      // Load active users
      apiFetch<ActiveUsersResponse>('v1/control/analytics/active-users', {
        query: { workspaceId: workspace.id, startDate, endDate, period: 'day' }
      }).catch(() => null),
      // Load event trends
      apiFetch<TrendsResponse>('v1/control/analytics/trends', {
        query: { workspaceId: workspace.id, startDate, endDate, interval: 'day' }
      }).catch(() => null),
      // Load segments count
      apiFetch<{ pagination?: { total: number } }>('v1/control/segments', {
        query: { workspaceId: workspace.id, limit: 1 }
      }).catch(() => null)
    ]).then(([usersRes, trendsRes, segsRes]) => {
      let dau = '0';
      if (usersRes?.activeUsers && usersRes.activeUsers.length > 0) {
        dau = usersRes.activeUsers[usersRes.activeUsers.length - 1].unique_users.toLocaleString();
      }

      let events24h = 0;
      let chartData: any[] = [];
      if (trendsRes?.trends) {
        if (trendsRes.trends.length > 0) {
          events24h = trendsRes.trends[trendsRes.trends.length - 1].event_count;
        }
        chartData = trendsRes.trends.map(t => ({
          date: new Date(t.time_bucket).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          events: t.event_count
        }));
      }

      setMetrics({
        dau,
        events24h: events24h.toLocaleString(),
        segments: segsRes?.pagination?.total?.toLocaleString() || '0',
        activations: '...' // Placeholder as real activation count isn't in generic analytics API yet
      });
      setTrends(chartData);
      setLoading(false);
    });
  }, [workspace]);

  return (
    <AppShell title="Overview" breadcrumb={['Dashboard']}>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight mb-8">Good morning</h1>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Users (DAU)', value: metrics.dau, icon: Users, color: 'from-[#6366f1] to-[#818cf8]' },
            { label: 'Events (24h)', value: metrics.events24h, icon: Activity, color: 'from-[#06b6d4] to-[#22d3ee]' },
            { label: 'Segments', value: metrics.segments, icon: Layers, color: 'from-[#8b5cf6] to-[#a78bfa]' },
            { label: 'Activations', value: metrics.activations, icon: Zap, color: 'from-[#f59e0b] to-[#fbbf24]' },
          ].map((m, i) => (
            <div key={m.label} className="bg-[#121620] border border-[#22283a] rounded-2xl p-5 shadow-lg relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${m.color} opacity-5 rounded-full blur-2xl transform group-hover:scale-150 transition-transform duration-500`} />
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-[#171b27] text-[#949dac]">
                  <m.icon size={16} />
                </div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6a7a]">{m.label}</div>
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-[#e9edf3]">
                {loading && metrics.dau === '...' ? (
                  <div className="h-9 w-20 bg-[#171b27] animate-pulse rounded" />
                ) : m.value}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#121620] border border-[#22283a] rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-[#e9edf3]">Event volume (7 days)</h2>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-[#949dac]">
                <div className="w-2 h-2 rounded-full bg-[#6366f1]" />
                All events
              </span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#22283a" />
                  <XAxis dataKey="date" stroke="#5f6a7a" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#5f6a7a" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#141921', borderColor: '#22283a', borderRadius: '12px', color: '#e9edf3', fontSize: '13px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#818cf8', fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="events" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorEvents)" activeDot={{ r: 6, fill: '#818cf8', stroke: '#121620', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#556374] text-sm bg-[#0a0d13] rounded-xl border border-dashed border-[#22283a]">
                <Activity size={24} className="mb-2 opacity-50" />
                <p>No event data in this workspace</p>
                {!workspace && <p className="text-xs mt-1">Please select a workspace</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}