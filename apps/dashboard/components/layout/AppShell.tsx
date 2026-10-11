import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useWorkspace } from '../../lib/workspace';
import { apiFetch, MeResponse } from '../../lib/api';
import Head from 'next/head';

export default function AppShell({ title, breadcrumb, children }: { title: string; breadcrumb?: string[]; children: React.ReactNode }) {
  const { workspace } = useWorkspace();
  const [user, setUser] = useState<MeResponse['user'] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Validate session on load
    apiFetch<MeResponse>('v1/auth/me')
      .then(res => setUser(res.user))
      .catch(err => {
        if (err.status === 401) window.location.href = '/login';
      });

    const handleToggle = () => setCollapsed(c => !c);
    const handleMobile = () => setMobileOpen(m => !m);

    window.addEventListener('cdp.sidebar.toggle', handleToggle);
    window.addEventListener('cdp.mobile.nav', handleMobile);
    return () => {
      window.removeEventListener('cdp.sidebar.toggle', handleToggle);
      window.removeEventListener('cdp.mobile.nav', handleMobile);
    };
  }, []);

  return (
    <>
      <Head>
        <title>{`${title} — CRM-DOPE`}</title>
      </Head>
      <div className="h-screen flex bg-[#0a0d13] text-[#e9edf3]" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui" }}>
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar title={title} breadcrumb={breadcrumb} user={user} workspace={workspace} />
          <main className="flex-1 overflow-auto bg-[#0a0d13] relative">{children}</main>
        </div>
      </div>
    </>
  );
}
