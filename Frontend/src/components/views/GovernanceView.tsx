import { useState, useEffect } from 'react';
import { ActivityTimeline } from '@/components/collaboration/CollaborationUI';
import { 
  Users, 
  Shield, 
  History, 
  UserPlus, 
  Search, 
  Filter,
  MoreVertical,
  Key
} from 'lucide-react';
import api from '@/services/api';

type GovernanceRoleDto =
  | string
  | {
      roleName?: string;
      role_name?: string;
      roleDisplayName?: string;
    };

type GovernanceUserDto = {
  displayName?: string;
  user_full_name?: string;
  username?: string;
  name?: string;
  email?: string;
  user_email?: string;
  roles?: GovernanceRoleDto[];
  role_name?: string;
  role?: string;
  isActive?: boolean;
  is_account_active?: boolean;
  is_active_flag?: boolean;
};

type GovernanceUserRow = {
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
};

type GovernanceRoleRow = {
  roleName: string;
  description: string;
  memberCount: number;
};

type GovernancePermissionRow = {
  permCode: string;
  permDesc: string;
};

function normalizeUser(user: GovernanceUserDto): GovernanceUserRow {
  const roleFromArray = Array.isArray(user.roles)
    ? user.roles
        .map(role => {
          if (typeof role === 'string') return role.trim();
          return (role.roleName ?? role.roleDisplayName ?? role.role_name ?? '').trim();
        })
        .find(Boolean)
    : '';
  const role = roleFromArray || (user.role_name ?? user.role ?? '').trim() || 'Unassigned';
  const isActive = (user.isActive ?? user.is_account_active ?? user.is_active_flag) !== false;
  return {
    name: (user.displayName ?? user.user_full_name ?? user.username ?? user.name ?? 'Unknown').trim(),
    email: (user.email ?? user.user_email ?? '').trim(),
    role,
    status: isActive ? 'Active' : 'Inactive',
  };
}

