/**
 * ConnectionWorkspace — tab content for a Connection object.
 * Sub-tabs: Properties | Authentication | Connectivity | Usage | History | Permissions | Security
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Save, TestTube2, RefreshCw, Eye, EyeOff, CheckCircle2,
  XCircle, Loader2, AlertTriangle, Clock, Download, ChevronDown, ChevronRight,
  Table2, Database as DbIcon, FolderOpen, CheckSquare, Square,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid, type HistoryRow } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid, type PermissionRow } from '@/components/shared/ObjectPermissionsGrid';
import type { ConnectionSubTab } from '@/types';
import api from '@/services/api';

const SUB_TABS = [
  { id: 'properties',    label: 'Properties',      shortcut: '1' },
  { id: 'import',        label: 'Import Metadata', shortcut: '2' },
  { id: 'usage',         label: 'Usage',           shortcut: '3' },
  { id: 'history',       label: 'History',         shortcut: '4' },
  { id: 'permissions',   label: 'Permissions',     shortcut: '5' },
] satisfies { id: ConnectionSubTab; label: string; shortcut: string }[];

type FD = Record<string, unknown>;

const TECH_CATEGORY_MAP: Record<string, string> = {
  CSV: 'File', FILE_CSV: 'File', FILE_EXCEL: 'File', FILE_PARQUET: 'File', FILE_JSON: 'File', FILE_XML: 'File', FILE_AVRO: 'File', FILE_ORC: 'File',
  EXCEL: 'File', PARQUET: 'File', JSON: 'File', XML: 'File', AVRO: 'File', ORC: 'File',
  S3: 'Cloud Storage', GCS: 'Cloud Storage', AZURE_BLOB: 'Cloud Storage', ADLS: 'Cloud Storage',
  SNOWFLAKE: 'Database', POSTGRESQL: 'Database', JDBC_POSTGRESQL: 'Database', MYSQL: 'Database', JDBC_MYSQL: 'Database', SQLSERVER: 'Database', JDBC_SQLSERVER: 'Database',
  ORACLE: 'Database', JDBC_ORACLE: 'Database', REDSHIFT: 'Database', BIGQUERY: 'Database', DATABRICKS: 'Database',
  KAFKA: 'Messaging', KINESIS: 'Messaging', PUBSUB: 'Messaging', RABBITMQ: 'Messaging',
  REST_API: 'API', GRAPHQL: 'API', SFTP: 'File Transfer', FTP: 'File Transfer',
  MONGODB: 'NoSQL', CASSANDRA: 'NoSQL', DYNAMODB: 'NoSQL', REDIS: 'NoSQL',
  HIVE: 'Data Lake', DELTA_LAKE: 'Data Lake', ICEBERG: 'Data Lake',
};

const TECH_FIELD_GROUPS: Record<string, string[]> = {
  File:         ['filePath', 'delimiter', 'encoding', 'hasHeader', 'compression'],
  'File Transfer': ['host', 'port', 'remotePath', 'username'],
  'Cloud Storage': ['bucket', 'region', 'prefix', 'endpoint'],
  Database:     ['host', 'port', 'database', 'schema'],
  Messaging:    ['bootstrapServers', 'topic', 'groupId'],
  API:          ['baseUrl', 'apiVersion'],
  NoSQL:        ['host', 'port', 'database'],
  'Data Lake':  ['host', 'port', 'database', 'warehouse'],
};

function derivedCategory(techCode: string): string {
  const upper = (techCode ?? '').toUpperCase();
  return TECH_CATEGORY_MAP[upper] ?? 'Other';
}

function mapConnectionDtoToForm(dto: Record<string, unknown>, fallbackName: string, connectionId: string): FD {
  const techCode = String(dto.connectorTypeCode ?? dto.connector_type_code ?? '');
  const cfg = (dto.configJson ?? dto.config_json ?? {}) as Record<string, unknown>;
  // JDBC-style connectors prefix field names with jdbc_
  return {
    connectionId,
    name: String(dto.connectorDisplayName ?? dto.connector_display_name ?? fallbackName),
    technologyType: techCode,
    vendor: techCode,
    category: derivedCategory(techCode),
    environment: 'Development',
    // Config fields — support both plain and jdbc_ prefixed names
    host: String(cfg.host ?? cfg.hostname ?? cfg.jdbc_host ?? cfg.server ?? ''),
    port: String(cfg.port ?? cfg.jdbc_port ?? ''),
    database: String(cfg.database ?? cfg.db ?? cfg.jdbc_database ?? cfg.bucket ?? cfg.container ?? ''),
    schema: String(cfg.schema ?? cfg.jdbc_schema ?? ''),
    region: String(cfg.region ?? ''),
    filePath: String(cfg.filePath ?? cfg.file_path ?? cfg.storage_base_path ?? cfg.path ?? ''),
    delimiter: String(cfg.delimiter ?? cfg.field_separator_char ?? ''),
    encoding: String(cfg.encoding ?? ''),
    compression: String(cfg.compression ?? ''),
    bucket: String(cfg.bucket ?? cfg.container ?? ''),
    prefix: String(cfg.prefix ?? ''),
    endpoint: String(cfg.endpoint ?? ''),
    bootstrapServers: String(cfg.bootstrapServers ?? cfg.bootstrap_servers ?? ''),
    topic: String(cfg.topic ?? ''),
    groupId: String(cfg.groupId ?? cfg.group_id ?? ''),
    baseUrl: String(cfg.baseUrl ?? cfg.base_url ?? ''),
    apiVersion: String(cfg.apiVersion ?? cfg.api_version ?? ''),
    remotePath: String(cfg.remotePath ?? cfg.remote_path ?? ''),
    warehouse: String(cfg.warehouse ?? ''),
    description: String(cfg.description ?? ''),
    tags: String(cfg.tags ?? ''),
    owner: String(dto.createdByFullName ?? dto.created_by_name ?? ''),
    // Credentials — username from decrypted secrets (password never shown, only replaceable)
    username: String(dto.secretsUsername ?? ''),
    password: '',
    sslEnabled: String(cfg.jdbc_ssl_mode ?? cfg.ssl_mode ?? dto.connSslMode ?? dto.conn_ssl_mode ?? '').toUpperCase() !== 'DISABLE',
    certAlias: '',
    maxPoolSize: String(dto.connMaxPoolSizeNum ?? dto.conn_max_pool_size_num ?? ''),
    status: String(dto.healthStatusCode ?? dto.health_status_code ?? 'UNKNOWN'),
    createdBy: String(dto.createdByFullName ?? dto.created_by_name ?? '—'),
    createdOn: String(dto.createdDtm ?? dto.created_dtm ?? '—'),
    updatedBy: String(dto.updatedBy ?? dto.updated_by_user_id ?? '—'),
    updatedOn: String(dto.updatedDtm ?? dto.updated_dtm ?? '—'),
  };
}

function buildConnectionUpdatePayload(form: FD) {
  const payload: Record<string, unknown> = {
    connectorDisplayName: String(form.name ?? '').trim(),
    sslMode: form.sslEnabled ? 'REQUIRE' : 'DISABLE',
  };
  const maxPoolSizeRaw = String(form.maxPoolSize ?? '').trim();
  const maxPoolSize = Number(maxPoolSizeRaw);
  if (maxPoolSizeRaw && Number.isFinite(maxPoolSize)) {
    payload.maxPoolSize = maxPoolSize;
  }
  // Build config from form fields (preserves any existing keys server-side via merge in update proc)
  const category = String(form.category ?? 'Other');
  const config: Record<string, unknown> = {};
  if (category === 'Database' || category === 'NoSQL' || category === 'Data Lake') {
    const techCode = String(form.technologyType ?? '').toUpperCase();
    const isJdbc = techCode.startsWith('JDBC_');
    if (isJdbc) {
      if (form.host) config['jdbc_host'] = form.host;
      if (form.port) config['jdbc_port'] = form.port;
      if (form.database) config['jdbc_database'] = form.database;
      config['jdbc_ssl_mode'] = form.sslEnabled ? 'REQUIRE' : 'DISABLE';
    } else {
      if (form.host) config['host'] = form.host;
      if (form.port) config['port'] = form.port;
      if (form.database) config['database'] = form.database;
      if (form.schema) config['schema'] = form.schema;
    }
  } else if (category === 'File') {
    if (form.filePath) config['storage_base_path'] = form.filePath;
    if (form.delimiter) config['field_separator_char'] = form.delimiter;
    if (form.encoding) config['encoding'] = form.encoding;
    if (form.compression) config['compression'] = form.compression;
  } else if (category === 'Cloud Storage') {
    if (form.bucket) config['bucket'] = form.bucket;
    if (form.region) config['region'] = form.region;
    if (form.prefix) config['prefix'] = form.prefix;
    if (form.endpoint) config['endpoint'] = form.endpoint;
  }
  if (Object.keys(config).length > 0) payload.config = config;
  // Only send secrets if username/password are explicitly set
  const secrets: Record<string, unknown> = {};
  if (form.username) {
    const techCode = String(form.technologyType ?? '').toUpperCase();
    const isJdbc = techCode.startsWith('JDBC_');
    secrets[isJdbc ? 'jdbc_username' : 'username'] = form.username;
  }
  if (form.password) {
    const techCode = String(form.technologyType ?? '').toUpperCase();
    const isJdbc = techCode.startsWith('JDBC_');
    secrets[isJdbc ? 'jdbc_password' : 'password'] = form.password;
  }
  if (Object.keys(secrets).length > 0) payload.secrets = secrets;
  return payload;
}

function Field({ label, field, value, onChange, ro, secret, placeholder }: {
  label: string; field: string; value: string; onChange?: (f: string, v: string) => void;
  ro?: boolean; secret?: boolean; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      <div className="relative">
        {ro ? (
          <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono">{value || '—'}</div>
        ) : (
          <input
            type={secret && !show ? 'password' : 'text'}
            value={value}
            onChange={e => onChange?.(field, e.target.value)}
            placeholder={placeholder}
            className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 pr-8"
          />
        )}
        {secret && !ro && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Field definitions per category ──────────────────────────────────────────

const CATEGORY_FIELDS: Record<string, { label: string; field: string; placeholder?: string }[]> = {
  File: [
    { label: 'File Path / Pattern', field: 'filePath', placeholder: '/data/files/*.csv or s3://bucket/path/' },
    { label: 'Delimiter', field: 'delimiter', placeholder: ',' },
    { label: 'Encoding', field: 'encoding', placeholder: 'UTF-8' },
    { label: 'Compression', field: 'compression', placeholder: 'none / gzip / snappy' },
  ],
  'File Transfer': [
    { label: 'Host', field: 'host', placeholder: 'sftp.example.com' },
    { label: 'Port', field: 'port', placeholder: '22' },
    { label: 'Remote Path', field: 'remotePath', placeholder: '/upload/data/' },
  ],
  'Cloud Storage': [
    { label: 'Bucket / Container', field: 'bucket', placeholder: 'my-data-bucket' },
    { label: 'Region', field: 'region', placeholder: 'us-east-1' },
    { label: 'Path Prefix', field: 'prefix', placeholder: 'data/raw/' },
    { label: 'Endpoint Override', field: 'endpoint', placeholder: 'Leave blank for default' },
  ],
  Database: [
    { label: 'Host', field: 'host', placeholder: 'db.example.com' },
    { label: 'Port', field: 'port', placeholder: '5432' },
    { label: 'Database', field: 'database', placeholder: 'my_database' },
    { label: 'Schema', field: 'schema', placeholder: 'public' },
  ],
  Messaging: [
    { label: 'Bootstrap Servers', field: 'bootstrapServers', placeholder: 'broker1:9092,broker2:9092' },
    { label: 'Topic', field: 'topic', placeholder: 'my-topic' },
    { label: 'Consumer Group', field: 'groupId', placeholder: 'etl-consumer-group' },
  ],
  API: [
    { label: 'Base URL', field: 'baseUrl', placeholder: 'https://api.example.com' },
    { label: 'API Version', field: 'apiVersion', placeholder: 'v1' },
  ],
  NoSQL: [
    { label: 'Host', field: 'host', placeholder: 'mongo.example.com' },
    { label: 'Port', field: 'port', placeholder: '27017' },
    { label: 'Database', field: 'database', placeholder: 'my_database' },
  ],
  'Data Lake': [
    { label: 'Host / Metastore URI', field: 'host', placeholder: 'thrift://hive-metastore:9083' },
    { label: 'Port', field: 'port', placeholder: '10000' },
    { label: 'Database', field: 'database', placeholder: 'default' },
    { label: 'Warehouse Path', field: 'warehouse', placeholder: 's3://warehouse/' },
  ],
  Other: [
    { label: 'Host / Endpoint', field: 'host', placeholder: 'hostname or IP' },
    { label: 'Port', field: 'port', placeholder: '' },
    { label: 'Database / Bucket / Container', field: 'database', placeholder: '' },
    { label: 'Region', field: 'region', placeholder: '' },
  ],
};

// ─── Properties sub-tab (technology-aware) ────────────────────────────────────

function PropertiesTab({ data, onChange }: { data: FD; onChange: (f: string, v: string) => void }) {
  const F = (p: { label: string; field: string; ro?: boolean; placeholder?: string }) => (
    <Field label={p.label} field={p.field} value={String(data[p.field] ?? '')} onChange={onChange} ro={p.ro} placeholder={p.placeholder} />
  );
  const category = String(data.category ?? 'Other');
  const dynamicFields = CATEGORY_FIELDS[category] ?? CATEGORY_FIELDS['Other'];

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        {/* Identity */}
        <F label="Connection ID" field="connectionId" ro />
        <F label="Connection Name *" field="name" />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Technology" field="technologyType" value={String(data.technologyType ?? '')} ro />
          <Field label="Category" field="category" value={category} ro />
          <F label="Environment" field="environment" />
        </div>

        {/* Technology-specific connection fields */}
        <div className="border-t border-slate-800 pt-4">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">{category} Connection</p>
          <div className="grid grid-cols-2 gap-4">
            {dynamicFields.map(fd => (
              <F key={fd.field} label={fd.label} field={fd.field} placeholder={fd.placeholder} />
            ))}
          </div>
        </div>

        {/* Pool size (databases only) */}
        {(category === 'Database' || category === 'NoSQL' || category === 'Data Lake') && (
          <F label="Max Pool Size" field="maxPoolSize" placeholder="10" />
        )}

        {/* Credentials — inline, no separate tab needed */}
        {category !== 'File' && (
          <div className="border-t border-slate-800 pt-4">
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Credentials</p>
            <div className="grid grid-cols-2 gap-4">
              <F label="Username / Account" field="username" placeholder="DB user (e.g. postgres)" />
              <Field label="Password" field="password" value={String(data.password ?? '')} onChange={onChange}
                secret placeholder="Enter new password to replace stored secret" />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <input type="checkbox" id="ssl-prop" checked={Boolean(data.sslEnabled)}
                onChange={e => onChange('sslEnabled', String(e.target.checked))} className="w-3.5 h-3.5 accent-blue-500" />
              <label htmlFor="ssl-prop" className="text-[12px] text-slate-300">SSL / TLS Enabled</label>
            </div>
            <p className="text-[11px] text-amber-300/70 mt-2">
              Password is stored encrypted and cannot be read back. Leave blank to keep the existing secret unchanged.
            </p>
          </div>
        )}

        {/* Description + Tags */}
        <div className="border-t border-slate-800 pt-4">
          <label className="block text-[11px] text-slate-500 mb-1">Description</label>
          <textarea rows={2} value={String(data.description ?? '')} onChange={e => onChange('description', e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" />
        </div>
        <F label="Tags (comma separated)" field="tags" />

        {/* Audit */}
        <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4">
          <F label="Owner" field="owner" />
          <F label="Status" field="status" ro />
          <F label="Created By" field="createdBy" ro />
          <F label="Created On" field="createdOn" ro />
          <F label="Updated By" field="updatedBy" ro />
          <F label="Updated On" field="updatedOn" ro />
        </div>
      </div>
    </div>
  );
}

