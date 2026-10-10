import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { apiFetch } from '../../lib/api';

type Condition = { kind: string; [k: string]: unknown };

export default function SegmentDetailPage() {
  const router = useRouter();
  const { segmentId, workspaceId } = router.query as { segmentId?: string; workspaceId?: string };
  const [seg, setSeg] = useState<any>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [conds, setConds] = useState<Condition[]>([]);
  const [op, setOp] = useState<'AND'|'OR'>('AND');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!segmentId || typeof segmentId !== 'string') return;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await apiFetch<{ segment: any }>(`v1/control/segments/${segmentId}`, { query: { workspaceId: workspaceId || undefined } });
        const s = res.segment;
        setSeg(s);
        setName(s.name || '');
        setDesc(s.description || '');
        const def = s.definition_json ? (typeof s.definition_json === 'string' ? JSON.parse(s.definition_json) : s.definition_json) : (s.definition ? (typeof s.definition === 'string' ? JSON.parse(s.definition) : s.definition) : { operator: 'AND', conditions: [] });
        setOp(def.operator || 'AND');
        setConds(Array.isArray(def.conditions) ? def.conditions.map((c: any) => ({ ...c })) : []);
      } catch (e: any) {
        if (e?.status === 404) setErr('Not found');
        else if (e?.status === 403) setErr('Forbidden');
        else setErr(e?.message || 'Failed to load');
      } finally { setLoading(false); }
    })();
  }, [segmentId]);

  const def = () => ({ definition_version: 1 as const, operator: op, conditions: conds.map((c) => ({ ...c })) });

  const save = async () => {
    if (!segmentId || typeof segmentId !== 'string') return;
    setSaving(true); setErr('');
    try {
      await apiFetch(`v1/control/segments/${segmentId}`, { method: 'PATCH' as any, query: { workspaceId: workspaceId || undefined }, body: { name, description: desc, definition: def() } });
      setErr('');
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const doPreview = async () => {
    if (!segmentId || typeof segmentId !== 'string') return;
    setPreviewLoading(true); setErr('');
    try {
      const r = await apiFetch<any>(`v1/control/segments/${segmentId}/preview`, { method: 'POST', query: { workspaceId: workspaceId || undefined } });
      setPreview(r);
    } catch (e: any) { setErr(e?.message || 'Preview failed'); }
    finally { setPreviewLoading(false); }
  };

  const doDelete = async () => {
    if (!segmentId || typeof segmentId !== 'string' || !confirm('Delete this segment?')) return;
    setDeleting(true); setErr('');
    try {
      await apiFetch(`v1/control/segments/${segmentId}`, { method: 'DELETE' as any, query: { workspaceId: workspaceId || undefined } });
      router.push('/segments');
    } catch (e: any) { setErr(e?.message || 'Delete failed'); setDeleting(false); }
  };

  if (loading) return <main className="max-w-3xl mx-auto px-6 py-12"><p className="text-ink-soft">Loading…</p></main>;
  if (err && !seg && !name) return <main className="max-w-3xl mx-auto px-6 py-12"><div role="alert" className="text-red-600">{err}</div><button onClick={() => router.push('/segments')} className="mt-3 text-sm underline">Back to list</button></main>;

  return (
    <>
      <Head><title>{name || 'Segment'} — CRM-DOPE</title></Head>
      <main className="max-w-3xl mx-auto px-6 py-8" style={{ fontFamily: 'var(--font-sans)' }}>
        <nav className="text-xs text-ink-muted mb-4"><button onClick={() => router.push('/segments')} className="underline">← Segments</button></nav>
        <h1 className="text-2xl font-bold text-ink mb-1">{name || 'Segment'}</h1>
        <p className="text-xs text-ink-muted mb-6">ID {segmentId} · version {seg?.definition_version ?? 1}</p>

        <section className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 mb-6">
          <label htmlFor="d-name" className="block text-xs font-medium text-ink-soft mb-1">Name</label>
          <input id="d-name" value={name} onChange={e => setName(e.target.value)} maxLength={255} className="w-full rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm mb-3" />
          <label htmlFor="d-desc" className="block text-xs font-medium text-ink-soft mb-1">Description</label>
          <input id="d-desc" value={desc} onChange={e => setDesc(e.target.value)} maxLength={1024} className="w-full rounded-lg border border-ink-subtle bg-paper px-3 py-2 text-sm mb-3" />

          <div className="flex gap-2 mb-3"><button onClick={() => setOp('AND')} className={`px-2 py-1 rounded text-xs ${op==='AND'?'bg-em text-white':'bg-paper border'}`}>AND</button><button onClick={() => setOp('OR')} className={`px-2 py-1 rounded text-xs ${op==='OR'?'bg-em text-white':'bg-paper border'}`}>OR</button></div>

          <div className="space-y-2 mb-3">
            {conds.map((c, i) => (
              <div key={i} className="rounded-lg bg-paper border border-ink-subtle p-3 text-xs text-ink-soft">
                <div className="flex justify-between mb-1"><span className="font-semibold">{String(c.kind)}</span><button onClick={() => setConds(conds.filter((_, idx) => idx !== i))} className="text-red-600">Remove</button></div>
                <pre className="text-[10px] text-ink-muted">{JSON.stringify(c)}</pre>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving || !name} className="rounded-lg bg-ink-strong text-white text-sm px-4 py-2">Save (PATCH)</button>
            <button onClick={doPreview} disabled={previewLoading} className="rounded-lg bg-em text-white text-sm px-4 py-2">Preview</button>
            <button onClick={doDelete} disabled={deleting} className="rounded-lg bg-red-600 text-white text-sm px-4 py-2">Delete</button>
          </div>
          {err && <div role="alert" className="text-red-600 text-sm mt-3">{err}</div>}
        </section>

        {preview && (
          <section aria-label="Preview" className="rounded-2xl bg-canvas border border-ink-divider shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold">Preview</h2>
            <div><strong>Matched:</strong> {preview.matched_profiles}</div>
            <div><strong>Sample:</strong> {(preview.sample || []).slice(0, 10).map((s: string) => s.slice(0, 8)).join(', ')}</div>
            {preview.truncated && <div className="text-xs text-ink-muted">Truncated</div>}
          </section>
        )}
      </main>
    </>
  );
}
