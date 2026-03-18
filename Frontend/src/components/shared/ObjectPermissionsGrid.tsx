/**
 * ObjectPermissionsGrid — reusable permissions management grid.
 * Shows user/role grants, inheritance source, and effective access.
 */
import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, Shield, Users, UserCheck } from 'lucide-react';

export interface PermissionRow {
  id: string;
  principalType: 'user' | 'role' | 'group';
  principalName: string;
  accessLevel: string;
  isInherited: boolean;
  inheritedFrom?: string;
  grantedBy: string;
  grantedOn: string;
  expiry?: string;
  permissions?: string[];
}

interface ObjectPermissionsGridProps {
  rows: PermissionRow[];
  loading?: boolean;
  readOnly?: boolean;
  onAdd?: () => void;
  onRemove?: (id: string) => void;
}

const ACCESS_COLORS: Record<string, string> = {
  admin:   'bg-red-900/40 text-red-300 border-red-700',
  editor:  'bg-blue-900/40 text-blue-300 border-blue-700',
  viewer:  'bg-slate-700 text-slate-300 border-slate-600',
  execute: 'bg-purple-900/40 text-purple-300 border-purple-700',
  owner:   'bg-amber-900/40 text-amber-300 border-amber-700',
};

function PrincipalIcon({ type }: { type: 'user' | 'role' | 'group' }) {
  const cls = 'w-3.5 h-3.5';
  if (type === 'role')  return <Shield className={`${cls} text-orange-400`} />;
  if (type === 'group') return <Users  className={`${cls} text-violet-400`} />;
  return <UserCheck className={`${cls} text-sky-400`} />;
}

export function ObjectPermissionsGrid({ rows, loading, readOnly, onAdd, onRemove }: ObjectPermissionsGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
        <span className="text-[12px] text-slate-400 font-medium">Access Control</span>
        <span className="text-[11px] text-slate-600 ml-1">· {rows.length} entries</span>
        {!readOnly && onAdd && (
          <button
            onClick={onAdd}
            className="ml-auto flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Permission
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-sm text-slate-500">Loading permissions…</div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-slate-600">No permissions configured</div>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 bg-[#0a0c15] z-10">
              <tr className="text-left text-[11px] text-slate-500 border-b border-slate-800">
                <th className="px-3 py-2 font-medium">Principal</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Access Level</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Granted By</th>
                <th className="px-3 py-2 font-medium">Granted On</th>
                {!readOnly && <th className="px-3 py-2 font-medium w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <React.Fragment key={row.id}>
                  <tr
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  >
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <PrincipalIcon type={row.principalType} />
                        <span className="text-slate-200">{row.principalName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500 capitalize">{row.principalType}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${ACCESS_COLORS[row.accessLevel.toLowerCase()] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                        {row.accessLevel}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      {row.isInherited ? (
                        <span className="text-slate-500 italic text-[11px]" title={row.inheritedFrom}>
                          Inherited {row.inheritedFrom ? `from ${row.inheritedFrom}` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">Direct</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">{row.grantedBy}</td>
                    <td className="px-3 py-1.5 text-slate-500">{row.grantedOn}</td>
                    {!readOnly && (
                      <td className="px-3 py-1.5">
                        {!row.isInherited && onRemove && (
                          <button
                            onClick={e => { e.stopPropagation(); onRemove(row.id); }}
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  {expandedId === row.id && row.permissions && row.permissions.length > 0 && (
                    <tr className="bg-slate-900/40">
                      <td colSpan={readOnly ? 6 : 7} className="px-6 py-2">
                        <div className="text-[11px] text-slate-500 mb-1 font-medium">Effective Permissions:</div>
                        <div className="flex flex-wrap gap-1">
                          {row.permissions.map(p => (
                            <span key={p} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300">{p}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
