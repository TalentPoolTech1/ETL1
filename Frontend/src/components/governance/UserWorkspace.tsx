/**
 * UserWorkspace — tab content for a User object.
 * Sub-tabs: Profile | Access | Preferences
 */
import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, UserX, KeyRound } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { markTabSaved, markTabUnsaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import type { UserSubTab } from '@/types';
import api from '@/services/api';

const SUB_TABS = [
  { id: 'profile',     label: 'Profile',     shortcut: '1' },
  { id: 'access',      label: 'Access',      shortcut: '2' },
  { id: 'preferences', label: 'Preferences', shortcut: '3' },
] satisfies { id: UserSubTab; label: string; shortcut: string }[];

type FD = Record<string, unknown>;

type UserRoleDto =
  | string
  | {
      roleName?: string;
      role_name?: string;
      role_display_name?: string;
    };

type UserDetailDto = {
  userId?: string;
  user_id?: string;
  username?: string;
  user_login_name?: string;
  displayName?: string;
  user_full_name?: string;
  email?: string;
  user_email?: string;
  isActive?: boolean;
  is_account_active?: boolean;
  is_active_flag?: boolean;
  user_type_code?: string;
  userType?: string;
  default_role_name?: string;
  defaultRole?: string;
  locale?: string;
  locale_code?: string;
  timezone?: string;
  timezone_code?: string;
  mfa_enabled_flag?: boolean;
  created_by_name?: string;
  createdOn?: string;
  created_dtm?: string;
  lastLogin?: string;
  last_login_dtm?: string;
  updatedOn?: string;
  updated_dtm?: string;
  roles?: UserRoleDto[];
  is_platform_admin?: boolean;
  is_user_admin?: boolean;
  has_audit_access?: boolean;
};

function normalizeRoleNames(roles: UserRoleDto[] | undefined): string[] {
  if (!Array.isArray(roles)) return [];
  return roles
    .map(role => {
      if (typeof role === 'string') return role.trim();
      return (role.roleName ?? role.role_display_name ?? role.role_name ?? '').trim();
    })
    .filter(Boolean);
}

function mapUserDetailToForm(prev: FD, data: UserDetailDto): FD {
  const roles = normalizeRoleNames(data.roles);
  const isActive = (data.isActive ?? data.is_account_active ?? data.is_active_flag) !== false;
  return {
    ...prev,
    userId: data.userId ?? data.user_id ?? prev.userId,
    username: data.username ?? data.user_login_name ?? data.email ?? prev.username,
    displayName: data.displayName ?? data.user_full_name ?? prev.displayName,
    email: data.email ?? data.user_email ?? prev.email,
    status: isActive ? 'active' : 'inactive',
    userType: data.user_type_code ?? data.userType ?? prev.userType,
    defaultRole: data.default_role_name ?? data.defaultRole ?? roles[0] ?? prev.defaultRole,
    locale: data.locale ?? data.locale_code ?? prev.locale,
    timezone: data.timezone ?? data.timezone_code ?? prev.timezone,
    mfaStatus: data.mfa_enabled_flag ? 'Enabled' : 'Disabled',
    createdBy: data.created_by_name ?? '—',
    createdOn: data.createdOn ?? data.created_dtm ?? '—',
    lastLogin: data.lastLogin ?? data.last_login_dtm ?? '—',
    updatedOn: data.updatedOn ?? data.updated_dtm ?? '—',
    roles,
    isPlatformAdmin: data.is_platform_admin ?? false,
    isUserAdmin: data.is_user_admin ?? false,
    hasAuditAccess: data.has_audit_access ?? false,
  };
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

function ResetPasswordForm({ onDone }: { onDone: () => void }) {
  const [newPwd, setNewPwd]       = useState('');
  const [confirmPwd, setConfirm] = useState('');
  const [current, setCurrent]    = useState('');
  const [saving, setSaving]      = useState(false);
  const [error, setError]        = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setError('Passwords do not match'); return; }
    if (newPwd.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.changePassword({ currentPassword: current, newPassword: newPwd });
      onDone();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage
        ?? 'Failed to change password',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="mt-4 p-4 border border-slate-700 rounded-lg bg-slate-900/50 max-w-sm space-y-3">
      <div className="text-[12px] font-medium text-slate-300">Change Password</div>
      {error && <div className="text-[12px] text-red-400">{error}</div>}
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">Current password</label>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">New password</label>
        <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">Confirm new password</label>
        <input type="password" value={confirmPwd} onChange={e => setConfirm(e.target.value)} required
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving}
          className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Update Password'}
        </button>
        <button type="button" onClick={onDone}
          className="h-8 px-3 border border-slate-600 text-slate-300 rounded text-[12px] hover:bg-slate-800">
          Cancel
        </button>
      </div>
    </form>
  );
}

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
          <F label="Display Name" field="displayName" />
        </div>
        <F label="Email" field="email" />
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Account Status</label>
          <select
            value={String(data.status ?? 'active')}
            onChange={e => onChange('status', e.target.value)}
            className="h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full"
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
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
  const dispatch  = useAppDispatch();
  const tab       = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const selectedSubTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'profile') as UserSubTab;
  const subTab = SUB_TABS.some(t => t.id === selectedSubTab) ? selectedSubTab : 'profile';
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
  const [loadError, setLoadError]             = useState<string | null>(null);
  const [saveError, setSaveError]             = useState<string | null>(null);
  const [isDirty, setIsDirty]                 = useState(false);
  const [isSaving, setIsSaving]               = useState(false);
  const [isDeactivating, setDeactivating]     = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [showResetPwd, setShowResetPwd]       = useState(false);

  // Load real user data on mount
  useEffect(() => {
    const userId = tab?.objectId;
    if (!userId) return;
    setLoadError(null);
    api.getUser(userId)
      .then(res => {
        const d = res.data?.data ?? res.data;
        if (!d) return;
        setFormData(prev => mapUserDetailToForm(prev, d as UserDetailDto));
        setIsDirty(false);
        dispatch(markTabSaved(tabId));
      })
      .catch((err: unknown) => {
        setLoadError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load user details');
      });
  }, [dispatch, tab?.objectId, tabId]);

  useEffect(() => {
    if (isDirty) dispatch(markTabUnsaved(tabId));
    else dispatch(markTabSaved(tabId));
  }, [dispatch, isDirty, tabId]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveError(null);
  };

  const handleSave = async () => {
    const userId = String(formData.userId ?? tab?.objectId ?? '').trim();
    if (!userId || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = {
        displayName: String(formData.displayName ?? '').trim(),
        email: String(formData.email ?? '').trim(),
        isActive: String(formData.status ?? 'active') === 'active',
      };
      const response = await api.updateUser(userId, payload);
      const data = response.data?.data ?? response.data;
      if (data) {
        setFormData(prev => mapUserDetailToForm(prev, data as UserDetailDto));
      }
      setIsDirty(false);
      dispatch(markTabSaved(tabId));
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to save user details';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="user"
        name={String(formData.displayName ?? userName)}
        hierarchyPath={tab?.hierarchyPath ?? `Users → ${userName}`}
        isDirty={isDirty}
        actions={isDirty ? (
          <button
            onClick={() => { void handleSave(); }}
            disabled={isSaving}
            className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        ) : undefined}
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="profile" />
      {loadError && (
        <div className="mx-5 mt-4 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">
          {loadError}
        </div>
      )}
      {saveError && (
        <div className="mx-5 mt-4 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">
          {saveError}
        </div>
      )}

      {subTab === 'profile'     && (
        <>
          <ProfileTab data={formData} onChange={handleFieldChange} />
          <div className="flex-shrink-0 px-5 pb-5">
            <div className="max-w-2xl border-t border-slate-800 pt-4">
              <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Account Actions</div>
              {deactivateError && (
                <div className="mb-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">{deactivateError}</div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetPwd(v => !v)}
                  className="flex items-center gap-1.5 h-8 px-3 border border-slate-600 text-slate-300 rounded text-[12px] hover:bg-slate-800 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {showResetPwd ? 'Cancel Password Change' : 'Change Password'}
                </button>
                {String(formData.status ?? 'active') === 'active' ? (
                  <button
                    type="button"
                    disabled={isDeactivating}
                    onClick={async () => {
                      const userId = String(formData.userId ?? tab?.objectId ?? '').trim();
                      if (!userId || !window.confirm('Deactivate this account? The user will no longer be able to log in.')) return;
                      setDeactivating(true);
                      setDeactivateError(null);
                      try {
                        await api.updateUser(userId, { isActive: false });
                        handleFieldChange('status', 'inactive');
                      } catch (err: unknown) {
                        setDeactivateError(
                          (err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage
                          ?? 'Failed to deactivate account',
                        );
                      } finally {
                        setDeactivating(false);
                      }
                    }}
                    className="flex items-center gap-1.5 h-8 px-3 border border-red-800 text-red-400 rounded text-[12px] hover:bg-red-950/30 transition-colors disabled:opacity-50"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    {isDeactivating ? 'Deactivating…' : 'Deactivate Account'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isDeactivating}
                    onClick={async () => {
                      const userId = String(formData.userId ?? tab?.objectId ?? '').trim();
                      if (!userId || !window.confirm('Reactivate this account?')) return;
                      setDeactivating(true);
                      setDeactivateError(null);
                      try {
                        await api.updateUser(userId, { isActive: true });
                        handleFieldChange('status', 'active');
                      } catch (err: unknown) {
                        setDeactivateError(
                          (err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage
                          ?? 'Failed to reactivate account',
                        );
                      } finally {
                        setDeactivating(false);
                      }
                    }}
                    className="flex items-center gap-1.5 h-8 px-3 border border-emerald-800 text-emerald-400 rounded text-[12px] hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {isDeactivating ? 'Reactivating…' : 'Reactivate Account'}
                  </button>
                )}
              </div>
              {showResetPwd && <ResetPasswordForm onDone={() => setShowResetPwd(false)} />}
            </div>
          </div>
        </>
      )}
      {subTab === 'access'      && <AccessTab data={formData} />}
      {subTab === 'preferences' && <PreferencesTab data={formData} />}
    </div>
  );
}
