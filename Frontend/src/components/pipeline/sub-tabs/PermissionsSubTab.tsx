import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import api from '@/services/api';

type Role = 'Owner' | 'Editor' | 'Viewer';

interface Grant {
  id: string;
  principal: string;
  principalType: 'user' | 'group' | 'service-account';
  role: Role;
  inherited: boolean;
  expiry?: string;
}

const ROLE_STYLE: Record<Role, string> = {
  Owner:  'bg-warning-100 text-warning-800',
  Editor: 'bg-primary-100 text-primary-800',
  Viewer: 'bg-neutral-100 text-neutral-600',
};

const PRINCIPAL_ICON: Record<Grant['principalType'], string> = {
  'user': '👤', 'group': '👥', 'service-account': '⚙️',
};

interface Props { pipelineId: string; }

export function PermissionsSubTab({ pipelineId }: Props) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inheritFromProject, setInherit] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPrincipal, setNewPrincipal] = useState('');
  const [newRole, setNewRole] = useState<Role>('Viewer');

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await api.getPipelinePermissions(pipelineId);
      const data = res.data.data ?? res.data;
      setGrants(data.grants ?? data ?? []);
      if (data.inheritFromProject !== undefined) setInherit(data.inheritFromProject);
    } catch {
      /* permissions endpoint may not exist yet — stay with empty list */
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { load(); }, [load]);

  const persist = async (updatedGrants: Grant[], inherit: boolean) => {
    setSaving(true);
    try {
      await api.updatePipelinePermissions(pipelineId, { grants: updatedGrants, inheritFromProject: inherit });
    } catch { /* silently fail if backend not ready */ }
    finally { setSaving(false); }
  };

  const addGrant = () => {
    if (!newPrincipal.trim()) return;
    const updated = [...grants, {
      id: Date.now().toString(),
      principal: newPrincipal.trim(),
      principalType: 'user' as const,
      role: newRole,
      inherited: false,
    }];
    setGrants(updated);
    persist(updated, inheritFromProject);
    setNewPrincipal('');
    setShowAdd(false);
  };

  const removeGrant = (id: string) => {
    const updated = grants.filter(g => g.id !== id);
    setGrants(updated);
    persist(updated, inheritFromProject);
  };

  const changeRole = (id: string, role: Role) => {
    const updated = grants.map(g => g.id === id ? { ...g, role } : g);
    setGrants(updated);
    persist(updated, inheritFromProject);
  };

  const toggleInherit = () => {
    const next = !inheritFromProject;
    setInherit(next);
    persist(grants, next);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Inheritance banner */}
      <div className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
        <div>
          <div className="text-sm font-medium text-neutral-800">Inherit permissions from project</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {inheritFromProject
              ? 'This pipeline inherits project-level grants.'
              : 'Inheritance is broken — standalone access list.'}
          </div>
        </div>
        <button onClick={toggleInherit}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${inheritFromProject ? 'bg-primary-600' : 'bg-neutral-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${inheritFromProject ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Grants table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-700">Access grants {saving && <span className="text-xs text-neutral-400 font-normal ml-2">Saving…</span>}</h3>
          <Button size="sm" onClick={() => setShowAdd(v => !v)}>+ Add grant</Button>
        </div>

        {showAdd && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
            <Input placeholder="user@domain.com or group name" value={newPrincipal}
              onChange={e => setNewPrincipal(e.target.value)} className="flex-1"
              onKeyDown={e => e.key === 'Enter' && addGrant()} />
            <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}
              className="px-2 py-1.5 border border-neutral-300 rounded-md text-sm bg-white">
              <option>Viewer</option><option>Editor</option><option>Owner</option>
            </select>
            <Button size="sm" onClick={addGrant}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-neutral-400 py-4">Loading permissions…</div>
        ) : (
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  {['Principal', 'Type', 'Role', 'Source', 'Expires', ''].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-neutral-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {grants.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-400 text-sm">No access grants configured.</td></tr>
                )}
                {grants.map(g => (
                  <tr key={g.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2">
                      <span className="mr-1.5">{PRINCIPAL_ICON[g.principalType]}</span>
                      <span className="text-neutral-800">{g.principal}</span>
                    </td>
                    <td className="px-4 py-2 text-neutral-500 capitalize">{g.principalType.replace('-', ' ')}</td>
                    <td className="px-4 py-2">
                      {g.inherited ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLE[g.role]}`}>{g.role}</span>
                      ) : (
                        <select value={g.role} onChange={e => changeRole(g.id, e.target.value as Role)}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 outline-none cursor-pointer ${ROLE_STYLE[g.role]}`}>
                          <option>Viewer</option><option>Editor</option><option>Owner</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{g.inherited ? 'Project' : 'Direct'}</td>
                    <td className="px-4 py-2 text-neutral-500">{g.expiry ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {!g.inherited && (
                        <button onClick={() => removeGrant(g.id)}
                          className="text-neutral-400 hover:text-danger-600 text-xs transition-colors">Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
