import React, { useEffect, useMemo, useState } from 'react';
import { Save, Plus, Trash2, Shield, Users } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved, updateTab } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import type { RoleSubTab } from '@/types';
import api from '@/services/api';

const SUB_TABS = [
  { id: 'properties',  label: 'Properties',  shortcut: '1' },
  { id: 'members',     label: 'Members',     shortcut: '2' },
  { id: 'permissions', label: 'Permissions', shortcut: '3' },
  { id: 'scope',       label: 'Scope',       shortcut: '4' },
  { id: 'history',     label: 'History',     shortcut: '5' },
  { id: 'audit',       label: 'Audit',       shortcut: '6' },
] satisfies { id: RoleSubTab; label: string; shortcut: string }[];

type RoleForm = {
  roleId: string;
  roleName: string;
  description: string;
  isSystemRole: boolean;
  createdOn: string;
};

type RoleMember = {
  userId: string;
  displayName: string;
  email: string;
  isActive: boolean;
  grantedOn: string | null;
};

type RolePermission = {
  permissionId: string;
  permCode: string;
  permDisplayName: string;
  permDesc: string;
  isAssigned: boolean;
};

function Field({ label, value, onChange, readOnly = false, multiline = false }: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {readOnly ? (
        <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500">
          {value || '—'}
        </div>
      ) : multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500"
        />
      )}
    </div>
  );
}

