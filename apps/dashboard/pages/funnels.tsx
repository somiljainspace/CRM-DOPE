import React, { useState } from 'react';
import Head from 'next/head';
import { apiFetch, FunnelResponse, FunnelStepResult } from '../lib/api';
import { dateRange } from '../lib/dates';

const STEP_SUGGESTIONS = ['page_viewed', 'product_viewed', 'item_added_to_cart', 'checkout_started', 'order_completed', 'sign_up'];

function computeFunnel(funnel: FunnelStepResult[]) {
  const max = funnel.length ? funnel[0].count : 0;
  return funnel.map((step, i) => {
    const prev = i > 0 ? funnel[i - 1].count : null;
    const rate = max > 0 ? (step.count / max) * 100 : 0;
    const dropOff = prev !== null ? Math.max(0, prev - step.count) : max - step.count;
    const dropOffRate = prev !== null && prev > 0 ? ((prev - step.count) / prev) * 100 : 0;
    return { ...step, rate, dropOff, dropOffRate, conversionFromFirst: rate };
  });
}

export default function FunnelPage() {
  const [workspaceId, setWorkspaceId] = useState('me');
  const [range, setRange] = useState<'7d' | '14d' | '30d'>('30d');
  const [steps, setSteps] = useState<string[]>(['page_viewed', 'item_added_to_cart', 'checkout_started', 'order_completed']);
  const [funnel, setFunnel] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const updateStep = (i: number, v: string) => {
    const next = [...steps];
    next[i] = v;
    setSteps(next);
  };

  const addStep = () => { if (steps.length < 5) setSteps([...steps, '']); };
  const removeStep = (i: number) => { if (steps.length > 2) setSteps(steps.filter((_, idx) => idx !== i)); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    const clean = steps.filter(Boolean);
    if (clean.length < 2 || clean.length > 5) {
      setErr('Funnels must have between 2 and 5 ordered steps.');
      setLoading(false);
      return;
    }
    const r = dateRange(range);
    try {
      const res = await apiFetch<FunnelResponse>('v1/control/analytics/funnels', {
        method: 'POST',
        query: { workspaceId },
        body: { startDate: r.startDate, endDate: r.endDate, steps: clean },
      });
      setFunnel(res);
    } catch (e: unknown) {
      setErr((e as any)?.message || 'Failed to compute funnel');
    } finally {
      setLoading(false);
    }
  }

  const computed = funnel ? computeFunnel(funnel.funnel) : null;

  return (
    <>
      <Head><title>Funnel Explorer — CRM-DOPE</title></Head>
      <main className="max-w-6xl mx-auto px-6 py-8" style={{ fontFamily: 'var(--font-sans)' }}>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Funnel Explorer</h1>
          <p className="text-sm text-ink-muted mt-1">Ordered conversion steps. Conversion window: 7 days (604800 seconds).</p>
        </header>

        <form onSubmit={submit} aria-label="Funnel builder" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 mb-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label htmlFor="ws" className="block text-xs font-medium text-ink-soft mb-1">Workspace</label>
              <input id="ws" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em" placeholder="Workspace ID" />
            </div>
            <div>
              <label htmlFor="r" className="block text-xs font-medium text-ink-soft mb-1">Range</label>
              <select id="r" value={range} onChange={(e) => setRange(e.target.value as '7d' | '14d' | '30d')} className="rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em">
                <option value="7d">Last 7 days</option>
                <option value="14d">Last 14 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink mb-2">Steps ({steps.length}/5)</h3>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="w-6 text-xs font-bold text-ink-muted text-right">{i + 1}.</span>
                  <input
                    list="funnel-suggestions"
                    value={s}
                    onChange={(e) => updateStep(i, e.target.value)}
                    placeholder="Event name (e.g. page_viewed)"
                    className="flex-1 rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-em"
                    aria-label={`Step ${i + 1} event name`}
                  />
                  <button type="button" onClick={() => removeStep(i)} disabled={steps.length <= 2} className="px-2 py-2 text-xs text-red-600 bg-red-50 rounded-lg border border-red-100 disabled:opacity-30 hover:bg-red-100" aria-label={`Remove step ${i + 1}`}>Remove</button>
                </div>
              ))}
            </div>
            <datalist id="funnel-suggestions">
              {STEP_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
            <button type="button" onClick={addStep} disabled={steps.length >= 5} className="mt-3 px-3 py-1.5 text-xs font-medium text-ink-soft bg-paper border border-ink-subtle rounded-lg hover:border-ink-soft disabled:opacity-50">
              + Add step
            </button>
          </div>

          <button type="submit" disabled={loading || steps.filter(Boolean).length < 2} className="rounded-lg bg-ink-strong text-white text-sm font-medium px-4 py-2 hover:bg-ink-soft transition disabled:opacity-50">
            Compute funnel
          </button>
        </form>

        {err && <div role="alert" className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-6 border border-red-100">{err}</div>}

        {computed && (
          <section aria-label="Funnel results" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Funnel results</h2>
            <div className="space-y-4">
              {computed.map((step, i) => (
                <article key={step.level} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{i + 1}. {steps[i]}</span>
                    <span className="text-ink-soft">{step.count.toLocaleString()} users ({step.rate.toFixed(1)}% of first step)</span>
                  </div>
                  <div className="h-2 bg-ink-divider rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(step.rate)} aria-valuemin={0} aria-valuemax={100} aria-label={`Step ${i + 1} conversion: ${step.rate.toFixed(1)}%`}>
                    <div className="h-full bg-em rounded-full transition-all duration-300" style={{ width: `${Math.max(2, Math.min(100, step.rate))}%` }}></div>
                  </div>
                  {i > 0 && (
                    <p className="text-xs text-ink-muted">
                      {step.dropOff.toLocaleString()} dropped off from step {i} ({step.dropOffRate.toFixed(1)}% drop-off)
                    </p>
                  )}
                </article>
              ))}
            </div>
            <aside className="mt-6 pt-4 border-t border-ink-divider text-xs text-ink-muted leading-relaxed">
              <p><strong>How this is calculated:</strong> A user converts through the funnel if they complete each step in order within a 7-day window (604800 seconds). Users are identified by <code className="font-mono">COALESCE(user_id, anonymous_id)</code>. Counts reflect distinct users per step, ordered by time.</p>
            </aside>
          </section>
        )}

        {!computed && !loading && !err && (
          <p className="text-sm text-ink-muted" role="region" aria-label="Empty funnel state">Configure at least 2 steps and compute the funnel to see results.</p>
        )}
      </main>
    </>
  );
}
