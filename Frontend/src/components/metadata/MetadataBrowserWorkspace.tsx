import React, { useEffect, useState } from 'react';
import { RefreshCw, Database, Table2, Columns } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid, type HistoryRow } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid, type PermissionRow } from '@/components/shared/ObjectPermissionsGrid';
import type { MetadataSubTab } from '@/types';
import api from '@/services/api';

const SUB_TABS = [
  { id: 'overview',    label: 'Overview',    shortcut: '1' },
  { id: 'structure',   label: 'Structure',   shortcut: '2' },
  { id: 'profiling',   label: 'Profiling',   shortcut: '3' },
  { id: 'lineage',     label: 'Lineage',     shortcut: '4' },
  { id: 'history',     label: 'History',     shortcut: '5' },
  { id: 'permissions', label: 'Permissions', shortcut: '6' },
] satisfies { id: MetadataSubTab; label: string; shortcut: string }[];

type DatasetProfile = {
  datasetId: string;
  connectorDisplayName: string;
  connectorTypeCode: string;
  dbName: string;
  schemaName: string;
  tableName: string;
  datasetTypeCode: string;
  estimatedRowCount: number | null;
  lastIntrospectionDtm: string | null;
  classificationCode: string | null;
  classificationNotes: string | null;
  columns: Array<{
    columnId: string;
    name: string;
    dataType: string;
    nullable: boolean;
    ordinal: number;
  }>;
};

type LineageRow = {
  pipeline_id: string;
  pipeline_display_name: string;
  access_mode_code: string;
  version_num_seq: number;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="text-slate-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-slate-300 break-all">{value || '—'}</span>
    </div>
  );
}

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

function OverviewTab({ profile }: { profile: DatasetProfile | null }) {
  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
        Select a metadata object to view its profile.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3 p-4 bg-slate-800/30 border border-slate-800 rounded-lg">
          <Table2 className="w-8 h-8 text-violet-400 flex-shrink-0" />
          <div>
            <div className="text-[16px] font-semibold text-slate-100">{profile.tableName}</div>
            <div className="text-[12px] text-slate-500 mt-0.5">
              {profile.dbName}.{profile.schemaName}.{profile.tableName}
            </div>
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-2">
          <InfoRow label="Source Connection" value={profile.connectorDisplayName} />
          <InfoRow label="Connector Type" value={profile.connectorTypeCode} />
          <InfoRow label="Dataset Type" value={profile.datasetTypeCode} />
          <InfoRow label="Row Count" value={profile.estimatedRowCount != null ? String(profile.estimatedRowCount) : 'Not available'} />
          <InfoRow label="Last Refreshed On" value={profile.lastIntrospectionDtm ?? '—'} />
          <InfoRow label="Classification" value={profile.classificationCode ?? 'Unclassified'} />
          <InfoRow label="Notes" value={profile.classificationNotes ?? '—'} />
        </div>
      </div>
    </div>
  );
}