export function GovernanceView() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'audit'>('users');

  const [users, setUsers] = useState<GovernanceUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [roles, setRoles] = useState<GovernanceRoleRow[]>([]);
  const [permissions, setPermissions] = useState<GovernancePermissionRow[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  useEffect(() => {
    if (activeTab !== 'users') return;
    setLoadingUsers(true);
    setUsersError(null);
    api.getUsers()
      .then(res => {
        const data = res.data?.data ?? res.data;
        const mapped = (Array.isArray(data) ? data : []).map(row => normalizeUser((row ?? {}) as GovernanceUserDto));
        setUsers(mapped);
      })
      .catch((err: unknown) => {
        setUsers([]);
        setUsersError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load users');
      })
      .finally(() => setLoadingUsers(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'roles') return;
    setLoadingRoles(true);
    setRolesError(null);
    Promise.all([api.getRoles(), api.getPermissions()])
      .then(([rolesRes, permsRes]) => {
        const rawRoles = rolesRes.data?.data ?? rolesRes.data;
        const rawPerms = permsRes.data?.data ?? permsRes.data;
        const mappedRoles = (Array.isArray(rawRoles) ? rawRoles : []).map((role: any) => ({
          roleName: String(role.roleName ?? role.role_display_name ?? role.role_name ?? 'Unknown'),
          description: String(role.description ?? role.role_desc_text ?? ''),
          memberCount: Number(role.memberCount ?? role.member_count ?? 0),
        }));
        const mappedPerms = (Array.isArray(rawPerms) ? rawPerms : []).map((perm: any) => ({
          permCode: String(perm.permCode ?? perm.perm_code_name ?? 'UNKNOWN'),
          permDesc: String(perm.permDesc ?? perm.perm_desc_text ?? ''),
        }));
        setRoles(mappedRoles);
        setPermissions(mappedPerms);
      })
      .catch((err: unknown) => {
        setRoles([]);
        setPermissions([]);
        setRolesError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load roles and permissions');
      })
      .finally(() => setLoadingRoles(false));
  }, [activeTab]);

  const visibleUsers = users.filter(user => {
    const matchesSearch =
      !searchText ||
      user.name.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = !showActiveOnly || user.status === 'Active';
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 overflow-hidden">
      {/* Header */}
      <div className="bg-[#161b25] border-b border-slate-800 px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Governance & Security</h1>
          <p className="text-xs text-neutral-500 mt-1">Manage users, roles, and audit trails across the platform.</p>
        </div>
        <button
          disabled
          title="Invite flow is not implemented yet"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600/60 text-white text-xs font-semibold rounded-lg opacity-70 cursor-not-allowed"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite User (coming soon)</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-64 bg-[#161b25] border-r border-slate-800">
          <div className="p-4 space-y-1">
            <NavButton 
              icon={Users} 
              label="Users & Groups" 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')} 
            />
            <NavButton 
              icon={Shield} 
              label="Roles & Permissions" 
              active={activeTab === 'roles'} 
              onClick={() => setActiveTab('roles')} 
            />
            <NavButton 
              icon={History} 
              label="System Audit Log" 
              active={activeTab === 'audit'} 
              onClick={() => setActiveTab('audit')} 
            />
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8">
            {activeTab === 'users' && (
              <div className="space-y-6">
                {/* User Controls */}
                <div className="flex items-center justify-between">
                  <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input 
                      type="text" 
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      placeholder="Search users..." 
                      className="w-full pl-10 pr-4 py-2 bg-[#161b25] border border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                    />
                  </div>
                  <button onClick={() => setShowActiveOnly(v => !v)} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 border border-slate-800 rounded-lg hover:bg-[#161b25] hover:shadow-sm transition-all">
                    <Filter className="w-4 h-4" />
                    <span>{showActiveOnly ? 'Active Only' : 'Filter'}</span>
                  </button>
                </div>

                {/* User Table */}
                <div className="bg-[#161b25] rounded-xl border border-slate-800 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 border-b border-neutral-100">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {usersError ? (
                        <tr><td colSpan={4} className="px-6 py-4 text-sm text-red-600">{usersError}</td></tr>
                      ) : null}
                      {loadingUsers ? (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-neutral-400">Loading users…</td></tr>
                      ) : visibleUsers.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-neutral-400">No users found.</td></tr>
                      ) : visibleUsers.map(user => (
                        <tr key={`${user.email}-${user.name}`} className="hover:bg-neutral-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-medium text-neutral-600">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-neutral-900">{user.name}</p>
                                <p className="text-xs text-neutral-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-primary-50 text-primary-600 text-[12px] font-bold uppercase tracking-wider rounded border border-primary-100">
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${user.status === 'Active' ? 'text-emerald-600' : 'text-neutral-400'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                              {user.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              disabled
                              title="User row actions are not available yet"
                              className="p-1 rounded opacity-60 cursor-not-allowed"
                            >
                              <MoreVertical className="w-4 h-4 text-neutral-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'roles' && (
              <div className="max-w-4xl space-y-8">
                {rolesError && (
                  <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {rolesError}
                  </div>
                )}
                {loadingRoles ? (
                  <div className="p-6 bg-[#161b25] rounded-xl border border-slate-800 shadow-sm text-sm text-neutral-500">
                    Loading roles and permissions…
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="p-6 bg-[#161b25] rounded-xl border border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Key className="w-5 h-5 text-amber-500" />
                        <h3 className="text-sm font-semibold text-neutral-900">Roles</h3>
                      </div>
                      {roles.length === 0 ? (
                        <p className="text-sm text-neutral-500">No roles returned by governance API.</p>
                      ) : (
                        <div className="space-y-3">
                          {roles.map(role => (
                            <div key={role.roleName} className="rounded border border-slate-800 p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-neutral-900">{role.roleName}</p>
                                <span className="text-xs text-neutral-500">{role.memberCount} members</span>
                              </div>
                              <p className="text-xs text-neutral-500 mt-1">{role.description || 'No description'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-6 bg-[#161b25] rounded-xl border border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-5 h-5 text-primary-600" />
                        <h3 className="text-sm font-semibold text-neutral-900">Permissions</h3>
                      </div>
                      {permissions.length === 0 ? (
                        <p className="text-sm text-neutral-500">No permissions returned by governance API.</p>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-auto pr-1">
                          {permissions.map(perm => (
                            <div key={perm.permCode} className="rounded border border-slate-800 p-3">
                              <p className="text-xs font-semibold text-neutral-900">{perm.permCode}</p>
                              <p className="text-xs text-neutral-500 mt-1">{perm.permDesc || 'No description'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="space-y-8">
                <div className="p-6 bg-[#161b25] rounded-xl border border-slate-800 shadow-sm">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">System Audit Log</h3>
                  <p className="text-xs text-neutral-500">
                    Dedicated governance/system audit API is not yet implemented.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Activity Summary */}
          <div className="w-80 border-l border-slate-800 bg-[#161b25] p-6 overflow-y-auto">
            <ActivityTimeline activities={[]} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'bg-primary-50 text-primary-600' 
          : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
      }`}
    >
      <Icon className={`w-4 h-4 ${active ? 'text-primary-600' : 'text-neutral-400'}`} />
      <span>{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 bg-primary-600 rounded-full" />}
    </button>
  );
}
