import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import api from '@/services/api';

interface Grant {
  id: string;
  userId: string;
  roleId: string;
  principal: string;
  principalType: 'user' | 'group' | 'service-account';
  role: string;
  inherited: boolean;
  expiry?: string;
}

interface UserOption {
  userId: string;
  label: string;
}

interface RoleOption {
  roleId: string;
  roleName: string;
}

function parseErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? fallback;
}

function roleStyle(roleName: string): string {
  const normalized = roleName.toLowerCase();
  if (normalized.includes('owner') || normalized.includes('admin')) return 'bg-warning-100 text-warning-800';
  if (normalized.includes('edit') || normalized.includes('write')) return 'bg-primary-100 text-primary-800';
  return 'bg-neutral-100 text-neutral-600';
}

interface Props { pipelineId: string; }

export function PermissionsSubTab({ pipelineId }: Props) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inheritFromProject, setInherit] = useState(true);
  const [projectScoped, setProjectScoped] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPrincipalFilter, setNewPrincipalFilter] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [permissionsResponse, usersResponse, rolesResponse] = await Promise.all([
        api.getPipelinePermissions(pipelineId),
        api.getUsers(),
        api.getRoles(),
      ]);

      const permissionsData = permissionsResponse.data.data ?? permissionsResponse.data ?? {};
      const permissionRows = Array.isArray(permissionsData.grants) ? permissionsData.grants : [];
      const normalizedGrants = permissionRows.map((row: any) => ({
        id: String(row.id ?? `${row.userId}:${row.roleId}`),
        userId: String(row.userId ?? row.user_id ?? ''),
        roleId: String(row.roleId ?? row.role_id ?? ''),
        principal: String(row.principal ?? row.displayName ?? row.email ?? row.userId ?? row.user_id ?? 'Unknown user'),
        principalType: (row.principalType ?? 'user') as Grant['principalType'],
        role: String(row.role ?? row.roleName ?? row.role_display_name ?? 'Viewer'),
        inherited: Boolean(row.inherited ?? true),
        expiry: row.expiry ?? undefined,
      })) as Grant[];

      const userRows = (usersResponse.data.data ?? usersResponse.data ?? []).map((row: any) => {
        const userId = String(row.userId ?? row.user_id ?? '');
        const displayName = String(row.displayName ?? row.user_full_name ?? '').trim();
        const email = String(row.email ?? row.email_address ?? '').trim();
        const label = displayName || email || userId;
        return { userId, label };
      }).filter((row: UserOption) => row.userId);

      const roleRows = (rolesResponse.data.data ?? rolesResponse.data ?? []).map((row: any) => {
        const roleId = String(row.roleId ?? row.role_id ?? '');
        const roleName = String(row.roleName ?? row.role_display_name ?? '').trim();
        return { roleId, roleName: roleName || roleId };
      }).filter((row: RoleOption) => row.roleId);

      setGrants(normalizedGrants);
      setUsers(userRows);
      setRoles(roleRows);
      setNewUserId(prev => prev || userRows[0]?.userId || '');
      setNewRoleId(prev => prev || roleRows[0]?.roleId || '');
      if (permissionsData.inheritFromProject !== undefined) setInherit(Boolean(permissionsData.inheritFromProject));
      if (permissionsData.projectScoped !== undefined) setProjectScoped(Boolean(permissionsData.projectScoped));
    } catch (error) {
      setErrorMessage(parseErrorMessage(error, 'Failed to load permissions'));
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => { load(); }, [load]);

  const persist = async (updatedGrants: Grant[], inheritOverride?: boolean) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const payload = {
        grants: updatedGrants.map(grant => ({ userId: grant.userId, roleId: grant.roleId })),
        inheritFromProject: inheritOverride !== undefined ? inheritOverride : inheritFromProject,
      };
      const response = await api.updatePipelinePermissions(pipelineId, payload);
      const data = response.data.data ?? response.data ?? {};
      const rows = Array.isArray(data.grants) ? data.grants : [];
      if (rows.length > 0 || updatedGrants.length === 0) {
        setGrants(rows.map((row: any) => ({
          id: String(row.id ?? `${row.userId}:${row.roleId}`),
          userId: String(row.userId ?? row.user_id ?? ''),
          roleId: String(row.roleId ?? row.role_id ?? ''),
          principal: String(row.principal ?? row.displayName ?? row.email ?? row.userId ?? row.user_id ?? 'Unknown user'),
          principalType: (row.principalType ?? 'user') as Grant['principalType'],
          role: String(row.role ?? row.roleName ?? row.role_display_name ?? 'Viewer'),
          inherited: Boolean(row.inherited ?? true),
          expiry: row.expiry ?? undefined,
        })) as Grant[]);
      }
      if (data.inheritFromProject !== undefined) setInherit(Boolean(data.inheritFromProject));
      if (data.projectScoped !== undefined) setProjectScoped(Boolean(data.projectScoped));
    } catch (error) {
      setErrorMessage(parseErrorMessage(error, 'Failed to save permissions'));
    }
    finally { setSaving(false); }
  };

  const addGrant = async () => {
    if (!newUserId || !newRoleId) return;
    const selectedUser = users.find(user => user.userId === newUserId);
    const selectedRole = roles.find(role => role.roleId === newRoleId);
    if (!selectedUser || !selectedRole) return;
    const grantId = `${selectedUser.userId}:${selectedRole.roleId}`;
    if (grants.some(grant => grant.id === grantId)) {
      setErrorMessage('This user already has the selected role.');
      return;
    }
    const updated = [...grants, {
      id: grantId,
      userId: selectedUser.userId,
      roleId: selectedRole.roleId,
      principal: selectedUser.label,
      principalType: 'user' as const,
      role: selectedRole.roleName,
      inherited: true,
      expiry: undefined,
    }];
    setGrants(updated);
    await persist(updated);
    setNewPrincipalFilter('');
    setShowAdd(false);
  };

  const removeGrant = async (id: string) => {
    const updated = grants.filter(g => g.id !== id);
    setGrants(updated);
    await persist(updated);
  };

  const changeRole = async (id: string, roleId: string) => {
    const selectedRole = roles.find(role => role.roleId === roleId);
    if (!selectedRole) return;
    const updated = grants.map(grant => {
      if (grant.id !== id) return grant;
      const updatedId = `${grant.userId}:${selectedRole.roleId}`;
      return {
        ...grant,
        id: updatedId,
        roleId: selectedRole.roleId,
        role: selectedRole.roleName,
      };
    });
    setGrants(updated);
    await persist(updated);
  };

  const filteredUsers = users.filter(user => user.label.toLowerCase().includes(newPrincipalFilter.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Inheritance banner */}
      <div className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
        <div>
          <div className="text-sm font-medium text-neutral-800">Inherit permissions from project</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {!projectScoped
              ? 'Global pipelines are not tied to a project, so project grants do not apply.'
              : 'Pipeline access is project-scoped. Changes here update project member roles.'}
          </div>
        </div>
        <button
          type="button"
          disabled={!projectScoped}
          onClick={() => {
            if (!projectScoped) return;
            const next = !inheritFromProject;
            setInherit(next);
            void persist(grants, next);
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!projectScoped ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${inheritFromProject ? 'bg-primary-600' : 'bg-neutral-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${inheritFromProject ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Grants table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-700">Access grants {saving && <span className="text-xs text-neutral-400 font-normal ml-2">Saving…</span>}</h3>
          <Button size="sm" onClick={() => setShowAdd(v => !v)} disabled={!projectScoped}>+ Add grant</Button>
        </div>

        {errorMessage && (
          <div className="mb-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
            {errorMessage}
          </div>
        )}

        {showAdd && (
          <div className="space-y-2 mb-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
            <Input
              placeholder="Filter users"
              value={newPrincipalFilter}
              onChange={e => setNewPrincipalFilter(e.target.value)}
              className="w-full"
            />
            <div className="flex items-center gap-2">
              <select
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-neutral-300 rounded-md text-sm bg-white"
              >
                {filteredUsers.map(user => (
                  <option key={user.userId} value={user.userId}>{user.label}</option>
                ))}
              </select>
              <select value={newRoleId} onChange={e => setNewRoleId(e.target.value)}
              className="px-2 py-1.5 border border-neutral-300 rounded-md text-sm bg-white">
                {roles.map(role => (
                  <option key={role.roleId} value={role.roleId}>{role.roleName}</option>
                ))}
              </select>
              <Button size="sm" onClick={() => { void addGrant(); }}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
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
                      <span className="text-neutral-800">{g.principal}</span>
                    </td>
                    <td className="px-4 py-2 text-neutral-500 capitalize">{g.principalType.replace('-', ' ')}</td>
                    <td className="px-4 py-2">
                      <select value={g.roleId} onChange={e => { void changeRole(g.id, e.target.value); }}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 outline-none cursor-pointer ${roleStyle(g.role)}`}>
                        {roles.map(role => (
                          <option key={role.roleId} value={role.roleId}>{role.roleName}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{projectScoped ? 'Project' : 'None'}</td>
                    <td className="px-4 py-2 text-neutral-500">{g.expiry ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => { void removeGrant(g.id); }} disabled={!projectScoped}
                        className="text-neutral-400 hover:text-danger-600 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Remove</button>
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
