import { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import { apiFetch, TrendPoint } from '../lib/api';
import { RangeKey, dateRange } from '../lib/dates';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const EVENT_SUGGESTIONS = ['page_viewed', 'product_viewed', 'item_added_to_cart', 'checkout_started', 'order_completed', 'sign_up', 'search_performed'];

export default function TrendsPage() {
  const [workspaceId, setWorkspaceId] = useState('me');
  const [range, setRange] = useState<RangeKey>('7d');
  const [interval, setInterval] = useState<'hour' | 'day'>('day');
  const [eventName, setEventName] = useState('');
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const r = dateRange(range);
      const data = await apiFetch<{ trends: TrendPoint[] }>('v1/control/analytics/trends', {
        query: { workspaceId, startDate: r.startDate, endDate: r.endDate, interval, eventName: eventName || undefined },
        signal: abortRef.current.signal,
      });
      setTrends(data.trends || []);
    } catch (e: unknown) {
      if ((e as any)?.name === 'AbortError') return;
      setErr((e as any)?.message || 'Failed to load trends');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, range, interval, eventName]);

  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  return (
    <>
      <Head><title>Event Trends — CRM-DOPE</title></Head>
      <main className="max-w-6xl mx-auto px-6 py-8" style={{ fontFamily: 'var(--font-sans)' }}>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Event Trends</h1>
          <p className="text-sm text-ink-muted mt-1">Bounded queries over first-party events. All timestamps are UTC.</p>
        </header>

        <section aria-label="Trend filters" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="ws" className="block text-xs font-medium text-ink-soft mb-1">Workspace</label>
            <input id="ws" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em" placeholder="Workspace ID" />
          </div>
          <div>
            <label htmlFor="r" className="block text-xs font-medium text-ink-soft mb-1">Range</label>
            <select id="r" value={range} onChange={(e) => setRange(e.target.value as RangeKey)} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em">
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <div>
            <label htmlFor="i" className="block text-xs font-medium text-ink-soft mb-1">Bucket</label>
            <select id="i" value={interval} onChange={(e) => setInterval(e.target.value as 'hour' | 'day')} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em">
              <option value="hour">Hourly</option>
              <option value="day">Daily</option>
            </select>
          </div>
          <div>
            <label htmlFor="ev" className="block text-xs font-medium text-ink-soft mb-1">Event name (optional)</label>
            <input id="ev" list="event-suggestions" value={eventName} onChange={(e) => setEventName(e.target.value)} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em" placeholder="All events" />
            <datalist id="event-suggestions">
              {EVENT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <button type="button" onClick={load} className="rounded-lg bg-ink-strong text-white text-sm font-medium px-4 py-2 hover:bg-ink-soft transition disabled:opacity-50" disabled={loading}>Apply</button>
        </section>

        {err && <div role="alert" className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 border border-red-100">{err}</div>}

        <section aria-label="Trend chart" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Trend {eventName ? `· ${eventName}` : '· all events'}</h2>
          {loading ? <p className="text-sm text-ink-muted">Loading…</p> : trends.length === 0 ? (
            <p className="text-sm text-ink-muted" role="region" aria-label="Empty trend state">No events match this range and filter. Try a wider range or a different event name.</p>
          ) : (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} aria-label="Event trend chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time_bucket" tickFormatter={(v: string) => interval === 'hour' ? v.slice(11, 16) : v.slice(5)} tick={{ fill: "#6b7280" }} />
                  <YAxis tick={{ fill: "#6b7280" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontFamily: 'var(--font-sans)' }} formatter={(v) => [`${v} events`, "Count"] as [string, string]} />
                  <Line type="monotone" dataKey="event_count" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 4, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }} name="Events" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section aria-label="Trend data table" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold text-ink mb-4">Data table (accessible alternative)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ink-muted border-b border-ink-divider">
                <th className="py-2 pr-4">Time bucket (UTC)</th>
                <th className="py-2">Event count</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t, i) => (
                <tr key={`${t.time_bucket}-${i}`} className="border-b border-ink-divider last:border-0 hover:bg-paper">
                  <td className="py-2 pr-4 font-mono text-xs text-ink-soft">{t.time_bucket}{interval === 'hour' ? '' : ' 00:00'}</td>
                  <td className="py-2 text-ink">{t.event_count}</td>
                </tr>
              ))}
              {trends.length === 0 && (
                <tr><td colSpan={2} className="py-4 text-ink-muted text-sm">No data in the selected range.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