function MembersTab({
  members,
  users,
  canMutate,
  onAssign,
  onRemove,
  busyUserId,
}: {
  members: RoleMember[];
  users: Array<{ userId: string; displayName: string; email: string }>;
  canMutate: boolean;
  onAssign: (userId: string) => void;
  onRemove: (userId: string) => void;
  busyUserId: string | null;
}) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const memberIds = useMemo(() => new Set(members.map(m => m.userId)), [members]);
  const assignable = users.filter(user => !memberIds.has(user.userId));

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[13px] font-medium text-slate-300">Members</span>
        <span className="text-[11px] text-slate-600">· {members.length}</span>
      </div>

      {canMutate && (
        <div className="flex items-center gap-2 mb-4 max-w-xl">
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 flex-1"
          >
            <option value="">Select user to assign…</option>
            {assignable.map(user => (
              <option key={user.userId} value={user.userId}>
                {user.displayName || user.email}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!selectedUserId) return;
              onAssign(selectedUserId);
              setSelectedUserId('');
            }}
            disabled={!selectedUserId}
            className="flex items-center gap-1.5 h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Assign User
          </button>
        </div>
      )}

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg">
          <Users className="w-6 h-6 mb-2 opacity-40" />
          <p className="text-sm">No members assigned to this role.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {members.map(member => (
            <div key={member.userId} className="flex items-center gap-3 px-4 py-2.5 border border-slate-800 rounded-lg hover:bg-slate-800/40 group">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-white">
                  {(member.displayName || member.email || 'U').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-slate-200 truncate">{member.displayName || member.email}</div>
                <div className="text-[11px] text-slate-500 truncate">{member.email}</div>
              </div>
              <span className={`text-[11px] ${member.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                {member.isActive ? 'Active' : 'Inactive'}
              </span>
              {canMutate && (
                <button
                  onClick={() => onRemove(member.userId)}
                  disabled={busyUserId === member.userId}
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PermissionsTab({
  permissions,
  canMutate,
  onToggle,
}: {
  permissions: RolePermission[];
  canMutate: boolean;
  onToggle: (permissionId: string, value: boolean) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="text-[11px] text-slate-500 mb-3">
        Toggle permissions assigned to this role.
      </div>
      <div className="space-y-2">
        {permissions.map(perm => (
          <label key={perm.permissionId} className="flex items-start gap-3 p-3 border border-slate-800 rounded-lg hover:bg-slate-800/30">
            <input
              type="checkbox"
              checked={perm.isAssigned}
              onChange={e => onToggle(perm.permissionId, e.target.checked)}
              disabled={!canMutate}
              className="w-3.5 h-3.5 accent-blue-500 mt-0.5"
            />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-slate-200">{perm.permCode}</div>
              <div className="text-[11px] text-slate-500">
                {perm.permDisplayName || perm.permDesc || 'No description'}
              </div>
            </div>
          </label>
        ))}
        {permissions.length === 0 && (
          <div className="text-[12px] text-slate-500 border border-slate-800 rounded-lg p-4">No permissions returned for this role.</div>
        )}
      </div>
    </div>
  );
}

function ScopeTab() {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-lg">
        <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Scope Definition</div>
        <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg">
          <Shield className="w-6 h-6 mb-2 opacity-40" />
          <p className="text-sm">Role scope is global in the current governance model.</p>
        </div>
      </div>
    </div>
  );
}

export function RoleWorkspace({ tabId }: { tabId: string }) {
  const dispatch = useAppDispatch();
  const tab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'properties') as RoleSubTab;
  const roleId = tab?.objectId ?? '';

  const [form, setForm] = useState<RoleForm>({
    roleId,
    roleName: tab?.objectName ?? 'Role',
    description: '',
    isSystemRole: false,
    createdOn: '',
  });
  const [members, setMembers] = useState<RoleMember[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [users, setUsers] = useState<Array<{ userId: string; displayName: string; email: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const selectedPermissionIds = useMemo(
    () => permissions.filter(permission => permission.isAssigned).map(permission => permission.permissionId),
    [permissions],
  );

  const markDirty = () => {
    setIsDirty(true);
    dispatch(markTabUnsaved(tabId));
  };

  const loadRole = async () => {
    if (!roleId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [roleRes, usersRes] = await Promise.all([
        api.getRole(roleId),
        api.getUsers(),
      ]);
      const role = roleRes.data?.data ?? roleRes.data;
      const usersData = usersRes.data?.data ?? usersRes.data;
      setForm({
        roleId: role.roleId ?? roleId,
        roleName: role.roleName ?? tab?.objectName ?? 'Role',
        description: role.description ?? '',
        isSystemRole: role.isSystemRole === true,
        createdOn: role.createdOn ?? '',
      });
      setMembers((Array.isArray(role.members) ? role.members : []).map((member: any) => ({
        userId: String(member.userId),
        displayName: String(member.displayName ?? ''),
        email: String(member.email ?? ''),
        isActive: member.isActive !== false,
        grantedOn: member.grantedOn ?? null,
      })));
      setPermissions((Array.isArray(role.permissions) ? role.permissions : []).map((permission: any) => ({
        permissionId: String(permission.permissionId),
        permCode: String(permission.permCode ?? ''),
        permDisplayName: String(permission.permDisplayName ?? ''),
        permDesc: String(permission.permDesc ?? ''),
        isAssigned: permission.isAssigned === true,
      })));
      setUsers((Array.isArray(usersData) ? usersData : []).map((user: any) => ({
        userId: String(user.userId),
        displayName: String(user.displayName ?? ''),
        email: String(user.email ?? ''),
      })));
      dispatch(updateTab({ id: tabId, name: String(role.roleName ?? tab?.objectName ?? 'Role') }));
      setIsDirty(false);
      dispatch(markTabSaved(tabId));
    } catch (err: unknown) {
      setError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load role');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRole();
  }, [roleId]);

  const saveRole = async () => {
    if (!roleId || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.updateRole(roleId, {
        roleName: form.roleName,
        description: form.description,
      });
      await api.updateRolePermissions(roleId, selectedPermissionIds);
      await loadRole();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to save role');
    } finally {
      setIsSaving(false);
    }
  };

  const assignMember = async (userId: string) => {
    if (!roleId || !userId) return;
    setBusyUserId(userId);
    setError(null);
    try {
      await api.addRoleMember(roleId, userId);
      await loadRole();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to assign member');
    } finally {
      setBusyUserId(null);
    }
  };

  const removeMember = async (userId: string) => {
    if (!roleId || !userId) return;
    setBusyUserId(userId);
    setError(null);
    try {
      await api.removeRoleMember(roleId, userId);
      await loadRole();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to remove member');
    } finally {
      setBusyUserId(null);
    }
  };

  const canMutate = !form.isSystemRole;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="role"
        name={form.roleName || tab?.objectName || 'Role'}
        hierarchyPath={tab?.hierarchyPath ?? `Roles → ${form.roleName || 'Role'}`}
        isDirty={isDirty}
        actions={isDirty ? (
          <button
            onClick={saveRole}
            disabled={isSaving}
            className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving…' : 'Save'}
          </button>
        ) : undefined}
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="properties" />

      {error && (
        <div className="px-5 pt-3 text-[12px] text-red-400">{error}</div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Loading role…</div>
      ) : (
        <>
          {subTab === 'properties' && (
            <div className="flex-1 overflow-auto p-5">
              <div className="max-w-2xl space-y-4">
                <Field label="Role ID" value={form.roleId} readOnly />
                <Field
                  label="Role Name *"
                  value={form.roleName}
                  readOnly={!canMutate}
                  onChange={value => {
                    setForm(prev => ({ ...prev, roleName: value }));
                    markDirty();
                  }}
                />
                <Field
                  label="Description"
                  value={form.description}
                  multiline
                  onChange={value => {
                    setForm(prev => ({ ...prev, description: value }));
                    markDirty();
                  }}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="System Role" value={form.isSystemRole ? 'Yes' : 'No'} readOnly />
                  <Field label="Created On" value={form.createdOn} readOnly />
                </div>
              </div>
            </div>
          )}
          {subTab === 'members' && (
            <MembersTab
              members={members}
              users={users}
              canMutate={canMutate}
              onAssign={assignMember}
              onRemove={removeMember}
              busyUserId={busyUserId}
            />
          )}
          {subTab === 'permissions' && (
            <PermissionsTab
              permissions={permissions}
              canMutate={canMutate}
              onToggle={(permissionId, value) => {
                setPermissions(prev =>
                  prev.map(permission =>
                    permission.permissionId === permissionId
                      ? { ...permission, isAssigned: value }
                      : permission,
                  ),
                );
                markDirty();
              }}
            />
          )}
          {subTab === 'scope' && <ScopeTab />}
          {subTab === 'history' && (
            <div className="flex-1 overflow-hidden">
              <ObjectHistoryGrid rows={[]} emptyMessage="Role history endpoint is not yet exposed in the API." />
            </div>
          )}
          {subTab === 'audit' && (
            <div className="flex-1 overflow-hidden">
              <ObjectHistoryGrid rows={[]} emptyMessage="Role audit endpoint is not yet exposed in the API." />
            </div>
          )}
        </>
      )}
    </div>
  );
}
