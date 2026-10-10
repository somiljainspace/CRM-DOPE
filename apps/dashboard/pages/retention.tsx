import { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import { apiFetch, RetentionResponse } from '../lib/api';
import { dateRange } from '../lib/dates';

export default function RetentionPage() {
  const [workspaceId, setWorkspaceId] = useState('me');
  const [range, setRange] = useState<'7d' | '30d'>('30d');
  const [entryEvent, setEntryEvent] = useState('page_viewed');
  const [returningEvent, setReturningEvent] = useState('page_viewed');
  const [rows, setRows] = useState<{ cohort_date: string; day_offset: number; users_count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const r = dateRange(range);
      const res = await apiFetch<RetentionResponse>('v1/control/analytics/retention', {
        method: 'POST',
        query: { workspaceId },
        body: { startDate: r.startDate, endDate: r.endDate, entryEvent, returningEvent },
        signal: abortRef.current.signal,
      });
      setRows(res.retention || []);
    } catch (e: unknown) {
      if ((e as any)?.name === 'AbortError') return;
      setErr((e as any)?.message || 'Failed to load retention');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, range, entryEvent, returningEvent]);

  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  // Build matrix groups by cohort_date.
  const groups: Record<string, { day_offset: number; users_count: number }[]> = {};
  rows.forEach((r) => {
    if (!groups[r.cohort_date]) groups[r.cohort_date] = [];
    groups[r.cohort_date].push({ day_offset: r.day_offset, users_count: r.users_count });
  });
  const dates = Object.keys(groups).sort();
  const maxDay = Math.max(0, ...Object.values(groups).flatMap((arr) => arr.map((a) => a.day_offset)));

  return (
    <>
      <Head><title>Retention — CRM-DOPE</title></Head>
      <main className="max-w-6xl mx-auto px-6 py-8" style={{ fontFamily: 'var(--font-sans)' }}>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Retention Explorer</h1>
          <p className="text-sm text-ink-muted mt-1">Daily cohorts by entry event. Retention % = returning users / cohort size.</p>
        </header>

        <section aria-label="Retention filters" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="ws" className="block text-xs font-medium text-ink-soft mb-1">Workspace</label>
            <input id="ws" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em" placeholder="Workspace ID" />
          </div>
          <div>
            <label htmlFor="r" className="block text-xs font-medium text-ink-soft mb-1">Range</label>
            <select id="r" value={range} onChange={(e) => setRange(e.target.value as '7d' | '30d')} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
          <div>
            <label htmlFor="entry" className="block text-xs font-medium text-ink-soft mb-1">Entry event</label>
            <input id="entry" value={entryEvent} onChange={(e) => setEntryEvent(e.target.value)} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em" placeholder="Event name" />
          </div>
          <div>
            <label htmlFor="ret" className="block text-xs font-medium text-ink-soft mb-1">Returning event</label>
            <input id="ret" value={returningEvent} onChange={(e) => setReturningEvent(e.target.value)} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em" placeholder="Event name" />
          </div>
          <button onClick={load} disabled={loading} className="rounded-lg bg-ink-strong text-white text-sm font-medium px-4 py-2 hover:bg-ink-soft transition disabled:opacity-50">Apply</button>
        </section>

        {err && <div role="alert" className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 border border-red-100">{err}</div>}

        <aside className="rounded-2xl bg-ink-divider/50 border border-ink-divider p-4 text-xs text-ink-soft mb-6 leading-relaxed" aria-label="Retention definition">
          <h2 className="text-sm font-semibold text-ink mb-1">How retention is defined</h2>
          <p>A cohort = users whose first event in the range matched the entry event, grouped by date (cohort_date). A user is counted as retained on day N if they performed the returning event on cohort_date + N. Because identity reconciliation has limits (historical anonymous events before login keep their anonymous key), cohort counts reflect reconstructed keys, not guaranteed unique people. Do not quote retention percentages as exact population-level retention.</p>
        </aside>

        {loading ? <p className="text-sm text-ink-muted">Loading retention matrix…</p> : rows.length === 0 ? (
          <p className="text-sm text-ink-muted" role="region" aria-label="Empty retention">No retention data for the selected events. Try widening the range or changing the entry/returning events.</p>
        ) : (
          <section aria-label="Retention matrix" className="overflow-x-auto rounded-2xl bg-canvas border border-ink-divider shadow-sm">
            <table className="w-full text-sm" aria-label="Retention table">
              <thead>
                <tr className="text-xs font-semibold text-ink-muted border-b border-ink-divider bg-paper">
                  <th className="py-2 px-3 text-left">Cohort date (UTC)</th>
                  <th className="py-2 px-3 text-left">Cohort size</th>
                  {Array.from({ length: Math.min(maxDay + 1, 8) }, (_, d) => (
                    <th key={d} className="py-2 px-2 text-center">Day {d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((d) => {
                  const map = new Map<number, number>();
                  groups[d].forEach((item) => map.set(item.day_offset, item.users_count));
                  const cohortSize = map.get(0) || 0;
                  return (
                    <tr key={d} className="border-b border-ink-divider/50 hover:bg-paper">
                      <td className="py-2 px-3 font-mono text-xs text-ink-soft">{d}</td>
                      <td className="py-2 px-3 text-xs text-ink font-medium">{cohortSize.toLocaleString()}</td>
                      {Array.from({ length: Math.min(maxDay + 1, 8) }, (_, day) => {
                        const users = map.get(day) || 0;
                        const pct = cohortSize > 0 ? ((users / cohortSize) * 100).toFixed(0) : '0';
                        return (
                          <td key={day} className="py-2 px-2 text-center text-xs">
                            <span className={`inline-block rounded-md px-2 py-0.5 ${pct === '100' ? 'bg-em-soft text-em font-medium' : pct === '0' ? 'text-ink-muted' : 'text-ink-soft'}`} aria-label={`Day ${day}: ${users} users (${pct}%)`}>
                              {pct}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {dates.length === 0 && (
                  <tr><td colSpan={10} className="py-6 text-sm text-ink-muted">No cohorts found.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </>
  );
}
