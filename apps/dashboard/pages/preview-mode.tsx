import React, { useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { ShieldAlert, Zap, Activity, Database } from 'lucide-react';
import { useWorkspace } from '../lib/workspace';

export default function PreviewMode() {
  const { setWorkspace } = useWorkspace();
  const [fixturesActive, setFixturesActive] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev) {
    return (
      <AppShell title="Preview Mode" breadcrumb={['Development', 'Preview Mode']}>
        <div className="p-6 md:p-8 flex items-center justify-center text-center h-full">
          <div>
            <ShieldAlert className="w-12 h-12 text-[#f87171] mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Not available in Production</h1>
            <p className="text-[#949dac]">Preview mode and UI fixtures are strictly disabled in production builds.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const handleActivatePreview = () => {
    // We only set client-side preview flags and the workspace pointer to the known fixture UUID
    // Never write directly to the DBs from here. We just point the UI to existing fixture data
    setWorkspace({ id: 'ffffffff-1111-2222-3333-444444444444', name: 'fixture-ws (PREVIEW DATA)' });
    setFixturesActive(true);
  };

  return (
    <AppShell title="Preview Mode" breadcrumb={['Development', 'Preview Mode']}>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <Activity className="text-[#f59e0b]" size={28} />
          <h1 className="text-2xl font-extrabold tracking-tight">Development Preview Mode</h1>
        </div>

        <div className="mb-8 p-4 bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl flex items-start gap-3 text-[#fbbf24] text-sm">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>
            <strong>DEMO DATA CAUTION:</strong> Preview Mode safely repoints the UI to read from the <code>fixture-ws</code> workspace generated during database seeding (test fixtures). It <strong>does not</strong> generate new data or mutate PostgreSQL/ClickHouse. It cannot bypass production authentication.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#121620] border border-[#22283a] rounded-2xl p-6 shadow-lg flex flex-col">
            <h3 className="flex items-center gap-2 font-semibold mb-4 text-[#e9edf3]">
              <Database size={18} className="text-[#6366f1]" /> UI Fixture Mount
            </h3>
            <p className="text-sm text-[#949dac] mb-6 flex-1">
              Selects the seeded test workspace (<code>ffffffff-1111-2222-3333-444444444444</code>) in your local browser state, allowing dashboard charts to render the pre-existing seed data.
            </p>

            {!fixturesActive ? (
              <button
                onClick={handleActivatePreview}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#6366f1]/20 transition-all active:scale-[0.98]"
              >
                Set UI to Developer Preview Workspace
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-[#171b27] border border-[#22283a]">
                <div className="text-[13px] font-mono text-[#34d399] space-y-1.5 flex flex-col">
                  <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#34d399]"></div> Workspace mounted: fixture-ws</span>
                  <span className="text-[#949dac] pl-3.5">API requests will now query test fixtures.</span>
                  <span className="text-[#949dac] pl-3.5">No database writes were performed.</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#121620] border border-[#22283a] rounded-2xl p-6 shadow-lg">
            <h3 className="flex items-center gap-2 font-semibold mb-4 text-[#e9edf3]">
              <Zap size={18} className="text-[#06b6d4]" /> Build & Security Checks
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center p-3 rounded-lg bg-[#0a0d13] border border-[#22283a]">
                <span className="text-[#949dac]">Environment</span>
                <span className="text-[#e9edf3] font-mono text-xs">{process.env.NODE_ENV}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-[#0a0d13] border border-[#22283a]">
                <span className="text-[#949dac]">Production auth bypass</span>
                <span className="text-[#f87171] flex items-center gap-1.5 text-xs font-semibold uppercase"><ShieldAlert size={12}/> Disabled</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-[#0a0d13] border border-[#22283a]">
                <span className="text-[#949dac]">Mock Mutations</span>
                <span className="text-[#f87171] flex items-center gap-1.5 text-xs font-semibold uppercase"><ShieldAlert size={12}/> Disabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
