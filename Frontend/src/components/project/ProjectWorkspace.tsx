/**
 * ProjectWorkspace — tab content for a Project object.
 * Sub-tabs: Overview | Properties | Permissions
 */
import { useEffect, useState, useCallback } from 'react';
import { Save } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import type { ProjectSubTab } from '@/types';
import api from '@/services/api';

const SUB_TABS = [
  { id: 'overview',    label: 'Overview',    shortcut: '1' },
  { id: 'properties',  label: 'Properties',  shortcut: '2' },
  { id: 'permissions', label: 'Permissions', shortcut: '3' },
] satisfies { id: ProjectSubTab; label: string; shortcut: string }[];

type FormData = Record<string, unknown>;
type ProjectApiDto = {
  project_id?: string;
  projectId?: string;
  project_display_name?: string;
  projectDisplayName?: string;
  project_desc_text?: string | null;
  projectDescText?: string | null;
  created_dtm?: string;
  createdOn?: string;
  updated_dtm?: string;
  updatedOn?: string;
};

type ProjectMemberDto = {
  userId?: string;
  user_id?: string;
  displayName?: string;
  user_full_name?: string;
  email?: string;
  email_address?: string;
  roleId?: string;
  role_id?: string;
  roleName?: string;
  role_display_name?: string;
  grantedOn?: string;
  granted_dtm?: string;
};

type GovernanceUserDto = {
  userId?: string;
  user_id?: string;
  displayName?: string;
  user_full_name?: string;
  email?: string;
  email_address?: string;
};

type RoleDto = {
  roleId?: string;
  role_id?: string;
  roleName?: string;
  role_display_name?: string;
};

function mapApiProjectToForm(prev: FormData, d: ProjectApiDto): FormData {
  return {
    ...prev,
    projectId: d.project_id ?? d.projectId ?? prev.projectId,
    name: d.project_display_name ?? d.projectDisplayName ?? prev.name,
    description: d.project_desc_text ?? d.projectDescText ?? prev.description ?? '',
    createdOn: d.created_dtm ?? d.createdOn ?? prev.createdOn,
    updatedOn: d.updated_dtm ?? d.updatedOn ?? prev.updatedOn,
  };
}

function toProjectUpdatePayload(formData: FormData): { projectDisplayName: string; projectDescText: string } {
  return {
    projectDisplayName: String(formData.name ?? '').trim(),
    projectDescText: String(formData.description ?? ''),
  };
}

function apiUserMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? fallback;
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="text-slate-300 w-32 flex-shrink-0">{label}</span>
      <span className={`text-slate-300 break-all ${mono ? 'font-mono text-[12px]' : ''}`}>{value || '—'}</span>
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: FormData }) {
  const stats = [
    { label: 'Directories',   value: data.folderCount ?? 0 },
    { label: 'Pipelines',     value: data.pipelineCount ?? 0 },
    { label: 'Orchestrators', value: data.orchestratorCount ?? 0 },
    { label: 'Connections',   value: data.connectionCount ?? 0 },
    { label: 'Members',       value: data.memberCount ?? 0 },
  ];
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-100">{String(s.value)}</div>
            <div className="text-[12px] text-slate-300 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="text-[12px] text-slate-300 font-semibold uppercase tracking-wide mb-3">Details</div>
          <InfoRow label="Project ID" value={String(data.projectId ?? '')} mono />
          <InfoRow label="Status" value={String(data.status ?? 'draft')} />
          <InfoRow label="Created By" value={String(data.createdBy ?? '')} />
          <InfoRow label="Created On" value={String(data.createdOn ?? '')} />
          <InfoRow label="Updated By" value={String(data.updatedBy ?? '')} />
          <InfoRow label="Updated On" value={String(data.updatedOn ?? '')} />
          <InfoRow label="Version" value={String(data.version ?? '1')} />
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
          <div className="text-[12px] text-slate-300 font-semibold uppercase tracking-wide mb-3">Description</div>
          <p className="text-[13px] text-slate-300 leading-relaxed">{String(data.description || 'No description provided.')}</p>
          {Array.isArray(data.tags) && (data.tags as string[]).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {(data.tags as string[]).map(t => (
                <span key={t} className="px-2 py-0.5 bg-blue-900/30 border border-blue-700/50 text-blue-300 text-[12px] rounded">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Properties ───────────────────────────────────────────────────────────

function PropertiesTab({ data, onChange }: { data: FormData; onChange: (f: string, v: string) => void }) {
  const Field = ({ label, field, ro, ta }: { label: string; field: string; ro?: boolean; ta?: boolean }) => (
    <div>
      <label className="field-label">{label}</label>
      {ro ? (
        <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-300 font-mono">
          {String(data[field] ?? '—')}
        </div>
      ) : ta ? (
        <textarea
          rows={3}
          value={String(data[field] ?? '')}
          onChange={e => onChange(field, e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none"
        />
      ) : (
        <input
          type="text"
          value={String(data[field] ?? '')}
          onChange={e => onChange(field, e.target.value)}
          className="field-input"
        />
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <Field label="Project ID" field="projectId" ro />
        <Field label="Project Name *" field="name" />
        <Field label="Description" field="description" ta />
        <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 text-[12px] text-slate-400">
          Additional metadata fields are hidden here until backend persistence is available.
        </div>
        <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4">
          <Field label="Created By" field="createdBy" ro />
          <Field label="Created On" field="createdOn" ro />
          <Field label="Updated By" field="updatedBy" ro />
          <Field label="Updated On" field="updatedOn" ro />
          <Field label="Last Opened By" field="lastOpenedBy" ro />
          <Field label="Last Opened On" field="lastOpenedOn" ro />
          <Field label="Version" field="version" ro />
          <Field label="Lock State" field="lockState" ro />
        </div>
      </div>
    </div>
  );
}

// ─── Permissions ──────────────────────────────────────────────────────────

type ProjectMemberRow = {
  userId: string;
  displayName: string;
  email: string;
  roleId: string;
  roleName: string;
  grantedOn: string;
};

type UserOption = {
  userId: string;
  label: string;
};

type RoleOption = {
  roleId: string;
  roleName: string;
};

function ProjectPermissionsTab({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [membersRes, usersRes, rolesRes] = await Promise.all([
        api.getProjectMembers(projectId),
        api.getUsers(),
        api.getRoles(),
      ]);

      const memberRows = ((membersRes.data?.data ?? membersRes.data) as ProjectMemberDto[]).map(row => {
        const userId = String(row.userId ?? row.user_id ?? '');
        const displayName = String(row.displayName ?? row.user_full_name ?? '').trim();
        const email = String(row.email ?? row.email_address ?? '').trim();
        return {
          userId,
          displayName: displayName || email || userId,
          email,
          roleId: String(row.roleId ?? row.role_id ?? ''),
          roleName: String(row.roleName ?? row.role_display_name ?? '').trim() || 'Unknown role',
          grantedOn: String(row.grantedOn ?? row.granted_dtm ?? ''),
        };
      }).filter(row => row.userId && row.roleId);

      const userOptions = ((usersRes.data?.data ?? usersRes.data) as GovernanceUserDto[]).map(row => {
        const userId = String(row.userId ?? row.user_id ?? '');
        const displayName = String(row.displayName ?? row.user_full_name ?? '').trim();
        const email = String(row.email ?? row.email_address ?? '').trim();
        return {
          userId,
          label: displayName || email || userId,
        };
      }).filter(row => row.userId);

      const roleOptions = ((rolesRes.data?.data ?? rolesRes.data) as RoleDto[]).map(row => {
        const roleId = String(row.roleId ?? row.role_id ?? '');
        const roleName = String(row.roleName ?? row.role_display_name ?? '').trim();
        return {
          roleId,
          roleName: roleName || roleId,
        };
      }).filter(row => row.roleId);

      setMembers(memberRows);
      setUsers(userOptions);
      setRoles(roleOptions);
      setNewRoleId(prev => prev || roleOptions[0]?.roleId || '');
    } catch (err: unknown) {
      setError(apiUserMessage(err, 'Failed to load project permissions'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const memberUserIds = new Set(members.map(member => member.userId));
  const availableUsers = users.filter(user => !memberUserIds.has(user.userId));

  useEffect(() => {
    if (!availableUsers.some(user => user.userId === newUserId)) {
      setNewUserId(availableUsers[0]?.userId ?? '');
    }
  }, [availableUsers, newUserId]);

  const mutate = async (run: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await run();
      await load();
    } catch (err: unknown) {
      setError(apiUserMessage(err, 'Permission update failed'));
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!newUserId || !newRoleId) return;
    await mutate(async () => {
      await api.addProjectMember(projectId, { userId: newUserId, roleId: newRoleId });
      setShowAdd(false);
    });
  };

  const removeMember = async (userId: string) => {
    await mutate(async () => {
      await api.removeProjectMember(projectId, userId);
    });
  };

  const changeRole = async (userId: string, roleId: string) => {
    await mutate(async () => {
      await api.removeProjectMember(projectId, userId);
      await api.addProjectMember(projectId, { userId, roleId });
    });
  };

  return (
    <div className="flex-1 overflow-auto p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-400">Project members and their roles</div>
        <button
          type="button"
          onClick={() => setShowAdd(v => !v)}
          disabled={saving || availableUsers.length === 0 || roles.length === 0}
          className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-[12px] text-white"
        >
          Add Member
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="rounded border border-slate-700 bg-slate-900/50 p-3 flex items-center gap-2">
          <select
            value={newUserId}
            onChange={e => setNewUserId(e.target.value)}
            className="flex-1 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200"
          >
            {availableUsers.map(user => (
              <option key={user.userId} value={user.userId}>{user.label}</option>
            ))}
          </select>
          <select
            value={newRoleId}
            onChange={e => setNewRoleId(e.target.value)}
            className="h-8 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200"
          >
            {roles.map(role => (
              <option key={role.roleId} value={role.roleId}>{role.roleName}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { void addMember(); }}
            className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-500 text-[12px] text-white"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="h-8 px-3 rounded border border-slate-600 text-[12px] text-slate-300"
          >
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-slate-400">Loading permissions…</div>
      ) : (
        <div className="rounded border border-slate-700 overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-800/70 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Member</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Granted</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-slate-300">No project members assigned.</td>
                </tr>
              )}
              {members.map(member => (
                <tr key={`${member.userId}:${member.roleId}`} className="bg-slate-900/30">
                  <td className="px-3 py-2 text-slate-200">{member.displayName}</td>
                  <td className="px-3 py-2 text-slate-400">{member.email || '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={member.roleId}
                      onChange={e => { void changeRole(member.userId, e.target.value); }}
                      disabled={saving}
                      className="h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 disabled:opacity-50"
                    >
                      {roles.map(role => (
                        <option key={role.roleId} value={role.roleId}>{role.roleName}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{member.grantedOn || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => { void removeMember(member.userId); }}
                      disabled={saving}
                      className="text-[12px] text-red-300 hover:text-red-200 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────

export function ProjectWorkspace({ tabId }: { tabId: string }) {
  const dispatch    = useAppDispatch();
  const tab         = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const selectedSubTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'overview') as ProjectSubTab;
  const subTab = SUB_TABS.some(t => t.id === selectedSubTab) ? selectedSubTab : 'overview';
  const projectId   = tab?.objectId ?? '';
  const projectName = tab?.objectName ?? 'Project';

  const [formData, setFormData] = useState<FormData>({
    projectId,
    name: projectName,
    description: '',
    status: 'draft',
    version: '1',
    lockState: 'Unlocked',
    createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
    lastOpenedBy: '—', lastOpenedOn: '—',
    folderCount: 0, pipelineCount: 0, orchestratorCount: 0, connectionCount: 0, memberCount: 0,
  });
  const [isDirty, setIsDirty]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoadError(null);
    api.getProject(projectId)
      .then(res => {
        const d = (res.data?.data ?? res.data) as ProjectApiDto | undefined;
        if (!d) return;
        setFormData(prev => mapApiProjectToForm(prev, d));
      })
      .catch((err: unknown) => {
        setLoadError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load project');
      });
  }, [projectId]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    dispatch(markTabUnsaved(tabId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = toProjectUpdatePayload(formData);
      const res = await api.updateProject(projectId, payload);
      const d = (res.data?.data ?? res.data) as ProjectApiDto | undefined;
      if (d) {
        setFormData(prev => mapApiProjectToForm(prev, d));
      }
      setIsDirty(false);
      dispatch(markTabSaved(tabId));
    } catch (err: unknown) {
      setSaveError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to save project');
    }
    finally { setIsSaving(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="project"
        name={String(formData.name ?? projectName)}
        hierarchyPath={tab?.hierarchyPath ?? `Projects → ${projectName}`}
        status={(formData.status as 'draft') ?? 'draft'}
        isDirty={isDirty}
        actions={isDirty ? (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        ) : undefined}
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="overview" />

      {(loadError || saveError) && (
        <div className="mx-5 mt-4 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">
          {saveError ?? loadError}
        </div>
      )}

      {subTab === 'overview'    && <OverviewTab data={formData} />}
      {subTab === 'properties'  && <PropertiesTab data={formData} onChange={handleChange} />}
      {subTab === 'permissions' && <ProjectPermissionsTab projectId={projectId} />}
    </div>
  );
}
