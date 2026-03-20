/**
 * NodeConfigPanel — Right-side panel for configuring a selected pipeline node.
 *
 * Source:  Technology selector → Connection dropdown → Schema dropdown → Table dropdown
 * Target:  Connection → Schema → Table → Write Mode (APPEND/OVERWRITE/SCD1/SCD2/SCD3/UPSERT/MERGE)
 * Filter:  SQL WHERE expression
 * Join:    Join type + key columns
 * Aggregate: Group-by columns + aggregations
 * Transform/Custom SQL: SQL expression editor
 */
import React, { useEffect, useState, useCallback } from 'react';
import { X, RefreshCw, ChevronDown, CheckCircle2, AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateNode } from '@/store/slices/pipelineSlice';
import { fetchConnectorsByTech, fetchConnectors, selectAllConnectors } from '@/store/slices/connectionsSlice';
import type { ConnectorSummary } from '@/store/slices/connectionsSlice';
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

// ─── Section header ────────────────────────────────────────────────────────────
// Color system: bg-[#13152a] panel, bg-[#1e2035] inputs, text-slate-100 primary, text-slate-300 secondary
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mt-4 mb-2 px-1 border-l-2 border-blue-500 pl-2">
      {children}
    </div>
  );
}

// ─── Select field ──────────────────────────────────────────────────────────────
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold text-slate-200 mb-1">
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

// ─── Source node config ────────────────────────────────────────────────────────
const FILE_FORMATS = ['csv', 'parquet', 'json', 'orc', 'avro', 'delta', 'text'];

