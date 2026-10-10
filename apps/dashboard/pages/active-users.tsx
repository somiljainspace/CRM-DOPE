import { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import { apiFetch, ActiveUserPoint } from '../lib/api';
import { RangeKey, dateRange } from '../lib/dates';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ActiveUsersPage() {
  const [workspaceId, setWorkspaceId] = useState('me');
  const [range, setRange] = useState<RangeKey>('30d');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [series, setSeries] = useState<ActiveUserPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const r = dateRange(range);
      const data = await apiFetch<{ activeUsers: ActiveUserPoint[] }>('v1/control/analytics/active-users', {
        query: { workspaceId, startDate: r.startDate, endDate: r.endDate, period },
        signal: abortRef.current.signal,
      });
      setSeries(data.activeUsers || []);
    } catch (e: unknown) {
      if ((e as any)?.name === 'AbortError') return;
      setErr((e as any)?.message || 'Failed to load active users');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, range, period]);

  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  const latest = series.length ? series[series.length - 1].unique_users : 0;

  return (
    <>
      <Head><title>Active Users — CRM-DOPE</title></Head>
      <main className="max-w-6xl mx-auto px-6 py-8" style={{ fontFamily: 'var(--font-sans)' }}>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Active Users</h1>
          <p className="text-sm text-ink-muted mt-1">
            Counts distinct <code className="font-mono text-xs bg-ink-divider px-1.5 py-0.5 rounded">COALESCE(user_id, anonymous_id)</code> keys — not verified people.
          </p>
        </header>

        <section aria-label="Active user filters" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="ws" className="block text-xs font-medium text-ink-soft mb-1">Workspace</label>
            <input id="ws" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em" placeholder="Workspace ID" />
          </div>
          <div>
            <label htmlFor="r" className="block text-xs font-medium text-ink-soft mb-1">Range</label>
            <select id="r" value={range} onChange={(e) => setRange(e.target.value as RangeKey)} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em">
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <div>
            <label htmlFor="p" className="block text-xs font-medium text-ink-soft mb-1">Period</label>
            <select id="p" value={period} onChange={(e) => setPeriod(e.target.value as 'day' | 'week' | 'month')} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em">
              <option value="day">Daily (DAU)</option>
              <option value="week">Weekly (WAU)</option>
              <option value="month">Monthly (MAU)</option>
            </select>
          </div>
          <button type="button" onClick={load} className="rounded-lg bg-ink-strong text-white text-sm font-medium px-4 py-2 hover:bg-ink-soft transition disabled:opacity-50" disabled={loading}>Apply</button>
        </section>

        {err && <div role="alert" className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 border border-red-100">{err}</div>}

        <section aria-label="Active user summary" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: `Latest ${period === 'day' ? 'DAU' : period === 'week' ? 'WAU' : 'MAU'}`, value: latest, sub: `Most recent ${period} bucket` },
            { label: 'Buckets', value: series.length, sub: 'Data points' },
            { label: 'Max in period', value: series.reduce((m, p) => Math.max(m, p.unique_users), 0), sub: 'Peak bucket' },
            { label: 'Min in period', value: series.reduce((m, p) => (m === 0 ? p.unique_users : Math.min(m, p.unique_users)), 0), sub: 'Lowest bucket' },
          ].map((m) => (
            <article key={m.label} className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-5" aria-label={m.label}>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{m.label}</h3>
              <p className="text-3xl font-bold text-ink mt-2">{m.value}</p>
              <p className="text-xs text-ink-muted mt-1">{m.sub}</p>
            </article>
          ))}
        </section>

        <section aria-label="Active user chart" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">
            {period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'} active users
          </h2>
          {loading ? <p className="text-sm text-ink-muted">Loading…</p> : series.length === 0 ? (
            <p className="text-sm text-ink-muted" role="region" aria-label="Empty state">No active users in range. Events may not be flowing yet — connect the Browser SDK.</p>
          ) : (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} aria-label="Active users chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time_bucket" tickFormatter={(v: string) => v.slice(5)} fontSize={12} tick={{ fill: '#6b7280' }} />
                  <YAxis fontSize={12} tick={{ fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontFamily: 'var(--font-sans)' }} formatter={(v: number) => [`${v} identities`, 'Active']} />
                  <Line type="monotone" dataKey="unique_users" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 4, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }} name="Active identities" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <aside className="rounded-2xl bg-ink-divider/50 border border-ink-divider p-4 text-sm text-ink-soft" aria-label="Identity semantics note">
          <h2 className="text-sm font-semibold text-ink mb-1">How this is counted</h2>
          <p className="text-xs leading-relaxed text-ink-muted">
            Active users = distinct <code className="font-mono">COALESCE(user_id, anonymous_id)</code> per bucket.
            This counts unique device/identity keys, not verified people: one person on two devices counts twice,
            and events sent before a user signs in keep their anonymous key. Do not quote these numbers as exact unique-person counts.
          </p>
        </aside>
      </main>
    </>
  );
}
