/**
 * UserWorkspace — tab content for a User object.
 * Sub-tabs: Profile | Access | Activity | Audit | Sessions | Preferences
 */
import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, Monitor } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import type { UserSubTab } from '@/types';
import api from '@/services/api';

const SUB_TABS = [
  { id: 'profile',     label: 'Profile',     shortcut: '1' },
  { id: 'access',      label: 'Access',      shortcut: '2' },
  { id: 'activity',    label: 'Activity',    shortcut: '3' },
  { id: 'audit',       label: 'Audit',       shortcut: '4' },
  { id: 'sessions',    label: 'Sessions',    shortcut: '5' },
  { id: 'preferences', label: 'Preferences', shortcut: '6' },
] satisfies { id: UserSubTab; label: string; shortcut: string }[];

type FD = Record<string, unknown>;

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="text-slate-500 w-36 flex-shrink-0">{label}</span>
      <span className={`text-slate-300 ${mono ? 'font-mono text-[11px]' : ''}`}>{value || '—'}</span>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────

function UserStatusBadge({ status }: { status: string }) {
  const cfg = status === 'active'
    ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
    : status === 'inactive'
    ? 'bg-slate-700 text-slate-400 border-slate-600'
    : 'bg-red-900/40 text-red-300 border-red-700';
  return (
    <span className={`px-2 py-0.5 text-[11px] font-medium rounded border ${cfg}`}>{status}</span>
  );
}

// ─── Profile sub-tab ──────────────────────────────────────────────────────

function ProfileTab({ data, onChange }: { data: FD; onChange: (f: string, v: string) => void }) {
  const F = ({ label, field, ro }: { label: string; field: string; ro?: boolean }) => (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {ro ? (
        <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500">{String(data[field] ?? '—')}</div>
      ) : (
        <input type="text" value={String(data[field] ?? '')} onChange={e => onChange(field, e.target.value)}
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
      )}
    </div>
  );
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-start gap-6 mb-6">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-bold text-white">
            {String(data.displayName ?? data.username ?? 'U').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div>
          <div className="text-[18px] font-semibold text-slate-100">{String(data.displayName ?? '—')}</div>
          <div className="text-[13px] text-slate-500 mt-0.5">{String(data.email ?? '—')}</div>
          <div className="mt-1">
            <UserStatusBadge status={String(data.status ?? 'active')} />
          </div>
        </div>
      </div>
      <div className="max-w-2xl space-y-4">
        <F label="User ID" field="userId" ro />
        <div className="grid grid-cols-2 gap-4">
          <F label="Username" field="username" ro />
          <F label="Display Name" field="displayName" ro />
        </div>
        <F label="Email" field="email" ro />
        <div className="grid grid-cols-2 gap-4">
          <F label="User Type" field="userType" ro />
          <F label="Default Role" field="defaultRole" ro />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Locale" field="locale" ro />
          <F label="Time Zone" field="timezone" ro />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="MFA Status" field="mfaStatus" ro />
          <F label="Default Project" field="defaultProject" ro />
        </div>
        <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4">
          <F label="Created By" field="createdBy" ro />
          <F label="Created On" field="createdOn" ro />
          <F label="Last Login" field="lastLogin" ro />
          <F label="Updated On" field="updatedOn" ro />
        </div>
      </div>
    </div>
  );
}

// ─── Access sub-tab ───────────────────────────────────────────────────────