function StructureTab({ profile }: { profile: DatasetProfile | null }) {
  if (!profile || profile.columns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-5">
        <Columns className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">No column metadata available.</p>
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
          </tr>
        </thead>
        <tbody>
          {profile.columns.map(column => (
            <tr key={column.columnId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              <td className="px-3 py-1.5 text-slate-600">{column.ordinal}</td>
              <td className="px-3 py-1.5 font-mono text-slate-200">{column.name}</td>
              <td className="px-3 py-1.5"><TypeBadge type={column.dataType} /></td>
              <td className="px-3 py-1.5 text-slate-400">{column.nullable ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProfilingTab({ profile }: { profile: DatasetProfile | null }) {
  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Select a metadata object first.</div>
    );
  }
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-lg space-y-3">
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-2">Profile Summary</div>
          <InfoRow label="Estimated Rows" value={profile.estimatedRowCount != null ? String(profile.estimatedRowCount) : 'Unknown'} />
          <InfoRow label="Columns" value={String(profile.columns.length)} />
          <InfoRow label="Last Profile Timestamp" value={profile.lastIntrospectionDtm ?? '—'} />
        </div>
      </div>
    </div>
  );
}

function LineageTab({ rows }: { rows: LineageRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
        No lineage references found for this dataset.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="text-left text-[11px] text-slate-500 border-b border-slate-800">
            <th className="px-3 py-2 font-medium">Pipeline</th>
            <th className="px-3 py-2 font-medium">Access Mode</th>
            <th className="px-3 py-2 font-medium">Version</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={`${row.pipeline_id}-${row.access_mode_code}`} className="border-b border-slate-800/50">
              <td className="px-3 py-2 text-slate-200">{row.pipeline_display_name}</td>
              <td className="px-3 py-2 text-slate-400">{row.access_mode_code}</td>
              <td className="px-3 py-2 text-slate-500">{row.version_num_seq ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MetadataBrowserWorkspace({ tabId }: { tabId: string }) {
  const tab = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'structure') as MetadataSubTab;

  const datasetId = tab?.objectId ?? '';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidId = UUID_RE.test(datasetId);

  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [lineage, setLineage] = useState<LineageRow[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [permissionRows, setPermissionRows] = useState<PermissionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objectName = profile?.tableName ?? tab?.objectName ?? 'Table';
  const hierarchyPath = profile
    ? `Metadata → ${profile.connectorDisplayName} → ${profile.schemaName} → ${profile.tableName}`
    : tab?.hierarchyPath ?? 'Metadata Catalog';

  const load = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [profileRes, lineageRes, historyRes, permissionsRes] = await Promise.all([
        api.getProfile(id),
        api.getMetadataLineage(id),
        api.getMetadataHistory(id, { limit: 100 }),
        api.getMetadataPermissions(id),
      ]);
      setProfile((profileRes.data?.data ?? profileRes.data) as DatasetProfile);
      setLineage((Array.isArray(lineageRes.data?.data ?? lineageRes.data) ? lineageRes.data?.data ?? lineageRes.data : []) as LineageRow[]);
      setHistoryRows((Array.isArray(historyRes.data?.data ?? historyRes.data) ? historyRes.data?.data ?? historyRes.data : []) as HistoryRow[]);
      setPermissionRows((Array.isArray(permissionsRes.data?.data ?? permissionsRes.data) ? permissionsRes.data?.data ?? permissionsRes.data : []) as PermissionRow[]);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load metadata');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isValidId) void load(datasetId);
  }, [datasetId]);

  const refreshMetadata = async () => {
    if (!isValidId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await api.refreshMetadata(datasetId);
      await load(datasetId);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Metadata refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isValidId) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#0d0f1a] text-slate-500 gap-3">
        <Database className="w-10 h-10 opacity-30" />
        <p className="text-[13px]">Select a table from the Metadata Catalog in the left sidebar to view its details.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="metadata"
        name={objectName}
        hierarchyPath={hierarchyPath}
        status="published"
        actions={
          <button
            onClick={refreshMetadata}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded text-[12px] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing…' : 'Refresh Metadata'}
          </button>
        }
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="structure" />

      {error && <div className="px-5 pt-3 text-[12px] text-red-400">{error}</div>}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="flex-1 overflow-hidden min-h-0">
          {subTab === 'overview' && <OverviewTab profile={profile} />}
          {subTab === 'structure' && <StructureTab profile={profile} />}
          {subTab === 'profiling' && <ProfilingTab profile={profile} />}
          {subTab === 'lineage' && <LineageTab rows={lineage} />}
          {subTab === 'history' && (
            <div className="flex-1 overflow-hidden">
              <ObjectHistoryGrid rows={historyRows} emptyMessage="No metadata history records." />
            </div>
          )}
          {subTab === 'permissions' && (
            <div className="flex-1 overflow-hidden">
              <ObjectPermissionsGrid rows={permissionRows} readOnly />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
