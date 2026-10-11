import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AppShell from '../../components/layout/AppShell';
import { apiFetch } from '../../lib/api';
import { useWorkspace } from '../../lib/workspace';
import { Loader2, ArrowLeft, Trash2, Eye, Save, AlertCircle } from 'lucide-react';

type Condition = { kind: string; [k: string]: unknown };

export default function SegmentDetailPage() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const { segmentId } = router.query as { segmentId?: string };
  const workspaceId = (router.query.workspaceId as string) || workspace?.id;

  const [seg, setSeg] = useState<any>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [conds, setConds] = useState<Condition[]>([]);
  const [op, setOp] = useState<'AND' | 'OR'>('AND');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!segmentId || typeof segmentId !== 'string') return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const res = await apiFetch<{ segment: any }>(`v1/control/segments/${segmentId}`, {
          query: { workspaceId: workspaceId || undefined },
        });
        const s = res.segment;
        setSeg(s);
        setName(s.name || '');
        setDesc(s.description || '');
        const def = s.definition_json
          ? typeof s.definition_json === 'string'
            ? JSON.parse(s.definition_json)
            : s.definition_json
          : s.definition
          ? typeof s.definition === 'string'
            ? JSON.parse(s.definition)
            : s.definition
          : { operator: 'AND', conditions: [] };
        setOp(def.operator || 'AND');
        setConds(Array.isArray(def.conditions) ? def.conditions.map((c: any) => ({ ...c })) : []);
      } catch (e: any) {
        if (e?.status === 404) setErr('Segment not found');
        else if (e?.status === 403) setErr('Forbidden: Access denied to this segment');
        else setErr(e?.message || 'Failed to load segment');
      } finally {
        setLoading(false);
      }
    })();
  }, [segmentId, workspaceId]);

  const def = () => ({
    definition_version: 1 as const,
    operator: op,
    conditions: conds.map((c) => ({ ...c })),
  });

  const save = async () => {
    if (!segmentId || typeof segmentId !== 'string') return;
    setSaving(true);
    setErr('');
    try {
      await apiFetch(`v1/control/segments/${segmentId}`, {
        method: 'PATCH',
        query: { workspaceId: workspaceId || undefined },
        body: { name, description: desc, definition: def() },
      });
      setErr('');
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const doPreview = async () => {
    if (!segmentId || typeof segmentId !== 'string') return;
    setPreviewLoading(true);
    setErr('');
    try {
      const r = await apiFetch<any>(`v1/control/segments/${segmentId}/preview`, {
        method: 'POST',
        query: { workspaceId: workspaceId || undefined },
      });
      setPreview(r);
    } catch (e: any) {
      setErr(e?.message || 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const doDelete = async () => {
    if (!segmentId || typeof segmentId !== 'string') return;
    if (!confirm('Are you sure you want to delete this segment?')) return;
    setDeleting(true);
    setErr('');
    try {
      await apiFetch(`v1/control/segments/${segmentId}`, {
        method: 'DELETE',
        query: { workspaceId: workspaceId || undefined },
      });
      router.push('/segments');
    } catch (e: any) {
      setErr(e?.message || 'Delete failed');
      setDeleting(false);
    }
  };

  return (
    <AppShell title={name || 'Segment Detail'} breadcrumb={['Audiences', 'Segments', name || 'Detail']}>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/segments')}
          className="inline-flex items-center gap-1.5 text-xs text-[#949dac] hover:text-[#e9edf3] mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Segments
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#556374]">
            <Loader2 size={24} className="animate-spin mb-3 text-[#6366f1]" />
            <p className="text-sm">Loading segment details...</p>
          </div>
        ) : err && !seg ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{err}</p>
              <button onClick={() => router.push('/segments')} className="mt-2 text-xs underline text-[#e9edf3]">
                Return to segment list
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#e9edf3]">{name || 'Unnamed Segment'}</h1>
                <p className="text-xs text-[#5f6a7a] mt-1 font-mono">
                  ID: {segmentId} · version {seg?.definition_version ?? 1}
                </p>
              </div>
            </div>

            <section aria-label="Edit segment" className="rounded-2xl bg-[#121620] border border-[#22283a] shadow-lg p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label htmlFor="d-name" className="block text-xs font-semibold uppercase tracking-wider text-[#5f6a7a] mb-1.5">
                    Segment Name
                  </label>
                  <input
                    id="d-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={255}
                    className="w-full bg-[#0a0d13] border border-[#22283a] rounded-xl px-3 py-2 text-sm text-[#e9edf3] placeholder-[#556374] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1] transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="d-desc" className="block text-xs font-semibold uppercase tracking-wider text-[#5f6a7a] mb-1.5">
                    Description
                  </label>
                  <input
                    id="d-desc"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    maxLength={1024}
                    placeholder="Optional description"
                    className="w-full bg-[#0a0d13] border border-[#22283a] rounded-xl px-3 py-2 text-sm text-[#e9edf3] placeholder-[#556374] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1] transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-[#5f6a7a]">Match</span>
                <div className="flex p-1 bg-[#0a0d13] border border-[#22283a] rounded-lg">
                  <button
                    onClick={() => setOp('AND')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      op === 'AND' ? 'bg-[#22283a] text-[#e9edf3]' : 'text-[#5f6a7a] hover:text-[#949dac]'
                    }`}
                  >
                    ALL (AND)
                  </button>
                  <button
                    onClick={() => setOp('OR')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      op === 'OR' ? 'bg-[#22283a] text-[#e9edf3]' : 'text-[#5f6a7a] hover:text-[#949dac]'
                    }`}
                  >
                    ANY (OR)
                  </button>
                </div>
                <span className="text-xs text-[#5f6a7a]">conditions</span>
              </div>

              <div className="space-y-3 mb-6">
                {conds.length === 0 ? (
                  <p className="text-xs text-[#5f6a7a]">No conditions defined in this segment.</p>
                ) : (
                  conds.map((c, i) => (
                    <div key={i} className="rounded-xl bg-[#0a0d13] border border-[#22283a] p-3 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px] text-[#818cf8]">
                          {String(c.kind)}
                        </span>
                        <button
                          onClick={() => setConds(conds.filter((_, idx) => idx !== i))}
                          className="text-[#5f6a7a] hover:text-[#f87171] transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <pre className="text-[11px] text-[#949dac] font-mono overflow-x-auto p-1 bg-[#121620] rounded border border-[#22283a]">
                        {JSON.stringify(c, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={save}
                  disabled={saving || !name}
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Changes
                </button>
                <button
                  onClick={doPreview}
                  disabled={previewLoading}
                  className="bg-[#171b27] border border-[#22283a] hover:bg-[#22283a] text-[#e9edf3] text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                  Preview Audience
                </button>
                <button
                  onClick={doDelete}
                  disabled={deleting}
                  className="border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-[#f87171] text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Delete
                </button>
              </div>

              {err && (
                <div role="alert" className="text-[#f87171] text-sm mt-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}
            </section>

            {preview && (
              <section aria-label="Preview" className="rounded-2xl bg-[#121620] border border-[#22283a] shadow-lg p-6">
                <h2 className="text-sm font-semibold text-[#e9edf3] mb-4">Audience Preview</h2>
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
                    <div className="text-sm font-semibold text-[#e9edf3] truncate">
                      {new Date(preview.evaluated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-[#949dac]">
                  <strong className="text-[#e9edf3]">Sample IDs:</strong>{' '}
                  {(preview.sample || []).slice(0, 10).map((s: string) => s.slice(0, 8)).join(', ') || '—'}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