function AccessTab({ data }: { data: FD }) {
  const roles = (data.roles as string[] | undefined) ?? [];
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Assigned Roles</div>
          {roles.length === 0 ? (
            <p className="text-[12px] text-slate-600">No roles assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roles.map(r => (
                <span key={r} className="flex items-center gap-1.5 px-3 py-1 bg-orange-900/30 border border-orange-700/50 rounded text-[12px] text-orange-300">
                  <Shield className="w-3 h-3" />{r}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Admin Flags</div>
          {[
            { label: 'Platform Admin', flag: data.isPlatformAdmin },
            { label: 'User Admin',     flag: data.isUserAdmin },
            { label: 'Audit Access',   flag: data.hasAuditAccess },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2 text-[12px] py-1">
              <UserCheck className={`w-3.5 h-3.5 ${f.flag ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span className={f.flag ? 'text-slate-300' : 'text-slate-600'}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sessions sub-tab ─────────────────────────────────────────────────────

function SessionsTab() {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl">
        <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Active Sessions</div>
        <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg">
          <Monitor className="w-6 h-6 mb-2 opacity-40" />
          <p className="text-sm">No active sessions to display.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Preferences sub-tab ─────────────────────────────────────────────────

function PreferencesTab({ data }: { data: FD }) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-lg space-y-4">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Theme</label>
          <select value={String(data.theme ?? 'dark')} disabled
            className="h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full disabled:opacity-70">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Date Format</label>
          <select value={String(data.dateFormat ?? 'YYYY-MM-DD')} disabled
            className="h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full disabled:opacity-70">
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Default Landing Page</label>
          <select value={String(data.landingPage ?? 'dashboard')} disabled
            className="h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full disabled:opacity-70">
            <option value="dashboard">Dashboard</option>
            <option value="projects">Projects</option>
            <option value="monitor">Monitor</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────

export function UserWorkspace({ tabId }: { tabId: string }) {
  const tab       = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab    = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'profile') as UserSubTab;
  const userName  = tab?.objectName ?? 'User';

  const [formData, setFormData] = useState<FD>({
    userId: tab?.objectId ?? '',
    username: userName,
    displayName: userName,
    email: '',
    status: 'active',
    userType: 'standard',
    defaultRole: '',
    locale: 'en-US',
    timezone: 'UTC',
    mfaStatus: 'Disabled',
    defaultProject: '',
    createdBy: '—', createdOn: '—', lastLogin: '—', updatedOn: '—',
    roles: [],
    isPlatformAdmin: false, isUserAdmin: false, hasAuditAccess: false,
    theme: 'dark', dateFormat: 'YYYY-MM-DD', landingPage: 'dashboard',
  });

  // Load real user data on mount
  useEffect(() => {
    const userId = tab?.objectId;
    if (!userId) return;
    api.getUser(userId)
      .then(res => {
        const d = res.data?.data ?? res.data;
        if (!d) return;
        setFormData(prev => ({
          ...prev,
          userId:         d.userId          ?? d.user_id          ?? prev.userId,
          username:       d.username        ?? d.user_login_name  ?? d.email ?? prev.username,
          displayName:    d.displayName     ?? d.user_full_name   ?? prev.displayName,
          email:          d.email           ?? d.user_email       ?? prev.email,
          status:         (d.isActive ?? d.is_active_flag) === false ? 'inactive' : 'active',
          userType:       d.user_type_code   ?? d.userType        ?? prev.userType,
          defaultRole:    d.default_role_name ?? d.defaultRole     ?? prev.defaultRole,
          locale:         d.locale           ?? d.locale_code      ?? prev.locale,
          timezone:       d.timezone         ?? d.timezone_code    ?? prev.timezone,
          mfaStatus:      d.mfa_enabled_flag ? 'Enabled' : 'Disabled',
          createdBy:      d.created_by_name  ?? '—',
          createdOn:      d.createdOn        ?? d.created_dtm      ?? '—',
          lastLogin:      d.lastLogin        ?? d.last_login_dtm   ?? '—',
          updatedOn:      d.updatedOn        ?? d.updated_dtm      ?? '—',
          roles:          Array.isArray(d.roles) ? d.roles.map((r: any) => r?.roleName ?? r?.role_name ?? r).filter(Boolean) : prev.roles,
          isPlatformAdmin: d.is_platform_admin ?? false,
          isUserAdmin:     d.is_user_admin     ?? false,
          hasAuditAccess:  d.has_audit_access  ?? false,
        }));
      })
      .catch(() => { /* user may not exist yet — keep defaults */ });
  }, [tab?.objectId]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="user"
        name={String(formData.displayName ?? userName)}
        hierarchyPath={tab?.hierarchyPath ?? `Users → ${userName}`}
        isDirty={false}
        actions={undefined}
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="profile" />

      {subTab === 'profile'     && <ProfileTab data={formData} onChange={() => {}} />}
      {subTab === 'access'      && <AccessTab data={formData} />}
      {subTab === 'activity'    && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} emptyMessage="No activity records." /></div>}
      {subTab === 'audit'       && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} emptyMessage="No audit records." /></div>}
      {subTab === 'sessions'    && <SessionsTab />}
      {subTab === 'preferences' && <PreferencesTab data={formData} />}
    </div>
  );
}
