/**
 * RoleWorkspace — tab content for a Role object.
 * Sub-tabs: Properties | Members | Permissions | Scope | History | Audit
 */
import React, { useState } from 'react';
import { Save, Plus, Trash2, Shield, Users } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import type { RoleSubTab } from '@/types';

const SUB_TABS = [
  { id: 'properties',  label: 'Properties',  shortcut: '1' },
  { id: 'members',     label: 'Members',     shortcut: '2' },
  { id: 'permissions', label: 'Permissions', shortcut: '3' },
  { id: 'scope',       label: 'Scope',       shortcut: '4' },
  { id: 'history',     label: 'History',     shortcut: '5' },
  { id: 'audit',       label: 'Audit',       shortcut: '6' },
] satisfies { id: RoleSubTab; label: string; shortcut: string }[];

type FD = Record<string, unknown>;

// ─── Properties sub-tab ───────────────────────────────────────────────────

function PropertiesTab({ data, onChange }: { data: FD; onChange: (f: string, v: string) => void }) {
  const F = ({ label, field, ro, ta }: { label: string; field: string; ro?: boolean; ta?: boolean }) => (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {ro ? (
        <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500">{String(data[field] ?? '—')}</div>
      ) : ta ? (
        <textarea rows={3} value={String(data[field] ?? '')} onChange={e => onChange(field, e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" />
      ) : (
        <input type="text" value={String(data[field] ?? '')} onChange={e => onChange(field, e.target.value)}
          className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <F label="Role ID" field="roleId" ro />
        <F label="Role Name *" field="name" />
        <F label="Description" field="description" ta />
        <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4 text-[12px]">
          {[
            { label: 'System Role', field: 'isSystemRole' },
            { label: 'Custom Role', field: 'isCustomRole' },
            { label: 'Assignable',  field: 'isAssignable' },
          ].map(f => (
            <div key={f.field} className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(data[f.field])} onChange={e => onChange(f.field, String(e.target.checked))}
                className="w-3.5 h-3.5 accent-blue-500" />
              <label className="text-slate-300">{f.label}</label>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Created By" field="createdBy" ro />
          <F label="Created On" field="createdOn" ro />
          <F label="Updated By" field="updatedBy" ro />
          <F label="Updated On" field="updatedOn" ro />
        </div>
      </div>
    </div>
  );
}

// ─── Members sub-tab ──────────────────────────────────────────────────────

function MembersTab({ members }: { members: string[] }) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[13px] font-medium text-slate-300">Members</span>
        <span className="text-[11px] text-slate-600">· {members.length}</span>
        <button className="ml-auto flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors">
          <Plus className="w-3 h-3" /> Assign User
        </button>
      </div>
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg">
          <Users className="w-6 h-6 mb-2 opacity-40" />
          <p className="text-sm">No members assigned to this role.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {members.map(m => (
            <div key={m} className="flex items-center gap-3 px-4 py-2.5 border border-slate-800 rounded-lg hover:bg-slate-800/40 group">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-white">{m.slice(0, 2).toUpperCase()}</span>
              </div>
              <span className="text-[13px] text-slate-200 flex-1">{m}</span>
              <button className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Permissions matrix sub-tab ───────────────────────────────────────────

const RESOURCES = ['Projects', 'Folders', 'Pipelines', 'Orchestrators', 'Connections', 'Metadata', 'Users', 'Roles', 'Execution Logs', 'Admin Settings'];
const PERMS = ['View', 'Edit', 'Delete', 'Run', 'Publish', 'Manage Permissions'];

function PermissionsMatrixTab({ matrix, onChange }: {
  matrix: Record<string, Record<string, boolean>>;
  onChange: (resource: string, perm: string, val: boolean) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="text-[11px] text-slate-500 mb-3">Click cells to toggle permissions for this role.</div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-[11px] text-slate-500 border-b border-slate-800">
              <th className="px-3 py-2 font-medium w-36">Resource</th>
              {PERMS.map(p => (
                <th key={p} className="px-3 py-2 font-medium text-center whitespace-nowrap">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map(r => (
              <tr key={r} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                <td className="px-3 py-2 text-slate-300 font-medium">{r}</td>
                {PERMS.map(p => {
                  const checked = matrix[r]?.[p] ?? false;
                  return (
                    <td key={p} className="px-3 py-2 text-center">
                      <button
                        onClick={() => onChange(r, p, !checked)}
                        className={`w-5 h-5 rounded border flex items-center justify-center mx-auto transition-colors ${
                          checked ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700 hover:border-blue-600'
                        }`}
                      >
                        {checked && <span className="text-white text-[10px] font-bold">✓</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Scope sub-tab ────────────────────────────────────────────────────────

function ScopeTab() {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-lg">
        <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Scope Definition</div>
        <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg">
          <Shield className="w-6 h-6 mb-2 opacity-40" />
          <p className="text-sm">Scope configuration is managed by the platform administrator.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────

export function RoleWorkspace({ tabId }: { tabId: string }) {
  const dispatch  = useAppDispatch();
  const tab       = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab    = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'properties') as RoleSubTab;
  const roleName  = tab?.objectName ?? 'Role';

  const [formData, setFormData] = useState<FD>({
    roleId: tab?.objectId ?? '',
    name: roleName,
    description: '',
    status: 'active',
    isSystemRole: false, isCustomRole: true, isAssignable: true,
    createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
  });
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [isDirty, setIsDirty]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    dispatch(markTabUnsaved(tabId));
  };

  const handleMatrixChange = (resource: string, perm: string, val: boolean) => {
    setMatrix(prev => ({ ...prev, [resource]: { ...(prev[resource] ?? {}), [perm]: val } }));
    setIsDirty(true);
    dispatch(markTabUnsaved(tabId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 300));
    setIsDirty(false);
    dispatch(markTabSaved(tabId));
    setIsSaving(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="role"
        name={String(formData.name ?? roleName)}
        hierarchyPath={tab?.hierarchyPath ?? `Roles → ${roleName}`}
        isDirty={isDirty}
        actions={isDirty ? (
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50">
            <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving…' : 'Save'}
          </button>
        ) : undefined}
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="properties" />

      {subTab === 'properties'  && <PropertiesTab data={formData} onChange={handleChange} />}
      {subTab === 'members'     && <MembersTab members={[]} />}
      {subTab === 'permissions' && <PermissionsMatrixTab matrix={matrix} onChange={handleMatrixChange} />}
      {subTab === 'scope'       && <ScopeTab />}
      {subTab === 'history'     && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} /></div>}
      {subTab === 'audit'       && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} emptyMessage="No audit records." /></div>}
    </div>
  );
}
