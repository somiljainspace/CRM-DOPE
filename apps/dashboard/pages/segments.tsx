import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { apiFetch } from '../lib/api';

type Condition = {
  kind: 'profile_trait' | 'event_occurrence' | 'event_count' | 'recency';
  [k: string]: unknown;
};

export default function SegmentsPage() {
  const [name, setName] = useState('');
  const [op, setOp] = useState<'AND' | 'OR'>('AND');
  const [conds, setConds] = useState<Condition[]>([
    { kind: 'profile_trait', field: 'plan', operator: 'equals', value: '' },
  ]);
  const [segments, setSegs] = useState<any[]>([]);
  const router = useRouter();
  const workspaceId = (router.query.workspaceId as string | undefined) || '';
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ segments?: any[] }>('v1/control/segments', {
        query: { workspaceId: workspaceId || undefined, limit: 10 },
      });
      setSegs(res.segments || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load segments');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const def = () => ({
    definition_version: 1 as const,
    operator: op,
    conditions: conds.map((c) => ({ ...c })),
  });

  const addCondition = (kind: Condition['kind']) => {
    const base: Condition = { kind };
    if (kind === 'profile_trait') {
      (base as any).field = 'plan';
      (base as any).operator = 'equals';
      (base as any).value = '';
    } else if (kind === 'event_occurrence') {
      (base as any).event_name = 'purchase';
      (base as any).performed = true;
      (base as any).window_days = 30;
    } else if (kind === 'event_count') {
      (base as any).event_name = 'purchase';
      (base as any).count_operator = 'at_least';
      (base as any).count = 1;
      (base as any).window_days = 30;
    } else if (kind === 'recency') {
      (base as any).type = 'active_within';
      (base as any).days = 7;
    }
    setConds([...conds, base]);
  };

  const updateCondition = (i: number, updates: Partial<Condition>) => {
    const next = [...conds];
    next[i] = { ...next[i], ...updates };
    setConds(next);
  };

  const removeCondition = (i: number) => setConds(conds.filter((_, idx) => idx !== i));

  return (
    <>
      <Head><title>Segments — CRM-DOPE</title></Head>
      <main className="max-w-6xl mx-auto px-6 py-8" style={{ fontFamily: 'var(--font-sans)' }}>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Segments</h1>

        <section aria-label="Builder" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Build segment</h2>
          <label htmlFor="seg-name" className="block text-xs font-medium text-ink-soft mb-1">Name</label>
          <input id="seg-name" value={name} onChange={e => setName(e.target.value)} maxLength={255} className="w-full rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm mb-3" placeholder="Segment name" />

          <div className="flex gap-2 mb-3">
            <button onClick={() => setOp('AND')} className={`px-2 py-1 rounded text-xs font-medium ${op === 'AND' ? 'bg-em text-white' : 'bg-paper border border-ink-subtle'}`}>AND</button>
            <button onClick={() => setOp('OR')} className={`px-2 py-1 rounded text-xs font-medium ${op === 'OR' ? 'bg-em text-white' : 'bg-paper border border-ink-subtle'}`}>OR</button>
          </div>

          <div className="space-y-2 mb-3">
            {conds.map((c, i) => (
              <div key={i} className="rounded-lg bg-paper border border-ink-subtle p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{String(c.kind)}</span>
                  <button onClick={() => removeCondition(i)} className="text-xs text-red-600 hover:underline">Remove</button>
                </div>
                {c.kind === 'profile_trait' && (
                  <div className="grid grid-cols-3 gap-2">
                    <select value={String((c as any).field || 'plan')} onChange={e => updateCondition(i, { field: e.target.value })} className="text-xs rounded border px-2 py-1 bg-canvas">
                      {['country', 'plan', 'purchase_count', 'email_domain', 'lifecycle_stage'].map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={String((c as any).operator || 'equals')} onChange={e => updateCondition(i, { operator: e.target.value })} className="text-xs rounded border px-2 py-1 bg-canvas">
                      {['equals', 'not_equals', 'greater_than', 'less_than', 'contains'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input value={String((c as any).value ?? '')} onChange={e => updateCondition(i, { value: e.target.value })} className="text-xs rounded border px-2 py-1 bg-canvas" />
                  </div>
                )}
                {c.kind === 'event_occurrence' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={String((c as any).event_name || '')} onChange={e => updateCondition(i, { event_name: e.target.value })} maxLength={255} className="text-xs rounded border px-2 py-1 bg-canvas" placeholder="Event name" />
                    <select value={String((c as any).performed ?? true)} onChange={e => updateCondition(i, { performed: e.target.value === 'true' })} className="text-xs rounded border px-2 py-1 bg-canvas"><option value="true">Performed</option><option value="false">Not performed</option></select>
                    <input type="number" min={1} max={90} value={Number((c as any).window_days || 30)} onChange={e => updateCondition(i, { window_days: parseInt(e.target.value || '30', 10) })} className="text-xs rounded border px-2 py-1 bg-canvas" placeholder="Window days" />
                    <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!(c as any).property_filter} onChange={e => updateCondition(i, { property_filter: e.target.checked ? { field: 'plan', operator: 'equals', value: '' } : undefined })} /> Filter</label>
                  </div>
                )}
                {c.kind === 'event_count' && (
                  <div className="grid grid-cols-3 gap-2">
                    <input value={String((c as any).event_name || '')} onChange={e => updateCondition(i, { event_name: e.target.value })} maxLength={255} className="text-xs rounded border px-2 py-1 bg-canvas" placeholder="Event" />
                    <select value={String((c as any).count_operator || 'at_least')} onChange={e => updateCondition(i, { count_operator: e.target.value })} className="text-xs rounded border px-2 py-1 bg-canvas"><option value="at_least">at least</option><option value="at_most">at most</option><option value="exactly">exactly</option></select>
                    <input type="number" min={0} value={Number((c as any).count || 1)} onChange={e => updateCondition(i, { count: parseInt(e.target.value || '1', 10) })} className="text-xs rounded border px-2 py-1 bg-canvas" />
                    <input type="number" min={1} max={90} value={Number((c as any).window_days || 30)} onChange={e => updateCondition(i, { window_days: parseInt(e.target.value || '30', 10) })} className="text-xs rounded border px-2 py-1 bg-canvas col-span-3" placeholder="Window days" />
                  </div>
                )}
                {c.kind === 'recency' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select value={String((c as any).type || 'active_within')} onChange={e => updateCondition(i, { type: e.target.value })} className="text-xs rounded border px-2 py-1 bg-canvas"><option value="active_within">Active within</option><option value="inactive_for">Inactive for</option></select>
                    <input type="number" min={1} max={90} value={Number((c as any).days || 7)} onChange={e => updateCondition(i, { days: parseInt(e.target.value || '7', 10) })} className="text-xs rounded border px-2 py-1 bg-canvas" placeholder="Days" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => addCondition('profile_trait')} className="text-xs bg-ink-strong text-white px-3 py-2 rounded-lg">+ Profile trait</button>
            <button onClick={() => addCondition('event_occurrence')} className="text-xs bg-ink-strong text-white px-3 py-2 rounded-lg">+ Event occurrence</button>
            <button onClick={() => addCondition('event_count')} className="text-xs bg-ink-strong text-white px-3 py-2 rounded-lg">+ Event count</button>
            <button onClick={() => addCondition('recency')} className="text-xs bg-ink-strong text-white px-3 py-2 rounded-lg">+ Recency</button>
          </div>

          <div className="flex gap-3">
            <button onClick={async () => { setSaving(true); setErr(''); try { const r = await apiFetch<{ segment: { id: string } }>('v1/control/segments', { method: 'POST', query: { workspaceId: 'me' }, body: { name, definition: def() } }); setSavedId(r.segment.id); } catch (e: any) { setErr(e?.message || 'Save failed'); } finally { setSaving(false); } }} disabled={!name || conds.length === 0 || saving || loading} className="rounded-lg bg-ink-strong text-white text-sm px-4 py-2">Save</button>
            {savedId && <button onClick={async () => { if (previewLoading) return; setPreviewLoading(true); setErr(''); try { const r = await apiFetch<{ matched_profiles: number; sample: string[]; truncated?: boolean; note?: string }>(`v1/control/segments/${savedId}/preview`, { method: 'POST', query: { workspaceId: workspaceId || undefined } }); setPreview(r); } catch (e: any) { setErr(e?.message || 'Preview failed'); } finally { setPreviewLoading(false); } }} disabled={previewLoading || loading} className="rounded-lg bg-em text-white text-sm px-4 py-2">Preview</button>}
          </div>
          {err && <div role="alert" className="text-red-600 text-sm mt-3">{err}</div>}
        </section>

        {preview && (
          <section aria-label="Preview" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-ink">Audience Preview</h2>
            <div className="text-sm"><strong>Matched profiles:</strong> {preview.matched_profiles}</div>
            <div className="text-sm"><strong>Sample IDs:</strong> {(preview.sample || []).slice(0, 10).map((s: string) => s.slice(0, 8)).join(', ')}</div>
            {preview.truncated && <div className="text-xs text-ink-muted">Truncated (limit reached)</div>}
            <div className="text-xs text-ink-muted">Evaluated: {new Date().toISOString().slice(0, 10)}</div>
            <div className="text-xs text-ink-muted">Note: {preview.note}</div>
          </section>
        )}

        <section aria-label="Segments" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6">
          <h2 className="text-lg font-semibold text-ink mb-3">Saved segments</h2>
          {segments.length === 0 ? <p className="text-sm text-ink-muted">None saved. Create one above.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-ink-muted"><th className="pb-2">Name</th><th className="pb-2">Version</th></tr></thead>
              <tbody>
                {segments.map((s: any) => (
                  <tr key={s.id} className="border-b border-ink-divider"><td className="py-2">{s.name}</td><td className="py-2 text-ink-muted">{s.definition_version}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
