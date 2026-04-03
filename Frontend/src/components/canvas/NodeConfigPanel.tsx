/**
 * NodeConfigPanel — Right-side panel for configuring a selected pipeline node.
 *
 * Source:     Connection dropdown → Catalog object → Runtime path/pattern overrides
 * Target:     Connection → Schema → Table → Write Mode (APPEND/OVERWRITE/SCD1/SCD2/SCD3/UPSERT/MERGE)
 * Filter:     SQL WHERE expression
 * Join:       Join type + key columns
 * Aggregate:  Group-by columns + aggregations
 * Transform:  Compact zebra-row matrix + inline properties editor (same popup)
 * Custom SQL: Raw SQL expression editor
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { X, ChevronDown, Loader2, Plus, Trash2, Grid3X3, BookOpenText } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateNode } from '@/store/slices/pipelineSlice';
import { fetchConnectors, selectAllConnectors } from '@/store/slices/connectionsSlice';
import { ConditionBuilder, conditionToSQL } from '@/components/transformations/ConditionBuilder';
import type { ComplexCondition } from '@/components/transformations/ConditionBuilder';
import { PatternWizard } from '@/components/transformations/PatternWizard';
import { TransformationBuilder } from '@/components/transformations/TransformationBuilder';
import { TRANSFORM_REGISTRY, createStep } from '@/transformations';
import type { TransformSequence, TransformStep } from '@/transformations/ir';
import type { ParameterDef } from '@/registry/TransformRegistry';
import api from '@/services/api';

// ─── Write mode options ────────────────────────────────────────────────────────
const WRITE_MODES = [
  { value: 'APPEND',    label: 'Append',              desc: 'Insert new rows; never modify existing data' },
  { value: 'OVERWRITE', label: 'Overwrite (Truncate)', desc: 'Truncate then reload — full refresh' },
  { value: 'SCD1',      label: 'SCD Type 1',          desc: 'Update in-place; no history retained' },
  { value: 'SCD2',      label: 'SCD Type 2',          desc: 'Add new version row; preserve full history' },
  { value: 'SCD3',      label: 'SCD Type 3',          desc: 'Track previous value in added column' },
  { value: 'UPSERT',    label: 'Upsert (Merge)',       desc: 'Insert or update based on key columns' },
  { value: 'MERGE',     label: 'Delta Merge',          desc: 'Incremental merge with insert/update/delete' },
];

const JOIN_TYPES = ['INNER', 'LEFT OUTER', 'RIGHT OUTER', 'FULL OUTER', 'CROSS', 'SEMI', 'ANTI'];

const TARGET_AUDIT_VALUE_OPTIONS = [
  { value: '__audit__:current_timestamp', label: 'Current Timestamp' },
  { value: '__audit__:current_date', label: 'Current Date' },
  { value: '__audit__:current_time', label: 'Current Time' },
  { value: '__audit__:job_name', label: 'Job Name' },
  { value: '__audit__:run_id', label: 'Run ID' },
  { value: '__audit__:user_name', label: 'User Name' },
] as const;

function isAuditMappingValue(value: string): boolean {
  return value.startsWith('__audit__:');
}

function getAuditMappingLabel(value: string): string {
  return TARGET_AUDIT_VALUE_OPTIONS.find(option => option.value === value)?.label ?? value.replace(/^__audit__:/, '');
}

export function canOpenTargetMappingEditor(config: Record<string, string>, sinkType: string): boolean {
  if (sinkType !== 'jdbc') return false;
  return Boolean(
    config.connectionId?.trim()
    && config.schema?.trim()
    && config.table?.trim(),
  );
}

// ─── Shared primitives ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] font-bold uppercase tracking-widest text-blue-300 mt-4 mb-2 px-1 border-l-2 border-blue-500 pl-2">
      {children}
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-3">
      <label className="block text-[12px] font-semibold text-slate-200 mb-1">
        {label}{required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Select({ value, onChange, children, disabled, loading }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; disabled?: boolean; loading?: boolean;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled || loading}
        className="w-full h-9 pl-3 pr-8 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px]
                   focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30
                   disabled:opacity-40 disabled:cursor-not-allowed appearance-none font-medium">
        {children}
      </select>
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
        {loading
          ? <Loader2 className="w-3.5 h-3.5 text-slate-300 animate-spin" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-300" />}
      </div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full h-9 px-3 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-medium
                  placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 ${className}`} />
  );
}

function CompactIconButton({
  onClick,
  title,
  children,
  tone = 'default',
  className = '',
  disabled = false,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  const toneClass = tone === 'danger'
    ? 'border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-300'
    : 'border-slate-700 text-slate-400 hover:border-blue-500/50 hover:text-blue-300';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex h-5 w-5 items-center justify-center rounded border bg-[#161b2e] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneClass} ${className}`}
    >
      {children}
    </button>
  );
}

function ZebraList({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden ${className}`}>{children}</div>;
}

function ZebraRow({ children, index, className = '' }: { children: React.ReactNode; index: number; className?: string }) {
  return (
    <div className={`flex items-center gap-1 px-1 py-0.5 ${index % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} ${className}`}>
      {children}
    </div>
  );
}

/* Borderless inline dropdown — only chevron visible, no box, used inside zebra column lists */
function InlineSelect({ value, onChange, children, loading, disabled, className = '' }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
  loading?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <div className={`relative flex items-center min-w-0 flex-1 ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full h-6 pl-0.5 pr-4 bg-transparent border-0 text-slate-200 text-[12px] font-mono appearance-none focus:outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2">
        {loading
          ? <Loader2 className="h-2.5 w-2.5 animate-spin text-slate-300" />
          : <ChevronDown className="h-2.5 w-2.5 text-slate-300" />}
      </span>
    </div>
  );
}

function normalizeFilterExpression(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/^\s*where\b/i, '')
    .replace(/;+\s*$/, '')
    .trim();
}

// ─── Source node config ────────────────────────────────────────────────────────
const FILE_FORMATS = ['csv', 'parquet', 'json', 'orc', 'avro', 'delta', 'text'];
const FILE_SUFFIX_PRESETS = [
  { value: '', label: 'Insert date/timestamp token…' },
  { value: '{YYYYMMDD}', label: 'YYYYMMDD' },
  { value: '{YYYY-MM-DD}', label: 'YYYY-MM-DD' },
  { value: '{YYYY_MM_DD}', label: 'YYYY_MM_DD' },
  { value: '{YYYYMM}', label: 'YYYYMM' },
  { value: '{YYYY}', label: 'YYYY' },
  { value: '{YYYYMMDDHH24MISS}', label: 'YYYYMMDDHH24MISS' },
  { value: '{YYYYMMDD_HH24MISS}', label: 'YYYYMMDD_HH24MISS' },
  { value: '{YYYY-MM-DD_HH24MISS}', label: 'YYYY-MM-DD_HH24MISS' },
  { value: '{DD-MON-YYYY}', label: 'DD-MON-YYYY' },
  { value: '{DD-MON-YY}', label: 'DD-MON-YY' },
];

function isFileConnectorType(connectorTypeCode?: string | null): boolean {
  const code = String(connectorTypeCode ?? '').toUpperCase();
  return code.startsWith('FILE_') || ['CSV', 'JSON', 'PARQUET', 'AVRO', 'ORC', 'XML', 'EXCEL', 'XLSX'].includes(code);
}

function isKafkaConnectorType(connectorTypeCode?: string | null): boolean {
  const code = String(connectorTypeCode ?? '').toUpperCase();
  return code.includes('KAFKA') || code.includes('KINESIS') || code.includes('PUBSUB') || code.includes('RABBITMQ');
}

function prettyConnectorType(connectorTypeCode?: string | null): string {
  return String(connectorTypeCode ?? '')
    .replace(/^JDBC_/, '')
    .replace(/^FILE_/, '')
    .replace(/_/g, ' ')
    .trim();
}

function SourceConfig({ nodeId, config, onChange }: {
  nodeId: string;
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
}) {
  const dispatch = useAppDispatch();
  const connectorsByTech = useAppSelector(s => s.connections.connectorsByTech);
  const allConnectors = selectAllConnectors(connectorsByTech);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<{ tableName: string; tableType: string }[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [fileFormatOptions, setFileFormatOptions] = useState<Record<string, unknown> | null>(null);

  const selectedConnector = allConnectors.find(c => c.connectorId === config.connectionId);
  const srcType = selectedConnector
    ? isFileConnectorType(selectedConnector.connectorTypeCode)
      ? 'file'
      : isKafkaConnectorType(selectedConnector.connectorTypeCode)
      ? 'kafka'
      : 'jdbc'
    : (config.sourceType ?? 'jdbc');
  const supportsCatalogObject = srcType === 'file' || srcType === 'jdbc';
  const availableConnectors = useMemo(
    () => [...allConnectors].sort((left, right) =>
      `${left.connectorDisplayName} ${left.connectorTypeCode ?? ''}`.localeCompare(
        `${right.connectorDisplayName} ${right.connectorTypeCode ?? ''}`,
      ),
    ),
    [allConnectors],
  );
  const inheritedFileFormat = String(
    fileFormatOptions?.['file_format_code']
      ?? prettyConnectorType(selectedConnector?.connectorTypeCode)
      ?? 'FILE',
  ).replace(/^FILE_/, '').toUpperCase();
  const inheritedHeaderMode = fileFormatOptions?.['has_header_flag'] === false ? 'Header disabled' : 'Header enabled';
  const inheritedDelimiter = String(fileFormatOptions?.['field_separator_char'] ?? ',');
  const inheritedEncoding = String(fileFormatOptions?.['encoding_standard_code'] ?? 'UTF-8');
  const inheritedDateFormat = String(fileFormatOptions?.['date_format_text'] ?? 'yyyy-MM-dd');
  const inheritedTimestampFormat = String(fileFormatOptions?.['timestamp_format_text'] ?? 'yyyy-MM-dd HH:mm:ss');

  useEffect(() => { dispatch(fetchConnectors()); }, [dispatch]);

  useEffect(() => {
    if (!config.connectionId || !supportsCatalogObject) { setSchemas([]); setTables([]); return; }
    setLoadingSchemas(true);
    api.introspectSchemas(config.connectionId)
      .then(r => setSchemas((r.data?.data ?? []).map((s: any) => s.schemaName ?? s)))
      .catch(() => setSchemas([]))
      .finally(() => setLoadingSchemas(false));
  }, [config.connectionId, supportsCatalogObject]);

  useEffect(() => {
    if (!config.connectionId || !config.schema || !supportsCatalogObject) { setTables([]); return; }
    setLoadingTables(true);
    api.introspectTables(config.connectionId, config.schema)
      .then(r => setTables(r.data?.data ?? []))
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false));
  }, [config.connectionId, config.schema, supportsCatalogObject]);

  // F-23: cache columns on the node config when table is selected so downstream nodes can read them
  useEffect(() => {
    if (!config.connectionId || !config.table || !supportsCatalogObject) return;
    api.introspectColumns(config.connectionId, config.schema ?? '', config.table)
      .then(r => {
        const cols = (r.data?.data ?? []) as Array<{ columnName?: string; dataType?: string; columnType?: string; udtName?: string }>;
        const compact = cols
          .filter(c => Boolean(c.columnName))
          .map(c => ({
            columnName: c.columnName,
            dataType: c.dataType ?? c.columnType ?? c.udtName ?? '',
          }));
        if (compact.length > 0) onChange({ cachedColumns: JSON.stringify(compact) });
      })
      .catch(() => { /* silently ignore — columns just won't be cached */ });
  }, [config.connectionId, config.schema, config.table, supportsCatalogObject]);

  useEffect(() => {
    if (!config.connectionId || srcType !== 'file') {
      setFileFormatOptions(null);
      return;
    }
    api.getConnection(config.connectionId)
      .then(r => setFileFormatOptions((r.data?.data?.fileFormatOptions ?? null) as Record<string, unknown> | null))
      .catch(() => setFileFormatOptions(null));
  }, [config.connectionId, srcType]);

  const insertSuffixPreset = (token: string) => {
    if (!token) return;
    if ((config.filePath ?? '').includes(token)) return;
    onChange({ filePath: `${config.filePath ?? ''}${token}` });
  };

  const handleConnectionChange = (connectorId: string) => {
    const nextConnector = allConnectors.find(c => c.connectorId === connectorId);
    const derivedSourceType = nextConnector
      ? isFileConnectorType(nextConnector.connectorTypeCode)
        ? 'file'
        : isKafkaConnectorType(nextConnector.connectorTypeCode)
          ? 'kafka'
          : 'jdbc'
      : 'jdbc';

    onChange({
      connectionId: connectorId,
      schema: '',
      table: '',
      sourceType: derivedSourceType,
      fileFormat: '',
      header: '',
      delimiter: '',
      inferSchema: '',
    });
  };

  return (
    <div>
      <SectionLabel>Connection</SectionLabel>
      <Field label="Connection" required>
        <Select
          value={config.connectionId ?? ''}
          onChange={handleConnectionChange}
        >
          <option value="">— select connection —</option>
          {availableConnectors.map(c => (
            <option key={c.connectorId} value={c.connectorId}>
              {c.connectorDisplayName} ({prettyConnectorType(c.connectorTypeCode)})
            </option>
          ))}
        </Select>
        {selectedConnector && (
          <div className="mt-1 space-y-1 text-[12px] text-slate-300">
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${
                selectedConnector.healthStatusCode === 'HEALTHY'
                  ? 'bg-green-500'
                  : selectedConnector.healthStatusCode
                    ? 'bg-yellow-500'
                    : 'bg-slate-500'
              }`} />
              {selectedConnector.healthStatusCode?.trim() || 'Not tested'}
            </div>
            <div className="text-slate-300">
              Source category is derived automatically from this connection: <span className="text-slate-300">{srcType.toUpperCase()}</span>
            </div>
          </div>
        )}
      </Field>

      {supportsCatalogObject && (<>
        <SectionLabel>{srcType === 'file' ? 'Imported Object' : 'Dataset Location'}</SectionLabel>
        <Field label={srcType === 'file' ? 'Catalog Path' : 'Schema'} required>
          <Select value={config.schema ?? ''} onChange={v => onChange({ schema: v, table: '' })}
            disabled={!config.connectionId} loading={loadingSchemas}>
            <option value="">— select {srcType === 'file' ? 'path' : 'schema'} —</option>
            {schemas.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label={srcType === 'file' ? 'Imported Object' : 'Table / View'} required>
          <Select value={config.table ?? ''} onChange={v => onChange({ table: v })}
            disabled={!config.schema} loading={loadingTables}>
            <option value="">— select {srcType === 'file' ? 'object' : 'table'} —</option>
            {tables.map(t => (
              <option key={t.tableName} value={t.tableName}>
                {t.tableName}{t.tableType === 'VIEW' ? ' (view)' : ''}
              </option>
            ))}
          </Select>
        </Field>
      </>)}

      {srcType === 'jdbc' && (<>
        <SectionLabel>Options</SectionLabel>
        <Field label="Read Mode">
          <Select value={config.readMode ?? 'FULL'} onChange={v => onChange({ readMode: v })}>
            <option value="FULL">Full Extract</option>
            <option value="INCREMENTAL">Incremental (watermark column)</option>
            <option value="CUSTOM_QUERY">Custom SQL Query</option>
          </Select>
        </Field>
        {config.readMode === 'INCREMENTAL' && (
          <Field label="Watermark Column">
            <TextInput value={config.watermarkColumn ?? ''} onChange={v => onChange({ watermarkColumn: v })} placeholder="updated_at" />
          </Field>
        )}
        {config.readMode === 'CUSTOM_QUERY' && (
          <Field label="Custom SQL">
            <textarea value={config.customQuery ?? ''} onChange={e => onChange({ customQuery: e.target.value })}
              placeholder="SELECT * FROM schema.table WHERE ..."
              className="w-full px-2.5 py-2 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
              rows={4} />
          </Field>
        )}
        <Field label="Fetch Size (rows/batch)">
          <TextInput value={config.fetchSize ?? '10000'} onChange={v => onChange({ fetchSize: v })} placeholder="10000" />
        </Field>
      </>)}

      {srcType === 'file' && (<>
        <SectionLabel>Runtime Source</SectionLabel>
        <div className="mb-3 px-1 text-[12px] leading-5 text-slate-400">
          <div>Schema comes from the imported catalog object. File format and CSV parsing stay inherited from the selected connection and metadata catalog.</div>
          <div className="mt-1 text-slate-300">
            <span className="font-semibold text-slate-200">{inheritedFileFormat}</span>
            <span className="mx-1.5 text-slate-400">|</span>
            {inheritedHeaderMode}
            <span className="mx-1.5 text-slate-400">|</span>
            Delimiter <span className="font-mono text-slate-200">{inheritedDelimiter}</span>
            <span className="mx-1.5 text-slate-400">|</span>
            Encoding <span className="font-mono text-slate-200">{inheritedEncoding}</span>
          </div>
          <div className="text-slate-300">
            Date parse <span className="font-mono text-slate-300">{inheritedDateFormat}</span>
            <span className="mx-1.5 text-slate-400">|</span>
            Timestamp parse <span className="font-mono text-slate-300">{inheritedTimestampFormat}</span>
          </div>
        </div>
        <Field label="Runtime Object / Path Pattern">
          <TextInput value={config.filePath ?? ''} onChange={v => onChange({ filePath: v })}
            placeholder="/data/orders_{YYYYMMDD}.csv  or  s3://bucket/path/orders_*.csv  or  leave blank to use the imported object path" />
          <div className="text-[12px] text-slate-300 mt-1">Use this only when runtime file names vary. Leave blank to read the imported catalog object path exactly as stored.</div>
        </Field>
        <Field label="Filename Suffix Token">
          <Select value="" onChange={v => insertSuffixPreset(v)}>
            {FILE_SUFFIX_PRESETS.map(option => <option key={option.label} value={option.value}>{option.label}</option>)}
          </Select>
          <div className="text-[12px] text-slate-300 mt-1">Common presets are listed here, but the runtime path also accepts custom tokens like <span className="font-mono">{'{DD-MON-YYYY}'}</span> or <span className="font-mono">{'{YYYY-MM-DD_HH24MISS}'}</span>.</div>
        </Field>
        <SectionLabel>Runtime Matching</SectionLabel>
        <Field label="Wildcard Filter">
          <TextInput value={config.pathGlobFilter ?? ''} onChange={v => onChange({ pathGlobFilter: v })}
            placeholder="*.csv  or  part-*.parquet" />
          <div className="text-[12px] text-slate-300 mt-1">Optional extra filter when runtime path points to a directory tree. Leave blank if the runtime path already contains the wildcard or token.</div>
        </Field>
        <Field label="Subdirectories">
          <Select value={config.recursiveFileLookup ?? 'false'} onChange={v => onChange({ recursiveFileLookup: v })}>
            <option value="false">No</option>
            <option value="true">Yes — scan subdirectories</option>
          </Select>
        </Field>
      </>)}

      {srcType === 'kafka' && (<>
        <SectionLabel>Kafka Connection</SectionLabel>
        <Field label="Bootstrap Servers" required>
          <TextInput value={config.bootstrapServers ?? ''} onChange={v => onChange({ bootstrapServers: v })} placeholder="broker1:9092,broker2:9092" />
        </Field>
        <Field label="Topic" required>
          <TextInput value={config.topic ?? ''} onChange={v => onChange({ topic: v })} placeholder="my.topic.name" />
        </Field>
        <Field label="Starting Offsets">
          <Select value={config.startingOffsets ?? 'latest'} onChange={v => onChange({ startingOffsets: v })}>
            <option value="latest">Latest (streaming)</option>
            <option value="earliest">Earliest (full replay)</option>
          </Select>
        </Field>
        <Field label="Value Format">
          <Select value={config.valueFormat ?? 'json'} onChange={v => onChange({ valueFormat: v })}>
            <option value="json">JSON</option>
            <option value="avro">Avro</option>
            <option value="string">String</option>
          </Select>
        </Field>
      </>)}
    </div>
  );
}

