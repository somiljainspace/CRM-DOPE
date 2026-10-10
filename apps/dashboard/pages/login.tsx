import React, { useState } from 'react';
import Head from 'next/head';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; expiresAt?: string };
      if (res.ok && data.success) {
        setStatus('success');
        setMessage('Signed in. Redirecting…');
        window.location.href = '/';
      } else {
        setStatus('error');
        setMessage(data.message || 'Login failed');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Is the API running?');
    }
  }

  return (
    <>
      <Head>
        <title>Sign in — CRM-DOPE</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="min-h-screen flex items-center justify-center bg-paper px-4" style={{ fontFamily: 'var(--font-sans)' }}>
        <section className="w-full max-w-sm p-8 rounded-2xl bg-canvas shadow-xl shadow-ink-subtle/50 border border-ink-divider" aria-label="Login form">
          <h1 className="text-2xl font-semibold tracking-tight text-ink mb-1">Sign in</h1>
          <p className="text-sm text-ink-muted mb-6">Analytics dashboard — first-party events only.</p>
          <form onSubmit={submit} className="space-y-4" aria-label="Login">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-ink-soft mb-1">Work email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-ink-subtle bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-em focus:ring-1 focus:ring-em-soft" placeholder="you@company.com" />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-ink-soft mb-1">Password</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-ink-subtle bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-em focus:ring-1 focus:ring-em-soft" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={status === 'loading'} className="w-full rounded-lg bg-ink-strong text-white text-sm font-medium py-2.5 hover:bg-ink-soft transition disabled:opacity-50" aria-busy={status === 'loading'}>
              {status === 'loading' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          {status === 'error' && <p className="mt-3 text-sm text-red-600" role="alert">{message}</p>}
          {status === 'success' && <p className="mt-3 text-sm text-em" role="status">{message}</p>}
          <p className="mt-6 text-xs text-ink-muted leading-relaxed">No account? Contact your workspace owner. The platform uses first-party events only — no third-party tracking or fingerprinting.</p>
        </section>
      </main>
    </>
  );
}