// ─── Authentication sub-tab ───────────────────────────────────────────────

function AuthenticationTab({ data, onChange }: { data: FD; onChange: (f: string, v: string) => void }) {
  const authMode = String(data.authMode ?? 'username_password');
  const category = String(data.category ?? 'Other');
  const isFileOnly = category === 'File';

  if (isFileOnly) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-slate-500 p-8 max-w-sm">
          <p className="text-[13px] font-medium text-slate-400 mb-2">No authentication required</p>
          <p className="text-[12px]">File-based connections read directly from the local filesystem or a mounted path. Authentication is managed at the infrastructure level.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Authentication Mode</label>
          <select
            value={authMode}
            onChange={e => onChange('authMode', e.target.value)}
            className="h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full"
          >
            <option value="username_password">Username / Password</option>
            <option value="key_file">Key File</option>
            <option value="oauth">OAuth 2.0</option>
            <option value="iam_role">IAM Role</option>
            <option value="service_account">Service Account</option>
            <option value="no_auth">No Authentication</option>
          </select>
        </div>

        {(authMode === 'username_password' || authMode === 'key_file') && (
          <Field label="Username" field="username" value={String(data.username ?? '')} onChange={onChange} />
        )}

        {authMode === 'username_password' && (
          <Field label="Password" field="password" value={String(data.password ?? '')} onChange={onChange} secret placeholder="Stored securely — not displayed" />
        )}

        {authMode === 'key_file' && (
          <Field label="Key File Reference" field="keyFileRef" value={String(data.keyFileRef ?? '')} onChange={onChange} placeholder="vault:// or secret:// reference" />
        )}

        {authMode === 'oauth' && (
          <>
            <Field label="Client ID" field="oauthClientId" value={String(data.oauthClientId ?? '')} onChange={onChange} />
            <Field label="Client Secret" field="oauthClientSecret" value={String(data.oauthClientSecret ?? '')} onChange={onChange} secret />
            <Field label="Token Endpoint" field="oauthTokenEndpoint" value={String(data.oauthTokenEndpoint ?? '')} onChange={onChange} />
            <div className="bg-slate-800/40 border border-slate-700 rounded p-3 text-[12px]">
              <span className="text-slate-500">Token Expiry: </span>
              <span className="text-slate-300">{String(data.tokenExpiry ?? 'Unknown')}</span>
            </div>
          </>
        )}

        {authMode === 'service_account' && (
          <Field label="Service Account JSON Path" field="serviceAccountPath" value={String(data.serviceAccountPath ?? '')} onChange={onChange} />
        )}

        <div className="border-t border-slate-800 pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="ssl" checked={Boolean(data.sslEnabled)} onChange={e => onChange('sslEnabled', String(e.target.checked))} className="w-3.5 h-3.5 accent-blue-500" />
            <label htmlFor="ssl" className="text-[12px] text-slate-300">SSL / TLS Enabled</label>
          </div>
          {data.sslEnabled && (
            <Field label="Certificate Alias" field="certAlias" value={String(data.certAlias ?? '')} onChange={onChange} placeholder="Optional — leave blank for default" />
          )}
        </div>

        <div className="bg-amber-900/20 border border-amber-700/40 rounded p-3 text-[11px] text-amber-300/80">
          Sensitive values are stored encrypted. Existing secrets cannot be viewed after save — only replaced.
        </div>
      </div>
    </div>
  );
}

