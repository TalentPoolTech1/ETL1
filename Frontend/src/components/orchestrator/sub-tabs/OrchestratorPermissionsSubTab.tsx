import React, { useState } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';

type Role = 'Owner' | 'Editor' | 'Viewer';

interface GrantRow {
  id: string;
  principal: string;
  principalType: 'user' | 'group' | 'service-account';
  role: Role;
  inherited: boolean;
  expiry?: string;
}

const INITIAL_GRANTS: GrantRow[] = [
  { id: '1', principal: 'alice@acme.com',       principalType: 'user',            role: 'Owner',  inherited: false },
  { id: '2', principal: 'data-engineers',        principalType: 'group',           role: 'Editor', inherited: true  },
  { id: '3', principal: 'bi-readers',            principalType: 'group',           role: 'Viewer', inherited: true  },
  { id: '4', principal: 'etl-service-account',   principalType: 'service-account', role: 'Editor', inherited: false, expiry: '2026-06-01' },
];

const ROLE_STYLE: Record<Role, string> = {
  Owner:  'bg-warning-100 text-warning-800',
  Editor: 'bg-primary-100 text-primary-800',
  Viewer: 'bg-neutral-100 text-neutral-600',
};

const PRINCIPAL_ICON: Record<GrantRow['principalType'], string> = {
  'user':            '👤',
  'group':           '👥',
  'service-account': '⚙️',
};

export function OrchestratorPermissionsSubTab() {
  const [grants, setGrants]              = useState<GrantRow[]>(INITIAL_GRANTS);
  const [inheritFromProject, setInherit] = useState(true);
  const [showAdd, setShowAdd]            = useState(false);
  const [newPrincipal, setNewPrincipal]  = useState('');
  const [newRole, setNewRole]            = useState<Role>('Viewer');

  const addGrant = () => {
    if (!newPrincipal.trim()) return;
    setGrants(prev => [...prev, {
      id: Date.now().toString(),
      principal: newPrincipal.trim(),
      principalType: 'user',
      role: newRole,
      inherited: false,
    }]);
    setNewPrincipal('');
    setShowAdd(false);
  };

  const removeGrant = (id: string) =>
    setGrants(prev => prev.filter(g => g.id !== id));

  const changeRole = (id: string, role: Role) =>
    setGrants(prev => prev.map(g => g.id === id ? { ...g, role } : g));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Inheritance banner */}
      <div className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
        <div>
          <div className="text-sm font-medium text-neutral-800">Inherit permissions from project</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {inheritFromProject
              ? 'This orchestrator inherits project-level grants. Breaking inheritance creates an independent access list.'
              : 'Inheritance is broken. This orchestrator has a standalone access list.'}
          </div>
        </div>
        <button
          onClick={() => setInherit(v => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${inheritFromProject ? 'bg-primary-600' : 'bg-neutral-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${inheritFromProject ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Grants table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-700">Access grants</h3>
          <Button size="sm" onClick={() => setShowAdd(v => !v)}>+ Add grant</Button>
        </div>

        {showAdd && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
            <Input
              placeholder="user@domain.com or group name"
              value={newPrincipal}
              onChange={e => setNewPrincipal(e.target.value)}
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && addGrant()}
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as Role)}
              className="px-2 py-1.5 border border-neutral-300 rounded-md text-sm bg-white"
            >
              <option>Viewer</option>
              <option>Editor</option>
              <option>Owner</option>
            </select>
            <Button size="sm" onClick={addGrant}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        )}

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
              {grants.map(g => (
                <tr key={g.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <span className="mr-1.5">{PRINCIPAL_ICON[g.principalType]}</span>
                    <span className="text-neutral-800">{g.principal}</span>
                  </td>
                  <td className="px-4 py-2 text-neutral-500 capitalize">{g.principalType.replace('-', ' ')}</td>
                  <td className="px-4 py-2">
                    {g.inherited ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLE[g.role]}`}>
                        {g.role}
                      </span>
                    ) : (
                      <select
                        value={g.role}
                        onChange={e => changeRole(g.id, e.target.value as Role)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 outline-none cursor-pointer ${ROLE_STYLE[g.role]}`}
                      >
                        <option>Viewer</option>
                        <option>Editor</option>
                        <option>Owner</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{g.inherited ? 'Project' : 'Direct'}</td>
                  <td className="px-4 py-2 text-neutral-500">{g.expiry ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {!g.inherited && (
                      <button
                        onClick={() => removeGrant(g.id)}
                        className="text-neutral-400 hover:text-danger-600 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