// ─── Target node config ────────────────────────────────────────────────────────
const SINK_FILE_FORMATS = ['parquet', 'csv', 'json', 'orc', 'avro', 'text'];
const SINK_WRITE_MODES_FILE = [
  { value: 'APPEND',    label: 'Append',    desc: 'Add data to existing files/directory' },
  { value: 'OVERWRITE', label: 'Overwrite', desc: 'Replace all existing data' },
];

function uniqueOrderedStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter(value => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function TargetConfig({ config, onChange, nodeId, openSignal }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
  nodeId: string;
  openSignal?: number;
}) {
  const dispatch = useAppDispatch();
  const connectorsByTech = useAppSelector(s => s.connections.connectorsByTech);
  const allConnectors = selectAllConnectors(connectorsByTech);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<{ tableName: string }[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [targetColumns, setTargetColumns] = useState<string[]>([]);
  const [loadingTargetColumns, setLoadingTargetColumns] = useState(false);
  const [keyColumns, setKeyColumns] = useState<string[]>(
    config.keyColumns ? config.keyColumns.split(',').filter(Boolean) : []
  );
  const [newKey, setNewKey] = useState('');
  const { columns: sourceColumns, loading: loadingSourceColumns } = useUpstreamColumns(nodeId);
  const [showTargetMappingPopup, setShowTargetMappingPopup] = useState(false);
  const [autoMapMode, setAutoMapMode] = useState<'name_ci' | 'name_cs' | 'position'>('name_ci');
  const lastHandledOpenSignalRef = useRef<number | undefined>(undefined);

  const sinkType = config.sinkType ?? 'jdbc';
  const writeMode = config.writeMode ?? 'APPEND';
  const needsKeyColumns = ['SCD1', 'SCD2', 'SCD3', 'UPSERT', 'MERGE'].includes(writeMode);
  const selectedMode = WRITE_MODES.find(m => m.value === writeMode);
  const canOpenMappingEditor = canOpenTargetMappingEditor(config, sinkType);

  useEffect(() => { dispatch(fetchConnectors()); }, [dispatch]);

  useEffect(() => {
    if (openSignal === undefined || lastHandledOpenSignalRef.current === openSignal) return;
    lastHandledOpenSignalRef.current = openSignal;
    if (!canOpenMappingEditor) return;
    setShowTargetMappingPopup(true);
  }, [canOpenMappingEditor, openSignal]);

  useEffect(() => {
    if (!showTargetMappingPopup || canOpenMappingEditor) return;
    setShowTargetMappingPopup(false);
  }, [canOpenMappingEditor, showTargetMappingPopup]);

  useEffect(() => {
    if (!config.connectionId || sinkType !== 'jdbc') { setSchemas([]); setTables([]); return; }
    setLoadingSchemas(true);
    api.introspectSchemas(config.connectionId)
      .then(r => setSchemas((r.data?.data ?? []).map((s: any) => s.schemaName ?? s)))
      .catch(() => setSchemas([]))
      .finally(() => setLoadingSchemas(false));
  }, [config.connectionId, sinkType]);

  useEffect(() => {
    if (!config.connectionId || !config.schema || sinkType !== 'jdbc') { setTables([]); return; }
    setLoadingTables(true);
    api.introspectTables(config.connectionId, config.schema)
      .then(r => setTables(r.data?.data ?? []))
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false));
  }, [config.connectionId, config.schema, sinkType]);

  useEffect(() => {
    if (!config.connectionId || !config.schema || !config.table || sinkType !== 'jdbc') {
      setTargetColumns([]);
      return;
    }
    setLoadingTargetColumns(true);
    api.introspectColumns(config.connectionId, config.schema, config.table)
      .then(r => setTargetColumns(uniqueOrderedStrings((r.data?.data ?? []).map((c: { columnName: string }) => c.columnName))))
      .catch(() => setTargetColumns([]))
      .finally(() => setLoadingTargetColumns(false));
  }, [config.connectionId, config.schema, config.table, sinkType]);

  const existingMappings: Array<{ src: string; tgt: string }> = useMemo(() => {
    try { return config.columnMappings ? JSON.parse(config.columnMappings) : []; }
    catch { return []; }
  }, [config.columnMappings]);

  const targetMappingRows: Array<{ tgt: string; src: string }> = useMemo(() => {
    const lookup = new Map(existingMappings.map(mapping => [mapping.tgt, mapping.src]));
    if (targetColumns.length === 0) {
      return existingMappings.map(mapping => ({ tgt: mapping.tgt, src: mapping.src }));
    }
    return targetColumns.map(target => ({ tgt: target, src: lookup.get(target) ?? '' }));
  }, [existingMappings, targetColumns]);

  const persistTargetMappingRows = useCallback((rows: Array<{ tgt: string; src: string }>) => {
    const compact = rows
      .filter(row => row.tgt && row.src)
      .map(row => ({ src: row.src, tgt: row.tgt }));
    onChange({ columnMappings: JSON.stringify(compact) });
  }, [onChange]);

  const autoMapTargetRows = useCallback(() => {
    if (targetColumns.length === 0 || sourceColumns.length === 0) return;
    const sourceLookupInsensitive = new Map(sourceColumns.map(source => [source.toLowerCase(), source]));
    const sourceLookupSensitive = new Map(sourceColumns.map(source => [source, source]));
    const auto = targetColumns.map((target, index) => {
      if (autoMapMode === 'position') {
        return { tgt: target, src: sourceColumns[index] ?? '' };
      }
      if (autoMapMode === 'name_cs') {
        return { tgt: target, src: sourceLookupSensitive.get(target) ?? '' };
      }
      return {
        tgt: target,
        src: sourceLookupInsensitive.get(target.toLowerCase()) ?? '',
      };
    });
    persistTargetMappingRows(auto);
  }, [autoMapMode, persistTargetMappingRows, sourceColumns, targetColumns]);

  const updateTargetMappingRow = useCallback((rowIndex: number, src: string) => {
    const updated = targetMappingRows.map((entry, index) => index === rowIndex ? { ...entry, src } : entry);
    persistTargetMappingRows(updated);
  }, [persistTargetMappingRows, targetMappingRows]);

  const mappedTargetCount = useMemo(
    () => targetMappingRows.filter(row => row.src).length,
    [targetMappingRows],
  );

  const addKey = () => {
    if (!newKey.trim()) return;
    const updated = [...keyColumns, newKey.trim()];
    setKeyColumns(updated);
    onChange({ keyColumns: updated.join(',') });
    setNewKey('');
  };

  const removeKey = (i: number) => {
    const updated = keyColumns.filter((_, idx) => idx !== i);
    setKeyColumns(updated);
    onChange({ keyColumns: updated.join(',') });
  };

  if (showTargetMappingPopup) {
    return (
      <>
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowTargetMappingPopup(false)} />
        <div className="fixed inset-0 z-[71] flex items-center justify-center p-2">
          <div className="flex h-[min(82vh,820px)] w-[min(1240px,96vw)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0d0f1a] shadow-[0_28px_90px_rgba(2,6,23,0.76)]">
            <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-emerald-300">Target Mapping</div>
                <div className="mt-0.5 text-[12px] text-slate-300">Map source columns, audit values, or leave a target empty to skip it.</div>
              </div>
              <button
                type="button"
                onClick={() => setShowTargetMappingPopup(false)}
                className="rounded p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close target mapping popup"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
              {sinkType !== 'jdbc' ? (
                <div className="rounded-lg border border-slate-700 bg-[#111320] px-4 py-5 text-[12px] text-slate-300">
                  Target bulk mapping popup is available for JDBC targets. Choose JDBC sink type.
                </div>
              ) : !config.connectionId || !config.schema || !config.table ? (
                <div className="rounded-lg border border-slate-700 bg-[#111320] px-4 py-5 text-[12px] text-slate-300">
                  Select connection, schema, and table first to load target columns.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 bg-[#101426] px-2 py-2">
                    <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-400">
                      <span>Targets {targetColumns.length}</span>
                      <span>Mapped {mappedTargetCount}</span>
                      <span>Skipped {Math.max(targetColumns.length - mappedTargetCount, 0)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">Auto-map</span>
                      <select
                        value={autoMapMode}
                        onChange={e => setAutoMapMode(e.target.value as 'name_ci' | 'name_cs' | 'position')}
                        className="h-6 rounded border border-slate-600 bg-[#1a2139] px-2 text-[12px] text-slate-100"
                      >
                        <option value="name_ci">Name · Case-insensitive</option>
                        <option value="name_cs">Name · Case-sensitive</option>
                        <option value="position">Position</option>
                      </select>
                      <button
                        type="button"
                        onClick={autoMapTargetRows}
                        disabled={loadingTargetColumns || loadingSourceColumns || targetColumns.length === 0}
                        className="h-6 rounded border border-blue-500/40 bg-blue-500/10 px-2 text-[12px] font-semibold text-blue-300 disabled:opacity-40"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-[240px_minmax(0,1fr)_140px] border-b border-slate-700 bg-[#0f1527] px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-300">
                    <div>Target Column</div>
                    <div>Source / Audit Value</div>
                    <div>Status</div>
                  </div>

                  <div className="max-h-[58vh] overflow-auto">
                    {targetMappingRows.map((row, index) => {
                      const usesAuditValue = isAuditMappingValue(row.src);
                      const statusLabel = !row.src ? 'Skipped' : usesAuditValue ? 'Audit Value' : 'Mapped';
                      const statusClass = !row.src
                        ? 'text-slate-400'
                        : usesAuditValue
                          ? 'text-amber-300'
                          : 'text-emerald-400';

                      return (
                        <div
                          key={`${row.tgt}_${index}`}
                          className={`grid grid-cols-[240px_minmax(0,1fr)_140px] items-center gap-3 border-t border-slate-800/60 px-3 py-0.5 ${index % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'}`}
                        >
                          <div className="truncate text-[12px] font-semibold font-mono text-white" title={row.tgt}>
                            {row.tgt}
                          </div>
                          <InlineSelect value={row.src} onChange={value => updateTargetMappingRow(index, value)}>
                            <option value="">Skip this target column</option>
                            <optgroup label="Source columns">
                              {sourceColumns.map(source => (
                                <option key={source} value={source}>{source}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Audit values">
                              {TARGET_AUDIT_VALUE_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </optgroup>
                          </InlineSelect>
                          <div className={`truncate text-[12px] font-semibold ${statusClass}`} title={row.src ? (usesAuditValue ? getAuditMappingLabel(row.src) : row.src) : 'Skipped'}>
                            {row.src
                              ? usesAuditValue
                                ? `${statusLabel} · ${getAuditMappingLabel(row.src)}`
                                : `${statusLabel} · ${row.src}`
                              : statusLabel}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-700 px-3 py-2">
              <div className="text-[12px] text-slate-400">
                Sources {loadingSourceColumns ? 'loading…' : sourceColumns.length} · Targets {loadingTargetColumns ? 'loading…' : targetColumns.length} · Audit values available in every row
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTargetMappingPopup(false)}
                  className="h-6 rounded border border-slate-600 bg-[#1a2139] px-2 text-[12px] font-semibold text-slate-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      <SectionLabel>Sink Type</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {[
          { val: 'jdbc',    label: '⬡ Database'  },
          { val: 'file',    label: '📄 File'      },
          { val: 'delta',   label: '△ Delta Lake' },
          { val: 'iceberg', label: '🧊 Iceberg'   },
        ].map(({ val, label }) => (
          <button key={val}
            onClick={() => onChange({ sinkType: val, connectionId: '', schema: '', table: '', targetPath: '', fileFormat: '', deltaPath: '', deltaTable: '', catalogTable: '' })}
            className={`h-8 rounded text-[12px] font-semibold border transition-colors ${
              sinkType === val
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#1e2035] text-slate-300 border-slate-600 hover:border-slate-400 hover:text-white'
            }`}>{label}</button>
        ))}
      </div>

      {sinkType === 'jdbc' && (<>
        <SectionLabel>Destination</SectionLabel>
        <Field label="Connection" required>
          <Select value={config.connectionId ?? ''} onChange={v => onChange({ connectionId: v, schema: '', table: '' })}>
            <option value="">— select connection —</option>
            {allConnectors.map(c => (
              <option key={c.connectorId} value={c.connectorId}>
                {c.connectorDisplayName} ({c.connectorTypeCode?.replace(/^JDBC_/, '')})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Schema" required>
          <Select value={config.schema ?? ''} onChange={v => onChange({ schema: v, table: '' })}
            disabled={!config.connectionId} loading={loadingSchemas}>
            <option value="">— select schema —</option>
            {schemas.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Table" required>
          <div className="flex gap-1.5">
            <div className="flex-1">
              <Select value={config.table ?? ''} onChange={v => onChange({ table: v })}
                disabled={!config.schema} loading={loadingTables}>
                <option value="">— select or type table —</option>
                {tables.map(t => <option key={t.tableName} value={t.tableName}>{t.tableName}</option>)}
              </Select>
            </div>
            <TextInput value={config.table ?? ''} onChange={v => onChange({ table: v })}
              placeholder="or type name" className="flex-1 text-[12px]" />
          </div>
        </Field>
        <SectionLabel>Loading Strategy</SectionLabel>
        <Field label="Write Mode" required>
          <Select value={writeMode} onChange={v => onChange({ writeMode: v })}>
            {WRITE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          {selectedMode && (
            <p className="mt-1.5 text-[12px] text-slate-300 leading-relaxed">{selectedMode.desc}</p>
          )}
        </Field>
        {needsKeyColumns && (
          <Field label={writeMode === 'SCD2' || writeMode === 'SCD3' ? 'Natural Key Columns' : 'Key / Match Columns'} required>
            <div className="space-y-1">
              {keyColumns.map((k, i) => (
                <div key={i} className="flex items-center gap-1.5 h-7 px-2 rounded bg-[#1e2035] border border-slate-500">
                  <span className="flex-1 text-[12px] text-slate-300 font-mono">{k}</span>
                  <button onClick={() => removeKey(i)} className="text-slate-400 hover:text-red-300 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <TextInput value={newKey} onChange={setNewKey} placeholder="column_name" className="flex-1" />
                <button onClick={addKey} className="h-8 px-2.5 rounded bg-blue-700 hover:bg-blue-600 text-white text-[12px] font-medium transition-colors">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </Field>
        )}
        {writeMode === 'SCD2' && (
          <Field label="Effective Date Column">
            <TextInput value={config.scd2EffDateCol ?? 'eff_start_date'} onChange={v => onChange({ scd2EffDateCol: v })} />
          </Field>
        )}
        <SectionLabel>Options</SectionLabel>
        <Field label="Null Handling">
          <Select value={config.nullHandling ?? 'KEEP'} onChange={v => onChange({ nullHandling: v })}>
            <option value="KEEP">Keep nulls as-is</option>
            <option value="REJECT">Reject rows with null keys</option>
            <option value="DEFAULT">Replace with default values</option>
          </Select>
        </Field>
        <Field label="On Error">
          <Select value={config.onError ?? 'FAIL'} onChange={v => onChange({ onError: v })}>
            <option value="FAIL">Abort (fail the pipeline)</option>
            <option value="SKIP">Skip bad rows and continue</option>
            <option value="QUARANTINE">Quarantine bad rows to error table</option>
          </Select>
        </Field>
        <button
          type="button"
          onClick={() => setShowTargetMappingPopup(true)}
          disabled={!canOpenMappingEditor}
          className="mb-2 flex items-center gap-1.5 h-8 px-3 rounded bg-[#1e2035] border border-emerald-500/40 text-[12px] text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#1e2035]"
        >
          Open Target Mapping
        </button>
        <div className="mb-2 rounded border border-slate-700 bg-[#101629] px-3 py-2 text-[12px] text-slate-400">
          {!canOpenMappingEditor
            ? 'Select connection, schema, and table first. Then double-click the target node or use the mapping button.'
            : mappedTargetCount > 0
            ? `${mappedTargetCount} target column${mappedTargetCount === 1 ? '' : 's'} mapped. Use the popup for auto-map, audit values, and manual overrides.`
            : 'No target mappings saved yet. Use the popup to auto-map by name or position, then override rows inline.'}
        </div>
      </>)}

      {sinkType === 'file' && (<>
        <SectionLabel>Output Location</SectionLabel>
        <Field label="Output Path / URI" required>
          <TextInput value={config.targetPath ?? ''} onChange={v => onChange({ targetPath: v })}
            placeholder="s3://bucket/path/  or  /output/data/  or  hdfs://…" />
          <div className="text-[12px] text-slate-300 mt-1">Supports S3, HDFS, ADLS, GCS, local paths</div>
        </Field>
        <Field label="File Format" required>
          <Select value={config.fileFormat ?? ''} onChange={v => onChange({ fileFormat: v })}>
            <option value="">— select format —</option>
            {SINK_FILE_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
          </Select>
        </Field>
        {config.fileFormat === 'csv' && (
          <Field label="Write Header">
            <Select value={config.header ?? 'true'} onChange={v => onChange({ header: v })}>
              <option value="true">Yes — include header row</option>
              <option value="false">No header</option>
            </Select>
          </Field>
        )}
        <SectionLabel>Write Options</SectionLabel>
        <Field label="Write Mode" required>
          <Select value={writeMode} onChange={v => onChange({ writeMode: v })}>
            {SINK_WRITE_MODES_FILE.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          {SINK_WRITE_MODES_FILE.find(m => m.value === writeMode) && (
            <p className="mt-1.5 text-[12px] text-slate-300">{SINK_WRITE_MODES_FILE.find(m => m.value === writeMode)!.desc}</p>
          )}
        </Field>
        <Field label="Compression">
          <Select value={config.compression ?? 'none'} onChange={v => onChange({ compression: v })}>
            <option value="none">None</option>
            <option value="snappy">Snappy</option>
            <option value="gzip">Gzip</option>
            <option value="lz4">LZ4</option>
            <option value="zstd">Zstd</option>
          </Select>
        </Field>
        <Field label="Partition By (columns)">
          <TextInput value={config.partitionBy ?? ''} onChange={v => onChange({ partitionBy: v })}
            placeholder="col1,col2 — leave blank for no partitioning" />
        </Field>
      </>)}

      {sinkType === 'delta' && (<>
        <SectionLabel>Delta Target</SectionLabel>
        <Field label="Storage Path">
          <TextInput value={config.deltaPath ?? ''} onChange={v => onChange({ deltaPath: v })}
            placeholder="s3://bucket/delta/table  or  /mnt/delta/table" />
        </Field>
        <Field label="Table Name (optional)">
          <TextInput value={config.deltaTable ?? ''} onChange={v => onChange({ deltaTable: v })}
            placeholder="catalog.schema.table_name" />
          <div className="text-[12px] text-slate-300 mt-1">Use Table Name for managed Delta tables; Path for external storage</div>
        </Field>
        <SectionLabel>Write Strategy</SectionLabel>
        <Field label="Write Mode" required>
          <Select value={writeMode} onChange={v => onChange({ writeMode: v })}>
            <option value="APPEND">Append</option>
            <option value="OVERWRITE">Overwrite</option>
            <option value="MERGE">Merge (upsert via MERGE INTO)</option>
          </Select>
        </Field>
        {writeMode === 'MERGE' && (
          <Field label="Merge Key Columns" required>
            <TextInput value={config.mergeKeys ?? ''} onChange={v => onChange({ mergeKeys: v })}
              placeholder="id,tenant_id" />
            <div className="text-[12px] text-slate-300 mt-1">Comma-separated columns used to match rows</div>
          </Field>
        )}
        <Field label="Partition By (columns)">
          <TextInput value={config.partitionBy ?? ''} onChange={v => onChange({ partitionBy: v })} placeholder="col1,col2" />
        </Field>
        <Field label="Z-Order By (columns)">
          <TextInput value={config.zOrderBy ?? ''} onChange={v => onChange({ zOrderBy: v })}
            placeholder="col1,col2 — improves query performance" />
        </Field>
      </>)}

      {sinkType === 'iceberg' && (<>
        <SectionLabel>Iceberg Target</SectionLabel>
        <Field label="Catalog Table Name" required>
          <TextInput value={config.catalogTable ?? ''} onChange={v => onChange({ catalogTable: v })}
            placeholder="catalog.schema.table_name" />
          <div className="text-[12px] text-slate-300 mt-1">Must be a registered Iceberg catalog table</div>
        </Field>
        <SectionLabel>Write Strategy</SectionLabel>
        <Field label="Write Mode" required>
          <Select value={writeMode} onChange={v => onChange({ writeMode: v })}>
            <option value="APPEND">Append</option>
            <option value="OVERWRITE">Dynamic Overwrite (by partition)</option>
            <option value="MERGE">Merge (MERGE INTO SQL)</option>
          </Select>
        </Field>
        {writeMode === 'MERGE' && (
          <Field label="Merge Key Columns" required>
            <TextInput value={config.mergeKeys ?? ''} onChange={v => onChange({ mergeKeys: v })} placeholder="id,tenant_id" />
          </Field>
        )}
      </>)}
    </div>
  );
}

// ─── Filter node config ────────────────────────────────────────────────────────
function FilterConfig({ config, onChange, nodeId }: {
  config: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  nodeId: string;
}) {
  const { columns } = useUpstreamColumns(nodeId);
  const [visualMode, setVisualMode] = useState(() => config.authoringMode === 'visual' || (!!config.conditionJson && config.authoringMode !== 'sql'));

  const handleConditionChange = (cond: ComplexCondition) => {
    const sql = conditionToSQL(cond, 'spark');
    onChange({
      conditionJson: JSON.stringify(cond),
      expression: sql,
      authoringMode: 'visual',
      conditionLanguage: 'spark_sql',
    });
  };

  const conditionValue: ComplexCondition | null = useMemo(() => {
    if (!config.conditionJson) return null;
    try { return JSON.parse(config.conditionJson); } catch { return null; }
  }, [config.conditionJson]);

  const fields = columns.map(c => ({ name: c, type: 'string' }));
  const normalizedExpression = normalizeFilterExpression(config.expression ?? '');
  const filterMode = config.filterMode ?? 'INCLUDE';
  const effectivePredicate = normalizedExpression
    ? (filterMode === 'EXCLUDE' ? `NOT (${normalizedExpression})` : normalizedExpression)
    : filterMode === 'EXCLUDE' ? 'NOT (<predicate>)' : '<predicate>';

  return (
    <div>
      <SectionLabel>Filter Condition</SectionLabel>
      <Field label="Authoring Mode">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setVisualMode(false);
              onChange({ authoringMode: 'sql', conditionLanguage: 'spark_sql' });
            }}
            className={`h-9 rounded-lg text-[12px] font-semibold border transition-colors ${
              !visualMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#1e2035] text-slate-300 border-slate-600 hover:text-white'
            }`}
          >
            Spark SQL
          </button>
          <button
            type="button"
            onClick={() => {
              setVisualMode(true);
              onChange({ authoringMode: 'visual', conditionLanguage: 'spark_sql' });
            }}
            className={`h-9 rounded-lg text-[12px] font-semibold border transition-colors ${
              visualMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#1e2035] text-slate-300 border-slate-600 hover:text-white'
            }`}
          >
            Visual Builder
          </button>
        </div>
      </Field>

      <div className="mb-3 rounded-xl border border-slate-700 bg-[#111426] px-3 py-2.5">
        <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Execution Semantics</div>
        <p className="mt-2 text-[12px] leading-5 text-slate-300">
          Manual mode accepts a Spark SQL predicate. The generated PySpark uses that predicate directly inside Spark, not a custom SQL-to-PySpark translator.
        </p>
        <p className="mt-1 text-[12px] leading-5 text-slate-300">
          Omit the <code className="font-mono text-slate-300">WHERE</code> keyword if you want, but if someone types it anyway we strip it automatically during generation.
        </p>
      </div>

      {!visualMode ? (
        <Field label="Spark SQL Predicate" required>
          <textarea
            value={config.expression ?? ''}
            onChange={e => onChange({
              expression: e.target.value,
              authoringMode: 'sql',
              conditionLanguage: 'spark_sql',
            })}
            placeholder="status = 'ACTIVE' AND amount > 100"
            className="w-full rounded-xl bg-[#1e2035] border border-slate-500 px-3 py-3 text-[12px] font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-y"
            rows={6}
          />
          <p className="mt-1.5 px-1 text-[12px] text-slate-300">
            Write only the predicate expression. Do not write a full SELECT statement.
          </p>
        </Field>
      ) : (
        <div className="mb-3">
          {fields.length === 0 && (
            <p className="mb-2 px-1 text-[12px] italic text-slate-300">Connect an upstream node to enable column pickers.</p>
          )}
          <ConditionBuilder
            value={conditionValue}
            onChange={handleConditionChange}
            fields={fields}
          />
          {normalizedExpression && (
            <div className="mt-2 rounded-xl border border-slate-700 bg-[#111426] px-3 py-2.5">
              <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Generated Predicate</p>
              <code className="block text-[12px] font-mono leading-5 text-blue-300 break-all">{normalizedExpression}</code>
            </div>
          )}
        </div>
      )}

      <Field label="Filter Mode">
        <Select value={config.filterMode ?? 'INCLUDE'} onChange={v => onChange({ filterMode: v })}>
          <option value="INCLUDE">Include matching rows (WHERE)</option>
          <option value="EXCLUDE">Exclude matching rows (WHERE NOT)</option>
        </Select>
      </Field>

      <div className="rounded-xl border border-slate-700 bg-[#111426] px-3 py-2.5">
        <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Effective Predicate</div>
        <code className="mt-2 block text-[12px] font-mono leading-5 text-slate-200 break-all">{effectivePredicate}</code>
      </div>
    </div>
  );
}

// ─── Join node config ──────────────────────────────────────────────────────────
function JoinConfig({ config, onChange, nodeId }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
  nodeId: string;
}) {
  const nodes = useAppSelector(s => s.pipeline.nodes);
  const edges = useAppSelector(s => s.pipeline.edges);

  const upstreamSourceNodes = useMemo(() => {
    const sourceIds = Object.values(edges).filter(e => e.target === nodeId).map(e => e.source);
    return sourceIds.map(id => nodes[id]).filter(Boolean);
  }, [edges, nodeId, nodes]);

  const leftSource  = upstreamSourceNodes[0];
  const rightSource = upstreamSourceNodes[1];

  const fetchCols = async (n: typeof leftSource): Promise<string[]> => {
    if (!n) return [];
    const cfg = n.config as Record<string, string>;
    if (!cfg.connectionId || !cfg.table) return [];
    try {
      const res = await api.introspectColumns(cfg.connectionId, cfg.schema ?? '', cfg.table);
      return (res.data?.data ?? []).map((c: { columnName: string }) => c.columnName).filter(Boolean);
    } catch { return []; }
  };

  const [leftCols,  setLeftCols]  = useState<string[]>([]);
  const [rightCols, setRightCols] = useState<string[]>([]);
  const [loadingL,  setLoadingL]  = useState(false);
  const [loadingR,  setLoadingR]  = useState(false);

  useEffect(() => {
    if (!leftSource) return;
    setLoadingL(true);
    fetchCols(leftSource).then(cols => { setLeftCols(cols); setLoadingL(false); });
  }, [leftSource?.id]);

  useEffect(() => {
    if (!rightSource) return;
    setLoadingR(true);
    fetchCols(rightSource).then(cols => { setRightCols(cols); setLoadingR(false); });
  }, [rightSource?.id]);

  const [keys, setKeys] = useState<Array<{ left: string; right: string }>>(() => {
    try { return config.joinKeys ? JSON.parse(config.joinKeys) : [{ left: '', right: '' }]; }
    catch { return [{ left: '', right: '' }]; }
  });

  const updateKey = (i: number, side: 'left' | 'right', val: string) => {
    const updated = keys.map((k, idx) => idx === i ? { ...k, [side]: val } : k);
    setKeys(updated); onChange({ joinKeys: JSON.stringify(updated) });
  };

  const leftName  = leftSource  ? (leftSource.name  || 'Left')  : 'Left';
  const rightName = rightSource ? (rightSource.name || 'Right') : 'Right';

  const ColPicker = ({ value, cols, loading, onSelect, side }: {
    value: string; cols: string[]; loading: boolean; onSelect: (v: string) => void; side: string;
  }) => (
    <InlineSelect value={value} onChange={onSelect} loading={loading}>
      <option value="">{loading ? 'Loading…' : cols.length ? `— ${side} col —` : `type ${side} col`}</option>
      {cols.map(c => <option key={c} value={c}>{c}</option>)}
    </InlineSelect>
  );

  return (
    <div>
      <SectionLabel>Join Type</SectionLabel>
      <Field label="Join Type" required>
        <Select value={config.joinType ?? 'INNER'} onChange={v => onChange({ joinType: v })}>
          {JOIN_TYPES.map(t => <option key={t} value={t}>{t} JOIN</option>)}
        </Select>
      </Field>

      <SectionLabel>Join Conditions</SectionLabel>
      <div className="flex text-[12px] text-slate-300 font-semibold px-1 mb-1 gap-1.5">
        <span className="flex-1 truncate">{leftName}</span>
        <span className="w-5" />
        <span className="flex-1 truncate">{rightName}</span>
        <span className="w-5" />
      </div>
      <ZebraList>
        {keys.map((k, i) => (
          <ZebraRow key={i} index={i}>
            {leftCols.length > 0 || loadingL ? (
              <ColPicker value={k.left} cols={leftCols} loading={loadingL} onSelect={v => updateKey(i, 'left', v)} side="left" />
            ) : (
              <TextInput value={k.left} onChange={v => updateKey(i, 'left', v)} placeholder="left.col" className="h-6 px-1.5 text-[12px]" />
            )}
            <span className="text-slate-300 text-[12px] shrink-0">=</span>
            {rightCols.length > 0 || loadingR ? (
              <ColPicker value={k.right} cols={rightCols} loading={loadingR} onSelect={v => updateKey(i, 'right', v)} side="right" />
            ) : (
              <TextInput value={k.right} onChange={v => updateKey(i, 'right', v)} placeholder="right.col" className="h-6 px-1.5 text-[12px]" />
            )}
            <CompactIconButton
              title="Delete join key"
              tone="danger"
              onClick={() => {
                const updated = keys.filter((_, idx) => idx !== i);
                setKeys(updated);
                onChange({ joinKeys: JSON.stringify(updated) });
              }}
            >
              <Trash2 className="h-3 w-3" />
            </CompactIconButton>
          </ZebraRow>
        ))}
      </ZebraList>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] text-slate-300">Rows {keys.length}</span>
        <CompactIconButton
          title="Add join key"
          onClick={() => {
            const updated = [...keys, { left: '', right: '' }];
            setKeys(updated);
            onChange({ joinKeys: JSON.stringify(updated) });
          }}
        >
          <Plus className="h-3 w-3" />
        </CompactIconButton>
      </div>
      {(!leftSource || !rightSource) && (
        <p className="text-[12px] text-slate-400 italic mt-2 px-1">Connect two nodes to enable column pickers.</p>
      )}
    </div>
  );
}

// ─── Multi-Transform Node config ───────────────────────────────────────────────
// Shows a list of per-column TransformSequences with a compact matrix popup
// and inline properties editor in the same popup (no secondary edit modal).
// Also exposes PatternWizard for regex pattern lookups.
// Stores sequences as structured config so save/generate paths can keep them intact.
function serializeTransformSequenceForStore(sequence: TransformSequence): TransformSequence {
  return JSON.parse(JSON.stringify({
    ...sequence,
    createdAt: sequence.createdAt instanceof Date ? sequence.createdAt.toISOString() : sequence.createdAt,
    updatedAt: sequence.updatedAt instanceof Date ? sequence.updatedAt.toISOString() : sequence.updatedAt,
    versions: (sequence.versions ?? []).map(version => ({
      ...version,
      createdAt: version.createdAt instanceof Date ? version.createdAt.toISOString() : version.createdAt,
    })),
  })) as TransformSequence;
}

function serializeTransformSequencesForStore(sequences: TransformSequence[]): TransformSequence[] {
  return sequences.map(serializeTransformSequenceForStore);
}

function buildDefaultTransformParams(transformType: string): Record<string, unknown> {
  const primitive = TRANSFORM_REGISTRY[transformType];
  if (!primitive) return {};
  return primitive.parameters.reduce<Record<string, unknown>>((acc, param) => {
    if (param.default !== undefined) acc[param.id] = JSON.parse(JSON.stringify(param.default));
    return acc;
  }, {});
}

function createDefaultTransformStep(transformType = 'upper'): TransformStep {
  return createStep(transformType, buildDefaultTransformParams(transformType), { enabled: true });
}

function isCompactInlineParam(param: ParameterDef | undefined): boolean {
  if (!param) return false;
  return ['text', 'number', 'select', 'toggle', 'date'].includes(param.type);
}

function renderCompactParamControl(
  param: ParameterDef,
  value: unknown,
  onChange: (next: unknown) => void,
  disabled?: boolean,
) {
  const className = 'h-8 w-full rounded border border-slate-600 bg-[#1a1f31] px-2 text-[12px] text-slate-100 focus:outline-none focus:border-blue-400';
  const inputValue = typeof value === 'number' || typeof value === 'string' ? value : '';

  if (param.type === 'number') {
    return (
      <input
        type="number"
        value={inputValue}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        disabled={disabled}
        className={className}
      />
    );
  }

  if (param.type === 'select') {
    return (
      <select
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={className}
      >
        <option value="">Select</option>
        {param.options?.map(option => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (param.type === 'toggle') {
    return (
      <label className="flex h-8 items-center gap-2 text-[12px] text-slate-200">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded"
        />
        <span>{param.label}</span>
      </label>
    );
  }

  if (param.type === 'date') {
    return (
      <input
        type="date"
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={className}
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={param.placeholder}
      className={className}
    />
  );
}

function TransformNodeConfig({ config, onChange, nodeId, pipelineId, onSaveSequences, openSignal }: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  nodeId: string;
  pipelineId: string;
  onSaveSequences?: (updated: TransformSequence[]) => void;
  openSignal?: number;
}) {
  const { columns: upstreamColumns } = useUpstreamColumns(nodeId);
  const sequences: TransformSequence[] = useMemo(() => {
    const raw = config.transformSequences;
    if (!raw) return [];
    try { return Array.isArray(raw) ? (raw as TransformSequence[]) : JSON.parse(String(raw)); }
    catch { return []; }
  }, [config.transformSequences]);

  const buildSequenceWithSemantics = useCallback((base: TransformSequence, patch: Partial<TransformSequence> = {}): TransformSequence => {
    const merged = { ...base, ...patch, updatedAt: new Date() } as TransformSequence;
    const source = String(merged.sourceColumn ?? '').trim();
    const target = String(merged.columnName ?? '').trim();
    const enabled = Boolean(source && target);
    return {
      ...merged,
      enabled,
      name: source && target ? `${source} -> ${target}` : `Transform ${target || source || 'column'}`,
      steps: Array.isArray(merged.steps) ? merged.steps : [],
    };
  }, []);

  const createSeededSequence = useCallback((targetColumn: string, indexSeed = 0): TransformSequence => {
    const ts = Date.now() + indexSeed;
    const seededBase: TransformSequence = {
      id: `seq_${ts}`,
      name: `Transform ${targetColumn}`,
      enabled: true,
      columnId: `col_${ts}`,
      columnName: targetColumn,
      sourceColumn: upstreamColumns.includes(targetColumn) ? targetColumn : (upstreamColumns[0] ?? targetColumn),
      targetEngine: 'spark',
      pipelineId: pipelineId || nodeId,
      datasetId: nodeId,
      author: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      currentVersionId: `v_${ts}`,
      steps: [],
      versions: [],
    };
    return buildSequenceWithSemantics(seededBase);
  }, [buildSequenceWithSemantics, nodeId, pipelineId, upstreamColumns]);

  const createDraftSequence = useCallback((): TransformSequence => {
    const seedColumn = upstreamColumns[0] ?? `target_${sequences.length + 1}`;
    return createSeededSequence(seedColumn, sequences.length + 1);
  }, [createSeededSequence, sequences.length, upstreamColumns]);

  // null = list; 'pattern' = PatternWizard; 'matrix' = compact bulk mapping popup
  const [editing, setEditing] = useState<'pattern' | 'matrix' | null>(null);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [expandedSequenceIds, setExpandedSequenceIds] = useState<Set<string>>(new Set());
  const [expandedTransformIds, setExpandedTransformIds] = useState<Set<string>>(new Set());
  const hasAutoSeededRef = useRef(false);
  const lastHandledOpenSignalRef = useRef<number | undefined>(undefined);
  const transformOptions = useMemo(
    () => Object.values(TRANSFORM_REGISTRY)
      .filter(primitive => primitive.id !== 'custom_sql')
      .sort((left, right) => left.label.localeCompare(right.label)),
    [],
  );

  const persistAndNotify = useCallback((updated: TransformSequence[]) => {
    const serialized = serializeTransformSequencesForStore(updated);
    if (onSaveSequences) {
      onSaveSequences(serialized);
      return;
    }
    onChange({ transformSequences: serialized });
  }, [onChange, onSaveSequences]);

  const seedMappingsFromColumns = useCallback(() => {
    if (sequences.length > 0 || upstreamColumns.length === 0) return;
    const seeded = upstreamColumns.map((column, index) => createSeededSequence(column, index));
    persistAndNotify(seeded);
  }, [createSeededSequence, persistAndNotify, sequences.length, upstreamColumns]);

  useEffect(() => {
    if (sequences.length > 0) {
      hasAutoSeededRef.current = true;
      return;
    }
    if (upstreamColumns.length === 0 || hasAutoSeededRef.current) return;
    hasAutoSeededRef.current = true;
    const seeded = upstreamColumns.map((column, index) => createSeededSequence(column, index));
    persistAndNotify(seeded);
  }, [createSeededSequence, persistAndNotify, sequences.length, upstreamColumns]);

  useEffect(() => {
    if (openSignal === undefined || lastHandledOpenSignalRef.current === openSignal) return;
    lastHandledOpenSignalRef.current = openSignal;
    setEditing('matrix');
    setSelectedSequenceId(prev => prev ?? (sequences[0]?.id ?? null));
  }, [openSignal, sequences]);

  useEffect(() => {
    if (sequences.length === 0) {
      setSelectedSequenceId(null);
      return;
    }
    if (!selectedSequenceId || !sequences.some(sequence => sequence.id === selectedSequenceId)) {
      setSelectedSequenceId(sequences[0].id);
    }
  }, [selectedSequenceId, sequences]);

  const patchSequence = useCallback((seqId: string, patch: Partial<TransformSequence>) => {
    const updated = sequences.map(seq => seq.id === seqId ? buildSequenceWithSemantics(seq, patch) : seq);
    persistAndNotify(updated);
  }, [buildSequenceWithSemantics, persistAndNotify, sequences]);

  const handleDelete = (seqId: string) => {
    const updated = sequences.filter(s => s.id !== seqId);
    persistAndNotify(updated);
  };

  const selectedSequence = useMemo(
    () => sequences.find(sequence => sequence.id === selectedSequenceId) ?? null,
    [selectedSequenceId, sequences],
  );

  const selectedEditableSteps = useMemo(
    () => (selectedSequence?.steps ?? []).filter(step => step.type !== 'custom_sql'),
    [selectedSequence],
  );

  const selectedHasLegacyExpression = useMemo(
    () => Boolean(selectedSequence?.steps?.some(step => step.type === 'custom_sql') && selectedEditableSteps.length === 0),
    [selectedEditableSteps.length, selectedSequence],
  );

  const patchSelectedSteps = useCallback((nextSteps: TransformStep[]) => {
    if (!selectedSequence) return;
    patchSequence(selectedSequence.id, { steps: nextSteps });
  }, [patchSequence, selectedSequence]);

  const toggleExpandedTransform = useCallback((stepId: string) => {
    setExpandedTransformIds(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const summarizeSequence = useCallback((seq: TransformSequence): string => {
    const editableSteps = seq.steps.filter(step => step.type !== 'custom_sql' && step.enabled !== false);
    if (!String(seq.sourceColumn ?? '').trim()) return 'Skipped';
    if (editableSteps.length > 0) return `${editableSteps.length} step${editableSteps.length === 1 ? '' : 's'}`;
    if (seq.steps.some(step => step.type === 'custom_sql')) return 'Legacy expression';
    return 'Direct map';
  }, []);

  if (editing === 'matrix') {
    return (
      <>
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm" onClick={() => setEditing(null)} />
        <div className="fixed inset-0 z-[71] flex items-center justify-center p-2">
          <div className="h-[min(88vh,900px)] w-[min(1500px,98vw)] overflow-hidden rounded-2xl border border-slate-700 bg-[#0d0f1a] shadow-[0_28px_90px_rgba(2,6,23,0.76)]">
            <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-blue-300">Column Mapping</div>
                <div className="mt-0.5 text-[12px] text-slate-300">Compact zebra rows on the left, inline properties editor on the right.</div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close mapping popup"
              >
                ✕
              </button>
            </div>

            <div className="grid h-[calc(100%-94px)] grid-cols-[minmax(0,1.18fr)_minmax(470px,0.82fr)] gap-0">
              <section className="min-h-0 overflow-hidden border-r border-slate-800">
                {sequences.length === 0 ? (
                  <div className="h-full px-4 py-6 text-center">
                    <div className="text-[12px] text-slate-300">No target mapping rows yet.</div>
                    <div className="mt-1 text-[12px] text-slate-300">Use one-click prefill to create one row per source column.</div>
                    <button
                      type="button"
                      onClick={seedMappingsFromColumns}
                      className="mt-3 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-[12px] font-semibold text-blue-300"
                    >
                      Prefill from Source Columns
                    </button>
                  </div>
                ) : (
                  <div className="grid h-full grid-rows-[32px_minmax(0,1fr)]">
                    <div className="grid grid-cols-[200px_200px_minmax(0,1fr)_44px] border-b border-slate-700 bg-[#101426] px-3 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      <div className="flex items-center">Target</div>
                      <div className="flex items-center">Source</div>
                      <div className="flex items-center">Status</div>
                      <div className="flex items-center justify-center">Del</div>
                    </div>
                    <div className="overflow-auto">
                      {sequences.map((seq, index) => {
                        const isSelected = selectedSequenceId === seq.id;
                        const rowTone = index % 2 === 0 ? 'bg-[#0f1320]' : 'bg-[#121828]';
                        return (
                          <div
                            key={seq.id}
                            onClick={() => setSelectedSequenceId(seq.id)}
                            className={`grid cursor-pointer grid-cols-[200px_200px_minmax(0,1fr)_44px] border-b border-slate-800 px-3 py-1 ${rowTone} ${isSelected ? 'shadow-[inset_3px_0_0_0_#3b82f6]' : ''}`}
                          >
                            <div className="pr-2">
                              <input
                                value={seq.columnName}
                                onClick={e => e.stopPropagation()}
                                onChange={e => patchSequence(seq.id, { columnName: e.target.value })}
                                className="h-8 w-full rounded border border-slate-600 bg-[#1a1f31] px-2 text-[12px] text-slate-100"
                                placeholder="target_column"
                              />
                            </div>
                            <div className="pr-2">
                              <select
                                value={seq.sourceColumn ?? ''}
                                onClick={e => e.stopPropagation()}
                                onChange={e => patchSequence(seq.id, { sourceColumn: e.target.value })}
                                className="h-8 w-full rounded border border-slate-600 bg-[#1a1f31] px-2 text-[12px] text-slate-100"
                              >
                                <option value="">-- skip --</option>
                                {upstreamColumns.map(column => (
                                  <option key={column} value={column}>{column}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex min-w-0 items-center text-[12px]">
                              <span className={`${String(seq.sourceColumn ?? '').trim() ? 'text-emerald-300' : 'text-slate-300'} truncate`}>
                                {summarizeSequence(seq)}
                              </span>
                            </div>
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleDelete(seq.id);
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded text-red-300 transition hover:bg-red-500/10"
                                title="Delete mapping row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              <section className="min-h-0 overflow-hidden bg-[#0f1320]">
                {selectedSequence ? (
                  <div className="grid h-full grid-rows-[72px_minmax(0,1fr)]">
                    <div className="border-b border-slate-700 px-3 py-2">
                      <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-blue-300">Properties Editor</div>
                      <div className="mt-1 text-[12px] text-slate-100">
                        {selectedSequence.sourceColumn || '∅'} {'->'} {selectedSequence.columnName || '∅'}
                      </div>
                      <div className="mt-1 text-[12px] text-slate-300">
                        Direct map when no transformation rows are listed.
                      </div>
                    </div>

                    <div className="min-h-0 overflow-auto">
                      {selectedHasLegacyExpression && (
                        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
                          Legacy expression rule detected. Adding flat transformation rows will replace it with the new inline model.
                        </div>
                      )}

                      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                        <div>
                          <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-blue-300">Transform</div>
                          <div className="text-[12px] text-slate-300">Flat zebra rows. No groups.</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => patchSelectedSteps([...selectedEditableSteps, createDefaultTransformStep(transformOptions[0]?.id ?? 'upper')])}
                          className="flex h-8 w-8 items-center justify-center rounded border border-blue-500/40 bg-blue-500/10 text-blue-300"
                          title="Add transformation row"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-[46px_220px_minmax(0,1fr)_150px] border-b border-slate-700 bg-[#101426] px-3 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        <div className="flex items-center py-2">#</div>
                        <div className="flex items-center py-2">Transformation</div>
                        <div className="flex items-center py-2">Properties</div>
                        <div className="flex items-center py-2">Actions</div>
                      </div>

                      {selectedEditableSteps.length === 0 ? (
                        <div className="px-3 py-6 text-[12px] text-slate-300">No transformation rows. This mapping is currently a direct source-to-target pass-through.</div>
                      ) : (
                        selectedEditableSteps.map((step, index) => {
                          const primitive = TRANSFORM_REGISTRY[step.type];
                          const inlineParam = primitive?.parameters.length === 1 && isCompactInlineParam(primitive.parameters[0])
                            ? primitive.parameters[0]
                            : undefined;
                          const expanded = expandedTransformIds.has(step.stepId);
                          const rowTone = index % 2 === 0 ? 'bg-[#0f1320]' : 'bg-[#121828]';

                          return (
                            <React.Fragment key={step.stepId}>
                              <div className={`grid grid-cols-[46px_220px_minmax(0,1fr)_150px] border-b border-slate-800 px-3 py-1 ${rowTone}`}>
                                <div className="flex items-center gap-2 text-[12px] text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={step.enabled}
                                    onChange={e => patchSelectedSteps(selectedEditableSteps.map(current => current.stepId === step.stepId ? { ...current, enabled: e.target.checked } : current))}
                                    className="h-4 w-4 rounded"
                                  />
                                  <span>{index + 1}</span>
                                </div>

                                <div className="py-1 pr-2">
                                  <select
                                    value={step.type}
                                    onChange={e => patchSelectedSteps(selectedEditableSteps.map(current => current.stepId === step.stepId ? { ...current, type: e.target.value, params: buildDefaultTransformParams(e.target.value) } : current))}
                                    className="h-8 w-full rounded border border-slate-600 bg-[#1a1f31] px-2 text-[12px] text-slate-100"
                                  >
                                    {transformOptions.map(option => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex items-center py-1 pr-2 text-[12px] text-slate-300">
                                  {primitive ? (
                                    inlineParam ? (
                                      renderCompactParamControl(
                                        inlineParam,
                                        step.params[inlineParam.id] ?? inlineParam.default,
                                        nextValue => patchSelectedSteps(selectedEditableSteps.map(current => current.stepId === step.stepId ? {
                                          ...current,
                                          params: { ...current.params, [inlineParam.id]: nextValue },
                                        } : current)),
                                        !step.enabled,
                                      )
                                    ) : primitive.parameters.length === 0 ? (
                                      <span className="text-slate-300">No parameters</span>
                                    ) : (
                                      <span className="truncate text-slate-400">
                                        {primitive.parameters.length} field{primitive.parameters.length === 1 ? '' : 's'} configured in details
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-red-300">Unknown transform</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 py-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandedTransform(step.stepId)}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-slate-600 text-slate-300 transition hover:border-blue-400 hover:text-white"
                                    title={expanded ? 'Hide details' : 'Show details'}
                                  >
                                    {expanded ? '−' : '+'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => patchSelectedSteps(selectedEditableSteps.filter(current => current.stepId !== step.stepId))}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-red-500/30 text-red-300 transition hover:bg-red-500/10"
                                    title="Delete row"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => {
                                      const next = [...selectedEditableSteps];
                                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                      patchSelectedSteps(next);
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-slate-600 text-slate-300 transition hover:border-blue-400 hover:text-white disabled:opacity-30"
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === selectedEditableSteps.length - 1}
                                    onClick={() => {
                                      const next = [...selectedEditableSteps];
                                      [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                      patchSelectedSteps(next);
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded border border-slate-600 text-slate-300 transition hover:border-blue-400 hover:text-white disabled:opacity-30"
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                </div>
                              </div>

                              {expanded && primitive && primitive.parameters.length > 0 && (
                                <div className={`grid grid-cols-[46px_220px_minmax(0,1fr)_150px] border-b border-slate-800 px-3 py-2 ${rowTone}`}>
                                  <div />
                                  <div className="py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-300">Details</div>
                                  <div className="grid gap-2 md:grid-cols-2">
                                    {primitive.parameters.map(param => (
                                      <div key={param.id} className="min-w-0">
                                        <div className="mb-1 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">{param.label}</div>
                                        {renderCompactParamControl(
                                          param,
                                          step.params[param.id] ?? param.default,
                                          nextValue => patchSelectedSteps(selectedEditableSteps.map(current => current.stepId === step.stepId ? {
                                            ...current,
                                            params: { ...current.params, [param.id]: nextValue },
                                          } : current)),
                                          !step.enabled,
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div />
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-[12px] text-slate-400">Select a row on the left to edit its transformations.</div>
                )}
              </section>
            </div>

            <div className="flex items-center justify-between border-t border-slate-700 px-3 py-2">
              <div className="text-[12px] text-slate-300">Rows {sequences.length} · Source {upstreamColumns.length}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const draft = createDraftSequence();
                    persistAndNotify([...sequences, draft]);
                    setSelectedSequenceId(draft.id);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded border border-blue-500/40 bg-blue-500/10 text-blue-300"
                  title="Add target row"
                >
                  <Plus className="h-2 w-2" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing('pattern')}
                  className="h-5 rounded border border-purple-500/40 bg-purple-500/10 px-1.5 text-[12px] font-semibold text-purple-300"
                >
                  Pattern Library
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // PatternWizard overlay
  if (editing === 'pattern') {
    return (
      <>
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm" onClick={() => setEditing(null)} />
        <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
          <div className="h-[min(82vh,760px)] w-[min(960px,92vw)] overflow-hidden rounded-2xl border border-slate-700 bg-[#0d0f1a] shadow-[0_24px_80px_rgba(2,6,23,0.72)]">
            <PatternWizard
              onComplete={result => {
                const ts = Date.now();
                const versionId = `v_${ts}`;
                const newSeq: TransformSequence = {
                  id: `seq_${ts}`,
                  name: 'Pattern extraction',
                  enabled: true,
                  columnId: `col_${ts}`,
                  columnName: 'new_column',
                  sourceColumn: upstreamColumns[0] ?? '',
                  targetEngine: 'spark',
                  pipelineId: pipelineId || nodeId,
                  datasetId: nodeId,
                  author: 'user',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  currentVersionId: versionId,
                  steps: [{
                    stepId: `step_${ts}`,
                    type: 'regex_extract',
                    enabled: true,
                    onError: 'RETURN_NULL',
                    params: {
                      pattern: result.pattern,
                      groupIndex: result.groupIndex,
                      caseSensitive: result.caseSensitive,
                      multiline: result.multiline,
                      dotMatchesNewline: result.dotMatchesNewline,
                    },
                  }],
                };
                const updated = [...sequences, buildSequenceWithSemantics(newSeq, {})];
                persistAndNotify(updated);
                setSelectedSequenceId(updated[updated.length - 1].id);
                setEditing('matrix');
              }}
              onCancel={() => setEditing('matrix')}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      <SectionLabel>Column Transformations</SectionLabel>
      {sequences.length === 0 ? (
        <p className="text-[12px] text-slate-300 italic py-2 px-1">
          No column transformations yet. Add one below.
        </p>
      ) : (
        <div className="mb-3">
          <div className="grid grid-cols-[28px_minmax(0,1fr)_52px_44px_32px] border-b border-slate-700 bg-[#101426] px-2 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
            <div className="py-1.5" />
            <div className="py-1.5">Mapping</div>
            <div className="py-1.5">Open</div>
            <div className="py-1.5">On</div>
            <div className="py-1.5 text-center">Del</div>
          </div>
          <ZebraList>
            {sequences.map((seq, index) => {
              const expanded = expandedSequenceIds.has(seq.id);
              const activeSteps = seq.steps.filter(step => step.enabled).length;
              const summary = seq.enabled === false
                ? 'Mapping disabled'
                : !String(seq.sourceColumn ?? '').trim()
                  ? 'Skipped'
                  : activeSteps > 0
                    ? `${activeSteps} step${activeSteps === 1 ? '' : 's'}`
                    : 'Direct map';

              return (
                <React.Fragment key={seq.id}>
                  <ZebraRow index={index} className="grid grid-cols-[28px_minmax(0,1fr)_52px_44px_32px] gap-2 px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => setExpandedSequenceIds(prev => {
                        const next = new Set(prev);
                        if (next.has(seq.id)) next.delete(seq.id);
                        else next.add(seq.id);
                        return next;
                      })}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-700 hover:text-white"
                      title={expanded ? 'Collapse mapping' : 'Expand mapping'}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>

                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-mono text-slate-100">
                        {seq.sourceColumn && seq.sourceColumn !== seq.columnName
                          ? `${seq.sourceColumn} -> ${seq.columnName}`
                          : seq.columnName}
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-300">{summary}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSequenceId(seq.id);
                        setEditing('matrix');
                      }}
                      className="h-6 rounded border border-blue-500/30 bg-blue-500/10 px-1.5 text-[12px] font-semibold text-blue-300 transition hover:bg-blue-500/20"
                    >
                      Open
                    </button>

                    <div className={`flex h-6 items-center justify-center text-[12px] font-semibold ${
                      seq.enabled === false ? 'text-slate-400' : 'text-emerald-300'
                    }`}>
                      {seq.enabled === false ? 'Off' : 'On'}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(seq.id)}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-300 transition hover:bg-red-500/10 hover:text-red-400"
                      title="Delete mapping"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </ZebraRow>

                  {expanded && (
                    <div className="border-t border-slate-800 bg-[#0f1320] px-3 py-2">
                      {seq.steps.length === 0 ? (
                        <div className="text-[12px] italic text-slate-300">No transformation rows configured.</div>
                      ) : (
                        <div className="space-y-1">
                          {seq.steps.map((step, stepIndex) => {
                            const primitive = TRANSFORM_REGISTRY[step.type];
                            return (
                              <div key={step.stepId} className="flex items-center gap-2 text-[12px]">
                                <span className={`h-1.5 w-1.5 rounded-full ${step.enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                <span className="text-slate-300">#{stepIndex + 1}</span>
                                <span className="text-slate-200">{primitive?.label ?? step.type}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </ZebraList>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => setEditing('matrix')}
          className="flex items-center justify-center h-8 w-8 rounded bg-[#1e2035] border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 transition-colors shrink-0"
          title="Open mapping popup"
        >
          <Grid3X3 className="w-3 h-3" />
        </button>
        <button
          onClick={() => {
            const draft = createDraftSequence();
            persistAndNotify([...sequences, draft]);
            setSelectedSequenceId(draft.id);
            setEditing('matrix');
          }}
          className="flex items-center justify-center h-8 w-8 rounded bg-[#1e2035] border border-dashed border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-300 transition-colors"
          title="Add column transformation"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          onClick={() => setEditing('pattern')}
          className="flex items-center justify-center h-8 w-8 rounded bg-[#1e2035] border border-dashed border-slate-600 hover:border-purple-500 text-slate-400 hover:text-purple-300 transition-colors shrink-0"
          title="Open Pattern Library"
        >
          <BookOpenText className="w-3 h-3" />
        </button>
      </div>

      <SectionLabel>Execution</SectionLabel>
      <Field label="Strategy">
        <Select value={(config.executionStrategy as string) ?? 'SOURCE'} onChange={v => onChange({ executionStrategy: v })}>
          <option value="SOURCE">Source — push down to DB where possible</option>
          <option value="PYSPARK">PySpark — always execute in Spark</option>
        </Select>
      </Field>
    </div>
  );
}

// ─── Custom SQL config (custom_sql node type only) ─────────────────────────────
function TransformConfig({ config, onChange, nodeId }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
  nodeId: string;
}) {
  const { columns } = useUpstreamColumns(nodeId);
  const [showBuilder, setShowBuilder] = useState(false);

  const inputColumns = columns.map(c => ({ name: c, type: 'string' as const, dataType: 'string' }));
  const mappings: any[] = useMemo(() => {
    try { return config.columnMappings ? JSON.parse(config.columnMappings) : []; } catch { return []; }
  }, [config.columnMappings]);

  if (showBuilder) {
    return (
      <div className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-[#0d0f1a]">
        <div className="h-10 flex items-center px-3 border-b border-slate-700 bg-[#0e1022] shrink-0">
          <span className="text-[12px] font-bold text-blue-300 uppercase tracking-widest flex-1">Transformation Builder</span>
          <button onClick={() => setShowBuilder(false)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <TransformationBuilder
            inputColumns={inputColumns}
            outputColumns={inputColumns}
            currentExpression={config.expression ?? ''}
            currentMappings={mappings}
            onExpressionChange={v => onChange({ expression: v })}
            onMappingsChange={m => onChange({ columnMappings: JSON.stringify(m) })}
            onTest={() => { /* no-op in canvas context */ }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>SQL Expression</SectionLabel>
      <Field label="SELECT / Expression" required>
        <textarea value={config.expression ?? ''} onChange={e => onChange({ expression: e.target.value })}
          placeholder="SELECT *, UPPER(name) AS name_upper, amount * 1.1 AS amount_incl_tax FROM __input__"
          className="w-full px-2.5 py-2 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px]
                     font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
          rows={6} />
        <p className="text-[12px] text-slate-300 mt-1">Use <code className="text-blue-300">__input__</code> to reference the incoming dataset</p>
      </Field>
      <button onClick={() => setShowBuilder(true)}
        className="flex items-center gap-1.5 w-full h-8 px-3 rounded bg-[#1e2035] border border-dashed border-slate-600 hover:border-blue-500 text-[12px] text-slate-400 hover:text-blue-300 transition-colors">
        <Plus className="w-3 h-3" /> Open Transformation Builder (visual column mapping)
      </button>
    </div>
  );
}

// ─── Column loader hook — BFS walk to find the nearest upstream source node ────
function useUpstreamColumns(nodeId: string) {
  const nodes = useAppSelector(s => s.pipeline.nodes);
  const edges = useAppSelector(s => s.pipeline.edges);
  const [columns, setColumns] = useState<string[]>([]);
  const [columnTypeMap, setColumnTypeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // BFS backwards through the DAG to find the first source node
    const visited = new Set<string>();
    const queue: string[] = [nodeId];
    let sourceNode: (typeof nodes)[string] | null = null;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      const n = nodes[curr];
      if (n && n.type === 'source' && curr !== nodeId) { sourceNode = n; break; }
      const parentIds = Object.values(edges).filter(e => e.target === curr).map(e => e.source);
      queue.push(...parentIds);
    }

    if (!sourceNode) {
      setColumns([]);
      setColumnTypeMap({});
      setLoading(false);
      return;
    }
    const cfg = sourceNode.config as Record<string, string>;

    // Check cached columns first (F-23: avoid re-fetching on every render)
    if (cfg.cachedColumns) {
      try {
        const cached = JSON.parse(cfg.cachedColumns) as Array<string | { columnName?: string; dataType?: string; columnType?: string; udtName?: string }>;
        if (Array.isArray(cached) && cached.length > 0) {
          if (typeof cached[0] === 'string') {
            setColumns((cached as string[]).filter(Boolean));
            return;
          }
          const rows = cached as Array<{ columnName?: string; dataType?: string; columnType?: string; udtName?: string }>;
          const cols = rows.map(row => row.columnName ?? '').filter(Boolean);
          const types = rows.reduce<Record<string, string>>((acc, row) => {
            const key = row.columnName ?? '';
            if (!key) return acc;
            acc[key] = String(row.dataType ?? row.columnType ?? row.udtName ?? '');
            return acc;
          }, {});
          setColumns(cols);
          setColumnTypeMap(types);
          return;
        }
      } catch { /* fall through to live fetch */ }
    }

    const connectionId = cfg.connectionId;
    const schema       = cfg.schema ?? '';
    const table        = cfg.table  ?? '';
    if (!connectionId || !table) {
      setColumns([]);
      setColumnTypeMap({});
      setLoading(false);
      return;
    }

    setLoading(true);
    api.introspectColumns(connectionId, schema, table)
      .then(res => {
        const data = (res.data?.data ?? []) as Array<{ columnName?: string; dataType?: string; columnType?: string; udtName?: string }>;
        const cols = data.map(c => c.columnName ?? '').filter(Boolean);
        const types = data.reduce<Record<string, string>>((acc, row) => {
          const key = row.columnName ?? '';
          if (!key) return acc;
          acc[key] = String(row.dataType ?? row.columnType ?? row.udtName ?? '');
          return acc;
        }, {});
        setColumns(cols);
        setColumnTypeMap(types);
      })
      .catch(() => {
        setColumns([]);
        setColumnTypeMap({});
      })
      .finally(() => setLoading(false));
  }, [nodeId, nodes, edges]);

  return { columns, columnTypeMap, loading };
}

// ─── Aggregate node config — F-03: column picker + aggregation function rows ──
const AGG_FUNCTIONS = ['SUM', 'COUNT', 'COUNT(DISTINCT)', 'AVG', 'MIN', 'MAX', 'FIRST', 'LAST', 'COLLECT_LIST', 'COLLECT_SET'];

interface AggRow { fn: string; col: string; alias: string; }

function AggregateConfig({ config, onChange, nodeId }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
  nodeId: string;
}) {
  const { columns, loading } = useUpstreamColumns(nodeId);

  const [groupCols, setGroupCols] = useState<string[]>(
    config.groupByColumns ? config.groupByColumns.split(',').filter(Boolean) : []
  );

  // Parse existing expression into rows: "SUM(amount) AS total" → [{fn:'SUM', col:'amount', alias:'total'}]
  const parseAggRows = (expr: string): AggRow[] => {
    if (!expr?.trim()) return [{ fn: 'SUM', col: '', alias: '' }];
    const re = /(COUNT\(DISTINCT|SUM|COUNT|AVG|MIN|MAX|FIRST|LAST|COLLECT_LIST|COLLECT_SET)\(([^)]+)\)\s+AS\s+(\w+)/gi;
    const rows: AggRow[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(expr)) !== null) rows.push({ fn: m[1].toUpperCase(), col: m[2].trim(), alias: m[3].trim() });
    return rows.length ? rows : [{ fn: 'SUM', col: '', alias: '' }];
  };

  const [aggRows, setAggRows] = useState<AggRow[]>(() => parseAggRows(config.expression ?? ''));

  const persistAgg = (rows: AggRow[]) => {
    const expr = rows
      .filter(r => r.col && r.alias)
      .map(r => `${r.fn === 'COUNT(DISTINCT)' ? 'COUNT(DISTINCT ' + r.col + ')' : r.fn + '(' + r.col + ')'} AS ${r.alias}`)
      .join(', ');
    onChange({ expression: expr });
  };

  const updateAggRow = (i: number, patch: Partial<AggRow>) => {
    const updated = aggRows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    setAggRows(updated); persistAgg(updated);
  };

  const removeAggRow = (i: number) => {
    const updated = aggRows.filter((_, idx) => idx !== i);
    const final = updated.length ? updated : [{ fn: 'SUM', col: '', alias: '' }];
    setAggRows(final); persistAgg(final);
  };

  const toggleGroupCol = (col: string) => {
    const updated = groupCols.includes(col) ? groupCols.filter(c => c !== col) : [...groupCols, col];
    setGroupCols(updated); onChange({ groupByColumns: updated.join(',') });
  };

  const ColPicker = ({ value, onSelect }: { value: string; onSelect: (v: string) => void }) => (
    <select value={value} onChange={e => onSelect(e.target.value)}
      className="flex-1 h-6 px-1.5 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono
                 focus:outline-none focus:border-blue-400">
      <option value="">{loading ? 'Loading…' : '— column —'}</option>
      {columns.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );

  return (
    <div>
      <SectionLabel>Group By Columns</SectionLabel>
      {loading && <p className="text-[12px] text-slate-400 italic mb-2 px-1">Loading schema…</p>}
      {columns.length > 0 ? (
        <ZebraList className="mb-2">
          {columns.map((col, i) => {
            const selected = groupCols.includes(col);
            return (
              <button
                key={col}
                type="button"
                onClick={() => toggleGroupCol(col)}
                className={`w-full text-left ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1 py-0.5 transition-colors hover:bg-[#162038]`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${selected ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-700/60 text-slate-400'}`}>
                    {selected ? 'Group' : 'Skip'}
                  </span>
                </div>
              </button>
            );
          })}
        </ZebraList>
      ) : (
        <div className="space-y-1 mb-2">
          <ZebraList>
            {groupCols.map((c, i) => (
              <ZebraRow key={i} index={i}>
                <span className="flex-1 text-[12px] text-slate-300 font-mono">{c}</span>
                <CompactIconButton
                  title="Remove group column"
                  tone="danger"
                  onClick={() => {
                    const u = groupCols.filter((_, idx) => idx !== i);
                    setGroupCols(u);
                    onChange({ groupByColumns: u.join(',') });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </CompactIconButton>
              </ZebraRow>
            ))}
          </ZebraList>
          <div className="flex gap-1.5">
            <TextInput value={groupCols.join(',')} onChange={v => { const u = v.split(',').map(s => s.trim()).filter(Boolean); setGroupCols(u); onChange({ groupByColumns: u.join(',') }); }}
              placeholder="col1, col2" className="flex-1" />
          </div>
        </div>
      )}

      <SectionLabel>Aggregations</SectionLabel>
      <ZebraList className="mb-2">
        {aggRows.map((row, i) => (
          <ZebraRow key={i} index={i}>
            <select value={row.fn} onChange={e => updateAggRow(i, { fn: e.target.value })}
              className="w-28 h-6 px-1.5 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono focus:outline-none focus:border-blue-400">
              {AGG_FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <ColPicker value={row.col} onSelect={v => updateAggRow(i, { col: v, alias: row.alias || v.toLowerCase() + '_agg' })} />
            <span className="text-slate-400 text-[12px] shrink-0">AS</span>
            <input value={row.alias} onChange={e => updateAggRow(i, { alias: e.target.value })}
              placeholder="alias"
              className="w-24 h-6 px-1.5 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono
                         placeholder-slate-500 focus:outline-none focus:border-blue-400" />
            <CompactIconButton title="Delete aggregation" tone="danger" onClick={() => removeAggRow(i)}>
              <Trash2 className="h-3 w-3" />
            </CompactIconButton>
          </ZebraRow>
        ))}
      </ZebraList>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] text-slate-300">Rows {aggRows.length}</span>
        <CompactIconButton
          title="Add aggregation"
          onClick={() => {
            const u = [...aggRows, { fn: 'SUM', col: '', alias: '' }];
            setAggRows(u);
          }}
        >
          <Plus className="h-3 w-3" />
        </CompactIconButton>
      </div>

      <SectionLabel>Options</SectionLabel>
      <Field label="HAVING clause (optional)">
        <TextInput value={config.havingClause ?? ''} onChange={v => onChange({ havingClause: v })} placeholder="SUM(amount) > 100" />
      </Field>
    </div>
  );
}

// ─── Case/When config ─────────────────────────────────────────────────────────
function CaseWhenConfig({ config, onChange, nodeId }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void; nodeId: string;
}) {
  const { columns } = useUpstreamColumns(nodeId);
  const cases: Array<{when: string; then: string}> = useMemo(() => {
    try { return config.cases ? JSON.parse(config.cases) : [{ when: '', then: '' }]; }
    catch { return [{ when: '', then: '' }]; }
  }, [config.cases]);

  const update = (i: number, field: 'when' | 'then', val: string) => {
    const u = cases.map((c, j) => j === i ? { ...c, [field]: val } : c);
    onChange({ cases: JSON.stringify(u) });
  };

  return (
    <div>
      <SectionLabel>CASE WHEN</SectionLabel>
      <Field label="Output Column Name" required>
        <TextInput value={config.outputColumn ?? 'result'} onChange={v => onChange({ outputColumn: v })} placeholder="result" />
      </Field>
      {columns.length > 0 && (
        <p className="text-[12px] text-slate-300 italic mb-2 px-1">Available columns: {columns.slice(0, 8).join(', ')}{columns.length > 8 ? '…' : ''}</p>
      )}
      <SectionLabel>Conditions</SectionLabel>
      <ZebraList className="mb-2">
        {cases.map((c, i) => (
          <ZebraRow key={i} index={i} className="items-start">
            <div className="w-full space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-blue-300 font-bold w-10 shrink-0">WHEN</span>
                <TextInput value={c.when} onChange={v => update(i, 'when', v)} placeholder="col > 100 OR status = 'A'" className="h-6 px-1.5 text-[12px]" />
                <CompactIconButton title="Delete WHEN clause" tone="danger" onClick={() => onChange({ cases: JSON.stringify(cases.filter((_,j)=>j!==i)) })}>
                  <Trash2 className="h-3 w-3" />
                </CompactIconButton>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-emerald-300 font-bold w-10 shrink-0">THEN</span>
                <TextInput value={c.then} onChange={v => update(i, 'then', v)} placeholder="'High'  or  col * 1.2  or  F.lit(1)" className="h-6 px-1.5 text-[12px]" />
              </div>
            </div>
          </ZebraRow>
        ))}
      </ZebraList>
      <div className="mb-3 mt-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] text-slate-300">Rows {cases.length}</span>
        <CompactIconButton title="Add WHEN clause" onClick={() => onChange({ cases: JSON.stringify([...cases, { when: '', then: '' }]) })}>
          <Plus className="h-3 w-3" />
        </CompactIconButton>
      </div>
      <Field label="OTHERWISE (default)">
        <TextInput value={config.otherwise ?? 'None'} onChange={v => onChange({ otherwise: v })} placeholder="None  or  'Unknown'  or  0" />
      </Field>
    </div>
  );
}

// ─── F-02: Column Mapping Panel for JDBC Target ───────────────────────────────
function ColumnMappingPanel({ config, onChange, nodeId }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
  nodeId: string;
}) {
  const { columns: srcCols, loading: srcLoading } = useUpstreamColumns(nodeId);
  const [tgtCols, setTgtCols] = useState<string[]>([]);
  const [loadingTgt, setLoadingTgt] = useState(false);

  // Parse stored mappings: [{src:'a', tgt:'b'}]
  const mappings: Array<{src: string; tgt: string}> = useMemo(() => {
    try { return config.columnMappings ? JSON.parse(config.columnMappings) : []; }
    catch { return []; }
  }, [config.columnMappings]);

  useEffect(() => {
    if (!config.connectionId || !config.schema || !config.table) { setTgtCols([]); return; }
    setLoadingTgt(true);
    api.introspectColumns(config.connectionId, config.schema, config.table)
      .then(r => setTgtCols((r.data?.data ?? []).map((c: {columnName: string}) => c.columnName).filter(Boolean)))
      .catch(() => setTgtCols([]))
      .finally(() => setLoadingTgt(false));
  }, [config.connectionId, config.schema, config.table]);

  const persist = (m: Array<{src: string; tgt: string}>) => onChange({ columnMappings: JSON.stringify(m) });

  const autoMap = () => {
    const auto = srcCols.map(s => ({ src: s, tgt: tgtCols.find(t => t.toLowerCase() === s.toLowerCase()) ?? s }));
    persist(auto);
  };

  const updateRow = (i: number, field: 'src' | 'tgt', val: string) => {
    const updated = mappings.map((m, idx) => idx === i ? { ...m, [field]: val } : m);
    persist(updated);
  };

  if (!config.connectionId || !config.table) return null;

  return (
    <>
      <SectionLabel>Column Mapping (optional)</SectionLabel>
      <p className="text-[12px] text-slate-300 italic mb-1.5 px-1">
        Leave empty to pass all upstream columns. Define mappings to control which columns write to which target columns.
      </p>
      {(srcCols.length > 0 || tgtCols.length > 0) && (
        <button onClick={autoMap} className="text-[12px] text-blue-400 hover:text-blue-300 mb-1.5 flex items-center gap-1 transition-colors">
          ⚡ Auto-map by name
        </button>
      )}
      <div className="mb-1.5 overflow-hidden rounded border border-slate-700">
        {mappings.map((m, i) => (
          <div key={i} className={`flex items-center gap-1 px-1.5 py-0.5 border-t border-slate-700 ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'}`}>
            <select value={m.src} onChange={e => updateRow(i, 'src', e.target.value)}
              className="flex-1 h-6 px-1.5 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono focus:outline-none focus:border-blue-400">
              <option value="">{srcLoading ? 'Loading…' : '— source col —'}</option>
              {srcCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-slate-300 text-[12px] shrink-0">→</span>
            <select value={m.tgt} onChange={e => updateRow(i, 'tgt', e.target.value)}
              className="flex-1 h-6 px-1.5 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono focus:outline-none focus:border-blue-400">
              <option value="">{loadingTgt ? 'Loading…' : '— target col —'}</option>
              {tgtCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => persist(mappings.filter((_, idx) => idx !== i))} className="flex h-5 w-5 items-center justify-center text-slate-400 hover:text-red-300 shrink-0">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => persist([...mappings, { src: '', tgt: '' }])}
        className="flex items-center justify-center h-6 w-6 rounded border border-blue-500/40 bg-blue-500/10 text-blue-400 hover:text-blue-300 transition-colors"
        title="Add mapping"
      >
        <Plus className="w-2.5 h-2.5" />
      </button>
    </>
  );
}

// ─── Select node config (column projection with aliases) ───────────────────────
function SelectColumnsConfig({ config, onChange, nodeId }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void; nodeId: string;
}) {
  const { columns, loading } = useUpstreamColumns(nodeId);
  const selected: string[] = useMemo(() => {
    try { return config.selectedColumns ? JSON.parse(config.selectedColumns) : []; }
    catch { return []; }
  }, [config.selectedColumns]);

  const toggle = (col: string) => {
    const normalizedCurrent = selected.length === 0 ? [...columns] : selected;
    const toggled = normalizedCurrent.includes(col)
      ? normalizedCurrent.filter(c => c !== col)
      : [...normalizedCurrent, col];
    const next = toggled.length === columns.length ? [] : toggled;
    onChange({ selectedColumns: JSON.stringify(next) });
  };

  return (
    <div>
      <SectionLabel>Columns to Project</SectionLabel>
      {loading && <p className="text-[12px] text-slate-400 italic mb-2 px-1">Loading schema…</p>}
      {columns.length > 0 ? (
        <>
          <ZebraList className="mb-1.5">
            {columns.map((col, i) => {
              const included = selected.length === 0 || selected.includes(col);
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => toggle(col)}
                  className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${included ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-700/60 text-slate-400'}`}>
                      {included ? 'Keep' : 'Skip'}
                    </span>
                  </div>
                </button>
              );
            })}
          </ZebraList>
          <p className="mb-3 px-1 text-[12px] text-slate-300">If every row is kept, the config stores an empty selection and projects all columns.</p>
        </>
      ) : (
        <Field label="Column names (comma-separated)">
          <TextInput value={config.columnsRaw ?? ''} onChange={v => onChange({ columnsRaw: v })} placeholder="col1, col2, col3" />
        </Field>
      )}
      <Field label="SQL Expressions (optional)">
        <textarea value={config.expressions ?? ''} onChange={e => onChange({ expressions: e.target.value })}
          placeholder={'col1 AS alias1\ncol2 * 1.1 AS col2_adjusted'}
          className="w-full px-2.5 py-2 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
          rows={4} />
      </Field>
    </div>
  );
}

// ─── Cast / Rename / Drop config ───────────────────────────────────────────────
function CastRenameDropConfig({ config, onChange, nodeId }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void; nodeId: string;
}) {
  const { columns, loading } = useUpstreamColumns(nodeId);
  const [tab, setTab] = useState<'cast' | 'rename' | 'drop'>(
    (config.activeTab as 'cast' | 'rename' | 'drop') ?? 'cast'
  );
  const DATA_TYPES = ['string', 'integer', 'long', 'double', 'float', 'decimal', 'boolean', 'date', 'timestamp'];

  const casts: Array<{col: string; type: string}> = useMemo(() => {
    try { return config.casts ? JSON.parse(config.casts) : []; } catch { return []; }
  }, [config.casts]);
  const renames: Array<{from: string; to: string}> = useMemo(() => {
    try { return config.renames ? JSON.parse(config.renames) : []; } catch { return []; }
  }, [config.renames]);
  const drops: string[] = useMemo(() => {
    try { return config.dropColumns ? JSON.parse(config.dropColumns) : []; } catch { return []; }
  }, [config.dropColumns]);

  const ColPicker = ({ value, onSelect }: { value: string; onSelect: (v: string) => void }) => (
    <select value={value} onChange={e => onSelect(e.target.value)}
      className="flex-1 h-8 px-2 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono focus:outline-none focus:border-blue-400">
      <option value="">{loading ? 'Loading…' : '— column —'}</option>
      {columns.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );

  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        {(['cast', 'rename', 'drop'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); onChange({ activeTab: t }); }}
            className={`flex-1 h-7 rounded text-[12px] font-semibold border transition-colors ${
              tab === t ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#1e2035] text-slate-300 border-slate-600 hover:text-white'
            }`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'cast' && (
        <>
          <SectionLabel>Type Casts</SectionLabel>
          <ZebraList className="mb-2">
            {casts.map((c, i) => (
              <ZebraRow key={i} index={i}>
                <ColPicker value={c.col} onSelect={v => { const u = casts.map((x, j) => j===i ? {...x, col: v} : x); onChange({ casts: JSON.stringify(u) }); }} />
                <span className="text-slate-300 text-[12px] shrink-0">→</span>
                <select value={c.type} onChange={e => { const u = casts.map((x, j) => j===i ? {...x, type: e.target.value} : x); onChange({ casts: JSON.stringify(u) }); }}
                  className="w-28 h-6 px-1.5 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono focus:outline-none focus:border-blue-400">
                  {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <CompactIconButton title="Delete cast" tone="danger" onClick={() => onChange({ casts: JSON.stringify(casts.filter((_,j) => j !== i)) })}>
                  <Trash2 className="h-3 w-3" />
                </CompactIconButton>
              </ZebraRow>
            ))}
          </ZebraList>
          <div className="mt-1.5 flex items-center justify-between px-1">
            <span className="text-[12px] text-slate-300">Rows {casts.length}</span>
            <CompactIconButton title="Add cast" onClick={() => onChange({ casts: JSON.stringify([...casts, { col: '', type: 'string' }]) })}>
              <Plus className="h-3 w-3" />
            </CompactIconButton>
          </div>
        </>
      )}
      {tab === 'rename' && (
        <>
          <SectionLabel>Rename Columns</SectionLabel>
          <ZebraList className="mb-2">
            {renames.map((r, i) => (
              <ZebraRow key={i} index={i}>
                <ColPicker value={r.from} onSelect={v => { const u = renames.map((x,j) => j===i ? {...x, from: v} : x); onChange({ renames: JSON.stringify(u) }); }} />
                <span className="text-slate-300 text-[12px] shrink-0">→</span>
                <TextInput value={r.to} onChange={v => { const u = renames.map((x,j) => j===i ? {...x, to: v} : x); onChange({ renames: JSON.stringify(u) }); }} placeholder="new_name" className="h-6 px-1.5 text-[12px]" />
                <CompactIconButton title="Delete rename" tone="danger" onClick={() => onChange({ renames: JSON.stringify(renames.filter((_,j) => j !== i)) })}>
                  <Trash2 className="h-3 w-3" />
                </CompactIconButton>
              </ZebraRow>
            ))}
          </ZebraList>
          <div className="mt-1.5 flex items-center justify-between px-1">
            <span className="text-[12px] text-slate-300">Rows {renames.length}</span>
            <CompactIconButton title="Add rename" onClick={() => onChange({ renames: JSON.stringify([...renames, { from: '', to: '' }]) })}>
              <Plus className="h-3 w-3" />
            </CompactIconButton>
          </div>
        </>
      )}
      {tab === 'drop' && (
        <>
          <SectionLabel>Drop Columns</SectionLabel>
          {columns.length > 0 ? (
            <ZebraList className="mb-2">
              {columns.map((col, i) => {
                const dropped = drops.includes(col);
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      const next = dropped ? drops.filter(c => c !== col) : [...drops, col];
                      onChange({ dropColumns: JSON.stringify(next) });
                    }}
                    className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${dropped ? 'bg-red-500/15 text-red-300' : 'bg-slate-700/60 text-slate-400'}`}>
                        {dropped ? 'Drop' : 'Keep'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </ZebraList>
          ) : (
            <Field label="Columns to drop (comma-separated)">
              <TextInput value={config.dropColumnsRaw ?? ''} onChange={v => onChange({ dropColumnsRaw: v })} placeholder="col1, col2" />
            </Field>
          )}
        </>
      )}
    </div>
  );
}

// ─── Derive node config ────────────────────────────────────────────────────────
function DeriveConfig({ config, onChange }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void;
}) {
  const derivations: Array<{name: string; expression: string}> = useMemo(() => {
    try { return config.derivations ? JSON.parse(config.derivations) : [{ name: '', expression: '' }]; }
    catch { return [{ name: '', expression: '' }]; }
  }, [config.derivations]);

  const update = (i: number, field: 'name' | 'expression', val: string) => {
    const u = derivations.map((d, j) => j === i ? { ...d, [field]: val } : d);
    onChange({ derivations: JSON.stringify(u) });
  };

  return (
    <div>
      <SectionLabel>Derived Columns</SectionLabel>
      <ZebraList className="mb-2">
        {derivations.map((d, i) => (
          <ZebraRow key={i} index={i} className="items-start">
            <div className="w-full space-y-1">
              <div className="flex gap-1.5 items-center">
                <TextInput value={d.name} onChange={v => update(i, 'name', v)} placeholder="new_column_name" className="h-6 px-1.5 text-[12px]" />
                <CompactIconButton title="Delete derived column" tone="danger" onClick={() => onChange({ derivations: JSON.stringify(derivations.filter((_, j) => j !== i)) })}>
                  <Trash2 className="h-3 w-3" />
                </CompactIconButton>
              </div>
              <textarea value={d.expression} onChange={e => update(i, 'expression', e.target.value)}
                placeholder="col1 * col2  or  CASE WHEN status = 'A' THEN 1 ELSE 0 END"
                className="w-full rounded border border-slate-500 bg-[#13152a] px-1.5 py-1 text-[12px] font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                rows={2} />
            </div>
          </ZebraRow>
        ))}
      </ZebraList>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] text-slate-300">Rows {derivations.length}</span>
        <CompactIconButton title="Add derived column" onClick={() => onChange({ derivations: JSON.stringify([...derivations, { name: '', expression: '' }]) })}>
          <Plus className="h-3 w-3" />
        </CompactIconButton>
      </div>
    </div>
  );
}

// ─── Window function config ────────────────────────────────────────────────────
const WINDOW_FNS = ['ROW_NUMBER', 'RANK', 'DENSE_RANK', 'PERCENT_RANK', 'NTILE', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX'];

function WindowFnConfig({ config, onChange, nodeId }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void; nodeId: string;
}) {
  const { columns, loading } = useUpstreamColumns(nodeId);

  return (
    <div>
      <SectionLabel>Window Function</SectionLabel>
      <Field label="Function" required>
        <Select value={config.windowFn ?? 'ROW_NUMBER'} onChange={v => onChange({ windowFn: v })}>
          {WINDOW_FNS.map(f => <option key={f} value={f}>{f}</option>)}
        </Select>
      </Field>
      <Field label="Output Column" required>
        <TextInput value={config.outputColumn ?? ''} onChange={v => onChange({ outputColumn: v })} placeholder="row_num" />
      </Field>
      {loading && <p className="text-[12px] text-slate-400 italic mb-2 px-1">Loading schema…</p>}
      <Field label="Partition By (columns)">
        <TextInput value={config.partitionBy ?? ''} onChange={v => onChange({ partitionBy: v })}
          placeholder="dept_id, region" />
        {columns.length > 0 && (
          <ZebraList className="mt-1">
            {columns.map((c, i) => {
              const selected = (config.partitionBy ?? '').split(',').map(s=>s.trim()).includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    const curr = config.partitionBy ? config.partitionBy.split(',').map(s=>s.trim()).filter(Boolean) : [];
                    const next = curr.includes(c) ? curr.filter(x => x !== c) : [...curr, c];
                    onChange({ partitionBy: next.join(', ') });
                  }}
                  className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] text-slate-100">{c}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${selected ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-700/60 text-slate-400'}`}>
                      {selected ? 'Use' : 'Skip'}
                    </span>
                  </div>
                </button>
              );
            })}
          </ZebraList>
        )}
      </Field>
      <Field label="Order By" required>
        <TextInput value={config.orderBy ?? ''} onChange={v => onChange({ orderBy: v })} placeholder="created_at DESC, id ASC" />
      </Field>
      <SectionLabel>Frame (optional)</SectionLabel>
      <Field label="Frame Type">
        <Select value={config.frameType ?? 'NONE'} onChange={v => onChange({ frameType: v })}>
          <option value="NONE">No frame (default)</option>
          <option value="ROWS">ROWS BETWEEN</option>
          <option value="RANGE">RANGE BETWEEN</option>
        </Select>
      </Field>
      {config.frameType !== 'NONE' && config.frameType && (
        <div className="flex gap-2">
          <Field label="From">
            <TextInput value={config.frameFrom ?? 'UNBOUNDED PRECEDING'} onChange={v => onChange({ frameFrom: v })} placeholder="UNBOUNDED PRECEDING" />
          </Field>
          <Field label="To">
            <TextInput value={config.frameTo ?? 'CURRENT ROW'} onChange={v => onChange({ frameTo: v })} placeholder="CURRENT ROW" />
          </Field>
        </div>
      )}
    </div>
  );
}

// ─── Pivot config ──────────────────────────────────────────────────────────────
function PivotConfig({ config, onChange, nodeId }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void; nodeId: string;
}) {
  const { columns, loading } = useUpstreamColumns(nodeId);
  const AGG_FNS = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'FIRST', 'LAST'];

  return (
    <div>
      <SectionLabel>Pivot Setup</SectionLabel>
      {loading && <p className="text-[12px] text-slate-400 italic mb-1 px-1">Loading schema…</p>}
      <Field label="Group By Columns" required>
        <TextInput value={config.groupByColumns ?? ''} onChange={v => onChange({ groupByColumns: v })} placeholder="product_id, region" />
      </Field>
      <Field label="Pivot Column" required>
        <Select value={config.pivotColumn ?? ''} onChange={v => onChange({ pivotColumn: v })}>
          <option value="">— select column —</option>
          {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Pivot Values (optional)">
        <TextInput value={config.pivotValues ?? ''} onChange={v => onChange({ pivotValues: v })} placeholder="'Q1','Q2','Q3','Q4'" />
        <p className="text-[12px] text-slate-300 mt-1">Leave blank to auto-discover. Specify for large datasets.</p>
      </Field>
      <SectionLabel>Aggregation</SectionLabel>
      <Field label="Function" required>
        <Select value={config.aggFunction ?? 'SUM'} onChange={v => onChange({ aggFunction: v })}>
          {AGG_FNS.map(f => <option key={f} value={f}>{f}</option>)}
        </Select>
      </Field>
      <Field label="Value Column" required>
        <Select value={config.aggColumn ?? ''} onChange={v => onChange({ aggColumn: v })}>
          <option value="">— select column —</option>
          {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
    </div>
  );
}

// ─── Data Quality config ───────────────────────────────────────────────────────
function DataQualityConfig({ config, onChange, nodeId }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void; nodeId: string;
}) {
  const { columns } = useUpstreamColumns(nodeId);
  const rules: Array<{name: string; col: string; type: string; expression: string}> = useMemo(() => {
    try { return config.dqRules ? JSON.parse(config.dqRules) : []; } catch { return []; }
  }, [config.dqRules]);

  const DQ_TYPES = ['not_null', 'unique', 'range', 'regex', 'custom'];

  const update = (i: number, field: string, val: string) => {
    const u = rules.map((r, j) => j === i ? { ...r, [field]: val } : r);
    onChange({ dqRules: JSON.stringify(u) });
  };

  return (
    <div>
      <SectionLabel>Quality Rules</SectionLabel>
      <ZebraList className="mb-2">
        {rules.map((r, i) => (
          <ZebraRow key={i} index={i} className="items-start">
            <div className="w-full space-y-1">
              <div className="flex gap-1.5">
                <TextInput value={r.name} onChange={v => update(i, 'name', v)} placeholder="rule_name" className="h-6 px-1.5 text-[12px]" />
                <CompactIconButton title="Delete quality rule" tone="danger" onClick={() => onChange({ dqRules: JSON.stringify(rules.filter((_,j)=>j!==i)) })}>
                  <Trash2 className="h-3 w-3" />
                </CompactIconButton>
              </div>
              <div className="flex gap-1.5">
                <select value={r.type} onChange={e => update(i, 'type', e.target.value)}
                  className="w-28 h-6 px-1.5 rounded bg-[#13152a] border border-slate-500 text-slate-100 text-[12px] font-mono focus:outline-none focus:border-blue-400">
                  {DQ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={r.col} onChange={e => update(i, 'col', e.target.value)}
                  className="flex-1 h-6 px-1.5 rounded bg-[#13152a] border border-slate-500 text-slate-100 text-[12px] font-mono focus:outline-none focus:border-blue-400">
                  <option value="">— column —</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <TextInput value={r.expression} onChange={v => update(i, 'expression', v)} placeholder="expression / params" className="h-6 px-1.5 text-[12px]" />
            </div>
          </ZebraRow>
        ))}
      </ZebraList>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] text-slate-300">Rows {rules.length}</span>
        <CompactIconButton title="Add quality rule" onClick={() => onChange({ dqRules: JSON.stringify([...rules, { name: '', col: '', type: 'not_null', expression: '' }]) })}>
          <Plus className="h-3 w-3" />
        </CompactIconButton>
      </div>
      <SectionLabel>Failure Handling</SectionLabel>
      <Field label="On Failure">
        <Select value={config.failureAction ?? 'fail'} onChange={v => onChange({ failureAction: v })}>
          <option value="fail">Fail pipeline</option>
          <option value="warn">Warn and continue</option>
          <option value="drop">Drop bad rows</option>
          <option value="quarantine">Quarantine bad rows</option>
        </Select>
      </Field>
      {config.failureAction === 'quarantine' && (
        <Field label="Quarantine Path">
          <TextInput value={config.quarantinePath ?? ''} onChange={v => onChange({ quarantinePath: v })} placeholder="s3://bucket/quarantine/" />
        </Field>
      )}
    </div>
  );
}

// ─── Mask config ───────────────────────────────────────────────────────────────
function MaskConfig({ config, onChange, nodeId }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void; nodeId: string;
}) {
  const { columns } = useUpstreamColumns(nodeId);
  const rules: Array<{col: string; strategy: string}> = useMemo(() => {
    try { return config.maskRules ? JSON.parse(config.maskRules) : []; } catch { return []; }
  }, [config.maskRules]);
  const STRATEGIES = ['hash', 'truncate', 'replace', 'regex_replace', 'null'];

  const update = (i: number, field: string, val: string) => {
    const u = rules.map((r, j) => j === i ? { ...r, [field]: val } : r);
    onChange({ maskRules: JSON.stringify(u) });
  };

  return (
    <div>
      <SectionLabel>Masking Rules</SectionLabel>
      <ZebraList className="mb-2">
        {rules.map((r, i) => (
          <ZebraRow key={i} index={i}>
            <select value={r.col} onChange={e => update(i, 'col', e.target.value)}
              className="flex-1 h-6 px-1.5 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono focus:outline-none focus:border-blue-400">
              <option value="">— column —</option>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={r.strategy} onChange={e => update(i, 'strategy', e.target.value)}
              className="w-28 h-6 px-1.5 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-mono focus:outline-none focus:border-blue-400">
              {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <CompactIconButton title="Delete masking rule" tone="danger" onClick={() => onChange({ maskRules: JSON.stringify(rules.filter((_,j)=>j!==i)) })}>
              <Trash2 className="h-3 w-3" />
            </CompactIconButton>
          </ZebraRow>
        ))}
      </ZebraList>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] text-slate-300">Rows {rules.length}</span>
        <CompactIconButton title="Add masking rule" onClick={() => onChange({ maskRules: JSON.stringify([...rules, { col: '', strategy: 'hash' }]) })}>
          <Plus className="h-3 w-3" />
        </CompactIconButton>
      </div>
    </div>
  );
}

// ─── Lookup config ─────────────────────────────────────────────────────────────
function LookupConfig({ config, onChange }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void;
}) {
  const connectorsByTech = useAppSelector(s => s.connections.connectorsByTech);
  const allConnectors = selectAllConnectors(connectorsByTech);
  return (
    <div>
      <SectionLabel>Lookup Dataset</SectionLabel>
      <Field label="Connection" required>
        <Select value={config.lookupConnectionId ?? ''} onChange={v => onChange({ lookupConnectionId: v })}>
          <option value="">— select connection —</option>
          {allConnectors.map(c => <option key={c.connectorId} value={c.connectorId}>{c.connectorDisplayName}</option>)}
        </Select>
      </Field>
      <Field label="Schema">
        <TextInput value={config.lookupSchema ?? ''} onChange={v => onChange({ lookupSchema: v })} placeholder="schema_name" />
      </Field>
      <Field label="Table / View" required>
        <TextInput value={config.lookupTable ?? ''} onChange={v => onChange({ lookupTable: v })} placeholder="table_name" />
      </Field>
      <SectionLabel>Key Mapping</SectionLabel>
      <Field label="Source Key Column" required>
        <TextInput value={config.sourceKey ?? ''} onChange={v => onChange({ sourceKey: v })} placeholder="customer_id" />
      </Field>
      <Field label="Lookup Key Column" required>
        <TextInput value={config.lookupKey ?? ''} onChange={v => onChange({ lookupKey: v })} placeholder="id" />
      </Field>
      <SectionLabel>Return Columns</SectionLabel>
      <Field label="Columns to bring back (comma-sep)">
        <TextInput value={config.returnColumns ?? ''} onChange={v => onChange({ returnColumns: v })} placeholder="name, email, status" />
      </Field>
      <Field label="Cache Lookup Dataset">
        <Select value={config.cacheLookup ?? 'true'} onChange={v => onChange({ cacheLookup: v })}>
          <option value="true">Yes — broadcast join (small tables)</option>
          <option value="false">No — standard join</option>
        </Select>
      </Field>
    </div>
  );
}

// ─── SCD Type 1 config ─────────────────────────────────────────────────────────
function Scd1Config({ config, onChange, nodeId }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void; nodeId: string;
}) {
  const { columns } = useUpstreamColumns(nodeId);
  const mergeKeys: string[] = useMemo(() => {
    try { return config.mergeKeys ? JSON.parse(config.mergeKeys) : []; } catch { return []; }
  }, [config.mergeKeys]);
  const updateCols: string[] = useMemo(() => {
    try { return config.updateColumns ? JSON.parse(config.updateColumns) : []; } catch { return []; }
  }, [config.updateColumns]);

  const toggleMerge = (col: string) => {
    const next = mergeKeys.includes(col) ? mergeKeys.filter(c=>c!==col) : [...mergeKeys, col];
    onChange({ mergeKeys: JSON.stringify(next) });
  };
  const toggleUpdate = (col: string) => {
    const next = updateCols.includes(col) ? updateCols.filter(c=>c!==col) : [...updateCols, col];
    onChange({ updateColumns: JSON.stringify(next) });
  };

  return (
    <div>
      <SectionLabel>SCD Type 1 — Overwrite in Place</SectionLabel>
      <Field label="Business / Merge Keys (click to select)" required>
        {columns.length > 0 ? (
          <ZebraList>
            {columns.map((col, i) => {
              const selected = mergeKeys.includes(col);
              return (
                <button key={col} type="button" onClick={() => toggleMerge(col)} className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${selected ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-700/60 text-slate-400'}`}>{selected ? 'Key' : 'Skip'}</span>
                  </div>
                </button>
              );
            })}
          </ZebraList>
        ) : (
          <TextInput value={config.mergeKeysRaw ?? ''} onChange={v => onChange({ mergeKeysRaw: v })} placeholder="id, tenant_id" />
        )}
      </Field>
      <Field label="Columns to Update (click to select)" required>
        {columns.length > 0 ? (
          <ZebraList>
            {columns.filter(c => !mergeKeys.includes(c)).map((col, i) => {
              const selected = updateCols.includes(col);
              return (
                <button key={col} type="button" onClick={() => toggleUpdate(col)} className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${selected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/60 text-slate-400'}`}>{selected ? 'Update' : 'Skip'}</span>
                  </div>
                </button>
              );
            })}
          </ZebraList>
        ) : (
          <TextInput value={config.updateColumnsRaw ?? ''} onChange={v => onChange({ updateColumnsRaw: v })} placeholder="name, email, status" />
        )}
      </Field>
    </div>
  );
}

// ─── SCD Type 2 config ─────────────────────────────────────────────────────────
function Scd2Config({ config, onChange, nodeId }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void; nodeId: string;
}) {
  const { columns } = useUpstreamColumns(nodeId);
  const businessKeys: string[] = useMemo(() => {
    try { return config.businessKeys ? JSON.parse(config.businessKeys) : []; } catch { return []; }
  }, [config.businessKeys]);
  const trackingCols: string[] = useMemo(() => {
    try { return config.trackingColumns ? JSON.parse(config.trackingColumns) : []; } catch { return []; }
  }, [config.trackingColumns]);

  return (
    <div>
      <SectionLabel>SCD Type 2 — Version History</SectionLabel>
      <Field label="Business Keys (click to select)" required>
        {columns.length > 0 ? (
          <ZebraList>
            {columns.map((col, i) => {
              const selected = businessKeys.includes(col);
              return (
                <button key={col} type="button" onClick={() => {
                  const next = businessKeys.includes(col) ? businessKeys.filter(c=>c!==col) : [...businessKeys, col];
                  onChange({ businessKeys: JSON.stringify(next) });
                }} className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${selected ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-700/60 text-slate-400'}`}>{selected ? 'Key' : 'Skip'}</span>
                  </div>
                </button>
              );
            })}
          </ZebraList>
        ) : (
          <TextInput value={config.businessKeysRaw ?? ''} onChange={v => onChange({ businessKeysRaw: v })} placeholder="customer_id" />
        )}
      </Field>
      <Field label="Tracked Columns (changes trigger new version)" required>
        {columns.length > 0 ? (
          <ZebraList>
            {columns.filter(c => !businessKeys.includes(c)).map((col, i) => {
              const selected = trackingCols.includes(col);
              return (
                <button key={col} type="button" onClick={() => {
                  const next = trackingCols.includes(col) ? trackingCols.filter(c=>c!==col) : [...trackingCols, col];
                  onChange({ trackingColumns: JSON.stringify(next) });
                }} className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${selected ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-700/60 text-slate-400'}`}>{selected ? 'Track' : 'Skip'}</span>
                  </div>
                </button>
              );
            })}
          </ZebraList>
        ) : (
          <TextInput value={config.trackingColumnsRaw ?? ''} onChange={v => onChange({ trackingColumnsRaw: v })} placeholder="name, email, address" />
        )}
      </Field>
      <SectionLabel>History Columns</SectionLabel>
      <Field label="Effective Date Column" required>
        <TextInput value={config.effectiveDateColumn ?? 'eff_start_date'} onChange={v => onChange({ effectiveDateColumn: v })} />
      </Field>
      <Field label="End Date Column" required>
        <TextInput value={config.endDateColumn ?? 'eff_end_date'} onChange={v => onChange({ endDateColumn: v })} />
      </Field>
      <Field label="Current Flag Column" required>
        <TextInput value={config.currentFlagColumn ?? 'is_current'} onChange={v => onChange({ currentFlagColumn: v })} />
      </Field>
      <Field label="Surrogate Key Column (optional)">
        <TextInput value={config.surrogateKeyColumn ?? ''} onChange={v => onChange({ surrogateKeyColumn: v })} placeholder="sk_customer" />
      </Field>
    </div>
  );
}

// ─── Surrogate Key config ──────────────────────────────────────────────────────
function SurrogateKeyConfig({ config, onChange }: {
  config: Record<string, string>; onChange: (p: Record<string, string>) => void;
}) {
  return (
    <div>
      <SectionLabel>Surrogate Key Generation</SectionLabel>
      <Field label="Output Column Name" required>
        <TextInput value={config.outputColumn ?? 'sk_id'} onChange={v => onChange({ outputColumn: v })} placeholder="sk_id" />
      </Field>
      <Field label="Strategy" required>
        <Select value={config.strategy ?? 'monotonically_increasing'} onChange={v => onChange({ strategy: v })}>
          <option value="monotonically_increasing">Monotonically Increasing ID (fast, Spark native)</option>
          <option value="uuid">UUID v4 (globally unique, string)</option>
          <option value="row_number">Row Number (deterministic, requires sort)</option>
        </Select>
      </Field>
      {config.strategy === 'row_number' && (<>
        <Field label="Partition By (optional)">
          <TextInput value={config.partitionBy ?? ''} onChange={v => onChange({ partitionBy: v })} placeholder="dept_id" />
        </Field>
        <Field label="Order By" required>
          <TextInput value={config.orderBy ?? ''} onChange={v => onChange({ orderBy: v })} placeholder="created_at ASC" />
        </Field>
      </>)}
    </div>
  );
}

// ─── Dedup config ─────────────────────────────────────────────────────────────
function DedupConfig({ config, onChange, nodeId }: { config: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; nodeId: string }) {
  const { columns } = useUpstreamColumns(nodeId);
  const selected: string[] = Array.isArray(config.columns) ? (config.columns as string[]) : [];
  const toggle = (col: string) => {
    const next = selected.includes(col) ? selected.filter(c => c !== col) : [...selected, col];
    onChange({ columns: next });
  };
  return (
    <div>
      <SectionLabel>Deduplicate</SectionLabel>
      <p className="text-[12px] text-slate-400 mb-2 px-1">
        Leave all unchecked to drop fully duplicate rows. Select columns to deduplicate on specific subset.
      </p>
      {columns.length === 0 ? (
        <p className="text-[12px] text-slate-300 italic px-1">Connect a source node to see columns.</p>
      ) : (
        <ZebraList>
          {columns.map((col, i) => {
            const active = selected.includes(col);
            return (
              <button key={col} type="button" onClick={() => toggle(col)} className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${active ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-700/60 text-slate-400'}`}>{active ? 'Match' : 'Skip'}</span>
                </div>
              </button>
            );
          })}
        </ZebraList>
      )}
    </div>
  );
}

// ─── Sort config ──────────────────────────────────────────────────────────────
function SortConfig({ config, onChange, nodeId }: { config: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; nodeId: string }) {
  const { columns } = useUpstreamColumns(nodeId);
  type SortEntry = { column: string; direction: 'asc' | 'desc'; nullsFirst: boolean };
  const orderBy: SortEntry[] = Array.isArray(config.orderBy) ? (config.orderBy as SortEntry[]) : [];

  const addEntry = () => onChange({ orderBy: [...orderBy, { column: columns[0] ?? '', direction: 'asc', nullsFirst: false }] });
  const updateEntry = (i: number, patch: Partial<SortEntry>) => {
    const updated = orderBy.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    onChange({ orderBy: updated });
  };
  const removeEntry = (i: number) => onChange({ orderBy: orderBy.filter((_, idx) => idx !== i) });

  return (
    <div>
      <SectionLabel>Sort / Order By</SectionLabel>
      <ZebraList className="mb-2">
        {orderBy.map((e, i) => (
          <ZebraRow key={i} index={i}>
            <InlineSelect value={e.column} onChange={v => updateEntry(i, { column: v })}>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </InlineSelect>
            <InlineSelect value={e.direction} onChange={v => updateEntry(i, { direction: v as 'asc' | 'desc' })} className="!flex-none w-14">
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </InlineSelect>
            <label className="flex items-center gap-1 text-[12px] text-slate-400 shrink-0 uppercase tracking-[0.12em]">
              <input type="checkbox" checked={e.nullsFirst} onChange={ev => updateEntry(i, { nullsFirst: ev.target.checked })} />
              Nulls First
            </label>
            <CompactIconButton title="Delete sort column" tone="danger" onClick={() => removeEntry(i)}>
              <Trash2 className="h-3 w-3" />
            </CompactIconButton>
          </ZebraRow>
        ))}
      </ZebraList>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <span className="text-[12px] text-slate-300">Rows {orderBy.length}</span>
        <CompactIconButton title="Add sort column" onClick={addEntry}>
          <Plus className="h-3 w-3" />
        </CompactIconButton>
      </div>
    </div>
  );
}

// ─── Limit config ─────────────────────────────────────────────────────────────
function LimitConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div>
      <SectionLabel>Limit Rows</SectionLabel>
      <Field label="Row Limit" required>
        <TextInput value={String(config.n ?? '')} onChange={v => onChange({ n: Number(v) || 0 })} placeholder="1000" />
      </Field>
      <p className="text-[12px] text-amber-400 px-1">⚠ Avoid using Limit in production pipelines.</p>
    </div>
  );
}

// ─── Sample config ────────────────────────────────────────────────────────────
function SampleConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div>
      <SectionLabel>Sample</SectionLabel>
      <Field label="Fraction (0–1)" required>
        <TextInput value={String(config.fraction ?? '')} onChange={v => onChange({ fraction: parseFloat(v) || 0.1 })} placeholder="0.1" />
      </Field>
      <Field label="Seed (optional)">
        <TextInput value={String(config.seed ?? '')} onChange={v => onChange({ seed: v ? parseInt(v) : undefined })} placeholder="42" />
      </Field>
      <Field label="With Replacement">
        <select value={String(config.withReplacement ?? 'false')} onChange={e => onChange({ withReplacement: e.target.value === 'true' })}
          className="w-full h-9 pl-3 pr-8 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px]">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </Field>
    </div>
  );
}

// ─── Cache config ─────────────────────────────────────────────────────────────
const STORAGE_LEVELS = ['MEMORY_AND_DISK', 'MEMORY_ONLY', 'DISK_ONLY', 'OFF_HEAP', 'MEMORY_AND_DISK_SER'];
function CacheConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div>
      <SectionLabel>Cache</SectionLabel>
      <Field label="Storage Level">
        <select value={String(config.storageLevel ?? '')} onChange={e => onChange({ storageLevel: e.target.value || undefined })}
          className="w-full h-9 pl-3 pr-8 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px]">
          <option value="">Default (MEMORY_AND_DISK)</option>
          {STORAGE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>
      <Field label="Eager Materialization">
        <select value={String(config.eager ?? 'false')} onChange={e => onChange({ eager: e.target.value === 'true' })}
          className="w-full h-9 pl-3 pr-8 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px]">
          <option value="false">No (lazy)</option>
          <option value="true">Yes — trigger .count() immediately</option>
        </select>
      </Field>
    </div>
  );
}

// ─── Repartition config ───────────────────────────────────────────────────────
function RepartitionConfig({ config, onChange, nodeId }: { config: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; nodeId: string }) {
  const { columns } = useUpstreamColumns(nodeId);
  const selected: string[] = Array.isArray(config.columns) ? (config.columns as string[]) : [];
  const toggle = (col: string) => {
    const next = selected.includes(col) ? selected.filter(c => c !== col) : [...selected, col];
    onChange({ columns: next });
  };
  return (
    <div>
      <SectionLabel>Repartition</SectionLabel>
      <Field label="Number of Partitions">
        <TextInput value={String(config.numPartitions ?? '')} onChange={v => onChange({ numPartitions: v ? parseInt(v) : undefined })} placeholder="200" />
      </Field>
      <Field label="Strategy">
        <select value={String(config.strategy ?? 'hash')} onChange={e => onChange({ strategy: e.target.value })}
          className="w-full h-9 pl-3 pr-8 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px]">
          <option value="hash">Hash (default)</option>
          <option value="range">Range</option>
        </select>
      </Field>
      <Field label="Partition Columns (optional)">
        <ZebraList>
          {columns.map((col, i) => {
            const active = selected.includes(col);
            return (
              <button key={col} type="button" onClick={() => toggle(col)} className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${active ? 'bg-teal-500/15 text-teal-300' : 'bg-slate-700/60 text-slate-400'}`}>{active ? 'Use' : 'Skip'}</span>
                </div>
              </button>
            );
          })}
        </ZebraList>
      </Field>
    </div>
  );
}

// ─── FillNA config ────────────────────────────────────────────────────────────
function FillNAConfig({ config, onChange, nodeId }: { config: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; nodeId: string }) {
  const { columns } = useUpstreamColumns(nodeId);
  const [mode, setMode] = useState<'global' | 'per_column'>((config.columnValues ? 'per_column' : 'global'));
  const columnValues: Record<string, string> = (config.columnValues as Record<string, string>) ?? {};

  return (
    <div>
      <SectionLabel>Fill NA / Replace Nulls</SectionLabel>
      <Field label="Mode">
        <select value={mode} onChange={e => { setMode(e.target.value as 'global' | 'per_column'); onChange({ columnValues: undefined, value: undefined }); }}
          className="w-full h-9 pl-3 pr-8 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px]">
          <option value="global">Global — same value for all columns</option>
          <option value="per_column">Per Column — different value per column</option>
        </select>
      </Field>
      {mode === 'global' ? (
        <Field label="Fill Value" required>
          <TextInput value={String(config.value ?? '')} onChange={v => onChange({ value: v, columnValues: undefined })} placeholder="0 or N/A" />
        </Field>
      ) : (
        <>
          <ZebraList>
            {columns.map((col, i) => (
              <ZebraRow key={col} index={i}>
                <span className="w-28 truncate text-[12px] text-slate-300 font-mono shrink-0">{col}</span>
                <TextInput value={columnValues[col] ?? ''} onChange={v => onChange({ columnValues: { ...columnValues, [col]: v }, value: undefined })} placeholder="fill value" className="h-6 px-1.5 text-[12px]" />
              </ZebraRow>
            ))}
          </ZebraList>
          {columns.length === 0 && <p className="text-[12px] text-slate-300 italic">Connect a source to see columns.</p>}
        </>
      )}
    </div>
  );
}

// ─── DropNA config ────────────────────────────────────────────────────────────
function DropNAConfig({ config, onChange, nodeId }: { config: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; nodeId: string }) {
  const { columns } = useUpstreamColumns(nodeId);
  const selected: string[] = Array.isArray(config.columns) ? (config.columns as string[]) : [];
  const toggle = (col: string) => {
    const next = selected.includes(col) ? selected.filter(c => c !== col) : [...selected, col];
    onChange({ columns: next });
  };
  return (
    <div>
      <SectionLabel>Drop NA Rows</SectionLabel>
      <Field label="How">
        <select value={String(config.how ?? 'any')} onChange={e => onChange({ how: e.target.value })}
          className="w-full h-9 pl-3 pr-8 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px]">
          <option value="any">any — drop if ANY selected column is null</option>
          <option value="all">all — drop only if ALL selected columns are null</option>
        </select>
      </Field>
      <Field label="Columns (leave empty to check all)">
        <ZebraList>
          {columns.map((col, i) => {
            const active = selected.includes(col);
            return (
              <button key={col} type="button" onClick={() => toggle(col)} className={`w-full text-left ${i > 0 ? 'border-t border-slate-700' : ''} ${i % 2 === 0 ? 'bg-[#12182b]' : 'bg-[#101629]'} px-1.5 py-1 transition-colors hover:bg-[#162038]`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12px] text-slate-100">{col}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] ${active ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-700/60 text-slate-400'}`}>{active ? 'Check' : 'Skip'}</span>
                </div>
              </button>
            );
          })}
        </ZebraList>
      </Field>
    </div>
  );
}


// ─── Main panel ────────────────────────────────────────────────────────────────
interface Props {
  nodeId: string | null;
  onClose: () => void;
  openSignal?: number;
}

export function NodeConfigPanel({ nodeId, onClose, openSignal }: Props) {
  const dispatch   = useAppDispatch();
  const node       = useAppSelector(s => nodeId ? s.pipeline.nodes[nodeId] : null);
  const pipelineId = useAppSelector(s => s.pipeline.activePipeline?.id ?? '');

  const [localConfig, setLocalConfig] = useState<Record<string, any>>(() => (node?.config as Record<string, any>) ?? {});
  const [localName, setLocalName]     = useState(() => node?.name ?? '');
  const [saved, setSaved]             = useState(false);

  useEffect(() => {
    if (!node) return;
    setLocalConfig(node.config as Record<string, any>);
    setLocalName(node.name);
    setSaved(false);
  }, [node?.id]);

  const handleConfigChange = useCallback((patch: Record<string, any>) => {
    setLocalConfig(prev => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const handleTransformSequencesSaved = useCallback((updated: TransformSequence[]) => {
    if (!nodeId || !node) return;
    const serialized = serializeTransformSequencesForStore(updated);
    const nextConfig = { ...localConfig, transformSequences: serialized };
    setLocalConfig(nextConfig);
    dispatch(updateNode({ id: nodeId, config: nextConfig, name: localName }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [dispatch, localConfig, localName, node, nodeId]);

  const handleApply = () => {
    if (!nodeId || !node) return;
    const normalizedConfig = Array.isArray(localConfig.transformSequences)
      ? { ...localConfig, transformSequences: serializeTransformSequencesForStore(localConfig.transformSequences as TransformSequence[]) }
      : localConfig;
    let displayName = localName;
    const c = normalizedConfig;
    if (node.type === 'source' && c.table && (localName === node.name || localName.startsWith('Source '))) {
      displayName = c.schema ? `${c.schema}.${c.table}` : c.table;
    } else if (node.type === 'target' && (localName === node.name || localName.startsWith('Target '))) {
      const st = c.sinkType ?? 'jdbc';
      if (st === 'file' && c.targetPath) {
        const parts = c.targetPath.replace(/\\/g, '/').split('/').filter(Boolean);
        displayName = `→ ${parts[parts.length - 1] ?? c.targetPath} (${(c.fileFormat ?? 'file').toUpperCase()})`;
      } else if (st === 'delta') {
        displayName = c.deltaTable ? `→ △ ${c.deltaTable}` : c.deltaPath ? `→ △ ${c.deltaPath.split('/').pop()}` : displayName;
      } else if (st === 'iceberg') {
        displayName = c.catalogTable ? `→ 🧊 ${c.catalogTable}` : displayName;
      } else if (c.table) {
        displayName = `→ ${c.schema ? c.schema + '.' : ''}${c.table}`;
      }
    }
    dispatch(updateNode({ id: nodeId, config: normalizedConfig, name: displayName }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!nodeId || !node) {
    return (
      <aside className="w-full bg-[#13152a] border-l border-slate-600/40 flex flex-col shrink-0 h-full">
        <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] p-6 text-center font-medium">
          Double-click a node to configure it
        </div>
      </aside>
    );
  }

  const nodeTypeLabel = node.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    // relative is required so TransformNodeConfig's absolute overlay is constrained to this panel
    <aside className="w-full h-full bg-[#13152a] border-l border-slate-600/40 flex flex-col shrink-0 overflow-hidden relative">
      {/* Header */}
      <div className="h-11 bg-[#0e1022] border-b border-slate-600/40 flex items-center px-3 gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-bold uppercase tracking-widest text-blue-300">Configure {nodeTypeLabel}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Node name */}
      <div className="px-3 pt-3 pb-3 shrink-0 border-b border-slate-600/30 bg-[#0e1022]/50">
        <label className="block text-[12px] font-bold uppercase tracking-widest text-blue-300 mb-1.5 border-l-2 border-blue-500 pl-2">Node Name</label>
        <input type="text" value={localName} onChange={e => { setLocalName(e.target.value); setSaved(false); }}
          className="w-full h-9 px-3 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-semibold
                     focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {node.type === 'source'    && <SourceConfig    nodeId={nodeId}  config={localConfig} onChange={handleConfigChange} />}
        {node.type === 'target'    && <TargetConfig    nodeId={nodeId}    config={localConfig} onChange={handleConfigChange} openSignal={openSignal} />}
        {node.type === 'filter'    && <FilterConfig    nodeId={nodeId}    config={localConfig} onChange={handleConfigChange} />}
        {node.type === 'join'      && <JoinConfig                       config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'transform' && (
          <TransformNodeConfig
            config={localConfig}
            onChange={handleConfigChange}
            onSaveSequences={handleTransformSequencesSaved}
            nodeId={nodeId}
            pipelineId={pipelineId}
            openSignal={openSignal}
          />
        )}
        {node.type === 'custom_sql'&& <TransformConfig   nodeId={nodeId} config={localConfig} onChange={handleConfigChange} />}
        {(node.type === 'aggregate' || node.type === 'aggregation') &&
                                      <AggregateConfig                  config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'union'     && (
          <div>
            <SectionLabel>Union Options</SectionLabel>
            <Field label="Union Type">
              <Select value={localConfig.unionType ?? 'UNION_ALL'} onChange={v => handleConfigChange({ unionType: v })}>
                <option value="UNION_ALL">UNION ALL (keep duplicates, positional)</option>
                <option value="UNION">UNION (deduplicate, positional)</option>
                <option value="UNION_BY_NAME">UNION BY NAME (name-aligned)</option>
                <option value="INTERSECT">INTERSECT</option>
                <option value="EXCEPT">EXCEPT</option>
              </Select>
            </Field>
          </div>
        )}
        {node.type === 'select'           && <SelectColumnsConfig    config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'cast_rename_drop' && <CastRenameDropConfig   config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'derive'           && <DeriveConfig           config={localConfig} onChange={handleConfigChange} />}
        {node.type === 'window'           && <WindowFnConfig         config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'pivot'            && <PivotConfig            config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'data_quality'     && <DataQualityConfig      config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'mask'             && <MaskConfig             config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'lookup'           && <LookupConfig           config={localConfig} onChange={handleConfigChange} />}
        {node.type === 'scd1'             && <Scd1Config             config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'scd2'             && <Scd2Config             config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'surrogate_key'    && <SurrogateKeyConfig     config={localConfig} onChange={handleConfigChange} />}
        {node.type === 'case_when'        && <CaseWhenConfig         config={localConfig} onChange={handleConfigChange} nodeId={nodeId} />}
        {node.type === 'dedup'            && <DedupConfig            config={localConfig as Record<string, unknown>} onChange={handleConfigChange as (p: Record<string, unknown>) => void} nodeId={nodeId} />}
        {node.type === 'sort'             && <SortConfig             config={localConfig as Record<string, unknown>} onChange={handleConfigChange as (p: Record<string, unknown>) => void} nodeId={nodeId} />}
        {node.type === 'limit'            && <LimitConfig            config={localConfig as Record<string, unknown>} onChange={handleConfigChange as (p: Record<string, unknown>) => void} />}
        {node.type === 'sample'           && <SampleConfig           config={localConfig as Record<string, unknown>} onChange={handleConfigChange as (p: Record<string, unknown>) => void} />}
        {node.type === 'cache'            && <CacheConfig            config={localConfig as Record<string, unknown>} onChange={handleConfigChange as (p: Record<string, unknown>) => void} />}
        {node.type === 'repartition'      && <RepartitionConfig      config={localConfig as Record<string, unknown>} onChange={handleConfigChange as (p: Record<string, unknown>) => void} nodeId={nodeId} />}
        {node.type === 'fillna'           && <FillNAConfig           config={localConfig as Record<string, unknown>} onChange={handleConfigChange as (p: Record<string, unknown>) => void} nodeId={nodeId} />}
        {node.type === 'dropna'           && <DropNAConfig           config={localConfig as Record<string, unknown>} onChange={handleConfigChange as (p: Record<string, unknown>) => void} nodeId={nodeId} />}
        {node.type === 'add_audit_columns' && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
              Legacy audit node. New pipelines should configure audit values on the target instead of using a separate Audit component.
            </div>
            <SectionLabel>Audit Column Names</SectionLabel>
            <Field label="Load Timestamp Column">
              <TextInput
                value={String(localConfig.loadTsColumn ?? '_load_ts')}
                onChange={v => handleConfigChange({ loadTsColumn: v })}
                placeholder="_load_ts"
              />
            </Field>
            <Field label="Run ID Column">
              <TextInput
                value={String(localConfig.runIdColumn ?? '_run_id')}
                onChange={v => handleConfigChange({ runIdColumn: v })}
                placeholder="_run_id"
              />
            </Field>
            <Field label="Run User Column">
              <TextInput
                value={String(localConfig.runUserColumn ?? '_run_user')}
                onChange={v => handleConfigChange({ runUserColumn: v })}
                placeholder="_run_user"
              />
            </Field>
            <Field label="Source">
              <Select
                value={String(localConfig.useScaffoldArgs ?? 'true')}
                onChange={v => handleConfigChange({ useScaffoldArgs: v })}
              >
                <option value="true">From scaffold args (--run-id, --run-user)</option>
                <option value="false">Literal defaults (empty string / "system")</option>
              </Select>
            </Field>
          </div>
        )}
      </div>

      {/* Footer — hidden when TransformNodeConfig overlay is active */}
      <div className="px-3 py-3 border-t border-slate-600/40 shrink-0 bg-[#0e1022]/50">
        <button onClick={handleApply}
          className={`w-full h-9 rounded-md text-[13px] font-bold transition-all shadow-md ${
            saved
              ? 'bg-emerald-600 text-white shadow-emerald-500/30'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'
          }`}>
          {saved ? '✓ Applied' : 'Apply Changes'}
        </button>
      </div>
    </aside>
  );
}
