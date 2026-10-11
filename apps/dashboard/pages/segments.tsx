import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import { apiFetch } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Loader2, Plus, Trash2, Eye, Users } from 'lucide-react';

type Condition = {
  kind: 'profile_trait' | 'event_occurrence' | 'event_count' | 'recency';
  [k: string]: unknown;
};

export default function SegmentsPage() {
  const { workspace } = useWorkspace();
  const [name, setName] = useState('');
  const [op, setOp] = useState<'AND' | 'OR'>('AND');
  const [conds, setConds] = useState<Condition[]>([
    { kind: 'profile_trait', field: 'plan', operator: 'equals', value: '' },
  ]);
  const [segments, setSegs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState<{
    matched_profiles: number;
    sample: string[];
    evaluated_at: string;
    truncated: boolean;
    sample_limit: number;
    note: string;
  } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const workspaceId = workspace?.id;

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setErr('');
    try {
      const res = await apiFetch<{ segments?: any[] }>('v1/control/segments', {
        query: { workspaceId, limit: 25 },
      });
      setSegs(res.segments || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

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

  const handleDelete = async (id: string) => {
    if (!workspaceId) return;
    setDeletingId(id);
    setErr('');
    try {
      await apiFetch(`v1/control/segments/${id}`, {
        method: 'DELETE',
        query: { workspaceId },
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell title="Segments" breadcrumb={['Audiences', 'Segments']}>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight">Segments</h1>
          {!workspace && (
            <span className="text-xs bg-[#f59e0b]/10 text-[#fbbf24] border border-[#f59e0b]/20 px-3 py-1 rounded-full">
              No workspace selected — set one in the sidebar
            </span>
          )}
        </div>

        {/* Builder */}
        <section aria-label="Builder" className="rounded-2xl bg-[#121620] border border-[#22283a] shadow-lg p-6 mb-6">
          <h2 className="text-sm font-semibold mb-5 text-[#e9edf3]">Build segment</h2>

          <label htmlFor="seg-name" className="block text-xs font-medium text-[#949dac] mb-1.5">Name</label>
          <input
            id="seg-name"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={255}
            className="w-full rounded-xl border border-[#22283a] bg-[#0a0d13] px-3 py-2 text-sm mb-4 text-[#e9edf3] placeholder-[#5f6a7a] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1]"
            placeholder="Segment name"
          />

          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-[#5f6a7a]">Match</span>
            <div className="flex p-1 bg-[#0a0d13] border border-[#22283a] rounded-lg">
              <button onClick={() => setOp('AND')} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${op === 'AND' ? 'bg-[#22283a] text-[#e9edf3]' : 'text-[#5f6a7a] hover:text-[#949dac]'}`}>ALL (AND)</button>
              <button onClick={() => setOp('OR')} className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${op === 'OR' ? 'bg-[#22283a] text-[#e9edf3]' : 'text-[#5f6a7a] hover:text-[#949dac]'}`}>ANY (OR)</button>
            </div>
            <span className="text-xs text-[#5f6a7a]">of the following conditions</span>
          </div>

          <div className="space-y-3 mb-4">
            {conds.map((c, i) => (
              <div key={i} className="rounded-xl bg-[#0a0d13] border border-[#22283a] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5f6a7a] bg-[#171b27] px-2 py-0.5 rounded">{String(c.kind)}</span>
                  <button onClick={() => removeCondition(i)} className="text-xs text-[#5f6a7a] hover:text-[#f87171] flex items-center gap-1 transition-colors">
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
                {c.kind === 'profile_trait' && (
                  <div className="grid grid-cols-3 gap-2">
                    <select value={String((c as any).field || 'plan')} onChange={e => updateCondition(i, { field: e.target.value })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] focus:outline-none focus:border-[#6366f1]">
                      {['country', 'plan', 'purchase_count', 'email_domain', 'lifecycle_stage'].map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={String((c as any).operator || 'equals')} onChange={e => updateCondition(i, { operator: e.target.value })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] focus:outline-none focus:border-[#6366f1]">
                      {['equals', 'not_equals', 'greater_than', 'less_than', 'contains'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input value={String((c as any).value ?? '')} onChange={e => updateCondition(i, { value: e.target.value })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] placeholder-[#5f6a7a] focus:outline-none focus:border-[#6366f1]" placeholder="Value" />
                  </div>
                )}
                {c.kind === 'event_occurrence' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={String((c as any).event_name || '')} onChange={e => updateCondition(i, { event_name: e.target.value })} maxLength={255} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] placeholder-[#5f6a7a] focus:outline-none focus:border-[#6366f1]" placeholder="Event name" />
                    <select value={String((c as any).performed ?? true)} onChange={e => updateCondition(i, { performed: e.target.value === 'true' })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] focus:outline-none focus:border-[#6366f1]"><option value="true">Performed</option><option value="false">Not performed</option></select>
                    <input type="number" min={1} max={90} value={Number((c as any).window_days || 30)} onChange={e => updateCondition(i, { window_days: parseInt(e.target.value || '30', 10) })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] focus:outline-none focus:border-[#6366f1]" placeholder="Window days" />
                    <label className="text-xs flex items-center gap-2 text-[#949dac]"><input type="checkbox" checked={!!(c as any).property_filter} onChange={e => updateCondition(i, { property_filter: e.target.checked ? { field: 'plan', operator: 'equals', value: '' } : undefined })} className="rounded border-[#22283a]" /> Filter by property</label>
                  </div>
                )}
                {c.kind === 'event_count' && (
                  <div className="grid grid-cols-3 gap-2">
                    <input value={String((c as any).event_name || '')} onChange={e => updateCondition(i, { event_name: e.target.value })} maxLength={255} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] placeholder-[#5f6a7a] focus:outline-none focus:border-[#6366f1]" placeholder="Event" />
                    <select value={String((c as any).count_operator || 'at_least')} onChange={e => updateCondition(i, { count_operator: e.target.value })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] focus:outline-none focus:border-[#6366f1]"><option value="at_least">at least</option><option value="at_most">at most</option><option value="exactly">exactly</option></select>
                    <input type="number" min={0} value={Number((c as any).count || 1)} onChange={e => updateCondition(i, { count: parseInt(e.target.value || '1', 10) })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] focus:outline-none focus:border-[#6366f1]" />
                    <input type="number" min={1} max={90} value={Number((c as any).window_days || 30)} onChange={e => updateCondition(i, { window_days: parseInt(e.target.value || '30', 10) })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] focus:outline-none focus:border-[#6366f1] col-span-3" placeholder="Window days" />
                  </div>
                )}
                {c.kind === 'recency' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select value={String((c as any).type || 'active_within')} onChange={e => updateCondition(i, { type: e.target.value })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] focus:outline-none focus:border-[#6366f1]"><option value="active_within">Active within</option><option value="inactive_for">Inactive for</option></select>
                    <input type="number" min={1} max={90} value={Number((c as any).days || 7)} onChange={e => updateCondition(i, { days: parseInt(e.target.value || '7', 10) })} className="text-xs rounded-lg border border-[#22283a] bg-[#121620] px-2 py-2 text-[#e9edf3] focus:outline-none focus:border-[#6366f1]" placeholder="Days" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <button onClick={() => addCondition('profile_trait')} className="text-xs bg-[#171b27] border border-[#22283a] text-[#949dac] hover:text-[#e9edf3] hover:border-[#444c68] px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"><Plus size={12} /> Profile trait</button>
            <button onClick={() => addCondition('event_occurrence')} className="text-xs bg-[#171b27] border border-[#22283a] text-[#949dac] hover:text-[#e9edf3] hover:border-[#444c68] px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"><Plus size={12} /> Event occurrence</button>
            <button onClick={() => addCondition('event_count')} className="text-xs bg-[#171b27] border border-[#22283a] text-[#949dac] hover:text-[#e9edf3] hover:border-[#444c68] px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"><Plus size={12} /> Event count</button>
            <button onClick={() => addCondition('recency')} className="text-xs bg-[#171b27] border border-[#22283a] text-[#949dac] hover:text-[#e9edf3] hover:border-[#444c68] px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"><Plus size={12} /> Recency</button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={async () => {
              if (!workspaceId) { setErr('Select a workspace first'); return; }
              setSaving(true); setErr('');
              try {
                const r = await apiFetch<{ segment: { id: string } }>('v1/control/segments', {
                  method: 'POST',
                  query: { workspaceId },
                  body: { name, definition: def() }
                });
                setSavedId(r.segment.id);
                await load();
              } catch (e: any) {
                setErr(e?.message || 'Save failed');
              } finally {
                setSaving(false);
              }
            }} disabled={!name || conds.length === 0 || saving || !workspaceId} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Save Segment
            </button>
            {savedId && (
              <button onClick={async () => {
                if (previewLoading || !workspaceId) return;
                setPreviewLoading(true); setErr('');
                try {
                  const r = await apiFetch<any>(`v1/control/segments/${savedId}/preview`, {
                    method: 'POST',
                    query: { workspaceId }
                  });
                  setPreview(r);
                } catch (e: any) {
                  setErr(e?.message || 'Preview failed');
                } finally {
                  setPreviewLoading(false);
                }
              }} disabled={previewLoading || !workspaceId} className="bg-[#171b27] border border-[#22283a] hover:bg-[#22283a] text-[#e9edf3] text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                Preview Audience
              </button>
            )}
          </div>
          {err && <div role="alert" className="text-[#f87171] text-sm mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
        </section>

        {preview && (
          <section aria-label="Preview" className="rounded-2xl bg-[#121620] border border-[#22283a] shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-[#6366f1]" />
              <h2 className="text-sm font-semibold text-[#e9edf3]">Audience Preview</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-[#171b27] rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6a7a] mb-1">Matched Profiles</div>
                <div className="text-2xl font-extrabold text-[#e9edf3]">{preview.matched_profiles}</div>
              </div>
              <div className="bg-[#171b27] rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6a7a] mb-1">Sample Limit</div>
                <div className="text-2xl font-extrabold text-[#e9edf3]">{preview.sample_limit}</div>
              </div>
              <div className="bg-[#171b27] rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6a7a] mb-1">Truncated</div>
                <div className="text-2xl font-extrabold text-[#e9edf3]">{preview.truncated ? 'Yes' : 'No'}</div>
              </div>
              <div className="bg-[#171b27] rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6a7a] mb-1">Evaluated</div>
                <div className="text-sm font-semibold text-[#e9edf3] truncate">{new Date(preview.evaluated_at).toLocaleString()}</div>
              </div>
            </div>
            <div className="text-sm text-[#949dac] mb-2"><strong className="text-[#e9edf3]">Sample IDs:</strong> {(preview.sample || []).slice(0, 10).map((s: string) => s.slice(0, 8)).join(', ') || '—'}</div>
            <div className="text-xs text-[#5f6a7a]">Note: {preview.note}</div>
          </section>
        )}

        {/* Saved segments */}
        <section aria-label="Segments" className="rounded-2xl bg-[#121620] border border-[#22283a] shadow-lg p-6">
          <h2 className="text-sm font-semibold mb-4 text-[#e9edf3]">Saved segments</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#556374]">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">Loading segments...</span>
            </div>
          ) : segments.length === 0 ? (
            <p className="text-sm text-[#556374] py-8 text-center">No segments saved yet. Create one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[#5f6a7a] border-b border-[#22283a]">
                    <th className="pb-3 font-semibold">Name</th>
                    <th className="pb-3 font-semibold">Version</th>
                    <th className="pb-3 font-semibold">Conditions</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22283a]">
                  {segments.map((s: any) => {
                    let condCount = 0;
                    try { condCount = JSON.parse(s.definition_json || '{}').conditions?.length || 0; } catch { /* ignore parse error */ }
                    return (
                      <tr key={s.id} className="hover:bg-[#171b27]/40 transition-colors">
                        <td className="py-3 font-medium text-[#e9edf3]">{s.name}</td>
                        <td className="py-3 text-[#5f6a7a]">v{s.definition_version || 1}</td>
                        <td className="py-3 text-[#949dac]">{condCount} condition{condCount === 1 ? '' : 's'}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId === s.id}
                            className="text-xs text-[#5f6a7a] hover:text-[#f87171] transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                          >
                            {deletingId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
