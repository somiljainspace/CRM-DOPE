import React, { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import { apiFetch, FunnelResponse, FunnelStepResult } from '../lib/api';
import { useWorkspace } from '../lib/workspace';
import { Loader2, Plus, X, BarChart, ArrowRight } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Funnels() {
  const { workspace } = useWorkspace();
  const [steps, setSteps] = useState<string[]>(['page_viewed', 'signup_completed']);
  const [funnelData, setFunnelData] = useState<FunnelStepResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchFunnel = async () => {
    if (!workspace) return;
    if (steps.length < 2) {
      setError('A funnel requires at least 2 steps');
      return;
    }
    const cleanSteps = steps.map(s => s.trim()).filter(Boolean);
    if (cleanSteps.length < 2) {
      setError('Please provide valid event names for all steps');
      return;
    }

    setLoading(true);
    setError('');

    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const res = await apiFetch<FunnelResponse>('v1/control/analytics/funnels', {
        method: 'POST',
        query: { workspaceId: workspace.id },
        body: {
          startDate,
          endDate,
          steps: cleanSteps
        }
      });
      setFunnelData(res.funnel || []);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate funnel');
      setFunnelData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when workspace changes if we have valid steps
  useEffect(() => {
    if (workspace && steps.filter(Boolean).length >= 2) {
      fetchFunnel();
    }
  }, [workspace]);

  const updateStep = (idx: number, val: string) => {
    const next = [...steps];
    next[idx] = val;
    setSteps(next);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const addStep = () => {
    if (steps.length >= 5) return;
    setSteps([...steps, '']);
  };

  const chartData = funnelData?.map((step, idx) => {
    const isFirst = idx === 0;
    const conversion = isFirst ? 100 : (funnelData[0].count > 0 ? (step.count / funnelData[0].count) * 100 : 0);
    const dropoff = idx > 0 ? (100 - conversion) : 0;

    return {
      name: steps[idx] || `Step ${idx + 1}`,
      count: step.count,
      conversion: Number(conversion.toFixed(1)),
      dropoff: Number(dropoff.toFixed(1))
    };
  }) || [];

  return (
    <AppShell title="Funnels" breadcrumb={['Analytics', 'Funnels']}>
      <div className="p-6 md:p-8 max-w-6xl mx-auto grid lg:grid-cols-12 gap-8">

        {/* Left Col: Builder */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold tracking-tight">Funnels</h1>
          </div>

          <div className="bg-[#121620] border border-[#22283a] rounded-2xl p-5 shadow-lg">
            <h2 className="text-sm font-semibold mb-4 text-[#e9edf3]">Funnel Steps</h2>
            <div className="space-y-3 mb-6">
              {steps.map((s, i) => (
                <div key={i} className="flex flex-col gap-1.5 relative group">
                  <div className="flex items-center text-xs uppercase tracking-wider font-semibold text-[#5f6a7a]">
                    <span>Step {i + 1}</span>
                    {i >= 2 && (
                      <button
                        onClick={() => removeStep(i)}
                        className="ml-auto text-[#5f6a7a] hover:text-[#f87171] opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove step"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    value={s}
                    onChange={(e) => updateStep(i, e.target.value)}
                    placeholder="e.g. signup_completed"
                    className="w-full bg-[#0a0d13] border border-[#22283a] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1] text-[#e9edf3] placeholder-[#556374] transition-all font-mono"
                  />
                </div>
              ))}

              {steps.length < 5 && (
                <button
                  onClick={addStep}
                  className="w-full flex items-center justify-center gap-2 py-2 mt-4 text-xs font-semibold uppercase tracking-wider text-[#949dac] border border-dashed border-[#22283a] rounded-xl hover:bg-[#171b27] hover:text-[#e9edf3] hover:border-[#444c68] transition-colors"
                >
                  <Plus size={14} /> Add Step
                </button>
              )}
            </div>

            <button
              onClick={fetchFunnel}
              disabled={loading || steps.length < 2}
              className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Calculate Funnel'}
            </button>
          </div>
        </div>

        {/* Right Col: Visualization */}
        <div className="lg:col-span-8 flex flex-col min-h-[500px]">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="bg-[#121620] border border-[#22283a] rounded-2xl p-6 shadow-lg flex-1 flex flex-col relative overflow-hidden">
            <h2 className="text-sm font-semibold mb-6 flex justify-between items-center text-[#e9edf3]">
              <span>Conversion Analysis</span>
              <span className="text-xs text-[#5f6a7a] font-normal">Last 30 Days</span>
            </h2>

            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#556374] bg-[#121620]/50 backdrop-blur-sm z-10">
                <Loader2 size={32} className="animate-spin mb-4 text-[#6366f1]" />
                <p className="text-sm">Calculating conversions...</p>
              </div>
            ) : !funnelData ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#556374] mt-10">
                <BarChart size={32} className="mb-4 opacity-50" />
                <p className="text-sm">Run a calculation to see the funnel.</p>
              </div>
            ) : funnelData.length === 0 || funnelData[0].count === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#556374] mt-10">
                <BarChart size={32} className="mb-4 opacity-50" />
                <p className="text-sm">No data flowing into Step 1 for this time range.</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Stats row */}
                <div className="flex gap-4 mb-8 p-4 bg-[#171b27] rounded-xl border border-[#22283a] items-center">
                  <div className="flex-1">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6a7a] mb-1">Total Conversion</div>
                    <div className="text-2xl font-extrabold text-[#34d399]">
                      {chartData[chartData.length - 1].conversion.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-[#444c68]">
                    <ArrowRight size={24} strokeWidth={1} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6a7a] mb-1">Users Completed</div>
                    <div className="text-2xl font-extrabold text-[#e9edf3]">
                      {chartData[chartData.length - 1].count.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="flex-1 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#22283a" />
                      <XAxis dataKey="name" stroke="#5f6a7a" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} dy={16} />
                      <YAxis stroke="#5f6a7a" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                      <Tooltip
                        cursor={{ fill: '#171b27', opacity: 0.5 }}
                        contentStyle={{ backgroundColor: '#141921', borderColor: '#22283a', borderRadius: '12px', color: '#e9edf3', fontSize: '13px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                        formatter={(val: any, name: any) => [val.toLocaleString(), name === 'count' ? 'Users' : name]}
                        labelStyle={{ color: '#818cf8', fontWeight: 600, marginBottom: '8px' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={80}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : index === chartData.length - 1 ? '#34d399' : '#818cf8'} fillOpacity={0.9} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
