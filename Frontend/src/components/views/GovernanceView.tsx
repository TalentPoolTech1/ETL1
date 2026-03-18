import React, { useState, useEffect } from 'react';
import { AuditLogsSubTab } from '@/components/pipeline/sub-tabs/AuditLogsSubTab';
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

export function GovernanceView() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'audit'>('users');

  const mockActivities: any[] = [
    { id: '1', user: 'Admin User', action: 'Created Project', target: 'Finance_ETL', timestamp: new Date(), icon: 'plus' },
    { id: '2', user: 'Data Engineer', action: 'Modified Pipeline', target: 'Sales_Sync', timestamp: new Date(Date.now() - 3600000), icon: 'edit' },
    { id: '3', user: 'Security Officer', action: 'Granted Permission', target: 'User_X', timestamp: new Date(Date.now() - 7200000), icon: 'key' },
  ];

  const [users, setUsers] = useState<{ name: string; email: string; role: string; status: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  useEffect(() => {
    if (activeTab !== 'users') return;
    setLoadingUsers(true);
    api.getUsers()
      .then(res => {
        const data = res.data?.data ?? res.data;
        const mapped = (Array.isArray(data) ? data : []).map((u: any) => ({
          name:   u.displayName    ?? u.user_full_name ?? u.username ?? u.name ?? 'Unknown',
          email:  u.email          ?? u.user_email     ?? '',
          role:   (Array.isArray(u.roles) ? u.roles.map((r: any) => r.roleName ?? r.role_name ?? r).filter(Boolean) : [u.role_name ?? u.role]).find(Boolean) ?? 'Viewer',
          status: (u.isActive ?? u.is_active_flag) === false ? 'Inactive' : 'Active',
        }));
        setUsers(mapped);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
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
      <div className="bg-white border-b border-neutral-200 px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Governance & Security</h1>
          <p className="text-xs text-neutral-500 mt-1">Manage users, roles, and audit trails across the platform.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 shadow-sm transition-all hover:shadow-md active:scale-95">
          <UserPlus className="w-4 h-4" />
          <span>Invite User</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-64 bg-white border-r border-neutral-200">
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
                      className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                    />
                  </div>
                  <button onClick={() => setShowActiveOnly(v => !v)} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-lg hover:bg-white hover:shadow-sm transition-all">
                    <Filter className="w-4 h-4" />
                    <span>{showActiveOnly ? 'Active Only' : 'Filter'}</span>
                  </button>
                </div>

                {/* User Table */}
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
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
                            <span className="px-2 py-1 bg-primary-50 text-primary-600 text-[10px] font-bold uppercase tracking-wider rounded border border-primary-100">
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
                            <button title="User row actions are not available yet" className="p-1 hover:bg-neutral-100 rounded">
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
                 <div className="p-6 bg-white rounded-xl border border-neutral-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <Key className="w-5 h-5 text-amber-500" />
                       <h3 className="text-sm font-semibold text-neutral-900">Permission Hierarchy</h3>
                    </div>
                    <p className="text-xs text-neutral-500">
                       Permissions follow an inheritance model from Organization down to individual Assets. 
                       RBAC policies defined here apply globally unless overridden at the project level.
                    </p>
                    <div className="pt-4 border-t border-neutral-100">
                       <button className="text-xs font-semibold text-primary-600 hover:underline">Manage Custom Roles</button>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="space-y-8">
                <AuditLogsSubTab pipelineId="" />
              </div>
            )}
          </div>

          {/* Right Sidebar - Activity Summary */}
          <div className="w-80 border-l border-neutral-200 bg-white p-6 overflow-y-auto">
            <ActivityTimeline activities={mockActivities} />
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