function SourceConfig({ nodeId, config, onChange }: {
  nodeId: string;
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
}) {
  const dispatch = useAppDispatch();
  const connectorsByTech = useAppSelector(s => s.connections.connectorsByTech);
  const allConnectors = selectAllConnectors(connectorsByTech);
  const [techFilter, setTechFilter] = useState<string>('__ALL__');
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<{ tableName: string; tableType: string }[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

  const srcType = config.sourceType ?? 'jdbc';

  useEffect(() => { dispatch(fetchConnectors()); }, [dispatch]);

  const filteredConnectors: ConnectorSummary[] = techFilter === '__ALL__'
    ? allConnectors
    : allConnectors.filter(c =>
        c.connectorTypeCode?.toUpperCase().includes(techFilter.toUpperCase()) ||
        (c as any).techCode?.toUpperCase() === techFilter.toUpperCase()
      );

  useEffect(() => {
    if (!config.connectionId || srcType !== 'jdbc') { setSchemas([]); setTables([]); return; }
    setLoadingSchemas(true);
    api.introspectSchemas(config.connectionId)
      .then(r => setSchemas((r.data?.data ?? []).map((s: any) => s.schemaName ?? s)))
      .catch(() => setSchemas([]))
      .finally(() => setLoadingSchemas(false));
  }, [config.connectionId, srcType]);

  useEffect(() => {
    if (!config.connectionId || !config.schema || srcType !== 'jdbc') { setTables([]); return; }
    setLoadingTables(true);
    api.introspectTables(config.connectionId, config.schema)
      .then(r => setTables(r.data?.data ?? []))
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false));
  }, [config.connectionId, config.schema, srcType]);

  const techCategories = Array.from(new Set(
    allConnectors.map(c => c.connectorTypeCode?.replace(/^JDBC_/, '').replace(/_/g, ' ') ?? '')
  )).filter(Boolean).sort();

  const selectedConnector = allConnectors.find(c => c.connectorId === config.connectionId);

  return (
    <div>
      {/* ── Source Type ─────────────────────────────────────────────────── */}
      <SectionLabel>Source Type</SectionLabel>
      <div className="flex gap-2 mb-3">
        {[
          { val: 'jdbc',  label: '⬡ Database' },
          { val: 'file',  label: '📄 File'    },
          { val: 'kafka', label: '⚡ Kafka'   },
        ].map(({ val, label }) => (
          <button key={val}
            onClick={() => onChange({ sourceType: val, connectionId: '', schema: '', table: '', filePath: '', fileFormat: '' })}
            className={`flex-1 h-8 rounded text-[11px] font-semibold border transition-colors ${
              srcType === val
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#1e2035] text-slate-300 border-slate-600 hover:border-slate-400 hover:text-white'
            }`}>{label}</button>
        ))}
      </div>

      {/* ── JDBC ─────────────────────────────────────────────────────────── */}
      {srcType === 'jdbc' && (<>
        <SectionLabel>Technology Filter</SectionLabel>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button onClick={() => setTechFilter('__ALL__')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
              techFilter === '__ALL__' ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#1e2035] text-slate-300 border-slate-500 hover:text-white hover:border-slate-400'
            }`}>All</button>
          {techCategories.slice(0, 8).map(t => (
            <button key={t} onClick={() => setTechFilter(t)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                techFilter === t ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#1e2035] text-slate-300 border-slate-500 hover:text-white hover:border-slate-400'
              }`}>{t}</button>
          ))}
        </div>
        <SectionLabel>Connection</SectionLabel>
        <Field label="Connection" required>
          <Select value={config.connectionId ?? ''} onChange={v => onChange({ connectionId: v, schema: '', table: '' })}>
            <option value="">— select connection —</option>
            {filteredConnectors.map(c => (
              <option key={c.connectorId} value={c.connectorId}>
                {c.connectorDisplayName} ({c.connectorTypeCode?.replace(/^JDBC_/, '')})
              </option>
            ))}
          </Select>
          {selectedConnector && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-300">
              <span className={`w-1.5 h-1.5 rounded-full ${selectedConnector.healthStatusCode === 'HEALTHY' ? 'bg-green-500' : 'bg-yellow-500'}`} />
              {selectedConnector.healthStatusCode ?? 'Unknown'}
            </div>
          )}
        </Field>
        <SectionLabel>Dataset Location</SectionLabel>
        <Field label="Schema" required>
          <Select value={config.schema ?? ''} onChange={v => onChange({ schema: v, table: '' })}
            disabled={!config.connectionId} loading={loadingSchemas}>
            <option value="">— select schema —</option>
            {schemas.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Table / View" required>
          <Select value={config.table ?? ''} onChange={v => onChange({ table: v })}
            disabled={!config.schema} loading={loadingTables}>
            <option value="">— select table —</option>
            {tables.map(t => (
              <option key={t.tableName} value={t.tableName}>
                {t.tableName}{t.tableType === 'VIEW' ? ' (view)' : ''}
              </option>
            ))}
          </Select>
        </Field>
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
              className="w-full px-2.5 py-2 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[11px] font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
              rows={4} />
          </Field>
        )}
        <Field label="Fetch Size (rows/batch)">
          <TextInput value={config.fetchSize ?? '10000'} onChange={v => onChange({ fetchSize: v })} placeholder="10000" />
        </Field>
      </>)}

      {/* ── File ─────────────────────────────────────────────────────────── */}
      {srcType === 'file' && (<>
        <SectionLabel>File Location</SectionLabel>
        <Field label="File Path / URI" required>
          <TextInput value={config.filePath ?? ''} onChange={v => onChange({ filePath: v })}
            placeholder="s3://bucket/path/  or  /data/file.csv  or  hdfs://…" />
          <div className="text-[10px] text-slate-500 mt-1">Supports S3, HDFS, ADLS, GCS, local paths</div>
        </Field>
        <Field label="File Format" required>
          <Select value={config.fileFormat ?? ''} onChange={v => onChange({ fileFormat: v })}>
            <option value="">— select format —</option>
            {FILE_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
          </Select>
        </Field>
        {config.fileFormat === 'csv' && (<>
          <SectionLabel>CSV Options</SectionLabel>
          <Field label="Header Row">
            <Select value={config.header ?? 'true'} onChange={v => onChange({ header: v })}>
              <option value="true">Yes — first row is header</option>
              <option value="false">No header</option>
            </Select>
          </Field>
          <Field label="Delimiter">
            <TextInput value={config.delimiter ?? ','} onChange={v => onChange({ delimiter: v })} placeholder="," />
          </Field>
          <Field label="Infer Schema">
            <Select value={config.inferSchema ?? 'true'} onChange={v => onChange({ inferSchema: v })}>
              <option value="true">Auto-infer</option>
              <option value="false">String columns only</option>
            </Select>
          </Field>
        </>)}
        {config.fileFormat === 'json' && (
          <Field label="Multi-line JSON">
            <Select value={config.multiLine ?? 'false'} onChange={v => onChange({ multiLine: v })}>
              <option value="false">Single-line (NDJSON)</option>
              <option value="true">Multi-line (one object per file)</option>
            </Select>
          </Field>
        )}
        <SectionLabel>Options</SectionLabel>
        <Field label="Recursive Lookup">
          <Select value={config.recursiveFileLookup ?? 'false'} onChange={v => onChange({ recursiveFileLookup: v })}>
            <option value="false">No</option>
            <option value="true">Yes — scan subdirectories</option>
          </Select>
        </Field>
      </>)}

      {/* ── Kafka ─────────────────────────────────────────────────────────── */}
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

// ─── File formats for sinks ────────────────────────────────────────────────────
const SINK_FILE_FORMATS = ['parquet', 'csv', 'json', 'orc', 'avro', 'text'];
const SINK_WRITE_MODES_FILE = [
  { value: 'APPEND',    label: 'Append',    desc: 'Add data to existing files/directory' },
  { value: 'OVERWRITE', label: 'Overwrite', desc: 'Replace all existing data' },
];

// ─── Target node config ────────────────────────────────────────────────────────
function TargetConfig({ config, onChange }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
}) {
  const dispatch = useAppDispatch();
  const connectorsByTech = useAppSelector(s => s.connections.connectorsByTech);
  const allConnectors = selectAllConnectors(connectorsByTech);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<{ tableName: string }[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [keyColumns, setKeyColumns] = useState<string[]>(
    config.keyColumns ? config.keyColumns.split(',').filter(Boolean) : []
  );
  const [newKey, setNewKey] = useState('');

  const sinkType = config.sinkType ?? 'jdbc';

  useEffect(() => { dispatch(fetchConnectors()); }, [dispatch]);

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

  const writeMode = config.writeMode ?? 'APPEND';
  const needsKeyColumns = ['SCD1', 'SCD2', 'SCD3', 'UPSERT', 'MERGE'].includes(writeMode);
  const selectedMode = WRITE_MODES.find(m => m.value === writeMode);

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

  return (
    <div>
      {/* ── Sink Type ──────────────────────────────────────────────────── */}
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
            className={`h-8 rounded text-[11px] font-semibold border transition-colors ${
              sinkType === val
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#1e2035] text-slate-300 border-slate-600 hover:border-slate-400 hover:text-white'
            }`}>{label}</button>
        ))}
      </div>

      {/* ── Database (JDBC) ──────────────────────────────────────────── */}
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
              placeholder="or type name" className="flex-1 text-[11px]" />
          </div>
        </Field>
        <SectionLabel>Loading Strategy</SectionLabel>
        <Field label="Write Mode" required>
          <Select value={writeMode} onChange={v => onChange({ writeMode: v })}>
            {WRITE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          {selectedMode && (
            <p className="mt-1.5 text-[10px] text-slate-300 leading-relaxed">{selectedMode.desc}</p>
          )}
        </Field>
        {needsKeyColumns && (
          <Field label={writeMode === 'SCD2' || writeMode === 'SCD3' ? 'Natural Key Columns' : 'Key / Match Columns'} required>
            <div className="space-y-1">
              {keyColumns.map((k, i) => (
                <div key={i} className="flex items-center gap-1.5 h-7 px-2 rounded bg-[#1e2035] border border-slate-500">
                  <span className="flex-1 text-[11px] text-slate-300 font-mono">{k}</span>
                  <button onClick={() => removeKey(i)} className="text-slate-400 hover:text-red-300 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <TextInput value={newKey} onChange={setNewKey} placeholder="column_name" className="flex-1" />
                <button onClick={addKey} className="h-8 px-2.5 rounded bg-blue-700 hover:bg-blue-600 text-white text-[11px] font-medium transition-colors">
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
      </>)}

      {/* ── File Sink ─────────────────────────────────────────────────── */}
      {sinkType === 'file' && (<>
        <SectionLabel>Output Location</SectionLabel>
        <Field label="Output Path / URI" required>
          <TextInput value={config.targetPath ?? ''} onChange={v => onChange({ targetPath: v })}
            placeholder="s3://bucket/path/  or  /output/data/  or  hdfs://…" />
          <div className="text-[10px] text-slate-500 mt-1">Supports S3, HDFS, ADLS, GCS, local paths</div>
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
            <p className="mt-1.5 text-[10px] text-slate-300">{SINK_WRITE_MODES_FILE.find(m => m.value === writeMode)!.desc}</p>
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

      {/* ── Delta Lake Sink ───────────────────────────────────────────── */}
      {sinkType === 'delta' && (<>
        <SectionLabel>Delta Target</SectionLabel>
        <Field label="Storage Path">
          <TextInput value={config.deltaPath ?? ''} onChange={v => onChange({ deltaPath: v })}
            placeholder="s3://bucket/delta/table  or  /mnt/delta/table" />
        </Field>
        <Field label="Table Name (optional)">
          <TextInput value={config.deltaTable ?? ''} onChange={v => onChange({ deltaTable: v })}
            placeholder="catalog.schema.table_name" />
          <div className="text-[10px] text-slate-500 mt-1">Use Table Name for managed Delta tables; Path for external storage</div>
        </Field>
        <SectionLabel>Write Strategy</SectionLabel>
        <Field label="Write Mode" required>
          <Select value={writeMode} onChange={v => onChange({ writeMode: v })}>
            <option value="APPEND">Append</option>
            <option value="OVERWRITE">Overwrite</option>
            <option value="MERGE">Merge (upsert via MERGE INTO)</option>
          </Select>
        </Field>
        {writeMode === 'MERGE' && (<>
          <Field label="Merge Key Columns" required>
            <TextInput value={config.mergeKeys ?? ''} onChange={v => onChange({ mergeKeys: v })}
              placeholder="id,tenant_id" />
            <div className="text-[10px] text-slate-500 mt-1">Comma-separated columns used to match rows</div>
          </Field>
        </>)}
        <Field label="Partition By (columns)">
          <TextInput value={config.partitionBy ?? ''} onChange={v => onChange({ partitionBy: v })}
            placeholder="col1,col2" />
        </Field>
        <Field label="Z-Order By (columns)">
          <TextInput value={config.zOrderBy ?? ''} onChange={v => onChange({ zOrderBy: v })}
            placeholder="col1,col2 — improves query performance" />
        </Field>
      </>)}

      {/* ── Apache Iceberg Sink ───────────────────────────────────────── */}
      {sinkType === 'iceberg' && (<>
        <SectionLabel>Iceberg Target</SectionLabel>
        <Field label="Catalog Table Name" required>
          <TextInput value={config.catalogTable ?? ''} onChange={v => onChange({ catalogTable: v })}
            placeholder="catalog.schema.table_name" />
          <div className="text-[10px] text-slate-500 mt-1">Must be a registered Iceberg catalog table</div>
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
            <TextInput value={config.mergeKeys ?? ''} onChange={v => onChange({ mergeKeys: v })}
              placeholder="id,tenant_id" />
          </Field>
        )}
      </>)}

      {/* ── Common options (all sink types) ─────────────────────────── */}
      {sinkType === 'jdbc' && (<>
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
      </>)}
    </div>
  );
}

// ─── Filter node config ────────────────────────────────────────────────────────
function FilterConfig({ config, onChange }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
}) {
  return (
    <div>
      <SectionLabel>Filter Condition</SectionLabel>
      <Field label="SQL WHERE Expression" required>
        <textarea value={config.expression ?? ''} onChange={e => onChange({ expression: e.target.value })}
          placeholder="e.g.  status = 'ACTIVE' AND amount > 100"
          className="w-full px-2.5 py-2 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[11px]
                     font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
          rows={5} />
      </Field>
      <Field label="Filter Mode">
        <Select value={config.filterMode ?? 'INCLUDE'} onChange={v => onChange({ filterMode: v })}>
          <option value="INCLUDE">Include matching rows (WHERE)</option>
          <option value="EXCLUDE">Exclude matching rows (WHERE NOT)</option>
        </Select>
      </Field>
    </div>
  );
}

// ─── Join node config ──────────────────────────────────────────────────────────
function JoinConfig({ config, onChange }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
}) {
  const [keys, setKeys] = useState<Array<{ left: string; right: string }>>(
    config.joinKeys ? JSON.parse(config.joinKeys) : [{ left: '', right: '' }]
  );

  const updateKey = (i: number, side: 'left' | 'right', val: string) => {
    const updated = keys.map((k, idx) => idx === i ? { ...k, [side]: val } : k);
    setKeys(updated);
    onChange({ joinKeys: JSON.stringify(updated) });
  };

  return (
    <div>
      <SectionLabel>Join Type</SectionLabel>
      <Field label="Join Type" required>
        <Select value={config.joinType ?? 'INNER'} onChange={v => onChange({ joinType: v })}>
          {JOIN_TYPES.map(t => <option key={t} value={t}>{t} JOIN</option>)}
        </Select>
      </Field>
      <SectionLabel>Join Columns</SectionLabel>
      {keys.map((k, i) => (
        <div key={i} className="flex gap-2 mb-2 items-center">
          <TextInput value={k.left} onChange={v => updateKey(i, 'left', v)} placeholder="left.col" />
          <span className="text-slate-500 text-[11px] shrink-0">=</span>
          <TextInput value={k.right} onChange={v => updateKey(i, 'right', v)} placeholder="right.col" />
          <button onClick={() => {
            const updated = keys.filter((_, idx) => idx !== i);
            setKeys(updated); onChange({ joinKeys: JSON.stringify(updated) });
          }} className="text-slate-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></button>
        </div>
      ))}
      <button onClick={() => {
        const updated = [...keys, { left: '', right: '' }];
        setKeys(updated); onChange({ joinKeys: JSON.stringify(updated) });
      }} className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 mt-1">
        <Plus className="w-3 h-3" /> Add key column
      </button>
    </div>
  );
}

