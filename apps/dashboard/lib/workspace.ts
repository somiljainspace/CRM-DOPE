import { useState, useEffect } from 'react';

export interface WorkspaceInfo {
  id: string;
  name: string;
}

const KEY = 'cdp.selected_workspace';

export function getSelectedWorkspace(): WorkspaceInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore localStorage parse errors
  }
  return null;
}

export function setSelectedWorkspace(ws: WorkspaceInfo | null): void {
  try {
    if (ws) localStorage.setItem(KEY, JSON.stringify(ws));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('cdp.workspace_changed'));
  } catch {
    // Ignore storage write errors
  }
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);

  useEffect(() => {
    // Only run in the browser
    if (typeof window === 'undefined') return;

    const load = () => {
      setWorkspace(getSelectedWorkspace());
    };

    load();
    const handleStorage = () => load();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('cdp.workspace_changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('cdp.workspace_changed', handleStorage);
    };
  }, []);

  return { workspace, setWorkspace: setSelectedWorkspace };
}
