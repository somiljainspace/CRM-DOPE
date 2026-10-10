import { useEffect, useRef, useState, useCallback, Fragment } from 'react';
import Head from 'next/head';
import { apiFetch, ExplorerEvent, EventsResponse } from '../lib/api';
import { RangeKey, dateRange } from '../lib/dates';

export default function EventExplorerPage() {
  const [workspaceId, setWorkspaceId] = useState('me');
  const [range, setRange] = useState<RangeKey>('7d');
  const [eventName, setEventName] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [data, setData] = useState<EventsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const r = dateRange(range);
      const res = await apiFetch<EventsResponse>('v1/control/analytics/events', {
        query: { workspaceId, startDate: r.startDate, endDate: r.endDate, eventName: eventName || undefined, limit, offset: page * limit },
        signal: abortRef.current.signal,
      });
      setData(res);
    } catch (e: unknown) {
      if ((e as any)?.name === 'AbortError') return;
      setErr((e as any)?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, range, eventName, page]);

  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  const toggleRow = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  return (
    <>
      <Head><title>Event Explorer — CRM-DOPE</title></Head>
      <main className="max-w-6xl mx-auto px-6 py-8" style={{ fontFamily: 'var(--font-sans)' }}>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Event Explorer</h1>
          <p className="text-sm text-ink-muted mt-1">Raw events ordered by timestamp. Uses replacing merge tree (events may take seconds to dedup).</p>
        </header>

        <section aria-label="Event filters" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="ws" className="block text-xs font-medium text-ink-soft mb-1">Workspace</label>
            <input id="ws" value={workspaceId} onChange={(e) => { setWorkspaceId(e.target.value); setPage(0); }} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em" placeholder="Workspace ID" />
          </div>
          <div>
            <label htmlFor="r" className="block text-xs font-medium text-ink-soft mb-1">Range</label>
            <select id="r" value={range} onChange={(e) => { setRange(e.target.value as RangeKey); setPage(0); }} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em">
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
          <div>
            <label htmlFor="ev" className="block text-xs font-medium text-ink-soft mb-1">Event name (optional)</label>
            <input id="ev" value={eventName} onChange={(e) => { setEventName(e.target.value); setPage(0); }} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em" placeholder="All events" />
          </div>
          <button type="button" onClick={load} className="rounded-lg bg-ink-strong text-white text-sm font-medium px-4 py-2 hover:bg-ink-soft transition disabled:opacity-50" disabled={loading}>Apply</button>
        </section>

        {err && <div role="alert" className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 border border-red-100">{err}</div>}

        <section aria-label="Event logs" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-ink-divider flex items-center justify-between bg-paper">
            <h2 className="text-sm font-semibold text-ink">Events</h2>
            <div className="flex items-center gap-3 text-xs">
               <span className="text-ink-muted">Page {page + 1}</span>
               <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0 || loading} className="px-2 py-1 bg-canvas border border-ink-subtle rounded disabled:opacity-50 text-ink-soft hover:border-ink-soft">Prev</button>
               <button onClick={() => setPage(page + 1)} disabled={!data || data.events.length < limit || loading} className="px-2 py-1 bg-canvas border border-ink-subtle rounded disabled:opacity-50 text-ink-soft hover:border-ink-soft">Next</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-ink-muted border-b border-ink-divider bg-canvas">
                  <th className="py-2.5 pl-6 pr-4 w-8"></th>
                  <th className="py-2.5 pr-4">Time (UTC)</th>
                  <th className="py-2.5 pr-4">Event</th>
                  <th className="py-2.5 pr-4">Identity</th>
                  <th className="py-2.5 pr-6">Session ID</th>
                </tr>
              </thead>
              <tbody className="bg-canvas">
                {loading && !data?.events?.length && (
                  <tr><td colSpan={5} className="py-6 text-center text-ink-muted text-sm">Loading events…</td></tr>
                )}
                {!loading && data?.events?.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-ink-muted text-sm">No events found. Verify ingestion or adjust filters.</td></tr>
                )}
                {data?.events?.map((e) => {
                  const isExp = expanded.has(e.event_id);
                  return (
                    <Fragment key={e.event_id}>
                      <tr className={`border-b border-ink-divider/50 hover:bg-paper cursor-pointer transition-colors ${isExp ? 'bg-paper' : ''}`} onClick={() => toggleRow(e.event_id)}>
                        <td className="py-2.5 pl-6 pr-4 text-ink-muted select-none">{isExp ? '▼' : '▶'}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-ink-soft">{new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 23)}</td>
                        <td className="py-2.5 pr-4 font-medium text-ink">{e.event_name}</td>
                        <td className="py-2.5 pr-4 text-xs font-mono text-ink-soft">
                          {e.user_id ? <span className="text-em">u:{e.user_id.slice(0,8)}</span> : `a:${e.anonymous_id?.slice(0,8) || '-'}`}
                        </td>
                        <td className="py-2.5 pr-6 text-xs font-mono text-ink-muted">{e.session_id ? e.session_id.slice(0, 8) : '-'}</td>
                      </tr>
                      {isExp && (
                        <tr className="border-b border-ink-divider bg-ink-divider/30">
                          <td colSpan={5} className="pl-14 pr-6 py-4">
                            <div className="grid grid-cols-2 gap-8 text-xs font-mono">
                              <div>
                                <h4 className="font-semibold text-ink-soft mb-2 uppercase tracking-wide text-[10px]">Event Properties</h4>
                                <pre className="text-ink whitespace-pre-wrap word-break bg-canvas p-3 rounded-lg border border-ink-subtle/50">
                                  {JSON.stringify(e.properties || {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <h4 className="font-semibold text-ink-soft mb-2 uppercase tracking-wide text-[10px]">Record Context</h4>
                                <ul className="space-y-1 text-ink-muted">
                                  <li><span className="text-ink-soft">Event ID:</span> {e.event_id}</li>
                                  <li><span className="text-ink-soft">Type:</span> {e.event_type}</li>
                                  {e.user_id && <li><span className="text-ink-soft">User ID:</span> {e.user_id}</li>}
                                  {e.anonymous_id && <li><span className="text-ink-soft">Anon ID:</span> {e.anonymous_id}</li>}
                                  {e.session_id && <li><span className="text-ink-soft">Session ID:</span> {e.session_id}</li>}
                                </ul>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
