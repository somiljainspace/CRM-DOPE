import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { apiFetch, TrendsResponse, EventsResponse, MeResponse, TrendPoint } from '../lib/api';
import { RangeKey, dateRange, RANGE_DAYS, formatBucket } from '../lib/dates';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function OverviewPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [range, setRange] = useState<RangeKey>('7d');
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [events, setEvents] = useState<{ event_id: string; event_name: string; timestamp: string; user_id?: string | null; anonymous_id?: string | null; session_id?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = dateRange(range);
      const [meRes, trendsRes, evRes] = await Promise.all([
        apiFetch<MeResponse>('v1/auth/me'),
        apiFetch<TrendsResponse>('v1/control/analytics/trends', { query: { workspaceId: 'me', startDate: r.startDate, endDate: r.endDate, interval: 'day' } }),
        apiFetch<EventsResponse>('v1/control/analytics/events', { query: { workspaceId: 'me', startDate: r.startDate, endDate: r.endDate, limit: 6, offset: 0 } }),
      ]);
      setMe(meRes);
      setTrends(trendsRes.trends || []);
      setEvents((evRes.events || []).slice(0, 5));
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e) {
        const s = (e as any).status;
        if (s === 401) { window.location.href = '/login'; return; }
        setErr((e as any).message || 'Failed to load analytics');
      } else {
        setErr('Failed to load analytics');
      }
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const totalToday = (() => {
    const today = new Date().toISOString().slice(0, 10);
    return (trends || []).filter(t => t.time_bucket === today).reduce((s, t) => s + t.event_count, 0);
  })();

  return (
    <>
      <Head><title>Overview — CRM-DOPE</title></Head>
      <main className="max-w-6xl mx-auto px-6 py-8" style={{ fontFamily: 'var(--font-sans)' }}>
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">Overview</h1>
            <p className="text-sm text-ink-muted mt-1">First-party event analytics · {me?.user?.email || 'Workspace'}</p>
          </div>
          <div>
            <label htmlFor="range" className="sr-only">Date range</label>
            <select id="range" value={range} onChange={(e) => setRange(e.target.value as RangeKey)} className="rounded-lg border border-ink-subtle bg-canvas text-sm px-3 py-2 text-ink-soft outline-none focus:border-em" aria-label="Select date range">
              {(['today','7d','14d','30d','90d'] as RangeKey[]).map(k => (
                <option key={k} value={k}>{k === 'today' ? 'Today' : `Last ${RANGE_DAYS[k]} days`}</option>
              ))}
            </select>
          </div>
        </header>

        {err && <div role="alert" className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 border border-red-100">{err}</div>}

        <section aria-label="Metric cards" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Events (period)', value: (trends || []).reduce((s, t) => s + (t.event_count || 0), 0), sub: 'Sum over selected range' },
            { label: 'Today', value: totalToday, sub: totalToday ? 'Events today' : 'No events yet today' },
            { label: 'Active events', value: trends.length, sub: 'Distinct buckets' },
            { label: 'Recent events', value: events.length, sub: 'Latest records' },
          ].map((m) => (
            <article key={m.label} className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-5 hover:shadow-md transition-shadow" aria-label={m.label}>
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{m.label}</h3>
              <p className="text-3xl font-bold text-ink mt-2" aria-live="polite">{m.value}</p>
              <p className="text-xs text-ink-muted mt-1">{m.sub}</p>
            </article>
          ))}
        </section>

        <section aria-label="Event trend" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-ink mb-4">Event trend</h2>
          {loading ? <p className="text-sm text-ink-muted">Loading chart…</p> : trends.length === 0 ? (
            <div className="text-sm text-ink-muted" role="region" aria-label="Empty state">
              <p><strong>No events received yet.</strong> Connect your website using the Browser SDK.</p>
              <p className="mt-1">Look for your workspace write key at Settings → API Keys. Configure allowed origins so the SDK can send events.</p>
            </div>
          ) : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} aria-label="Event trend chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time_bucket" tickFormatter={(v: string) => formatBucket(v, 'day').slice(5)} tick={{ fill: "#6b7280" }} />
                  <YAxis tick={{ fill: "#6b7280" }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [`${v} events`, "Count"] as [string, string]}
                    labelFormatter={(v) => `Day: ${formatBucket(String(v), "day")}`}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontFamily: 'var(--font-sans)' }}
                  />
                  <Line type="monotone" dataKey="event_count" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 4, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} name="Events" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section aria-label="Recent events" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold text-ink mb-4">Recent events</h2>
          <table className="w-full text-sm" aria-label="Recent events table">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-muted border-b border-ink-divider">
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Time (UTC)</th>
                <th className="py-2 pr-4">User / Anonymous</th>
                <th className="py-2">Session</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.event_id} className="border-b border-ink-divider last:border-0 hover:bg-paper transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-ink">{e.event_name}</td>
                  <td className="py-2.5 pr-4 text-ink-muted font-mono text-xs">{new Date(e.timestamp).toISOString()}</td>
                  <td className="py-2.5 pr-4 text-ink-soft text-xs">{e.user_id ? `user:${e.user_id.slice(0, 8)}` : `anon:${e.anonymous_id?.slice(0, 8) || '-'}`}</td>
                  <td className="py-2.5 text-ink-muted text-xs font-mono">{e.session_id ? e.session_id.slice(0, 8) : '-'}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-ink-muted text-sm">No events in range. Verify ingestion is active.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
