/**
 * MetadataBrowserWorkspace — tab content for Metadata objects.
 * Sub-tabs: Overview | Structure | Profiling | Lineage | History | Permissions
 */
import React, { useState } from 'react';
import { RefreshCw, Database, Table2, Columns } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid } from '@/components/shared/ObjectPermissionsGrid';
import type { MetadataSubTab } from '@/types';

const SUB_TABS = [
  { id: 'overview',    label: 'Overview',    shortcut: '1' },
  { id: 'structure',   label: 'Structure',   shortcut: '2' },
  { id: 'profiling',   label: 'Profiling',   shortcut: '3' },
  { id: 'lineage',     label: 'Lineage',     shortcut: '4' },
  { id: 'history',     label: 'History',     shortcut: '5' },
  { id: 'permissions', label: 'Permissions', shortcut: '6' },
] satisfies { id: MetadataSubTab; label: string; shortcut: string }[];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="text-slate-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-slate-300 break-all">{value || '—'}</span>
    </div>
  );
}

// ─── Column type badge ────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const color = /^(int|bigint|numeric|float|double|decimal)/i.test(type)
    ? 'text-blue-300 bg-blue-900/30 border-blue-700/50'
    : /^(varchar|text|char|string)/i.test(type)
    ? 'text-emerald-300 bg-emerald-900/30 border-emerald-700/50'
    : /^(date|time|timestamp)/i.test(type)
    ? 'text-amber-300 bg-amber-900/30 border-amber-700/50'
    : /^(bool)/i.test(type)
    ? 'text-purple-300 bg-purple-900/30 border-purple-700/50'
    : 'text-slate-400 bg-slate-800 border-slate-700';
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${color}`}>{type || '?'}</span>
  );
}

// ─── Overview sub-tab ─────────────────────────────────────────────────────

function OverviewTab({ data }: { data: Record<string, unknown> }) {
  const metaType = String(data.metaType ?? 'table');
  const Icon = metaType === 'schema' ? Database : metaType === 'table' ? Table2 : Columns;
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3 p-4 bg-slate-800/30 border border-slate-800 rounded-lg">
          <Icon className="w-8 h-8 text-violet-400 flex-shrink-0" />
          <div>
            <div className="text-[16px] font-semibold text-slate-100">{String(data.name ?? '—')}</div>
            <div className="text-[12px] text-slate-500 mt-0.5">{String(data.fullyQualifiedName ?? '—')}</div>
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-2">
          <InfoRow label="Source Connection" value={String(data.sourceConnection ?? '')} />
          <InfoRow label="Schema" value={String(data.schema ?? '')} />
          <InfoRow label="Object Type" value={metaType} />
          <InfoRow label="Row Count" value={data.rowCount != null ? String(data.rowCount) : 'Not available'} />
          <InfoRow label="Last Profiled On" value={String(data.lastProfiledOn ?? '')} />
          <InfoRow label="Last Refreshed On" value={String(data.lastRefreshedOn ?? '')} />
          <InfoRow label="Data Classification" value={String(data.dataClassification ?? '')} />
          <InfoRow label="Owner" value={String(data.owner ?? '')} />
        </div>
        {String(data.description) && (
          <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-2">Description</div>
            <p className="text-[13px] text-slate-300">{String(data.description)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Structure sub-tab ────────────────────────────────────────────────────

interface ColumnDef {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isSensitive: boolean;
  description?: string;
  defaultValue?: string;
  length?: number | null;
  precision?: number | null;
  scale?: number | null;
}

function StructureTab({ columns }: { columns: ColumnDef[] }) {
  if (columns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-5">
        <Columns className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">No column metadata available. Try refreshing metadata.</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 bg-[#0a0c15] z-10">
          <tr className="text-left text-[11px] text-slate-500 border-b border-slate-800">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Column Name</th>
            <th className="px-3 py-2 font-medium">Data Type</th>
            <th className="px-3 py-2 font-medium">Nullable</th>
            <th className="px-3 py-2 font-medium">PK</th>
            <th className="px-3 py-2 font-medium">Sensitive</th>
            <th className="px-3 py-2 font-medium">Default</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col, i) => (
            <tr key={col.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              <td className="px-3 py-1.5 text-slate-600">{i + 1}</td>
              <td className="px-3 py-1.5 font-mono text-slate-200">{col.name}</td>
              <td className="px-3 py-1.5"><TypeBadge type={col.dataType} /></td>
              <td className="px-3 py-1.5 text-slate-400">{col.nullable ? 'Yes' : 'No'}</td>
              <td className="px-3 py-1.5">{col.isPrimaryKey ? <span className="text-amber-400 font-bold">PK</span> : '—'}</td>
              <td className="px-3 py-1.5">{col.isSensitive ? <span className="text-red-400 text-[11px]">🔒 Yes</span> : '—'}</td>
              <td className="px-3 py-1.5 text-slate-500 font-mono text-[11px]">{col.defaultValue ?? '—'}</td>
              <td className="px-3 py-1.5 text-slate-500">{col.description ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Profiling sub-tab ────────────────────────────────────────────────────

function ProfilingTab() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-5">
      <RefreshCw className="w-8 h-8 mb-2 opacity-40" />
      <p className="text-sm mb-3">No profiling data available.</p>
      <button className="flex items-center gap-1.5 h-7 px-3 bg-violet-700 hover:bg-violet-600 text-white rounded text-[12px] font-medium transition-colors">
        <RefreshCw className="w-3.5 h-3.5" /> Run Profile
      </button>
    </div>
  );
}

// ─── Lineage sub-tab ─────────────────────────────────────────────────────

function LineageTab() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-5">
      <p className="text-sm">Lineage visualization is not yet available for this object.</p>
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────

export function MetadataBrowserWorkspace({ tabId }: { tabId: string }) {
  const tab      = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab   = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'overview') as MetadataSubTab;
  const objName  = tab?.objectName ?? 'Metadata';

  const [data] = useState<Record<string, unknown>>({
    name: objName,
    fullyQualifiedName: tab?.hierarchyPath ?? objName,
    metaType: 'table',
    sourceConnection: '—',
    schema: '—',
    rowCount: null,
    lastProfiledOn: '—',
    lastRefreshedOn: '—',
    dataClassification: '—',
    owner: '—',
    description: '',
  });

  const [columns] = useState<ColumnDef[]>([]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="metadata"
        name={objName}
        hierarchyPath={tab?.hierarchyPath}
        status="published"
        actions={
          <button className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Metadata
          </button>
        }
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="overview" />

      {subTab === 'overview'    && <OverviewTab data={data} />}
      {subTab === 'structure'   && <StructureTab columns={columns} />}
      {subTab === 'profiling'   && <ProfilingTab />}
      {subTab === 'lineage'     && <LineageTab />}
      {subTab === 'history'     && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} /></div>}
      {subTab === 'permissions' && <div className="flex-1 overflow-hidden"><ObjectPermissionsGrid rows={[]} readOnly /></div>}
    </div>
  );
}
