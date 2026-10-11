import React, { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import { apiFetch, ActiveUsersResponse, ActiveUserPoint } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, Users, UserCheck, UserPlus } from 'lucide-react';

export default function ActiveUsers() {
  const { workspace } = useWorkspace();
  const [activeData, setActiveData] = useState<any[]>([]);
  const [dau, setDau] = useState<number | null>(null);
  const [wau, setWau] = useState<number | null>(null);
  const [mau, setMau] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!workspace) return;

    setLoading(true);
    setError('');

    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const query = { workspaceId: workspace.id, startDate, endDate, period };

    apiFetch<ActiveUsersResponse>('v1/control/analytics/active-users', { query })
      .then(res => {
        const points = res.activeUsers || [];

        if (points.length > 0) {
          const last = points[points.length - 1];
          setDau(last.unique_users);
        } else {
          setDau(0);
        }

        // WAU/MAU approximation: max over the 7-day / 30-day rolling window from response
        const weekPoints = points.slice(-7);
        const monthPoints = points.slice(-30);
        setWau(weekPoints.length > 0 ? Math.max(...weekPoints.map(p => p.unique_users)) : null);
        setMau(monthPoints.length > 0 ? Math.max(...monthPoints.map(p => p.unique_users)) : null);

        setActiveData(points.map(p => ({
          date: new Date(p.time_bucket).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          users: p.unique_users
        })));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load active users');
        setLoading(false);
      });
  }, [workspace, period]);

  const formatVal = (val: number | null) => val === null ? '—' : val.toLocaleString();

  return (
    <AppShell title="Active Users" breadcrumb={['Analytics', 'Active Users']}>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight">Active Users</h1>
          <div className="flex p-1 bg-[#121620] border border-[#22283a] rounded-xl self-start">
            {(['day', 'week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors capitalize ${period === p ? 'bg-[#22283a] text-[#e9edf3]' : 'text-[#5f6a7a] hover:text-[#949dac]'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Daily Active Users', value: formatVal(dau), icon: Users, color: 'from-[#6366f1] to-[#818cf8]' },
            { label: 'Weekly Active Users', value: formatVal(wau), icon: UserCheck, color: 'from-[#8b5cf6] to-[#a78bfa]' },
            { label: 'Monthly Active Users', value: formatVal(mau), icon: UserPlus, color: 'from-[#06b6d4] to-[#22d3ee]' },
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
                {loading ? <div className="h-9 w-20 bg-[#171b27] animate-pulse rounded" /> : m.value}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#121620] border border-[#22283a] rounded-2xl p-6 shadow-lg h-[400px] flex flex-col">
          <div className="text-sm font-semibold mb-6 flex items-center justify-between">
            <span className="text-[#e9edf3]">Active users over time ({period === 'day' ? 'Last 30 Days (DAU)' : period === 'week' ? 'Last 4 Weeks (WAU)' : 'Last 12 Months (MAU)'})</span>
            <span className="flex items-center gap-1.5 text-xs text-[#949dac]">
              <div className="w-2 h-2 rounded-full bg-[#6366f1]" />
              Unique users
            </span>
          </div>

          <div className="flex-1 min-h-0 relative">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#556374]">
                <Loader2 size={32} className="animate-spin mb-4 text-[#6366f1]" />
                <p className="text-sm">Loading user activity...</p>
              </div>
            ) : activeData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#556374] bg-[#0a0d13] border border-dashed border-[#22283a] rounded-xl">
                <Users size={32} className="mb-4 opacity-50" />
                <p className="text-sm">No active user data in this workspace.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#22283a" />
                  <XAxis dataKey="date" stroke="#5f6a7a" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                  <YAxis stroke="#5f6a7a" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#141921', borderColor: '#22283a', borderRadius: '12px', color: '#e9edf3', fontSize: '13px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#818cf8', fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="users" name="Active users" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" activeDot={{ r: 6, fill: '#818cf8', stroke: '#121620', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