// ─── Test Connection sub-tab ───────────────────────────────────────────────────

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

function ConnectivityTab({
  status,
  lastResult,
  formData,
  onRunTest,
}: {
  status: TestStatus;
  lastResult: { testedBy: string; testedOn: string; responseMs?: number; error?: string } | null;
  formData: FD;
  onRunTest: () => void;
}) {
  const category = String(formData.category ?? 'Other');
  const isFileOnly = category === 'File';
  const overallHealth = status === 'success' ? 'HEALTHY' : status === 'failed' ? 'UNHEALTHY' : String(formData.status ?? 'UNKNOWN');
  const healthColor = overallHealth === 'HEALTHY' ? 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40'
    : overallHealth === 'UNHEALTHY' ? 'text-red-400 bg-red-900/30 border-red-700/40'
    : 'text-slate-400 bg-slate-800/40 border-slate-700';

  if (isFileOnly) {
    return (
      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-xl space-y-5">
          <div className="flex items-center gap-3 p-4 rounded-lg border text-slate-400 bg-slate-800/40 border-slate-700">
            <Clock className="w-5 h-5 shrink-0" />
            <div>
              <div className="text-[13px] font-semibold">No network health check for file connections</div>
              <div className="text-[11px] opacity-70 mt-0.5">File accessibility is validated at pipeline execution time when the Spark job reads the path.</div>
            </div>
          </div>
          <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-2">
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-2">File Connection Summary</p>
            {[
              { label: 'Technology', value: String(formData.technologyType ?? '—') },
              { label: 'File Path',  value: String(formData.filePath || '—') },
              { label: 'Delimiter',  value: String(formData.delimiter || '—') },
              { label: 'Encoding',   value: String(formData.encoding || '—') },
              { label: 'Compression', value: String(formData.compression || 'none') },
            ].map(r => (
              <div key={r.label} className="flex items-center text-[12px]">
                <span className="text-slate-500 w-28 shrink-0">{r.label}</span>
                <span className="text-slate-300 font-mono">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-xl space-y-5">

        {/* Overall health banner */}
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${healthColor}`}>
          {overallHealth === 'HEALTHY'
            ? <CheckCircle2 className="w-5 h-5 shrink-0" />
            : overallHealth === 'UNHEALTHY'
              ? <XCircle className="w-5 h-5 shrink-0" />
              : <Clock className="w-5 h-5 shrink-0" />
          }
          <div>
            <div className="text-[13px] font-semibold">{overallHealth === 'HEALTHY' ? 'Connection is healthy' : overallHealth === 'UNHEALTHY' ? 'Connection unreachable' : 'Health unknown — run a test'}</div>
            {lastResult && (
              <div className="text-[11px] opacity-70 mt-0.5">
                Last tested by {lastResult.testedBy} · {lastResult.testedOn}
                {lastResult.responseMs !== undefined ? ` · ${lastResult.responseMs}ms` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Error detail */}
        {status === 'failed' && lastResult?.error && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-[12px] text-red-300 font-mono whitespace-pre-wrap break-words">
            {lastResult.error}
          </div>
        )}

        {/* Connection summary */}
        <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-2">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-2">Connection Summary</p>
          {[
            { label: 'Technology', value: String(formData.technologyType ?? '—') },
            { label: 'Category',   value: String(formData.category ?? '—') },
            { label: 'Host',       value: String(formData.host || formData.bucket || formData.bootstrapServers || formData.baseUrl || '—') },
            { label: 'Database',   value: String(formData.database || formData.topic || '—') },
            { label: 'SSL / TLS',  value: formData.sslEnabled ? 'Enabled' : 'Disabled' },
          ].map(r => (
            <div key={r.label} className="flex items-center text-[12px]">
              <span className="text-slate-500 w-28 shrink-0">{r.label}</span>
              <span className="text-slate-300 font-mono">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Run test */}
        <button
          onClick={onRunTest}
          disabled={status === 'testing'}
          className="flex items-center gap-2 h-9 px-5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-60"
        >
          {status === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
          {status === 'testing' ? 'Testing…' : 'Test Connection'}
        </button>

      </div>
    </div>
  );
}

// ─── Usage sub-tab ────────────────────────────────────────────────────────

function UsageTab({
  rows,
  loading,
  error,
}: {
  rows: Array<{ usageType: string; objectName: string; context: string }>;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl">
        <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Used By</div>
        {loading ? (
          <div className="text-[12px] text-slate-500 border border-slate-800 rounded-lg p-4">Loading usage…</div>
        ) : error ? (
          <div className="text-[12px] text-red-400 border border-red-800/50 rounded-lg p-4">{error}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg">
            <RefreshCw className="w-6 h-6 mb-2 opacity-40" />
            <p className="text-sm">No dependent datasets, pipelines, or orchestrators found.</p>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-500 border-b border-slate-800">
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Object</th>
                  <th className="px-3 py-2 font-medium">Context</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.usageType}-${row.objectName}-${index}`} className="border-b border-slate-800/50">
                    <td className="px-3 py-2 text-slate-400">{row.usageType}</td>
                    <td className="px-3 py-2 text-slate-200">{row.objectName}</td>
                    <td className="px-3 py-2 text-slate-500">{row.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Import Metadata sub-tab ──────────────────────────────────────────────

type SchemaEntry = { schemaName: string; tableCount?: number };
type TableEntry  = { tableName: string; tableType: string };

function ImportMetadataTab({ connectionId, category }: { connectionId: string; category: string }) {
  const isFile = category === 'File';
  const isDb   = ['Database', 'NoSQL', 'Data Lake', 'Cloud Storage'].includes(category);

  const [schemas, setSchemas]         = useState<SchemaEntry[]>([]);
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);
  const [tablesBySchema, setTablesBySchema] = useState<Record<string, TableEntry[]>>({});
  const [loadingSchema, setLoadingSchema]   = useState<string | null>(null);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading]     = useState(false);
  const [importing, setImporting]     = useState(false);
  const [result, setResult]           = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const schemaKey = (schema: string, table: string) => `${schema}||${table}`;

  useEffect(() => {
    if (!connectionId) return;
    setIsLoading(true);
    api.introspectSchemas(connectionId)
      .then(res => setSchemas((res.data?.data ?? []) as SchemaEntry[]))
      .catch(e => setError(e?.response?.data?.userMessage ?? 'Failed to load schemas'))
      .finally(() => setIsLoading(false));
  }, [connectionId]);

  const expandSchema = async (schema: string) => {
    if (expandedSchema === schema) { setExpandedSchema(null); return; }
    setExpandedSchema(schema);
    if (tablesBySchema[schema]) return;
    setLoadingSchema(schema);
    try {
      const res = await api.introspectTables(connectionId, schema);
      setTablesBySchema(prev => ({ ...prev, [schema]: (res.data?.data ?? []) as TableEntry[] }));
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? 'Failed to load tables');
    } finally { setLoadingSchema(null); }
  };

  const toggleTable = (schema: string, table: string) => {
    const key = schemaKey(schema, table);
    setSelected(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  };

  const toggleSchema = (schema: string) => {
    const tables = tablesBySchema[schema] ?? [];
    const allSelected = tables.every(t => selected.has(schemaKey(schema, t.tableName)));
    setSelected(prev => {
      const s = new Set(prev);
      tables.forEach(t => allSelected ? s.delete(schemaKey(schema, t.tableName)) : s.add(schemaKey(schema, t.tableName)));
      return s;
    });
  };

  const doImport = async () => {
    setImporting(true);
    setResult(null);
    setError(null);
    try {
      let selections: Array<{ schema?: string; table: string }>;
      if (isFile) {
        // For file connections, import the file itself
        selections = schemas.length > 0
          ? [{ schema: schemas[0].schemaName, table: schemas[0].schemaName.split('/').pop() ?? 'file' }]
          : [];
      } else {
        selections = Array.from(selected).map(key => {
          const [schema, table] = key.split('||');
          return { schema, table };
        });
      }
      if (selections.length === 0) { setError('No tables selected'); setImporting(false); return; }
      const res = await api.importMetadata(connectionId, selections);
      setResult(res.data?.data ?? { imported: 0, skipped: 0, errors: [] });
    } catch (e: any) {
      setError(e?.response?.data?.userMessage ?? 'Import failed');
    } finally { setImporting(false); }
  };

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-3xl space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-200">Import Metadata</h3>
            <p className="text-[12px] text-slate-500 mt-1">
              {isFile
                ? 'Introspect the file schema and register it in the Metadata Catalog. Click Import to infer column types from the file.'
                : 'Browse schemas and tables from the connected database. Select what to import into the Metadata Catalog.'}
            </p>
          </div>
          <button
            onClick={doImport}
            disabled={importing || isLoading || (!isFile && selected.size === 0)}
            className="flex items-center gap-2 h-9 px-4 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-[13px] font-medium transition-colors flex-shrink-0"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {importing ? 'Importing…' : isFile ? 'Import File Schema' : `Import Selected (${selected.size})`}
          </button>
        </div>

        {/* Result banner */}
        {result && (
          <div className={`p-4 rounded-lg border ${result.errors.length === 0 ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-amber-900/20 border-amber-700/40'}`}>
            <p className={`text-[13px] font-semibold ${result.errors.length === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
              {result.imported > 0 ? `✓ ${result.imported} dataset${result.imported !== 1 ? 's' : ''} imported` : 'Import complete'}
              {result.skipped > 0 ? ` · ${result.skipped} skipped` : ''}
            </p>
            {result.errors.map((e, i) => (
              <p key={i} className="text-[11px] text-red-400 mt-1 font-mono">{e}</p>
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg border bg-red-900/20 border-red-700/40 text-[12px] text-red-400">{error}</div>
        )}

        {/* File connection — simple summary */}
        {isFile && !isLoading && schemas.length > 0 && (
          <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-2">
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-2">File to Import</p>
            <div className="flex items-center gap-2 text-[12px]">
              <Table2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-slate-200 font-mono">{schemas[0].schemaName}</span>
            </div>
          </div>
        )}

        {/* DB connection — schema/table tree */}
        {isDb && (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/40 border-b border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Schema Browser</span>
              {schemas.length > 0 && <span className="text-[11px] text-slate-600">{schemas.length} schemas</span>}
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 p-4 text-[12px] text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading schemas…
              </div>
            )}
            {!isLoading && schemas.length === 0 && (
              <div className="p-4 text-[12px] text-slate-500">No schemas found. Check connection credentials.</div>
            )}
            {schemas.map(s => {
              const tables = tablesBySchema[s.schemaName] ?? [];
              const isExpanded = expandedSchema === s.schemaName;
              const loading = loadingSchema === s.schemaName;
              const allSel = tables.length > 0 && tables.every(t => selected.has(schemaKey(s.schemaName, t.tableName)));
              const someSel = tables.some(t => selected.has(schemaKey(s.schemaName, t.tableName)));
              return (
                <div key={s.schemaName} className="border-b border-slate-800/50 last:border-0">
                  <div className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800/30 cursor-pointer group"
                    onClick={() => expandSchema(s.schemaName)}>
                    {isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="flex-1 text-[12px] text-slate-300">{s.schemaName}</span>
                    {s.tableCount !== undefined && <span className="text-[11px] text-slate-600">{s.tableCount} tables</span>}
                    {tables.length > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleSchema(s.schemaName); }}
                        className="opacity-0 group-hover:opacity-100 text-[11px] text-blue-400 hover:text-blue-300 px-1"
                      >
                        {allSel ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                    {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
                  </div>
                  {isExpanded && (
                    <div className="pb-1">
                      {loading && <div className="px-10 py-1 text-[11px] text-slate-600">Loading tables…</div>}
                      {!loading && tables.length === 0 && <div className="px-10 py-1 text-[11px] text-slate-600 italic">No tables</div>}
                      {tables.map(t => {
                        const key = schemaKey(s.schemaName, t.tableName);
                        const isSel = selected.has(key);
                        return (
                          <div
                            key={t.tableName}
                            onClick={() => toggleTable(s.schemaName, t.tableName)}
                            className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-colors ${isSel ? 'bg-violet-900/20' : 'hover:bg-slate-800/30'}`}
                          >
                            {isSel
                              ? <CheckSquare className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                              : <Square className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
                            <Table2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="flex-1 text-[12px] text-slate-300">{t.tableName}</span>
                            <span className="text-[10px] text-slate-600 uppercase">{t.tableType}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isFile && !isDb && (
          <div className="p-6 text-center text-slate-500 text-[12px]">
            Metadata import is available for file and database connections.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Security sub-tab ─────────────────────────────────────────────────────

function SecurityTab({ data }: { data: FD }) {
  const rows = [
    { label: 'Secret Source',     value: String(data.secretSource ?? 'Platform Vault') },
    { label: 'Rotation Policy',   value: String(data.rotationPolicy ?? 'Manual') },
    { label: 'Last Rotated On',   value: String(data.lastRotatedOn ?? '—') },
    { label: 'Rotation Owner',    value: String(data.rotationOwner ?? '—') },
    { label: 'Masking Status',    value: String(data.maskingStatus ?? 'Enabled') },
  ];
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-lg bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-2">Security Configuration</div>
        {rows.map(r => (
          <div key={r.label} className="flex items-center text-[12px]">
            <span className="text-slate-500 w-40 flex-shrink-0">{r.label}</span>
            <span className="text-slate-300">{r.value}</span>
          </div>
        ))}
        <div className="pt-2 border-t border-slate-700">
          <div className="text-[11px] text-slate-500 mb-1">Restricted Fields</div>
          <div className="flex flex-wrap gap-1">
            {['password', 'secret', 'token', 'key'].map(f => (
              <span key={f} className="px-2 py-0.5 bg-red-900/30 border border-red-700/40 text-red-300 text-[11px] rounded">{f}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 text-[12px] text-amber-300/80 max-w-lg">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Secret fields are masked by default. Only users with Manage Secrets permission can modify secret references.
      </div>
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────

export function ConnectionWorkspace({ tabId }: { tabId: string }) {
  const dispatch       = useAppDispatch();
  const tab            = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab         = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'properties') as ConnectionSubTab;
  const connectionId   = tab?.objectId ?? '';
  const connectionName = tab?.objectName ?? 'Connection';

  const [formData, setFormData] = useState<FD>({
    connectionId,
    name: connectionName,
    technologyType: '',
    vendor: '',
    category: '',
    environment: 'Development',
    host: '', port: '', database: '', region: '',
    description: '', tags: '', owner: '',
    authMode: 'username_password',
    username: '', password: '', sslEnabled: false, certAlias: '',
    status: 'active',
    maxPoolSize: '',
    createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
    secretSource: 'Platform Vault', rotationPolicy: 'Manual', maskingStatus: 'Enabled',
  });
  const [isDirty, setIsDirty]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [lastTestResult, setLastTestResult] = useState<{ testedBy: string; testedOn: string; responseMs?: number; error?: string } | null>(null);

  const [usageRows, setUsageRows] = useState<Array<{ usageType: string; objectName: string; context: string }>>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [permissionRows, setPermissionRows] = useState<PermissionRow[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  const loadConnection = useCallback(async () => {
    if (!connectionId) return;
    setLoadError(null);
    try {
      const res = await api.getConnection(connectionId);
      const data = (res.data?.data ?? res.data) as Record<string, unknown>;
      setFormData(mapConnectionDtoToForm(data ?? {}, connectionName, connectionId));
    } catch (err: unknown) {
      setLoadError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load connection');
    }
  }, [connectionId, connectionName]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    dispatch(markTabUnsaved(tabId));
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!connectionId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = buildConnectionUpdatePayload(formData);
      await api.updateConnection(connectionId, payload);
      await loadConnection();
      setIsDirty(false);
      dispatch(markTabSaved(tabId));
    } catch (err: unknown) {
      setSaveError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to save connection');
    }
    finally { setIsSaving(false); }
  };

  const runConnectionTest = useCallback(async () => {
    if (!connectionId || testStatus === 'testing') return;
    setTestStatus('testing');
    setLastTestResult(null);
    try {
      const res = await api.testConnectionById(connectionId);
      const data = res.data?.data ?? res.data;
      const responseMs = Number(data?.latencyMs ?? data?.responseMs ?? 0);
      const passed = data?.success !== false;
      const failStep = !passed ? (data?.steps ?? []).find((s: { passed: boolean; message: string }) => !s.passed) : null;
      setTestStatus(passed ? 'success' : 'failed');
      setLastTestResult({
        testedBy: 'You',
        testedOn: new Date().toLocaleString(),
        responseMs: Number.isFinite(responseMs) ? responseMs : undefined,
        error: !passed ? (failStep?.message ?? 'Connection test failed') : undefined,
      });
      await loadConnection();
    } catch (err: unknown) {
      setTestStatus('failed');
      setLastTestResult({
        testedBy: 'You',
        testedOn: new Date().toLocaleString(),
        error: (err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Connection test failed',
      });
    }
  }, [connectionId, loadConnection, testStatus]);

  useEffect(() => {
    if (!connectionId) return;
    if (subTab === 'usage') {
      setUsageLoading(true);
      setUsageError(null);
      api.getConnectionUsage(connectionId)
        .then(res => {
          const data = res.data?.data ?? res.data;
          const mapped = (Array.isArray(data) ? data : []).map((row: any) => ({
            usageType: String(row.usageType ?? row.usage_type_code ?? 'USAGE'),
            objectName: String(row.objectName ?? row.object_display_name ?? 'Unknown'),
            context: String(row.context ?? row.context_text ?? ''),
          }));
          setUsageRows(mapped);
        })
        .catch((err: unknown) => setUsageError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load usage'))
        .finally(() => setUsageLoading(false));
    }

    if (subTab === 'history') {
      setHistoryLoading(true);
      setHistoryError(null);
      api.getConnectionHistory(connectionId, { limit: 100 })
        .then(res => {
          const data = res.data?.data ?? res.data;
          const mapped = (Array.isArray(data) ? data : []).map((row: any) => ({
            id: String(row.id),
            timestamp: String(row.timestamp ?? ''),
            action: String(row.action ?? 'UPDATED'),
            actor: String(row.actor ?? 'system'),
            comment: String(row.comment ?? ''),
            newValue: row.responseMs != null ? `Response ${row.responseMs}ms` : undefined,
            oldValue: row.errorMessage ? String(row.errorMessage) : undefined,
          })) as HistoryRow[];
          setHistoryRows(mapped);
        })
        .catch((err: unknown) => setHistoryError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load history'))
        .finally(() => setHistoryLoading(false));
    }

    if (subTab === 'permissions') {
      setPermissionsLoading(true);
      setPermissionsError(null);
      api.getConnectionPermissions(connectionId)
        .then(res => {
          const data = res.data?.data ?? res.data;
          const mapped = (Array.isArray(data) ? data : []).map((row: any) => ({
            id: String(row.id),
            principalType: (row.principalType === 'role' ? 'role' : 'user') as PermissionRow['principalType'],
            principalName: String(row.principalName ?? ''),
            accessLevel: String(row.roleName ?? row.accessLevel ?? 'ACCESS'),
            isInherited: false,
            grantedBy: String(row.grantedBy ?? 'system'),
            grantedOn: String(row.grantedOn ?? ''),
          })) as PermissionRow[];
          setPermissionRows(mapped);
        })
        .catch((err: unknown) => setPermissionsError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load permissions'))
        .finally(() => setPermissionsLoading(false));
    }
  }, [connectionId, subTab]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="connection"
        name={String(formData.name ?? connectionName)}
        hierarchyPath={tab?.hierarchyPath ?? `Connections → ${connectionName}`}
        status="published"
        isDirty={isDirty}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={runConnectionTest}
              disabled={testStatus === 'testing'}
              className="flex items-center gap-1.5 h-7 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[12px] font-medium transition-colors"
            >
              {testStatus === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />} Test
            </button>
            {isDirty && (
              <button
                onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        }
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="properties" />

      {loadError && <div className="px-5 pt-3 text-[12px] text-red-400">{loadError}</div>}
      {saveError && <div className="px-5 pt-2 text-[12px] text-red-400">{saveError}</div>}

      {/* Inline test result banner — visible on any sub-tab */}
      {testStatus !== 'idle' && (
        <div className={`mx-5 mt-3 flex items-center gap-3 px-4 py-2.5 rounded-lg border text-[12px] ${
          testStatus === 'testing' ? 'bg-slate-800/40 border-slate-700 text-slate-300' :
          testStatus === 'success' ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300' :
          'bg-red-900/20 border-red-700/40 text-red-300'
        }`}>
          {testStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
          {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
          {testStatus === 'failed'  && <XCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="flex-1">
            {testStatus === 'testing' ? 'Testing connection…' :
             testStatus === 'success' ? `Connection successful${lastTestResult?.responseMs != null ? ` · ${lastTestResult.responseMs}ms` : ''}` :
             lastTestResult?.error ?? 'Connection test failed'}
          </span>
          {testStatus !== 'testing' && (
            <button onClick={() => setTestStatus('idle')} className="text-current opacity-50 hover:opacity-100 ml-2">✕</button>
          )}
        </div>
      )}

      {subTab === 'properties'     && <PropertiesTab data={formData} onChange={handleChange} />}
      {subTab === 'import'         && <ImportMetadataTab connectionId={connectionId} category={String(formData.category ?? 'Other')} />}
      {subTab === 'usage'          && <UsageTab rows={usageRows} loading={usageLoading} error={usageError} />}
      {subTab === 'history'        && (
        <div className="flex-1 overflow-hidden">
          {historyError ? (
            <div className="p-4 text-[12px] text-red-400">{historyError}</div>
          ) : (
            <ObjectHistoryGrid rows={historyRows} loading={historyLoading} />
          )}
        </div>
      )}
      {subTab === 'permissions'    && (
        <div className="flex-1 overflow-hidden">
          {permissionsError ? (
            <div className="p-4 text-[12px] text-red-400">{permissionsError}</div>
          ) : (
            <ObjectPermissionsGrid rows={permissionRows} loading={permissionsLoading} readOnly />
          )}
        </div>
      )}
    </div>
  );
}
