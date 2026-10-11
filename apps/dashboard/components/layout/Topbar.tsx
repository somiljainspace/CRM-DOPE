import React from 'react';
import { Bell, Search, ChevronDown } from 'lucide-react';

interface TopbarProps {
  title: string;
  breadcrumb?: string[];
  user?: { id: string; email: string; createdAt: string } | null;
  workspace?: { id: string; name: string } | null;
}

export default function Topbar({ title, breadcrumb, user, workspace }: TopbarProps) {
  return (
    <header className="h-14 bg-[#121620]/60 backdrop-blur-xl border-b border-[#22283a] flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-[#5f6a7a] hidden sm:inline">{workspace?.name || 'Workspace'}</span>
        <span className="text-[#5f6a7a] hidden sm:inline">/</span>
        {breadcrumb && breadcrumb.length > 0 ? (
          breadcrumb.map((b, i) => (
            <React.Fragment key={b}>
              {i > 0 && <span className="text-[#5f6a7a]">/</span>}
              <span className={i === breadcrumb.length - 1 ? 'text-[#e9edf3] font-medium truncate max-w-[180px]' : 'text-[#949dac] truncate max-w-[180px]'}>
                {b}
              </span>
            </React.Fragment>
          ))
        ) : (
          <span className="text-[#e9edf3] font-medium truncate max-w-[180px]">{title}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-2.5 text-[#5f6a7a]" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-[#0a0d13] border border-[#22283a] rounded-lg pl-9 pr-4 py-1.5 text-sm text-[#e9edf3] placeholder-[#556374] w-48 focus:outline-none focus:border-[#6366f1] transition-colors"
          />
        </div>

        <button className="p-2 rounded-lg text-[#949dac] hover:text-[#e9edf3] hover:bg-[#171b27] transition-colors relative" aria-label="Notifications">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#6366f1]" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-[#22283a]">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-xs font-bold text-white uppercase">
            {user?.email?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-medium text-[#e9edf3] truncate max-w-[120px]">
              {user?.email || 'Operator'}
            </div>
          </div>
          <ChevronDown size={14} className="text-[#5f6a7a]" />
        </div>
      </div>
    </header>
  );
}
