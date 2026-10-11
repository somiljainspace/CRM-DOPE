import React, { useState } from 'react';
import {
  LayoutDashboard, LineChart, Users, Activity, Funnel, BarChart3, Layers, Cog, LogOut, Menu, ChevronLeft, ChevronRight, Settings, Database
} from 'lucide-react';
import { useWorkspace } from '../../lib/workspace';
import { useRouter } from 'next/router';

const nav = [
  { label: 'Overview', href: '/overview', icon: LayoutDashboard },
  { label: 'Trends', href: '/trends', icon: LineChart },
  { label: 'Active Users', href: '/active-users', icon: Users },
  { label: 'Events', href: '/events', icon: Activity },
  { label: 'Funnels', href: '/funnels', icon: Funnel },
  { label: 'Retention', href: '/retention', icon: BarChart3 },
  { label: 'Segments', href: '/segments', icon: Layers },
];

export default function Sidebar({ collapsed = false, mobileOpen = false, onClose }: { collapsed?: boolean; mobileOpen?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const { workspace, setWorkspace } = useWorkspace();
  const [editMode, setEditMode] = useState(false);
  const [customWsId, setCustomWsId] = useState('');

  const handleSaveWs = () => {
    if (customWsId.trim()) {
      setWorkspace({ id: customWsId.trim(), name: 'Custom Workspace' });
    }
    setEditMode(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 z-50 h-screen
          bg-[#121620] border-r border-[#22283a]
          flex flex-col shrink-0 transition-all duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ width: collapsed ? 72 : 240 }}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#22283a]">
          <a href="/overview" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#06b6d4] flex items-center justify-center shadow-lg shadow-[#6366f1]/25">
              <span className="text-white font-extrabold text-sm tracking-tight">C</span>
            </div>
            {!collapsed && <span className="font-bold text-[#e9edf3] tracking-tight">CRM-DOPE</span>}
          </a>
          {collapsed ? (
            <button onClick={() => window.dispatchEvent(new Event('cdp.sidebar.toggle'))} className="p-1.5 text-[#949dac] hover:text-white">
              <ChevronRight size={18} />
            </button>
          ) : (
            <button onClick={() => window.dispatchEvent(new Event('cdp.sidebar.toggle'))} className="p-1.5 text-[#949dac] hover:text-white">
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* Workspace Selector */}
        {!collapsed && (
          <div className="p-3 border-b border-[#22283a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5f6a7a]">Workspace</span>
              <button onClick={() => setEditMode(!editMode)} className="text-[#5f6a7a] hover:text-[#e9edf3]">
                <Settings size={12} />
              </button>
            </div>
            {editMode ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Workspace UUID"
                  value={customWsId}
                  onChange={(e) => setCustomWsId(e.target.value)}
                  className="w-full bg-[#0a0d13] border border-[#22283a] rounded px-2 py-1.5 text-xs text-[#e9edf3] placeholder-[#556374] focus:outline-none focus:border-[#6366f1]"
                />
                <button
                  onClick={handleSaveWs}
                  className="w-full bg-[#6366f1] text-white text-xs font-medium py-1.5 rounded hover:bg-[#4f46e5] transition"
                >
                  Save Workspace
                </button>
              </div>
            ) : (
              <div className="bg-[#171b27] border border-[#22283a] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-[#6366f1]" />
                  <span className="text-sm font-medium text-[#e9edf3] truncate">
                    {workspace?.name || 'No Workspace Selected'}
                  </span>
                </div>
                <div className="text-[10px] text-[#5f6a7a] truncate mt-0.5">
                  {workspace?.id || 'Select a workspace in settings'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {nav.map((n) => {
            const isActive = router.pathname === n.href || (n.href !== '/overview' && router.pathname.startsWith(n.href));
            return (
              <a
                key={n.href}
                href={n.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group
                  ${isActive
                    ? 'bg-[#171b27] text-[#e9edf3] shadow-inner'
                    : 'text-[#949dac] hover:text-[#e9edf3] hover:bg-[#171b27]'
                  }
                `}
                title={collapsed ? n.label : undefined}
              >
                <n.icon
                  size={18}
                  strokeWidth={1.8}
                  className={`shrink-0 ${isActive ? 'text-[#818cf8]' : 'text-[#6366f1] group-hover:text-[#818cf8]'}`}
                />
                {!collapsed && <span>{n.label}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-[#22283a] space-y-0.5">
          <a
            href="/preview-mode"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#949dac] hover:text-[#e9edf3] hover:bg-[#171b27] transition-colors text-sm font-medium"
            title={collapsed ? 'Preview Mode' : undefined}
          >
            <Activity size={18} strokeWidth={1.8} />
            {!collapsed && <span>Preview Mode</span>}
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#949dac] hover:text-[#f87171] hover:bg-[#171b27] transition-colors text-sm font-medium"
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={18} strokeWidth={1.8} />
            {!collapsed && <span>Sign Out</span>}
          </button>
          <a
            href="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#949dac] hover:text-[#e9edf3] hover:bg-[#171b27] transition-colors text-sm font-medium"
            title={collapsed ? 'Account' : undefined}
          >
            <Cog size={18} strokeWidth={1.8} />
            {!collapsed && <span>Account</span>}
          </a>
        </div>
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={() => window.dispatchEvent(new Event('cdp.mobile.nav'))}
        className="fixed top-4 left-4 z-30 lg:hidden p-2 rounded-lg bg-[#121620] border border-[#22283a] text-[#e9edf3]"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>
    </>
  );
}
