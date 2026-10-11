import React, { useState } from 'react';
import Head from 'next/head';
import { Eye, EyeOff, ArrowRight, Sparkles, ShieldCheck, Activity, Layers, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || 'Invalid credentials');
      }
      window.location.href = '/overview';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>CRM-DOPE — Sign in</title></Head>
      <div className="min-h-screen flex bg-[#0a0d13] text-[#e9edf3]" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui" }}>
        {/* Brand panel */}
        <div className="hidden lg:flex w-[55%] relative overflow-hidden items-end p-12" style={{ background: 'radial-gradient(1200px 500px at 20% -10%, rgba(99,102,241,.25), transparent 60%), radial-gradient(800px 400px at 90% 0%, rgba(6,182,212,.16), transparent 55%), linear-gradient(180deg, #0f131a 0%, #0a0d13 100%)' }}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[.07]"></div>
          <div className="relative z-10 max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366f1] via-[#818cf8] to-[#06b6d4] shadow-2xl shadow-[#6366f1]/30 flex items-center justify-center mb-8"
            >
              <Sparkles size={22} className="text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
              className="text-4xl md:text-[3.2rem] leading-[1.1] font-extrabold tracking-tight mb-6" style={{ letterSpacing: '-0.03em' }}
            >
              Customer intelligence <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#818cf8] to-[#06b6d4]">that actually works.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
              className="text-[#949dac] text-lg leading-relaxed max-w-md"
            >
              First-party events. Real profiles. Deterministic segments. Safe activation. Self-hosted, open-source, and built for the teams that need control over their data.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18, ease: 'easeOut' }}
              className="mt-10 space-y-3 text-sm text-[#949dac]"
            >
              <div className="flex items-center gap-3"><ShieldCheck size={18} className="text-[#6366f1]" /> First-party data only</div>
              <div className="flex items-center gap-3"><Activity size={18} className="text-[#6366f1]" /> Real-time event ingestion</div>
              <div className="flex items-center gap-3"><Layers size={18} className="text-[#6366f1]" /> PostgreSQL control plane</div>
              <div className="flex items-center gap-3"><Zap size={18} className="text-[#6366f1]" /> ClickHouse analytics engine</div>
            </motion.div>
          </div>
        </div>

        {/* Auth panel */}
        <div className="flex-1 flex items-center justify-center p-8 relative">
          <div className="w-full max-w-md">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="mb-10"
            >
              <h2 className="text-3xl font-extrabold tracking-tight mb-2">Welcome back</h2>
              <p className="text-[#949dac]">Sign in to your CRM-DOPE workspace.</p>
            </motion.div>
            <motion.form
              onSubmit={handle}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}
              className="space-y-5"
            >
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-[#5f6a7a] mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#121620] border border-[#22283a] rounded-xl px-4 py-3 text-[#e9edf3] placeholder-[#556374] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1] transition-all"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label htmlFor="pass" className="block text-xs font-semibold uppercase tracking-wider text-[#5f6a7a] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="pass"
                    type={show ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#121620] border border-[#22283a] rounded-xl px-4 py-3 text-[#e9edf3] placeholder-[#556374] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 focus:border-[#6366f1] transition-all pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-3 text-[#949dac] hover:text-[#e9edf3] transition-colors"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && <div role="alert" className="text-[#f87171] text-sm font-medium">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#6366f1] to-[#818cf8] hover:from-[#4f46e5] hover:to-[#6366f1] text-white font-semibold py-3 rounded-xl shadow-lg shadow-[#6366f1]/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? 'Signing in...' : 'Continue'} <ArrowRight size={18} />
              </button>
            </motion.form>
            <p className="mt-6 text-xs text-[#556374] text-center">First-party only. No tracking. No third-party brokers.</p>
          </div>
        </div>
      </div>
    </>
  );
}
