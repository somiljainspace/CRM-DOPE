import React from 'react';
import Head from 'next/head';
import { ArrowRight, Activity, Users, Layers, Zap, ShieldCheck } from 'lucide-react';

export default function Landing() {
  return (
    <>
      <Head><title>CRM-DOPE — Open Source Customer Intelligence</title></Head>
      <div style={{ fontFamily: "'Inter', ui-sans-serif, system-ui", background: '#0a0d13', color: '#e9edf3' }}>
        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-[#0a0d13]/80 backdrop-blur-xl border-b border-[#22283a] px-6 py-4 flex items-center justify-between">
          <a href="/login" className="flex items-center gap-2.5 font-extrabold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#06b6d4] flex items-center justify-center shadow-lg shadow-[#6366f1]/30"><span className="text-white text-sm">C</span></div>
            CRM-DOPE
          </a>
          <div className="flex items-center gap-3">
            <a href="/login" className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#141921] border border-[#22283a] px-4 py-2 text-sm font-medium text-[#949dac] hover:text-[#e9edf3] hover:border-[#6366f1]/40 transition">Log in</a>
            <a href="/login" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/20">Open Dashboard →</a>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative overflow-hidden px-6 pt-28 pb-20 md:pt-36 md:pb-28">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_500px_at_20%_-10%,rgba(99,102,241,.18),transparent_60%),radial-gradient(800px_400px_at_90%_0%,rgba(6,182,212,.12),transparent_55%)]"></div>
          <div className="relative max-w-6xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#141921]/60 border border-[#22283a] px-3 py-1 text-xs font-medium text-[#818cf8] mb-8 backdrop-blur-sm">
              <Zap size={14}/> First-party data • Self-hosted • Open source
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-[-0.04em] leading-[1.05] mb-7 max-w-3xl">
              Customer intelligence <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#818cf8] via-[#6366f1] to-[#06b6d4]">built for control.</span>
            </h1>
            <p className="text-xl text-[#949dac] leading-relaxed max-w-2xl mb-10">Collect product events, build profiles, create segments, and trigger activation — all with your own data, your own infrastructure.</p>
            <div className="flex flex-wrap gap-3">
              <a href="/login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white font-semibold px-7 py-3.5 shadow-xl shadow-[#6366f1]/20 hover:shadow-2xl hover:shadow-[#6366f1]/30 transition-all scale-[1.02]">Open Dashboard <ArrowRight size={18}/></a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-20 max-w-6xl mx-auto">
          <h2 className="text-3xl font-extrabold tracking-tight mb-12">Built for modern customer operations</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Activity, title: 'Event ingestion', desc: 'Reliable, batched, retryable SDK events with schema validation and idempotency.' },
              { icon: Users, title: 'Profiles & identity', desc: 'Anonymous-to-identified association without invasive fingerprinting.' },
              { icon: Layers, title: 'Segmentation', desc: 'Real-time segment builder with profile, event, and recency rules.' },
            ].map(f => (
              <div key={f.title} className="bg-[#121620] border border-[#22283a] rounded-2xl p-7 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1]/20 to-[#06b6d4]/20 flex items-center justify-center mb-5"><f.icon size={20} className="text-[#818cf8]"/></div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-[#949dac] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="px-6 py-16 bg-[#121620]/40 border-y border-[#22283a]">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight mb-4">First-party. Durable. Observable.</h2>
              <p className="text-[#949dac] leading-relaxed mb-6">Events flow into ClickHouse analytics. Profiles live in Postgres. Jobs, retries, and consent enforcement run against durable PostgreSQL tables — not memory.</p>
              <ul className="space-y-2 text-sm text-[#949dac]">
                {['Postgres control plane (tenants, segments, jobs)', 'ClickHouse event plane (analytics)', 'AES-256-GCM + HMAC-SHA256 delivery security', 'SSRF-safe pinned HTTPS transport'].map(i => <li key={i} className="flex items-center gap-2"><ShieldCheck size={14} className="text-[#34d399]"/> {i}</li>)}
              </ul>
            </div>
            <div className="bg-[#0a0d13] border border-[#22283a] rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4"><div className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse"/><span className="text-xs font-mono text-[#5f6a7a]">LIVE SYSTEM STATUS</span></div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  {k:'Postgres',v:'Up'},
                  {k:'ClickHouse',v:'Up'},
                  {k:'Redis',v:'Up'},
                  {k:'API',v:'Up'},
                ].map(x => <div key={x.k} className="bg-[#141921] border border-[#22283a] rounded-xl px-3 py-2.5"><div className="text-xs text-[#5f6a7a]">{x.k}</div><div className="font-semibold text-[#e9edf3] text-sm">{x.v}</div></div>)}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-10 border-t border-[#22283a] max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#556374]">
          <div>CRM-DOPE — open source customer data platform. <a href="https://github.com/somiljainspace/CRM-DOPE" className="text-[#818cf8] hover:underline">GitHub</a></div>
          <div>First-party data only · Explicit tenant isolation · No tracking brokers</div>
        </footer>
      </div>
    </>
  );
}