// ─── Transform / Custom SQL config ────────────────────────────────────────────
function TransformConfig({ config, onChange }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
}) {
  return (
    <div>
      <SectionLabel>SQL Expression</SectionLabel>
      <Field label="SELECT / Expression" required>
        <textarea value={config.expression ?? ''} onChange={e => onChange({ expression: e.target.value })}
          placeholder="SELECT *, UPPER(name) AS name_upper, amount * 1.1 AS amount_incl_tax FROM __input__"
          className="w-full px-2.5 py-2 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[11px]
                     font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
          rows={7} />
        <p className="text-[10px] text-slate-300 mt-1">Use <code className="text-blue-300">__input__</code> to reference the incoming dataset</p>
      </Field>
    </div>
  );
}

// ─── Aggregate node config ─────────────────────────────────────────────────────
function AggregateConfig({ config, onChange }: {
  config: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
}) {
  const [groupCols, setGroupCols] = useState<string[]>(
    config.groupByColumns ? config.groupByColumns.split(',').filter(Boolean) : []
  );
  const [newCol, setNewCol] = useState('');

  const addCol = () => {
    if (!newCol.trim()) return;
    const updated = [...groupCols, newCol.trim()];
    setGroupCols(updated); onChange({ groupByColumns: updated.join(',') });
    setNewCol('');
  };

  return (
    <div>
      <SectionLabel>Group By Columns</SectionLabel>
      <div className="space-y-1 mb-2">
        {groupCols.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 h-7 px-2 rounded bg-[#1e2035] border border-slate-500">
            <span className="flex-1 text-[11px] text-slate-300 font-mono">{c}</span>
            <button onClick={() => {
              const u = groupCols.filter((_, idx) => idx !== i);
              setGroupCols(u); onChange({ groupByColumns: u.join(',') });
            }} className="text-slate-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
        <div className="flex gap-1.5">
          <TextInput value={newCol} onChange={setNewCol} placeholder="column_name" className="flex-1" />
          <button onClick={addCol}
            className="h-8 px-2.5 rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
      <SectionLabel>Aggregation Expression</SectionLabel>
      <Field label="SELECT aggregations" required>
        <textarea value={config.expression ?? ''} onChange={e => onChange({ expression: e.target.value })}
          placeholder="SUM(amount) AS total_amount, COUNT(*) AS row_count, MAX(updated_at) AS last_update"
          className="w-full px-2.5 py-2 rounded bg-[#1e2035] border border-slate-500 text-slate-100 text-[11px]
                     font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
          rows={4} />
      </Field>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
interface Props {
  nodeId: string | null;
  onClose: () => void;
}

export function NodeConfigPanel({ nodeId, onClose }: Props) {
  const dispatch = useAppDispatch();
  const node = useAppSelector(s => nodeId ? s.pipeline.nodes[nodeId] : null);
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [localName, setLocalName] = useState('');
  const [saved, setSaved] = useState(false);

  // Sync from Redux when node changes
  useEffect(() => {
    if (!node) return;
    setLocalConfig(node.config as Record<string, string>);
    setLocalName(node.name);
    setSaved(false);
  }, [node?.id]);

  const handleConfigChange = useCallback((patch: Record<string, string>) => {
    setLocalConfig(prev => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const handleApply = () => {
    if (!nodeId || !node) return;
    // Build display name from config if default
    let displayName = localName;
    const c = localConfig;
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
    dispatch(updateNode({ id: nodeId, config: localConfig, name: displayName }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!nodeId || !node) {
    return (
      <aside className="w-72 bg-[#13152a] border-l border-slate-600/40 flex flex-col shrink-0">
        <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] p-6 text-center font-medium">
          Double-click a node to configure it
        </div>
      </aside>
    );
  }

  const nodeTypeLabel = node.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <aside className="w-80 bg-[#13152a] border-l border-slate-600/40 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="h-11 bg-[#0e1022] border-b border-slate-600/40 flex items-center px-3 gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-widest text-blue-300">Configure {nodeTypeLabel}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Node name */}
      <div className="px-3 pt-3 pb-3 shrink-0 border-b border-slate-600/30 bg-[#0e1022]/50">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-1.5 border-l-2 border-blue-500 pl-2">Node Name</label>
        <input type="text" value={localName} onChange={e => { setLocalName(e.target.value); setSaved(false); }}
          className="w-full h-9 px-3 rounded-md bg-[#1e2035] border border-slate-500 text-slate-100 text-[12px] font-semibold
                     focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {node.type === 'source'     && <SourceConfig    nodeId={nodeId} config={localConfig} onChange={handleConfigChange} />}
        {node.type === 'target'     && <TargetConfig    config={localConfig} onChange={handleConfigChange} />}
        {node.type === 'filter'     && <FilterConfig    config={localConfig} onChange={handleConfigChange} />}
        {node.type === 'join'       && <JoinConfig      config={localConfig} onChange={handleConfigChange} />}
        {(node.type === 'transform' || node.type === 'custom_sql') &&
                                       <TransformConfig config={localConfig} onChange={handleConfigChange} />}
        {(node.type === 'aggregate' || node.type === 'aggregation') &&
                                       <AggregateConfig config={localConfig} onChange={handleConfigChange} />}
        {node.type === 'union'      && (
          <div>
            <SectionLabel>Union Options</SectionLabel>
            <Field label="Union Type">
              <Select value={localConfig.unionType ?? 'UNION_ALL'} onChange={v => handleConfigChange({ unionType: v })}>
                <option value="UNION_ALL">UNION ALL (keep duplicates)</option>
                <option value="UNION">UNION (deduplicate)</option>
                <option value="INTERSECT">INTERSECT</option>
                <option value="EXCEPT">EXCEPT</option>
              </Select>
            </Field>
          </div>
        )}
      </div>

      {/* Footer */}
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
